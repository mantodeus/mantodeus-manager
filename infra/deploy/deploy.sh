#!/bin/bash
################################################################################
# Mantodeus Manager - Main Deployment Script
################################################################################
# This script handles the complete deployment process:
# - Git pull
# - Dependency installation
# - Build
# - PM2/systemd restart
# - Log rotation
# - Health checks
#
# Usage:
#   ./deploy.sh [--dry-run] [--skip-restart] [--force]
#
# Options:
#   --dry-run       Show what would be done without executing
#   --skip-restart  Build but don't restart the service
#   --force         Force deployment even if checks fail
#
# Output: JSON to stdout for programmatic parsing
################################################################################

set -euo pipefail

# Configuration
PROJECT_DIR="${PROJECT_DIR:-/srv/customer/sites/manager.mantodeus.com}"
APP_NAME="mantodeus-manager"
LOG_DIR="${PROJECT_DIR}/logs"
BACKUP_DIR="${PROJECT_DIR}/backups"
MAX_BACKUPS=5

# Colors for terminal output (only when not piping)
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m' # No Color
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    NC=''
fi

# Parse arguments
DRY_RUN=false
SKIP_RESTART=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-restart)
            SKIP_RESTART=true
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

# JSON output structure
JSON_OUTPUT='{}'

# Function to add to JSON output
add_json() {
    local key=$1
    local value=$2
    JSON_OUTPUT=$(echo "$JSON_OUTPUT" | jq --arg k "$key" --arg v "$value" '. + {($k): $v}')
}

# Function to log with timestamp
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${BLUE}[${timestamp}]${NC} ${level}: ${message}" >&2
}

log_info() {
    log "${GREEN}INFO${NC}" "$@"
}

log_warn() {
    log "${YELLOW}WARN${NC}" "$@"
}

log_error() {
    log "${RED}ERROR${NC}" "$@"
}

# Function to check if running as root
check_not_root() {
    if [ "$(id -u)" -eq 0 ]; then
        log_error "This script should NOT be run as root for security reasons"
        add_json "status" "error"
        add_json "error" "Running as root is not allowed"
        echo "$JSON_OUTPUT"
        exit 1
    fi
}

# Function to create backup
create_backup() {
    log_info "Creating backup..."
    
    mkdir -p "$BACKUP_DIR"
    
    local backup_name="backup-$(date '+%Y%m%d-%H%M%S').tar.gz"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would create backup: $backup_path"
        add_json "backup" "dry-run"
        return 0
    fi
    
    # Backup current dist and node_modules
    tar -czf "$backup_path" \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='logs' \
        --exclude='backups' \
        -C "$PROJECT_DIR" \
        . 2>/dev/null || true
    
    if [ -f "$backup_path" ]; then
        log_info "Backup created: $backup_path"
        add_json "backup" "$backup_path"
        
        # Clean old backups
        local backup_count=$(ls -1 "$BACKUP_DIR"/backup-*.tar.gz 2>/dev/null | wc -l)
        if [ "$backup_count" -gt "$MAX_BACKUPS" ]; then
            log_info "Cleaning old backups (keeping last $MAX_BACKUPS)..."
            ls -1t "$BACKUP_DIR"/backup-*.tar.gz | tail -n +$((MAX_BACKUPS + 1)) | xargs rm -f
        fi
    else
        log_warn "Backup creation failed (non-fatal)"
        add_json "backup" "failed"
    fi
}

# Function to pull latest code
git_pull() {
    log_info "Pulling latest code from GitHub..."
    
    cd "$PROJECT_DIR"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would run: git pull origin main"
        add_json "git_pull" "dry-run"
        return 0
    fi
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        log_warn "Uncommitted changes detected"
        if [ "$FORCE" = false ]; then
            log_error "Use --force to deploy with uncommitted changes"
            add_json "status" "error"
            add_json "error" "Uncommitted changes detected"
            echo "$JSON_OUTPUT"
            exit 1
        fi
    fi
    
    local before_commit=$(git rev-parse HEAD)
    git pull origin main
    local after_commit=$(git rev-parse HEAD)
    
    add_json "git_before" "$before_commit"
    add_json "git_after" "$after_commit"
    
    if [ "$before_commit" = "$after_commit" ]; then
        log_info "Already up to date"
        add_json "git_pull" "no-changes"
    else
        log_info "Updated from $before_commit to $after_commit"
        add_json "git_pull" "success"
    fi
}

# Function to install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    cd "$PROJECT_DIR"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would run: npm install --include=dev"
        add_json "npm_install" "dry-run"
        return 0
    fi
    
    npm install --include=dev --loglevel=error
    
    log_info "Dependencies installed"
    add_json "npm_install" "success"
}

