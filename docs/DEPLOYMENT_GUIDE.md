# CareHome Clocking - Deployment Guide

## Overview

This guide covers deploying the CareHome Clocking system with:
- Frappe Framework + HRMS (backend)
- Custom carehome_clocking app
- Kiosk UI (web page)
- Mobile Authenticator (React Native app)

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Nginx       │─────│   Frappe      │
│   (TLS)       │     │   Backend     │
└─────────────────┘     └───────┬─────────┘
                              │
        ┌─────────────────────┼───────────────────┐
        │                     │                   │
┌───────┴───────┐  ┌───────┴───────┐  ┌─────┴──────────┐
│   MariaDB     │  │   Redis       │  │   Workers     │
│               │  │   (Cache/Q)   │  │   (Short/Long)│
└───────────────┘  └───────────────┘  └────────────────┘
```

## Prerequisites

- Linux server (Ubuntu 22.04 recommended)
- Docker 24+ and Docker Compose v2
- Domain name with DNS configured
- SSL certificate (Let's Encrypt recommended)

## Quick Start (Development)

```bash
cd /app/frappe_docker

# Copy and configure environment
cp .env.example .env
nano .env  # Edit with your values

# Start services
docker compose up -d

# Wait for services to initialize
sleep 30

# Create site
docker compose exec backend bench new-site carehome.local \
    --db-host mariadb \
    --admin-password admin123

# Install apps
docker compose exec backend bench --site carehome.local install-app erpnext
docker compose exec backend bench --site carehome.local install-app hrms
docker compose exec backend bench --site carehome.local install-app carehome_clocking

# Access at http://localhost:8000
```

## Production Deployment

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin

# Create directory
mkdir -p /opt/carehome
cd /opt/carehome
```

### 2. Configure Environment

```bash
# Create .env file
cat > .env << 'EOF'
DB_ROOT_PASSWORD=<strong-password>
DB_NAME=carehome
DB_USER=frappe
DB_PASSWORD=<strong-password>
FRAPPE_SITE_NAME=carehome.example.com
ADMIN_PASSWORD=<strong-admin-password>
ENCRYPTION_KEY=<32-byte-base64-key>
DOMAIN=carehome.example.com
LETSENCRYPT_EMAIL=admin@example.com
EOF

# Generate encryption key
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 3. SSL Certificate Setup

```bash
# Create certbot directories
mkdir -p certbot/www certbot/conf

# Get initial certificate (staging first)
docker run --rm \
    -v $(pwd)/certbot/www:/var/www/certbot \
    -v $(pwd)/certbot/conf:/etc/letsencrypt \
    certbot/certbot certonly \
    --webroot -w /var/www/certbot \
    --email $LETSENCRYPT_EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

# Enable HTTPS in nginx.conf (uncomment the HTTPS server block)
```

### 4. Production docker-compose.yml Updates

```yaml
# Add to docker-compose.yml for production:

services:
  nginx:
    restart: always
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certbot/www:/var/www/certbot:ro
      - ./certbot/conf:/etc/letsencrypt:ro

  # Add certbot for auto-renewal
  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/www:/var/www/certbot
      - ./certbot/conf:/etc/letsencrypt
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
```

### 5. Deploy

```bash
# Pull images
docker compose pull

# Start
docker compose up -d

# Check logs
docker compose logs -f

# Create and setup site
docker compose exec backend bench new-site $FRAPPE_SITE_NAME \
    --db-host mariadb \
    --admin-password $ADMIN_PASSWORD

# Install apps
docker compose exec backend bench --site $FRAPPE_SITE_NAME install-app erpnext
docker compose exec backend bench --site $FRAPPE_SITE_NAME install-app hrms
docker compose exec backend bench --site $FRAPPE_SITE_NAME install-app carehome_clocking

# Enable scheduler
docker compose exec backend bench --site $FRAPPE_SITE_NAME enable-scheduler

# Set site as default
docker compose exec backend bench use $FRAPPE_SITE_NAME
```

## Initial Configuration

### 1. Login and Setup Admin

1. Navigate to `https://carehome.example.com`
2. Login: `Administrator` / `$ADMIN_PASSWORD`
3. Complete setup wizard

### 2. Configure HRMS

```
1. Setup > Company
   - Create "Sunrise Care Home" (or your company name)

2. HR > Settings > HR Settings
   - Enable attendance auto-capture

3. HR > Shift Type
   - Create shifts (e.g., "Day Shift", "Night Shift")

4. HR > Holiday List
   - Create holiday list for your region

5. HR > Leave Type
   - Verify default leave types or create custom ones
```

### 3. Configure CareHome Clocking

```
1. CareHome Clocking > Care Home
   - Create "Sunrise Care Home"
   - Link to Company
   - Set timezone

2. CareHome Clocking > Kiosk Device
   - Create device for each kiosk
   - Set PIN (note it for kiosk setup)
   - Link to Care Home
```

### 4. Create Test Employee

```
1. HR > Employee > New
   - Create employee record
   - Link to Company and User

2. CareHome Clocking > Staff Enrollment
   - Click "Enroll Phone QR" for the employee
   - Scan with mobile app
```

