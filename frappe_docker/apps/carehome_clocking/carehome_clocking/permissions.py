"""
Custom permission handlers
"""

import frappe


def staff_enrollment_permission(doc, user=None, permission_type=None):
    """
    Custom permission check for Staff Enrollment
    """
    if not user:
        user = frappe.session.user
    
    # System Manager always has access
    if 'System Manager' in frappe.get_roles(user):
        return True
    
    # HR Manager and Care Home Manager can manage enrollments
    if 'HR Manager' in frappe.get_roles(user) or 'Care Home Manager' in frappe.get_roles(user):
        return True
    
    # Employees can only view their own enrollment
    if permission_type == 'read':
        user_employee = frappe.db.get_value('Employee', {'user_id': user})
        if user_employee and doc.employee == user_employee:
            return True
    
    return False
