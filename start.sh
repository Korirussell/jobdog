#!/bin/bash

# JobDog Quick Start Script
# This script helps you get JobDog up and running quickly

set -e

echo "🐕 JobDog Quick Start"
echo "===================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first:"
    echo "   https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first:"
    echo "   https://docs.docker.com/compose/install/"
    exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    
    # Generate JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    
    # Update .env with generated secret
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|APP_JWT_SECRET=CHANGE_ME_TO_A_SECURE_32_CHAR_SECRET|APP_JWT_SECRET=$JWT_SECRET|g" .env
    else
        sed -i "s|APP_JWT_SECRET=CHANGE_ME_TO_A_SECURE_32_CHAR_SECRET|APP_JWT_SECRET=$JWT_SECRET|g" .env
    fi
    
    echo "✅ Generated secure JWT secret"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and add your API keys:"
    echo "   - APP_OPENAI_API_KEY (required for resume parsing)"
    echo "   - APP_R2_* credentials (required for resume uploads)"
    echo ""
    read -p "Press Enter after you've updated .env, or Ctrl+C to exit..."
fi

# Validate required environment variables
source .env

if [ "$APP_JWT_SECRET" = "CHANGE_ME_TO_A_SECURE_32_CHAR_SECRET" ]; then
    echo "❌ Please set APP_JWT_SECRET in .env"
    exit 1
fi

if [ -z "$APP_OPENAI_API_KEY" ] || [ "$APP_OPENAI_API_KEY" = "sk-your-openai-api-key" ]; then
    echo "⚠️  Warning: APP_OPENAI_API_KEY not set. Resume parsing will not work."
fi

if [ -z "$APP_R2_ACCESS_KEY" ] || [ "$APP_R2_ACCESS_KEY" = "your-r2-access-key" ]; then
    echo "⚠️  Warning: Cloudflare R2 not configured. Resume uploads will not work."
fi

echo ""
echo "🔨 Building Docker images..."
docker-compose build

echo ""
echo "🚀 Starting services..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Wait for PostgreSQL
echo "   Checking PostgreSQL..."
for i in {1..30}; do
    if docker exec jobdog-postgres pg_isready -U jobdog &> /dev/null; then
        echo "   ✅ PostgreSQL is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "   ❌ PostgreSQL failed to start"
        docker-compose logs postgres
        exit 1
    fi
    sleep 1
done

# Wait for Redis
echo "   Checking Redis..."
for i in {1..30}; do
    if docker exec jobdog-redis redis-cli ping &> /dev/null; then
        echo "   ✅ Redis is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "   ❌ Redis failed to start"
        docker-compose logs redis
        exit 1
    fi
    sleep 1
done

# Wait for Backend API
echo "   Checking Backend API..."
for i in {1..60}; do
    if curl -s http://localhost:8080/actuator/health &> /dev/null; then
        echo "   ✅ Backend API is ready"
        break
    fi
    if [ $i -eq 60 ]; then
        echo "   ⚠️  Backend API is taking longer than expected"
        echo "   Check logs with: docker-compose logs backend-api"
    fi
    sleep 2
done

echo ""
echo "✅ JobDog is running!"
echo ""
echo "📍 Access points:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:8080"
echo "   Health:    http://localhost:8080/actuator/health"
echo ""
echo "📊 Useful commands:"
echo "   View logs:        docker-compose logs -f"
echo "   Stop services:    docker-compose down"
echo "   Restart:          docker-compose restart"
echo "   View status:      docker-compose ps"
echo ""
echo "📚 Documentation:"
echo "   Deployment Guide: DEPLOYMENT_GUIDE.md"
echo "   Audit Report:     CRITICAL_FIXES_IMPLEMENTED.md"
echo ""
