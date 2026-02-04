# CareHome Clocking System

**Complete QR-based attendance system for care homes built on Frappe HRMS**

## Overview

This system extends [Frappe HRMS](https://github.com/frappe/hrms) with QR-based clocking capabilities:

### Full HRMS Features (Included)
- Employee Lifecycle (onboarding, promotions, transfers, exit interviews)
- Leave & Attendance (policies, holidays, geolocation check-in/out)
- Expense Claims & Advances (multi-level approvals)
- Performance Management (goals, KRAs, appraisals)
- Payroll & Taxation (salary structures, tax slabs, payroll)

### CareHome Clocking Extension
- TOTP-based rotating QR codes
- Tablet kiosk interface (wall-mounted)
- Offline support with sync
- Shift swap workflow
- Separate mobile authenticator app

## Project Structure

```
/app/
├── carehome_deployment/    # Docker deployment package
│   ├── docker-compose.yml  # Full stack deployment
│   ├── Dockerfile          # Custom image builder
│   ├── custom_apps/        # CareHome Clocking Frappe app
│   ├── nginx/              # Production nginx config
│   └── scripts/            # Setup and maintenance scripts
├── frappe_setup/
│   ├── hrms/               # Cloned Frappe HRMS repo
│   └── frappe_docker/      # Cloned frappe_docker repo
├── mobile_app/             # React Native authenticator
├── frontend/               # Demo UI (React)
└── docs/                   # Documentation
```

## Quick Start

See [Deployment README](./carehome_deployment/README.md) for full instructions.

```bash
cd carehome_deployment
cp .env.example .env
# Edit .env with your settings
docker-compose build
docker-compose up -d
./scripts/setup.sh
```

## Demo

The React demo at `http://localhost:3000` showcases:
- Dashboard with live status
- Kiosk UI simulation
- Mobile app preview

## API Documentation

See [API Endpoints](./carehome_deployment/README.md#api-endpoints)

## License

MIT
