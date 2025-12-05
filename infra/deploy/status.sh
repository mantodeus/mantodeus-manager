#!/bin/bash
################################################################################
# Mantodeus Manager - Status and Health Check Script
################################################################################
# This script outputs comprehensive application status in JSON format
#
# Usage:
#   ./status.sh [--logs N]
#
# Options:
#   --logs N    Include last N lines of logs (default: 50)
#
# Output: JSON with health, memory, uptime, logs
################################################################################

set -euo pipefail

# Configuration
PROJECT_DIR="${PROJECT_DIR:-/srv/customer/sites/manager.mantodeus.com}"
APP_NAME="mantodeus-manager"
LOG_DIR="${PROJECT_DIR}/logs"
LOG_LINES=50

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --logs)
            LOG_LINES="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Initialize JSON output
JSON_OUTPUT='{}'

add_json() {
    JSON_OUTPUT=$(echo "$JSON_OUTPUT" | jq --arg k "$1" --arg v "$2" '. + {($k): $v}')
}

add_json_raw() {
    JSON_OUTPUT=$(echo "$JSON_OUTPUT" | jq --arg k "$1" --argjson v "$2" '. + {($k): $v}')
}

# Get timestamp
add_json "timestamp" "$(date -Iseconds)"
add_json "project_dir" "$PROJECT_DIR"

# Check if PM2 is available
if command -v pm2 &> /dev/null; then
    add_json "pm2_available" "true"
    
    # Get PM2 app info
    if pm2 describe "$APP_NAME" &> /dev/null; then
        PM2_INFO=$(pm2 jlist | jq ".[] | select(.name==\"$APP_NAME\")")
        
        # Extract key information
        STATUS=$(echo "$PM2_INFO" | jq -r '.pm2_env.status // "unknown"')
        UPTIME=$(echo "$PM2_INFO" | jq -r '.pm2_env.pm_uptime // 0')
        MEMORY=$(echo "$PM2_INFO" | jq -r '.monit.memory // 0')
        CPU=$(echo "$PM2_INFO" | jq -r '.monit.cpu // 0')
        RESTARTS=$(echo "$PM2_INFO" | jq -r '.pm2_env.restart_time // 0')
        PID=$(echo "$PM2_INFO" | jq -r '.pid // 0')
        
        # Calculate uptime in human-readable format
        if [ "$UPTIME" != "0" ]; then
            CURRENT_TIME=$(date +%s)
            UPTIME_SECONDS=$(( (CURRENT_TIME * 1000 - UPTIME) / 1000 ))
            UPTIME_HUMAN=$(printf '%dd %dh %dm %ds' $((UPTIME_SECONDS/86400)) $((UPTIME_SECONDS%86400/3600)) $((UPTIME_SECONDS%3600/60)) $((UPTIME_SECONDS%60)))
        else
            UPTIME_HUMAN="unknown"
        fi
        
        # Convert memory to MB
        MEMORY_MB=$(echo "scale=2; $MEMORY / 1024 / 1024" | bc)
        
        add_json "app_found" "true"
        add_json "status" "$STATUS"
        add_json "pid" "$PID"
        add_json "uptime_seconds" "$UPTIME_SECONDS"
        add_json "uptime_human" "$UPTIME_HUMAN"
        add_json "memory_bytes" "$MEMORY"
        add_json "memory_mb" "$MEMORY_MB"
        add_json "cpu_percent" "$CPU"
        add_json "restart_count" "$RESTARTS"
        
        # Health status
        if [ "$STATUS" = "online" ]; then
            add_json "health" "healthy"
        elif [ "$STATUS" = "stopping" ] || [ "$STATUS" = "stopped" ]; then
            add_json "health" "stopped"
        elif [ "$STATUS" = "errored" ]; then
            add_json "health" "error"
        else
            add_json "health" "unknown"
        fi
    else
        add_json "app_found" "false"
        add_json "status" "not-running"
        add_json "health" "stopped"
    fi
else
    add_json "pm2_available" "false"
    add_json "app_found" "unknown"
    add_json "status" "unknown"
    add_json "health" "unknown"
