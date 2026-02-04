#!/bin/bash
# CareHome Clocking - Initial Setup Script

set -e

echo "=== CareHome Clocking Setup ==="

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env from example..."
    cp .env.example .env
    echo "Please edit .env with your configuration and run this script again."
    exit 1
fi

source .env

# Start services
echo "Starting Docker services..."
docker-compose up -d mariadb redis-cache redis-queue

# Wait for MariaDB
echo "Waiting for MariaDB to be ready..."
until docker-compose exec -T mariadb mysqladmin ping -h localhost -uroot -p"$DB_ROOT_PASSWORD" --silent; do
    echo "Waiting for database..."
    sleep 2
done

echo "MariaDB is ready!"

# Start Frappe backend
echo "Starting Frappe backend..."
docker-compose up -d backend

# Wait for bench to be ready
sleep 10

# Initialize bench if needed
echo "Checking bench initialization..."
docker-compose exec backend bash -c '
    cd /home/frappe/frappe-bench
    if [ ! -d "sites/$FRAPPE_SITE_NAME" ]; then
        echo "Creating new site..."
        bench new-site $FRAPPE_SITE_NAME \
            --db-host mariadb \
            --db-port 3306 \
            --db-name $DB_NAME \
            --db-password $DB_PASSWORD \
            --admin-password $ADMIN_PASSWORD \
            --install-app erpnext \
            --install-app hrms
        
        # Set as default site
        bench use $FRAPPE_SITE_NAME
        
        echo "Site created successfully!"
    else
        echo "Site already exists."
    fi
'

# Install custom app
echo "Installing carehome_clocking app..."
docker-compose exec backend bash -c '
    cd /home/frappe/frappe-bench
    if [ ! -d "apps/carehome_clocking" ]; then
        bench get-app /path/to/carehome_clocking || echo "App not found, will create later"
    fi
'

# Start all services
echo "Starting all services..."
docker-compose up -d

echo ""
echo "=== Setup Complete ==="
echo "Access the site at: http://localhost:8000"
echo "Admin login: Administrator / $ADMIN_PASSWORD"
