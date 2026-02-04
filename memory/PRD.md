# CareHome Clocking - Product Requirements Document

## Project Overview

**Product Name:** CareHome Clocking  
**Version:** 1.0.0  
**Created:** January 2026  
**Last Updated:** February 2026

### Problem Statement
Care homes need a reliable, offline-capable attendance system that:
- Works on wall-mounted tablets
- Eliminates buddy punching with rotating QR codes
- Integrates with existing HRMS for leave and payroll
- Supports shift swaps with approval workflow
- Provides full HR functionality (lifecycle, expenses, performance, payroll)

### Solution
Clone and extend Frappe HRMS with custom clocking module using TOTP-based QR codes and mobile authenticator app.

---

## User Personas

### 1. Care Staff (Frontline Workers)
- **Goals:** Quick clock in/out, view hours, request leave/swaps
- **Pain Points:** Slow systems, badge issues, shift conflicts
- **Uses:** Mobile authenticator app, kiosk

### 2. Care Home Manager
- **Goals:** Monitor attendance, approve requests, handle overrides, manage team
- **Pain Points:** Manual corrections, shift coverage gaps, expense approvals
- **Uses:** HRMS dashboard, enrollment QR generator

### 3. HR Administrator
- **Goals:** Manage employee lifecycle, configure payroll, run reports
- **Uses:** Full Frappe HRMS desk, custom reports

### 4. System Administrator
- **Goals:** Configure system, manage devices, ensure uptime
- **Uses:** Frappe Desk, Docker management

---

## Core Requirements

### Must Have (P0) - Frappe HRMS
- [x] Employee Management
- [x] Employee Lifecycle (onboarding, promotions, transfers)
- [x] Leave Management (policies, applications, approvals)
- [x] Attendance (check-in/out, auto attendance)
- [x] Expense Claims (multi-level workflow)
- [x] Performance Management (goals, KRAs, appraisals)
- [x] Payroll (salary structures, tax slabs, payroll runs)
- [x] Reports and Dashboards

### Must Have (P0) - CareHome Clocking
- [x] TOTP-based rotating QR codes
- [x] Kiosk UI for tablet clocking
- [x] Offline queue with sync
- [x] Mobile authenticator app (React Native)
- [x] Staff enrollment workflow
- [x] Auto IN/OUT detection
- [x] Manager override capability
- [x] Multi-tenant (multiple care homes)

### Should Have (P1)
- [x] Shift swap workflow
- [x] High contrast kiosk mode
- [x] Battery warning in mobile app
- [x] Real-time dashboard
- [ ] Push notifications for swaps

### Nice to Have (P2)
- [ ] Geofencing validation
- [ ] Photo capture at clock-in
- [ ] Voice announcements
- [ ] Smartwatch companion app

---

## What's Been Implemented

### February 2026 - Full Implementation

**Frappe HRMS (Cloned)**
- Full HRMS repository cloned from https://github.com/frappe/hrms
- Docker deployment configuration based on https://github.com/frappe/frappe_docker
- All standard HRMS features available

**Custom App: carehome_clocking**
- 5 Custom Doctypes: Care Home, Kiosk Device, Staff Enrollment, Offline Punch Queue, Shift Swap Request
- Complete API module (api.py) with 15+ endpoints
- Scheduled tasks for queue sync and token cleanup
- Event handlers for realtime updates

**Docker Deployment**
- Full docker-compose.yml with all services
- MariaDB, Redis (cache + queue), Nginx
- Worker containers (short + long queues)
- Scheduler container
- SSL/Let's Encrypt ready
- Backup scripts

**Kiosk UI**
- Full-screen web interface
- PIN-authenticated device login
- QR scanner with camera
- Success/error screens with auto-reset
- Offline mode indicator
- High contrast accessibility mode
- Manager override modal

**Mobile Authenticator (React Native)**
- Enrollment via QR scan
- TOTP-based rotating QR display (30s)
- Secure storage (Keychain/Keystore)
- Battery warning feature
- Ready for Play Store/App Store

**Demo Frontend (React)**
- Dashboard preview
- Kiosk simulation
- Mobile app preview

---

## Technical Architecture

### Stack
- **Backend:** Frappe Framework v15 + ERPNext + HRMS (Python, MariaDB)
- **Custom App:** carehome_clocking (Python, Frappe)
- **Kiosk:** Frappe web page (HTML/CSS/JS)
- **Mobile:** React Native (iOS/Android)
- **Deployment:** Docker Compose

### Services
- MariaDB 10.11
- Redis 7 (cache + queue)
- Frappe Backend (Gunicorn)
- Frappe Websocket (Socket.io)
- Workers (short + long queues)
- Scheduler
- Nginx (reverse proxy + SSL)

### Security
- TOTP with 30s window, ±1 drift tolerance
- PIN hashing (SHA256) for devices
- Encrypted TOTP secrets (Fernet)
- Role-based access control
- Audit trail for all actions

---

## Deployment Guide Summary

### Prerequisites
- Linux server (Ubuntu 22.04)
- Docker 24+ / Docker Compose v2
- 4GB RAM (8GB recommended)
- 20GB disk space

### Quick Deploy
```bash
cd /app/carehome_deployment
cp .env.example .env
# Configure .env
docker-compose build
docker-compose up -d
./scripts/setup.sh
```

### URLs After Deployment
- Main App: http://localhost:8080
- Kiosk: http://localhost:8080/kiosk
- Staff Portal: http://localhost:8080/staff-portal

---

## Backlog / Future Enhancements

### P0 Remaining
- [ ] Production deployment testing
- [ ] Mobile app store submission

### P1 Features
- [ ] Push notifications (Firebase/APNs)
- [ ] Bulk employee enrollment
- [ ] Shift schedule visualization
- [ ] Custom reports for clocking

### P2 Features
- [ ] Multi-language support (i18n)
- [ ] WhatsApp notifications
- [ ] Advanced payroll integrations
- [ ] Mobile manager dashboard

---

## Success Metrics

- Clock-in time < 5 seconds
- Offline sync success rate > 99%
- Mobile app enrollment success > 95%
- Manager override usage < 1%
- Staff satisfaction score > 4/5

---

## Files Reference

| Path | Description |
|------|-------------|
| `/app/carehome_deployment/` | Main deployment package |
| `/app/carehome_deployment/docker-compose.yml` | Docker services |
| `/app/carehome_deployment/custom_apps/carehome_clocking/` | Custom Frappe app |
| `/app/frappe_setup/hrms/` | Cloned HRMS repository |
| `/app/mobile_app/` | React Native app |
| `/app/frontend/` | Demo UI |
