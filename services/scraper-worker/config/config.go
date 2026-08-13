package config

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"
)

// WorkdaySource addresses one Workday tenant's CxS API. The datacenter segment
// (wd1, wd3, wd5, wd12, …) is assigned per customer and cannot be derived from
// the tenant name, so all three parts must be configured.
//
// For a careers URL like https://amat.wd1.myworkdayjobs.com/External/job/...
// the tenant is "amat", the datacenter "wd1", and the site "External".
type WorkdaySource struct {
	Company    string `json:"company"`
	Tenant     string `json:"tenant"`
	Datacenter string `json:"datacenter"`
	Site       string `json:"site"`
}

type GreenhouseSource struct {
	Company    string `json:"company"`
	BoardToken string `json:"boardToken"`
}

type LeverSource struct {
	Company string `json:"company"`
	Slug    string `json:"slug"`
}

// AshbySource addresses one Ashby job board. Ashby exposes a public posting API
// keyed on the organization slug from the board URL.
type AshbySource struct {
	Company string `json:"company"`
	Token   string `json:"token"`
}

// AggregatorSource is a community-maintained GitHub repo whose README lists open
// roles. These are hiring-cycle specific — "Summer2027-Internships" is a different
// repo from "Summer2026-Internships", not a branch of it — so they must be updated
// each cycle, which is why they live in config rather than in code.
type AggregatorSource struct {
	Repo string `json:"repo"`
	// EmploymentType applies to every row in the repo, since each aggregator
	// covers one kind of role.
	EmploymentType string `json:"employmentType"`
}

// sourcesFile mirrors the on-disk JSON shape for externalized company sources.
type sourcesFile struct {
	Greenhouse  []GreenhouseSource `json:"greenhouse"`
	Lever       []LeverSource      `json:"lever"`
	Workday     []WorkdaySource    `json:"workday"`
	Ashby       []AshbySource      `json:"ashby"`
	Aggregators []AggregatorSource `json:"aggregators"`
}

// defaultSourcesConfigPath is used when SOURCES_CONFIG_PATH is not set.
const defaultSourcesConfigPath = "config/sources.json"

type Config struct {
	DatabaseURL       string
	DatabaseUser      string
	DatabasePassword  string
	OpenAIAPIKey      string
	GradModel         string
	LogLevel          string
	ScrapeInterval    time.Duration
	WorkdaySources    []WorkdaySource
	GreenhouseSources []GreenhouseSource
	LeverSources      []LeverSource
	AshbySources      []AshbySource
	Aggregators       []AggregatorSource
}

func Load() (*Config, error) {
	cfg := &Config{
		DatabaseURL:      getEnv("DATABASE_URL", "postgres://jobdog:jobdog@localhost:5432/jobdog?sslmode=disable"),
		DatabaseUser:     getEnv("DATABASE_USERNAME", "jobdog"),
		DatabasePassword: getEnv("DATABASE_PASSWORD", "jobdog"),
		OpenAIAPIKey:     getEnv("OPENAI_API_KEY", ""),
		// Configurable so the cost/accuracy tradeoff can be tuned without a deploy.
		GradModel:      getEnv("GRAD_CLASSIFIER_MODEL", "gpt-4o-mini"),
		LogLevel:       getEnv("LOG_LEVEL", "info"),
		ScrapeInterval: 2 * time.Hour,
	}

	sources := loadSources()
	cfg.GreenhouseSources = sources.Greenhouse
	cfg.LeverSources = sources.Lever
	cfg.WorkdaySources = sources.Workday
	cfg.AshbySources = sources.Ashby
	cfg.Aggregators = sources.Aggregators

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	return cfg, nil
}

