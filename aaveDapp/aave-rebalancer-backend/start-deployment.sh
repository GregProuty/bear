#!/bin/bash

# AAVE Rebalancer - Simple Deployment Helper
echo "🚀 AAVE Rebalancer Deployment Helper"
echo "=====================================\n"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}This script will help you deploy your AAVE rebalancer to production${NC}\n"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    echo -e "${YELLOW}❌ Please run this script from the aave-rebalancer-backend directory${NC}"
    exit 1
fi

echo -e "${GREEN}✅ You're in the right directory${NC}\n"

# Check for required files
echo "📋 Checking required files..."
if [ -f "railway.json" ]; then
    echo -e "${GREEN}✅ Railway config found${NC}"
else
    echo -e "${YELLOW}⚠️ Railway config missing${NC}"
fi

if [ -f "env.production.template" ]; then
    echo -e "${GREEN}✅ Environment template found${NC}"
else
    echo -e "${YELLOW}⚠️ Environment template missing${NC}"
fi

echo ""

# Check package.json scripts
echo "📦 Checking package.json scripts..."
if grep -q "start:prod" package.json; then
    echo -e "${GREEN}✅ Production scripts ready${NC}"
else
    echo -e "${YELLOW}⚠️ Production scripts need to be added${NC}"
fi

echo ""

# Next steps
echo -e "${BLUE}🎯 Next Steps:${NC}"
echo "1. 📝 Open DEPLOYMENT_GUIDE_SIMPLE.md for step-by-step instructions"
echo "2. 🔑 Get your Alchemy API keys (free tier)"
echo "3. 🚂 Deploy to Railway (5 minutes)"
echo "4. ▲ Deploy frontend to Vercel (5 minutes)"
echo "5. 💰 Fund your vault to start real performance tracking"
echo ""

echo -e "${GREEN}📖 Full guide: cat DEPLOYMENT_GUIDE_SIMPLE.md${NC}"
echo -e "${GREEN}🌐 Railway: https://railway.app${NC}"
echo -e "${GREEN}▲ Vercel: https://vercel.com${NC}"
echo ""

echo -e "${BLUE}Your vault address: 0xa189176b780Db31024038aD1C8080f62d87d5aea${NC}"
echo -e "${YELLOW}💡 Tip: Start with Railway's free tier, upgrade when needed${NC}" 