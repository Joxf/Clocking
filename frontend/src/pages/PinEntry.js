import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Delete, ArrowLeft, WifiOff, Wifi, User } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PinEntry = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { validatePIN, isOnline, offlineQueue } = useAuth();
  
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [employeeData, setEmployeeData] = useState(null);

  const { employeeId, employeeCode, employeeName, demoMode } = location.state || {};

  useEffect(() => {
    if (!employeeCode && !employeeId) {
      navigate('/');
      return;
    }

    // For demo mode, fetch employee data
    if (demoMode && employeeCode) {
      fetchEmployeeByCode(employeeCode);
    } else if (employeeId) {
      setEmployeeData({
        id: employeeId,
        employee_id: employeeCode,
        name: employeeName
      });
    }
  }, [employeeCode, employeeId, demoMode, navigate]);

  const fetchEmployeeByCode = async (code) => {
    try {
      // For demo mode, we'll get the employee ID from the backend via public lookup
      const response = await axios.get(`${API}/employees/lookup/${code}`);
      setEmployeeData({
        id: response.data.id,
        employee_id: response.data.employee_id,
        name: `${response.data.first_name} ${response.data.last_name}`
      });
    } catch (err) {
      console.error('Failed to fetch employee:', err);
      setError('Employee not found');
    }
  };

  const handleKeyPress = (digit) => {
    if (pin.length < 4 && employeeData?.id) {
      const newPin = pin + digit;
      setPin(newPin);
      setError('');
      
      // Auto-submit when 4 digits entered
      if (newPin.length === 4) {
        handleSubmit(newPin);
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleSubmit = async (submittedPin) => {
    if (!employeeData?.id) {
      setError('Employee data not loaded');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await validatePIN(employeeData.id, submittedPin);
      
      if (result.token) {
        // Route based on role
        const role = result.employee?.role;
        if (role === 'admin') {
          navigate('/admin');
        } else if (role === 'manager') {
          navigate('/manager');
        } else {
          navigate('/staff');
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid PIN. Please try again.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/');
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

      {/* Back button */}
      <button
        data-testid="back-btn"
        onClick={handleBack}
        className="fixed top-4 left-4 frappe-btn frappe-btn-ghost"
      >
        <ArrowLeft size={20} />
        <span>Back</span>
      </button>

      <div className="kiosk-card">
        {/* Employee Avatar */}
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-blue-100 flex items-center justify-center">
            <User size={40} className="text-blue-600" />
          </div>
        </div>

        <h1 className="kiosk-title">Welcome</h1>
        <p className="text-lg text-gray-600 mb-2">{employeeData?.name || employeeName || 'Loading...'}</p>
        <p className="text-sm text-gray-400 mb-8">
          {employeeData?.id ? 'Enter your 4-digit PIN' : 'Loading employee data...'}
        </p>

        {/* PIN Display */}
        <div className="pin-display" data-testid="pin-display">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`pin-dot ${index < pin.length ? 'filled' : ''}`}
              data-testid={`pin-dot-${index}`}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm" data-testid="pin-error">
            {error}
          </div>
        )}

        {/* PIN Pad */}
        <div className="pin-pad" data-testid="pin-pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button
              key={digit}
              data-testid={`pin-btn-${digit}`}
              onClick={() => handleKeyPress(digit.toString())}
              disabled={loading || !employeeData?.id}
              className="pin-pad-btn"
            >
              {digit}
            </button>
          ))}
          <button
            data-testid="pin-btn-clear"
            onClick={handleClear}
            disabled={loading || !employeeData?.id}
            className="pin-pad-btn danger"
          >
            C
          </button>
          <button
            data-testid="pin-btn-0"
            onClick={() => handleKeyPress('0')}
            disabled={loading || !employeeData?.id}
            className="pin-pad-btn"
          >
            0
          </button>
          <button
            data-testid="pin-btn-delete"
            onClick={handleDelete}
            disabled={loading || !employeeData?.id}
            className="pin-pad-btn"
          >
            <Delete size={20} />
          </button>
        </div>

        {/* Loading indicator */}
        {loading && (
          <div className="mt-6 flex items-center justify-center gap-2 text-gray-500">
            <div className="frappe-spinner"></div>
            <span>Verifying...</span>
          </div>
        )}

        {/* Demo PIN hint */}
        {demoMode && (
          <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-600 text-sm">
            Demo Mode: Default PIN is <strong>1234</strong>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-gray-400 text-sm">
        <p>CareHome Clocking System v1.0</p>
      </div>
    </div>
  );
};

export default PinEntry;
