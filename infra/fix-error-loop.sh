#!/bin/bash
#
# Fix Error Loop on Infomaniak
#
# This script fixes the error loop where the server keeps restarting
# because it's looking for files in the wrong location.
#
# Usage:
#   SSH into your Infomaniak server and run:
#   bash /path/to/this/script.sh
#
# Or run remotely:
#   ssh mantodeus-server 'bash -s' < infra/fix-error-loop.sh

set -e  # Exit on error

echo "=========================================="
echo "Fix Error Loop - Mantodeus Manager"
echo "=========================================="
echo ""

# Configuration
APP_PATH="${APP_PATH:-/srv/customer/sites/manager.mantodeus.com}"
PM2_NAME="${PM2_NAME:-mantodeus-manager}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Stopping PM2 process...${NC}"
cd "$APP_PATH"

# Stop all PM2 processes
./node_modules/.bin/pm2 stop all || true
./node_modules/.bin/pm2 delete all || true

echo -e "${GREEN}✓ PM2 processes stopped${NC}"
echo ""

echo -e "${YELLOW}Step 2: Killing any processes on port 3000...${NC}"
# Kill any process using port 3000
fuser -k 3000/tcp 2>/dev/null || lsof -ti:3000 | xargs kill -9 2>/dev/null || true

echo -e "${GREEN}✓ Port 3000 cleared${NC}"
echo ""

echo -e "${YELLOW}Step 3: Pulling latest code from GitHub...${NC}"
git fetch --all
git reset --hard origin/main

echo -e "${GREEN}✓ Latest code pulled${NC}"
echo ""

echo -e "${YELLOW}Step 4: Installing dependencies...${NC}"
npm install --include=dev

echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

echo -e "${YELLOW}Step 5: Building application...${NC}"
npm run build

echo -e "${GREEN}✓ Build complete${NC}"
echo ""

echo -e "${YELLOW}Step 6: Verifying build output...${NC}"
if [ -f "dist/index.js" ]; then
  echo -e "${GREEN}✓ Backend build found: dist/index.js${NC}"
else
  echo -e "${RED}✗ Backend build NOT found: dist/index.js${NC}"
  exit 1
fi

if [ -f "dist/public/index.html" ]; then
  echo -e "${GREEN}✓ Frontend build found: dist/public/index.html${NC}"
else
  echo -e "${RED}✗ Frontend build NOT found: dist/public/index.html${NC}"
  exit 1
fi

echo ""

echo -e "${YELLOW}Step 7: Starting application with PM2...${NC}"
./node_modules/.bin/pm2 start npm --name "$PM2_NAME" -- start
./node_modules/.bin/pm2 save

echo -e "${GREEN}✓ Application started${NC}"
echo ""

echo -e "${YELLOW}Step 8: Waiting for application to start...${NC}"
sleep 5

echo -e "${YELLOW}Step 9: Checking application status...${NC}"
./node_modules/.bin/pm2 list

echo ""
echo -e "${GREEN}=========================================="
echo -e "✓ Fix Complete!"
echo -e "==========================================${NC}"
echo ""
echo "Application should now be running without errors."
echo ""
echo "To check logs:"
echo "  ./node_modules/.bin/pm2 logs $PM2_NAME"
echo ""
echo "To check status:"
echo "  ./node_modules/.bin/pm2 status"
echo ""
