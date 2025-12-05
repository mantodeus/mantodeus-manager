#!/bin/bash
################################################################################
# Environment Variable Update Script
################################################################################
# This script safely updates environment variables on the server
#
# Usage:
#   ./env-update.sh <VAR_NAME> <VALUE>
#   ./env-update.sh --file <env-file>
#
# Examples:
#   ./env-update.sh DATABASE_URL "mysql://user:pass@host/db"
#   ./env-update.sh --file new-env-vars.txt
#
# Security:
#   - Never echoes secret values
#   - Creates backup before modification
#   - Validates variable names
################################################################################

set -euo pipefail

# Configuration
PROJECT_DIR="${PROJECT_DIR:-/srv/customer/sites/manager.mantodeus.com}"
ENV_FILE="$PROJECT_DIR/.env"
BACKUP_DIR="$PROJECT_DIR/backups"

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

log_info() {
    echo -e "${GREEN}[INFO]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

# Validate variable name (only uppercase letters, numbers, and underscores)
validate_var_name() {
    local var_name="$1"
    if [[ ! "$var_name" =~ ^[A-Z_][A-Z0-9_]*$ ]]; then
        log_error "Invalid variable name: $var_name"
        log_error "Variable names must start with A-Z or _ and contain only A-Z, 0-9, and _"
        return 1
    fi
    return 0
}

# Create backup
create_backup() {
    mkdir -p "$BACKUP_DIR"
    local backup_file="$BACKUP_DIR/.env.backup.$(date +%Y%m%d-%H%M%S)"
    cp "$ENV_FILE" "$backup_file"
    log_info "Backup created: $backup_file"
}

# Update single variable
update_variable() {
    local var_name="$1"
    local var_value="$2"
    
    # Validate variable name
    if ! validate_var_name "$var_name"; then
        return 1
    fi
    
    # Create backup
    create_backup
    
    # Check if variable exists
    if grep -q "^${var_name}=" "$ENV_FILE"; then
        # Update existing variable
        # Use sed with proper escaping
        local escaped_value=$(echo "$var_value" | sed 's/[\/&]/\\&/g')
        sed -i.tmp "s/^${var_name}=.*/${var_name}=${escaped_value}/" "$ENV_FILE"
        rm -f "${ENV_FILE}.tmp"
        log_info "✅ Updated: $var_name"
    else
        # Add new variable
        echo "${var_name}=${var_value}" >> "$ENV_FILE"
        log_info "✅ Added: $var_name"
    fi
    
    # Never echo the actual value for security
    log_info "Variable updated successfully (value not shown for security)"
}

# Update from file
update_from_file() {
    local file="$1"
    
    if [ ! -f "$file" ]; then
        log_error "File not found: $file"
        return 1
    fi
    
    log_info "Updating variables from file: $file"
    
    # Create backup once
    create_backup
    
    local count=0
    while IFS='=' read -r var_name var_value; do
        # Skip comments and empty lines
        [[ "$var_name" =~ ^#.*$ ]] && continue
        [[ -z "$var_name" ]] && continue
        
        # Validate and update
        if validate_var_name "$var_name"; then
            if grep -q "^${var_name}=" "$ENV_FILE"; then
                local escaped_value=$(echo "$var_value" | sed 's/[\/&]/\\&/g')
                sed -i.tmp "s/^${var_name}=.*/${var_name}=${escaped_value}/" "$ENV_FILE"
                rm -f "${ENV_FILE}.tmp"
            else
                echo "${var_name}=${var_value}" >> "$ENV_FILE"
            fi
            log_info "✅ Updated: $var_name"
            ((count++))
        fi
    done < "$file"
    
    log_info "Updated $count variables from file"
}

# Main
main() {
    if [ $# -eq 0 ]; then
        log_error "Usage: $0 <VAR_NAME> <VALUE>"
        log_error "   or: $0 --file <env-file>"
        exit 1
    fi
    
    # Check if .env exists
    if [ ! -f "$ENV_FILE" ]; then
        log_error ".env file not found at: $ENV_FILE"
        exit 1
    fi
    
    # Parse arguments
    if [ "$1" = "--file" ]; then
        if [ $# -ne 2 ]; then
            log_error "Usage: $0 --file <env-file>"
            exit 1
        fi
        update_from_file "$2"
    else
        if [ $# -ne 2 ]; then
            log_error "Usage: $0 <VAR_NAME> <VALUE>"
            exit 1
        fi
        update_variable "$1" "$2"
    fi
    
    log_info "Environment update complete"
    log_warn "Restart the application to apply changes:"
    log_warn "  cd $PROJECT_DIR && ./infra/deploy/restart.sh"
}

main "$@"
