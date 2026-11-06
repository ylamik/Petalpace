#!/bin/bash
# Daily database backup — copies accounts.sqlite to a timestamped file.
# Set up as a cron job: sudo crontab -e
# Then add:  0 2 * * * /opt/petalpace/deploy/backup.sh
# That runs every day at 2 AM.

set -e

BACKUP_DIR="/var/backups/petalpace"
DB_FILE="/var/lib/petalpace/accounts.sqlite"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M)
BACKUP_FILE="$BACKUP_DIR/accounts_$TIMESTAMP.sqlite"

mkdir -p "$BACKUP_DIR"

# SQLite online backup — safe even while the app is running
sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"

echo "Backup saved: $BACKUP_FILE"

# Keep only the last 30 backups (delete older ones)
ls -t "$BACKUP_DIR"/accounts_*.sqlite | tail -n +31 | xargs -r rm

echo "Backup complete. $(ls "$BACKUP_DIR" | wc -l) backups kept."
