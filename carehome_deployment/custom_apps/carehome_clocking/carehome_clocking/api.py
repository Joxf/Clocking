"""
CareHome Clocking API

Public REST API endpoints for:
- Kiosk authentication and operations
- Staff enrollment
- TOTP validation
- Offline sync
- Shift swap management
"""

import frappe
import json
import pyotp
import qrcode
import io
import base64
from datetime import datetime, timedelta
import secrets
import hashlib


# ==========================================
# KIOSK AUTHENTICATION
# ==========================================

@frappe.whitelist(allow_guest=True)
def kiosk_login(device_id, pin):
    """
    Authenticate kiosk device with PIN
    
    Args:
        device_id: Kiosk device ID (e.g., KIOSK-00001)
        pin: Device PIN (4-6 digits)
    
    Returns:
        dict: Session token and device info
    """
    try:
        device = frappe.get_doc('Kiosk Device', device_id)
        
        if not device.is_active:
            return {'success': False, 'error': 'Device is inactive'}
        
        if not device.verify_pin(pin):
            frappe.log_error(f"Invalid PIN attempt for device {device_id}", "Kiosk Security")
            return {'success': False, 'error': 'Invalid PIN'}
        
        # Create session
        token = device.create_session()
        device.update_last_seen()
        
        # Get care home info
        care_home = frappe.get_doc('Care Home', device.care_home)
        
        return {
            'success': True,
            'token': token,
            'device': {
                'id': device.name,
                'name': device.device_name,
                'location': device.location_name,
                'care_home': device.care_home,
                'care_home_name': care_home.care_home_name
            }
        }
    except frappe.DoesNotExistError:
        return {'success': False, 'error': 'Device not found'}
    except Exception as e:
        frappe.log_error(f"Kiosk login error: {str(e)}", "Kiosk Error")
        return {'success': False, 'error': 'Login failed'}


@frappe.whitelist(allow_guest=True)
def kiosk_heartbeat(device_id, token, queue_size=0):
    """
    Update device heartbeat and queue size
    """
    try:
        device = frappe.get_doc('Kiosk Device', device_id)
        
        if device.session_token != token:
            return {'success': False, 'error': 'Invalid session'}
        
        if device.session_expires_at and device.session_expires_at < datetime.now():
            return {'success': False, 'error': 'Session expired'}
        
        device.update_last_seen()
        device.db_set('offline_queue_size', int(queue_size))
        
        return {'success': True}
    except Exception as e:
        return {'success': False, 'error': str(e)}


# ==========================================
# STAFF ENROLLMENT
# ==========================================

@frappe.whitelist()
def initiate_enrollment(employee_id):
    """
    Generate enrollment QR for employee
    Manager triggers this to enroll staff phone
    """
    frappe.only_for(['HR Manager', 'Care Home Manager', 'System Manager'])
    
    try:
        # Get or create enrollment record
        enrollment_name = frappe.db.get_value(
            'Staff Enrollment', 
            {'employee': employee_id}
        )
        
        if enrollment_name:
            enrollment = frappe.get_doc('Staff Enrollment', enrollment_name)
        else:
            enrollment = frappe.get_doc({
                'doctype': 'Staff Enrollment',
                'employee': employee_id
            })
            enrollment.insert(ignore_permissions=True)
        
        # Generate new enrollment
        data = enrollment.generate_enrollment()
        
        # Get employee info
        employee = frappe.get_doc('Employee', employee_id)
        
        # Generate enrollment QR payload
        qr_payload = json.dumps({
            'type': 'enrollment',
            'employee_id': employee_id,
            'employee_name': employee.employee_name,
            'totp_secret': data['totp_secret'],
            'enrollment_token': data['enrollment_token'],
            'expires_at': data['expires_at']
        })
        
        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(qr_payload)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        qr_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        return {
            'success': True,
            'qr_image': f"data:image/png;base64,{qr_base64}",
            'employee_name': employee.employee_name,
            'expires_at': data['expires_at'],
            'enrollment_token': data['enrollment_token']
        }
        
    except Exception as e:
        frappe.log_error(f"Enrollment error: {str(e)}", "Enrollment Error")
        return {'success': False, 'error': str(e)}


