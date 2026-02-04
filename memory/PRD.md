# CareHome Clocking - Product Requirements Document

## Project Overview

**Product Name:** CareHome Clocking  
**Version:** 1.0.0  
**Created:** January 2026  

### Problem Statement
Care homes need a reliable, offline-capable attendance system that:
- Works on wall-mounted tablets
- Eliminates buddy punching with rotating QR codes
- Integrates with existing HRMS for leave and payroll
- Supports shift swaps with approval workflow

### Solution
Extend Frappe HRMS with custom clocking module using TOTP-based QR codes and mobile authenticator app.

---

## User Personas

### 1. Care Staff (Frontline Workers)
- **Goals:** Quick clock in/out, view hours, request leave/swaps
- **Pain Points:** Slow systems, badge issues, shift conflicts
- **Uses:** Mobile authenticator app, kiosk

### 2. Care Home Manager
- **Goals:** Monitor attendance, approve requests, handle overrides
- **Pain Points:** Manual corrections, shift coverage gaps
- **Uses:** Admin dashboard, enrollment QR generator

### 3. System Administrator
- **Goals:** Configure system, manage devices, ensure uptime
- **Uses:** Frappe Desk, Docker management

---

## Core Requirements

### Must Have (P0)
- [x] TOTP-based rotating QR codes
- [x] Kiosk UI for tablet clocking
- [x] Offline queue with sync
- [x] Mobile authenticator app
- [x] Staff enrollment workflow
- [x] Auto IN/OUT detection
- [x] Manager override capability
- [x] Multi-tenant (multiple care homes)

### Should Have (P1)
- [x] Shift swap workflow
- [x] High contrast mode for kiosk
- [x] Battery warning in mobile app
- [x] Real-time dashboard
- [ ] Push notifications for swaps
- [ ] Biometric fallback (future)

### Nice to Have (P2)
- [ ] Geofencing validation
- [ ] Photo capture at clock-in
- [ ] Voice announcements
- [ ] Smartwatch companion app

---

## What's Been Implemented

### January 2026 - Initial MVP

**Backend (Frappe App)**
- Custom app: `carehome_clocking`
- Doctypes: Care Home, Kiosk Device, Staff Enrollment, Offline Punch Queue, Shift Swap Request
- API endpoints: enrollment, validation, sync, dashboard data
- Scheduled tasks: queue sync, token cleanup

**Kiosk UI**
- Full-screen web interface at `/kiosk`
- PIN login for device authentication
- Camera-based QR scanning
- Success/error screens with auto-reset
- Offline mode with local queue
- High contrast accessibility mode

**Staff Portal**
- Self-service web interface at `/staff-portal`
- View clock status and history
- Leave request integration
- Shift swap requests

**Mobile Authenticator**
- React Native app structure
- Enrollment via QR scan
- TOTP-based rotating QR display
- Secure storage for secrets
- Battery warning feature

**Infrastructure**
- Docker Compose setup
- Nginx reverse proxy
- SSL/Let's Encrypt ready
- Backup scripts

---

## Technical Architecture

### Stack
- **Backend:** Frappe Framework + HRMS (Python, MariaDB)
- **Kiosk:** Frappe web page (HTML/CSS/JS)
- **Mobile:** React Native (iOS/Android)
- **Deployment:** Docker Compose

### Security
- TOTP with 30s window, ±1 drift tolerance
- PIN hashing for devices
- Encrypted TOTP secrets
- Role-based access control
- Audit trail for all actions

---

## Backlog / Future Enhancements

### P0 Remaining
- [ ] Integration testing suite
- [ ] Production deployment validation
- [ ] Mobile app store submission

### P1 Features
- [ ] Push notifications (Firebase/APNs)
- [ ] Bulk employee enrollment
- [ ] Shift schedule visualization
- [ ] Reports and analytics dashboard

### P2 Features
- [ ] Multi-language support
- [ ] WhatsApp notifications
- [ ] Payroll integration enhancements
- [ ] Mobile manager dashboard

---

## Next Steps

1. **Testing:** Full end-to-end testing with test data
2. **Mobile Build:** Generate production APK/IPA
3. **Pilot:** Deploy to single care home for validation
4. **Documentation:** User guides for staff and managers
5. **Training:** Onboarding materials

---

## Success Metrics

- Clock-in time < 5 seconds
- Offline sync success rate > 99%
- Mobile app enrollment success > 95%
- Manager override usage < 1%
- Staff satisfaction score > 4/5
