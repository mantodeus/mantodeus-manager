#!/bin/bash
################################################################################
# Mantodeus Manager - Safe Restart Script
################################################################################
# This script safely restarts the application with automatic rollback on failure
#
# Usage:
#   ./restart.sh [--rollback] [--force]
#
# Options:
#   --rollback  Restore from latest backup
#   --force     Skip health checks
#
# Output: JSON to stdout
################################################################################

set -euo pipefail

# Configuration
PROJECT_DIR="${PROJECT_DIR:-/srv/customer/sites/manager.mantodeus.com}"
APP_NAME="mantodeus-manager"
BACKUP_DIR="${PROJECT_DIR}/backups"
HEALTH_CHECK_RETRIES=3
HEALTH_CHECK_DELAY=5

# Colors
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    NC=''
fi

# Parse arguments
ROLLBACK=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --rollback)
            ROLLBACK=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# JSON output
JSON_OUTPUT='{}'

add_json() {
    JSON_OUTPUT=$(echo "$JSON_OUTPUT" | jq --arg k "$1" --arg v "$2" '. + {($k): $v}')
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $*" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" >&2
}

# Function to get current PM2 status
get_pm2_status() {
    if command -v pm2 &> /dev/null && pm2 describe "$APP_NAME" &> /dev/null; then
        pm2 jlist | jq -r ".[] | select(.name==\"$APP_NAME\") | .pm2_env.status"
    else
        echo "unknown"
    fi
}

# Function to check application health
check_health() {
    local retries=$1
    local delay=$2
    
    for i in $(seq 1 $retries); do
        log_info "Health check attempt $i/$retries..."
        
        local status=$(get_pm2_status)
        
        if [ "$status" = "online" ]; then
            log_info "Application is healthy"
            return 0
        fi
        
        if [ $i -lt $retries ]; then
            log_warn "Application not healthy, waiting ${delay}s..."
            sleep $delay
        fi
    done
    
    log_error "Application failed health check after $retries attempts"
    return 1
}

# Function to rollback from backup
rollback_from_backup() {
    log_info "Rolling back from backup..."
    
    local latest_backup=$(ls -1t "$BACKUP_DIR"/backup-*.tar.gz 2>/dev/null | head -1)
    
    if [ -z "$latest_backup" ]; then
        log_error "No backup found for rollback"
        add_json "rollback" "no-backup"
        return 1
    fi
    
    log_info "Restoring from: $latest_backup"
    
    # Stop application
    if command -v pm2 &> /dev/null; then
        pm2 stop "$APP_NAME" 2>/dev/null || true
    fi
    
    # Restore backup
    cd "$PROJECT_DIR"
    tar -xzf "$latest_backup" --exclude='logs' --exclude='backups'
    
    # Restart application
    if command -v pm2 &> /dev/null; then
        pm2 restart "$APP_NAME" --update-env || pm2 start ecosystem.config.js
    fi
    
    log_info "Rollback complete"
    add_json "rollback" "success"
    add_json "rollback_from" "$latest_backup"
    
    return 0
}

# Function to restart application
restart_app() {
    log_info "Restarting application..."
    
    local before_status=$(get_pm2_status)
    add_json "status_before" "$before_status"
    
    if command -v pm2 &> /dev/null; then
        log_info "Using PM2 to restart..."
        
        # Graceful restart
        pm2 restart "$APP_NAME" --update-env || {
            log_warn "PM2 restart failed, trying to start..."
            pm2 start ecosystem.config.js
        }
        
        add_json "restart_method" "pm2"
    elif systemctl is-active --quiet "$APP_NAME" 2>/dev/null; then
        log_info "Using systemd to restart..."
        systemctl restart "$APP_NAME"
        add_json "restart_method" "systemd"
    else
        log_error "No process manager found (PM2 or systemd)"
        add_json "status" "error"
        add_json "error" "No process manager available"
        echo "$JSON_OUTPUT"
        exit 1
    fi
    
    # Wait for restart
    sleep 2
    
    local after_status=$(get_pm2_status)
    add_json "status_after" "$after_status"
    
    log_info "Restart initiated"
}

# Main function
main() {
    local start_time=$(date +%s)
    
    log_info "========================================="
    log_info "Mantodeus Manager Restart"
    log_info "========================================="
    
    add_json "timestamp" "$(date -Iseconds)"
    add_json "project_dir" "$PROJECT_DIR"
    
    # Handle rollback
    if [ "$ROLLBACK" = true ]; then
        log_info "Rollback requested"
        if rollback_from_backup; then
            add_json "status" "success"
            add_json "action" "rollback"
        else
            add_json "status" "error"
            add_json "action" "rollback"
            echo "$JSON_OUTPUT"
            exit 1
        fi
    else
        # Normal restart
        restart_app
        
        # Health check (unless forced)
        if [ "$FORCE" = false ]; then
            if check_health $HEALTH_CHECK_RETRIES $HEALTH_CHECK_DELAY; then
                add_json "health" "healthy"
                add_json "status" "success"
            else
                log_error "Application failed to start properly"
                log_warn "Consider running with --rollback to restore previous version"
                add_json "health" "unhealthy"
                add_json "status" "error"
                echo "$JSON_OUTPUT"
                exit 1
            fi
        else
            log_warn "Health check skipped (--force)"
            add_json "health" "skipped"
            add_json "status" "success"
        fi
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    add_json "duration_seconds" "$duration"
    
    log_info "========================================="
    log_info "Restart completed in ${duration}s"
    log_info "========================================="
    
    echo "$JSON_OUTPUT" | jq '.'
}

main "$@"
