# 🔧 Scraper Context Canceled Error Fix

## Issue
Scraper worker is failing with "context canceled" errors for all job sources (GitHub, Greenhouse, Workday).

```
ERR Initial GitHub scrape failed error="context canceled"
ERR Initial Greenhouse scrape failed error="context canceled"
```

## Root Causes

### 1. Worker Pool Timing Issue
The worker pool might be shutting down before tasks complete.

### 2. Network Connectivity
Server might not have internet access to job APIs.

### 3. Rate Limiting
Job APIs might be blocking requests from your server IP.

---

## 🔍 Debug Steps

### Step 1: Check Network Connectivity
```bash
# Test internet connectivity
curl -I https://github.com
curl -I https://boards.greenhouse.io
curl -I https://boards.indeed.com

# Test specific job board endpoints
curl -I https://api.github.com
curl -I https://boards.greenhouse.io/stripe
```

### Step 2: Check Worker Pool Configuration
The worker pool might need more time to complete tasks.

### Step 3: Run Scraper Manually
```bash
# Stop current scraper
docker compose stop scraper-worker

# Run scraper directly to see detailed errors
docker compose run --rm scraper-worker ./scraper-worker
```

---

## 🛠️ Potential Fixes

### Fix 1: Increase Worker Timeout
The worker pool might need more time. Check the worker pool implementation.

### Fix 2: Network Issues
If network connectivity is blocked, you may need to:
- Configure firewall rules
- Use a different network
- Add proxy configuration

### Fix 3: Simple Test Scrape
Create a simple test to verify basic connectivity:

```bash
# Test a simple HTTP request
docker compose exec scraper-worker curl -I https://github.com
```

---

## 🔧 Quick Fix - Restart with Debug

```bash
# Stop all services
docker compose down

# Start just database
docker compose up -d postgres

# Wait 10 seconds
sleep 10

# Start scraper with more verbose logging
docker compose up -d scraper-worker

# Watch logs in real-time
docker compose logs -f scraper-worker
```

---

## 📊 Expected Success

Working scraper should show:
```
INF Starting Simplify repo scrape
INF Scraped 150 jobs from GitHub
INF Starting Greenhouse scrape company=Stripe  
INF Scraped 75 jobs from Stripe
INF All initial scrapers completed
INF Scraper worker is running
```

---

## 🆘 If Still Failing

### Option 1: Skip Scraping for Now
Add some sample jobs directly to database:

```bash
# Connect to database
docker compose exec postgres psql -U jobdog -d jobdog

# Insert sample job
INSERT INTO jobs (job_id, source, source_job_id, source_url, title, company, location, status, posted_at, scraped_at) 
VALUES 
('test-1', 'github', 'github-1', 'https://github.com/jobs/test', 'Software Engineer', 'Test Company', 'Remote', 'ACTIVE', NOW(), NOW());

INSERT INTO jobs (job_id, source, source_job_id, source_url, title, company, location, status, posted_at, scraped_at) 
VALUES 
('test-2', 'greenhouse', 'gh-1', 'https://boards.greenhouse.io/test', 'Frontend Developer', 'Another Company', 'New York', 'ACTIVE', NOW(), NOW());
```

### Option 2: Check Firewall
```bash
# Check firewall rules
ufw status

# Allow outbound HTTP/HTTPS if needed
ufw allow out 80
ufw allow out 443
```

---

## 🎯 Immediate Action

Run this to debug:

```bash
# Test connectivity first
curl -I https://github.com

# If that works, restart scraper
docker compose restart scraper-worker

# Watch for detailed errors
docker compose logs -f scraper-worker
```

---

**Status**: 🔧 Scraper needs debugging - Network or timing issue likely
