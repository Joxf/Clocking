import frappe


def after_install():
    """Run after app installation"""
    create_custom_roles()
    print("CareHome Clocking installed successfully!")


def create_custom_roles():
    """Create custom roles for the app"""
    roles = [
        {
            "role_name": "Care Home Manager",
            "desk_access": 1,
            "is_custom": 1
        },
        {
            "role_name": "Kiosk Device",
            "desk_access": 0,
            "is_custom": 1
        }
    ]
    
    for role_data in roles:
        if not frappe.db.exists("Role", role_data["role_name"]):
            role = frappe.get_doc({
                "doctype": "Role",
                **role_data
            })
            role.insert(ignore_permissions=True)
            print(f"Created role: {role_data['role_name']}")
    
    frappe.db.commit()
