frappe.ready(function() {
    // CareHome Clocking Kiosk Application
    window.CareHomeKiosk = new KioskApp();
});

class KioskApp {
    constructor() {
        this.deviceId = localStorage.getItem('kiosk_device_id');
        this.sessionToken = localStorage.getItem('kiosk_session_token');
        this.careHome = localStorage.getItem('kiosk_care_home');
        this.isOffline = !navigator.onLine;
        this.offlineQueue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
        this.employeeCache = JSON.parse(localStorage.getItem('employee_cache') || '{}');
        this.lastPunches = JSON.parse(localStorage.getItem('last_punches') || '{}');
        this.scanner = null;
        
        this.init();
    }
    
    init() {
        // Network status listeners
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        // Check current state
        if (this.sessionToken) {
            this.showScanner();
        } else {
            this.showLogin();
        }
        
        // Heartbeat every 30 seconds
        setInterval(() => this.sendHeartbeat(), 30000);
        
        // Sync queue every minute when online
        setInterval(() => this.syncOfflineQueue(), 60000);
    }
    
    // ==========================================
    // SCREENS
    // ==========================================
    
    showLogin() {
        const container = document.getElementById('kiosk-container');
        container.innerHTML = `
            <div class="kiosk-login-screen">
                <div class="kiosk-logo">
                    <svg viewBox="0 0 100 100" class="w-24 h-24">
                        <circle cx="50" cy="50" r="45" fill="#2563EB"/>
                        <text x="50" y="60" text-anchor="middle" fill="white" font-size="24" font-weight="bold">CC</text>
                    </svg>
                </div>
                <h1 class="kiosk-title">CareHome Clocking</h1>
                <p class="kiosk-subtitle">Enter Device PIN to continue</p>
                
                <div class="kiosk-pin-container">
                    <input type="text" 
                           id="device-id" 
                           class="kiosk-input" 
                           placeholder="Device ID (e.g., KIOSK-00001)"
                           data-testid="device-id-input">
                    <input type="password" 
                           id="device-pin" 
                           class="kiosk-input kiosk-pin-input" 
                           placeholder="\u2022 \u2022 \u2022 \u2022 \u2022 \u2022"
                           maxlength="6"
                           inputmode="numeric"
                           data-testid="device-pin-input">
                    <button class="kiosk-button kiosk-button-primary" 
                            onclick="CareHomeKiosk.login()"
                            data-testid="login-button">
                        Enter Kiosk Mode
                    </button>
                </div>
                
                <div id="login-error" class="kiosk-error hidden"></div>
            </div>
        `;
    }
    
