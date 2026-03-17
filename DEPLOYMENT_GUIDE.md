# 🚀 JobDog Deployment Guide

Complete guide to get JobDog up and running in production.

---

## 📋 Prerequisites

- **Docker** and **Docker Compose** installed
- **Cloudflare R2** account (for resume storage)
- **OpenAI API key** (for resume parsing)
- **Domain name** (optional, for production)

---

## 🔧 Quick Start (Local Development)

### Step 1: Clone and Setup

```bash
cd /home/kori/Coding/jobdog
cp .env.example .env
```

### Step 2: Configure Environment Variables

Edit `.env` and set **REQUIRED** values:

```bash
# Generate a secure JWT secret
APP_JWT_SECRET=$(openssl rand -base64 32)

# Add your OpenAI API key
APP_OPENAI_API_KEY=sk-your-key-here

# Add your Cloudflare R2 credentials
APP_R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
APP_R2_BUCKET=resumes
APP_R2_ACCESS_KEY=your-access-key
APP_R2_SECRET_KEY=your-secret-key
```

### Step 3: Build and Start Services

```bash
# Build all services
docker-compose build

# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f
```

### Step 4: Verify Services

```bash
# Check service health
docker-compose ps

# Expected output:
# jobdog-postgres      Up (healthy)
# jobdog-redis         Up (healthy)
# jobdog-backend-api   Up
# jobdog-scraper-worker Up
```

### Step 5: Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **Health Check**: http://localhost:8080/actuator/health

---

## 🌐 Production Deployment Options

### Option 1: VPS Deployment (Recommended for Beginners)

**Best for**: DigitalOcean, Linode, AWS EC2, Google Cloud VM

#### 1. Provision a VPS

- **Minimum specs**: 2 vCPUs, 4GB RAM, 40GB SSD
- **Recommended**: 4 vCPUs, 8GB RAM, 80GB SSD
- **OS**: Ubuntu 22.04 LTS

#### 2. Install Docker

```bash
# SSH into your VPS
ssh root@your-server-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin
```

#### 3. Clone Repository

```bash
git clone https://github.com/yourusername/jobdog.git
cd jobdog
```

#### 4. Configure Production Environment

```bash
cp .env.example .env
nano .env
```

Set production values:
```bash
APP_JWT_SECRET=$(openssl rand -base64 32)
APP_OPENAI_API_KEY=sk-your-production-key
APP_R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com
APP_R2_ACCESS_KEY=your-access-key
APP_R2_SECRET_KEY=your-secret-key
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

#### 5. Deploy with Docker Compose

```bash
# Build and start
docker-compose up -d --build

# Check logs
docker-compose logs -f backend-api
```

#### 6. Setup Nginx Reverse Proxy

```bash
sudo apt-get install nginx certbot python3-certbot-nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/jobdog
```

Add this configuration:

```nginx
# Frontend
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/jobdog /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 7. Setup SSL with Let's Encrypt

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com
```

---

### Option 2: Docker Swarm (Recommended for Scale)

**Best for**: Multi-server deployments, high availability

#### 1. Initialize Swarm

```bash
docker swarm init
```

#### 2. Create Docker Stack File

Create `docker-stack.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: jobdog
      POSTGRES_USER: jobdog
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role == manager

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    deploy:
      replicas: 1

  backend-api:
    image: jobdog-backend:latest
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/jobdog
      APP_JWT_SECRET: ${APP_JWT_SECRET}
      REDIS_HOST: redis
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure

  scraper-worker:
    image: jobdog-scraper:latest
    environment:
      DATABASE_URL: postgres://jobdog:jobdog@postgres:5432/jobdog?sslmode=disable
    deploy:
      replicas: 2

volumes:
  postgres_data:
  redis_data:
```

#### 3. Deploy Stack

```bash
docker stack deploy -c docker-stack.yml jobdog
```

---

### Option 3: Kubernetes (Recommended for Enterprise)

**Best for**: AWS EKS, Google GKE, Azure AKS

#### 1. Create Kubernetes Manifests

See `k8s/` directory for full manifests (to be created).

#### 2. Deploy to Cluster

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/backend-api.yaml
kubectl apply -f k8s/scraper-worker.yaml
kubectl apply -f k8s/ingress.yaml
```

---

## 🔐 Security Checklist

### Before Going Live:

