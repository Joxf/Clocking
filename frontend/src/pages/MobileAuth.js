import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, RefreshCw, User, ChevronDown } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MobileAuth = () => {
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState(null);
  const [qrData, setQrData] = useState('');
  const [tokenInfo, setTokenInfo] = useState(null);
  const [remaining, setRemaining] = useState(30);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);

  useEffect(() => {
    fetchEmployees();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API}/auth/mobile-employees`);
      setEmployees(res.data.employees || []);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchToken = useCallback(async (empCode) => {
    try {
      const res = await axios.get(`${API}/auth/mobile-token/${empCode}`);
      const data = res.data;
      setQrData(data.qr_data);
      setTokenInfo(data);
      setRemaining(data.remaining_seconds);
    } catch (err) {
      console.error('Failed to fetch token:', err);
    }
  }, []);

  const selectEmployee = (emp) => {
    setSelected(emp);
    setShowDropdown(false);
    const code = emp.employee_id;

    // Clear previous intervals
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    // Fetch immediately
    fetchToken(code);

    // Refresh token every 30 seconds
    intervalRef.current = setInterval(() => fetchToken(code), 30000);

    // Countdown timer
    countdownRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          fetchToken(code);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const getRoleBadgeColor = (role) => {
    if (role === 'admin') return 'bg-red-100 text-red-700';
    if (role === 'manager') return 'bg-purple-100 text-purple-700';
    return 'bg-blue-100 text-blue-700';
  };

  const progressPct = (remaining / 30) * 100;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="frappe-spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center px-4 py-8" data-testid="mobile-auth-page">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-3">
          <Shield size={28} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white">CareHome Authenticator</h1>
        <p className="text-slate-400 text-sm mt-1">Show this QR code to the kiosk scanner</p>
      </div>

      {/* Employee Selector */}
      <div className="w-full max-w-sm mb-6 relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-left"
          data-testid="employee-selector"
        >
          {selected ? (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
                {selected.first_name[0]}{selected.last_name[0]}
              </div>
              <div>
                <div className="text-white text-sm font-medium">{selected.first_name} {selected.last_name}</div>
                <div className="text-slate-400 text-xs">{selected.employee_id}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-slate-400">
              <User size={20} />
              <span className="text-sm">Select your profile</span>
            </div>
          )}
          <ChevronDown size={18} className="text-slate-400" />
        </button>

        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden z-10 max-h-72 overflow-y-auto">
            {employees.map(emp => {
              const code = emp.employee_id;
              const name = `${emp.first_name} ${emp.last_name}`;
              return (
                <button
                  key={code}
                  onClick={() => selectEmployee(emp)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 text-left border-b border-slate-700 last:border-0"
                  data-testid={`select-${code}`}
                >
                  <div className="w-9 h-9 rounded-full bg-slate-600 flex items-center justify-center text-white text-sm font-bold">
                    {emp.first_name[0]}{emp.last_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">{name}</div>
                    <div className="text-slate-400 text-xs">{code}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadgeColor(emp.role)}`}>
                    {emp.role}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* QR Code Display */}
      {qrData ? (
        <div className="w-full max-w-sm" data-testid="qr-display">
          <div className="bg-white rounded-2xl p-6 flex flex-col items-center">
            <QRCodeSVG
              value={qrData}
              size={240}
              level="M"
              includeMargin={false}
            />

            {/* Countdown */}
            <div className="w-full mt-5">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <RefreshCw size={14} className={remaining <= 5 ? 'text-red-500 animate-spin' : 'text-slate-400'} />
                  Refreshes in
                </span>
                <span className={`font-mono font-bold ${remaining <= 5 ? 'text-red-600' : 'text-slate-700'}`}>
                  {remaining}s
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${remaining <= 5 ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Token info */}
          {tokenInfo && (
            <div className="mt-4 p-4 bg-slate-800 border border-slate-700 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-xs uppercase tracking-wide">Current Token</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadgeColor(tokenInfo.role)}`}>
                  {tokenInfo.role}
                </span>
              </div>
              <div className="font-mono text-2xl text-white tracking-widest text-center" data-testid="token-display">
                {tokenInfo.token}
              </div>
              <p className="text-slate-500 text-xs text-center mt-2">
                QR contains: {tokenInfo.qr_data}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center mx-auto mb-4">
            <Shield size={32} className="text-slate-500" />
          </div>
          <p className="text-slate-400">Select an employee above to generate your authentication QR code</p>
        </div>
      )}

      {/* Instructions */}
      <div className="w-full max-w-sm mt-8 text-center">
        <p className="text-slate-500 text-xs leading-relaxed">
          Open this page on your mobile device. Select your name, then hold your phone
          screen up to the kiosk camera. After scanning, enter your PIN on the kiosk to complete login.
        </p>
      </div>
    </div>
  );
};

export default MobileAuth;
