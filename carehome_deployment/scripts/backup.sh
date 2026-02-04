#!/bin/bash
# CareHome Clocking - Backup Script
# Add to cron: 0 2 * * * /path/to/backup.sh

set -e

BACKUP_DIR="${BACKUP_PATH:-/backups}/carehome"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

echo "========================================="
echo "  CareHome Backup - $DATE"
echo "========================================="

# Load environment
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Create backup directory
mkdir -p $BACKUP_DIR/$DATE

# Backup database
echo "[1/3] Backing up database..."
docker-compose exec -T mariadb mysqldump \
    -u root -p"$DB_ROOT_PASSWORD" \
    --all-databases \
    --single-transaction \
    --routines \
    --triggers \
    > $BACKUP_DIR/$DATE/database.sql

gzip $BACKUP_DIR/$DATE/database.sql
echo "Database backup: $BACKUP_DIR/$DATE/database.sql.gz"

# Backup sites folder
echo "[2/3] Backing up sites..."
docker run --rm \
    -v carehome-sites:/sites:ro \
    -v $BACKUP_DIR/$DATE:/backup \
    alpine tar czf /backup/sites.tar.gz -C /sites .
echo "Sites backup: $BACKUP_DIR/$DATE/sites.tar.gz"

# Clean old backups
echo "[3/3] Cleaning old backups (>$RETENTION_DAYS days)..."
find $BACKUP_DIR -maxdepth 1 -type d -mtime +$RETENTION_DAYS -exec rm -rf {} \; 2>/dev/null || true

# Calculate size
BACKUP_SIZE=$(du -sh $BACKUP_DIR/$DATE | cut -f1)

echo ""
echo "========================================="
echo "  Backup Complete!"
echo "========================================="
echo "Location: $BACKUP_DIR/$DATE"
echo "Size: $BACKUP_SIZE"
echo ""

# Optional: Upload to S3
# if [ -n "$AWS_S3_BUCKET" ]; then
#     aws s3 sync $BACKUP_DIR/$DATE s3://$AWS_S3_BUCKET/backups/carehome/$DATE/
# fi
