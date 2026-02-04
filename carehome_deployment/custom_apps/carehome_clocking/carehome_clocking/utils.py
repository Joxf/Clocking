import frappe


def get_kiosk_context():
    """Get context for kiosk template"""
    return {
        "app_name": "CareHome Clocking",
        "version": "1.0.0"
    }
