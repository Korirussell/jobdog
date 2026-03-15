# JobDog Architecture Context

JobDog is a backend-first, polyglot microservices platform for scraping internship and early-career software jobs, structuring resume and job data, computing deterministic match scores, and benchmarking applicants against one another.

## Phase 1 Scope

Phase 1 establishes the project contract and the backend platform foundation:
- Spring Boot API service for auth, resume metadata, job retrieval, and scoring orchestration
- Go scraper worker for concurrent job ingestion and normalization
- PostgreSQL as the system-of-record database
- Cloudflare R2 for resume object storage
- Deterministic, zero-prompt-cost matching at request time

## Service Topology

### Frontend
- Runtime: later phase
- Responsibility: authentication flow, resume upload UX, job feed, match display, applicant dashboard
- Talks to: `backend-api`

### Backend API
- Runtime: Java 21, Spring Boot 3.x, Maven
- Responsibility:
  - JWT authentication and authorization
  - Resume upload orchestration and metadata persistence
  - Resume parsing pipeline kickoff
  - Job retrieval APIs
  - Match score computation
  - Percentile benchmarking and early-applicant state handling
- Talks to:
  - PostgreSQL
  - Cloudflare R2
  - OpenAI API for ingestion-time parsing only

### Scraper Worker
- Runtime: Go
- Responsibility:
  - Concurrent scraping of job boards and company sites
  - Normalization and deduplication
  - Skill extraction or enrichment at ingestion time
  - Insert/update job records in PostgreSQL
- Talks to:
  - PostgreSQL
  - Optional LLM enrichment during ingestion only

### PostgreSQL
- Responsibility:
  - System-of-record for users, resumes, jobs, applications, parsed profiles, and score artifacts
  - Deterministic scoring inputs and benchmark queries

### Cloudflare R2
- Responsibility:
  - Resume object storage
  - No local file persistence in API containers

## Core Architectural Rules

- AI is used during ingestion, not during per-click matching
- Match-time requests must be satisfied using structured data and deterministic logic
- Resume binaries live in R2; metadata and parsed artifacts live in PostgreSQL
- Scraper ingestion must be idempotent and deduplicated
- Percentile ranking is returned only after there are at least 5 completed scored applications for a job
- If fewer than 5 completed scored applications exist, the response must return the early-applicant state

## API Contracts

## Frontend -> Backend API

### `POST /api/v1/auth/register`
Request:
```json
{
  "email": "candidate@example.com",
  "password": "strong-password",
  "displayName": "Kori Russell"
}
```

Response:
```json
{
  "userId": "7d5df99b-69bb-4f56-a356-6d9198d5b31b",
  "email": "candidate@example.com",
  "displayName": "Kori Russell",
  "token": "jwt-token"
}
```

### `POST /api/v1/auth/login`
Request:
```json
{
  "email": "candidate@example.com",
  "password": "strong-password"
}
```

Response:
```json
{
  "token": "jwt-token",
  "expiresAt": "2026-03-12T23:59:59Z"
}
```

### `POST /api/v1/resumes`
Content type: `multipart/form-data`

Form fields:
- `file`: PDF resume
- `label`: optional display label

Response:
```json
{
  "resumeId": "0d66d154-cae2-420c-85b1-6ab9878ab1a4",
  "status": "UPLOADED",
  "storageKey": "resumes/user-123/current.pdf",
  "uploadedAt": "2026-03-12T23:59:59Z"
}
```

### `GET /api/v1/jobs`
Response:
```json
{
  "items": [
    {
      "jobId": "8b02e4dd-4fe6-4d91-88df-68c9d58867cf",
      "title": "Software Engineer Intern",
      "company": "Example Corp",
      "location": "Remote",
      "employmentType": "INTERNSHIP",
      "postedAt": "2026-03-12T20:00:00Z",
      "applyUrl": "https://example.com/jobs/123"
    }
  ],
  "page": 0,
  "size": 20,
  "total": 1
}
```

### `POST /api/v1/jobs/{jobId}/applications`
Request:
```json
{
  "resumeId": "0d66d154-cae2-420c-85b1-6ab9878ab1a4"
}
```

