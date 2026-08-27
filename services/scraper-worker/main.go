package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"jobdog/scraper-worker/config"
	"jobdog/scraper-worker/database"
	"jobdog/scraper-worker/health"
	"jobdog/scraper-worker/models"
	"jobdog/scraper-worker/repository"
	"jobdog/scraper-worker/scraper"
	"jobdog/scraper-worker/streaming"
	"jobdog/scraper-worker/workerpool"

	"github.com/robfig/cron/v3"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// scrapers bundles the per-platform scrapers a scrape cycle needs. Grouping
// them avoids a five-parameter signature on every function below.
type scrapers struct {
	github     *scraper.GitHubScraper
	workday    *scraper.WorkdayScraper
	greenhouse *scraper.GreenhouseScraper
	lever      *scraper.LeverScraper
	ashby      *scraper.AshbyScraper
}

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

	s := scrapers{
		github:     scraper.NewGitHubScraper(jobRepo),
		workday:    scraper.NewWorkdayScraper(jobRepo),
		greenhouse: scraper.NewGreenhouseScraper(jobRepo),
		lever:      scraper.NewLeverScraper(jobRepo),
		ashby:      scraper.NewAshbyScraper(jobRepo),
	}

	// Graduation-cohort classification is shared by every scraper: deterministic
	// keyword extraction first, a cached model verdict second, and a live model
	// call only for postings that are genuinely ambiguous. With no API key set the
	// scrapers still run, just without model-assisted cohort data.
	gradClassifier := scraper.NewGradYearClassifier(scraper.GradYearClassifierConfig{
		APIKey: cfg.OpenAIAPIKey,
		Model:  cfg.GradModel,
	})
	if !gradClassifier.Enabled() {
		log.Warn().Msg("OPENAI_API_KEY not set; grad-cohort classification will use deterministic rules only")
	}
	cohorts := scraper.NewCohortResolver(jobRepo, gradClassifier)
	s.github.SetCohortResolver(cohorts)
	s.workday.SetCohortResolver(cohorts)
	s.greenhouse.SetCohortResolver(cohorts)
	s.lever.SetCohortResolver(cohorts)
	s.ashby.SetCohortResolver(cohorts)

	// Streaming is opt-in: unset KAFKA_BROKERS and every scraper keeps
	// classifying and upserting synchronously, exactly as before this existed.
	// See docs/kafka.md and GreenhouseScraper.SetProducer. The classifier
	// consumer (cmd/classifier) does the actual classification/persistence for
	// whatever gets published.
	if len(cfg.KafkaBrokers) > 0 {
		log.Info().Strs("brokers", cfg.KafkaBrokers).Msg("KAFKA_BROKERS set; scrapers will publish to the streaming pipeline instead of upserting directly")
		if err := streaming.EnsureTopics(cfg.KafkaBrokers); err != nil {
			log.Warn().Err(err).Msg("Failed to ensure Kafka topics exist; continuing (they may already exist)")
		}
		producer := streaming.NewProducer(cfg.KafkaBrokers, "scraper-worker")
		defer producer.Close()
		s.github.SetProducer(producer)
		s.workday.SetProducer(producer)
		s.greenhouse.SetProducer(producer)
		s.lever.SetProducer(producer)
		s.ashby.SetProducer(producer)
	}

	c := cron.New()

	_, err = c.AddFunc("@every 2h", func() {
		runScrapeCycle(context.Background(), cfg, s, "scheduled")
	})
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to schedule scrape cycle")
	}

	urlChecker := scraper.NewURLChecker(jobRepo)

	_, err = c.AddFunc("@every 12h", func() {
		log.Info().Msg("Marking stale jobs as closed")
		// A job stops getting re-upserted (and its scraped_at stops advancing)
		// the moment it disappears from its company's board listing — that
		// listing is re-fetched every 2h (see the scrape cron above), so "still
		// ACTIVE after 30 days of no re-sighting" was a month-long window for a
		// posting that actually closed on day one to keep showing on the site
		// and 404ing when clicked. A day's buffer tolerates a few missed/failed
		// scrape cycles for one board without false-closing anything real.
		if err := jobRepo.MarkStaleJobsAsClosed(24 * time.Hour); err != nil {
			log.Error().Err(err).Msg("Failed to mark stale jobs")
		}

		log.Info().Msg("Purging old closed jobs")
		purgedCount, err := jobRepo.PurgeOldClosedJobs(90 * 24 * time.Hour)
		if err != nil {
			log.Error().Err(err).Msg("Failed to purge old closed jobs")
		} else {
			log.Info().Int64("count", purgedCount).Msg("Purged old closed jobs")
		}

		log.Info().Msg("Running URL liveness check")
		if err := urlChecker.CheckAndPruneURLs(context.Background()); err != nil {
			log.Error().Err(err).Msg("URL liveness check failed")
		}

		log.Info().Msg("Closing duplicate active job listings")
		closedCount, err := jobRepo.CloseDuplicateActiveJobs()
		if err != nil {
			log.Error().Err(err).Msg("Failed to close duplicate active jobs")
		} else {
			log.Info().Int64("count", closedCount).Msg("Closed duplicate active jobs")
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

	// Run once immediately on startup rather than waiting up to 2h for the
	// first cron tick.
	runScrapeCycle(context.Background(), cfg, s, "initial")

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	log.Info().Msg("Scraper worker is running. Press Ctrl+C to exit.")
	<-sigChan

	log.Info().Msg("Shutting down gracefully...")
	c.Stop()
	log.Info().Msg("Scraper worker stopped")
}

// runScrapeCycle runs every configured source once: aggregator repos, then
// (from what those repos turned up) any ATS boards we don't already poll
// directly, then every statically configured Workday/Greenhouse/Lever/Ashby
// source. label is just for logging ("scheduled" vs "initial").
func runScrapeCycle(ctx context.Context, cfg *config.Config, s scrapers, label string) {
	pool := workerpool.NewWorkerPool(10)
	pool.Start()

	var (
		mu             sync.Mutex
		aggregatorJobs []models.Job
	)

	// Aggregator repos (community-maintained job lists)
	for _, agg := range cfg.Aggregators {
		a := agg
		pool.Submit(func(ctx context.Context) error {
			log.Info().Str("repo", a.Repo).Str("cycle", label).Msg("Running aggregator scrape")
			jobs, err := s.github.ScrapeRepo(ctx, a.Repo, a.EmploymentType)
			if err != nil {
				log.Error().Err(err).Str("repo", a.Repo).Msg("Aggregator scrape failed")
				return err
			}
			mu.Lock()
			aggregatorJobs = append(aggregatorJobs, jobs...)
			mu.Unlock()
			return nil
		})
	}

	// Workday scrapers
	for _, source := range cfg.WorkdaySources {
		src := source
		pool.Submit(func(ctx context.Context) error {
			log.Info().Str("company", src.Company).Str("cycle", label).Msg("Running Workday scrape")
			if err := s.workday.ScrapeCompany(ctx, src.Company, src.Tenant, src.Datacenter, src.Site); err != nil {
				log.Error().Err(err).Str("company", src.Company).Msg("Workday scrape failed")
				return err
			}
			return nil
		})
	}

	// Greenhouse scrapers
	for _, source := range cfg.GreenhouseSources {
		src := source
		pool.Submit(func(ctx context.Context) error {
			log.Info().Str("company", src.Company).Str("cycle", label).Msg("Running Greenhouse scrape")
			if err := s.greenhouse.ScrapeCompany(ctx, src.Company, src.BoardToken); err != nil {
				log.Error().Err(err).Str("company", src.Company).Msg("Greenhouse scrape failed")
				return err
			}
			return nil
		})
	}

	// Lever scrapers
	for _, source := range cfg.LeverSources {
		src := source
		pool.Submit(func(ctx context.Context) error {
			log.Info().Str("company", src.Company).Str("cycle", label).Msg("Running Lever scrape")
			if err := s.lever.ScrapeCompany(ctx, src.Company, src.Slug); err != nil {
				log.Error().Err(err).Str("company", src.Company).Msg("Lever scrape failed")
				return err
			}
			return nil
		})
	}

	// Ashby scrapers
	for _, source := range cfg.AshbySources {
		src := source
		pool.Submit(func(ctx context.Context) error {
			log.Info().Str("company", src.Company).Str("cycle", label).Msg("Running Ashby scrape")
			if err := s.ashby.ScrapeCompany(ctx, src.Company, src.Token); err != nil {
				log.Error().Err(err).Str("company", src.Company).Msg("Ashby scrape failed")
				return err
			}
			return nil
		})
	}

	pool.Shutdown()
	log.Info().Str("cycle", label).Msg("Configured sources completed")

	discoverAndPollNewBoards(ctx, cfg, s, aggregatorJobs, label)

	log.Info().Str("cycle", label).Msg("Scrape cycle completed")
}

// discoverAndPollNewBoards finds ATS boards referenced by this cycle's
// aggregator rows that aren't already in the static config, and polls each
// directly right away — so a company we only just learned about gets a real
// job description (and therefore real grad-cohort/experience classification)
// the same cycle it's discovered, rather than waiting on someone to notice
// and run `cmd/discover` by hand.
//
// This deliberately does NOT write back to sources.json. Promoting a board
// there is still a reviewed, committed change (see cmd/discover's doc
// comment) — this only closes the classification gap for the current cycle.
// Because nothing is persisted, the same board gets rediscovered and
// re-probed every cycle until someone does run cmd/discover and commit it;
// that's a bounded, deliberate cost, not a leak, since the board set is
// capped by how many distinct companies the aggregator repos list.
func discoverAndPollNewBoards(ctx context.Context, cfg *config.Config, s scrapers, aggregatorJobs []models.Job, label string) {
	if len(aggregatorJobs) == 0 {
		return
	}

	discovered := scraper.DiscoverBoards(aggregatorJobs)
	if len(discovered) == 0 {
		return
	}

	existing := map[string]struct{}{}
	for _, src := range cfg.GreenhouseSources {
		existing[scraper.BoardKey(scraper.Board{Platform: scraper.PlatformGreenhouse, Token: src.BoardToken})] = struct{}{}
	}
	for _, src := range cfg.LeverSources {
		existing[scraper.BoardKey(scraper.Board{Platform: scraper.PlatformLever, Token: src.Slug})] = struct{}{}
	}
	for _, src := range cfg.AshbySources {
		existing[scraper.BoardKey(scraper.Board{Platform: scraper.PlatformAshby, Token: src.Token})] = struct{}{}
	}
	for _, src := range cfg.WorkdaySources {
		existing[scraper.BoardKey(scraper.Board{Platform: scraper.PlatformWorkday, Tenant: src.Tenant, Datacenter: src.Datacenter, Site: src.Site})] = struct{}{}
	}

	var newBoards []scraper.Board
	for _, board := range discovered {
		if _, known := existing[scraper.BoardKey(board)]; !known {
			newBoards = append(newBoards, board)
		}
	}
	if len(newBoards) == 0 {
		return
	}

	log.Info().Int("count", len(newBoards)).Str("cycle", label).
		Msg("Discovered boards not in static config; polling directly this cycle only")

	pool := workerpool.NewWorkerPool(5)
	pool.Start()

	for _, board := range newBoards {
		b := board
		pool.Submit(func(ctx context.Context) error {
			switch b.Platform {
			case scraper.PlatformGreenhouse:
				return s.greenhouse.ScrapeCompany(ctx, b.Company, b.Token)
			case scraper.PlatformLever:
				return s.lever.ScrapeCompany(ctx, b.Company, b.Token)
			case scraper.PlatformAshby:
				return s.ashby.ScrapeCompany(ctx, b.Company, b.Token)
			case scraper.PlatformWorkday:
				return s.workday.ScrapeCompany(ctx, b.Company, b.Tenant, b.Datacenter, b.Site)
			default:
				return nil
			}
		})
	}

	pool.Shutdown()
	log.Info().Int("count", len(newBoards)).Str("cycle", label).Msg("Finished polling newly discovered boards")
}
