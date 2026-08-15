package streaming

import (
	"fmt"

	"github.com/segmentio/kafka-go"
)

// EnsureTopics creates raw.postings, enriched.postings, and the DLQ topic with
// the partition counts this pipeline is designed around, if they don't exist
// yet. Redpanda (and Kafka) auto-create a topic on first produce if left to
// their own devices, but with a broker-default partition count — usually 1 —
// which would silently defeat the whole point of partitioning by
// source_job_id for consumer parallelism. Called once at startup by whichever
// process (producer or consumer) starts first; CreateTopics is a no-op for a
// topic that already exists.
func EnsureTopics(brokers []string) error {
	if len(brokers) == 0 {
		return nil
	}

	conn, err := kafka.Dial("tcp", brokers[0])
	if err != nil {
		return fmt.Errorf("dialing broker: %w", err)
	}
	defer conn.Close()

	controller, err := conn.Controller()
	if err != nil {
		return fmt.Errorf("finding controller: %w", err)
	}

	controllerConn, err := kafka.Dial("tcp", fmt.Sprintf("%s:%d", controller.Host, controller.Port))
	if err != nil {
		return fmt.Errorf("dialing controller: %w", err)
	}
	defer controllerConn.Close()

	topics := []kafka.TopicConfig{
		{
			Topic:             TopicRawPostings,
			NumPartitions:     RawPostingsPartitions,
			ReplicationFactor: 1, // single-node dev broker; a real deployment sets this per docs/kafka.md's retention/ops notes
		},
		{
			Topic:             TopicEnrichedPostings,
			NumPartitions:     RawPostingsPartitions,
			ReplicationFactor: 1,
		},
		{
			Topic:             TopicRawPostingsDLQ,
			NumPartitions:     1, // no ordering guarantee needed for dead-lettered messages
			ReplicationFactor: 1,
		},
	}

	return controllerConn.CreateTopics(topics...)
}
