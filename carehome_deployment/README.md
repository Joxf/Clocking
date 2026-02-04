# CareHome Clocking - Full Deployment Package

This package contains everything needed to deploy a complete CareHome Clocking system with full Frappe HRMS features.

## What's Included

### 1. Full Frappe HRMS Features (from https://github.com/frappe/hrms)
- **Employee Lifecycle**: Onboarding, promotions, transfers, exit interviews
- **Leave & Attendance**: Leave policies, holidays, check-in/out with geolocation, reports
- **Expense Claims & Advances**: Multi-level approvals, ERPNext accounting integration
- **Performance Management**: Goals, KRAs, self-evaluation, appraisal cycles
- **Payroll & Taxation**: Salary structures, tax slabs, payroll runs, salary slips

### 2. CareHome Clocking (Custom Extension)
- **QR-based Clocking**: TOTP rotating QR codes for secure clock in/out
- **Kiosk UI**: Full-screen tablet interface for wall-mounted devices
- **Offline Support**: Queue punches when offline, sync when back online
- **Shift Swaps**: Staff-initiated swap requests with manager approval workflow
- **Mobile Authenticator**: Separate React Native app for Play Store/App Store

## Quick Start

### Prerequisites
- Linux server (Ubuntu 22.04 recommended)
- Docker 24+ and Docker Compose v2
- 4GB RAM minimum (8GB recommended)
- 20GB disk space

### Installation

```bash
# 1. Clone this directory to your server
cd /opt
git clone <your-repo> carehome
cd carehome

# 2. Configure environment
cp .env.example .env
nano .env  # Edit with your passwords and settings

# 3. Build and start
docker-compose build
docker-compose up -d

# 4. Wait for services (~2 minutes)
docker-compose logs -f

# 5. Run initial setup
chmod +x scripts/*.sh
./scripts/setup.sh

# 6. (Optional) Load demo data
./scripts/demo-data.sh
```

### Access

- **Web**: http://localhost:8080 (or your domain)
- **Login**: Administrator / (password from .env)

## Project Structure

```
carehome_deployment/
├── docker-compose.yml      # Main Docker Compose file
├── Dockerfile              # Custom image with all apps
├── .env.example            # Environment variables template
├── configs/
│   └── mariadb.cnf         # MariaDB configuration
├── nginx/
│   └── nginx.conf          # Production nginx config
├── scripts/
│   ├── setup.sh            # Initial setup script
│   ├── demo-data.sh        # Demo data loader
│   ├── backup.sh           # Backup script
│   └── ssl-setup.sh        # Let's Encrypt SSL setup
└── custom_apps/
    └── carehome_clocking/  # Custom Frappe app
        ├── hooks.py
        ├── api.py          # REST API endpoints
        └── doctype/        # Custom doctypes
            ├── care_home/
            ├── kiosk_device/
            ├── staff_enrollment/
            ├── offline_punch_queue/
            └── shift_swap_request/
```

## Custom Doctypes

| Doctype | Purpose |
|---------|--------|
| Care Home | Represents each care home location |
| Kiosk Device | Wall-mounted tablet configuration |
| Staff Enrollment | TOTP secret management for QR auth |
| Offline Punch Queue | Queue for offline clock punches |
| Shift Swap Request | Staff shift swap workflow |

## API Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `carehome_clocking.api.kiosk_login` | Guest | Kiosk device authentication |
| `carehome_clocking.api.validate_token` | Guest | Validate TOTP and create checkin |
| `carehome_clocking.api.initiate_enrollment` | Manager | Generate enrollment QR |
| `carehome_clocking.api.sync_offline_queue` | Guest | Sync offline punches |
| `carehome_clocking.api.get_live_status` | Manager | Dashboard live status |
| `carehome_clocking.api.create_swap_request` | Employee | Create shift swap |

## Production Deployment

### 1. SSL Certificate Setup

```bash
# Update .env with your domain
DOMAIN=carehome.yourdomain.com
LETSENCRYPT_EMAIL=admin@yourdomain.com

# Run SSL setup
./scripts/ssl-setup.sh

# Enable production profile
docker-compose --profile production up -d nginx-proxy certbot
```

### 2. Backup Configuration

```bash
# Add to crontab
crontab -e

# Add this line for nightly backups at 2 AM
0 2 * * * /opt/carehome/scripts/backup.sh
```

### 3. Multi-tenant Setup

To add more care homes:
1. Go to Setup > Company > New (create new company)
2. Go to CareHome Clocking > Care Home > New (link to company)
3. Create employees under the new company
4. Create kiosk devices linked to the new care home

## Mobile Authenticator App

The React Native mobile app is in a separate package:
- Location: `/app/mobile_app/`
- Build: `cd mobile_app && npm install && npm run android`
- Features: QR enrollment, rotating QR display, offline support

## Troubleshooting

### Services not starting
```bash
docker-compose logs backend
docker-compose logs mariadb
```

### Database connection errors
```bash
docker-compose exec mariadb mysql -u root -p
```

### Reset site
```bash
docker-compose exec backend bench --site $FRAPPE_SITE_NAME reinstall
```

## License

MIT License
