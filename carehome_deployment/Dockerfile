# CareHome Clocking - Custom Docker Image
# Includes: Frappe + ERPNext + HRMS + CareHome Clocking

ARG FRAPPE_VERSION=v15
ARG ERPNEXT_VERSION=v15
FROM frappe/bench:latest AS builder

# Install frappe-bench
USER frappe
WORKDIR /home/frappe

# Initialize bench
RUN bench init frappe-bench \
    --frappe-branch version-15 \
    --skip-redis-config-generation \
    --skip-assets

WORKDIR /home/frappe/frappe-bench

# Get apps
RUN bench get-app erpnext --branch version-15
RUN bench get-app hrms --branch version-15

# Copy custom app
COPY --chown=frappe:frappe ./custom_apps/carehome_clocking /home/frappe/frappe-bench/apps/carehome_clocking

# Install all apps
RUN bench setup requirements

# Build assets
RUN bench build --production

# Production image
FROM frappe/erpnext:v15

# Copy built bench from builder
COPY --from=builder /home/frappe/frappe-bench /home/frappe/frappe-bench

# Set permissions
USER root
RUN chown -R frappe:frappe /home/frappe/frappe-bench

USER frappe
WORKDIR /home/frappe/frappe-bench

# Expose ports
EXPOSE 8000 9000

# Default command
CMD ["gunicorn", "-c", "/home/frappe/frappe-bench/config/gunicorn_config.py"]
