# JobDog Scraper Status

**Last Updated:** 2026-03-14

## Overview
The JobDog scraper worker ingests job postings from various sources and stores them in the PostgreSQL database for matching with user resumes.

---

## Active Scraper Sources

### 1. SimplifyJobs GitHub Repository ✅ WORKING

**Source:** `github-simplify`  
**Target:** [SimplifyJobs/Summer2026-Internships](https://github.com/SimplifyJobs/Summer2026-Internships)  
**Branch:** `master` (with fallback to `dev`)  
**Format:** HTML table in README.md

#### Schedule
- **Initial run:** On scraper startup
- **Recurring:** Every 6 hours (cron: `0 */6 * * *`)

#### Data Extracted
- **Company name** - from table column 1
- **Job title/role** - from table column 2
- **Location** - from table column 3
- **Application URL** - extracted from external links in column 4 (filters out Simplify internal links)
- **Employment type** - hardcoded as `INTERNSHIP`
- **Skills** - extracted via keyword matching from job title/description

#### Current Status
- ✅ **Parsing:** Working correctly with HTML table format
- ✅ **Ingestion:** Successfully inserting jobs into database
- ✅ **Last test:** 2026-03-14 - parsed 1,829 jobs
- ✅ **Requirement profiles:** Skills extraction and JSONB storage working
- ✅ **Regression test:** Passing (`scraper/github_scraper_test.go`)

#### Known Issues
- None currently

#### Implementation Details
- **File:** `services/scraper-worker/scraper/github_scraper.go`
- **Test:** `services/scraper-worker/scraper/github_scraper_test.go`
- **Source ID generation:** SHA256 hash of application URL
- **Deduplication:** By `source_url` (unique constraint)

---

### 2. Workday ATS Scraper ⚠️ CONFIGURED BUT NOT ACTIVELY USED

**Source:** `workday`  
**Target:** Configurable Workday public job API endpoints  
**Format:** JSON API

#### Schedule
- **Initial run:** On scraper startup (if configured)
- **Recurring:** Every 6 hours (cron: `0 */6 * * *`)

#### Data Extracted
- Job title
- Company
- Location
- Job description
- Application URL
- Posted date
- Skills (keyword extraction)

#### Current Status
- ⚠️ **Implementation:** Code exists but requires configuration
- ⚠️ **Configuration:** No Workday sources configured in environment
- ⚠️ **Testing:** Not actively tested in production

#### Configuration Required
Set in `.env`:
```bash
WORKDAY_SOURCES='[{"company":"Example Corp","url":"https://example.wd1.myworkdayjobs.com/api/..."}]'
```

#### Implementation Details
- **File:** `services/scraper-worker/scraper/workday_scraper.go`
- **Test:** None currently

---

## Scraper Architecture

### Database Schema
Jobs are stored in the `jobs` table with:
- Unique constraint on `source_url`
- Unique constraint on `(source, source_job_id)` where `source_job_id` is not null
- Status field: `ACTIVE` or `CLOSED`

Job requirement profiles stored in `job_requirement_profiles` with:
- `required_skills` - JSONB array
- `preferred_skills` - JSONB array
- `extraction_method` - currently `KEYWORD`

### Skill Extraction
- **Method:** Keyword-based matching
- **File:** `services/scraper-worker/scraper/skills.go`
- **Keywords tracked:** Python, Java, JavaScript, Go, C++, React, AWS, Docker, Kubernetes, SQL, etc.
- **Indicators:** "required", "must have", "preferred", "nice to have"

### Stale Job Cleanup
- **Schedule:** Daily at midnight (cron: `0 0 * * *`)
- **Logic:** Jobs not scraped in 7 days are marked as `CLOSED`

---

## Testing Locally

### Run scraper worker standalone
```bash
cd services/scraper-worker

# Set environment variables
export DATABASE_URL='postgres://jobdog:jobdog@localhost:5432/jobdog?sslmode=disable'
export DATABASE_USERNAME='jobdog'
export DATABASE_PASSWORD='jobdog'

# Run tests
go test ./...

# Run scraper (will exit after initial scrape)
timeout 15s go run .
```

### Verify jobs in API
```bash
curl http://localhost:8080/api/v1/jobs
```

---

## Docker Deployment

### After local validation passes
```bash
# Rebuild and restart all services
docker compose down
docker compose up --build

# Or just rebuild scraper
docker compose up --build scraper-worker
```

### View scraper logs
```bash
docker compose logs -f scraper-worker
```

---

## Troubleshooting

### No jobs appearing in API
1. Check scraper logs for parsing errors
2. Verify database connection
3. Check if jobs have `status='ACTIVE'`
4. Verify SimplifyJobs repo format hasn't changed

### Requirement profile insertion errors
- **Null constraint violations:** Fixed - empty skill arrays now serialize as `[]` not `null`
- **Invalid JSON syntax:** Fixed - using `encoding/json` instead of `pq.Array()`

### Duplicate key errors
- **source_job_id conflict:** Fixed - now generates SHA256 hash from source URL
- **source_url conflict:** Expected behavior - updates existing job on conflict

---

## Future Enhancements

### Planned Scraper Sources
- [ ] Greenhouse ATS
- [ ] Lever ATS  
- [ ] LinkedIn Jobs API
- [ ] Indeed API
- [ ] Additional Workday company endpoints

### Planned Improvements
- [ ] OpenAI-based skill extraction (more accurate than keywords)
- [ ] Job description enrichment
- [ ] Salary range extraction
- [ ] Remote/hybrid/onsite classification
- [ ] Application deadline tracking
- [ ] Company metadata enrichment
