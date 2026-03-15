package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"jobdog/scraper-worker/config"
	"jobdog/scraper-worker/database"
	"jobdog/scraper-worker/repository"
	"jobdog/scraper-worker/scraper"

	"github.com/robfig/cron/v3"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	log.Info().Msg("Starting JobDog scraper worker")

	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load config")
	}

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to database")
	}
	defer db.Close()

	log.Info().Msg("Database connected")

	jobRepo := repository.NewJobRepository(db)

	githubScraper := scraper.NewGitHubScraper(jobRepo)
	workdayScraper := scraper.NewWorkdayScraper(jobRepo)

	c := cron.New()

	_, err = c.AddFunc("@every 6h", func() {
		ctx := context.Background()
		log.Info().Msg("Running scheduled GitHub scrape")
		if err := githubScraper.ScrapeSimplifyRepo(ctx); err != nil {
			log.Error().Err(err).Msg("GitHub scrape failed")
		}
		for _, source := range cfg.WorkdaySources {
			log.Info().Str("company", source.Company).Msg("Running scheduled Workday scrape")
			if err := workdayScraper.ScrapeCompany(ctx, source.Company, source.URL); err != nil {
				log.Error().Err(err).Str("company", source.Company).Msg("Workday scrape failed")
			}
		}
	})
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to schedule GitHub scraper")
	}

	_, err = c.AddFunc("@every 12h", func() {
		log.Info().Msg("Marking stale jobs as closed")
		if err := jobRepo.MarkStaleJobsAsClosed(30 * 24 * time.Hour); err != nil {
			log.Error().Err(err).Msg("Failed to mark stale jobs")
		}
	})
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to schedule cleanup job")
	}

	c.Start()
	log.Info().Msg("Cron scheduler started")

	ctx := context.Background()
	log.Info().Msg("Running initial GitHub scrape")
	if err := githubScraper.ScrapeSimplifyRepo(ctx); err != nil {
		log.Error().Err(err).Msg("Initial GitHub scrape failed")
	}
	for _, source := range cfg.WorkdaySources {
		log.Info().Str("company", source.Company).Msg("Running initial Workday scrape")
		if err := workdayScraper.ScrapeCompany(ctx, source.Company, source.URL); err != nil {
			log.Error().Err(err).Str("company", source.Company).Msg("Initial Workday scrape failed")
		}
	}

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	log.Info().Msg("Scraper worker is running. Press Ctrl+C to exit.")
	<-sigChan

	log.Info().Msg("Shutting down gracefully...")
	c.Stop()
	log.Info().Msg("Scraper worker stopped")
}
