#!/bin/bash
################################################################################
# SSH Connection Check Script
################################################################################
# This script verifies SSH connectivity to the Infomaniak server
#
# Usage:
#   ./ssh-check.sh [hostname]
#
# Output: JSON with connection status and diagnostics
################################################################################

set -euo pipefail

# Configuration
DEFAULT_HOST="mantodeus-server"
HOST="${1:-$DEFAULT_HOST}"
KEY_PATH="$HOME/.ssh/mantodeus_deploy_key"
TIMEOUT=10

# JSON output
JSON_OUTPUT='{}'

add_json() {
    JSON_OUTPUT=$(echo "$JSON_OUTPUT" | jq --arg k "$1" --arg v "$2" '. + {($k): $v}')
}

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
    echo -e "${GREEN}[INFO]${NC} $*" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" >&2
}

log_info "Checking SSH connection to: $HOST"
add_json "timestamp" "$(date -Iseconds)"
add_json "host" "$HOST"

# Check if SSH key exists
if [ -f "$KEY_PATH" ]; then
    add_json "key_exists" "true"
    add_json "key_path" "$KEY_PATH"
    
    # Get key fingerprint
    KEY_FINGERPRINT=$(ssh-keygen -lf "$KEY_PATH" 2>/dev/null | awk '{print $2}' || echo "unknown")
    add_json "key_fingerprint" "$KEY_FINGERPRINT"
else
    log_warn "SSH key not found at: $KEY_PATH"
    add_json "key_exists" "false"
    add_json "key_path" "$KEY_PATH"
fi

# Check SSH config
if grep -q "Host $HOST" "$HOME/.ssh/config" 2>/dev/null; then
    add_json "ssh_config_exists" "true"
    log_info "SSH config found for $HOST"
else
    log_warn "No SSH config found for $HOST"
    add_json "ssh_config_exists" "false"
fi

# Test connection
log_info "Testing connection (timeout: ${TIMEOUT}s)..."

START_TIME=$(date +%s)

if ssh -o BatchMode=yes \
       -o ConnectTimeout=$TIMEOUT \
       -o StrictHostKeyChecking=no \
       "$HOST" \
       "echo 'Connection successful'" 2>/dev/null; then
    
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    log_info "✅ Connection successful (${DURATION}s)"
    add_json "connection_status" "success"
    add_json "connection_time_seconds" "$DURATION"
    
    # Get server information
    log_info "Gathering server information..."
    
    SERVER_INFO=$(ssh -o BatchMode=yes -o ConnectTimeout=$TIMEOUT "$HOST" bash <<'EOF'
cat <<JSON
{
  "hostname": "$(hostname)",
  "os": "$(uname -s)",
  "kernel": "$(uname -r)",
  "uptime": "$(uptime -p 2>/dev/null || uptime)",
  "user": "$(whoami)",
  "home": "$HOME",
  "shell": "$SHELL"
}
JSON
EOF
)
    
    if [ -n "$SERVER_INFO" ]; then
        JSON_OUTPUT=$(echo "$JSON_OUTPUT" | jq --argjson server "$SERVER_INFO" '. + {server: $server}')
        log_info "Server info retrieved"
    fi
    
    # Check if project directory exists
    PROJECT_DIR="/srv/customer/sites/manager.mantodeus.com"
    if ssh -o BatchMode=yes -o ConnectTimeout=$TIMEOUT "$HOST" "[ -d '$PROJECT_DIR' ]" 2>/dev/null; then
        add_json "project_dir_exists" "true"
        add_json "project_dir" "$PROJECT_DIR"
        log_info "Project directory exists: $PROJECT_DIR"
        
        # Check if infra scripts exist
        if ssh -o BatchMode=yes -o ConnectTimeout=$TIMEOUT "$HOST" "[ -f '$PROJECT_DIR/infra/deploy/deploy.sh' ]" 2>/dev/null; then
            add_json "infra_scripts_exist" "true"
            log_info "Infrastructure scripts found"
        else
            add_json "infra_scripts_exist" "false"
            log_warn "Infrastructure scripts not found"
        fi
    else
        add_json "project_dir_exists" "false"
        log_warn "Project directory not found: $PROJECT_DIR"
    fi
    
else
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    log_error "❌ Connection failed (${DURATION}s)"
    add_json "connection_status" "failed"
    add_json "connection_time_seconds" "$DURATION"
    
    # Diagnostics
    log_info "Running diagnostics..."
    
    # Check if host is reachable
    if ping -c 1 -W 2 "$HOST" &>/dev/null; then
        add_json "host_reachable" "true"
        log_info "Host is reachable via ping"
    else
        add_json "host_reachable" "false"
        log_warn "Host is not reachable via ping"
    fi
    
    # Try verbose SSH for diagnostics
    SSH_DEBUG=$(ssh -v -o BatchMode=yes -o ConnectTimeout=5 "$HOST" "echo test" 2>&1 || true)
    
    if echo "$SSH_DEBUG" | grep -q "Permission denied"; then
        add_json "error_type" "permission_denied"
        log_error "Permission denied - check your SSH key"
    elif echo "$SSH_DEBUG" | grep -q "Connection refused"; then
        add_json "error_type" "connection_refused"
        log_error "Connection refused - check if SSH server is running"
    elif echo "$SSH_DEBUG" | grep -q "Connection timed out"; then
        add_json "error_type" "timeout"
        log_error "Connection timed out - check firewall/network"
    elif echo "$SSH_DEBUG" | grep -q "Host key verification failed"; then
        add_json "error_type" "host_key_failed"
        log_error "Host key verification failed"
    else
        add_json "error_type" "unknown"
        log_error "Unknown connection error"
    fi
fi

# Output JSON
echo "$JSON_OUTPUT" | jq '.'
