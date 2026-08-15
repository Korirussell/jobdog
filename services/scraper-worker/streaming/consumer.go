package streaming

import (
	"context"
	"errors"
	"fmt"

	"github.com/rs/zerolog/log"
	"github.com/segmentio/kafka-go"
)

// TopicRawPostingsDLQ receives a raw posting that failed to process
// maxHandlerAttempts times in a row. Per docs/kafka.md's answer to "how do
// you handle a poison message?": bounded retries, then dead-letter and commit
// the offset anyway, so one malformed posting can't block every posting
// behind it on the same partition forever.
const TopicRawPostingsDLQ = "raw.postings.dlq"

// maxHandlerAttempts bounds how many times the consumer retries a single
// message before giving up on it and routing to the DLQ.
const maxHandlerAttempts = 3

// RawPostingConsumer reads raw.postings as part of the "classifier" consumer
// group and hands each message to a caller-supplied handler.
type RawPostingConsumer struct {
	reader *kafka.Reader
	dlq    *kafka.Writer
}

// NewRawPostingConsumer joins the "classifier" consumer group. Scaling the
// classifier means running more of these — up to RawPostingsPartitions
// instances usefully; a group member past that sits idle, per docs/kafka.md.
func NewRawPostingConsumer(brokers []string) *RawPostingConsumer {
	return &RawPostingConsumer{
		reader: kafka.NewReader(kafka.ReaderConfig{
			Brokers: brokers,
			Topic:   TopicRawPostings,
			GroupID: "classifier",
			// Manual commit — see Consume. Auto-commit would ack a message
			// before we know the DB write actually landed, which is exactly the
			// crash-between-write-and-commit case at-least-once delivery exists
			// to survive.
		}),
		dlq: &kafka.Writer{
			Addr:         kafka.TCP(brokers...),
			RequiredAcks: kafka.RequireOne,
		},
	}
}

// Consume runs handler over every message on raw.postings until ctx is
// canceled. The offset is committed only after handler returns nil, so a
// crash between the DB write and the commit replays the message on restart —
// safe because UpsertJob is an idempotent upsert keyed on source_url. A
// handler that keeps failing is retried up to maxHandlerAttempts times, then
// dead-lettered and committed anyway so it doesn't block the partition.
func (c *RawPostingConsumer) Consume(ctx context.Context, handler func(context.Context, RawPosting) error) error {
	for {
		msg, err := c.reader.FetchMessage(ctx)
		if err != nil {
			if errors.Is(err, context.Canceled) {
				return nil
			}
			return fmt.Errorf("fetching message: %w", err)
		}

		posting, err := unmarshalRawPosting(msg.Value)
		if err != nil {
			log.Error().Err(err).Msg("Dropping unparseable raw posting message")
			c.deadLetter(ctx, msg, "unmarshal failed: "+err.Error())
			if commitErr := c.reader.CommitMessages(ctx, msg); commitErr != nil {
				log.Error().Err(commitErr).Msg("Failed to commit offset for unparseable message")
			}
			continue
		}

		var handleErr error
		for attempt := 1; attempt <= maxHandlerAttempts; attempt++ {
			if handleErr = handler(ctx, posting); handleErr == nil {
				break
			}
			log.Warn().Err(handleErr).Str("source_job_id", posting.Job.SourceJobID).
				Int("attempt", attempt).Msg("Raw posting handler failed")
		}

		if handleErr != nil {
			c.deadLetter(ctx, msg, handleErr.Error())
		}

		// Commit even on exhausted-retry failure: leaving the offset uncommitted
		// would replay the same poison message forever and block every posting
		// behind it on this partition.
		if err := c.reader.CommitMessages(ctx, msg); err != nil {
			log.Error().Err(err).Msg("Failed to commit offset")
		}
	}
}

func (c *RawPostingConsumer) deadLetter(ctx context.Context, msg kafka.Message, reason string) {
	dlqMsg := kafka.Message{
		Topic: TopicRawPostingsDLQ,
		Key:   msg.Key,
		Value: msg.Value,
		Headers: []kafka.Header{
			{Key: "dlq-reason", Value: []byte(reason)},
		},
	}
	if err := c.dlq.WriteMessages(ctx, dlqMsg); err != nil {
		log.Error().Err(err).Msg("Failed to publish to dead-letter topic")
	}
}

// Close releases the reader and DLQ writer.
func (c *RawPostingConsumer) Close() error {
	readerErr := c.reader.Close()
	dlqErr := c.dlq.Close()
	if readerErr != nil {
		return readerErr
	}
	return dlqErr
}
