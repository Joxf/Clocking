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
    
    for record in pending:
        try:
            doc = frappe.get_doc('Offline Punch Queue', record.name)
            doc.sync_to_hrms()
        except Exception as e:
            frappe.log_error(f"Failed to sync {record.name}: {str(e)}")
    
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
    
    frappe.db.commit()
