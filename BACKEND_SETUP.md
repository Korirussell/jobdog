# Backend Network Setup Guide

## Problem
The backend is running on port 8080 but not accessible from the public internet, causing Vercel frontend to fail with `ROUTER_EXTERNAL_TARGET_CONNECTION_ERROR`.

## Solution: Set up Nginx Reverse Proxy

### Step 1: Install Nginx
```bash
sudo apt update
sudo apt install nginx -y
```

### Step 2: Copy Nginx Config
```bash
sudo cp nginx-jobdog.conf /etc/nginx/sites-available/jobdog
sudo ln -s /etc/nginx/sites-available/jobdog /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default config
```

### Step 3: Set up SSL with Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d jobdog.dev -d www.jobdog.dev
```

### Step 4: Test and Reload Nginx
```bash
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl enable nginx
```

### Step 5: Update Vercel Environment Variables
In your Vercel dashboard, set:
```
BACKEND_URL=https://jobdog.dev
NEXT_PUBLIC_API_URL=https://jobdog.dev
```

### Step 6: Verify
```bash
# Test from server
curl https://jobdog.dev/api/v1/jobs

# Test from anywhere
curl https://jobdog.dev/api/v1/jobs
```

## Alternative: Open Port 8080 (Not Recommended)

If you prefer to expose port 8080 directly (less secure):

### DigitalOcean
1. Go to Networking → Firewalls
2. Create inbound rule: TCP port 8080 from all sources

### AWS
1. Go to Security Groups
2. Add inbound rule: Custom TCP, Port 8080, Source 0.0.0.0/0

### GCP
1. Go to VPC Network → Firewall Rules
2. Create rule: tcp:8080, Source 0.0.0.0/0

## Recommended Approach
Use Nginx reverse proxy (Steps 1-6 above) for:
- SSL/TLS encryption
- Better security
- Standard ports (80/443)
- Future scalability
