# JobDog.dev

**A production-ready, FAANG-grade internship aggregator with AI-powered resume matching and competitive benchmarking.**

## What Is This?

JobDog is a full-stack microservices platform that:
- **Scrapes** fresh internship jobs from GitHub repos, Workday, Greenhouse, and other sources
- **Parses** your resume using AI to extract skills, experience, and education
- **Matches** you to jobs using deterministic scoring algorithms
- **Benchmarks** you against other applicants with percentile rankings

## Architecture

- **Backend API** (Java 21 + Spring Boot 3): Auth, resume upload, job listings, match scoring
- **Scraper Worker** (Go): Concurrent job scraping from multiple sources
- **Database** (PostgreSQL): System of record for all data
- **Storage** (Cloudflare R2): Resume PDF storage
- **AI** (OpenAI gpt-4o-mini): Resume parsing

## Quick Start

See [SETUP.md](SETUP.md) for detailed setup instructions.

### Prerequisites

- Docker & Docker Compose ✓ (already installed)
- OpenAI API key
- Cloudflare R2 credentials

### Run Locally

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Edit .env with your credentials
# (OpenAI API key, R2 credentials, JWT secret)

# 3. Start everything
docker-compose up --build
```

Backend runs on http://localhost:8080

## Features

### ✅ Implemented

- **Real scraper** pulling jobs from GitHub repos (Simplify internships) and Workday
- **Resume parsing** with PDF extraction + OpenAI integration
- **Match scoring** using deterministic skill/experience/education algorithms
- **Benchmarking** with early-applicant detection and percentile ranking
- **JWT authentication** with stateless security
- **Production-ready** CORS, error handling, structured logging

### 🚧 Next Steps

- Integration tests with Testcontainers
- Rate limiting on auth/upload endpoints
- Frontend (React/Next.js)
- Additional scraper sources (Greenhouse, Lever, LinkedIn)

## API Endpoints

- `POST /api/v1/auth/register` - Create account
- `POST /api/v1/auth/login` - Get JWT token
- `POST /api/v1/resumes` - Upload PDF resume (auth required)
- `GET /api/v1/jobs` - List active jobs
- `POST /api/v1/jobs/{jobId}/applications` - Apply and get match score (auth required)

## Tech Stack

**Backend:**
- Java 21, Spring Boot 3.3.5
- Spring Security (JWT), Spring Data JPA
- Flyway migrations, PostgreSQL
- Apache PDFBox, OpenAI Java client
- AWS SDK (S3-compatible R2)

**Scraper:**
- Go 1.22
- PostgreSQL driver, GitHub API client
- Cron scheduler, structured logging (zerolog)

**Infrastructure:**
- Docker Compose for local orchestration
- Cloudflare R2 for object storage
- OpenAI API for AI parsing

## Project Structure

```
jobdog/
├── services/
│   ├── backend-api/        # Spring Boot API
│   ├── scraper-worker/     # Go scraper
│   └── frontend/           # (placeholder for React app)
├── docs/
│   └── architecture_context.md
├── docker-compose.yml
├── .env.example
├── SETUP.md
└── README.md
```

## Documentation

- **[SETUP.md](SETUP.md)** - Complete setup guide with troubleshooting
- **[docs/architecture_context.md](docs/architecture_context.md)** - System architecture and API contracts

## License

MIT
