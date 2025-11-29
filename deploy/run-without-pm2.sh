#!/bin/bash

# Alternative: Run webhook server without PM2
# Use this if PM2 is not available

cd "$(dirname "$0")"

echo "Starting webhook server without PM2..."
echo "Press Ctrl+C to stop"
echo ""

# Run in foreground
node deploy.js

