# CareHome Clocking System - PRD

## Original Problem Statement
Build a "CareHome Clocking system" by cloning and extending Frappe HRMS. QR + PIN authentication for all users, routing to role-based dashboards (Staff, Manager, Admin). Key features: offline support for login kiosk, specific doctypes, separate mobile authenticator app for QR codes.

## Core Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth + TOTP
- **Frontend:** React + React Router + Axios + Frappe HRMS styling
- **Auth:** TOTP from QR code + static PIN -> JWT session
- **Demo Mode:** Staff (NRS001), Manager (MGR001), Admin (ADM001) -- PIN: 1234

## Shift Templates
- Early: 08:00 - 14:00 (6h)
- Late: 14:00 - 20:00 (6h)
- Night: 20:00 - 08:00 (12h)
- Long Day: 08:00 - 20:00 (12h)
- Minimum 36 hours/week contract

## Coverage Baseline
- 2 nurses + 6 care assistants per shift

## Implemented Features

### Phase 1 -- MVP (Complete)
- QR scan -> PIN entry -> JWT auth -> Role-based dashboards
- Demo mode buttons for Staff/Manager/Admin

### Phase 2 -- Staff Profile (Complete)
- Staff Profile page (/staff/profile) with leave, swaps, day requests
- Redirect to profile when not on active shift

### Phase 3 -- Communication & Scheduling (Complete - Feb 6, 2026)
- Internal messaging system
- Notification system with bell icon
- Monthly rota calendar with color-coded shifts
- Team leave/availability calendar
- Enhanced shift swap (open, direct, manager request)
- Manager approval workflow for all requests

### QR Authentication Flow (Complete - Feb 6, 2026)
- Mobile authenticator page (/mobile-auth) with live rotating QR codes
- Full end-to-end QR scan -> TOTP validate -> PIN verify -> JWT auth
- Fixed: QR scanner duplicate-scan guard (processingRef)
- Fixed: TOTP tolerance widened to +/-90s, no lockout on TOTP failures
- Fixed: PIN pad disabled until employee data loaded

### Phase 4A -- Monthly Staff Planner (Complete - Feb 6, 2026)
- Monthly planner grid (staff x days) at /manager/planner
- Drag-and-drop shift assignment between cells
- Shift template palette (Early, Late, Night, Long Day) for one-click assignment
- Agency/bank staff tagging with visual indicators (AGY badge, orange avatars, * on shifts)
- **Weekly hours columns** (WK1-WK5) per staff, color-coded: red < 36h contract, green = 36h, amber > 36h overtime
- **Monthly total column** with same color coding scheme
- **Coverage detail rows** showing actual nurse + carer counts per shift (Early/Late/Night) per day, color-coded against baseline (2N + 6C)
- Planner safeguards: max 2 consecutive days warning, 11hr rest gap warning, confirmation popups
- On-duty / Off-duty view toggle, role filter, seed month for testing

## DB Collections
- employees, shifts, leave_requests, shift_swap_requests, day_requests, messages, notifications, auth_events, care_homes, kiosk_devices

## Key Files
- `/app/backend/server.py` -- All backend endpoints
- `/app/frontend/src/pages/StaffPlanner.js` -- Monthly planner grid
- `/app/frontend/src/pages/StaffProfile.js` -- Staff hub with 6 tabs
- `/app/frontend/src/pages/ManagerDashboard.js` -- Manager hub with sidebar nav
- `/app/frontend/src/pages/MobileAuth.js` -- Mobile authenticator QR generator
- `/app/frontend/src/components/MonthlyCalendar.js` -- Staff rota calendar
- `/app/frontend/src/components/TeamCalendar.js` -- Team availability
- `/app/frontend/src/components/NotificationBell.js` -- Notifications dropdown
- `/app/frontend/src/components/MessagesInbox.js` -- Internal messaging

## Backlog

### P0 -- Phase 4B: Attendance & Compliance (Complete - Feb 6, 2026)
- Attendance monthly calendar view on Manager Dashboard (replaced basic list)
- Click-day dialog showing staffing per shift (Early/Late/Night/Long Day) with nurse + carer counts
- Color-coded coverage: red border = below baseline, green = at baseline, blue = overstaffed
- Late arrival detection (clock-in > shift start + 15min) and no-show flags
- Manual attendance adjustment with audit trail (who, what changed, when, reason)
- Working Time Directive alerts: >48h/week and <11h rest gap warnings
- Audit trail endpoint for attendance changes

### P1 -- Phase 4C: Leave & Availability Enhancements
- Leave approval workflow improvements (approved vs pending visibility)
- Automatic leave balance calculation
- Sickness trends view/reporting per staff member
- Return-to-work reminders linked to sickness episodes

### P1 -- Phase 4D: Performance & Operational Overview
- Manager private notes per staff member (timestamped, audit logged)
- Live staffing heatmap (week/month)
- Future shift under-coverage alerts

### P2 -- Offline Support
- Local TOTP/PIN validation, event queueing for kiosk

### P2 -- Kiosk Device Behavior
- Auto-logout on idle, device identity management

### P2 -- Sick Leave Recording
- Staff sick leave and related absences

### P3 -- Mobile Authenticator App
- Separate project for QR code generation

### Refactoring
- Split server.py into modular routes using FastAPI APIRouter
- Extract Pydantic models to models.py
