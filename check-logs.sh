#!/bin/bash
# Quick script to find and display authentication logs on Infomaniak server

echo "=== Searching for [Auth] logs ==="
echo ""

# Check PM2 logs
echo "1. Checking PM2 logs..."
if command -v pm2 &> /dev/null; then
    pm2 logs --lines 50 --nostream 2>/dev/null | grep "\[Auth\]" || echo "   No [Auth] messages in PM2 logs"
else
    echo "   PM2 not found"
fi
echo ""

# Check /var/log/customer directory
echo "2. Checking /var/log/customer/..."
if [ -d "/var/log/customer" ]; then
    for logfile in /var/log/customer/*.log; do
        if [ -f "$logfile" ]; then
            echo "   Checking: $logfile"
            tail -n 100 "$logfile" 2>/dev/null | grep "\[Auth\]" || echo "   No [Auth] messages in this file"
        fi
    done
else
    echo "   /var/log/customer/ directory not found"
fi
echo ""

# Check app directory for log files
echo "3. Checking app directory for log files..."
cd /srv/customer/sites/manager.mantodeus.com 2>/dev/null || cd ~/sites/manager.mantodeus.com 2>/dev/null || echo "   Could not find app directory"
if [ -d "logs" ]; then
    for logfile in logs/*.log; do
        if [ -f "$logfile" ]; then
            echo "   Checking: $logfile"
            tail -n 100 "$logfile" 2>/dev/null | grep "\[Auth\]" || echo "   No [Auth] messages in this file"
        fi
    done
fi
if ls *.log 1> /dev/null 2>&1; then
    for logfile in *.log; do
        echo "   Checking: $logfile"
        tail -n 100 "$logfile" 2>/dev/null | grep "\[Auth\]" || echo "   No [Auth] messages in this file"
    done
fi
echo ""

# Check PM2 log files directly
echo "4. Checking PM2 log files..."
if [ -d ".pm2/logs" ]; then
    for logfile in .pm2/logs/*.log; do
        if [ -f "$logfile" ]; then
            echo "   Checking: $logfile"
            tail -n 100 "$logfile" 2>/dev/null | grep "\[Auth\]" || echo "   No [Auth] messages in this file"
        fi
    done
else
    echo "   .pm2/logs directory not found"
fi
echo ""

# Check journalctl
echo "5. Checking systemd/journalctl..."
if command -v journalctl &> /dev/null; then
    journalctl -u nodejs -n 50 2>/dev/null | grep "\[Auth\]" || echo "   No [Auth] messages in journalctl"
else
    echo "   journalctl not found"
fi
echo ""

echo "=== Done ==="
echo ""
echo "To monitor logs in real-time, try:"
echo "  pm2 logs --lines 0 | grep '\[Auth\]'"
echo "  tail -f /var/log/customer/*.log | grep '\[Auth\]'"














