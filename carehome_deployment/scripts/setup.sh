#!/bin/bash
# CareHome Clocking - Initial Setup Script
# Run this after docker-compose up -d

set -e

echo "========================================="
echo "  CareHome Clocking - Initial Setup"
echo "========================================="

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "ERROR: .env file not found. Copy .env.example to .env and configure it."
    exit 1
fi

# Wait for services
echo "[1/6] Waiting for services to be ready..."
until docker-compose exec -T mariadb mysqladmin ping -h localhost -u root -p"$DB_ROOT_PASSWORD" --silent; do
    echo "Waiting for MariaDB..."
    sleep 5
done
echo "MariaDB is ready!"

sleep 10

# Create site
echo "[2/6] Creating Frappe site..."
docker-compose exec -T backend bench new-site $FRAPPE_SITE_NAME \
    --db-root-password $DB_ROOT_PASSWORD \
    --admin-password $ADMIN_PASSWORD \
    --install-app erpnext \
    --install-app hrms \
    --install-app carehome_clocking

# Set site as default
echo "[3/6] Setting default site..."
docker-compose exec -T backend bench use $FRAPPE_SITE_NAME

# Enable scheduler
echo "[4/6] Enabling scheduler..."
docker-compose exec -T backend bench --site $FRAPPE_SITE_NAME enable-scheduler

# Run migrations
echo "[5/6] Running migrations..."
docker-compose exec -T backend bench --site $FRAPPE_SITE_NAME migrate

# Clear cache
echo "[6/6] Clearing cache..."
docker-compose exec -T backend bench --site $FRAPPE_SITE_NAME clear-cache

echo ""
echo "========================================="
echo "  Setup Complete!"
echo "========================================="
echo ""
echo "Access your site at:"
echo "  Development: http://localhost:${HTTP_PORT:-8080}"
echo "  Production:  https://$DOMAIN"
echo ""
echo "Login credentials:"
echo "  Username: Administrator"
echo "  Password: $ADMIN_PASSWORD"
echo ""
echo "Next steps:"
echo "  1. Login and complete the setup wizard"
echo "  2. Configure HRMS: Create Company, Departments, Employees"
echo "  3. Setup CareHome Clocking: Create Care Home, Kiosk Devices"
echo "  4. Enroll staff phones for QR clocking"
echo ""