@frappe.whitelist(allow_guest=True)
def complete_enrollment(employee_id, enrollment_token):
    """
    Complete enrollment from mobile app
    """
    try:
        enrollment_name = frappe.db.get_value(
            'Staff Enrollment',
            {'employee': employee_id}
        )
        
        if not enrollment_name:
            return {'success': False, 'error': 'Enrollment not found'}
        
        enrollment = frappe.get_doc('Staff Enrollment', enrollment_name)
        enrollment.complete_enrollment(enrollment_token)
        
        return {
            'success': True,
            'message': 'Enrollment completed successfully'
        }
        
    except Exception as e:
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def get_enrollment_status(employee_id):
    """
    Get enrollment status for an employee
    """
    try:
        enrollment_name = frappe.db.get_value(
            'Staff Enrollment',
            {'employee': employee_id}
        )
        
        if not enrollment_name:
            return {
                'is_enrolled': False,
                'enrolled_at': None,
                'last_validated_at': None
            }
        
        enrollment = frappe.get_doc('Staff Enrollment', enrollment_name)
        
        return {
            'is_enrolled': bool(enrollment.is_enrolled),
            'enrolled_at': enrollment.enrolled_at,
            'last_validated_at': enrollment.last_validated_at
        }
        
    except Exception as e:
        return {'error': str(e)}


# ==========================================
# TOKEN VALIDATION & CHECKIN
# ==========================================

@frappe.whitelist(allow_guest=True)
def validate_token(employee_id, totp_code, device_id=None):
    """
    Validate TOTP code and create checkin
    Auto determines IN/OUT based on last punch
    """
    try:
        # Get enrollment
        enrollment_name = frappe.db.get_value(
            'Staff Enrollment',
            {'employee': employee_id}
        )
        
        if not enrollment_name:
            return {'success': False, 'error': 'Employee not enrolled'}
        
        enrollment = frappe.get_doc('Staff Enrollment', enrollment_name)
        
        if not enrollment.is_enrolled:
            return {'success': False, 'error': 'Employee enrollment not complete'}
        
        # Validate TOTP
        if not enrollment.validate_totp(totp_code):
            return {'success': False, 'error': 'Invalid code'}
        
        # Check cooldown (2 minutes)
        last_checkin = frappe.get_all(
            'Employee Checkin',
            filters={'employee': employee_id},
            fields=['time', 'log_type'],
            order_by='time desc',
            limit=1
        )
        
        if last_checkin:
            time_diff = datetime.now() - last_checkin[0].time
            if time_diff.total_seconds() < 120:  # 2 minutes
                return {
                    'success': False, 
                    'error': 'Please wait before clocking again',
                    'cooldown_remaining': 120 - int(time_diff.total_seconds())
                }
        
        # Determine IN/OUT
        punch_type = 'IN'
        if last_checkin and last_checkin[0].log_type == 'IN':
            punch_type = 'OUT'
        
        # Create checkin using HRMS Employee Checkin doctype
        checkin = frappe.get_doc({
            'doctype': 'Employee Checkin',
            'employee': employee_id,
            'time': datetime.now(),
            'log_type': punch_type,
            'device_id': device_id or 'QR Auth'
        })
        checkin.insert(ignore_permissions=True)
        frappe.db.commit()
        
        # Get employee name
        employee = frappe.get_doc('Employee', employee_id)
        
        return {
            'success': True,
            'checkin_id': checkin.name,
            'employee_name': employee.employee_name,
            'punch_type': punch_type,
            'time': checkin.time.isoformat()
        }
        
    except Exception as e:
        frappe.log_error(f"Token validation error: {str(e)}", "Validation Error")
        return {'success': False, 'error': 'Validation failed'}


@frappe.whitelist(allow_guest=True)
def get_employee_state(employee_id, device_id=None):
    """
    Get current clock state for employee
    """
    try:
        employee = frappe.get_doc('Employee', employee_id)
        
        last_checkin = frappe.get_all(
            'Employee Checkin',
            filters={'employee': employee_id},
            fields=['time', 'log_type', 'device_id'],
            order_by='time desc',
            limit=1
        )
        
        if last_checkin:
            return {
                'success': True,
                'employee_name': employee.employee_name,
                'current_state': last_checkin[0].log_type,
                'last_punch_time': last_checkin[0].time.isoformat(),
                'next_action': 'OUT' if last_checkin[0].log_type == 'IN' else 'IN'
            }
        else:
            return {
                'success': True,
                'employee_name': employee.employee_name,
                'current_state': None,
                'last_punch_time': None,
                'next_action': 'IN'
            }
            
    except frappe.DoesNotExistError:
        return {'success': False, 'error': 'Employee not found'}
    except Exception as e:
        return {'success': False, 'error': str(e)}


