# JobDog Deployment Guide

**Last Updated:** 2026-03-14

## ✅ Current Status

All systems operational:
- ✅ Backend API running on port 8080
- ✅ PostgreSQL database healthy
- ✅ Scraper successfully ingesting jobs from SimplifyJobs
- ✅ Jobs API returning data (1,829 jobs scraped, 20 most recent shown)
- ✅ No database constraint errors
- ✅ Requirement profiles storing correctly

---

## Local Testing (REQUIRED before Docker deployment)

**Always test locally first to avoid wasting tokens on broken Docker builds.**

### 1. Test Scraper Locally

```bash
cd services/scraper-worker

# Run tests
go test ./...

# Start only Postgres
sudo docker compose up -d postgres

# Wait for Postgres to be ready
sleep 3

# Run scraper standalone (will exit after initial scrape)
env DATABASE_URL='postgres://jobdog:jobdog@localhost:5432/jobdog?sslmode=disable' \
    DATABASE_USERNAME='jobdog' \
    DATABASE_PASSWORD='jobdog' \
    timeout 15s go run .
```

**Expected output:**
```
INF Starting JobDog scraper worker
INF Database connected
INF Starting Simplify repo scrape
INF Parsed jobs from Simplify repo count=1829
INF Completed Simplify repo scrape
```

### 2. Test Backend API Locally

```bash
# Start backend (Postgres should already be running)
sudo docker compose up -d backend-api

# Wait for backend to start
sleep 10

# Test health endpoint
curl http://localhost:8080/api/v1/system/health

# Test jobs endpoint
curl http://localhost:8080/api/v1/jobs
```

**Expected output:**
- Health: `{"status":"UP"}`
- Jobs: JSON array with job listings

---

## Docker Deployment

### Full Stack Rebuild

**Only run this after local testing passes:**

```bash
# Stop all services
sudo docker compose down

# Rebuild and start all services
sudo docker compose up --build -d

# View logs
sudo docker compose logs -f
```

### Individual Service Rebuild

```bash
# Rebuild just the scraper
sudo docker compose up --build -d scraper-worker

# Rebuild just the backend
sudo docker compose up --build -d backend-api
```

### View Logs

```bash
# All services
sudo docker compose logs -f

# Specific service
sudo docker compose logs -f scraper-worker
sudo docker compose logs -f backend-api
sudo docker compose logs -f postgres
```

### Check Service Status

```bash
sudo docker compose ps
```

---

## Environment Variables

Required in `.env` file:

```bash
# Database
POSTGRES_USER=jobdog
POSTGRES_PASSWORD=jobdog
POSTGRES_DB=jobdog

# JWT (generate a secure random string)
APP_JWT_SECRET=your-secure-jwt-secret-here-min-32-chars

# OpenAI (for resume parsing)
APP_OPENAI_API_KEY=sk-...

# Cloudflare R2 (for resume storage)
APP_R2_ENDPOINT=https://...
APP_R2_ACCESS_KEY=...
APP_R2_SECRET_KEY=...
APP_R2_BUCKET_NAME=jobdog-resumes
APP_R2_REGION=auto

# Optional: Workday scraper sources (JSON array)
WORKDAY_SOURCES=[]
```

---

## Troubleshooting

### Scraper Issues

**Problem:** Scraper logs show "Failed to upsert requirement profile"

**Solution:** Fixed in latest code. Ensure you've rebuilt:
```bash
sudo docker compose up --build -d scraper-worker
```

**Problem:** Zero jobs parsed

**Check:**
1. SimplifyJobs repo format hasn't changed
2. Network connectivity to GitHub
3. Scraper logs for parsing errors

### Backend Issues

**Problem:** Backend won't start

**Check:**
1. Postgres is healthy: `sudo docker compose ps`
2. Environment variables are set in `.env`
3. JWT secret is at least 32 characters
4. Backend logs: `sudo docker compose logs backend-api`

**Problem:** Jobs endpoint returns empty array

**Check:**
1. Scraper has run at least once
2. Jobs have `status='ACTIVE'`
3. Database connection is working

### Database Issues

**Problem:** Connection refused

**Solution:**
```bash
# Restart Postgres
sudo docker compose restart postgres

# Check if it's healthy
sudo docker compose ps
```

**Problem:** Migration errors

**Solution:**
```bash
# Reset database (WARNING: deletes all data)
sudo docker compose down -v
sudo docker compose up -d postgres
sudo docker compose up -d backend-api
```

---

## Testing Checklist

Before deploying to production, verify:

- [ ] `go test ./...` passes in `services/scraper-worker`
- [ ] Scraper runs locally and parses jobs
- [ ] Backend health endpoint returns `UP`
- [ ] Jobs endpoint returns data
- [ ] No DB constraint errors in logs
- [ ] All environment variables are set
- [ ] JWT secret is secure and rotated from example

---

## API Endpoints

### Public Endpoints

- `GET /api/v1/system/health` - Health check
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login

### Authenticated Endpoints (require JWT)

- `GET /api/v1/jobs` - List active jobs
- `POST /api/v1/resumes/upload` - Upload resume
- `GET /api/v1/resumes` - List user's resumes
- `POST /api/v1/applications` - Create job application

---

## Monitoring

### Key Metrics to Watch

1. **Scraper:**
   - Jobs parsed per run
   - DB insertion errors
   - Scrape frequency (every 6 hours)

2. **Backend:**
   - API response times
   - Authentication failures
   - Database connection pool

3. **Database:**
   - Active jobs count
   - Stale jobs marked as closed
   - Storage size

### Quick Health Check

```bash
# Check all services are running
sudo docker compose ps

# Check recent logs for errors
sudo docker compose logs --tail 100 | grep -i error

# Test API
curl http://localhost:8080/api/v1/system/health
curl http://localhost:8080/api/v1/jobs
```

---

## Production Hardening TODO

- [ ] Add rate limiting to API endpoints
- [ ] Set up proper logging aggregation
- [ ] Configure HTTPS/TLS
- [ ] Set up database backups
- [ ] Add monitoring/alerting
- [ ] Implement API key rotation
- [ ] Add integration tests with Testcontainers
- [ ] Set up CI/CD pipeline
- [ ] Configure proper CORS for production frontend domain
- [ ] Add OpenAI-based skill extraction (more accurate than keywords)

---

## Related Documentation

- `SCRAPER_STATUS.md` - Detailed scraper source status and configuration
- `SETUP.md` - Initial setup and configuration guide
- `README.md` - Project overview and architecture
