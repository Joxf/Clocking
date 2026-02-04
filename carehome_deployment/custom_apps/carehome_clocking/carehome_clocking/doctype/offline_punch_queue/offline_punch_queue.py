import frappe
from frappe.model.document import Document
from datetime import datetime


class OfflinePunchQueue(Document):
    def before_insert(self):
        # Check for duplicate offline_id (idempotency)
        if frappe.db.exists('Offline Punch Queue', self.offline_id):
            frappe.throw(f"Punch with offline_id {self.offline_id} already exists")
    
    def sync_to_hrms(self):
        """Create Employee Checkin in HRMS"""
        try:
            # Check if already synced
            if self.sync_status == 'Synced' and self.checkin_reference:
                return self.checkin_reference
            
            # Create Employee Checkin (uses HRMS doctype)
            checkin = frappe.get_doc({
                'doctype': 'Employee Checkin',
                'employee': self.employee,
                'time': self.timestamp_local,
                'log_type': self.punch_type,
                'device_id': self.device or 'Offline',
                'skip_auto_attendance': 0
            })
            checkin.insert(ignore_permissions=True)
            
            # Update sync status
            self.db_set('sync_status', 'Synced')
            self.db_set('synced_at', datetime.now())
            self.db_set('checkin_reference', checkin.name)
            
            return checkin.name
            
        except Exception as e:
            self.db_set('sync_status', 'Error')
            self.db_set('error_message', str(e))
            frappe.log_error(f"Failed to sync punch {self.offline_id}: {str(e)}", "Offline Sync Error")
            raise