fi

# Check systemd status as fallback
if systemctl is-active --quiet "$APP_NAME" 2>/dev/null; then
    SYSTEMD_STATUS=$(systemctl is-active "$APP_NAME" 2>/dev/null || echo "inactive")
    add_json "systemd_status" "$SYSTEMD_STATUS"
fi

# Git information
if [ -d "$PROJECT_DIR/.git" ]; then
    cd "$PROJECT_DIR"
    GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    GIT_COMMIT_SHORT=$(echo "$GIT_COMMIT" | cut -c1-7)
    GIT_COMMIT_DATE=$(git log -1 --format=%cd --date=iso 2>/dev/null || echo "unknown")
    
    add_json "git_commit" "$GIT_COMMIT_SHORT"
    add_json "git_branch" "$GIT_BRANCH"
    add_json "git_commit_date" "$GIT_COMMIT_DATE"
fi

# Disk usage
if [ -d "$PROJECT_DIR" ]; then
    DISK_USAGE=$(du -sh "$PROJECT_DIR" 2>/dev/null | cut -f1 || echo "unknown")
    add_json "disk_usage" "$DISK_USAGE"
fi

# Node.js version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version 2>/dev/null || echo "unknown")
    add_json "node_version" "$NODE_VERSION"
fi

# NPM version
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version 2>/dev/null || echo "unknown")
    add_json "npm_version" "$NPM_VERSION"
fi

# Build information
if [ -f "$PROJECT_DIR/dist/index.js" ]; then
    BUILD_SIZE=$(du -sh "$PROJECT_DIR/dist" 2>/dev/null | cut -f1 || echo "unknown")
    BUILD_DATE=$(stat -c %y "$PROJECT_DIR/dist/index.js" 2>/dev/null || stat -f %Sm "$PROJECT_DIR/dist/index.js" 2>/dev/null || echo "unknown")
    add_json "build_exists" "true"
    add_json "build_size" "$BUILD_SIZE"
    add_json "build_date" "$BUILD_DATE"
else
    add_json "build_exists" "false"
fi

# Get recent logs
LOGS_JSON="[]"

if [ -d "$LOG_DIR" ]; then
    # PM2 error log
    if [ -f "$LOG_DIR/${APP_NAME}-error.log" ]; then
        ERROR_LOGS=$(tail -n "$LOG_LINES" "$LOG_DIR/${APP_NAME}-error.log" 2>/dev/null || echo "")
        if [ -n "$ERROR_LOGS" ]; then
            ERROR_LOGS_JSON=$(echo "$ERROR_LOGS" | jq -R -s -c 'split("\n") | map(select(length > 0))')
            LOGS_JSON=$(echo "$LOGS_JSON" | jq --argjson logs "$ERROR_LOGS_JSON" '. + [{"type": "error", "lines": $logs}]')
        fi
    fi
    
    # PM2 output log
    if [ -f "$LOG_DIR/${APP_NAME}-out.log" ]; then
        OUT_LOGS=$(tail -n "$LOG_LINES" "$LOG_DIR/${APP_NAME}-out.log" 2>/dev/null || echo "")
        if [ -n "$OUT_LOGS" ]; then
            OUT_LOGS_JSON=$(echo "$OUT_LOGS" | jq -R -s -c 'split("\n") | map(select(length > 0))')
            LOGS_JSON=$(echo "$LOGS_JSON" | jq --argjson logs "$OUT_LOGS_JSON" '. + [{"type": "output", "lines": $logs}]')
        fi
    fi
fi

add_json_raw "logs" "$LOGS_JSON"

# System information
HOSTNAME=$(hostname 2>/dev/null || echo "unknown")
add_json "hostname" "$HOSTNAME"

# Load average (if available)
if [ -f /proc/loadavg ]; then
    LOAD_AVG=$(cat /proc/loadavg | cut -d' ' -f1-3)
    add_json "load_average" "$LOAD_AVG"
fi

# Output final JSON
echo "$JSON_OUTPUT" | jq '.'
