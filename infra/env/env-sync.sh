#!/bin/bash
################################################################################
# Environment Variables Sync Script
################################################################################
# This script syncs environment variables between .env.example and .env
# and validates that all required variables are set
#
# Usage:
#   ./env-sync.sh [--check-only] [--update-example]
#
# Options:
#   --check-only      Only check, don't modify files
#   --update-example  Update .env.example with variables from .env
################################################################################

set -euo pipefail

# Configuration
PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
ENV_FILE="$PROJECT_DIR/.env"
ENV_EXAMPLE="$PROJECT_DIR/.env.example"

# Colors
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    NC=''
fi

# Parse arguments
CHECK_ONLY=false
UPDATE_EXAMPLE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --check-only)
            CHECK_ONLY=true
            shift
            ;;
        --update-example)
            UPDATE_EXAMPLE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

log_info() {
    echo -e "${GREEN}[INFO]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $*"
}

# Check if files exist
if [ ! -f "$ENV_EXAMPLE" ]; then
    log_error ".env.example not found at: $ENV_EXAMPLE"
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    log_warn ".env not found, creating from .env.example..."
    if [ "$CHECK_ONLY" = false ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        log_info "Created .env from .env.example"
        log_warn "Please update .env with your actual values"
    fi
    exit 0
fi

# Extract variable names from .env.example (excluding comments and empty lines)
EXAMPLE_VARS=$(grep -E '^[A-Z_]+=.*' "$ENV_EXAMPLE" | cut -d'=' -f1 | sort)

# Extract variable names from .env
ENV_VARS=$(grep -E '^[A-Z_]+=.*' "$ENV_FILE" | cut -d'=' -f1 | sort)

# Find missing variables in .env
MISSING_IN_ENV=()
while IFS= read -r var; do
    if ! echo "$ENV_VARS" | grep -q "^${var}$"; then
        MISSING_IN_ENV+=("$var")
    fi
done <<< "$EXAMPLE_VARS"

# Find extra variables in .env (not in example)
EXTRA_IN_ENV=()
while IFS= read -r var; do
    if ! echo "$EXAMPLE_VARS" | grep -q "^${var}$"; then
        EXTRA_IN_ENV+=("$var")
    fi
done <<< "$ENV_VARS"

# Report findings
log_step "Environment Variable Sync Check"
echo ""

if [ ${#MISSING_IN_ENV[@]} -eq 0 ] && [ ${#EXTRA_IN_ENV[@]} -eq 0 ]; then
    log_info "✅ All environment variables are in sync"
    exit 0
fi

# Missing variables
if [ ${#MISSING_IN_ENV[@]} -gt 0 ]; then
    log_warn "Missing variables in .env (${#MISSING_IN_ENV[@]}):"
    for var in "${MISSING_IN_ENV[@]}"; do
        # Get the example value
        EXAMPLE_VALUE=$(grep "^${var}=" "$ENV_EXAMPLE" | cut -d'=' -f2-)
        echo "  - $var=$EXAMPLE_VALUE"
    done
    echo ""
    
    if [ "$CHECK_ONLY" = false ]; then
        log_info "Adding missing variables to .env..."
        for var in "${MISSING_IN_ENV[@]}"; do
            EXAMPLE_LINE=$(grep "^${var}=" "$ENV_EXAMPLE")
            echo "$EXAMPLE_LINE" >> "$ENV_FILE"
            log_info "Added: $var"
        done
        log_info "✅ Missing variables added to .env"
        log_warn "Please update the values in .env"
    fi
fi

# Extra variables
if [ ${#EXTRA_IN_ENV[@]} -gt 0 ]; then
    log_warn "Extra variables in .env not in .env.example (${#EXTRA_IN_ENV[@]}):"
    for var in "${EXTRA_IN_ENV[@]}"; do
        echo "  - $var"
    done
    echo ""
    
    if [ "$UPDATE_EXAMPLE" = true ] && [ "$CHECK_ONLY" = false ]; then
        log_info "Adding extra variables to .env.example..."
        for var in "${EXTRA_IN_ENV[@]}"; do
            # Get the line from .env but replace value with placeholder
            ENV_LINE=$(grep "^${var}=" "$ENV_FILE")
            VAR_NAME=$(echo "$ENV_LINE" | cut -d'=' -f1)
            # Add with placeholder value
            echo "${VAR_NAME}=your_${VAR_NAME,,}_here" >> "$ENV_EXAMPLE"
            log_info "Added to .env.example: $VAR_NAME"
        done
        log_info "✅ Extra variables added to .env.example"
    fi
fi

# Check for empty required variables
log_step "Checking for empty required variables"
echo ""

REQUIRED_VARS=(
    "DATABASE_URL"
    "JWT_SECRET"
    "VITE_SUPABASE_URL"
    "VITE_SUPABASE_ANON_KEY"
)

EMPTY_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    VALUE=$(grep "^${var}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- || echo "")
    if [ -z "$VALUE" ] || [[ "$VALUE" =~ ^(your_|<<|TODO|CHANGE) ]]; then
        EMPTY_VARS+=("$var")
    fi
done

if [ ${#EMPTY_VARS[@]} -gt 0 ]; then
    log_error "❌ Required variables are not set properly:"
    for var in "${EMPTY_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    log_error "Please update these variables in .env before deploying"
    exit 1
else
    log_info "✅ All required variables are set"
fi

echo ""
log_info "Environment sync check complete"
