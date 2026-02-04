app_name = "carehome_clocking"
app_title = "CareHome Clocking"
app_publisher = "CareHome Systems"
app_description = "QR-based clocking system for care homes with mobile authenticator"
app_email = "support@carehome.example.com"
app_license = "MIT"
app_version = "1.0.0"

# Required apps
required_apps = ["frappe", "erpnext", "hrms"]

# Includes in <head>
app_include_css = "/assets/carehome_clocking/css/carehome.css"
app_include_js = "/assets/carehome_clocking/js/carehome.js"

# Web Pages
web_include_css = "/assets/carehome_clocking/css/kiosk.css"
web_include_js = "/assets/carehome_clocking/js/kiosk.js"

# Website route rules
website_route_rules = [
    {"from_route": "/kiosk", "to_route": "kiosk"},
    {"from_route": "/kiosk/<path:app_path>", "to_route": "kiosk"},
    {"from_route": "/staff-portal", "to_route": "staff_portal"},
    {"from_route": "/staff-portal/<path:app_path>", "to_route": "staff_portal"},
]

# Doctypes
doc_events = {
    "Employee Checkin": {
        "after_insert": "carehome_clocking.events.on_checkin_insert"
    }
}

# Scheduled Tasks
scheduler_events = {
    "hourly": [
        "carehome_clocking.tasks.sync_offline_queues"
    ],
    "daily": [
        "carehome_clocking.tasks.cleanup_expired_tokens"
    ]
}

# Fixtures
fixtures = [
    {"doctype": "Role", "filters": [["name", "in", ["Care Home Manager", "Kiosk Device"]]]},
]

# Jinja Environment
jinja = {
    "methods": [
        "carehome_clocking.utils.get_kiosk_context"
    ]
}

# Installation
after_install = "carehome_clocking.install.after_install"
