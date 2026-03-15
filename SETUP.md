# JobDog Setup Guide

## What You Need to Set Up

### 1. Cloudflare R2 (Resume Storage)

**Why:** Stores uploaded resume PDFs securely and cheaply.

**Steps:**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to R2 Object Storage
3. Create a new bucket named `resumes` (or your preferred name)
4. Go to "Manage R2 API Tokens"
5. Create a new API token with "Object Read & Write" permissions
6. Save these values:
   - Account ID (in the endpoint URL)
   - Access Key ID
   - Secret Access Key

**Cost:** Free tier includes 10GB storage, very cheap after that.

### 2. OpenAI API (Resume Parsing)

**Why:** Parses uploaded PDFs into structured resume data (skills, experience, education).

**Steps:**
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an account or sign in
3. Add a payment method (required for API access)
4. Go to API Keys section
5. Create a new API key
6. Save the key (starts with `sk-`)

**Cost:** ~$0.001 per resume with gpt-4o-mini (very cheap).

### 3. Local Environment Configuration

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Then edit `.env` and fill in your actual values:

```env
# Generate a random 32+ character secret
APP_JWT_SECRET=your-actual-secret-here-make-it-long-and-random

# Your OpenAI API key
APP_OPENAI_API_KEY=sk-your-actual-openai-key

# Your Cloudflare R2 credentials
APP_R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
APP_R2_BUCKET=resumes
APP_R2_ACCESS_KEY=your-actual-r2-access-key
APP_R2_SECRET_KEY=your-actual-r2-secret-key
APP_R2_REGION=auto
```

## Running Locally

### Prerequisites

- Docker and Docker Compose (already installed ✓)
- Your `.env` file configured (see above)

### Start the Full Stack

```bash
# From the project root
docker-compose up --build
```

This starts:
- **PostgreSQL** on port 5432
- **Backend API** on port 8080
- **Scraper Worker** (runs in background)

### Verify It's Working

1. **Check backend health:**
   ```bash
   curl http://localhost:8080/api/v1/system/health
   ```

2. **Check database:**
   ```bash
   docker-compose logs postgres
   ```

3. **Check scraper logs:**
   ```bash
   docker-compose logs scraper-worker
   ```

## What the System Does

### Backend API (Port 8080)

**Endpoints:**
- `POST /api/v1/auth/register` - Create account
- `POST /api/v1/auth/login` - Get JWT token
- `POST /api/v1/resumes` - Upload PDF resume (requires auth)
- `GET /api/v1/jobs` - List active jobs
- `POST /api/v1/jobs/{jobId}/applications` - Apply to job and get match score (requires auth)

**Flow:**
1. User registers/logs in → receives JWT token
2. User uploads PDF resume → stored in R2, parsed by OpenAI in background
3. User views jobs → fetched from database
4. User applies to job → match score calculated using deterministic algorithm
5. User sees percentile ranking (or "early applicant" message if <5 applicants)

### Scraper Worker

**What it does:**
- Scrapes jobs from GitHub repos (Simplify internships, etc.)
- Scrapes jobs from Workday ATS
- Extracts skills from job descriptions
- Runs every 6 hours automatically
- Marks old jobs as closed

**Sources:**
- GitHub: `SimplifyJobs/Summer2026-Internships`
- Workday: Configurable company endpoints
- More sources can be added easily

### Resume Parsing Pipeline

**Flow:**
1. User uploads PDF
2. Backend extracts text from PDF
3. Text sent to OpenAI gpt-4o-mini
4. OpenAI returns structured JSON: `{skills: [...], yearsExperience: int, educationLevel: string}`
5. Saved to `resume_profiles` table
6. Used for match scoring when applying to jobs

### Match Scoring

**How it works:**
- **Required skills coverage:** 60% weight
- **Preferred skills coverage:** 15% weight
- **Experience alignment:** 15% weight
- **Education alignment:** 10% weight

**Result:** Score from 0-100

