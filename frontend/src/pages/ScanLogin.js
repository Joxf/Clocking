import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Scan, WifiOff, Wifi, AlertCircle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

const ScanLogin = () => {
  const navigate = useNavigate();
  const { validateQR, isOnline, offlineQueue } = useAuth();
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    try {
      const html5QrCode = new Html5Qrcode("qr-reader");
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        onScanSuccess,
        onScanFailure
      );
      setScanning(true);
      setCameraError(false);
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError(true);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
  };

  const onScanSuccess = async (decodedText) => {
    setScanning(false);
    await stopScanner();
    
    try {
      const result = await validateQR(decodedText);
      if (result.success && result.requires_pin) {
        navigate('/pin', { 
          state: { 
            employeeId: result.employee_id,
            employeeCode: result.employee_code,
            employeeName: result.name
          }
        });
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid QR code. Please try again.');
      setTimeout(() => {
        setError('');
        startScanner();
      }, 3000);
    }
  };

  const onScanFailure = (error) => {
    // Silent failure - QR code not detected in frame
  };

  // Demo mode for testing without camera
  const handleDemoLogin = async (role) => {
    const demoEmployees = {
      admin: 'ADM001',
      manager: 'MGR001',
      staff: 'NRS001'
    };
    
    const employeeId = demoEmployees[role];
    
    // Simulate TOTP token (in real app, this comes from mobile authenticator)
    // For demo, we'll pass the employee directly to PIN page
    navigate('/pin', {
      state: {
        employeeId: null, // Will be fetched from backend
        employeeCode: employeeId,
        employeeName: role === 'admin' ? 'Sarah Wilson' : role === 'manager' ? "Michael O'Brien" : 'Emma Thompson',
        demoMode: true
      }
    });
  };

  return (
    <div className="kiosk-container">
      {/* Offline indicator */}
      <div className="fixed top-4 right-4">
        <div className={`offline-indicator ${isOnline ? 'online' : ''}`}>
          {isOnline ? (
            <>
              <Wifi size={16} />
              <span>Online</span>
            </>
          ) : (
            <>
              <WifiOff size={16} />
              <span>Offline ({offlineQueue.length} pending)</span>
            </>
          )}
        </div>
      </div>

      <div className="kiosk-card">
        {/* Logo */}
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white text-2xl font-bold">CH</span>
          </div>
        </div>

        <h1 className="kiosk-title">Comber Home</h1>
        <p className="kiosk-subtitle">Scan your QR code to clock in</p>

        {/* Camera View */}
        <div className="camera-view" ref={scannerRef}>
          <div id="qr-reader" style={{ width: '100%', height: '100%' }}></div>
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white p-4">
              <AlertCircle size={48} className="mb-4 text-yellow-400" />
              <p className="text-center mb-2">Camera not available</p>
              <p className="text-sm text-gray-400 text-center">
                Use demo mode below for testing
              </p>
            </div>
          )}
          {!cameraError && !scanning && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
              <div className="frappe-spinner"></div>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Instructions */}
        <div className="flex items-center justify-center gap-2 text-gray-500 text-sm mb-6">
          <Scan size={16} />
          <span>Position QR code within the frame</span>
        </div>

        {/* Demo Mode Buttons */}
        <div className="border-t border-gray-200 pt-6 mt-6">
          <p className="text-xs text-gray-400 mb-4 uppercase tracking-wide">Demo Mode</p>
          <div className="grid grid-cols-3 gap-3">
            <button
              data-testid="demo-staff-btn"
              onClick={() => handleDemoLogin('staff')}
              className="frappe-btn frappe-btn-secondary text-xs py-3"
            >
              Staff
            </button>
            <button
              data-testid="demo-manager-btn"
              onClick={() => handleDemoLogin('manager')}
              className="frappe-btn frappe-btn-secondary text-xs py-3"
            >
              Manager
            </button>
            <button
              data-testid="demo-admin-btn"
              onClick={() => handleDemoLogin('admin')}
              className="frappe-btn frappe-btn-secondary text-xs py-3"
            >
              Admin
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-gray-400 text-sm">
        <p>CareHome Clocking System v1.0</p>
      </div>
    </div>
  );
};

export default ScanLogin;
