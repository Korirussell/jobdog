# Nginx Setup for JobDog (Digital Ocean + Docker)

## Step 1: SSH into your Digital Ocean server

```bash
ssh root@your-server-ip
```

## Step 2: Install Nginx and Certbot

```bash
# Update packages
apt update && apt upgrade -y

# Install Nginx and Let's Encrypt
apt install nginx certbot python3-certbot-nginx -y

# Start and enable Nginx
systemctl start nginx
systemctl enable nginx
```

## Step 3: Copy Nginx Config

```bash
# Copy the config file
cp nginx-jobdog.conf /etc/nginx/sites-available/jobdog

# Enable the site
ln -s /etc/nginx/sites-available/jobdog /etc/nginx/sites-enabled/

# Remove default site
rm /etc/nginx/sites-enabled/default

# Test config
nginx -t
```

## Step 4: Get SSL Certificate

```bash
# Get Let's Encrypt certificate
certbot --nginx -d jobdog.dev -d www.jobdog.dev

# Follow prompts to accept terms and enter email
```

## Step 5: Ensure Docker Container is Accessible

Your backend container needs to be reachable from `localhost:8080`. Check:

```bash
# Test if backend is accessible from host
curl http://localhost:8080/api/v1/jobs

# If not working, check your Docker container:
docker ps
docker logs <container-name>
```

## Step 6: Reload Nginx

```bash
# Reload Nginx to apply changes
systemctl reload nginx

# Check status
systemctl status nginx
```

## Step 7: Update Vercel Environment Variables

In your Vercel dashboard, set:
```
BACKEND_URL=https://jobdog.dev
NEXT_PUBLIC_API_URL=https://jobdog.dev
```

## Step 8: Test Everything

```bash
# Test backend through Nginx
curl https://jobdog.dev/api/v1/jobs

# Should return JSON with jobs instead of 502 error
```

## Troubleshooting

### If curl localhost:8080 fails:
Your Docker container isn't exposing port 8080 to the host. Check your `docker-compose.yml`:

```yaml
services:
  backend-api:
    ports:
      - "8080:8080"  # This should be present
```

### If SSL setup fails:
```bash
# Check DNS points to your server
nslookup jobdog.dev

# Should return your Digital Ocean IP
```

### If Nginx test fails:
```bash
# Check syntax
nginx -t

# Check logs
tail -f /var/log/nginx/error.log
```

## What This Does

- **Port 80**: Redirects all HTTP traffic to HTTPS
- **Port 443**: Handles HTTPS with SSL certificate
- **API routes** (`/api/*`, `/oauth2/*`, `/login/oauth2/*`): Proxies to your Docker container on port 8080
- **WebSocket** (`/ws/*`): Special proxy for real-time connections
- **Frontend** (`/`): Proxies to your Vercel frontend

Once complete, your backend will be accessible at `https://jobdog.dev/api/v1/jobs` and the site should work again.
