import { useState, useEffect, useCallback } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { 
  Clock, QrCode, Users, Settings, Monitor, Smartphone, 
  CheckCircle2, XCircle, Sun, Moon, LogOut, Shield,
  Calendar, ArrowLeftRight, ChevronRight, Wifi, WifiOff,
  Battery, RefreshCw, User, Building2, MapPin, Eye
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// ==========================================
// KIOSK LOGIN SCREEN
// ==========================================
const KioskLogin = ({ onLogin }) => {
  const [deviceId, setDeviceId] = useState('KIOSK-00001');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!deviceId || !pin) {
      setError('Please enter Device ID and PIN');
      return;
    }
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      if (pin === '123456') {
        onLogin({ deviceId, careHome: 'Sunrise Care Home', location: 'Main Entrance' });
      } else {
        setError('Invalid PIN. Demo PIN: 123456');
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8" data-testid="kiosk-login-screen">
      <div className="w-full max-w-lg space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center">
          <div className="w-28 h-28 rounded-full bg-blue-600 flex items-center justify-center mb-6">
            <span className="text-white text-4xl font-display font-bold">CC</span>
          </div>
          <h1 className="font-display text-4xl font-extrabold text-slate-900 tracking-tight">CareHome Clocking</h1>
          <p className="text-xl text-slate-500 mt-2">Enter Device PIN to continue</p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <input
            type="text"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            className="w-full kiosk-input"
            placeholder="Device ID"
            data-testid="device-id-input"
          />
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full kiosk-input font-mono tracking-widest"
            placeholder="• • • • • •"
            maxLength={6}
            data-testid="device-pin-input"
          />
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full kiosk-btn bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            data-testid="login-button"
          >
            {loading ? 'Authenticating...' : 'Enter Kiosk Mode'}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-center text-lg" data-testid="login-error">
            {error}
          </div>
        )}

        <p className="text-center text-slate-400">Demo: Use PIN 123456</p>
      </div>
    </div>
  );
};

