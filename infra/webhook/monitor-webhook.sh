#!/bin/bash
# Monitor webhook listener and restart if it goes down
# Can be run as a cron job: */5 * * * * /srv/customer/sites/manager.mantodeus.com/infra/webhook/monitor-webhook.sh

APP_PATH="/srv/customer/sites/manager.mantodeus.com"
LOG_FILE="$APP_PATH/logs/webhook-monitor.log"

# Create log directory if needed
mkdir -p "$(dirname "$LOG_FILE")"

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
    if ! curl -sf http://localhost:9000/health > /dev/null 2>&1; then
        log_message "WARNING: webhook-listener process exists but health check failed, restarting..."
        $PM2_CMD restart webhook-listener 2>&1 | tee -a "$LOG_FILE"
        sleep 2
        
        # Check again
        if curl -sf http://localhost:9000/health > /dev/null 2>&1; then
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