Response when applicant pool is still forming:
```json
{
  "applicationId": "577f1fc4-6913-40bf-9f99-009321017312",
  "matchScore": 82,
  "matchBreakdown": {
    "skillOverlap": 0.75,
    "experienceAlignment": 1.0,
    "educationAlignment": 0.5
  },
  "benchmarkState": "EARLY_APPLICANT",
  "message": "Congrats, you are one of the first 5 applicants!"
}
```

Response when benchmark data exists:
```json
{
  "applicationId": "577f1fc4-6913-40bf-9f99-009321017312",
  "matchScore": 82,
  "matchBreakdown": {
    "skillOverlap": 0.75,
    "experienceAlignment": 1.0,
    "educationAlignment": 0.5
  },
  "benchmarkState": "PERCENTILE_READY",
  "percentile": 80,
  "applicantCount": 24
}
```

## Scraper Worker -> Database Contract

Scraper writes normalized job records with these minimum fields:
```json
{
  "source": "greenhouse",
  "sourceJobId": "12345",
  "sourceUrl": "https://boards.greenhouse.io/example/jobs/12345",
  "title": "Software Engineer Intern",
  "company": "Example Corp",
  "location": "Remote",
  "descriptionText": "Full job description text",
  "descriptionHash": "sha256-hash",
  "employmentType": "INTERNSHIP",
  "status": "ACTIVE",
  "requiredSkills": ["java", "spring", "postgresql"],
  "preferredSkills": ["aws", "docker"],
  "minimumYearsExperience": 0,
  "educationLevel": "BACHELORS",
  "postedAt": "2026-03-12T20:00:00Z",
  "scrapedAt": "2026-03-12T20:00:10Z"
}
```

Uniqueness strategy:
- Unique on `(source, source_job_id)` when available
- Secondary dedupe key on normalized `source_url`
- Tertiary dedupe signal on `description_hash`

## Resume Parsing Contract

Resume parsing is ingestion-time only.

Parsed resume profile shape:
```json
{
  "skills": ["java", "python", "postgresql", "go"],
  "yearsExperience": 2,
  "educationLevel": "BACHELORS",
  "rawTextChecksum": "sha256-hash"
}
```

## Matching Engine Contract

Phase 1 uses deterministic structured-data scoring.

### Inputs
- Parsed candidate skills
- Parsed candidate years of experience
- Parsed candidate education level
- Job required skills
- Job preferred skills
- Job minimum years of experience
- Job education level if present

### Score Model
Suggested Phase 1 weights:
- Required skill coverage: 60
- Preferred skill coverage: 15
- Experience alignment: 15
- Education alignment: 10

Output fields:
```json
{
  "matchScore": 82,
  "matchBreakdown": {
    "requiredSkillCoverage": 0.75,
    "preferredSkillCoverage": 0.5,
    "experienceAlignment": 1.0,
    "educationAlignment": 0.5
  }
}
```

### Benchmarking Logic
- Match score is computed first
- Completed scored applications for the same job are counted
- If completed scored application count is `< 5`, return `EARLY_APPLICANT`
- If completed scored application count is `>= 5`, compute percentile based on score ordering
- Percentile is based only on completed scored applications for that job

## PostgreSQL Schema Draft

### `users`
- `id UUID PRIMARY KEY`
- `email VARCHAR(320) NOT NULL UNIQUE`
- `password_hash VARCHAR(255) NOT NULL`
- `display_name VARCHAR(120) NOT NULL`
- `role VARCHAR(32) NOT NULL DEFAULT 'USER'`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

Indexes:
- unique index on `email`

