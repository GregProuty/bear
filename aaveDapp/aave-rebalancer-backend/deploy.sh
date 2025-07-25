#!/bin/bash

# AAVE Rebalancer Production Deployment Script
set -e

echo "🚀 Starting AAVE Rebalancer Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}This script should not be run as root${NC}"
   exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found${NC}"
    echo "Please copy env.production.template to .env and configure it"
    echo "cp env.production.template .env"
    echo "Then edit .env with your production values"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Stop existing services
echo "📦 Stopping existing services..."
docker-compose -f docker-compose.prod.yml down

# Pull latest images
echo "📥 Pulling latest images..."
docker-compose -f docker-compose.prod.yml pull

# Build new images
echo "🔨 Building application..."
docker-compose -f docker-compose.prod.yml build --no-cache

# Start services
echo "🚀 Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run database migrations
echo "🗄️ Running database migrations..."
docker-compose -f docker-compose.prod.yml exec backend npm run migrate

# Check health
echo "🏥 Checking service health..."
sleep 5

# Check if services are running
if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo ""
    echo "Services are running:"
    docker-compose -f docker-compose.prod.yml ps
    echo ""
    echo "Backend API: http://localhost:4000/graphql"
    echo "Health check: http://localhost:4000/health"
    echo ""
    echo "View logs with: docker-compose -f docker-compose.prod.yml logs -f"
else
    echo -e "${RED}❌ Deployment failed!${NC}"
    echo "Check logs with: docker-compose -f docker-compose.prod.yml logs"
    exit 1
fi

echo -e "${GREEN}🎉 AAVE Rebalancer is now running in production mode!${NC}" 