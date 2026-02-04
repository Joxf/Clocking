# CareHome Clocking - Implementation Plan

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CareHome Clocking System                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Kiosk UI    │  │ Mobile App  │  │ Manager/Staff Portal    │ │
│  │ (Web Page)  │  │ (React      │  │ (Frappe Desk + Web)     │ │
│  │             │  │  Native)    │  │                         │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
│         │                │                      │               │
│         │    REST API / Frappe Methods          │               │
│         └────────────────┴──────────────────────┘               │
│                          │                                       │
│  ┌───────────────────────┴───────────────────────────────────┐  │
│  │              Frappe Framework + HRMS                       │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │            carehome_clocking (Custom App)           │  │  │
│  │  │  • Kiosk Device Management                          │  │  │
│  │  │  • Staff Enrollment (TOTP)                          │  │  │
│  │  │  • QR Validation                                    │  │  │
│  │  │  • Offline Queue & Sync                             │  │  │
│  │  │  • Shift Swap Workflow                              │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │               HRMS (Standard)                       │  │  │
│  │  │  • Employee, Leave, Attendance                      │  │  │
│  │  │  • Payroll, Shift Assignment                        │  │  │
│  │  │  • Workflows, Permissions, Audit                    │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                       │
│                    ┌─────┴─────┐                                │
│                    │ MariaDB   │                                │
│                    └───────────┘                                │
└─────────────────────────────────────────────────────────────────┘
```

## Phase 1: Frappe HRMS Setup (Docker)

### 1.1 Docker Compose Configuration
- Use `frappe_docker` approach
- Services: frappe-web, frappe-worker, redis-cache, redis-queue, mariadb
- Volumes for persistence

### 1.2 Initial Site Configuration
- Create site: `carehome.local`
- Install apps: frappe, erpnext, hrms
- Admin user setup

### 1.3 HRMS Core Configuration
- Company: "Sunrise Care Home"
- Employee records
- Leave Types, Holiday List
- Shift Types

## Phase 2: Custom Frappe App (carehome_clocking)

### 2.1 Doctypes

#### Care Home
```
Fields:
- care_home_name (Data, required)
- address (Text)
- company (Link: Company)
- timezone (Select)
- is_active (Check)
```

#### Kiosk Device
```
Fields:
- device_name (Data, required)
- care_home (Link: Care Home)
- location_name (Data)
- device_pin_hash (Data)
- last_seen_at (Datetime)
- offline_queue_size (Int)
- is_active (Check)
- allowed_employees (Table: Kiosk Allowed Employee)
```

#### Staff Enrollment
```
Fields:
- employee (Link: Employee, required)
- totp_secret_encrypted (Text)
- is_enrolled (Check)
- enrolled_at (Datetime)
- last_validated_at (Datetime)
- enrollment_token (Data)
- token_expires_at (Datetime)
```

#### Offline Punch Queue
```
Fields:
- offline_id (Data, unique)
- employee (Link: Employee)
- timestamp_local (Datetime)
- punch_type (Select: IN/OUT)
- device (Link: Kiosk Device)
- care_home (Link: Care Home)
- location (Data)
- synced_at (Datetime)
- sync_status (Select: Pending/Synced/Error)
- error_message (Text)
```

#### Shift Swap Request
```
Fields:
- requester (Link: Employee)
- requester_shift_assignment (Link: Shift Assignment)
- target_employee (Link: Employee)
- target_shift_assignment (Link: Shift Assignment)
- swap_date (Date)
- status (Select: Proposed/Accepted/Declined/Approved/Rejected)
- requester_notes (Text)
- target_notes (Text)
- manager_notes (Text)
- approved_by (Link: User)
- approved_at (Datetime)
```

### 2.2 Server Methods (API)

```python
# Enrollment
@frappe.whitelist()
def initiate_enrollment(employee_id):
    """Generate enrollment QR for employee"""
    
@frappe.whitelist()
def complete_enrollment(enrollment_token, employee_id):
    """Mark enrollment complete"""

# Validation  
@frappe.whitelist(allow_guest=True)
def validate_token(employee_id, totp_code, device_id):
    """Validate TOTP and create checkin"""

@frappe.whitelist(allow_guest=True)
def get_employee_state(employee_id, device_id):
    """Get last punch state for employee"""

# Kiosk
@frappe.whitelist(allow_guest=True)
def kiosk_login(device_id, pin):
    """Authenticate kiosk device"""

@frappe.whitelist(allow_guest=True)
def sync_offline_queue(punches, device_id):
    """Sync offline punches with idempotency"""

# Shift Swaps
@frappe.whitelist()
def create_swap_request(requester_shift, target_employee):
    """Create shift swap request"""

@frappe.whitelist()
def respond_to_swap(swap_id, action, notes):
    """Accept/Decline swap by target"""

@frappe.whitelist()
def approve_swap(swap_id, action, notes):
    """Approve/Reject swap by manager"""
```

### 2.3 Web Pages (Frappe)

- `/kiosk` - Full-screen kiosk interface
- `/staff-portal` - Staff self-service portal

## Phase 3: Kiosk UI

### Features
1. Device PIN login
2. QR Scanner (camera-based)
3. Success/Error screens with auto-reset
4. Offline mode indicator + queue count
5. Manager override modal
6. High contrast mode toggle

### Tech
- Frappe web page served at `/kiosk`
- IndexedDB for offline storage
- Service Worker for offline capability
- Camera API for QR scanning

## Phase 4: Mobile Authenticator (React Native)

### Screens
1. **Enroll Screen**
   - Camera for scanning enrollment QR
   - Parse and store TOTP secret
   - Secure storage (Keychain/Keystore)

2. **QR Display Screen**
   - Generate rotating QR every 30 seconds
   - Show countdown timer
   - Full brightness mode
   - Low battery warning

### Dependencies
- react-native-camera / expo-camera
- react-native-keychain
- otplib (TOTP generation)
- react-native-qrcode-svg

## Phase 5: Deployment

### Docker Production Layout
```
├── docker-compose.yml
├── .env
├── nginx/
│   └── nginx.conf (reverse proxy + TLS)
├── certbot/
│   └── (Let's Encrypt certs)
├── volumes/
│   ├── sites/
│   ├── logs/
│   └── mysql/
└── backup/
    └── scripts/
```

### Multi-tenant Setup
- Each Care Home = Frappe Company
- Employees linked to Company
- Kiosk Devices linked to Care Home
- Data isolation via Company filters

## Deliverables Summary

1. ✅ Docker Compose for Frappe HRMS
2. ✅ carehome_clocking custom app
3. ✅ Doctypes and fields
4. ✅ REST API / Server methods
5. ✅ Kiosk UI web page
6. ✅ React Native mobile app structure
7. ✅ Deployment guide