// loadSources attempts to load Greenhouse/Lever/Workday sources from an external
// JSON config file (path taken from SOURCES_CONFIG_PATH, defaulting to
// "config/sources.json"). If the file is missing, unreadable, or fails to
// parse, it logs a warning and falls back to the embedded default lists so
// the scraper always has a usable source list.
func loadSources() sourcesFile {
	path := getEnv("SOURCES_CONFIG_PATH", defaultSourcesConfigPath)

	data, err := os.ReadFile(path)
	if err != nil {
		log.Printf("warning: sources config %q not found or unreadable (%v); falling back to embedded defaults", path, err)
		return defaultSources()
	}

	var sf sourcesFile
	if err := json.Unmarshal(data, &sf); err != nil {
		log.Printf("warning: sources config %q could not be parsed (%v); falling back to embedded defaults", path, err)
		return defaultSources()
	}

	if len(sf.Greenhouse) == 0 && len(sf.Lever) == 0 && len(sf.Workday) == 0 {
		log.Printf("warning: sources config %q contained no entries; falling back to embedded defaults", path)
		return defaultSources()
	}

	sf.Workday = validWorkdaySources(sf.Workday)
	if len(sf.Aggregators) == 0 {
		sf.Aggregators = defaultAggregatorSources
	}
	return sf
}

// defaultSources is the embedded fallback used when sources.json is missing or
// unusable, so the scraper always has a working source list.
func defaultSources() sourcesFile {
	return sourcesFile{
		Greenhouse:  defaultGreenhouseSources,
		Lever:       defaultLeverSources,
		Workday:     defaultWorkdaySources,
		Aggregators: defaultAggregatorSources,
	}
}

// defaultAggregatorSources tracks the current hiring cycle. Update these when the
// cycle rolls over — a stale repo keeps returning 200 with last year's roles, so
// nothing here fails loudly.
var defaultAggregatorSources = []AggregatorSource{
	{Repo: "SimplifyJobs/Summer2027-Internships", EmploymentType: "INTERNSHIP"},
	{Repo: "SimplifyJobs/New-Grad-Positions", EmploymentType: "FULL_TIME"},
}

// validWorkdaySources drops entries missing any part of the tenant address. A
// half-configured tenant would otherwise build a URL like
// "https://acme..myworkdayjobs.com/..." and fail on every request.
func validWorkdaySources(sources []WorkdaySource) []WorkdaySource {
	valid := make([]WorkdaySource, 0, len(sources))
	for _, s := range sources {
		if s.Company == "" || s.Tenant == "" || s.Datacenter == "" || s.Site == "" {
			log.Printf("warning: skipping incomplete Workday source %+v (company, tenant, datacenter and site are all required)", s)
			continue
		}
		valid = append(valid, s)
	}
	return valid
}

// defaultWorkdaySources is the embedded fallback list used when the external
// sources.json config is missing or invalid. Every entry here was verified
// against the live CxS API — a wrong site name returns either 422 or, worse,
// HTTP 200 with zero postings, so entries should not be added without checking.
var defaultWorkdaySources = []WorkdaySource{
	{Company: "NVIDIA", Tenant: "nvidia", Datacenter: "wd5", Site: "NVIDIAExternalCareerSite"},
	{Company: "Salesforce", Tenant: "salesforce", Datacenter: "wd12", Site: "External_Career_Site"},
	{Company: "Micron", Tenant: "micron", Datacenter: "wd1", Site: "External"},
	{Company: "HPE", Tenant: "hpe", Datacenter: "wd5", Site: "Jobsathpe"},
	{Company: "Adobe", Tenant: "adobe", Datacenter: "wd5", Site: "external_experienced"},
	{Company: "Cadence", Tenant: "cadence", Datacenter: "wd1", Site: "External_Careers"},
	{Company: "Applied Materials", Tenant: "amat", Datacenter: "wd1", Site: "External"},
}

// defaultGreenhouseSources is the embedded fallback list used when the
// external sources.json config is missing or invalid.
var defaultGreenhouseSources = []GreenhouseSource{
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

// defaultLeverSources is the embedded fallback list used when the external
// sources.json config is missing or invalid.
// Only companies with working Lever boards are included.
// Removed companies returning 404: Benchling, Carta, Coda, Cockroach Labs, dbt Labs, Gem, Gusto,
// Ironclad, Loom, Mercury, Retool, Rippling, Superhuman, Airtable, Amplitude, Brex, Canva, Faire
var defaultLeverSources = []LeverSource{
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

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