## Kiosk Setup (Android Tablet)

### 1. Hardware

- Android tablet (10-13 inch recommended)
- Wall mount with charging
- Optional: USB camera for better scanning

### 2. Kiosk Mode Setup

```bash
# Using Android Enterprise / MDM:
1. Enroll device in your MDM
2. Set as dedicated device (kiosk mode)
3. Configure Chrome as kiosk browser
4. Lock to: https://carehome.example.com/kiosk

# Alternative: Use kiosk launcher app:
1. Install "Fully Kiosk Browser" or similar
2. Configure URL: https://carehome.example.com/kiosk
3. Enable kiosk mode features
```

### 3. Configure Kiosk

1. Open kiosk URL
2. Enter Device ID (e.g., KIOSK-00001)
3. Enter PIN from admin setup
4. Device enters scanner mode

## Mobile App Deployment

### Android

```bash
cd /app/mobile_app

# Build release APK
cd android
./gradlew assembleRelease

# APK location: android/app/build/outputs/apk/release/
```

Distribution options:
- Internal testing: Upload to Google Play internal track
- Direct: Distribute APK via company portal
- MDM: Push via mobile device management

### iOS

1. Open `ios/CareHomeAuthenticator.xcworkspace` in Xcode
2. Configure signing with your Apple Developer account
3. Archive and upload to App Store Connect
4. Distribute via TestFlight or App Store

## Multi-Tenant Setup (Adding More Care Homes)

### Option A: Multiple Companies in Same Site

```
1. Setup > Company > New
   - Create new company for each care home

2. CareHome Clocking > Care Home > New
   - Create care home linked to new company

3. Create employees under each company
4. Create kiosk devices linked to each care home
```

### Option B: Separate Sites (Isolated Data)

```bash
# Create new site
docker compose exec backend bench new-site sunrise2.example.com \
    --db-host mariadb \
    --admin-password $ADMIN_PASSWORD

# Install apps
docker compose exec backend bench --site sunrise2.example.com install-app erpnext
docker compose exec backend bench --site sunrise2.example.com install-app hrms
docker compose exec backend bench --site sunrise2.example.com install-app carehome_clocking

# Add to sites/currentsite.txt or use site-specific URLs
```

## Backup and Recovery

### Automated Backups

```bash
# Create backup script
cat > /opt/carehome/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=/backups/carehome
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR/$DATE

# Database
docker compose exec -T mariadb mysqldump -u root -p$DB_ROOT_PASSWORD --all-databases > $BACKUP_DIR/$DATE/db.sql
gzip $BACKUP_DIR/$DATE/db.sql

# Files
tar czf $BACKUP_DIR/$DATE/sites.tar.gz -C /opt/carehome sites

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -maxdepth 1 -type d -mtime +30 -exec rm -rf {} \;
EOF

chmod +x /opt/carehome/backup.sh

# Add to cron
echo "0 2 * * * /opt/carehome/backup.sh" | crontab -
```

### Restore

```bash
# Stop services
docker compose down

# Restore database
gunzip backup/db.sql.gz
docker compose up -d mariadb
docker compose exec -T mariadb mysql -u root -p$DB_ROOT_PASSWORD < backup/db.sql

# Restore files
tar xzf backup/sites.tar.gz -C /opt/carehome

# Start all services
docker compose up -d
```

## Monitoring

### Health Checks

```bash
# Check all containers
docker compose ps

# Check logs
docker compose logs -f --tail=100

# Check specific service
docker compose logs backend
```

### Recommended Monitoring Stack

```yaml
# Add to docker-compose.yml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    volumes:
      - grafana-data:/var/lib/grafana
```

## Upgrade Process

```bash
cd /opt/carehome

# Backup first!
./backup.sh

# Pull latest images
docker compose pull

# Stop and restart
docker compose down
docker compose up -d

# Run migrations
docker compose exec backend bench --site $FRAPPE_SITE_NAME migrate

# Clear cache
docker compose exec backend bench --site $FRAPPE_SITE_NAME clear-cache
```

## Troubleshooting

### Common Issues

**Site not accessible:**
```bash
# Check nginx
docker compose logs nginx

# Verify site config
docker compose exec backend cat sites/currentsite.txt
```

**Database connection errors:**
```bash
# Check MariaDB
docker compose logs mariadb

# Test connection
docker compose exec backend bench mariadb
```

**Kiosk not validating QR:**
- Check device time sync
- Verify employee is enrolled
- Check server logs for validation errors

**Offline sync issues:**
```bash
# Check pending queue
docker compose exec backend bench --site $FRAPPE_SITE_NAME execute carehome_clocking.tasks.sync_offline_queues
```

## Security Checklist

- [ ] Strong database passwords
- [ ] HTTPS enabled with valid certificate
- [ ] Firewall configured (only 80/443 open)
- [ ] Regular backups configured
- [ ] Admin password changed from default
- [ ] Encryption key securely stored
- [ ] Device PINs unique per kiosk
- [ ] Rate limiting enabled for kiosk endpoints
