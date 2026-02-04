"""
Document event handlers for CareHome Clocking
"""

import frappe


def on_checkin_insert(doc, method):
    """
    Called after Employee Checkin is inserted
    Can be used for real-time notifications
    """
    # Publish event for real-time updates
    frappe.publish_realtime(
        event='employee_checkin',
        message={
            'employee': doc.employee,
            'log_type': doc.log_type,
            'time': doc.time.isoformat() if doc.time else None
        },
        doctype='Employee Checkin'
    )
