#!/bin/bash
# CareHome Clocking - SSL Certificate Setup with Let's Encrypt

set -e

echo "========================================="
echo "  CareHome SSL Certificate Setup"
echo "========================================="

# Load environment
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

if [ -z "$DOMAIN" ] || [ -z "$LETSENCRYPT_EMAIL" ]; then
    echo "ERROR: DOMAIN and LETSENCRYPT_EMAIL must be set in .env"
    exit 1
fi

echo "Domain: $DOMAIN"
echo "Email: $LETSENCRYPT_EMAIL"

# Create certbot directories
mkdir -p nginx/ssl

# Get initial certificate (staging first to test)
echo ""
echo "[1/2] Getting certificate from Let's Encrypt (staging)..."
docker run --rm \
    -v $(pwd)/nginx/ssl:/etc/letsencrypt \
    -v carehome-certbot-www:/var/www/certbot \
    certbot/certbot certonly \
    --webroot -w /var/www/certbot \
    --email $LETSENCRYPT_EMAIL \
    --agree-tos \
    --no-eff-email \
    --staging \
    -d $DOMAIN

echo ""
echo "Staging certificate obtained. Testing..."

# If staging works, get production certificate
echo ""
echo "[2/2] Getting production certificate..."
docker run --rm \
    -v $(pwd)/nginx/ssl:/etc/letsencrypt \
    -v carehome-certbot-www:/var/www/certbot \
    certbot/certbot certonly \
    --webroot -w /var/www/certbot \
    --email $LETSENCRYPT_EMAIL \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d $DOMAIN

echo ""
echo "========================================="
echo "  SSL Setup Complete!"
echo "========================================="
echo ""
echo "Certificate location: nginx/ssl/live/$DOMAIN/"
echo ""
echo "To enable HTTPS:"
echo "1. Update nginx/nginx.conf with your domain"
echo "2. Run: docker-compose --profile production up -d nginx-proxy certbot"
echo ""