# Function to build application
build_app() {
    log_info "Building application..."
    
    cd "$PROJECT_DIR"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would run: npm run build"
        add_json "build" "dry-run"
        return 0
    fi
    
    npm run build
    
    # Verify build output
    if [ ! -f "$PROJECT_DIR/dist/index.js" ]; then
        log_error "Build failed: dist/index.js not found"
        add_json "status" "error"
        add_json "error" "Build output missing"
        echo "$JSON_OUTPUT"
        exit 1
    fi
    
    local build_size=$(du -sh "$PROJECT_DIR/dist" | cut -f1)
    log_info "Build complete: $build_size"
    add_json "build" "success"
    add_json "build_size" "$build_size"
}

# Function to rotate logs
rotate_logs() {
    log_info "Rotating logs..."
    
    mkdir -p "$LOG_DIR"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would rotate logs in $LOG_DIR"
        add_json "log_rotation" "dry-run"
        return 0
    fi
    
    # Rotate PM2 logs if they exist
    for logfile in "$LOG_DIR"/*.log; do
        if [ -f "$logfile" ] && [ $(stat -f%z "$logfile" 2>/dev/null || stat -c%s "$logfile" 2>/dev/null) -gt 10485760 ]; then
            local rotated="${logfile}.$(date '+%Y%m%d')"
            mv "$logfile" "$rotated"
            gzip "$rotated" 2>/dev/null || true
            log_info "Rotated: $(basename "$logfile")"
        fi
    done
    
    # Clean logs older than 30 days
    find "$LOG_DIR" -name "*.log.*.gz" -mtime +30 -delete 2>/dev/null || true
    
    add_json "log_rotation" "success"
}

# Function to restart service
restart_service() {
    if [ "$SKIP_RESTART" = true ]; then
        log_info "Skipping restart (--skip-restart flag)"
        add_json "restart" "skipped"
        return 0
    fi
    
    log_info "Restarting service..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would restart service"
        add_json "restart" "dry-run"
        return 0
    fi
    
    # Try PM2 first
    if command -v pm2 &> /dev/null; then
        log_info "Using PM2 to restart..."
        pm2 restart "$APP_NAME" --update-env || pm2 start ecosystem.config.js
        add_json "restart_method" "pm2"
        add_json "restart" "success"
    # Try systemd
    elif systemctl is-active --quiet "$APP_NAME" 2>/dev/null; then
        log_info "Using systemd to restart..."
        systemctl restart "$APP_NAME"
        add_json "restart_method" "systemd"
        add_json "restart" "success"
    else
        log_warn "No process manager detected (PM2 or systemd)"
        log_warn "Please restart manually or configure PM2/systemd"
        add_json "restart" "manual-required"
    fi
}

# Function to check health
check_health() {
    log_info "Checking application health..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would check health"
        add_json "health" "dry-run"
        return 0
    fi
    
    sleep 3  # Give app time to start
    
    # Check if process is running
    if command -v pm2 &> /dev/null; then
        if pm2 describe "$APP_NAME" &> /dev/null; then
            local status=$(pm2 jlist | jq -r ".[] | select(.name==\"$APP_NAME\") | .pm2_env.status")
            if [ "$status" = "online" ]; then
                log_info "Application is running (PM2)"
                add_json "health" "healthy"
                add_json "health_status" "online"
            else
                log_warn "Application status: $status"
                add_json "health" "degraded"
                add_json "health_status" "$status"
            fi
        else
            log_warn "Application not found in PM2"
            add_json "health" "unknown"
        fi
    else
        log_info "Health check skipped (PM2 not available)"
        add_json "health" "unknown"
    fi
}

# Main deployment flow
main() {
    local start_time=$(date +%s)
    
    log_info "========================================="
    log_info "Mantodeus Manager Deployment"
    log_info "========================================="
    
    if [ "$DRY_RUN" = true ]; then
        log_warn "DRY RUN MODE - No changes will be made"
    fi
    
    add_json "status" "running"
    add_json "timestamp" "$(date -Iseconds)"
    add_json "project_dir" "$PROJECT_DIR"
    add_json "dry_run" "$DRY_RUN"
    
    # Safety checks
    check_not_root
    
    # Deployment steps
    create_backup
    git_pull
    install_dependencies
    build_app
    rotate_logs
    restart_service
    check_health
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    add_json "status" "success"
    add_json "duration_seconds" "$duration"
    
    log_info "========================================="
    log_info "Deployment completed in ${duration}s"
    log_info "========================================="
    
    # Output JSON
    echo "$JSON_OUTPUT" | jq '.'
}

# Run main function
main "$@"
