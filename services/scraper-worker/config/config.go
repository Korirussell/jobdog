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

type Config struct {
	DatabaseURL       string
	DatabaseUser      string
	DatabasePassword  string
	OpenAIAPIKey      string
	LogLevel          string
	ScrapeInterval    time.Duration
	WorkdaySources    []WorkdaySource
	GreenhouseSources []GreenhouseSource
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

	// Default Workday sources (can be overridden by env)
	workdayCompany := getEnv("WORKDAY_COMPANY", "")
	workdayURL := getEnv("WORKDAY_URL", "")

	if workdayCompany != "" && workdayURL != "" {
		cfg.WorkdaySources = []WorkdaySource{{
			Company: workdayCompany,
			URL:     workdayURL,
		}}
	} else {
		// Default Workday sources
		cfg.WorkdaySources = []WorkdaySource{
			// Add default Workday companies here if needed
		}
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
