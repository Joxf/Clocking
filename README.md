# CareHome Clocking System

QR-based attendance clocking system for care homes built on Frappe HRMS.

## System Components

1. **Frappe HRMS** - HR backbone (employees, leave, payroll, attendance)
2. **carehome_clocking** - Custom app for QR clocking, enrollment, shift swaps
3. **Kiosk UI** - Wall-mounted tablet interface
4. **Mobile Authenticator** - React Native app for staff QR codes

## Quick Links

- [Implementation Plan](./docs/IMPLEMENTATION_PLAN.md)
- [Deployment Guide](./docs/DEPLOYMENT_GUIDE.md)
- [Mobile App](./mobile_app/README.md)

## Project Structure

```
/app/
├── frappe_docker/          # Docker deployment
│   ├── docker-compose.yml
│   ├── nginx/
│   ├── scripts/
│   └── apps/
│       └── carehome_clocking/   # Custom Frappe app
├── mobile_app/             # React Native authenticator
└── docs/                   # Documentation
```

## Features

### Staff Clocking
- TOTP-based rotating QR codes
- Offline-capable kiosk with sync
- Auto IN/OUT detection
- 2-minute cooldown between punches

### Enrollment
- Manager-initiated enrollment
- 10-minute enrollment window
- One active secret per employee
- Re-enrollment invalidates previous

### Shift Swaps
- Staff-initiated swap requests
- Target acceptance required
- Manager approval workflow
- Audit trail maintained

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `carehome_clocking.api.kiosk_login` | Authenticate kiosk device |
| POST | `carehome_clocking.api.validate_token` | Validate TOTP and create checkin |
| POST | `carehome_clocking.api.initiate_enrollment` | Generate enrollment QR |
| POST | `carehome_clocking.api.sync_offline_queue` | Sync offline punches |
| GET | `carehome_clocking.api.get_live_status` | Dashboard live status |

## URLs

| URL | Description |
|-----|-------------|
| `/kiosk` | Full-screen kiosk interface |
| `/staff-portal` | Staff self-service portal |
| `/app/care-home` | Care home management |
| `/app/kiosk-device` | Kiosk device management |
| `/app/staff-enrollment` | Staff enrollment management |
| `/app/shift-swap-request` | Shift swap requests |

## Development

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for mobile app)

### Quick Start

```bash
# Start Frappe HRMS
cd frappe_docker
cp .env.example .env
docker compose up -d

# Mobile app development
cd mobile_app
npm install
npm run android  # or npm run ios
```

## License

MIT