// ==========================================
// KIOSK SCANNER SCREEN
// ==========================================
const KioskScanner = ({ device, onLogout, onSuccess }) => {
  const [time, setTime] = useState(new Date());
  const [isOffline, setIsOffline] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [highContrast, setHighContrast] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const simulateScan = () => {
    setScanning(true);
    setTimeout(() => {
      const employees = [
        { id: 'EMP-001', name: 'Sarah Johnson', lastPunch: 'OUT' },
        { id: 'EMP-002', name: 'Michael Chen', lastPunch: 'IN' },
        { id: 'EMP-003', name: 'Emma Williams', lastPunch: 'OUT' },
      ];
      const emp = employees[Math.floor(Math.random() * employees.length)];
      const punchType = emp.lastPunch === 'IN' ? 'OUT' : 'IN';
      onSuccess(emp.name, punchType, new Date().toLocaleTimeString());
      setScanning(false);
    }, 1500);
  };

  const toggleOffline = () => {
    setIsOffline(!isOffline);
    if (!isOffline) {
      setQueueCount(Math.floor(Math.random() * 5) + 1);
    } else {
      setQueueCount(0);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col ${highContrast ? 'bg-black' : 'bg-slate-50'}`} data-testid="kiosk-scanner-screen">
      {/* Header */}
      <header className={`flex items-center justify-between p-4 ${highContrast ? 'bg-black border-yellow-400' : 'bg-white'} border-b-2`}>
        <div className="flex items-center gap-3">
          <Building2 className={highContrast ? 'text-yellow-400' : 'text-slate-500'} size={24} />
          <span className={`text-lg font-medium ${highContrast ? 'text-yellow-400' : 'text-slate-600'}`} data-testid="kiosk-location">
            {device.careHome} - {device.location}
          </span>
        </div>
        
        <h1 className={`font-display text-2xl font-bold ${highContrast ? 'text-yellow-400' : 'text-slate-900'}`}>
          Scan Your QR Code
        </h1>
        
        <div className="flex items-center gap-4">
          {/* Offline Indicator */}
          <div 
            className={`flex items-center gap-2 cursor-pointer ${isOffline ? '' : 'opacity-0'}`}
            onClick={toggleOffline}
            data-testid="offline-indicator"
          >
            <span className="px-3 py-1.5 bg-amber-500 text-white rounded-full text-sm font-bold">
              {isOffline ? <WifiOff size={16} className="inline mr-1" /> : null}
              OFFLINE
            </span>
            <span className="text-sm text-slate-500">{queueCount} pending</span>
          </div>
          
          {/* High Contrast Toggle */}
          <button 
            onClick={() => setHighContrast(!highContrast)}
            className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-colors
              ${highContrast ? 'border-yellow-400 text-yellow-400' : 'border-slate-200 text-slate-600 hover:border-blue-600'}`}
            data-testid="contrast-toggle"
          >
            {highContrast ? <Sun size={24} /> : <Moon size={24} />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
        {/* Camera View Simulation */}
        <div className="relative w-full max-w-2xl aspect-[4/3] bg-slate-900 rounded-2xl overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Scan Target */}
            <div className={`w-64 h-64 border-4 rounded-2xl ${scanning ? 'border-green-500' : 'animate-pulse-border'}`}
                 style={{ boxShadow: '0 0 0 2000px rgba(0,0,0,0.6)' }}>
            </div>
          </div>
          
          {/* Demo Click Area */}
          <button 
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
            onClick={simulateScan}
            data-testid="scan-area"
          >
            <div className="text-white/50 text-center">
              <QrCode size={48} className="mx-auto mb-2" />
              <p className="text-lg">Click to simulate QR scan</p>
            </div>
          </button>
          
          {scanning && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-white text-center">
                <RefreshCw size={48} className="animate-spin mx-auto mb-2" />
                <p className="text-xl">Scanning...</p>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="text-center">
          <p className={`text-xl ${highContrast ? 'text-yellow-400' : 'text-slate-600'}`}>
            Hold your phone QR code within the frame
          </p>
          <p className={`font-mono text-5xl font-medium mt-4 ${highContrast ? 'text-yellow-400' : 'text-slate-900'}`} data-testid="current-time">
            {time.toLocaleTimeString()}
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className={`flex items-center justify-between p-4 ${highContrast ? 'bg-black border-yellow-400' : 'bg-white'} border-t-2`}>
        <button
          onClick={() => setShowOverride(true)}
          className={`kiosk-btn px-8 ${highContrast ? 'bg-black border-2 border-yellow-400 text-yellow-400' : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-slate-400'}`}
          data-testid="override-button"
        >
          <Shield size={24} className="inline mr-2" />
          Manager Override
        </button>
        
        <div className="flex items-center gap-2">
          <button onClick={toggleOffline} className="text-sm text-slate-400 hover:text-slate-600">
            Toggle Offline Demo
          </button>
        </div>
        
        <button
          onClick={onLogout}
          className={`kiosk-btn px-8 ${highContrast ? 'bg-black border-2 border-red-500 text-red-500' : 'bg-white border-2 border-red-200 text-red-600 hover:border-red-400 hover:bg-red-50'}`}
          data-testid="logout-button"
        >
          <LogOut size={24} className="inline mr-2" />
          Exit Kiosk
        </button>
      </footer>

      {/* Override Modal */}
      {showOverride && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md space-y-4">
            <h2 className="font-display text-2xl font-bold">Manager Override</h2>
            <p className="text-slate-500">Enter override code and details</p>
            <input type="password" placeholder="Override Code" className="w-full kiosk-input h-14 text-lg" />
            <input type="text" placeholder="Employee ID" className="w-full kiosk-input h-14 text-lg" />
            <select className="w-full kiosk-input h-14 text-lg">
              <option value="IN">Clock IN</option>
              <option value="OUT">Clock OUT</option>
            </select>
            <textarea placeholder="Reason for override (required)" className="w-full p-4 border-2 rounded-xl h-24 resize-none" />
            <div className="flex gap-4">
              <button onClick={() => setShowOverride(false)} className="flex-1 kiosk-btn bg-slate-100 text-slate-700">
                Cancel
              </button>
              <button className="flex-1 kiosk-btn bg-blue-600 text-white">
                Submit Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// KIOSK SUCCESS SCREEN
// ==========================================
const KioskSuccess = ({ employeeName, punchType, time, onReset }) => {
  useEffect(() => {
    const timer = setTimeout(onReset, 3000);
    return () => clearTimeout(timer);
  }, [onReset]);

  const isClockIn = punchType === 'IN';

  return (
    <div 
      className={`min-h-screen flex flex-col items-center justify-center p-8 ${isClockIn ? 'bg-green-600' : 'bg-blue-600'}`}
      data-testid="kiosk-success-screen"
    >
      <div className="animate-scale-in text-white text-center">
        <CheckCircle2 size={120} className="mx-auto mb-8" />
        <h1 className="font-display text-5xl font-extrabold mb-2" data-testid="success-title">{employeeName}</h1>
        <h2 className="text-4xl font-bold mb-4" data-testid="success-action">Clocked {punchType}</h2>
        <p className="font-mono text-6xl font-medium mb-8" data-testid="success-time">{time}</p>
        <p className="text-2xl opacity-90">{isClockIn ? 'Have a great shift!' : 'See you next time!'}</p>
      </div>
      <p className="absolute bottom-8 text-white/60">Returning to scanner in 3 seconds...</p>
    </div>
  );
};

// ==========================================
// KIOSK MAIN COMPONENT
// ==========================================
const KioskMode = () => {
  const [screen, setScreen] = useState('login');
  const [device, setDevice] = useState(null);
  const [successData, setSuccessData] = useState(null);

  const handleLogin = (deviceData) => {
    setDevice(deviceData);
    setScreen('scanner');
    toast.success(`Connected to ${deviceData.careHome}`);
  };

  const handleLogout = () => {
    setDevice(null);
    setScreen('login');
    toast.info('Logged out of kiosk mode');
  };

  const handleSuccess = (name, type, time) => {
    setSuccessData({ employeeName: name, punchType: type, time });
    setScreen('success');
    toast.success(`${name} clocked ${type}`);
  };

  const handleReset = () => {
    setSuccessData(null);
    setScreen('scanner');
  };

  if (screen === 'login') {
    return <KioskLogin onLogin={handleLogin} />;
  }

  if (screen === 'success' && successData) {
    return <KioskSuccess {...successData} onReset={handleReset} />;
  }

  return <KioskScanner device={device} onLogout={handleLogout} onSuccess={handleSuccess} />;
};

// ==========================================
// MOBILE APP PREVIEW
// ==========================================
const MobilePreview = () => {
  const [screen, setScreen] = useState('qr');
  const [countdown, setCountdown] = useState(30);
  const [qrKey, setQrKey] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setQrKey(k => k + 1);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-8" data-testid="mobile-preview">
      {/* Phone Frame */}
      <div className="w-[375px] h-[812px] bg-white rounded-[3rem] shadow-2xl overflow-hidden border-8 border-slate-800 relative">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-8 bg-slate-800 rounded-b-3xl z-10" />
        
        {/* Screen Content */}
        <div className="h-full bg-slate-50 pt-12 flex flex-col">
          {/* Header */}
          <div className="bg-blue-600 text-white px-6 py-4">
            <h1 className="font-display text-lg font-bold">CareHome Clocking</h1>
          </div>

          {screen === 'enroll' ? (
            // Enrollment Screen
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center mb-6">
                <span className="text-white text-2xl font-bold">CC</span>
              </div>
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-2">CareHome Clocking</h2>
              <p className="text-slate-500 mb-8">Mobile Authenticator</p>
              <p className="text-slate-600 mb-8 px-4">
                Ask your manager to show you the enrollment QR code.
              </p>
              <button 
                onClick={() => setScreen('qr')}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold"
              >
                Scan Enrollment QR
              </button>
            </div>
          ) : (
            // QR Display Screen
            <div className="flex-1 flex flex-col items-center p-6">
              {/* Employee Info */}
              <div className="text-center mb-6">
                <h2 className="font-display text-xl font-bold text-slate-900">Sarah Johnson</h2>
                <p className="text-slate-500 text-sm">EMP-001</p>
              </div>

              {/* QR Code */}
              <div className="bg-white p-6 rounded-2xl shadow-lg mb-6">
                <div 
                  key={qrKey}
                  className="w-48 h-48 bg-slate-900 rounded-lg flex items-center justify-center"
                  data-testid="mobile-qr-code"
                >
                  <QrCode size={160} className="text-white" />
                </div>
              </div>

              {/* Countdown */}
              <div className="w-full max-w-[200px] mb-4">
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-1000"
                    style={{ width: `${(countdown / 30) * 100}%` }}
                  />
                </div>
                <p className="text-center text-slate-500 text-sm mt-2">Refreshes in {countdown}s</p>
              </div>

              {/* Instructions */}
              <p className="text-center text-slate-600 text-sm px-4 mb-6">
                Show this QR code to the kiosk camera to clock in or out
              </p>

              {/* Actions */}
              <div className="w-full space-y-3 mt-auto">
                <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium">
                  <Sun size={18} className="inline mr-2" />
                  Full Brightness
                </button>
                <button 
                  onClick={() => setScreen('enroll')}
                  className="w-full bg-white border-2 border-slate-200 text-slate-600 py-3 rounded-lg font-medium"
                >
                  Unenroll Device
                </button>
              </div>

              {/* Battery */}
              <div className="flex items-center gap-1 mt-4 text-slate-400 text-xs">
                <Battery size={14} />
                <span>87%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Panel */}
      <div className="ml-12 max-w-md">
        <h2 className="font-display text-3xl font-bold text-slate-900 mb-4">Mobile Authenticator</h2>
        <p className="text-slate-600 mb-6">
          The React Native app generates TOTP-based QR codes that rotate every 30 seconds.
          Staff scan these at the kiosk to clock in/out.
        </p>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="text-green-600 mt-1" size={20} />
            <div>
              <p className="font-medium text-slate-900">Secure Storage</p>
              <p className="text-sm text-slate-500">TOTP secret stored in device Keychain/Keystore</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="text-green-600 mt-1" size={20} />
            <div>
              <p className="font-medium text-slate-900">Works Offline</p>
              <p className="text-sm text-slate-500">No internet required after enrollment</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="text-green-600 mt-1" size={20} />
            <div>
              <p className="font-medium text-slate-900">Battery Efficient</p>
              <p className="text-sm text-slate-500">Low battery warning when below 15%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// DASHBOARD / OVERVIEW
// ==========================================
const Dashboard = () => {
  const navigate = useNavigate();
  
  const stats = [
    { label: 'Clocked In Now', value: '12', icon: Users, color: 'bg-green-600' },
    { label: 'Total Staff', value: '48', icon: User, color: 'bg-blue-600' },
    { label: 'Kiosks Online', value: '3/3', icon: Monitor, color: 'bg-purple-600' },
    { label: 'Pending Syncs', value: '0', icon: RefreshCw, color: 'bg-amber-600' },
  ];

  const recentActivity = [
    { name: 'Sarah Johnson', action: 'IN', time: '08:02:15', device: 'Main Entrance' },
    { name: 'Michael Chen', action: 'IN', time: '07:58:42', device: 'Main Entrance' },
    { name: 'Emma Williams', action: 'OUT', time: '07:45:30', device: 'Staff Room' },
    { name: 'James Brown', action: 'IN', time: '07:32:18', device: 'Main Entrance' },
    { name: 'Lisa Davis', action: 'IN', time: '07:28:55', device: 'Main Entrance' },
  ];

  return (
    <div className="min-h-screen bg-slate-50" data-testid="dashboard">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold">CC</span>
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-slate-900">CareHome Clocking</h1>
              <p className="text-sm text-slate-500">Sunrise Care Home</p>
            </div>
          </div>
          <nav className="flex items-center gap-6">
            <button onClick={() => navigate('/kiosk')} className="flex items-center gap-2 text-slate-600 hover:text-blue-600">
              <Monitor size={18} />
              Kiosk Demo
            </button>
            <button onClick={() => navigate('/mobile')} className="flex items-center gap-2 text-slate-600 hover:text-blue-600">
              <Smartphone size={18} />
              Mobile App
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white rounded-xl p-6 border">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center`}>
                  <stat.icon size={24} className="text-white" />
                </div>
                <span className="font-display text-3xl font-bold text-slate-900">{stat.value}</span>
              </div>
              <p className="text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <div className="lg:col-span-2 bg-white rounded-xl border">
            <div className="p-6 border-b">
              <h2 className="font-display text-lg font-bold text-slate-900">Recent Activity</h2>
            </div>
            <div className="divide-y">
              {recentActivity.map((item, i) => (
                <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                      <User size={20} className="text-slate-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-sm text-slate-500">{item.device}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${item.action === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {item.action}
                    </span>
                    <p className="text-sm text-slate-500 mt-1 font-mono">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-display text-lg font-bold text-slate-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-between p-3 rounded-lg border hover:border-blue-600 hover:bg-blue-50 transition-colors">
                  <span className="flex items-center gap-3">
                    <QrCode size={20} className="text-blue-600" />
                    <span>Enroll New Staff</span>
                  </span>
                  <ChevronRight size={18} className="text-slate-400" />
                </button>
                <button className="w-full flex items-center justify-between p-3 rounded-lg border hover:border-blue-600 hover:bg-blue-50 transition-colors">
                  <span className="flex items-center gap-3">
                    <Monitor size={20} className="text-blue-600" />
                    <span>Add Kiosk Device</span>
                  </span>
                  <ChevronRight size={18} className="text-slate-400" />
                </button>
                <button className="w-full flex items-center justify-between p-3 rounded-lg border hover:border-blue-600 hover:bg-blue-50 transition-colors">
                  <span className="flex items-center gap-3">
                    <ArrowLeftRight size={20} className="text-blue-600" />
                    <span>Shift Swap Requests</span>
                  </span>
                  <ChevronRight size={18} className="text-slate-400" />
                </button>
              </div>
            </div>

            {/* System Health */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-display text-lg font-bold text-slate-900 mb-4">Kiosk Health</h2>
              <div className="space-y-4">
                {[
                  { name: 'Main Entrance', status: 'online', queue: 0 },
                  { name: 'Staff Room', status: 'online', queue: 0 },
                  { name: 'Back Door', status: 'online', queue: 0 },
                ].map((device, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${device.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-slate-700">{device.name}</span>
                    </div>
                    <span className="text-sm text-slate-500">
                      {device.queue > 0 ? `${device.queue} pending` : 'Synced'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

// ==========================================
// MAIN APP
// ==========================================
function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/kiosk" element={<KioskMode />} />
        <Route path="/mobile" element={<MobilePreview />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
