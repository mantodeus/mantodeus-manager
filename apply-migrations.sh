#!/bin/bash
# Apply all pending Drizzle SQL migrations in order.
# Tracks applied files in schema_migrations to avoid reapplying.

set -euo pipefail

echo "Applying pending migrations"
echo "==========================="

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL not set in environment"
  echo "Loading from .env file..."
  if [ -f ".env" ]; then
    export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
  else
    echo ".env file not found"
    exit 1
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL still not set. Please check your .env file"
  exit 1
fi

proto_removed="${DATABASE_URL#*://}"
creds_and_host="${proto_removed%%/*}"
db_and_params="${proto_removed#*/}"
db_name="${db_and_params%%\?*}"

userpass="${creds_and_host%@*}"
hostport="${creds_and_host#*@}"

DB_USER="${userpass%%:*}"
DB_PASS="${userpass#*:}"
DB_HOST="${hostport%%:*}"
DB_PORT="${hostport#*:}"

MYSQL_BASE=(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$db_name")
if [ "$DB_PORT" != "$hostport" ] && [ -n "$DB_PORT" ]; then
  MYSQL_BASE=(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$db_name")
fi

echo "Database: $db_name @ $DB_HOST"
echo "User: $DB_USER"
echo ""

"${MYSQL_BASE[@]}" <<'EOF'
CREATE TABLE IF NOT EXISTS schema_migrations (
  id VARCHAR(255) PRIMARY KEY,
  appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
EOF

shopt -s nullglob
MIGRATIONS=(drizzle/[0-9]*.sql)
if [ ${#MIGRATIONS[@]} -eq 0 ]; then
  echo "No migration files found."
  exit 0
fi

for file in "${MIGRATIONS[@]}"; do
  id="$(basename "$file")"
  applied=$("${MYSQL_BASE[@]}" -N -s -e "SELECT 1 FROM schema_migrations WHERE id='${id}' LIMIT 1;")
  if [ -n "$applied" ]; then
    echo "Skipping ${id} (already applied)"
    continue
  fi

  echo "Applying ${id}..."
  "${MYSQL_BASE[@]}" < "$file"
  "${MYSQL_BASE[@]}" -e "INSERT INTO schema_migrations (id) VALUES ('${id}');"
  echo "Applied ${id}"
done

echo ""
echo "All migrations applied."
