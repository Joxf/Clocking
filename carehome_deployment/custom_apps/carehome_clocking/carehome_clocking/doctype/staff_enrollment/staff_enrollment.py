import frappe
from frappe.model.document import Document
import pyotp
import secrets
from datetime import datetime, timedelta
from cryptography.fernet import Fernet
import base64
import os


class StaffEnrollment(Document):
    def get_encryption_key(self):
        key = frappe.conf.get('encryption_key') or os.environ.get('ENCRYPTION_KEY')
        if not key:
            # Generate a key if not configured (for development)
            key = Fernet.generate_key().decode()
            frappe.conf['encryption_key'] = key
        # Ensure key is properly formatted
        if len(key) == 32:
            key = base64.urlsafe_b64encode(key.encode()).decode()
        return key.encode()
    
    def encrypt_secret(self, secret):
        f = Fernet(self.get_encryption_key())
        return f.encrypt(secret.encode()).decode()
    
    def decrypt_secret(self):
        if not self.totp_secret_encrypted:
            return None
        f = Fernet(self.get_encryption_key())
        return f.decrypt(self.totp_secret_encrypted.encode()).decode()
    
    def generate_enrollment(self):
        """Generate new TOTP secret and enrollment token"""
        # Generate TOTP secret
        totp_secret = pyotp.random_base32()
        
        # Encrypt and store
        self.totp_secret_encrypted = self.encrypt_secret(totp_secret)
        
        # Generate enrollment token
        self.enrollment_token = secrets.token_urlsafe(32)
        self.token_expires_at = datetime.now() + timedelta(minutes=10)
        
        # Reset enrollment status
        self.is_enrolled = 0
        self.enrolled_at = None
        
        self.save(ignore_permissions=True)
        
        return {
            'totp_secret': totp_secret,
            'enrollment_token': self.enrollment_token,
            'expires_at': self.token_expires_at.isoformat()
        }
    
    def complete_enrollment(self, token):
        """Mark enrollment as complete"""
        if self.enrollment_token != token:
            frappe.throw("Invalid enrollment token")
        
        if datetime.now() > self.token_expires_at:
            frappe.throw("Enrollment token has expired")
        
        self.is_enrolled = 1
        self.enrolled_at = datetime.now()
        self.enrollment_token = None  # Clear token after use
        self.save(ignore_permissions=True)
        
        return True
    
    def validate_totp(self, code):
        """Validate TOTP code with drift tolerance"""
        if not self.is_enrolled:
            return False
        
        secret = self.decrypt_secret()
        if not secret:
            return False
        
        totp = pyotp.TOTP(secret)
        # valid_window=1 allows +/- 1 time step (30 seconds)
        is_valid = totp.verify(code, valid_window=1)
        
        if is_valid:
            self.db_set('last_validated_at', datetime.now())
        
        return is_valid
