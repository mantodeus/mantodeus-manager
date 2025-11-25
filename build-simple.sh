#!/bin/bash

set -e  # Exit on any error

echo "🔨 Mantodeus Manager Build Script"
echo "=================================="
echo ""

# Step 1: Clean
echo "📁 Cleaning dist directory..."
rm -rf dist
mkdir -p dist
echo "✅ Clean complete"
echo ""

# Step 2: Build frontend
echo "⚛️  Building frontend with Vite..."
npx vite build
if [ $? -ne 0 ]; then
    echo "❌ Vite build failed"
    exit 1
fi
echo "✅ Frontend build complete"
echo ""

# Step 3: Verify frontend
if [ ! -d "dist/public" ]; then
    echo "❌ Frontend build failed: dist/public not found"
    exit 1
fi
echo "✅ Frontend verified: dist/public exists"
echo ""

# Step 4: Build backend
echo "🔧 Building backend with esbuild..."
npx esbuild server/_core/index.ts \
    --platform=node \
    --packages=external \
    --bundle \
    --format=esm \
    --outdir=dist \
    --log-level=info

if [ $? -ne 0 ]; then
    echo "❌ esbuild failed"
    exit 1
fi
echo "✅ Backend build complete"
echo ""

# Step 5: Verify backend
if [ ! -f "dist/index.js" ]; then
    echo "❌ Backend build failed: dist/index.js not found"
    echo "Contents of dist/:"
    ls -lah dist/
    exit 1
fi
echo "✅ Backend verified: dist/index.js exists"
echo ""

# Step 6: Summary
echo "📊 Build Summary:"
ls -lh dist/
echo ""
du -sh dist/
echo ""
echo "✨ Build completed successfully!"
echo "📦 Output: dist/index.js ($(du -h dist/index.js | cut -f1))"
echo "🚀 Ready to start with: npm start"
