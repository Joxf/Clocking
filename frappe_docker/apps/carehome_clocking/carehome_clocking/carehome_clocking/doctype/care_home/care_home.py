import frappe
from frappe.model.document import Document


class CareHome(Document):
    def validate(self):
        if not self.company:
            frappe.throw("Company is required")
    
    def before_save(self):
        # Ensure timezone is valid
        if not self.timezone:
            self.timezone = "Europe/London"
