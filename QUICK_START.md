# 🚀 JobDog Quick Start Guide

Get JobDog running in **5 minutes**.

---

## Prerequisites

- Docker & Docker Compose installed
- OpenAI API key (for resume parsing)
- Cloudflare R2 account (for resume storage)

---

## 🏃 Quick Start

### 1. Run the Start Script

```bash
cd /home/kori/Coding/jobdog
./start.sh
```

The script will:
- ✅ Generate a secure JWT secret
- ✅ Create `.env` from template
- ✅ Build all Docker images
- ✅ Start all services
- ✅ Wait for health checks

### 2. Configure API Keys

Edit `.env` and add:

```bash
# Required for resume parsing
APP_OPENAI_API_KEY=sk-your-openai-api-key

# Required for resume uploads
APP_R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
APP_R2_BUCKET=resumes
APP_R2_ACCESS_KEY=your-r2-access-key
APP_R2_SECRET_KEY=your-r2-secret-key
```

### 3. Restart Services

```bash
docker-compose restart backend-api
```

### 4. Access JobDog

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **Health Check**: http://localhost:8080/actuator/health

---

## 🔧 Manual Setup (Alternative)

If you prefer manual setup:

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Generate JWT secret
echo "APP_JWT_SECRET=$(openssl rand -base64 32)" >> .env

# 3. Edit .env and add your API keys
nano .env

# 4. Build and start
docker-compose up -d --build

# 5. Check logs
docker-compose logs -f
```

---

## ✅ Verify Everything Works

### Check Service Status

```bash
docker-compose ps
```

Expected output:
```
NAME                   STATUS
jobdog-postgres        Up (healthy)
jobdog-redis           Up (healthy)
jobdog-backend-api     Up
jobdog-scraper-worker  Up
```

### Test Backend API

```bash
curl http://localhost:8080/actuator/health
```

Expected: `{"status":"UP"}`

### Test Job Listings

```bash
curl http://localhost:8080/api/v1/jobs?page=0&size=10
```

---

## 🐛 Common Issues

### "JWT secret must be at least 32 characters"

**Fix**: Generate a new secret
```bash
openssl rand -base64 32
```
Add to `.env` as `APP_JWT_SECRET`

### Backend won't start

**Check logs**:
```bash
docker-compose logs backend-api
```

**Common causes**:
- Database not ready (wait 30 seconds)
- Missing environment variables
- Port 8080 already in use

### Scraper not running

**Check logs**:
```bash
docker-compose logs scraper-worker
```

**Common causes**:
- Database connection failed
- Invalid Workday/Greenhouse URLs

### Frontend can't connect to API

**Fix**: Check `NEXT_PUBLIC_API_URL` in `.env`
```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
```

Rebuild frontend:
```bash
docker-compose up -d --build
```

---

## 📊 Useful Commands

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend-api

# Restart a service
docker-compose restart backend-api

# Stop all services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v

# Rebuild a specific service
docker-compose up -d --build backend-api
```

---

## 🎯 Next Steps

1. **Create an account** at http://localhost:3000/login
2. **Upload your resume** in Settings
3. **Browse jobs** on the home page
4. **Apply to jobs** and see match scores

---

## 📚 Full Documentation

- **Deployment Guide**: `DEPLOYMENT_GUIDE.md` - Production deployment
- **Audit Report**: `CRITICAL_FIXES_IMPLEMENTED.md` - Performance fixes
- **Architecture**: `docs/architecture_context.md` - System design

---

## 🆘 Need Help?

- Check logs: `docker-compose logs -f`
- View health: http://localhost:8080/actuator/health
- Review `.env` configuration
- See `DEPLOYMENT_GUIDE.md` troubleshooting section

---

**You're all set! 🎉**
