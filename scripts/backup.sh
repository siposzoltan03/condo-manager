#!/bin/bash
set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DAILY_DIR="$BACKUP_DIR/daily"
WEEKLY_DIR="$BACKUP_DIR/weekly"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_CONTAINER="${DB_CONTAINER:-condo-manager-db-1}"
APP_CONTAINER="${APP_CONTAINER:-condo-manager-app-1}"
DB_USER="${POSTGRES_USER:-condo}"
DB_NAME="${POSTGRES_DB:-condo_manager}"
DAILY_RETENTION=7
WEEKLY_RETENTION=4

# Create backup directories
mkdir -p "$DAILY_DIR" "$WEEKLY_DIR"

echo "Starting backup at $TIMESTAMP..."

# --- Database backup ---
DB_BACKUP="$DAILY_DIR/db_${TIMESTAMP}.sql.gz"
echo "Backing up database to $DB_BACKUP..."
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$DB_BACKUP"
echo "Database backup complete: $DB_BACKUP"

# --- Uploads backup ---
UPLOADS_BACKUP="$DAILY_DIR/uploads_${TIMESTAMP}.tar.gz"
echo "Backing up uploads volume to $UPLOADS_BACKUP..."
docker exec "$APP_CONTAINER" tar -czf - /app/uploads > "$UPLOADS_BACKUP"
echo "Uploads backup complete: $UPLOADS_BACKUP"

# --- Weekly retention: copy Sunday's backup to weekly ---
DAY_OF_WEEK=$(date +"%u")  # 7 = Sunday
if [ "$DAY_OF_WEEK" -eq 7 ]; then
    echo "Sunday detected — copying daily backup to weekly..."
    cp "$DB_BACKUP" "$WEEKLY_DIR/db_${TIMESTAMP}.sql.gz"
    cp "$UPLOADS_BACKUP" "$WEEKLY_DIR/uploads_${TIMESTAMP}.tar.gz"
    echo "Weekly backup saved."
fi

# --- Prune old daily backups (keep last 7) ---
echo "Pruning daily backups (keeping last $DAILY_RETENTION)..."
ls -1t "$DAILY_DIR"/db_*.sql.gz 2>/dev/null | tail -n +$((DAILY_RETENTION + 1)) | xargs -r rm --
ls -1t "$DAILY_DIR"/uploads_*.tar.gz 2>/dev/null | tail -n +$((DAILY_RETENTION + 1)) | xargs -r rm --

# --- Prune old weekly backups (keep last 4) ---
echo "Pruning weekly backups (keeping last $WEEKLY_RETENTION)..."
ls -1t "$WEEKLY_DIR"/db_*.sql.gz 2>/dev/null | tail -n +$((WEEKLY_RETENTION + 1)) | xargs -r rm --
ls -1t "$WEEKLY_DIR"/uploads_*.tar.gz 2>/dev/null | tail -n +$((WEEKLY_RETENTION + 1)) | xargs -r rm --

echo "Backup completed successfully at $(date +"%Y%m%d_%H%M%S")."
