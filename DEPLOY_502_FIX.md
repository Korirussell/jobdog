# 🔧 502 Error Fix - Deploy Backend Updates

## Issue
Getting 502 Bad Gateway errors from `/api/v1/jobs` endpoints. This means the backend server is not running or not responding.

## Root Cause
The HQL syntax fix hasn't been deployed to your DigitalOcean server yet. The backend is still failing to start with the old syntax error.

---

## 🚀 Immediate Fix - Deploy to Production

### Step 1: SSH into Your DigitalOcean Server
```bash
ssh root@134.122.7.82
```

### Step 2: Pull Latest Code
```bash
cd ~/jobdog
git pull origin master
```

### Step 3: Rebuild and Restart Backend
```bash
# Stop current services
docker compose down

# Rebuild with latest code
docker compose build backend-api

# Start services
docker compose up -d

# Check status
docker compose ps
```

### Step 4: Verify Backend is Running
```bash
# Check logs for startup errors
docker compose logs backend-api

# Test health endpoint
curl http://localhost:8080/actuator/health

# Test jobs endpoint
curl http://localhost:8080/api/v1/jobs?page=0&size=10
```

---

## 🔍 If Still Getting Errors

### Check Docker Logs
```bash
# View all logs
docker compose logs -f

# Specific backend logs
docker compose logs backend-api

# Check if container is running
docker ps | grep jobdog
```

### Common Issues & Fixes

#### 1. Port Conflict
```bash
# Check what's using port 8080
netstat -tulpn | grep :8080

# Kill process if needed
kill -9 <PID>
```

#### 2. Database Connection
```bash
# Check PostgreSQL
docker compose exec postgres pg_isready -U jobdog

# Check database logs
docker compose logs postgres
```

#### 3. Environment Variables
```bash
# Check .env file exists
ls -la .env

# Verify JWT secret is set
grep APP_JWT_SECRET .env
```

---

## 📊 Expected Success Indicators

After successful deployment, you should see:

### Backend Logs
```
Started BackendApiApplication
Tomcat initialized with port 8080
JobDog Backend API is running
```

### Health Check
```bash
curl http://localhost:8080/actuator/health
# Should return: {"status":"UP"}
```

### Jobs Endpoint
```bash
curl http://localhost:8080/api/v1/jobs?page=0&size=10
# Should return JSON with job listings
```

### Docker Status
```bash
docker compose ps
# Should show all services as "Up" or "Up (healthy)"
```

---

## 🌐 Test from External

After backend is working locally on the server:

```bash
# Test from your local machine
curl http://134.122.7.82:8080/api/v1/jobs?page=0&size=10

# Should return job listings
```

---

## 🔄 If Issues Persist

### Full Reset Option
```bash
# Clean slate approach
docker compose down -v
docker system prune -a
git pull origin master
docker compose build --no-cache
docker compose up -d
```

### Check Server Resources
```bash
# Memory usage
free -h

# Disk space
df -h

# CPU usage
top
```

---

## 🎯 Frontend Should Work After This

Once the backend is deployed and running:
- ✅ No more 502 errors
- ✅ Jobs load on frontend
- ✅ Infinite scroll works
- ✅ No CORS errors

---

## 📞 Quick Debug Commands

```bash
# One-liner to check everything
docker compose ps && echo "---" && docker compose logs --tail=20 backend-api && echo "---" && curl -s http://localhost:8080/actuator/health
```

---

**Status**: 🔧 Ready to deploy - Follow the steps above
