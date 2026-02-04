import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
  Clock,
  LogOut,
  WifiOff,
  Wifi,
  User,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const StaffDashboard = () => {
  const navigate = useNavigate();
  const { user, token, logout, isOnline, offlineQueue, clockIn, clockOut } = useAuth();
  
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [idleTime, setIdleTime] = useState(0);

  // Auto-logout after 60 seconds idle
  const IDLE_TIMEOUT = 60;

  useEffect(() => {
    if (!user || !token) {
      navigate('/');
      return;
    }
    fetchAttendanceStatus();
  }, [user, token, navigate]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Idle timer
  useEffect(() => {
    const resetIdleTimer = () => setIdleTime(0);
    
    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);
    window.addEventListener('click', resetIdleTimer);
    window.addEventListener('touchstart', resetIdleTimer);
    
    const idleInterval = setInterval(() => {
      setIdleTime(prev => {
        const newTime = prev + 1;
        if (newTime >= IDLE_TIMEOUT) {
          handleLogout();
        }
        return newTime;
      });
    }, 1000);
    
    return () => {
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      window.removeEventListener('click', resetIdleTimer);
      window.removeEventListener('touchstart', resetIdleTimer);
      clearInterval(idleInterval);
    };
  }, []);

  const fetchAttendanceStatus = async () => {
    try {
      const response = await axios.get(`${API}/attendance/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAttendanceStatus(response.data);
    } catch (err) {
      console.error('Failed to fetch attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    setActionLoading(true);
    try {
      await clockIn();
      await fetchAttendanceStatus();
    } catch (err) {
      console.error('Clock in failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    setActionLoading(true);
    try {
      await clockOut();
      await fetchAttendanceStatus();
    } catch (err) {
      console.error('Clock out failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/');
  }, [logout, navigate]);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getJobTitleDisplay = (jobTitle) => {
    const titles = {
      nurse: 'Nurse',
      senior_carer: 'Senior Carer',
      carer: 'Carer',
      activities: 'Activities Coordinator',
      kitchen: 'Kitchen Staff',
      maintenance: 'Maintenance',
      administrator: 'Administrator',
      care_manager: 'Care Manager'
    };
    return titles[jobTitle] || jobTitle;
  };

  if (loading) {
    return (
      <div className="kiosk-container">
        <div className="frappe-spinner"></div>
      </div>
    );
  }

  const isClockedIn = attendanceStatus?.clocked_in && !attendanceStatus?.clocked_out;
  const isClockedOut = attendanceStatus?.clocked_out;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="frappe-header justify-between">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">CH</span>
          </div>
          <span className="font-semibold text-gray-900">Comber Home</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Offline indicator */}
          <div className={`offline-indicator ${isOnline ? 'online' : ''}`}>
            {isOnline ? (
              <>
                <Wifi size={14} />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff size={14} />
                <span>Offline ({offlineQueue.length})</span>
              </>
            )}
          </div>

          {/* Idle timer warning */}
          {idleTime > 30 && (
            <div className="flex items-center gap-2 text-orange-600 text-sm">
              <AlertCircle size={14} />
              <span>Session ends in {IDLE_TIMEOUT - idleTime}s</span>
            </div>
          )}

          {/* Logout button */}
          <button
            data-testid="logout-btn"
            onClick={handleLogout}
            className="frappe-btn frappe-btn-secondary"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main content - no sidebar for staff */}
      <main className="frappe-main full-width">
        <div className="max-w-2xl mx-auto">
          {/* Current Time */}
          <div className="text-center mb-8">
            <div className="text-6xl font-bold text-gray-900 mb-2" data-testid="current-time">
              {formatTime(currentTime)}
            </div>
            <div className="text-lg text-gray-500" data-testid="current-date">
              {formatDate(currentTime)}
            </div>
          </div>

          {/* User Card */}
          <div className="frappe-card mb-6">
            <div className="frappe-card-content">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                  <User size={32} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900" data-testid="user-name">
                    {user?.first_name} {user?.last_name}
                  </h2>
                  <p className="text-gray-500" data-testid="user-role">
                    {getJobTitleDisplay(user?.job_title)}
                  </p>
                  <span className={`frappe-badge ${user?.employment_type === 'agency' ? 'frappe-badge-warning' : 'frappe-badge-primary'}`}>
                    {user?.employment_type === 'agency' ? 'Agency' : 'Permanent'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Status Card */}
          <div className="frappe-card mb-6">
            <div className="frappe-card-header flex items-center gap-2">
              <Calendar size={18} />
              <span>Today's Status</span>
            </div>
            <div className="frappe-card-content">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500 mb-1">Clock In</div>
                  <div className="text-lg font-semibold text-gray-900" data-testid="clock-in-time">
                    {attendanceStatus?.clock_in_time 
                      ? new Date(attendanceStatus.clock_in_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                      : '--:--'}
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500 mb-1">Clock Out</div>
                  <div className="text-lg font-semibold text-gray-900" data-testid="clock-out-time">
                    {attendanceStatus?.clock_out_time
                      ? new Date(attendanceStatus.clock_out_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                      : '--:--'}
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-center gap-2 mb-6">
                {isClockedOut ? (
                  <span className="frappe-badge frappe-badge-gray flex items-center gap-1">
                    <CheckCircle size={14} />
                    Shift Complete
                  </span>
                ) : isClockedIn ? (
                  <span className="frappe-badge frappe-badge-success flex items-center gap-1">
                    <CheckCircle size={14} />
                    Currently Working
                  </span>
                ) : (
                  <span className="frappe-badge frappe-badge-warning flex items-center gap-1">
                    <XCircle size={14} />
                    Not Clocked In
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                {!isClockedIn && !isClockedOut && (
                  <button
                    data-testid="clock-in-btn"
                    onClick={handleClockIn}
                    disabled={actionLoading}
                    className="frappe-btn frappe-btn-primary frappe-btn-kiosk flex-1"
                  >
                    {actionLoading ? (
                      <div className="frappe-spinner"></div>
                    ) : (
                      <>
                        <Clock size={24} />
                        <span>Clock In</span>
                      </>
                    )}
                  </button>
                )}

                {isClockedIn && !isClockedOut && (
                  <button
                    data-testid="clock-out-btn"
                    onClick={handleClockOut}
                    disabled={actionLoading}
                    className="frappe-btn frappe-btn-kiosk flex-1"
                    style={{ backgroundColor: '#EF4444', color: 'white', borderColor: '#EF4444' }}
                  >
                    {actionLoading ? (
                      <div className="frappe-spinner"></div>
                    ) : (
                      <>
                        <Clock size={24} />
                        <span>Clock Out</span>
                      </>
                    )}
                  </button>
                )}

                {isClockedOut && (
                  <div className="flex-1 p-6 bg-green-50 rounded-lg text-center">
                    <CheckCircle size={32} className="mx-auto mb-2 text-green-600" />
                    <p className="text-green-700 font-medium">Your shift is complete!</p>
                    <p className="text-green-600 text-sm">Have a great day.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Offline Queue Notice */}
          {offlineQueue.length > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <WifiOff size={16} />
                <strong>Offline Events Pending</strong>
              </div>
              <p>{offlineQueue.length} event(s) will sync when online.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default StaffDashboard;
