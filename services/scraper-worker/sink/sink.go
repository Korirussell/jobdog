package sink

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"jobdog/scraper-worker/streaming"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"github.com/segmentio/kafka-go"
)

// flushBatchSize and flushInterval bound how large a buffered batch gets
// before it's written out, whichever comes first. Batching (rather than one
// Parquet file per posting) exists because Spark/Databricks reads are
// dominated by file-open overhead on a bucket with many tiny files — see the
// comment on encodeParquet.
const (
	flushBatchSize = 500
	flushInterval  = 30 * time.Second
)

// Sink consumes enriched.postings and writes batches of rows to S3 as
// Parquet, partitioned by classification date.
type Sink struct {
	reader   *kafka.Reader
	uploader *uploader
	prefix   string
}

// New connects to brokers and cfg.Endpoint. Callers should check
// cfg.Enabled() first — see cmd/s3sink.
func New(ctx context.Context, brokers []string, cfg Config) (*Sink, error) {
	up, err := newUploader(ctx, cfg)
	if err != nil {
		return nil, err
	}

	return &Sink{
		reader: kafka.NewReader(kafka.ReaderConfig{
			Brokers: brokers,
			Topic:   streaming.TopicEnrichedPostings,
			GroupID: "s3-sink",
		}),
		uploader: up,
		prefix:   cfg.PathPrefix,
	}, nil
}

// Run buffers messages until flushBatchSize is reached or flushInterval
// elapses, uploads the batch as one Parquet file, then commits every
// buffered message's offset. A message is never counted as processed until
// its batch's upload actually succeeds — a crash mid-batch replays the whole
// batch on restart rather than losing rows, the same at-least-once contract
// the classifier consumer holds.
func (s *Sink) Run(ctx context.Context) error {
	var (
		buffered []kafka.Message
		rows     []Row
		ticker   = time.NewTicker(flushInterval)
	)
	defer ticker.Stop()

	msgCh := make(chan kafka.Message)
	errCh := make(chan error, 1)
	go func() {
		for {
			msg, err := s.reader.FetchMessage(ctx)
			if err != nil {
				errCh <- err
				return
			}
			msgCh <- msg
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return s.flush(context.Background(), buffered, rows)

		case err := <-errCh:
			// Flush whatever's already buffered before surfacing the error —
			// losing a live connection shouldn't also throw away rows already
			// held in memory.
			if flushErr := s.flush(context.Background(), buffered, rows); flushErr != nil {
				log.Error().Err(flushErr).Msg("Failed to flush buffered rows after reader error")
			}
			return err

		case msg := <-msgCh:
			var posting streaming.EnrichedPosting
			if err := json.Unmarshal(msg.Value, &posting); err != nil {
				log.Error().Err(err).Msg("Dropping unparseable enriched posting")
				if err := s.reader.CommitMessages(ctx, msg); err != nil {
					log.Error().Err(err).Msg("Failed to commit offset for unparseable message")
				}
				continue
			}
			buffered = append(buffered, msg)
			rows = append(rows, rowFromEnrichedPosting(posting))

			if len(rows) >= flushBatchSize {
				if err := s.flush(ctx, buffered, rows); err != nil {
					log.Error().Err(err).Msg("Flush failed; batch will be retried")
					continue
				}
				buffered, rows = nil, nil
			}

		case <-ticker.C:
			if len(rows) == 0 {
				continue
			}
			if err := s.flush(ctx, buffered, rows); err != nil {
				log.Error().Err(err).Msg("Timed flush failed; batch will be retried")
				continue
			}
			buffered, rows = nil, nil
		}
	}
}

func (s *Sink) flush(ctx context.Context, buffered []kafka.Message, rows []Row) error {
	if len(rows) == 0 {
		return nil
	}

	body, err := encodeParquet(rows)
	if err != nil {
		return fmt.Errorf("encoding batch of %d rows: %w", len(rows), err)
	}

	key := fmt.Sprintf("%s/%s/part-%s.parquet", s.prefix, rows[0].partitionKey(time.UnixMilli(rows[0].ClassifiedAt)), uuid.NewString())

	if err := s.uploader.upload(ctx, key, body); err != nil {
		return err
	}

	if err := s.reader.CommitMessages(ctx, buffered...); err != nil {
		return fmt.Errorf("committing offsets after successful upload of %s: %w", key, err)
	}

	log.Info().Str("key", key).Int("rows", len(rows)).Msg("Flushed enriched postings batch to S3")
	return nil
}

// Close releases the Kafka reader.
func (s *Sink) Close() error {
	return s.reader.Close()
}
