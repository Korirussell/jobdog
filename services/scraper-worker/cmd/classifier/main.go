// Command classifier is the consumer half of the streaming pipeline described
// in docs/kafka.md: it reads raw.postings, runs the same
// experience-level/grad-cohort/skills classification the synchronous scrapers
// do, persists the result, and republishes it to enriched.postings for
// Spark/Databricks batch aggregation to read.
//
// Only meaningful once at least one scraper is publishing to raw.postings —
// see GreenhouseScraper.SetProducer and the KAFKA_BROKERS env var. Run
// multiple instances (up to streaming.RawPostingsPartitions) to scale
// consumption; they join the same "classifier" consumer group automatically.
package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"jobdog/scraper-worker/config"
	"jobdog/scraper-worker/database"
	"jobdog/scraper-worker/models"
	"jobdog/scraper-worker/repository"
	"jobdog/scraper-worker/scraper"
	"jobdog/scraper-worker/streaming"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	log.Info().Msg("Starting JobDog classifier consumer")

	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load config")
	}
	if len(cfg.KafkaBrokers) == 0 {
		log.Fatal().Msg("KAFKA_BROKERS is required for the classifier consumer")
	}

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to database")
	}
	defer db.Close()

	jobRepo := repository.NewJobRepository(db)

	gradClassifier := scraper.NewGradYearClassifier(scraper.GradYearClassifierConfig{
		APIKey: cfg.OpenAIAPIKey,
		Model:  cfg.GradModel,
	})
	if !gradClassifier.Enabled() {
		log.Warn().Msg("OPENAI_API_KEY not set; grad-cohort classification will use deterministic rules only")
	}
	cohorts := scraper.NewCohortResolver(jobRepo, gradClassifier)

	if err := streaming.EnsureTopics(cfg.KafkaBrokers); err != nil {
		log.Warn().Err(err).Msg("Failed to ensure topics exist; continuing (they may already exist)")
	}

	producer := streaming.NewProducer(cfg.KafkaBrokers, "classifier")
	defer producer.Close()

	consumer := streaming.NewRawPostingConsumer(cfg.KafkaBrokers)
	defer consumer.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigChan
		log.Info().Msg("Shutdown signal received")
		cancel()
	}()

	log.Info().Str("topic", streaming.TopicRawPostings).Msg("Consuming raw postings")
	err = consumer.Consume(ctx, func(ctx context.Context, posting streaming.RawPosting) error {
		return classify(ctx, jobRepo, cohorts, producer, posting)
	})
	if err != nil {
		log.Error().Err(err).Msg("Consumer stopped with error")
	}

	log.Info().Msg("Classifier consumer stopped")
}

// classify runs the exact classification a synchronous scraper would have
// run, persists it, and republishes the verdict. Mirrors the pattern
// duplicated across greenhouse_scraper.go/lever_scraper.go/ashby_scraper.go/
// workday.go/github_scraper.go — this is that same sequence, just triggered by
// a Kafka message instead of an HTTP response.
func classify(ctx context.Context, jobRepo *repository.JobRepository, cohorts *scraper.CohortResolver, producer *streaming.Producer, posting streaming.RawPosting) error {
	job := posting.Job
	job.ExperienceLevel = scraper.ClassifyExperienceLevel(job.Title, job.DescriptionText)
	job.RoleCategory = string(scraper.ClassifyRoleCategory(job.Title))
	job.LocationScope = string(scraper.ClassifyLocationScope(job.Location))

	jobID, descriptionAccepted, err := jobRepo.UpsertJob(&job)
	if err != nil {
		return err
	}
	if !descriptionAccepted {
		// A richer description already on file won — see the comment on
		// UpsertJob. Nothing further to do for this message.
		return nil
	}

	grad := cohorts.Resolve(ctx, jobID, &job)

	required, preferred := scraper.ExtractSkills(job.DescriptionText)
	profile := &models.JobRequirementProfile{
		JobID:            jobID,
		RequiredSkills:   required,
		PreferredSkills:  preferred,
		ExtractionMethod: "KEYWORD",
	}
	if err := jobRepo.UpsertJobRequirementProfile(profile); err != nil {
		log.Warn().Err(err).Str("job_id", jobID).Msg("Failed to upsert requirement profile")
	}

	if err := producer.PublishEnrichedPosting(ctx, streaming.EnrichedPosting{
		JobID:           jobID,
		SourceJobID:     job.SourceJobID,
		Title:           job.Title,
		Company:         job.Company,
		ExperienceLevel: job.ExperienceLevel,
		EntryType:       string(grad.EntryType),
		GradYearMin:     grad.YearMin,
		GradYearMax:     grad.YearMax,
		RequiredSkills:  required,
		PreferredSkills: preferred,
		ClassifiedAt:    time.Now(),
	}); err != nil {
		// Not fatal: the row is already correctly persisted. Losing this
		// publish only means the enriched.postings feed misses one event, not
		// that the posting is unclassified.
		log.Warn().Err(err).Str("job_id", jobID).Msg("Failed to publish enriched posting")
	}

	return nil
}
