package streaming

import (
	"context"
	"fmt"
	"time"

	"jobdog/scraper-worker/models"

	"github.com/segmentio/kafka-go"
)

// Producer publishes raw postings for the classifier consumer to pick up.
// One Producer per process is enough — kafka-go's Writer is safe for
// concurrent use, which is what every scraper's worker-pool goroutines need.
type Producer struct {
	writer     *kafka.Writer
	producedBy string
}

// NewProducer connects to the given brokers. brokers is what KAFKA_BROKERS
// parses into; callers should not construct a Producer when it's empty —
// see config.Config.KafkaBrokers and the nil-Producer contract on
// PublishRawPosting below.
func NewProducer(brokers []string, producedBy string) *Producer {
	return &Producer{
		writer: &kafka.Writer{
			Addr: kafka.TCP(brokers...),
			// Job ID is the partition key everywhere in this pipeline — see
			// docs/kafka.md's "partition key is source_job_id" section. Every
			// event for a given posting must land on the same partition and be
			// processed in order by exactly one consumer; keying any other way
			// (company, round-robin) breaks that guarantee.
			Balancer: &kafka.Hash{},
			// At-least-once: wait for the leader to ack, not the full ISR. A
			// posting is re-scraped every cycle regardless, so losing a rare
			// unacked write to a broker crash costs a few minutes of staleness,
			// not data — RequireAll would cost latency for a guarantee this
			// pipeline doesn't need.
			RequiredAcks: kafka.RequireOne,
			Async:        false,
			// kafka-go's default BatchTimeout is 1s: a synchronous WriteMessages
			// call for a single message waits out that whole batching window
			// before flushing, since there's nothing else to fill the batch. A
			// scraper publishing dozens of postings per cycle in a plain
			// sequential loop would otherwise spend one full second per posting
			// on pure batching delay — 85 postings would take over a minute of
			// nothing but waiting. Discovered by timing repeated
			// PublishRawPosting calls against a real broker: every call took
			// ~1.00s regardless of payload size, which only makes sense as a
			// fixed batch-timer wait, not network latency.
			BatchTimeout: 10 * time.Millisecond,
		},
		producedBy: producedBy,
	}
}

// PublishRawPosting sends one scraped job to raw.postings, keyed by its
// SourceJobID. A nil Producer is a deliberate no-op so callers can hold one
// unconditionally without branching on whether Kafka is configured — see
// GreenhouseScraper for the pattern.
func (p *Producer) PublishRawPosting(ctx context.Context, job models.Job) error {
	if p == nil {
		return nil
	}

	body, err := marshalRawPosting(RawPosting{
		Job:        job,
		ScrapedAt:  time.Now(),
		ProducedBy: p.producedBy,
	})
	if err != nil {
		return fmt.Errorf("marshaling raw posting: %w", err)
	}

	msg := kafka.Message{
		Topic: TopicRawPostings,
		Key:   []byte(job.SourceJobID),
		Value: body,
	}

	if err := p.writer.WriteMessages(ctx, msg); err != nil {
		return fmt.Errorf("publishing raw posting: %w", err)
	}
	return nil
}

// PublishEnrichedPosting sends a classifier verdict to enriched.postings —
// the feed Spark/Databricks batch jobs read for trend aggregation, per
// docs/kafka.md's architecture diagram.
func (p *Producer) PublishEnrichedPosting(ctx context.Context, posting EnrichedPosting) error {
	if p == nil {
		return nil
	}

	body, err := marshalEnrichedPosting(posting)
	if err != nil {
		return fmt.Errorf("marshaling enriched posting: %w", err)
	}

	msg := kafka.Message{
		Topic: TopicEnrichedPostings,
		Key:   []byte(posting.SourceJobID),
		Value: body,
	}

	if err := p.writer.WriteMessages(ctx, msg); err != nil {
		return fmt.Errorf("publishing enriched posting: %w", err)
	}
	return nil
}

// Close flushes and releases the underlying connection. Safe to call on a
// nil Producer.
func (p *Producer) Close() error {
	if p == nil {
		return nil
	}
	return p.writer.Close()
}
