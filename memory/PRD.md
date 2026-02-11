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
- `/app/frontend/src/components/StaffManagement.js` -- Staff CRUD with modals
- `/app/frontend/src/pages/KioskClockScreen.js` -- Kiosk clock-in/out with success screen
- `/app/frontend/src/pages/RequestCenter.js` -- Unified staff request interface
- `/app/frontend/src/utils/OfflineManager.js` -- Offline auth, TOTP, event queue
- `/app/frontend/src/context/AuthContext.js` -- Auth context with offline support
- `/app/frontend/src/pages/StaffPlanner.js` -- Monthly planner grid
- `/app/frontend/src/pages/StaffProfile.js` -- Staff hub with 6 tabs
- `/app/frontend/src/pages/ManagerDashboard.js` -- Manager hub with sidebar nav
- `/app/frontend/src/pages/MobileAuth.js` -- Mobile authenticator QR generator
- `/app/frontend/src/components/MonthlyCalendar.js` -- Staff rota calendar
- `/app/frontend/src/components/TeamCalendar.js` -- Team availability
- `/app/frontend/src/components/NotificationBell.js` -- Notifications dropdown
- `/app/frontend/src/components/MessagesInbox.js` -- Internal messaging

## Backlog

### P1 -- Phase 5B: Kiosk & Offline Support (Next)
- Non-blocking "optimistic UI" for instant clock-in/out (to handle staff queues)
- Auto-logout on idle
- Device identity management
- Offline TOTP/PIN validation with event queueing

### P1 -- Phase 5C: Staff-facing Features (Next)
- Unified request interface for leave, sick time, day off/on submissions

### Earlier Backlog Items

### P0 -- Phase 4B: Attendance & Compliance (Complete - Feb 6, 2026)
- Attendance monthly calendar view on Manager Dashboard (replaced basic list)
- Click-day dialog showing staffing per shift (Early/Late/Night/Long Day) with nurse + carer counts
- Color-coded coverage: red border = below baseline, green = at baseline, blue = overstaffed
- Late arrival detection (clock-in > shift start + 15min) and no-show flags
- Manual attendance adjustment with audit trail (who, what changed, when, reason)
- Working Time Directive alerts: >48h/week and <11h rest gap warnings
- Audit trail endpoint for attendance changes

### P1 -- Phase 4C: Leave & Availability (Complete - Feb 7, 2026)
- Leave overview for managers: all staff with annual used/remaining/entitlement (28 days)
- Approved vs pending leave visibility with expandable request lists
- Automatic leave balance calculation (entitlement minus approved days used)
- Sickness trends per staff: episodes, total days, Bradford factor (S^2 x D)
- Return-to-work reminders for recent sick leave episodes
- Mark RTW completed from sickness trends modal

### P1 -- Phase 4D: Performance & Operational (Complete - Feb 7, 2026)
- Manager private notes per staff (timestamped, created_by, delete, audit logged)
- Staffing heatmap: monthly grid (E/L/N/LD x days) color-coded by coverage level
- Under-coverage alerts: next 30 days showing shifts below baseline (2N + 6C)
- Notes accessible from Staff List tab via per-employee Notes button

### P1 -- Phase 5A: Staff Management Enhancements (Complete - Feb 7, 2026)
- Staff Management table with Employee, ID, Role, Type, Contract, Status, Actions columns
- Search functionality: filter by name or employee ID
- Status filter: Active/Inactive/All employees
- Add Employee: Create new employee with auto-generated employee_id (prefix based on job_title) and 4-digit PIN
- PIN Result Dialog: Shows generated PIN to manager (Copy/Print/Done buttons)
- Edit Employee: Update employee details (name, job title, employment type, contract hours)
- Reset PIN: Generate new 4-digit PIN displayed in modal for manager to hand-copy
- Reset TOTP: Reset TOTP secret requiring staff to re-enroll on mobile app
- Deactivate/Activate: Toggle employee active status
- Audit trail for staff changes

### P1 -- Phase 5B: Kiosk Clock Screen (Complete - Feb 10, 2026)
- New KioskClockScreen component at /staff with optimistic UI for instant feedback
- Clock-out success screen showing: success message, timestamp, next shift card with date label
- "View Profile" and "Done" buttons on success screen
- Auto-dismiss success screen after 8 seconds with countdown
- Auto-logout on 60 seconds idle
- Next shift API endpoint (/api/shifts/next) returns date_label ("Tomorrow", "Today", or formatted date)
- Clock-out API now returns next_shift in response