    showScanner() {
        const container = document.getElementById('kiosk-container');
        container.innerHTML = `
            <div class="kiosk-scanner-screen">
                <header class="kiosk-header">
                    <div class="kiosk-header-left">
                        <span class="kiosk-location" data-testid="kiosk-location">${this.careHome || 'Care Home'}</span>
                    </div>
                    <div class="kiosk-header-center">
                        <h1>Scan Your QR Code</h1>
                    </div>
                    <div class="kiosk-header-right">
                        <div id="offline-indicator" class="${this.isOffline ? '' : 'hidden'}" data-testid="offline-indicator">
                            <span class="offline-badge">OFFLINE</span>
                            <span class="offline-queue">${this.offlineQueue.length} pending</span>
                        </div>
                        <button class="kiosk-button-icon" onclick="CareHomeKiosk.toggleHighContrast()" data-testid="contrast-toggle">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M12 2a10 10 0 0 1 0 20z"/>
                            </svg>
                        </button>
                    </div>
                </header>
                
                <main class="kiosk-main">
                    <div class="kiosk-camera-container">
                        <video id="qr-video" class="kiosk-camera" playsinline></video>
                        <div class="kiosk-scan-overlay">
                            <div class="scan-target"></div>
                        </div>
                    </div>
                    
                    <div class="kiosk-instructions">
                        <p>Hold your phone QR code within the frame</p>
                        <span class="kiosk-time" id="current-time" data-testid="current-time"></span>
                    </div>
                </main>
                
                <footer class="kiosk-footer">
                    <button class="kiosk-button kiosk-button-secondary" 
                            onclick="CareHomeKiosk.showOverrideModal()"
                            data-testid="override-button">
                        Manager Override
                    </button>
                    <button class="kiosk-button kiosk-button-danger" 
                            onclick="CareHomeKiosk.logout()"
                            data-testid="logout-button">
                        Exit Kiosk
                    </button>
                </footer>
            </div>
        `;
        
        this.startScanner();
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);
    }
    
    showSuccess(employeeName, punchType, time) {
        const container = document.getElementById('kiosk-container');
        const isClockIn = punchType === 'IN';
        
        container.innerHTML = `
            <div class="kiosk-success-screen ${isClockIn ? 'clock-in' : 'clock-out'}">
                <div class="success-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                </div>
                <h1 class="success-title" data-testid="success-title">${employeeName}</h1>
                <h2 class="success-action" data-testid="success-action">Clocked ${punchType}</h2>
                <p class="success-time" data-testid="success-time">${time}</p>
                <p class="success-message">${isClockIn ? 'Have a great shift!' : 'See you next time!'}</p>
            </div>
        `;
        
        // Auto-reset after 3 seconds
        setTimeout(() => this.showScanner(), 3000);
    }
    
    showError(message) {
        const container = document.getElementById('kiosk-container');
        container.innerHTML = `
            <div class="kiosk-error-screen">
                <div class="error-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                </div>
                <h1 class="error-title" data-testid="error-title">Error</h1>
                <p class="error-message" data-testid="error-message">${message}</p>
                <button class="kiosk-button kiosk-button-primary" 
                        onclick="CareHomeKiosk.showScanner()"
                        data-testid="retry-button">
                    Try Again
                </button>
            </div>
        `;
        
        // Auto-reset after 5 seconds
        setTimeout(() => this.showScanner(), 5000);
    }
    
    showOverrideModal() {
        const modal = document.createElement('div');
        modal.className = 'kiosk-modal';
        modal.id = 'override-modal';
        modal.innerHTML = `
            <div class="kiosk-modal-content">
                <h2>Manager Override</h2>
                <p>Enter override code and details</p>
                
                <input type="password" 
                       id="override-code" 
                       class="kiosk-input" 
                       placeholder="Override Code"
                       data-testid="override-code-input">
                       
                <input type="text" 
                       id="override-employee" 
                       class="kiosk-input" 
                       placeholder="Employee ID"
                       data-testid="override-employee-input">
                       
                <select id="override-action" class="kiosk-input" data-testid="override-action-select">
                    <option value="IN">Clock IN</option>
                    <option value="OUT">Clock OUT</option>
                </select>
                
                <textarea id="override-reason" 
                          class="kiosk-input kiosk-textarea" 
                          placeholder="Reason for override (required)"
                          data-testid="override-reason-input"></textarea>
                
                <div class="kiosk-modal-buttons">
                    <button class="kiosk-button kiosk-button-secondary" 
                            onclick="CareHomeKiosk.closeOverrideModal()"
                            data-testid="override-cancel-button">
                        Cancel
                    </button>
                    <button class="kiosk-button kiosk-button-primary" 
                            onclick="CareHomeKiosk.submitOverride()"
                            data-testid="override-submit-button">
                        Submit Override
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    closeOverrideModal() {
        const modal = document.getElementById('override-modal');
        if (modal) modal.remove();
    }
    
    // ==========================================
    // AUTHENTICATION
    // ==========================================
    
    async login() {
        const deviceId = document.getElementById('device-id').value.trim();
        const pin = document.getElementById('device-pin').value.trim();
        const errorDiv = document.getElementById('login-error');
        
        if (!deviceId || !pin) {
            errorDiv.textContent = 'Please enter Device ID and PIN';
            errorDiv.classList.remove('hidden');
            return;
        }
        
        try {
            const response = await frappe.call({
                method: 'carehome_clocking.api.kiosk_login',
                args: { device_id: deviceId, pin: pin }
            });
            
            if (response.message.success) {
                this.deviceId = deviceId;
                this.sessionToken = response.message.token;
                this.careHome = response.message.device.care_home;
                
                localStorage.setItem('kiosk_device_id', this.deviceId);
                localStorage.setItem('kiosk_session_token', this.sessionToken);
                localStorage.setItem('kiosk_care_home', this.careHome);
                
                // Load employee cache
                await this.loadEmployeeCache();
                
                this.showScanner();
            } else {
                errorDiv.textContent = response.message.error || 'Login failed';
                errorDiv.classList.remove('hidden');
            }
        } catch (e) {
            errorDiv.textContent = 'Connection error. Please try again.';
            errorDiv.classList.remove('hidden');
        }
    }
    
    logout() {
        localStorage.removeItem('kiosk_device_id');
        localStorage.removeItem('kiosk_session_token');
        localStorage.removeItem('kiosk_care_home');
        this.deviceId = null;
        this.sessionToken = null;
        this.careHome = null;
        this.stopScanner();
        this.showLogin();
    }
    
    // ==========================================
    // QR SCANNER
    // ==========================================
    
    async startScanner() {
        try {
            const video = document.getElementById('qr-video');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            video.srcObject = stream;
            await video.play();
            
            // Start scanning loop
            this.scanLoop();
        } catch (e) {
            console.error('Camera error:', e);
            this.showError('Unable to access camera. Please check permissions.');
        }
    }
    
    stopScanner() {
        const video = document.getElementById('qr-video');
        if (video && video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
        }
    }
    
    scanLoop() {
        const video = document.getElementById('qr-video');
        if (!video || video.paused || video.ended) return;
        
        // Use BarcodeDetector if available
        if ('BarcodeDetector' in window) {
            const detector = new BarcodeDetector({ formats: ['qr_code'] });
            detector.detect(video)
                .then(barcodes => {
                    if (barcodes.length > 0) {
                        this.handleQRCode(barcodes[0].rawValue);
                    } else {
                        requestAnimationFrame(() => this.scanLoop());
                    }
                })
                .catch(e => {
                    requestAnimationFrame(() => this.scanLoop());
                });
        } else {
            // Fallback: use jsQR library
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            
            if (typeof jsQR !== 'undefined') {
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                if (code) {
                    this.handleQRCode(code.data);
                } else {
                    requestAnimationFrame(() => this.scanLoop());
                }
            } else {
                // No QR library available
                requestAnimationFrame(() => this.scanLoop());
            }
        }
    }
    
    async handleQRCode(data) {
        try {
            const payload = JSON.parse(data);
            
            if (payload.type === 'enrollment') {
                // This is an enrollment QR, not for clocking
                this.showError('Please use your authenticator app QR code');
                return;
            }
            
            const { employee_id, totp_code } = payload;
            
            if (!employee_id || !totp_code) {
                this.showError('Invalid QR code format');
                return;
            }
            
            await this.processClocking(employee_id, totp_code);
            
        } catch (e) {
            this.showError('Could not read QR code');
        }
    }
    
    async processClocking(employeeId, totpCode) {
        if (this.isOffline) {
            // Offline mode
            this.processOfflineClocking(employeeId, totpCode);
        } else {
            // Online mode
            try {
                const response = await frappe.call({
                    method: 'carehome_clocking.api.validate_token',
                    args: {
                        employee_id: employeeId,
                        totp_code: totpCode,
                        device_id: this.deviceId
                    }
                });
                
                if (response.message.success) {
                    const time = new Date(response.message.time).toLocaleTimeString();
                    this.showSuccess(
                        response.message.employee_name,
                        response.message.punch_type,
                        time
                    );
                } else {
                    this.showError(response.message.error || 'Validation failed');
                }
            } catch (e) {
                // Network error, fall back to offline
                this.handleOffline();
                this.processOfflineClocking(employeeId, totpCode);
            }
        }
    }
    
    processOfflineClocking(employeeId, totpCode) {
        // Check employee cache
        const employee = this.employeeCache[employeeId];
        if (!employee) {
            this.showError('Employee not found in offline cache');
            return;
        }
        
        // Determine punch type from local history
        const lastPunch = this.lastPunches[employeeId];
        const punchType = lastPunch === 'IN' ? 'OUT' : 'IN';
        
        // Create offline punch record
        const punch = {
            offline_id: `${this.deviceId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            employee_id: employeeId,
            timestamp: new Date().toISOString(),
            punch_type: punchType,
            care_home: this.careHome,
            location: localStorage.getItem('kiosk_location') || ''
        };
        
        // Add to queue
        this.offlineQueue.push(punch);
        localStorage.setItem('offline_queue', JSON.stringify(this.offlineQueue));
        
        // Update local state
        this.lastPunches[employeeId] = punchType;
        localStorage.setItem('last_punches', JSON.stringify(this.lastPunches));
        
        // Show success
        this.showSuccess(
            employee.name,
            punchType,
            new Date().toLocaleTimeString()
        );
        
        // Update offline indicator
        this.updateOfflineIndicator();
    }
    
    // ==========================================
    // OFFLINE HANDLING
    // ==========================================
    
    handleOnline() {
        this.isOffline = false;
        this.updateOfflineIndicator();
        this.syncOfflineQueue();
    }
    
    handleOffline() {
        this.isOffline = true;
        this.updateOfflineIndicator();
    }
    
    updateOfflineIndicator() {
        const indicator = document.getElementById('offline-indicator');
        if (indicator) {
            if (this.isOffline) {
                indicator.classList.remove('hidden');
                indicator.querySelector('.offline-queue').textContent = `${this.offlineQueue.length} pending`;
            } else {
                if (this.offlineQueue.length > 0) {
                    indicator.classList.remove('hidden');
                    indicator.querySelector('.offline-badge').textContent = 'SYNCING';
                    indicator.querySelector('.offline-queue').textContent = `${this.offlineQueue.length} pending`;
                } else {
                    indicator.classList.add('hidden');
                }
            }
        }
    }
    
    async syncOfflineQueue() {
        if (this.isOffline || this.offlineQueue.length === 0) return;
        
        try {
            const response = await frappe.call({
                method: 'carehome_clocking.api.sync_offline_queue',
                args: {
                    punches: JSON.stringify(this.offlineQueue),
                    device_id: this.deviceId
                }
            });
            
            if (response.message.success) {
                // Remove synced items
                const syncedIds = response.message.results
                    .filter(r => r.status === 'synced' || r.status === 'already_synced')
                    .map(r => r.offline_id);
                
                this.offlineQueue = this.offlineQueue.filter(
                    p => !syncedIds.includes(p.offline_id)
                );
                localStorage.setItem('offline_queue', JSON.stringify(this.offlineQueue));
            }
        } catch (e) {
            console.error('Sync error:', e);
        }
        
        this.updateOfflineIndicator();
    }
    
    async loadEmployeeCache() {
        if (!this.isOffline) {
            try {
                const response = await frappe.call({
                    method: 'carehome_clocking.api.get_care_home_employees',
                    args: {
                        care_home: this.careHome,
                        device_id: this.deviceId,
                        token: this.sessionToken
                    }
                });
                
                if (response.message.success) {
                    this.employeeCache = {};
                    response.message.employees.forEach(emp => {
                        this.employeeCache[emp.id] = emp;
                    });
                    localStorage.setItem('employee_cache', JSON.stringify(this.employeeCache));
                }
            } catch (e) {
                console.error('Failed to load employee cache:', e);
            }
        }
    }
    
    // ==========================================
    // UTILITIES
    // ==========================================
    
    updateClock() {
        const clockEl = document.getElementById('current-time');
        if (clockEl) {
            clockEl.textContent = new Date().toLocaleTimeString();
        }
    }
    
    async sendHeartbeat() {
        if (this.isOffline || !this.sessionToken) return;
        
        try {
            await frappe.call({
                method: 'carehome_clocking.api.kiosk_heartbeat',
                args: {
                    device_id: this.deviceId,
                    token: this.sessionToken,
                    queue_size: this.offlineQueue.length
                }
            });
        } catch (e) {
            // Ignore heartbeat errors
        }
    }
    
    toggleHighContrast() {
        document.body.classList.toggle('high-contrast');
        localStorage.setItem('high_contrast', document.body.classList.contains('high-contrast'));
    }
    
    async submitOverride() {
        const code = document.getElementById('override-code').value.trim();
        const employeeId = document.getElementById('override-employee').value.trim();
        const action = document.getElementById('override-action').value;
        const reason = document.getElementById('override-reason').value.trim();
        
        if (!code || !employeeId || !reason) {
            alert('Please fill in all fields');
            return;
        }
        
        if (reason.length < 10) {
            alert('Reason must be at least 10 characters');
            return;
        }
        
        try {
            const response = await frappe.call({
                method: 'carehome_clocking.api.manual_correction',
                args: {
                    employee_id: employeeId,
                    punch_type: action,
                    timestamp: new Date().toISOString(),
                    reason: reason
                }
            });
            
            if (response.message.success) {
                this.closeOverrideModal();
                // Get employee name
                const emp = this.employeeCache[employeeId];
                const name = emp ? emp.name : employeeId;
                this.showSuccess(name, action, new Date().toLocaleTimeString());
            } else {
                alert(response.message.error || 'Override failed');
            }
        } catch (e) {
            alert('Connection error');
        }
    }
}
