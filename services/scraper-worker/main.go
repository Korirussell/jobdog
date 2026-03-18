package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"jobdog/scraper-worker/config"
	"jobdog/scraper-worker/database"
	"jobdog/scraper-worker/health"
	"jobdog/scraper-worker/repository"
	"jobdog/scraper-worker/scraper"
	"jobdog/scraper-worker/workerpool"

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
	greenhouseScraper := scraper.NewGreenhouseScraper(jobRepo)
	leverScraper := scraper.NewLeverScraper(jobRepo)

	c := cron.New()

	_, err = c.AddFunc("@every 6h", func() {
		pool := workerpool.NewWorkerPool(10)
		pool.Start()

		// GitHub scraper
		pool.Submit(func(ctx context.Context) error {
			log.Info().Msg("Running scheduled GitHub scrape")
			if err := githubScraper.ScrapeSimplifyRepo(ctx); err != nil {
				log.Error().Err(err).Msg("GitHub scrape failed")
				return err
			}
			return nil
		})

		// Workday scrapers
		for _, source := range cfg.WorkdaySources {
			s := source
			pool.Submit(func(ctx context.Context) error {
				log.Info().Str("company", s.Company).Msg("Running scheduled Workday scrape")
				if err := workdayScraper.ScrapeCompany(ctx, s.Company, s.URL); err != nil {
					log.Error().Err(err).Str("company", s.Company).Msg("Workday scrape failed")
					return err
				}
				return nil
			})
		}

		// Greenhouse scrapers
		for _, source := range cfg.GreenhouseSources {
			s := source
			pool.Submit(func(ctx context.Context) error {
				log.Info().Str("company", s.Company).Msg("Running scheduled Greenhouse scrape")
				if err := greenhouseScraper.ScrapeCompany(ctx, s.Company, s.BoardToken); err != nil {
					log.Error().Err(err).Str("company", s.Company).Msg("Greenhouse scrape failed")
					return err
				}
				return nil
			})
		}

		// Lever scrapers
		for _, source := range cfg.LeverSources {
			s := source
			pool.Submit(func(ctx context.Context) error {
				log.Info().Str("company", s.Company).Msg("Running scheduled Lever scrape")
				if err := leverScraper.ScrapeCompany(ctx, s.Company, s.Slug); err != nil {
					log.Error().Err(err).Str("company", s.Company).Msg("Lever scrape failed")
					return err
				}
				return nil
			})
		}

		pool.Shutdown()
		log.Info().Msg("All scheduled scrapers completed")
	})
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to schedule GitHub scraper")
	}

	urlChecker := scraper.NewURLChecker(jobRepo)

	_, err = c.AddFunc("@every 12h", func() {
		log.Info().Msg("Marking stale jobs as closed")
		if err := jobRepo.MarkStaleJobsAsClosed(30 * 24 * time.Hour); err != nil {
			log.Error().Err(err).Msg("Failed to mark stale jobs")
		}

		log.Info().Msg("Running URL liveness check")
		if err := urlChecker.CheckAndPruneURLs(context.Background()); err != nil {
			log.Error().Err(err).Msg("URL liveness check failed")
		}
	})
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to schedule cleanup job")
	}

	c.Start()
	log.Info().Msg("Cron scheduler started")

	// Start health check server
	http.HandleFunc("/health", health.HealthHandler(db.DB))
	go func() {
		log.Info().Msg("Starting health check server on :8081")
		if err := http.ListenAndServe(":8081", nil); err != nil {
			log.Error().Err(err).Msg("Health check server failed")
		}
	}()

	initialPool := workerpool.NewWorkerPool(10)
	initialPool.Start()

	// Initial GitHub scrape
	log.Info().Msg("Submitting initial GitHub scrape task")
	initialPool.Submit(func(ctx context.Context) error {
		log.Info().Msg("Starting initial GitHub scrape")
		if err := githubScraper.ScrapeSimplifyRepo(ctx); err != nil {
			log.Error().Err(err).Msg("Initial GitHub scrape failed")
			return err
		}
		log.Info().Msg("Initial GitHub scrape completed successfully")
		return nil
	})

	// Initial Workday scrapes
	if len(cfg.WorkdaySources) > 0 {
		log.Info().Int("count", len(cfg.WorkdaySources)).Msg("Submitting Workday scrape tasks")
		for _, source := range cfg.WorkdaySources {
			s := source
			initialPool.Submit(func(ctx context.Context) error {
				log.Info().Str("company", s.Company).Msg("Starting initial Workday scrape")
				if err := workdayScraper.ScrapeCompany(ctx, s.Company, s.URL); err != nil {
					log.Error().Err(err).Str("company", s.Company).Msg("Initial Workday scrape failed")
					return err
				}
				log.Info().Str("company", s.Company).Msg("Initial Workday scrape completed")
				return nil
			})
		}
	} else {
		log.Info().Msg("No Workday sources configured, skipping Workday scrapes")
	}

	// Initial Greenhouse scrapes
	log.Info().Int("count", len(cfg.GreenhouseSources)).Msg("Submitting Greenhouse scrape tasks")
	for _, source := range cfg.GreenhouseSources {
		s := source
		initialPool.Submit(func(ctx context.Context) error {
			log.Info().Str("company", s.Company).Msg("Starting initial Greenhouse scrape")
			if err := greenhouseScraper.ScrapeCompany(ctx, s.Company, s.BoardToken); err != nil {
				log.Error().Err(err).Str("company", s.Company).Msg("Initial Greenhouse scrape failed")
				return err
			}
			log.Info().Str("company", s.Company).Msg("Initial Greenhouse scrape completed")
			return nil
		})
	}

	// Initial Lever scrapes
	log.Info().Int("count", len(cfg.LeverSources)).Msg("Submitting Lever scrape tasks")
	for _, source := range cfg.LeverSources {
		s := source
		initialPool.Submit(func(ctx context.Context) error {
			log.Info().Str("company", s.Company).Msg("Starting initial Lever scrape")
			if err := leverScraper.ScrapeCompany(ctx, s.Company, s.Slug); err != nil {
				log.Error().Err(err).Str("company", s.Company).Msg("Initial Lever scrape failed")
				return err
			}
			log.Info().Str("company", s.Company).Msg("Initial Lever scrape completed")
			return nil
		})
	}

	log.Info().Msg("Waiting for all initial scraper tasks to complete...")
	initialPool.Shutdown()
	log.Info().Msg("All initial scrapers completed")

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	log.Info().Msg("Scraper worker is running. Press Ctrl+C to exit.")
	<-sigChan

	log.Info().Msg("Shutting down gracefully...")
	c.Stop()
	log.Info().Msg("Scraper worker stopped")
}