### P1 -- Phase 5B: Offline Support (Complete - Feb 10, 2026)
- OfflineManager.js utility for local authentication and event queueing
- Local TOTP validation using crypto-js implementation
- Offline event queue stored in localStorage with automatic sync
- Device identity management: /api/kiosk/register, /api/kiosk/heartbeat
- Offline auth bundle: /api/kiosk/offline-bundle (manager only - contains employees + shifts)
- Offline auth validation: /api/kiosk/offline-auth
- Manual sync button when there are pending events
- Visual indicators: Online/Offline status, unsynced count badge, offline mode notice

### P2 -- Phase 5C: Staff-facing Features (Complete - Feb 10, 2026)
- Request Center component at /staff/requests - unified interface for all staff requests
- Five request types: Leave Request (7 subtypes), **Report Sick**, Request Day Off, Pick Up Shift, Swap Shift
- Multi-step wizard flow: Type Selection -> (Subtype) -> Form -> Confirm -> Submit -> Success
- Leave types: Annual, Sick, Unpaid, Compassionate, Maternity, Paternity, Other
- **Sick Leave Recording**: Dedicated form with symptoms, doctor's note checkbox, expected return date
- Sick leave auto-approved and managers notified immediately
- GET /api/sick-leave/my-records shows total_sick_days_this_year
- Access via: 'New Request' button on Kiosk Clock Screen, Staff Profile, or direct URL
- All data-testids implemented for testing

### P1 -- Planner Validation Rules (Complete - Already Implemented)
- MIN_REST_HOURS = 11 hours between shifts
- MAX_CONSECUTIVE_DAYS = 2 days maximum
- Validation warnings shown when scheduling violates rules
- Rules exposed via GET /api/planner/templates endpoint

### P1 -- Message Notifications (Complete - Feb 10, 2026)
- Internal messages sent when requests are approved/rejected
- Messages appear in Messages Inbox alongside notifications
- Leave/Day request approval sends: notification bell + internal message
- Leave/Day request rejection sends: notification bell + internal message with reason

### P1 -- Agency/Bank Staff Tagging (Complete - Already Implemented)
- employment_type field: "permanent", "agency", "bank"
- Visual indicators in planner for agency/bank staff
- is_agency_cover flag on shift assignments

## Bug Fixes

### Modal Form Reset Bug (Attempted Fix - Feb 11, 2026)
- **Issue:** Forms in modals on Staff Profile page kept resetting/refreshing
- **Status:** Bug still present - user reports forms still not working
- **Attempted fixes:** useCallback for callbacks, React.memo on components, added id/name to form fields
- **Note:** User chose to move on to new feature development

### Return to Work (RTW) Workflow (Complete - Feb 11, 2026)
- **Trigger:** When manager marks sick leave as returned, RTW form is auto-created
- **RTW Register:** List of all RTW forms accessible from Manager Dashboard header
- **RTW Form:** Two sections (Manager & Staff) with Yes/No questions
- **Status tracking:** Pending, In Progress, Completed, Overdue
- **Partial completion:** Either party can complete first, status updates accordingly
- **Triggers:** RTW counter in manager header, RTW trigger banner on staff profile

### Shift Preferences (Complete - Feb 11, 2026)
- **New Employee Field:** `shift_preferences` array added to Employee model
- **Available Options:** Flexible, Earlies Only, Lates Only, Nights Only, No Nights, Weekdays Only, Weekends Only, Long Days Preferred
- **UI:** Toggle pill buttons in Add/Edit Employee forms
- **Display:** Shift Pref column in Staff List table with color-coded badges
- **Future Use:** Foundation for scheduling optimization and metrics

## Backlog Complete - All Features Implemented!

### P2 -- Sick Leave Recording
- Staff sick leave and related absences

### P3 -- Mobile Authenticator App
- Separate project for QR code generation

### Refactoring
- Split server.py into modular routes using FastAPI APIRouter
- Extract Pydantic models to models.py

---
*Last Updated: Feb 11, 2026*
