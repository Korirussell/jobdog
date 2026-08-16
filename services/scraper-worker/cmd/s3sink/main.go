// Command s3sink is the batch-analytics half of the streaming pipeline: it
// consumes enriched.postings and writes Parquet files to an S3-compatible
// bucket for Databricks/Spark to read — see docs/kafka.md's "Spark
// aggregation" section.
//
// Disabled unless S3_BUCKET is set. S3_ENDPOINT should point at whatever
// S3-compatible store is actually in use — Cloudflare R2, MinIO for local
// testing, or omit it entirely for real AWS S3.
package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"jobdog/scraper-worker/config"
	"jobdog/scraper-worker/sink"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	log.Info().Msg("Starting JobDog S3 sink")

	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load config")
	}
	if len(cfg.KafkaBrokers) == 0 {
		log.Fatal().Msg("KAFKA_BROKERS is required for the S3 sink")
	}
	if !cfg.S3.Enabled() {
		log.Fatal().Msg("S3_BUCKET is required for the S3 sink")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	s, err := sink.New(ctx, cfg.KafkaBrokers, cfg.S3)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize S3 sink")
	}
	defer s.Close()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigChan
		log.Info().Msg("Shutdown signal received")
		cancel()
	}()

	log.Info().Str("bucket", cfg.S3.Bucket).Str("topic", "enriched.postings").Msg("Consuming enriched postings")
	if err := s.Run(ctx); err != nil && ctx.Err() == nil {
		log.Error().Err(err).Msg("Sink stopped with error")
	}

	log.Info().Msg("S3 sink stopped")
}