# ==========================================
# OFFLINE SYNC
# ==========================================

@frappe.whitelist(allow_guest=True)
def sync_offline_queue(punches, device_id):
    """
    Sync offline punches from kiosk to HRMS
    Implements idempotency via offline_id
    """
    try:
        if isinstance(punches, str):
            punches = json.loads(punches)
        
        results = []
        
        for punch in punches:
            offline_id = punch.get('offline_id')
            
            # Check if already synced (idempotency)
            existing = frappe.db.get_value(
                'Offline Punch Queue',
                {'offline_id': offline_id},
                ['name', 'sync_status', 'checkin_reference']
            )
            
            if existing and existing[1] == 'Synced':
                results.append({
                    'offline_id': offline_id,
                    'status': 'already_synced',
                    'checkin_id': existing[2]
                })
                continue
            
            try:
                # Create or get offline punch record
                if existing:
                    queue_doc = frappe.get_doc('Offline Punch Queue', existing[0])
                else:
                    queue_doc = frappe.get_doc({
                        'doctype': 'Offline Punch Queue',
                        'offline_id': offline_id,
                        'employee': punch.get('employee_id'),
                        'timestamp_local': punch.get('timestamp'),
                        'punch_type': punch.get('punch_type'),
                        'device': device_id,
                        'care_home': punch.get('care_home'),
                        'location': punch.get('location')
                    })
                    queue_doc.insert(ignore_permissions=True)
                
                # Sync to HRMS
                checkin_id = queue_doc.sync_to_hrms()
                
                results.append({
                    'offline_id': offline_id,
                    'status': 'synced',
                    'checkin_id': checkin_id
                })
                
            except Exception as e:
                results.append({
                    'offline_id': offline_id,
                    'status': 'error',
                    'error': str(e)
                })
        
        frappe.db.commit()
        
        # Update device queue size
        if device_id:
            pending_count = frappe.db.count(
                'Offline Punch Queue',
                {'device': device_id, 'sync_status': 'Pending'}
            )
            frappe.db.set_value('Kiosk Device', device_id, 'offline_queue_size', pending_count)
        
        return {
            'success': True,
            'results': results,
            'synced_count': len([r for r in results if r['status'] == 'synced']),
            'error_count': len([r for r in results if r['status'] == 'error'])
        }
        
    except Exception as e:
        frappe.log_error(f"Offline sync error: {str(e)}", "Sync Error")
        return {'success': False, 'error': str(e)}


# ==========================================
# SHIFT SWAPS
# ==========================================

@frappe.whitelist()
def create_swap_request(target_employee, swap_date, requester_shift=None, notes=None):
    """
    Create a shift swap request
    """
    try:
        # Get current user's employee
        user_employee = frappe.db.get_value(
            'Employee', 
            {'user_id': frappe.session.user}
        )
        
        if not user_employee:
            return {'success': False, 'error': 'User not linked to employee'}
        
        swap = frappe.get_doc({
            'doctype': 'Shift Swap Request',
            'requester': user_employee,
            'requester_shift': requester_shift,
            'target_employee': target_employee,
            'swap_date': swap_date,
            'requester_notes': notes,
            'status': 'Proposed'
        })
        swap.insert()
        frappe.db.commit()
        
        return {
            'success': True,
            'swap_id': swap.name,
            'status': swap.status
        }
        
    except Exception as e:
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def respond_to_swap(swap_id, action, notes=None):
    """
    Target employee responds to swap request
    action: 'accept' or 'decline'
    """
    try:
        swap = frappe.get_doc('Shift Swap Request', swap_id)
        
        # Verify current user is target employee
        user_employee = frappe.db.get_value(
            'Employee',
            {'user_id': frappe.session.user}
        )
        
        if swap.target_employee != user_employee:
            return {'success': False, 'error': 'Not authorized'}
        
        if action == 'accept':
            swap.accept_by_target(notes)
        elif action == 'decline':
            swap.decline_by_target(notes)
        else:
            return {'success': False, 'error': 'Invalid action'}
        
        frappe.db.commit()
        
        return {
            'success': True,
            'swap_id': swap.name,
            'status': swap.status
        }
        
    except Exception as e:
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def approve_swap(swap_id, action, notes=None):
    """
    Manager approves or rejects swap request
    action: 'approve' or 'reject'
    """
    frappe.only_for(['HR Manager', 'Care Home Manager', 'System Manager'])
    
    try:
        swap = frappe.get_doc('Shift Swap Request', swap_id)
        
        if action == 'approve':
            swap.approve_by_manager(notes)
        elif action == 'reject':
            swap.reject_by_manager(notes)
        else:
            return {'success': False, 'error': 'Invalid action'}
        
        frappe.db.commit()
        
        return {
            'success': True,
            'swap_id': swap.name,
            'status': swap.status
        }
        
    except Exception as e:
        return {'success': False, 'error': str(e)}