### `resumes`
- `id UUID PRIMARY KEY`
- `user_id UUID NOT NULL REFERENCES users(id)`
- `label VARCHAR(120)`
- `storage_key VARCHAR(512) NOT NULL UNIQUE`
- `original_filename VARCHAR(255) NOT NULL`
- `content_type VARCHAR(100) NOT NULL`
- `file_size_bytes BIGINT NOT NULL`
- `checksum_sha256 VARCHAR(64) NOT NULL`
- `status VARCHAR(32) NOT NULL`
- `uploaded_at TIMESTAMPTZ NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

Indexes:
- index on `user_id`
- unique index on `storage_key`
- index on `(user_id, uploaded_at DESC)`

### `resume_profiles`
- `id UUID PRIMARY KEY`
- `resume_id UUID NOT NULL UNIQUE REFERENCES resumes(id)`
- `skills JSONB NOT NULL`
- `years_experience INTEGER`
- `education_level VARCHAR(64)`
- `raw_text_checksum VARCHAR(64)`
- `parser_provider VARCHAR(64)`
- `parser_model VARCHAR(64)`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

Indexes:
- unique index on `resume_id`
- gin index on `skills`

### `jobs`
- `id UUID PRIMARY KEY`
- `source VARCHAR(64) NOT NULL`
- `source_job_id VARCHAR(255)`
- `source_url TEXT NOT NULL`
- `title VARCHAR(255) NOT NULL`
- `company VARCHAR(255) NOT NULL`
- `location VARCHAR(255)`
- `employment_type VARCHAR(64)`
- `description_text TEXT NOT NULL`
- `description_hash VARCHAR(64) NOT NULL`
- `status VARCHAR(32) NOT NULL`
- `minimum_years_experience INTEGER`
- `education_level VARCHAR(64)`
- `posted_at TIMESTAMPTZ`
- `scraped_at TIMESTAMPTZ NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

Indexes:
- unique index on `(source, source_job_id)` where `source_job_id` is not null
- unique index on `source_url`
- index on `description_hash`
- index on `(status, posted_at DESC)`

### `job_requirement_profiles`
- `id UUID PRIMARY KEY`
- `job_id UUID NOT NULL UNIQUE REFERENCES jobs(id)`
- `required_skills JSONB NOT NULL`
- `preferred_skills JSONB NOT NULL`
- `extraction_method VARCHAR(64) NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

Indexes:
- unique index on `job_id`
- gin index on `required_skills`
- gin index on `preferred_skills`

### `applications`
- `id UUID PRIMARY KEY`
- `user_id UUID NOT NULL REFERENCES users(id)`
- `job_id UUID NOT NULL REFERENCES jobs(id)`
- `resume_id UUID NOT NULL REFERENCES resumes(id)`
- `status VARCHAR(32) NOT NULL`
- `applied_at TIMESTAMPTZ NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

Indexes:
- unique index on `(user_id, job_id)`
- index on `(job_id, applied_at DESC)`
- index on `(user_id, applied_at DESC)`

### `application_scores`
- `id UUID PRIMARY KEY`
- `application_id UUID NOT NULL UNIQUE REFERENCES applications(id)`
- `match_score INTEGER NOT NULL`
- `match_breakdown JSONB NOT NULL`
- `benchmark_state VARCHAR(32) NOT NULL`
- `percentile INTEGER`
- `applicant_count INTEGER NOT NULL`
- `scored_at TIMESTAMPTZ NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

Indexes:
- unique index on `application_id`
- index on `(benchmark_state, scored_at DESC)`

## Environment Contract

### Backend API
- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `APP_JWT_SECRET`
- `APP_JWT_EXPIRATION`
- `APP_R2_ENDPOINT`
- `APP_R2_BUCKET`
- `APP_R2_ACCESS_KEY`
- `APP_R2_SECRET_KEY`
- `APP_R2_REGION`
- `APP_OPENAI_API_KEY`

### Scraper Worker
- `DATABASE_URL`
- `DATABASE_USERNAME`
- `DATABASE_PASSWORD`
- `OPENAI_API_KEY`

## Delivery Notes

Phase 1 implementation should optimize for:
- clear service boundaries
- deterministic scoring behavior
- minimal local orchestration friction
- future compatibility with async enrichment and `pgvector`

Phase 2 may introduce:
- `pgvector`
- semantic ranking
- score caching or precomputation
- event-driven workflows for ingestion and benchmarking
