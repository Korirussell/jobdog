# 🔧 Mixed Content Error Fix

## Problem
Your Next.js frontend on Vercel (HTTPS) is trying to fetch data from your DigitalOcean server (HTTP), causing a **Mixed Content Error**. Modern browsers block HTTPS sites from making HTTP requests for security reasons.

## Solution: Next.js Proxy Hack
We're using Next.js rewrites to proxy API requests through Vercel, bypassing the browser's security restrictions.

---

## ✅ Changes Made Locally

### 1. Updated `next.config.ts`
Added proxy rewrite rule to route `/api/*` requests to your DigitalOcean server:

```typescript
const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://134.122.7.82:8080/api/:path*', 
      },
    ]
  },
};
```

### 2. Updated `lib/api.ts`
Modified API_BASE to use relative paths in production:

```typescript
// Use relative path for proxy mode (production), full URL for local development
const API_BASE = process.env.NODE_ENV === 'production' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080');
```

---

## 🚀 Next Steps (On Vercel)

### Step 1: Deploy the Code Changes
Push your changes and deploy to Vercel:
```bash
git add .
git commit -m "fix: add proxy for mixed content error"
git push
```

### Step 2: Update Vercel Environment Variable
1. Go to your Vercel Dashboard
2. Select your project
3. Go to **Settings → Environment Variables**
4. Edit or delete `NEXT_PUBLIC_API_URL`
   - **Option A**: Set it to an empty string `""`
   - **Option B**: Delete it entirely

### Step 3: Redeploy
Trigger a new deployment from the Vercel dashboard to apply the environment variable changes.

---

## 🔄 How It Works

### Before (Mixed Content Error)
```
Browser (HTTPS) → DigitalOcean Server (HTTP) ❌ BLOCKED
```

### After (Proxy Solution)
```
Browser (HTTPS) → Vercel (HTTPS) → DigitalOcean Server (HTTP) ✅ ALLOWED
```

The browser only sees HTTPS requests to Vercel. Vercel handles the HTTP request to your DigitalOcean server server-to-server.

---

## 📍 Your Server IP
The proxy is configured to forward requests to:
- **IP**: `134.122.7.82:8080`
- **Protocol**: HTTP (no SSL needed for server-to-server)

---

## 🧪 Testing

### Local Development
Still works with `NEXT_PUBLIC_API_URL=http://localhost:8080`

### Production (Vercel)
Uses relative paths, proxied to your DigitalOcean server

### Verify It Works
1. Deploy to Vercel
2. Open your site
3. Check browser Network tab
4. API requests should go to `https://your-domain.vercel.app/api/*`
5. No mixed content errors in console

---

## 🚨 Important Notes

### Security Considerations
- The proxy hides your server IP from the browser
- But your DigitalOcean server still needs to be secured
- Consider adding a firewall rule to only allow requests from Vercel's IP ranges

### CORS Headers
Make sure your backend allows requests from your Vercel domain:
```yaml
# In application.yml or environment
SPRING_WEB_CORS_ALLOWED-ORIGINS: https://your-domain.vercel.app
```

### Rate Limiting
The proxy doesn't change rate limiting behavior - your backend still sees all requests coming from Vercel's servers.

---

## 🎯 Expected Result

After deploying these changes:
- ✅ No more mixed content errors
- ✅ API calls work seamlessly
- ✅ Job listings load correctly
- ✅ Login/signup works
- ✅ Resume uploads work

---

## 📞 If It Still Doesn't Work

1. **Check Vercel logs** for proxy errors
2. **Verify backend is accessible** from the IP
3. **Check CORS headers** on backend responses
4. **Ensure NEXT_PUBLIC_API_URL** is empty/deleted on Vercel

---

**Status**: ✅ Proxy configured - Ready to deploy to Vercel
