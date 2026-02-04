#!/bin/bash
# CareHome Clocking - Backup Script
# Run this via cron: 0 2 * * * /path/to/backup.sh

set -e

BACKUP_DIR="/backups/carehome"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

echo "=== CareHome Backup - $DATE ==="

# Create backup directory
mkdir -p $BACKUP_DIR/$DATE

# Database backup
echo "Backing up database..."
docker-compose exec -T mariadb mysqldump \
    -u root -p"$DB_ROOT_PASSWORD" \
    --all-databases \
    --single-transaction \
    --quick \
    > $BACKUP_DIR/$DATE/database.sql

# Compress database backup
gzip $BACKUP_DIR/$DATE/database.sql

# Files backup (sites folder)
echo "Backing up files..."
docker run --rm \
    -v carehome_sites:/sites:ro \
    -v $BACKUP_DIR/$DATE:/backup \
    alpine tar czf /backup/sites.tar.gz -C /sites .

# Remove old backups
echo "Cleaning up old backups..."
find $BACKUP_DIR -maxdepth 1 -type d -mtime +$RETENTION_DAYS -exec rm -rf {} \;

echo "Backup completed: $BACKUP_DIR/$DATE"

# Optional: Upload to S3 or other storage
# aws s3 sync $BACKUP_DIR s3://your-bucket/backups/carehome/
