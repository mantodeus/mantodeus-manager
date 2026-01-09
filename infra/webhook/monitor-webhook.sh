#!/bin/bash
# Monitor webhook listener and restart if it goes down (cron job friendly)
# Example cron: */5 * * * * /srv/customer/sites/manager.mantodeus.com/infra/webhook/monitor-webhook.sh

set -euo pipefail

APP_PATH="/srv/customer/sites/manager.mantodeus.com"
HEALTH_URL="${WEBHOOK_HEALTH_URL:-http://localhost:9000/health}"
LOG_FILE="$APP_PATH/logs/webhook-monitor.log"
LOCK_FILE="$APP_PATH/.webhook-monitor.lock"

# Create log directory if needed
mkdir -p "$(dirname "$LOG_FILE")"
# Prepare a simple lock so overlapping cron runs don’t fight
exec 9> "$LOCK_FILE"
if ! flock -n 9; then
    echo "[$(date -u)] Another webhook monitor run is active, exiting" | tee -a "$LOG_FILE"
    exit 0
fi

# Function to log with timestamp
log_message() {
    echo "[$(date -u +'%Y-%m-%d %H:%M:%S UTC')] $1" | tee -a "$LOG_FILE"
}

cd "$APP_PATH" || exit 1

# Check if webhook is running
if command -v pm2 &> /dev/null; then
    PM2_CMD="pm2"
elif command -v npx &> /dev/null; then
    PM2_CMD="npx pm2"
else
    log_message "ERROR: PM2 not found"
    exit 1
fi

# Check if process exists
if ! $PM2_CMD list 2>/dev/null | grep -q "webhook-listener"; then
    log_message "WARNING: webhook-listener is not running, attempting to start..."

    # Try to start it
    if $PM2_CMD start infra/webhook/ecosystem.config.cjs 2>&1 | tee -a "$LOG_FILE"; then
        log_message "SUCCESS: webhook-listener started"
        $PM2_CMD save 2>/dev/null
    else
        log_message "ERROR: Failed to start webhook-listener"
        exit 1
    fi
else
    # Check if it's actually responding
    if ! curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
        log_message "WARNING: webhook-listener process exists but health check failed, restarting..."
        $PM2_CMD restart webhook-listener 2>&1 | tee -a "$LOG_FILE"
        sleep 2

        # Check again
        if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
            log_message "SUCCESS: webhook-listener restarted and responding"
        else
            log_message "ERROR: webhook-listener still not responding after restart"
        fi
    else
        # All good, but log occasionally to show it's working
        # Only log every 10th run (if run every 5 min, that's every 50 min)
        RANDOM_CHECK=$((RANDOM % 10))
        if [ "$RANDOM_CHECK" -eq 0 ]; then
            log_message "OK: webhook-listener is running and healthy"
        fi
    fi
fi

