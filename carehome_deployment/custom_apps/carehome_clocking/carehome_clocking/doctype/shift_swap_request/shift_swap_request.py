import frappe
from frappe.model.document import Document
from datetime import datetime


class ShiftSwapRequest(Document):
    def validate(self):
        if self.requester == self.target_employee:
            frappe.throw("Cannot swap shift with yourself")
        
        if self.swap_date and str(self.swap_date) < frappe.utils.today():
            frappe.throw("Cannot swap shifts for past dates")
    
    def accept_by_target(self, notes=None):
        """Target employee accepts the swap request"""
        if self.status != 'Proposed':
            frappe.throw("Can only accept proposed requests")
        
        self.status = 'Accepted'
        if notes:
            self.target_notes = notes
        self.save()
        
        # Notify manager for approval
        self.notify_manager()
    
    def decline_by_target(self, notes=None):
        """Target employee declines the swap request"""
        if self.status != 'Proposed':
            frappe.throw("Can only decline proposed requests")
        
        self.status = 'Declined'
        if notes:
            self.target_notes = notes
        self.save()
    
    def approve_by_manager(self, notes=None):
        """Manager approves the swap"""
        if self.status != 'Accepted':
            frappe.throw("Can only approve accepted requests")
        
        self.status = 'Approved'
        self.approved_by = frappe.session.user
        self.approved_at = datetime.now()
        if notes:
            self.manager_notes = notes
        self.save()
        
        # Execute the swap
        self.execute_swap()
    
    def reject_by_manager(self, notes=None):
        """Manager rejects the swap"""
        if self.status != 'Accepted':
            frappe.throw("Can only reject accepted requests")
        
        self.status = 'Rejected'
        self.approved_by = frappe.session.user
        self.approved_at = datetime.now()
        if notes:
            self.manager_notes = notes
        self.save()
    
    def execute_swap(self):
        """Execute the actual shift swap in HRMS"""
        if self.requester_shift and self.target_shift:
            try:
                # Get shift assignments
                requester_shift = frappe.get_doc('Shift Assignment', self.requester_shift)
                target_shift = frappe.get_doc('Shift Assignment', self.target_shift)
                
                # Swap employees
                temp_employee = requester_shift.employee
                requester_shift.employee = target_shift.employee
                target_shift.employee = temp_employee
                
                requester_shift.save()
                target_shift.save()
                
                frappe.msgprint(f"Shift swap executed for {self.swap_date}")
            except Exception as e:
                frappe.log_error(f"Failed to execute shift swap: {str(e)}", "Shift Swap Error")
    
    def notify_manager(self):
        """Send notification to manager for approval"""
        if self.care_home:
            try:
                managers = frappe.get_all(
                    'Has Role',
                    filters={'role': 'Care Home Manager', 'parenttype': 'User'},
                    fields=['parent']
                )
                for manager in managers:
                    frappe.sendmail(
                        recipients=manager.parent,
                        subject=f"Shift Swap Request Awaiting Approval - {self.name}",
                        message=f"A shift swap request from {self.requester_name} requires your approval."
                    )
            except Exception as e:
                frappe.log_error(f"Failed to notify manager: {str(e)}", "Notification Error")
