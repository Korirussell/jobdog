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
		// Tier 1 - FAANG adjacent
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
		// Tier 2 - High-value intern programs
		{Company: "Amplitude", BoardToken: "amplitude"},
		{Company: "Asana", BoardToken: "asana"},
		{Company: "Canva", BoardToken: "canva"},
		{Company: "Carta", BoardToken: "carta"},
		{Company: "Coda", BoardToken: "coda"},
		{Company: "Cockroach Labs", BoardToken: "cockroachdb"},
		{Company: "Datadog", BoardToken: "datadog"},
		{Company: "dbt Labs", BoardToken: "dbtlabs"},
		{Company: "Dropbox", BoardToken: "dropbox"},
		{Company: "Figma", BoardToken: "figma"},
		{Company: "Grammarly", BoardToken: "grammarly"},
		{Company: "Gusto", BoardToken: "gusto"},
		{Company: "Intercom", BoardToken: "intercom"},
		{Company: "Linear", BoardToken: "linear"},
		{Company: "Loom", BoardToken: "loom"},
		{Company: "Mercury", BoardToken: "mercury"},
		{Company: "Notion", BoardToken: "notion"},
		{Company: "OpenAI", BoardToken: "openai"},
		{Company: "Retool", BoardToken: "retool"},
		{Company: "Superhuman", BoardToken: "superhuman"},
		{Company: "Vercel", BoardToken: "vercel"},
		{Company: "Webflow", BoardToken: "webflow"},
		{Company: "Zapier", BoardToken: "zapier"},
		// Fintech & crypto
		{Company: "Affirm", BoardToken: "affirm"},
		{Company: "Block", BoardToken: "block"},
		{Company: "Klarna", BoardToken: "klarna"},
		{Company: "Kraken", BoardToken: "kraken"},
		{Company: "Nerdwallet", BoardToken: "nerdwallet"},
		{Company: "SoFi", BoardToken: "sofi"},
		// Defense & hardware
		{Company: "SpaceX", BoardToken: "spacex"},
		{Company: "Relativity Space", BoardToken: "relativityspace"},
		{Company: "Joby Aviation", BoardToken: "jobyaviation"},
		// Enterprise
		{Company: "Salesforce", BoardToken: "salesforce"},
		{Company: "Workday", BoardToken: "workday"},
		{Company: "ServiceNow", BoardToken: "servicenow"},
		{Company: "Splunk", BoardToken: "splunk"},
		{Company: "Elastic", BoardToken: "elastic"},
		{Company: "New Relic", BoardToken: "newrelic"},
	}

	// Default Lever sources - only companies with working Lever boards
	// Removed companies returning 404: Benchling, Carta, Coda, Cockroach Labs, dbt Labs, Gem, Gusto,
	// Ironclad, Loom, Mercury, Retool, Rippling, Superhuman, Airtable, Amplitude, Brex, Canva, Faire
	cfg.LeverSources = []LeverSource{
		{Company: "Cloudflare", Slug: "cloudflare"},
		{Company: "Notion", Slug: "notion"},
		{Company: "Figma", Slug: "figma"},
		{Company: "Verkada", Slug: "verkada"},
		{Company: "Ramp", Slug: "ramp"},
		{Company: "Anduril", Slug: "anduril"},
		{Company: "Grammarly", Slug: "grammarly"},
		{Company: "Intercom", Slug: "intercom"},
		{Company: "Lattice", Slug: "lattice"},
		{Company: "Linear", Slug: "linear"},
		{Company: "Plaid", Slug: "plaid"},
		{Company: "Scale AI", Slug: "scaleai"},
		{Company: "Vercel", Slug: "vercel"},
		{Company: "Webflow", Slug: "webflow"},
		{Company: "Zapier", Slug: "zapier"},
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
