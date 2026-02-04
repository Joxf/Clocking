# CareHome Clocking System PRD

## Original Problem Statement
Build a CareHome Clocking system by cloning Frappe HRMS visual design and architecture. The system must support:
- QR + PIN authentication for all users
- Role-based dashboards (Staff, Manager, Admin)
- Offline support with local queue
- 60-second idle auto-logout
- Kiosk-friendly UI with large touch targets

## User Personas
1. **Staff** (Nurses, Carers, Kitchen, Maintenance) - Clock in/out, view status
2. **Manager** - View attendance, approve requests, staff oversight
3. **Admin** - Full system access, device management, staff enrollment

## Core Requirements (Static)
- Root URL must always open Scan Login page
- QR + PIN authentication (4-digit, hashed storage)
- TOTP with 32-character secrets, ±1 timestep tolerance
- Role-based routing after authentication
- Server-side permission enforcement
- Offline event queuing with sync on reconnect
- Frappe HRMS visual design language

## What's Been Implemented

### Phase 1 - MVP (Feb 4, 2026)
**Backend (FastAPI + MongoDB):**
- Employee management with roles (staff, manager, admin)
- TOTP enrollment and validation (pyotp, 32-char secrets)
- PIN management with SHA-256 hashing
- JWT session management (8-hour expiry)
- Rate limiting with account lockout (5 failed attempts = 15min lockout)
- Care Home and Kiosk Device doctypes
- Offline auth queue sync endpoint
- Attendance tracking (clock in/out)
- Dashboard statistics API
- Seed data: Comber Home with 18 employees

**Frontend (React with Frappe-style UI):**
- Scan Login page with QR camera view (html5-qrcode)
- PIN entry page with numeric keypad
- Staff Dashboard (clock in/out, status display)
- Manager Dashboard (sidebar nav, stats cards, attendance table)
- Admin Dashboard (staff management, device config, settings)
- Online/Offline indicator on all pages
- 60-second idle auto-logout
- Protected routes with role-based access

**Test Data (Comber Home):**
- 1 Super Admin (Sarah Wilson - ADM001)
- 1 Manager (Michael O'Brien - MGR001)
- 10 Active Staff (nurses, carers, kitchen, maintenance, activities)
- 2 Agency Staff
- 2 Inactive/Leavers
- 2 On Leave
- Default PIN: 1234 for all accounts

## Prioritized Backlog

### P0 - Critical
- [x] QR + PIN authentication flow
- [x] Role-based dashboards
- [x] Clock in/out functionality
- [x] Offline indicator

### P1 - High Priority (Next Phase)
- [ ] Mobile authenticator app (React Native)
- [ ] Real QR code generation with rotating TOTP
- [ ] Device registration flow
- [ ] Shift swap request workflow
- [ ] Email notifications

### P2 - Medium Priority
- [ ] Leave request UI
- [ ] Attendance reports/export
- [ ] Multiple care homes support
- [ ] Device heartbeat monitoring
- [ ] Audit log viewer

### P3 - Future Enhancements
- [ ] Payroll integration hooks
- [ ] Rota/scheduling UI
- [ ] Biometric fallback support
- [ ] Multi-language support

## Technical Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Kiosk Tablet  │────▶│   React App     │
│   (Browser)     │     │   (Port 3000)   │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   FastAPI       │
                        │   (Port 8001)   │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   MongoDB       │
                        │   (Port 27017)  │
                        └─────────────────┘
```

## API Endpoints

### Authentication
- `POST /api/auth/validate-qr` - Validate QR code
- `POST /api/auth/validate-pin` - Validate PIN, create session
- `POST /api/auth/logout` - End session

### Enrollment
- `POST /api/enrollment/generate-secret` - Generate TOTP secret
- `POST /api/enrollment/set-pin` - Set employee PIN
- `POST /api/enrollment/confirm` - Confirm TOTP enrollment

### Attendance
- `POST /api/attendance/clock` - Clock in/out
- `GET /api/attendance/status` - Get current status
- `GET /api/attendance/today` - Get today's attendance

### Dashboard
- `GET /api/dashboard/stats` - Get statistics
- `GET /api/employees` - List employees
- `GET /api/employees/lookup/{code}` - Public employee lookup

## Next Tasks
1. Build React Native mobile authenticator app
2. Implement real-time TOTP QR generation
3. Add shift swap approval workflow
4. Create attendance reports with export
