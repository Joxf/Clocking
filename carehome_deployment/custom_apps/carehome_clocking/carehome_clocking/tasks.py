"""
Scheduled tasks for CareHome Clocking
"""

import frappe
from datetime import datetime, timedelta


def sync_offline_queues():
    """
    Hourly task to retry failed syncs
    """
    pending = frappe.get_all(
        'Offline Punch Queue',
        filters={'sync_status': ['in', ['Pending', 'Error']]},
        fields=['name'],
        limit=100
    )
    
    synced = 0
    errors = 0
    
    for record in pending:
        try:
            doc = frappe.get_doc('Offline Punch Queue', record.name)
            doc.sync_to_hrms()
            synced += 1
        except Exception as e:
            errors += 1
            frappe.log_error(f"Failed to sync {record.name}: {str(e)}")
    
    if synced or errors:
        frappe.logger().info(f"Offline sync: {synced} synced, {errors} errors")
    
    frappe.db.commit()


def cleanup_expired_tokens():
    """
    Daily task to clean up expired enrollment tokens
    """
    expired = frappe.get_all(
        'Staff Enrollment',
        filters={
            'enrollment_token': ['is', 'set'],
            'token_expires_at': ['<', datetime.now()]
        },
        fields=['name']
    )
    
    for record in expired:
        frappe.db.set_value(
            'Staff Enrollment', 
            record.name, 
            'enrollment_token', 
            None
        )
    
    if expired:
        frappe.logger().info(f"Cleaned up {len(expired)} expired enrollment tokens")
    
    frappe.db.commit()
