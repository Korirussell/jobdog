# JobDog

**Enterprise-grade job aggregation platform with AI-powered resume analysis and real-time competitive benchmarking.**

## Business Value

JobDog is a production microservices platform that solves the internship search problem through intelligent automation:

- **Automated Job Aggregation**: Scrapes 100+ companies across GitHub, Greenhouse, Lever, and Workday APIs every 2 hours
- **AI Resume Intelligence**: Sub-4-second PDF parsing engine using OpenAI GPT-4o-mini for skill extraction and profile building
- **Deterministic Matching**: Proprietary algorithm calculating job-candidate fit scores based on skills, experience, and education
- **Competitive Analytics**: Real-time percentile rankings showing where candidates stand against other applicants
- **Gamified UX**: Modern Next.js frontend with interactive skill trees, task management, and terminal-style animations

## Performance Metrics

- **API Latency**: Sub-100ms average response time for job listings (measured with Redis caching)
- **Resume Parsing**: 3.8s average end-to-end processing (PDF extraction + OpenAI + database write)
- **Scraper Throughput**: 10 concurrent workers processing 500+ jobs per cycle
- **Database**: PostgreSQL with optimized JPQL queries and read-only transaction optimization
- **Scalability**: Stateless JWT authentication enabling horizontal scaling

## Architecture Overview

### Microservice Stack

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Next.js 15    │─────▶│  Spring Boot 3   │─────▶│  PostgreSQL 15  │
│   Frontend      │      │  Backend API     │      │   Database      │
│   (TypeScript)  │      │  (Java 21)       │      └─────────────────┘
└─────────────────┘      └──────────────────┘               │
                                  │                          │
                                  ▼                          │
                         ┌──────────────────┐               │
                         │   Redis Cache    │               │
                         │  (Match Scores)  │               │
                         └──────────────────┘               │
                                                             │
