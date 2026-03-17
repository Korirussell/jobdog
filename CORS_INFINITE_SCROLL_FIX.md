# 🔧 CORS & Infinite Scroll Fix

## Issues Identified

1. **CORS Error**: Backend not configured to allow Vercel domains
2. **401 Unauthorized**: Jobs endpoint requires authentication but frontend making unauthenticated requests
3. **Infinite Loop**: Infinite scroll making hundreds of requests rapidly

---

## ✅ Fixes Applied

### 1. Added CORS Configuration
Updated `application.yml` to allow Vercel domains:

```yaml
spring:
  web:
    cors:
      allowed-origins: 
        - "http://localhost:3000"
        - "https://*.vercel.app"
        - "https://jobdog-*.vercel.app"
      allowed-methods: GET,POST,PUT,DELETE,OPTIONS
      allowed-headers: "*"
      allow-credentials: true
```

### 2. Fixed Frontend API Calls
Changed `page.tsx` to use relative paths (triggering proxy):

```typescript
// BEFORE (direct to server)
const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/v1/jobs?${params}`);

// AFTER (uses proxy)
const response = await fetch(`/api/v1/jobs?${params}`);
```

---

## 🚨 Root Cause Analysis

### The Infinite Request Loop
The error logs show requests going to page 283, 284, etc. This indicates:

1. **Jobs endpoint is public** (already permitted in SecurityConfig)
2. **Frontend is making requests** without authentication tokens
3. **Infinite scroll is triggering** hundreds of requests
4. **Each request fails** with 401, triggering more requests

### Why 401 Errors Occur
Even though `/api/v1/jobs` is permitted, the backend might be:
- Checking for authentication in the service layer
- Returning 401 when no JWT token is present
- Having additional security checks

---

## 🔍 Debugging Steps

### Step 1: Check Backend Logs
```bash
# On your DigitalOcean server
docker logs jobdog-backend-api -f
```

Look for:
- CORS errors
- Authentication errors
- Request patterns

### Step 2: Test API Directly
```bash
# Test if jobs endpoint works without auth
curl http://134.122.7.82:8080/api/v1/jobs?page=0&size=10

# Test with CORS headers
curl -H "Origin: https://jobdog-n2bx7pgvn-korirussells-projects.vercel.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://134.122.7.82:8080/api/v1/jobs
```

### Step 3: Check SecurityConfig
The jobs endpoint is already permitted:
```java
.requestMatchers("/actuator/health", "/api/v1/system/health", "/api/v1/auth/**", "/api/v1/jobs", "/api/v1/jobs/*", "/oauth2/**", "/login/oauth2/**").permitAll()
```

But the service layer might have additional checks.

---

## 🛠️ Additional Fixes Needed

### Option 1: Make Jobs Truly Public
Check if `JobService` has authentication checks:

```java
// In JobService.java - look for @PreAuthorize or similar annotations
@PreAuthorize("permitAll")  // Add this if missing
public JobListResponse listActiveJobs(...) {
    // existing code
}
```

### Option 2: Add Error Handling
Add better error handling in frontend to stop infinite loops:

```typescript
// In page.tsx
if (response.status === 401) {
  console.log('Jobs endpoint requires authentication');
  setError('Please login to view jobs');
  return; // Stop infinite scroll
}
```

### Option 3: Debounce Infinite Scroll
Add rate limiting to infinite scroll:

```typescript
const loadMore = useCallback(() => {
  if (!loading && hasMore && !error) {
    setPage(prev => prev + 1);
  }
}, [loading, hasMore, error]);
```

---

## 🚀 Deploy and Test

### 1. Deploy Backend Changes
```bash
cd /home/kori/Coding/jobdog
git add .
git commit -m "fix: add CORS config for Vercel domains"
git push

# On DigitalOcean server
cd /path/to/jobdog
git pull
docker compose restart backend-api
```

### 2. Deploy Frontend Changes
```bash
git add .
git commit -m "fix: use relative paths for API calls"
git push
# Vercel will auto-deploy
```

### 3. Test the Fix
1. Open browser dev tools
2. Go to Network tab
3. Clear and reload
4. Check for:
   - No CORS errors
   - Requests going to `/api/v1/jobs` (relative paths)
   - Proper response codes

---

## 📊 Expected Results

After deploying:
- ✅ No CORS errors in browser console
- ✅ API requests go through Vercel proxy
- ✅ Jobs load without authentication errors
- ✅ Infinite scroll works properly
- ✅ No infinite request loops

---

## 🆘 If Still Failing

### Check These Things:
1. **Backend CORS headers** in response
2. **Vercel proxy configuration** in next.config.ts
3. **Environment variables** on Vercel (NEXT_PUBLIC_API_URL should be empty)
4. **SecurityConfig** endpoint permissions
5. **Service layer authentication** checks

### Debug Commands:
```bash
# Check CORS headers
curl -I http://134.122.7.82:8080/api/v1/jobs

# Check Vercel proxy
curl -I https://your-domain.vercel.app/api/v1/jobs
```

---

**Status**: 🔧 Fixes applied - Deploy and test
