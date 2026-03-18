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
		ScrapeInterval:   6 * time.Hour,
	}

	// Default Greenhouse sources (popular tech companies)
	cfg.GreenhouseSources = []GreenhouseSource{
		{Company: "Stripe", BoardToken: "stripe"},
		{Company: "Airbnb", BoardToken: "airbnb"},
		{Company: "Coinbase", BoardToken: "coinbase"},
		{Company: "DoorDash", BoardToken: "doordash"},
		{Company: "Robinhood", BoardToken: "robinhood"},
		{Company: "Plaid", BoardToken: "plaid"},
		{Company: "Databricks", BoardToken: "databricks"},
		{Company: "Figma", BoardToken: "figma"},
	}

	// Default Lever sources (popular tech companies)
	cfg.LeverSources = []LeverSource{
		{Company: "Cloudflare", Slug: "cloudflare"},
		{Company: "Notion", Slug: "notion"},
		{Company: "Figma", Slug: "figma"},
		{Company: "Verkada", Slug: "verkada"},
		{Company: "Ramp", Slug: "ramp"},
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
