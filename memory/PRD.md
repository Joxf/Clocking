# CareHome Clocking System - PRD

## Project Overview
A comprehensive workforce management system for care homes, featuring clock-in/out functionality, shift planning, leave management, and real-time attendance tracking.

## Technical Stack
- **Frontend**: React with Tailwind CSS, Shadcn UI components
- **Backend**: Node.js with Express.js (migrated from Python/FastAPI on Feb 16, 2026)
- **Database**: MongoDB
- **Authentication**: QR code + PIN, TOTP-based mobile authentication

## Architecture
```
/app/backend/
├── src/
│   ├── config/
│   │   ├── db.js              # MongoDB connection
│   │   └── constants.js       # Shift templates, coverage baselines
│   ├── middleware/
│   │   └── auth.js            # JWT authentication middleware
│   ├── models/
│   │   ├── index.js           # Model exports
│   │   ├── Employee.js        # Employee schema
│   │   ├── Attendance.js      # Attendance records
│   │   ├── Shift.js           # Shift assignments
│   │   ├── LeaveRequest.js    # Leave requests
│   │   ├── DayRequest.js      # Day on/off requests
│   │   ├── ShiftSwapRequest.js# Shift swap requests
│   │   ├── Notification.js    # Notifications
│   │   ├── Message.js         # Messages
│   │   ├── ReturnToWork.js    # RTW forms
│   │   ├── ControlPreferences.js # System settings
│   │   ├── OverrideLog.js     # Manager override logs
│   │   ├── AttendanceAudit.js # Attendance audit trail
│   │   ├── ManagerNote.js     # Manager notes
│   │   └── ...
│   ├── routes/
│   │   ├── auth.js            # Authentication endpoints
│   │   ├── employees.js       # Employee management
│   │   ├── attendance.js      # Attendance tracking
│   │   ├── shifts.js          # Shift queries
│   │   ├── planner.js         # Staff planner
│   │   ├── leave.js           # Leave requests
│   │   ├── dayRequests.js     # Day requests
│   │   ├── shiftSwaps.js      # Shift swap requests
│   │   ├── notifications.js   # Notifications
│   │   ├── messages.js        # Messaging
│   │   ├── rtw.js             # Return to Work
│   │   ├── controlPreferences.js # Settings
│   │   └── ...
│   ├── utils/
│   │   ├── auth.js            # PIN hashing, TOTP
│   │   └── helpers.js         # Date utilities
│   └── server.js              # Main Express app
├── package.json
└── .env
```

## Key Features

### Implemented
1. **Authentication System**
   - QR code scanning with TOTP
   - PIN verification
   - Demo mode for testing
   - JWT token-based sessions

2. **Manager Dashboard**
   - Real-time attendance overview
   - Pending approvals summary
   - Staff statistics

3. **Staff Planner**
   - Monthly shift grid view
   - Shift templates (Early, Late, Night, Long Day)
   - Employee tooltips with details
   - Multi-select mode
   - Batch save/discard workflow
   - Leave/day-off visualization

4. **Attendance Management**
   - Calendar view with coverage stats
   - Late arrivals report
   - Working Time Directive alerts
   - Manual adjustment with audit trail

5. **Leave & Request Management**
   - Leave requests (annual, sick, etc.)
   - Day on/off requests
   - Shift swap requests
   - Manager approval workflow

6. **Control Preferences**
   - Staffing requirements
   - Consecutive shift rules
   - Rest period rules
   - Weekend protection
   - Late/early clock-in controls

7. **Dark Mode**
   - Application-wide dark theme

### API Endpoints (Node.js)
- `/api/auth/*` - Authentication
- `/api/employees/*` - Employee management
- `/api/attendance/*` - Attendance tracking
- `/api/shifts/*` - Shift queries
- `/api/planner/*` - Staff planner operations
- `/api/leave-requests/*` - Leave management
- `/api/day-requests/*` - Day requests
- `/api/shift-swaps/*` - Shift swaps
- `/api/notifications/*` - Notifications
- `/api/control-preferences/*` - System settings
- `/api/dashboard/*` - Dashboard stats
- `/api/reports/*` - Reports

## Recent Changes

### Feb 16, 2026 - Dark Mode Removal & Staff Counter
- **COMPLETED**: Removed dark mode completely from the application
- **COMPLETED**: Added "Total Staff" counter row at the bottom of Staff Planner showing staff scheduled per day
- Updated index.css to use only light theme variables
- Simplified ThemeContext to no-op (always light mode)
- Removed ThemeToggle component usage from all pages
- Fixed syntax errors caused by sed dark mode class removal

### Feb 16, 2026 - Backend Migration
- **COMPLETED**: Full backend rebuild from Python/FastAPI to Node.js/Express.js
- Migrated all 90+ API endpoints
- Updated database operations to use Mongoose ODM
- Maintained backward compatibility with existing MongoDB data
- Deleted all Python files from the project

## Pending Features

### P1 - High Priority
- Complete Staff Planner multi-select delete action
- Implement "Unsaved Changes" dialog for navigation
- Refactor StaffPlanner.js (700+ lines) into smaller components

### P2 - Medium Priority
- Full Reason Management UI for clock-in reasons
- Swap Request Logic implementation
- Advanced Rule Enforcement UI

## Test Credentials
- Default PIN for all users: `1234`
- Demo mode available on login screen

## Environment Variables
```
# Backend (.env)
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
CORS_ORIGINS="*"

# Frontend (.env)
REACT_APP_BACKEND_URL=https://staff-planner-v2.preview.emergentagent.com
```
