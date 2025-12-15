#!/bin/bash

# Complete Build Script for Mantodeus Manager
# This script ensures a clean build with all dependencies and proper output

set -e  # Exit on any error

echo "🔨 Starting complete build process for Mantodeus Manager..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Clean everything
echo -e "${YELLOW}📁 Step 1: Cleaning build artifacts...${NC}"
rm -rf dist
rm -rf node_modules/.vite
rm -rf .vite
echo -e "${GREEN}✅ Clean complete${NC}\n"

# Step 2: Install dependencies
echo -e "${YELLOW}📦 Step 2: Installing dependencies...${NC}"
if command -v pnpm &> /dev/null; then
    echo "Using pnpm..."
    pnpm install
else
    echo "Using npm..."
    npm install
fi
echo -e "${GREEN}✅ Dependencies installed${NC}\n"

# Step 3: Type check
echo -e "${YELLOW}🔍 Step 3: Running TypeScript type check...${NC}"
npm run check || {
    echo -e "${RED}❌ Type check failed${NC}"
    exit 1
}
echo -e "${GREEN}✅ Type check passed${NC}\n"

# Step 4: Build frontend
echo -e "${YELLOW}⚛️  Step 4: Building frontend with Vite...${NC}"
npm run build:frontend || {
    echo -e "${RED}❌ Frontend build failed${NC}"
    exit 1
}

# Verify frontend output
if [ ! -d "dist/public" ]; then
    echo -e "${RED}❌ Frontend build failed: dist/public not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Frontend build complete${NC}\n"

# Step 5: Build backend
echo -e "${YELLOW}🔧 Step 5: Building backend with esbuild...${NC}"
npm run build:backend || {
    echo -e "${RED}❌ Backend build failed${NC}"
    exit 1
}

# Verify backend output
if [ ! -f "dist/index.js" ]; then
    echo -e "${RED}❌ Backend build failed: dist/index.js not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Backend build complete${NC}\n"

# Step 6: Verify build output
echo -e "${YELLOW}🔍 Step 6: Verifying build output...${NC}"
echo "Frontend files:"
ls -lh dist/public/ | head -10
echo ""
echo "Backend file:"
ls -lh dist/index.js
echo ""

# Step 7: Check file sizes
echo -e "${YELLOW}📊 Build Summary:${NC}"
FRONTEND_SIZE=$(du -sh dist/public 2>/dev/null | cut -f1)
BACKEND_SIZE=$(du -h dist/index.js 2>/dev/null | cut -f1)
echo "Frontend size: $FRONTEND_SIZE"
echo "Backend size: $BACKEND_SIZE"
echo ""

echo -e "${GREEN}✨ Build completed successfully! ✨${NC}"
echo "📦 Output directory: dist/"
echo "🚀 Start with: npm start"
echo ""
echo "📝 Environment variables required:"
echo "   - S3_ENDPOINT=https://s3.pub1.infomaniak.cloud"
echo "   - S3_REGION=us-east-1"
echo "   - S3_BUCKET=mantodeus-manager-files"
echo "   - S3_ACCESS_KEY_ID=ba794c9e6d034ccc9ac0bb2d3aa55b1b"
echo "   - S3_SECRET_ACCESS_KEY=e78e5ef0cebb462faf397ea621b1d87a"
echo ""















