import frappe
from frappe.model.document import Document
import hashlib
import secrets
from datetime import datetime, timedelta


class KioskDevice(Document):
    def before_insert(self):
        # Generate initial PIN if not set
        if not self.device_pin_hash:
            pin = self.generate_pin()
            self.device_pin_hash = self.hash_pin(pin)
            frappe.msgprint(f"Device PIN: {pin} (save this, it won't be shown again)")
    
    def validate(self):
        if not self.care_home:
            frappe.throw("Care Home is required")
    
    @staticmethod
    def generate_pin(length=6):
        return ''.join([str(secrets.randbelow(10)) for _ in range(length)])
    
    @staticmethod
    def hash_pin(pin):
        return hashlib.sha256(pin.encode()).hexdigest()
    
    def verify_pin(self, pin):
        return self.device_pin_hash == self.hash_pin(pin)
    
    def create_session(self):
        token = secrets.token_urlsafe(32)
        self.session_token = token
        self.session_expires_at = datetime.now() + timedelta(hours=24)
        self.save(ignore_permissions=True)
        return token
    
    def update_last_seen(self):
        self.db_set('last_seen_at', datetime.now())
