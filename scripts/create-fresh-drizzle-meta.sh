#!/usr/bin/env bash
# Create a fresh _journal.json for PostgreSQL

set -euo pipefail

META_DIR="drizzle/meta"

# Create meta directory if it doesn't exist
mkdir -p "$META_DIR"

# Create a fresh _journal.json with PostgreSQL dialect
cat > "$META_DIR/_journal.json" << 'EOF'
{
  "version": "7",
  "dialect": "postgresql",
  "entries": []
}
EOF

echo "✅ Created fresh _journal.json with PostgreSQL dialect"