# ==========================================
# MANAGER DASHBOARD DATA
# ==========================================

@frappe.whitelist()
def get_live_status(care_home=None):
    """
    Get live clocked-in status for dashboard
    """
    frappe.only_for(['HR Manager', 'Care Home Manager', 'System Manager'])
    
    try:
        # Get all employees with their latest checkin
        filters = {'status': 'Active'}
        if care_home:
            company = frappe.db.get_value('Care Home', care_home, 'company')
            if company:
                filters['company'] = company
        
        employees = frappe.get_all(
            'Employee',
            filters=filters,
            fields=['name', 'employee_name', 'company', 'department']
        )
        
        clocked_in = []
        clocked_out = []
        
        for emp in employees:
            last_checkin = frappe.get_all(
                'Employee Checkin',
                filters={'employee': emp.name},
                fields=['time', 'log_type'],
                order_by='time desc',
                limit=1
            )
            
            if last_checkin and last_checkin[0].log_type == 'IN':
                clocked_in.append({
                    'employee_id': emp.name,
                    'employee_name': emp.employee_name,
                    'department': emp.department,
                    'clock_in_time': last_checkin[0].time.isoformat()
                })
            else:
                clocked_out.append({
                    'employee_id': emp.name,
                    'employee_name': emp.employee_name,
                    'department': emp.department,
                    'last_seen': last_checkin[0].time.isoformat() if last_checkin else None
                })
        
        return {
            'success': True,
            'clocked_in': clocked_in,
            'clocked_out': clocked_out,
            'total_in': len(clocked_in),
            'total_out': len(clocked_out)
        }
        
    except Exception as e:
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def get_sync_health():
    """
    Get offline sync health across all kiosks
    """
    frappe.only_for(['HR Manager', 'Care Home Manager', 'System Manager'])
    
    try:
        devices = frappe.get_all(
            'Kiosk Device',
            filters={'is_active': 1},
            fields=['name', 'device_name', 'care_home', 'last_seen_at', 'offline_queue_size', 'location_name']
        )
        
        health_data = []
        for device in devices:
            # Calculate time since last seen
            if device.last_seen_at:
                time_diff = datetime.now() - device.last_seen_at
                minutes_ago = int(time_diff.total_seconds() / 60)
            else:
                minutes_ago = None
            
            health_data.append({
                'device_id': device.name,
                'device_name': device.device_name,
                'location': device.location_name,
                'care_home': device.care_home,
                'last_seen_minutes_ago': minutes_ago,
                'offline_queue_size': device.offline_queue_size or 0,
                'status': 'online' if minutes_ago and minutes_ago < 5 else 'offline'
            })
        
        return {
            'success': True,
            'devices': health_data,
            'total_online': len([d for d in health_data if d['status'] == 'online']),
            'total_offline': len([d for d in health_data if d['status'] == 'offline']),
            'total_pending_syncs': sum(d['offline_queue_size'] for d in health_data)
        }
        
    except Exception as e:
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def manual_correction(employee_id, punch_type, timestamp, reason):
    """
    Manager manually corrects/adds a checkin
    """
    frappe.only_for(['HR Manager', 'Care Home Manager', 'System Manager'])
    
    if not reason or len(reason) < 10:
        return {'success': False, 'error': 'Reason must be at least 10 characters'}
    
    try:
        checkin = frappe.get_doc({
            'doctype': 'Employee Checkin',
            'employee': employee_id,
            'time': timestamp,
            'log_type': punch_type,
            'device_id': 'Manual Correction',
            'skip_auto_attendance': 0
        })
        checkin.insert(ignore_permissions=True)
        
        # Log the correction
        frappe.get_doc({
            'doctype': 'Comment',
            'comment_type': 'Info',
            'reference_doctype': 'Employee Checkin',
            'reference_name': checkin.name,
            'content': f"Manual correction by {frappe.session.user}. Reason: {reason}"
        }).insert(ignore_permissions=True)
        
        frappe.db.commit()
        
        return {
            'success': True,
            'checkin_id': checkin.name
        }
        
    except Exception as e:
        return {'success': False, 'error': str(e)}


