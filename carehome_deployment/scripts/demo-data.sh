#!/bin/bash
# CareHome Clocking - Demo Data Setup
# Run after initial setup to populate demo data

set -e

echo "========================================="
echo "  CareHome Clocking - Demo Data Setup"
echo "========================================="

# Load environment
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

echo "[1/4] Creating demo company and departments..."
docker-compose exec -T backend bench --site $FRAPPE_SITE_NAME execute "
import frappe

# Create Company
if not frappe.db.exists('Company', 'Sunrise Care Home'):
    company = frappe.get_doc({
        'doctype': 'Company',
        'company_name': 'Sunrise Care Home',
        'abbr': 'SCH',
        'default_currency': 'GBP',
        'country': 'United Kingdom'
    })
    company.insert(ignore_permissions=True)
    print('Company created')

# Create Departments
for dept in ['Nursing', 'Administration', 'Kitchen', 'Housekeeping']:
    if not frappe.db.exists('Department', dept + ' - SCH'):
        d = frappe.get_doc({
            'doctype': 'Department',
            'department_name': dept,
            'company': 'Sunrise Care Home'
        })
        d.insert(ignore_permissions=True)
        print(f'Department {dept} created')

frappe.db.commit()
"

echo "[2/4] Creating shift types..."
docker-compose exec -T backend bench --site $FRAPPE_SITE_NAME execute "
import frappe
from datetime import time

shifts = [
    {'name': 'Day Shift', 'start': '07:00:00', 'end': '15:00:00'},
    {'name': 'Evening Shift', 'start': '15:00:00', 'end': '23:00:00'},
    {'name': 'Night Shift', 'start': '23:00:00', 'end': '07:00:00'},
]

for shift in shifts:
    if not frappe.db.exists('Shift Type', shift['name']):
        s = frappe.get_doc({
            'doctype': 'Shift Type',
            'name': shift['name'],
            'start_time': shift['start'],
            'end_time': shift['end'],
            'enable_auto_attendance': 1
        })
        s.insert(ignore_permissions=True)
        print(f'Shift Type {shift[\"name\"]} created')

frappe.db.commit()
"

echo "[3/4] Creating Care Home and Kiosk Devices..."
docker-compose exec -T backend bench --site $FRAPPE_SITE_NAME execute "
import frappe
import hashlib

# Create Care Home
if not frappe.db.exists('Care Home', 'Sunrise Care Home'):
    ch = frappe.get_doc({
        'doctype': 'Care Home',
        'care_home_name': 'Sunrise Care Home',
        'company': 'Sunrise Care Home',
        'timezone': 'Europe/London',
        'address': '123 Care Street, London, UK',
        'is_active': 1
    })
    ch.insert(ignore_permissions=True)
    print('Care Home created')

# Create Kiosk Devices
kiosks = [
    {'name': 'Main Entrance Kiosk', 'location': 'Main Entrance', 'pin': '123456'},
    {'name': 'Staff Room Kiosk', 'location': 'Staff Room', 'pin': '654321'},
    {'name': 'Back Door Kiosk', 'location': 'Back Door', 'pin': '111222'},
]

for kiosk in kiosks:
    existing = frappe.db.get_value('Kiosk Device', {'device_name': kiosk['name']})
    if not existing:
        pin_hash = hashlib.sha256(kiosk['pin'].encode()).hexdigest()
        k = frappe.get_doc({
            'doctype': 'Kiosk Device',
            'device_name': kiosk['name'],
            'location_name': kiosk['location'],
            'care_home': 'Sunrise Care Home',
            'device_pin_hash': pin_hash,
            'is_active': 1
        })
        k.insert(ignore_permissions=True)
        print(f'Kiosk Device {kiosk[\"name\"]} created (PIN: {kiosk[\"pin\"]})')

frappe.db.commit()
"

echo "[4/4] Creating demo employees..."
docker-compose exec -T backend bench --site $FRAPPE_SITE_NAME execute "
import frappe
from datetime import date

employees = [
    {'name': 'Sarah Johnson', 'dept': 'Nursing', 'designation': 'Senior Nurse'},
    {'name': 'Michael Chen', 'dept': 'Nursing', 'designation': 'Nurse'},
    {'name': 'Emma Williams', 'dept': 'Nursing', 'designation': 'Nurse'},
    {'name': 'James Brown', 'dept': 'Administration', 'designation': 'HR Manager'},
    {'name': 'Lisa Davis', 'dept': 'Kitchen', 'designation': 'Chef'},
    {'name': 'Robert Wilson', 'dept': 'Housekeeping', 'designation': 'Cleaner'},
]

for emp in employees:
    existing = frappe.db.get_value('Employee', {'employee_name': emp['name']})
    if not existing:
        e = frappe.get_doc({
            'doctype': 'Employee',
            'employee_name': emp['name'],
            'first_name': emp['name'].split()[0],
            'last_name': emp['name'].split()[-1],
            'gender': 'Female' if emp['name'].split()[0] in ['Sarah', 'Emma', 'Lisa'] else 'Male',
            'date_of_birth': date(1990, 1, 1),
            'date_of_joining': date(2024, 1, 1),
            'company': 'Sunrise Care Home',
            'department': emp['dept'] + ' - SCH',
            'designation': emp['designation'],
            'status': 'Active'
        })
        e.insert(ignore_permissions=True)
        print(f'Employee {emp[\"name\"]} created')

frappe.db.commit()
"

echo ""
echo "========================================="
echo "  Demo Data Setup Complete!"
echo "========================================="
echo ""
echo "Created:"
echo "  - Company: Sunrise Care Home"
echo "  - Departments: Nursing, Administration, Kitchen, Housekeeping"
echo "  - Shift Types: Day Shift, Evening Shift, Night Shift"
echo "  - Care Home: Sunrise Care Home"
echo "  - 3 Kiosk Devices (PINs: 123456, 654321, 111222)"
echo "  - 6 Demo Employees"
echo ""
