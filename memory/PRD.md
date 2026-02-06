# CareHome Clocking System - PRD

## Original Problem Statement
Build a "CareHome Clocking system" by cloning and extending Frappe HRMS. QR + PIN authentication for all users, routing to role-based dashboards (Staff, Manager, Admin). Key features: offline support for login kiosk, specific doctypes, separate mobile authenticator app for QR codes.

## Core Architecture
- **Backend:** FastAPI + MongoDB (motor) + JWT auth + TOTP
- **Frontend:** React + React Router + Axios + Frappe HRMS styling
- **Auth:** TOTP from QR code + static PIN → JWT session
- **Demo Mode:** Staff (NRS001), Manager (MGR001), Admin (ADM001) — PIN: 1234

## Implemented Features

### Phase 1 — MVP (Complete)
- QR scan → PIN entry → JWT auth → Role-based dashboards
- Demo mode buttons for Staff/Manager/Admin
- Backend: user management, TOTP/PIN validation, JWT sessions

### Phase 2 — Staff Profile (Complete)
- Comprehensive Staff Profile page (/staff/profile)
- Leave request, shift swap, day request functionality
- Redirect to profile when not on active shift

### Phase 3 — Communication & Scheduling (Complete - Feb 6, 2026)
- Internal messaging system (send to individual, role, or all)
- Notification system with bell icon + unread count
- Monthly rota calendar with color-coded shifts (Early=yellow, Late=blue, Night=purple)
- Team leave/availability calendar
- Enhanced shift swap: open request, direct to colleague, or message to manager
- Manager approval workflow for all requests (leave, swaps, day-off)
- Manager Dashboard with Approvals tab and Shift Swaps tab

## DB Collections
- employees, shifts, leave_requests, shift_swap_requests, day_requests, messages, notifications

## Key Files
- `/app/backend/server.py` — All backend endpoints (~2000 lines)
- `/app/frontend/src/pages/StaffProfile.js` — Staff hub with 6 tabs
- `/app/frontend/src/pages/ManagerDashboard.js` — Manager hub with 4 tabs
- `/app/frontend/src/components/MonthlyCalendar.js` — Rota calendar
- `/app/frontend/src/components/TeamCalendar.js` — Team availability
- `/app/frontend/src/components/NotificationBell.js` — Notifications dropdown
- `/app/frontend/src/components/MessagesInbox.js` — Internal messaging

## Backlog

### P1 — Upcoming
- Offline support (local TOTP/PIN validation, event queueing)
- Kiosk device behavior (auto-logout on idle, device identity)

### P2 — Future
- Sick leave recording feature
- Mobile authenticator app (separate project for QR code generation)

### Refactoring
- Split server.py into modular routes using FastAPI APIRouter
- Extract Pydantic models to models.py
