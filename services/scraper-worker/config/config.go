package config

import (
	"fmt"
	"os"
	"time"
)

type WorkdaySource struct {
	Company string
	URL     string
}

type GreenhouseSource struct {
	Company    string
	BoardToken string
}

type LeverSource struct {
	Company string
	Slug    string
}

type Config struct {
	DatabaseURL       string
	DatabaseUser      string
	DatabasePassword  string
	OpenAIAPIKey      string
	LogLevel          string
	ScrapeInterval    time.Duration
	WorkdaySources    []WorkdaySource
	GreenhouseSources []GreenhouseSource
	LeverSources      []LeverSource
}

func Load() (*Config, error) {
	cfg := &Config{
		DatabaseURL:      getEnv("DATABASE_URL", "postgres://jobdog:jobdog@localhost:5432/jobdog?sslmode=disable"),
		DatabaseUser:     getEnv("DATABASE_USERNAME", "jobdog"),
		DatabasePassword: getEnv("DATABASE_PASSWORD", "jobdog"),
		OpenAIAPIKey:     getEnv("OPENAI_API_KEY", ""),
		LogLevel:         getEnv("LOG_LEVEL", "info"),
		ScrapeInterval:   2 * time.Hour,
	}

	// Default Greenhouse sources - intern-heavy tech companies
	cfg.GreenhouseSources = []GreenhouseSource{
		{Company: "Stripe", BoardToken: "stripe"},
		{Company: "Airbnb", BoardToken: "airbnb"},
		{Company: "Coinbase", BoardToken: "coinbase"},
		{Company: "DoorDash", BoardToken: "doordash"},
		{Company: "Robinhood", BoardToken: "robinhood"},
		{Company: "Plaid", BoardToken: "plaid"},
		{Company: "Databricks", BoardToken: "databricks"},
		{Company: "Figma", BoardToken: "figma"},
		{Company: "Brex", BoardToken: "brex"},
		{Company: "Scale AI", BoardToken: "scaleai"},
		{Company: "Airtable", BoardToken: "airtable"},
		{Company: "Benchling", BoardToken: "benchling"},
		{Company: "Checkr", BoardToken: "checkr"},
		{Company: "Chime", BoardToken: "chime"},
		{Company: "Confluent", BoardToken: "confluent"},
		{Company: "Coursera", BoardToken: "coursera"},
		{Company: "Discord", BoardToken: "discord"},
		{Company: "Duolingo", BoardToken: "duolingo"},
		{Company: "Faire", BoardToken: "faire"},
		{Company: "Gem", BoardToken: "gem"},
		{Company: "HashiCorp", BoardToken: "hashicorp"},
		{Company: "Instacart", BoardToken: "instacart"},
		{Company: "Lattice", BoardToken: "lattice"},
		{Company: "Lyft", BoardToken: "lyft"},
		{Company: "Marqeta", BoardToken: "marqeta"},
		{Company: "Mixpanel", BoardToken: "mixpanel"},
		{Company: "MongoDB", BoardToken: "mongodb"},
		{Company: "Navan", BoardToken: "tripactions"},
		{Company: "Okta", BoardToken: "okta"},
		{Company: "Pagerduty", BoardToken: "pagerduty"},
		{Company: "Palantir", BoardToken: "palantir"},
		{Company: "Reddit", BoardToken: "reddit"},
		{Company: "Rippling", BoardToken: "rippling"},
		{Company: "Samsara", BoardToken: "samsara"},
		{Company: "Segment", BoardToken: "segment"},
		{Company: "Snowflake", BoardToken: "snowflake"},
		{Company: "Twilio", BoardToken: "twilio"},
		{Company: "Zendesk", BoardToken: "zendesk"},
		{Company: "Zoom", BoardToken: "zoom"},
	}

	// Default Lever sources - intern-heavy tech companies
	cfg.LeverSources = []LeverSource{
		{Company: "Cloudflare", Slug: "cloudflare"},
		{Company: "Notion", Slug: "notion"},
		{Company: "Figma", Slug: "figma"},
		{Company: "Verkada", Slug: "verkada"},
		{Company: "Ramp", Slug: "ramp"},
		{Company: "Anduril", Slug: "anduril"},
		{Company: "Benchling", Slug: "benchling"},
		{Company: "Carta", Slug: "carta"},
		{Company: "Coda", Slug: "coda"},
		{Company: "Cockroach Labs", Slug: "cockroach-labs"},
		{Company: "dbt Labs", Slug: "dbtlabs"},
		{Company: "Figma", Slug: "figma"},
		{Company: "Gem", Slug: "gem"},
		{Company: "Gusto", Slug: "gusto"},
		{Company: "Ironclad", Slug: "ironclad"},
		{Company: "Loom", Slug: "loom"},
		{Company: "Mercury", Slug: "mercury"},
		{Company: "Retool", Slug: "retool"},
		{Company: "Rippling", Slug: "rippling"},
		{Company: "Superhuman", Slug: "superhuman"},
	}

	// Workday sources - disabled by default, only enabled if explicitly configured
	workdayCompany := getEnv("WORKDAY_COMPANY", "")
	workdayURL := getEnv("WORKDAY_URL", "")

	if workdayCompany != "" && workdayURL != "" {
		cfg.WorkdaySources = []WorkdaySource{{
			Company: workdayCompany,
			URL:     workdayURL,
		}}
	} else {
		// No default Workday sources - must be explicitly configured
		cfg.WorkdaySources = []WorkdaySource{}
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