- [ ] **Change JWT secret** from default
- [ ] **Enable HTTPS** with valid SSL certificate
- [ ] **Set strong database passwords**
- [ ] **Configure firewall** (allow only 80, 443, 22)
- [ ] **Enable rate limiting** (already implemented)
- [ ] **Set up monitoring** (Prometheus + Grafana)
- [ ] **Configure backups** for PostgreSQL
- [ ] **Review OAuth2 redirect URIs**
- [ ] **Set CORS origins** to production domain
- [ ] **Enable Redis password** (optional)

---

## 📊 Monitoring & Observability

### Health Checks

```bash
# Backend API health
curl http://localhost:8080/actuator/health

# Database connection
docker exec jobdog-postgres pg_isready -U jobdog

# Redis connection
docker exec jobdog-redis redis-cli ping
```

### Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend-api

# Last 100 lines
docker-compose logs --tail=100 scraper-worker
```

### Metrics (Optional - Add Prometheus)

Add to `docker-compose.yml`:

```yaml
prometheus:
  image: prom/prometheus:latest
  ports:
    - "9090:9090"
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml

grafana:
  image: grafana/grafana:latest
  ports:
    - "3001:3000"
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin
```

---

## 🔄 CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker images
        run: |
          docker-compose build
      
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker-compose push
      
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/jobdog
            git pull
            docker-compose pull
            docker-compose up -d
```

---

## 🐛 Troubleshooting

### Backend won't start

```bash
# Check logs
docker-compose logs backend-api

# Common issues:
# 1. JWT secret too short (must be 32+ chars)
# 2. Database not ready (wait for health check)
# 3. Missing environment variables
```

### Scraper not running

```bash
# Check scraper logs
docker-compose logs scraper-worker

# Verify database connection
docker exec jobdog-scraper-worker nc -zv postgres 5432
```

### Frontend can't connect to API

```bash
# Check NEXT_PUBLIC_API_URL in .env
# For production: https://api.yourdomain.com
# For local: http://localhost:8080

# Rebuild frontend after changing env
docker-compose up -d --build frontend
```

### Redis connection failed

```bash
# Check Redis is running
docker-compose ps redis

# Test connection
docker exec jobdog-redis redis-cli ping

# Should return: PONG
```

---

## 📈 Scaling Guide

### Horizontal Scaling

1. **Backend API**: Scale to 3+ replicas
   ```bash
   docker-compose up -d --scale backend-api=3
   ```

2. **Add Load Balancer** (Nginx, HAProxy, or cloud LB)

3. **Database Read Replicas** (for >10K users)

4. **Redis Cluster** (for >100K users)

### Vertical Scaling

- **2-4 vCPUs**: Up to 1K concurrent users
- **4-8 vCPUs**: Up to 10K concurrent users
- **8-16 vCPUs**: Up to 100K concurrent users

---

## 💾 Backup Strategy

### Automated PostgreSQL Backups

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec jobdog-postgres pg_dump -U jobdog jobdog > backup_$DATE.sql
gzip backup_$DATE.sql
# Upload to S3 or R2
aws s3 cp backup_$DATE.sql.gz s3://your-backup-bucket/
EOF

chmod +x backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
0 2 * * * /path/to/backup.sh
```

---

## 🎯 Performance Optimization

### Database Indexes (Already Applied)

✅ Indexes on `jobs.status`, `jobs.posted_at`  
✅ Full-text search index on `jobs.description_text`  
✅ Composite indexes for common queries

### Redis Caching (Already Implemented)

✅ Job listings cached for 5 minutes  
✅ Cache invalidation on new scrapes

### Frontend Optimization

✅ Debounced search (500ms)  
✅ Infinite scroll pagination  
✅ React compiler enabled

---

## 📞 Support

- **Documentation**: `/docs` directory
- **Issues**: GitHub Issues
- **Logs**: `docker-compose logs -f`

---

## ✅ Post-Deployment Checklist

- [ ] All services running (`docker-compose ps`)
- [ ] Health checks passing
- [ ] SSL certificate valid
- [ ] OAuth2 login working
- [ ] Resume upload working
- [ ] Job scraper running (check logs)
- [ ] Database backups configured
- [ ] Monitoring setup
- [ ] DNS records configured
- [ ] Firewall rules set

---

**Your JobDog instance is now live! 🎉**

Access it at: https://yourdomain.com
