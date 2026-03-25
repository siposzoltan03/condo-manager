#!/bin/bash
set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_USER="${POSTGRES_USER:-condo}"
DB_NAME="${POSTGRES_DB:-condo_manager}"

# Resolve container IDs dynamically; fall back to default names if compose is unavailable
DB_CONTAINER="${DB_CONTAINER:-$(docker compose ps -q db 2>/dev/null || echo "condo-manager-db-1")}"
APP_CONTAINER="${APP_CONTAINER:-$(docker compose ps -q app 2>/dev/null || echo "condo-manager-app-1")}"

# Usage check
if [ $# -lt 1 ]; then
    echo "Usage: $0 <timestamp>"
    echo ""
    echo "  <timestamp>  The backup timestamp to restore, e.g. 20240325_120000"
    echo ""
    echo "Available daily backups:"
    ls -1t "$BACKUP_DIR/daily"/db_*.sql.gz 2>/dev/null | sed 's/.*db_//;s/\.sql\.gz//' || echo "  (none found)"
    echo ""
    echo "Available weekly backups:"
    ls -1t "$BACKUP_DIR/weekly"/db_*.sql.gz 2>/dev/null | sed 's/.*db_//;s/\.sql\.gz//' || echo "  (none found)"
    exit 1
fi

TIMESTAMP="$1"

# Locate backup files (check daily first, then weekly)
DB_BACKUP=""
UPLOADS_BACKUP=""

for DIR in "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"; do
    if [ -f "$DIR/db_${TIMESTAMP}.sql.gz" ]; then
        DB_BACKUP="$DIR/db_${TIMESTAMP}.sql.gz"
        UPLOADS_BACKUP="$DIR/uploads_${TIMESTAMP}.tar.gz"
        echo "Found backup in: $DIR"
        break
    fi
done

if [ -z "$DB_BACKUP" ]; then
    echo "Error: No backup found for timestamp '$TIMESTAMP'."
    exit 1
fi

echo "Restoring from timestamp: $TIMESTAMP"

# --- Restore database ---
echo "Restoring database from $DB_BACKUP..."
gunzip -c "$DB_BACKUP" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"
echo "Database restore complete."

# --- Restore uploads ---
if [ -f "$UPLOADS_BACKUP" ]; then
    echo "Restoring uploads from $UPLOADS_BACKUP..."
    docker exec -i "$APP_CONTAINER" tar -xzf - -C / < "$UPLOADS_BACKUP"
    echo "Uploads restore complete."
else
    echo "Warning: No uploads backup found at $UPLOADS_BACKUP — skipping uploads restore."
fi

echo "Restore completed successfully."
