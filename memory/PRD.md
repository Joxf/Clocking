# CareHome Clocking System PRD

## Original Problem Statement
Build a CareHome Clocking system by cloning Frappe HRMS visual design and architecture. The system must support:
- QR + PIN authentication for all users
- Role-based dashboards (Staff, Manager, Admin)
- Offline support with local queue
- 60-second idle auto-logout
- Kiosk-friendly UI with large touch targets

## User Personas
1. **Staff** (Nurses, Carers, Kitchen, Maintenance) - Clock in/out, view status, manage leave/swaps
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

### Phase 2 - Staff Profile Features (Feb 4, 2026)
**Backend Additions:**
- Shift/Rota management system
- Leave request system (annual, sick, unpaid, compassionate, maternity, paternity)
- Day request system (day on/off)
- Enhanced shift swap system (staff-only visibility)
- Staff profile endpoint with leave balance tracking
- Today's shift endpoint with clocking window validation
- 28 days annual leave entitlement tracking

**Frontend - Staff Profile Page:**
- Overview tab with leave balance, upcoming shifts, pending requests
- My Rota tab showing 4-week schedule with swap buttons
- Shift Swaps tab (staff-only visibility):
  - Available swaps from colleagues
  - Own swap requests with cancel option
- Annual Leave tab:
  - Leave balance display (Total/Used/Remaining)
  - Request Leave modal with date picker
  - Leave history table
- Sick Leave tab:
  - Record Absence button
  - Sick leave history
- Day Requests tab:
  - Request day on/off functionality
  - Request history

**Clock-in Logic Enhancement:**
- Clock in/out only visible when within shift window
- Clocking window: 30 minutes before shift to 2 hours after
- Outside window: Redirect to Staff Profile page
- Shift info displayed when shift exists

**Test Data (Comber Home):**
- 1 Super Admin (Sarah Wilson - ADM001)
- 1 Manager (Michael O'Brien - MGR001)
- 10 Active Staff (nurses, carers, kitchen, maintenance, activities)
- 2 Agency Staff
- 2 Inactive/Leavers
- 2 On Leave
- 144 shifts seeded across 17 days
- Default PIN: 1234 for all accounts

## Prioritized Backlog

### P0 - Critical (COMPLETED)
- [x] QR + PIN authentication flow
- [x] Role-based dashboards
- [x] Clock in/out functionality
- [x] Offline indicator
- [x] Staff Profile page with leave/rota/swaps

### P1 - High Priority (Next Phase)
- [ ] Mobile authenticator app (React Native)
- [ ] Real QR code generation with rotating TOTP
- [ ] Manager approval workflow for leave requests
- [ ] Email notifications for approvals
- [ ] Device registration flow

### P2 - Medium Priority
- [ ] Attendance reports/export
- [ ] Multiple care homes support
- [ ] Device heartbeat monitoring
- [ ] Audit log viewer
- [ ] Auto-scheduling/rota generation

### P3 - Future Enhancements
- [ ] Payroll integration hooks
- [ ] Biometric fallback support
- [ ] Multi-language support
- [ ] Mobile-responsive dashboard

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

### Shifts & Rota
- `GET /api/shifts/my-rota` - Get user's shifts (4 weeks)
- `GET /api/shifts/today` - Get today's shift with clocking window

### Leave Requests
- `GET /api/leave-requests` - List leave requests
- `POST /api/leave-requests` - Create leave request
- `PUT /api/leave-requests/{id}/approve` - Approve (manager/admin)
- `PUT /api/leave-requests/{id}/reject` - Reject (manager/admin)
- `DELETE /api/leave-requests/{id}` - Cancel own request

### Day Requests
- `GET /api/day-requests` - List day requests
- `POST /api/day-requests` - Create day request
- `PUT /api/day-requests/{id}/approve` - Approve
- `PUT /api/day-requests/{id}/reject` - Reject

### Shift Swaps (Staff Only)
- `GET /api/shift-swaps` - List swaps (empty for managers/admins)
- `POST /api/shift-swaps` - Create swap request
- `POST /api/shift-swaps/{id}/accept` - Accept swap
- `POST /api/shift-swaps/{id}/cancel` - Cancel swap

### Staff Profile
- `GET /api/staff/profile` - Get comprehensive profile data
- `GET /api/staff/colleagues` - Get colleagues list

### Dashboard
- `GET /api/dashboard/stats` - Get statistics
- `GET /api/employees` - List employees
- `GET /api/employees/lookup/{code}` - Public employee lookup

## Next Tasks
1. Build React Native mobile authenticator app
2. Implement manager approval workflow for leave requests
3. Add email notifications
4. Create attendance reports with export