**Benchmarking:**
- If <5 applicants: "Congrats, you are one of the first 5 applicants!"
- If ≥5 applicants: Percentile ranking (e.g., "You are in the top 20%")

## Testing the API

### 1. Register a user

```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "displayName": "Test User"
  }'
```

Save the `token` from the response.

### 2. Upload a resume

```bash
curl -X POST http://localhost:8080/api/v1/resumes \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "file=@/path/to/your/resume.pdf" \
  -F "label=My Resume"
```

### 3. List jobs

```bash
curl http://localhost:8080/api/v1/jobs
```

### 4. Apply to a job

```bash
curl -X POST http://localhost:8080/api/v1/jobs/JOB_ID_HERE/applications \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "resumeId": "YOUR_RESUME_ID_HERE"
  }'
```

## Troubleshooting

### Backend won't start

**Check logs:**
```bash
docker-compose logs backend-api
```

**Common issues:**
- Missing environment variables → check `.env` file
- Database not ready → wait a few seconds and try again
- Port 8080 already in use → stop other services or change port in `docker-compose.yml`

### Scraper not finding jobs

**Check logs:**
```bash
docker-compose logs scraper-worker
```

**Common issues:**
- Database connection failed → check postgres is running
- GitHub API rate limit → wait an hour or add GitHub token
- No jobs in database yet → scraper runs on startup, check logs

### Resume parsing fails

**Check:**
- OpenAI API key is correct
- You have credits in your OpenAI account
- PDF is valid and not corrupted
- Check backend logs for parsing errors

### Match scoring returns error

**Check:**
- Resume has been parsed (check `resume_profiles` table)
- Job has requirement profile (check `job_requirement_profiles` table)
- User owns the resume they're applying with

## Database Access

### Connect to PostgreSQL

```bash
docker-compose exec postgres psql -U jobdog -d jobdog
```

### Useful queries

```sql
-- Check users
SELECT id, email, display_name FROM users;

-- Check resumes
SELECT id, user_id, status, original_filename FROM resumes;

-- Check resume profiles
SELECT r.id, r.original_filename, rp.skills, rp.years_experience 
FROM resumes r 
JOIN resume_profiles rp ON r.id = rp.resume_id;

-- Check jobs
SELECT id, source, company, title, status FROM jobs LIMIT 10;

-- Check applications
SELECT a.id, u.email, j.title, j.company, ascore.match_score, ascore.percentile
FROM applications a
JOIN users u ON a.user_id = u.id
JOIN jobs j ON a.job_id = j.id
LEFT JOIN application_scores ascore ON a.id = ascore.application_id;
```

## Production Deployment

### Environment Variables for Production

Use the same variables as `.env.example` but with production values:
- Use a strong, random JWT secret (32+ characters)
- Use production R2 bucket
- Use production database URL
- Consider using a secret manager (Doppler, AWS Secrets Manager, etc.)

### Recommended Setup

1. **Database:** Hosted Postgres (Neon, Supabase, Railway, or your Oracle Cloud VM)
2. **Backend:** Deploy to Oracle Cloud VM, Railway, Render, or similar
3. **Scraper:** Same VM as backend or separate worker instance
4. **Frontend:** Cloudflare Pages, Vercel, or Netlify (when you build it)

### Security Checklist

- [ ] Change all default secrets
- [ ] Use HTTPS in production
- [ ] Set proper CORS origins (not `*`)
- [ ] Enable rate limiting
- [ ] Set up monitoring/logging
- [ ] Regular database backups
- [ ] Keep dependencies updated

## Next Steps

1. **Test the full flow locally**
2. **Verify scraper is finding jobs**
3. **Upload a test resume and verify parsing**
4. **Apply to a job and verify scoring**
5. **Build the frontend** (React/Next.js)
6. **Deploy to production**

## Support

If you encounter issues:
1. Check the logs: `docker-compose logs [service-name]`
2. Verify environment variables are set correctly
3. Check database connectivity
4. Verify external services (OpenAI, R2) are accessible