# ==========================================
# STAFF PORTAL DATA
# ==========================================

@frappe.whitelist()
def get_my_status():
    """
    Get current user's attendance status
    """
    try:
        user_employee = frappe.db.get_value(
            'Employee',
            {'user_id': frappe.session.user}
        )
        
        if not user_employee:
            return {'success': False, 'error': 'Not an employee'}
        
        employee = frappe.get_doc('Employee', user_employee)
        
        # Today's punches
        today = frappe.utils.today()
        today_punches = frappe.get_all(
            'Employee Checkin',
            filters={
                'employee': user_employee,
                'time': ['>=', today]
            },
            fields=['time', 'log_type'],
            order_by='time asc'
        )
        
        # Recent punches (last 7 days)
        week_ago = frappe.utils.add_days(today, -7)
        recent_punches = frappe.get_all(
            'Employee Checkin',
            filters={
                'employee': user_employee,
                'time': ['>=', week_ago]
            },
            fields=['time', 'log_type'],
            order_by='time desc',
            limit=20
        )
        
        # Calculate weekly hours
        total_hours = 0
        punches_by_day = {}
        for punch in recent_punches:
            day = punch.time.date().isoformat()
            if day not in punches_by_day:
                punches_by_day[day] = []
            punches_by_day[day].append(punch)
        
        for day, day_punches in punches_by_day.items():
            in_time = None
            for p in sorted(day_punches, key=lambda x: x.time):
                if p.log_type == 'IN' and not in_time:
                    in_time = p.time
                elif p.log_type == 'OUT' and in_time:
                    diff = (p.time - in_time).total_seconds() / 3600
                    total_hours += diff
                    in_time = None
        
        # Current state
        current_state = None
        if today_punches:
            current_state = today_punches[-1].log_type
        
        return {
            'success': True,
            'employee_name': employee.employee_name,
            'current_state': current_state,
            'today_punches': [{
                'time': p.time.isoformat(),
                'type': p.log_type
            } for p in today_punches],
            'recent_punches': [{
                'time': p.time.isoformat(),
                'type': p.log_type
            } for p in recent_punches],
            'weekly_hours': round(total_hours, 2)
        }
        
    except Exception as e:
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def get_my_swap_requests():
    """
    Get current user's shift swap requests
    """
    try:
        user_employee = frappe.db.get_value(
            'Employee',
            {'user_id': frappe.session.user}
        )
        
        if not user_employee:
            return {'success': False, 'error': 'Not an employee'}
        
        # Requests I sent
        sent = frappe.get_all(
            'Shift Swap Request',
            filters={'requester': user_employee},
            fields=['name', 'target_employee', 'target_name', 'swap_date', 'status'],
            order_by='creation desc'
        )
        
        # Requests I received
        received = frappe.get_all(
            'Shift Swap Request',
            filters={'target_employee': user_employee},
            fields=['name', 'requester', 'requester_name', 'swap_date', 'status'],
            order_by='creation desc'
        )
        
        return {
            'success': True,
            'sent_requests': sent,
            'received_requests': received
        }
        
    except Exception as e:
        return {'success': False, 'error': str(e)}


# ==========================================
# KIOSK OFFLINE CACHE DATA
# ==========================================

@frappe.whitelist(allow_guest=True)
def get_care_home_employees(care_home, device_id, token):
    """
    Get employee verification data for offline cache
    """
    try:
        # Verify device session
        device = frappe.get_doc('Kiosk Device', device_id)
        if device.session_token != token:
            return {'success': False, 'error': 'Invalid session'}
        
        if device.care_home != care_home:
            return {'success': False, 'error': 'Care home mismatch'}
        
        # Get company for care home
        company = frappe.db.get_value('Care Home', care_home, 'company')
        
        # Get enrolled employees
        employees = frappe.db.sql("""
            SELECT e.name, e.employee_name, se.is_enrolled
            FROM `tabEmployee` e
            LEFT JOIN `tabStaff Enrollment` se ON se.employee = e.name
            WHERE e.company = %s AND e.status = 'Active'
        """, (company,), as_dict=True)
        
        return {
            'success': True,
            'employees': [{
                'id': emp.name,
                'name': emp.employee_name,
                'enrolled': bool(emp.is_enrolled)
            } for emp in employees],
            'cache_time': datetime.now().isoformat()
        }
        
    except Exception as e:
        return {'success': False, 'error': str(e)}
