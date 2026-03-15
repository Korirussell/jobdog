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

type Config struct {
	DatabaseURL      string
	DatabaseUser     string
	DatabasePassword string
	OpenAIAPIKey     string
	LogLevel         string
	ScrapeInterval   time.Duration
	WorkdaySources   []WorkdaySource
}

func Load() (*Config, error) {
	workdayCompany := getEnv("WORKDAY_COMPANY", "")
	workdayURL := getEnv("WORKDAY_URL", "")

	cfg := &Config{
		DatabaseURL:      getEnv("DATABASE_URL", "postgres://jobdog:jobdog@localhost:5432/jobdog?sslmode=disable"),
		DatabaseUser:     getEnv("DATABASE_USERNAME", "jobdog"),
		DatabasePassword: getEnv("DATABASE_PASSWORD", "jobdog"),
		OpenAIAPIKey:     getEnv("OPENAI_API_KEY", ""),
		LogLevel:         getEnv("LOG_LEVEL", "info"),
		ScrapeInterval:   6 * time.Hour,
	}

	if workdayCompany != "" && workdayURL != "" {
		cfg.WorkdaySources = []WorkdaySource{{
			Company: workdayCompany,
			URL:     workdayURL,
		}}
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