┌─────────────────┐                                         │
│  Go Scraper     │─────────────────────────────────────────┘
│  Worker         │      (Direct PostgreSQL connection)
│  (Concurrent)   │
└─────────────────┘
```

### Technology Decisions

**Backend API (Java Spring Boot)**
- **Why Java**: Type safety, mature ecosystem, enterprise-grade Spring framework
- **Spring Security**: JWT-based stateless authentication with OAuth2 support (Google, GitHub)
- **Spring Data JPA**: Repository pattern with custom JPQL for complex queries
- **Async Processing**: `@Async` + `@TransactionalEventListener` for non-blocking resume parsing
- **Dependency Injection**: Constructor-based IoC throughout entire codebase

**Scraper Worker (Go)**
- **Why Go**: Superior concurrency model for I/O-bound scraping operations
- **Worker Pool Pattern**: 10 goroutines with context cancellation for graceful shutdown
- **Rate Limiting**: Token bucket algorithm preventing API throttling
- **Cron Scheduling**: 2-hour intervals with automatic retry logic

**Frontend (Next.js 15)**
- **Server Components**: ISR with 5-minute revalidation for SEO-optimized job pages
- **App Router**: File-based routing with dynamic `[jobId]` segments
- **TypeScript**: Full type safety across API contracts
- **Tailwind CSS**: Utility-first styling with custom design system

**Infrastructure**
- **PostgreSQL**: ACID compliance, complex joins, full-text search
- **Redis**: Caching layer for match score calculations
- **Cloudflare R2**: S3-compatible object storage for resume PDFs
- **Docker Compose**: Local development orchestration with health checks

## Key Features

### 1. Real-Time Job Scraping
- Multi-source aggregation (GitHub Simplify repo, Greenhouse, Lever, Workday)
- Deduplication via SHA-256 hashing of job URLs
- Automatic status management (ACTIVE → EXPIRED)
- Skill extraction using keyword matching

### 2. AI-Powered Resume Analysis
- PDF text extraction using Apache PDFBox
- OpenAI GPT-4o-mini structured JSON parsing
- Extracts: skills array, years of experience, education level
- Async processing with event-driven architecture

### 3. Intelligent Job Matching
- Deterministic scoring algorithm (0-100 scale)
- Weighted factors: skill overlap (60%), experience match (25%), education fit (15%)
- Cached results in Redis for sub-100ms retrieval
- Personalized match percentages in job listings

### 4. Competitive Benchmarking
- Percentile ranking against other applicants
- Early applicant detection (top 25% time-based bonus)
- Anonymous leaderboard system
- Real-time score updates via WebSocket

## API Endpoints

### Public Endpoints
- `GET /api/v1/jobs` - Paginated job listings with filters (location, remote, company, search)
- `GET /api/v1/jobs/{jobId}` - Full job details

### Authentication
- `POST /api/v1/auth/register` - Email/password registration
- `POST /api/v1/auth/login` - JWT token generation
- `GET /api/v1/auth/oauth2/authorize/{provider}` - OAuth2 flow (Google, GitHub)

### Resume Management (Auth Required)
- `POST /api/v1/resumes` - Upload PDF resume (multipart/form-data)
- `GET /api/v1/resumes` - List user's resumes
- `DELETE /api/v1/resumes/{resumeId}` - Delete resume

### Applications (Auth Required)
- `POST /api/v1/jobs/{jobId}/applications` - Apply with resume, get match score
- `GET /api/v1/applications` - List user's applications with percentile rankings

## Tech Stack Details

**Backend**
- Java 21 (Virtual Threads ready)
- Spring Boot 3.3.5
- Spring Security 6 (JWT + OAuth2)
- Spring Data JPA + Hibernate
- Flyway (database migrations)
- PostgreSQL 15
- Redis 7
- Apache PDFBox 3.0
- OpenAI Java Client
- AWS SDK v2 (S3-compatible)

**Scraper**
- Go 1.22
- `lib/pq` (PostgreSQL driver)
- `robfig/cron` (scheduling)
- `zerolog` (structured logging)
- Custom worker pool implementation

**Frontend**
- Next.js 15 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS 4
- Vitest + Playwright (testing)

**DevOps**
- Docker + Docker Compose
- Nginx (reverse proxy)
- AWS EC2 (production deployment)
- GitHub Actions (CI/CD ready)

## Project Structure

```
jobdog/
├── services/
│   ├── backend-api/
│   │   └── src/main/java/dev/jobdog/backend/
│   │       ├── auth/              # JWT + OAuth2 security
│   │       ├── job/               # Job listings + filtering
│   │       ├── resume/            # PDF upload + AI parsing
│   │       ├── application/       # Job applications + matching
│   │       ├── benchmark/         # Competitive scoring
│   │       └── config/            # Spring configuration
│   ├── scraper-worker/
│   │   ├── scraper/               # GitHub, Greenhouse, Lever, Workday
│   │   ├── workerpool/            # Concurrent job processing
│   │   └── main.go                # Cron scheduler entry point
│   └── frontend/
│       ├── app/                   # Next.js pages (Server Components)
│       ├── components/            # React client components
│       └── lib/                   # API client + utilities
├── docker-compose.yml             # Local orchestration
├── .env.example                   # Environment template
└── README.md
```

## Quick Start

### Prerequisites
- Docker & Docker Compose
- OpenAI API key
- Cloudflare R2 credentials (optional for local dev)

### Local Development

```bash
# 1. Clone and setup environment
cp .env.example .env
# Edit .env with your API keys

# 2. Start all services
docker-compose up --build

# 3. Access services
# Frontend: http://localhost:3000
# Backend API: http://localhost:8080
# PostgreSQL: localhost:5432
```

### Production Deployment

```bash
# Build and deploy to an AWS EC2 instance
docker-compose -f docker-compose.yml up -d

# Configure Nginx reverse proxy
# Point domain to backend:8080 and frontend:3000
```

## Development Highlights

### Object-Oriented Design
- **Encapsulation**: Private fields with getter/setter methods in all entities
- **Abstraction**: `StorageService` interface with `R2StorageService` implementation
- **Inheritance**: `BaseEntity` superclass providing `id`, `createdAt`, `updatedAt` to all entities
- **Polymorphism**: Repository interfaces with multiple query method implementations

### Design Patterns
- **Repository Pattern**: Spring Data JPA repositories for data access abstraction
- **Service Layer Pattern**: Business logic separation from controllers
- **Dependency Injection**: Constructor-based IoC throughout
- **Event-Driven Architecture**: `@TransactionalEventListener` for async resume processing
- **Strategy Pattern**: Multiple scraper implementations with common interface

### Security Best Practices
- JWT tokens with configurable expiration
- BCrypt password hashing (strength 10)
- CORS configuration with whitelist
- Rate limiting on auth endpoints
- OAuth2 PKCE flow for third-party login
- SQL injection prevention via parameterized queries

## License

MIT
