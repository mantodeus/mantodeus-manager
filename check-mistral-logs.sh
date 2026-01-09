#!/bin/bash
# Quick script to check server logs for Mistral OCR activity

echo "=== Checking PM2 Logs for Mistral OCR ==="
echo ""
echo "Recent Mistral OCR logs (last 500 lines):"
echo "----------------------------------------"
npx pm2 logs mantodeus-manager --lines 500 --nostream | grep -i "\[Mistral OCR\]" | tail -100

echo ""
echo "=== To view live Mistral OCR logs, run: ==="
echo "npx pm2 logs mantodeus-manager --lines 0 | grep -i '\[Mistral OCR\]'"
echo ""
echo "=== To see all recent logs (including context): ==="
echo "npx pm2 logs mantodeus-manager --lines 500 | grep -A 5 -B 5 '\[Mistral OCR\]'"
echo ""
echo "=== To save Mistral OCR logs to file: ==="
echo "npx pm2 logs mantodeus-manager --lines 1000 > mistral-ocr-logs.txt 2>&1"
echo "grep -i '\[Mistral OCR\]' mistral-ocr-logs.txt > mistral-filtered.txt"
