# 🔧 HQL Query Syntax Error Fix

## Issue
The backend API was failing to start due to a syntax error in the HQL query in `JobRepository.java`.

### Error Message
```
org.hibernate.query.SyntaxException: At 1:196 and token '=', no viable alternative at input 
'... (LOWER(j.location) LIKE '%remote%') *= :remote ...'
```

### Problem
The HQL query contained an invalid `*=` operator which doesn't exist in HQL syntax.

---

## ✅ Fix Applied

### File: `JobRepository.java`

**Before (line 19):**
```hql
AND (:remote IS NULL OR (LOWER(j.location) LIKE '%remote%') *= :remote)
```

**After (line 19):**
```hql
AND (:remote IS NULL OR :remote = false OR LOWER(j.location) LIKE '%remote%')
```

### Logic Explanation
The new logic properly handles the remote filter:
- If `:remote` is NULL → ignore filter (show all)
- If `:remote` is false → show all jobs (no remote filter)
- If `:remote` is true → only show jobs with "remote" in location

---

## 🚀 Deploy the Fix

### 1. Commit and Push
```bash
git add .
git commit -m "fix: resolve HQL syntax error in JobRepository"
git push origin master
```

### 2. Deploy to Production
```bash
# On your DigitalOcean server
cd ~/jobdog
git pull
docker compose restart backend-api
```

### 3. Verify the Fix
```bash
# Check if backend is running
docker compose ps

# Check logs
docker compose logs backend-api

# Test API endpoint
curl http://134.122.7.82:8080/api/v1/jobs?page=0&size=10
```

---

## 📊 Expected Result

After deploying:
- ✅ Backend starts without HQL syntax errors
- ✅ Job listing endpoint works
- ✅ Remote filter functions correctly
- ✅ Frontend can load jobs successfully

---

## 🔍 Testing the Filters

### Test Remote Filter
```bash
# All jobs (no remote filter)
curl "http://134.122.7.82:8080/api/v1/jobs?page=0&size=10"

# Only remote jobs
curl "http://134.122.7.82:8080/api/v1/jobs?page=0&size=10&remote=true"

# No remote filter (same as all jobs)
curl "http://134.122.7.82:8080/api/v1/jobs?page=0&size=10&remote=false"
```

### Test Location Filter
```bash
# Jobs in New York
curl "http://134.122.7.82:8080/api/v1/jobs?page=0&size=10&location=New+York"
```

### Test Search Filter
```bash
# Jobs with "engineer" in title/description
curl "http://134.122.7.82:8080/api/v1/jobs?page=0&size=10&search=engineer"
```

---

## 🎯 Next Steps

1. **Deploy the fix** to production
2. **Test the API endpoints** to ensure they work
3. **Check frontend** - jobs should load without infinite errors
4. **Verify CORS** - should work with the previous CORS configuration

---

**Status**: ✅ HQL syntax fixed - Ready to deploy
