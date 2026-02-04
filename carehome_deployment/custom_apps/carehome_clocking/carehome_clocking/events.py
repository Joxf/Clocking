"""
Document event handlers for CareHome Clocking
"""

import frappe


def on_checkin_insert(doc, method):
    """
    Called after Employee Checkin is inserted
    Publish realtime event for live dashboard updates
    """
    frappe.publish_realtime(
        event='employee_checkin',
        message={
            'employee': doc.employee,
            'employee_name': frappe.db.get_value('Employee', doc.employee, 'employee_name'),
            'log_type': doc.log_type,
            'time': doc.time.isoformat() if doc.time else None,
            'device_id': doc.device_id
        },
        doctype='Employee Checkin'
    )
