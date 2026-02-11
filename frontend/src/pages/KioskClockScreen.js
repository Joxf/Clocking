import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
  Clock,
  LogOut,
  WifiOff,
  Wifi,
  User,
  Calendar,
  CalendarPlus,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  ChevronRight,
  CloudOff,
  RefreshCw,
  AlertTriangle,
  MessageSquare
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Idle timeout in seconds
const IDLE_TIMEOUT = 60;
// Auto-dismiss success screen after seconds
const SUCCESS_SCREEN_TIMEOUT = 8;

// Late/Early Reason Dialog Component
const LateEarlyReasonDialog = ({ type, reasons, onSubmit, onCancel, isMandatory, enableFreeText }) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [freeTextReason, setFreeTextReason] = useState('');
  const [useFreeText, setUseFreeText] = useState(false);

  const isLate = type === 'late';
  const title = isLate ? 'You are clocking in late' : 'You are clocking in early';
  const subtitle = isLate 
    ? 'Please select a reason for your late arrival'
    : 'Please select a reason for your early arrival';
  const bgColor = isLate ? 'bg-red-50 dark:bg-red-900/20' : 'bg-blue-50 dark:bg-blue-900/20';
  const borderColor = isLate ? 'border-red-200 dark:border-red-800' : 'border-blue-200 dark:border-blue-800';
  const iconColor = isLate ? 'text-red-500' : 'text-blue-500';

  const handleSubmit = () => {
    const reason = useFreeText ? freeTextReason : selectedReason;
    if (isMandatory && !reason) return;
    onSubmit(reason);
  };

  const activeReasons = (reasons || []).filter(r => r.is_active);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`w-full max-w-md ${bgColor} ${borderColor} border-2 rounded-2xl shadow-xl`}>
        {/* Header */}
        <div className="p-6 text-center border-b border-gray-200 dark:border-slate-700">
          <div className={`w-16 h-16 mx-auto rounded-full ${isLate ? 'bg-red-100 dark:bg-red-900/40' : 'bg-blue-100 dark:bg-blue-900/40'} flex items-center justify-center mb-4`}>
            <AlertTriangle size={32} className={iconColor} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-2">{subtitle}</p>
        </div>

        {/* Reason Selection */}
        <div className="p-4 max-h-64 overflow-y-auto">
          <div className="space-y-2">
            {activeReasons.map((reason) => (
              <button
                key={reason.id}
                onClick={() => { setSelectedReason(reason.reason_text); setUseFreeText(false); }}
                className={`w-full p-3 text-left rounded-lg border transition-all ${
                  selectedReason === reason.reason_text && !useFreeText
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:border-gray-300'
                }`}
              >
                {reason.reason_text}
              </button>
            ))}
            
            {enableFreeText && (
              <button
                onClick={() => { setUseFreeText(true); setSelectedReason(''); }}
                className={`w-full p-3 text-left rounded-lg border transition-all ${
                  useFreeText
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} />
                  <span>Other (type your reason)</span>
                </div>
              </button>
            )}
          </div>

          {useFreeText && (
            <textarea
              value={freeTextReason}
              onChange={(e) => setFreeTextReason(e.target.value)}
              placeholder="Please describe your reason..."
              className="w-full mt-3 p-3 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex gap-3">
          {!isMandatory && (
            <button
              onClick={onCancel}
              className="flex-1 py-3 px-4 bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-slate-200 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-slate-500 transition-colors"
            >
              Skip
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={isMandatory && !selectedReason && !freeTextReason}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${
              isMandatory && !selectedReason && !freeTextReason
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isMandatory ? 'Submit & Clock In' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
};

const KioskClockScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    user, 
    token, 
    logout, 
    isOnline, 
    offlineQueue, 
    syncOfflineQueue,
    lastSyncStatus,
    loginPreferences
  } = useAuth();
  
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [shiftInfo, setShiftInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [idleTime, setIdleTime] = useState(0);
  const [syncing, setSyncing] = useState(false);
  
  // Clock-out success state
  const [showClockOutSuccess, setShowClockOutSuccess] = useState(false);
  const [clockOutData, setClockOutData] = useState(null);
  const [nextShift, setNextShift] = useState(null);
  const [successCountdown, setSuccessCountdown] = useState(SUCCESS_SCREEN_TIMEOUT);
  
  // Late/Early reason dialog state
  const [lateEarlyDialog, setLateEarlyDialog] = useState(null); // { type: 'late'|'early', shiftStart }
  const [lateEarlyPrefs, setLateEarlyPrefs] = useState(null);
  
  // Optimistic UI state
  const [optimisticAction, setOptimisticAction] = useState(null);
  const [offlineClockAction, setOfflineClockAction] = useState(null);
  const actionInProgressRef = useRef(false);

  // Count unsynced events
  const unsyncedCount = offlineQueue.filter(e => !e.synced).length;

  // Fetch late/early preferences
  useEffect(() => {
    const fetchLateEarlyPrefs = async () => {
      try {
        const response = await axios.get(`${API}/control-preferences/policies`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // The policies endpoint doesn't include late/early, so we'll use the loginPreferences from context
        // or fetch full prefs if available
      } catch (err) {
        console.log('Using default late/early preferences');
      }
    };
    
    // Use loginPreferences from AuthContext if available
    if (loginPreferences?.late_early) {
      setLateEarlyPrefs(loginPreferences.late_early);
    } else {
      // Set defaults
      setLateEarlyPrefs({
        enable_late_reason: true,
        enable_early_reason: true,
        late_grace_minutes: 5,
        early_grace_minutes: 15,
        late_reason_mandatory: true,
        early_reason_mandatory: false,
        enable_free_text: false,
        late_reasons: [
          { id: '1', reason_text: 'Traffic/Transport issues', is_active: true },
          { id: '2', reason_text: 'Childcare issues', is_active: true },
          { id: '3', reason_text: 'Medical appointment', is_active: true },
          { id: '4', reason_text: 'Family emergency', is_active: true },
          { id: '5', reason_text: 'Weather conditions', is_active: true }
        ],
        early_reasons: [
          { id: '6', reason_text: 'Cover for colleague', is_active: true },
          { id: '7', reason_text: 'Early handover', is_active: true },
          { id: '8', reason_text: 'Training', is_active: true },
          { id: '9', reason_text: 'Meeting', is_active: true }
        ]
      });
    }
  }, [loginPreferences, token]);

  const fetchData = useCallback(async () => {
    // If offline, use cached data
    if (!isOnline) {
      setLoading(false);
      return;
    }
    
    try {
      const [attendanceRes, shiftRes] = await Promise.all([
        axios.get(`${API}/attendance/status`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/shifts/today`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setAttendanceStatus(attendanceRes.data);
      setShiftInfo(shiftRes.data);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/');
  }, [logout, navigate]);

  useEffect(() => {
    if (!user || !token) {
      navigate('/');
      return;
    }
    fetchData();
  }, [user, token, navigate, fetchData]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Idle timer - only when not showing success screen
  useEffect(() => {
    if (showClockOutSuccess) return;
    
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
  }, [showClockOutSuccess, handleLogout]);

  // Success screen countdown
  useEffect(() => {
    if (!showClockOutSuccess) return;
    
    const countdownInterval = setInterval(() => {
      setSuccessCountdown(prev => {
        if (prev <= 1) {
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(countdownInterval);
  }, [showClockOutSuccess, handleLogout]);

  // Handle manual sync
  const handleSync = async () => {
    if (!isOnline || syncing) return;
    setSyncing(true);
    try {
      await syncOfflineQueue();
      await fetchData();
    } finally {
      setSyncing(false);
    }
  };

  // Check if clock-in is late or early
  const checkLateEarly = () => {
    if (!shiftInfo?.scheduled_shift || !lateEarlyPrefs) return null;
    
    const now = new Date();
    const shiftStart = new Date(shiftInfo.scheduled_shift.start_time);
    const diffMinutes = (now - shiftStart) / (1000 * 60);
    
    // Late: current time > shift start + grace period
    if (diffMinutes > (lateEarlyPrefs.late_grace_minutes || 5)) {
      if (lateEarlyPrefs.enable_late_reason) {
        return { type: 'late', shiftStart };
      }
    }
    
    // Early: current time < shift start - grace period  
    if (diffMinutes < -(lateEarlyPrefs.early_grace_minutes || 15)) {
      if (lateEarlyPrefs.enable_early_reason) {
        return { type: 'early', shiftStart };
      }
    }
    
    return null;
  };

  const handleClockIn = async (lateEarlyReason = null) => {
    if (actionInProgressRef.current) return;
    
    // Check late/early status and show dialog if needed
    if (!lateEarlyReason && !lateEarlyDialog) {
      const lateEarlyStatus = checkLateEarly();
      if (lateEarlyStatus) {
        setLateEarlyDialog(lateEarlyStatus);
        return;
      }
    }
    
    actionInProgressRef.current = true;
    
    // Optimistic UI - immediately show clocked in
    setOptimisticAction('clock_in');
    setActionLoading(true);
    
    try {
      const response = await axios.post(`${API}/attendance/clock`, {
        employee_id: user.employee_id,
        action: 'clock_in',
        late_early_reason: lateEarlyReason
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Check if this was queued offline
      if (response.data?.offline || response.data?.queued) {
        setOfflineClockAction({ type: 'clock_in', timestamp: new Date().toISOString() });
      }
      
      // Refresh data after successful clock-in
      if (isOnline) {
        await fetchData();
      }
      setOptimisticAction(null);
      setLateEarlyDialog(null);
    } catch (err) {
      console.error('Clock in failed:', err);
      // Revert optimistic update
      setOptimisticAction(null);
      if (isOnline) {
        await fetchData();
      }
    } finally {
      setActionLoading(false);
      actionInProgressRef.current = false;
    }
  };

  const handleLateEarlySubmit = (reason) => {
    setLateEarlyDialog(null);
    handleClockIn(reason);
  };

  const handleLateEarlyCancel = () => {
    setLateEarlyDialog(null);
    // If mandatory, don't proceed with clock-in
    const isMandatory = lateEarlyDialog?.type === 'late' 
      ? lateEarlyPrefs?.late_reason_mandatory 
      : lateEarlyPrefs?.early_reason_mandatory;
    
    if (!isMandatory) {
      handleClockIn('');
    }
  };

  const handleClockOut = async () => {
    if (actionInProgressRef.current) return;
    actionInProgressRef.current = true;
    
    // Optimistic UI - immediately show clocked out
    setOptimisticAction('clock_out');
    setActionLoading(true);
    
    try {
      const response = await axios.post(`${API}/attendance/clock`, {
        employee_id: user.employee_id,
        action: 'clock_out'
      }, {
        headers: { Authorization: `Bearer ${token}` });
      
      // Set clock-out success data
      const timestamp = response.data?.timestamp || new Date().toISOString();
      setClockOutData({
        timestamp: timestamp,
        clockInTime: attendanceStatus?.clock_in_time,
        offline: response.data?.offline || response.data?.queued
      });
      
      // Get next shift info
      if (response.data?.next_shift) {
        setNextShift(response.data.next_shift);
      } else if (isOnline) {
        // Fetch next shift separately if not in response
        try {
          const nextShiftRes = await axios.get(`${API}/shifts/next`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (nextShiftRes.data.has_next_shift) {
            setNextShift({
              ...nextShiftRes.data.shift,
              date_label: nextShiftRes.data.date_label
            });
          }
        } catch (e) {
          console.error('Failed to fetch next shift:', e);
        }
      }
      
      // Show success screen
      setShowClockOutSuccess(true);
      setOptimisticAction(null);
      
    } catch (err) {
      console.error('Clock out failed:', err);
      // Revert optimistic update
      setOptimisticAction(null);
      await fetchData();
    } finally {
      setActionLoading(false);
      actionInProgressRef.current = false;
    }
  };

  const goToProfile = () => {
    navigate('/staff/profile');
  };

  const goToRequests = () => {
    navigate('/staff/requests');
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatTimeOnly = (isoString) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const getShiftTypeLabel = (type) => {
    const labels = {
      early: 'Early Shift',
      late: 'Late Shift',
      night: 'Night Shift',
      long_day: 'Long Day'
    };
    return labels[type] || type;
  };

  const getNextShiftDateLabel = () => {
    if (!nextShift) return '';
    if (nextShift.date_label) return nextShift.date_label;
    
    const shiftDate = new Date(nextShift.shift_date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (shiftDate.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }
    return shiftDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
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

  // Determine effective status (considering optimistic updates)
  const getEffectiveStatus = () => {
    if (optimisticAction === 'clock_in') {
      return { isClockedIn: true, isClockedOut: false };
    }
    if (optimisticAction === 'clock_out') {
      return { isClockedIn: true, isClockedOut: true };
    }
    return {
      isClockedIn: attendanceStatus?.clocked_in && !attendanceStatus?.clocked_out,
      isClockedOut: attendanceStatus?.clocked_out
    };
  };

  if (loading) {
    return (
      <div className="kiosk-container">
        <div className="frappe-spinner"></div>
      </div>
    );
  }

  // Clock-out Success Screen
  if (showClockOutSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center" data-testid="clock-out-success">
          {/* Success Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
            {clockOutData?.offline ? (
              <CloudOff size={48} className="text-green-600" />
            ) : (
              <CheckCircle size={48} className="text-green-600" />
            )}
          </div>
          
          {/* Success Message */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2" data-testid="success-title">
            Successfully Clocked Out
          </h1>
          {clockOutData?.offline && (
            <p className="text-orange-500 text-sm mb-2" data-testid="offline-notice">
              (Queued offline - will sync when connected)
            </p>
          )}
          <p className="text-gray-500 mb-6" data-testid="clock-out-time">
            {new Date(clockOutData?.timestamp).toLocaleString('en-GB', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
          
          {/* Next Shift Card */}
          {nextShift ? (
            <div className="bg-blue-50 rounded-xl p-5 mb-6 text-left" data-testid="next-shift-card">
              <div className="flex items-center gap-2 text-blue-600 text-sm font-medium mb-2">
                <Calendar size={16} />
                <span>Your Next Shift</span>
              </div>
              <div className="text-lg font-semibold text-gray-900 mb-1" data-testid="next-shift-date">
                {getNextShiftDateLabel()}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xl font-bold text-gray-900" data-testid="next-shift-time">
                    {nextShift.start_time} - {nextShift.end_time}
                  </span>
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {getShiftTypeLabel(nextShift.shift_type)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-5 mb-6 text-center" data-testid="no-next-shift">
              <Calendar size={24} className="mx-auto mb-2 text-gray-400" />
              <p className="text-gray-500 text-sm">No upcoming shifts scheduled</p>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={goToProfile}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition font-medium"
              data-testid="view-profile-btn"
            >
              <User size={18} />
              <span>View Profile</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-medium"
              data-testid="done-btn"
            >
              <span>Done</span>
              <ChevronRight size={18} />
            </button>
          </div>
          
          {/* Auto-dismiss countdown */}
          <p className="text-xs text-gray-400">
            Returning to login in {successCountdown}s
          </p>
        </div>
      </div>
    );
  }

  const { isClockedIn, isClockedOut } = getEffectiveStatus();
  const canClock = shiftInfo?.can_clock || false;
  const hasShift = shiftInfo?.has_shift || false;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900 transition-colors">
      {/* Late/Early Reason Dialog */}
      {lateEarlyDialog && lateEarlyPrefs && (
        <LateEarlyReasonDialog
          type={lateEarlyDialog.type}
          reasons={lateEarlyDialog.type === 'late' ? lateEarlyPrefs.late_reasons : lateEarlyPrefs.early_reasons}
          onSubmit={handleLateEarlySubmit}
          onCancel={handleLateEarlyCancel}
          isMandatory={lateEarlyDialog.type === 'late' ? lateEarlyPrefs.late_reason_mandatory : lateEarlyPrefs.early_reason_mandatory}
          enableFreeText={lateEarlyPrefs.enable_free_text}
        />
      )}

      {/* Header */}
      <header className="frappe-header justify-between dark:bg-slate-800 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">CH</span>
          </div>
          <span className="font-semibold text-gray-900 dark:text-white">Comber Home</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Offline indicator with sync button */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${isOnline ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
            {isOnline ? (
              <>
                <Wifi size={14} />
                <span>Online</span>
                {unsyncedCount > 0 && (
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="ml-1 p-1 hover:bg-green-200 dark:hover:bg-green-900/50 rounded"
                    title="Sync pending events"
                    data-testid="sync-btn"
                  >
                    <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                  </button>
                )}
              </>
            ) : (
              <>
                <WifiOff size={14} />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* Unsynced events badge */}
          {unsyncedCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full text-xs" data-testid="unsynced-badge">
              <CloudOff size={12} />
              <span>{unsyncedCount} pending</span>
            </div>
          )}

          {/* Idle timer warning */}
          {idleTime > 30 && (
            <div className="flex items-center gap-2 text-orange-600 text-sm">
              <AlertCircle size={14} />
              <span>Session ends in {IDLE_TIMEOUT - idleTime}s</span>
            </div>
          )}
          
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Profile button */}
          <button
            data-testid="profile-btn"
            onClick={goToProfile}
            className="frappe-btn frappe-btn-secondary dark:bg-slate-700 dark:text-white dark:border-slate-600"
          >
            <User size={16} />
            <span>My Profile</span>
          </button>

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

      {/* Main content */}
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

          {/* Shift Info Card */}
          {hasShift && shiftInfo?.shift && (
            <div className="frappe-card mb-6">
              <div className="frappe-card-header flex items-center gap-2">
                <Calendar size={18} />
                <span>Today's Shift</span>
              </div>
              <div className="frappe-card-content">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      {shiftInfo.shift.start_time} - {shiftInfo.shift.end_time}
                    </p>
                    <p className="text-sm text-gray-500">{getShiftTypeLabel(shiftInfo.shift.shift_type)}</p>
                  </div>
                  {canClock ? (
                    <span className="frappe-badge frappe-badge-success">Within clocking window</span>
                  ) : (
                    <span className="frappe-badge frappe-badge-warning">Outside clocking window</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* No Shift Today */}
          {!hasShift && (
            <div className="frappe-card mb-6">
              <div className="frappe-card-content text-center py-8">
                <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Shift Scheduled Today</h3>
                <p className="text-gray-500 mb-4">You don't have a shift today. View your upcoming rota in your profile.</p>
                <button
                  onClick={goToProfile}
                  className="frappe-btn frappe-btn-primary"
                  data-testid="go-to-profile-btn"
                >
                  <span>Go to My Profile</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Status Card - Only show if has shift */}
          {hasShift && (
            <div className="frappe-card mb-6">
              <div className="frappe-card-header flex items-center gap-2">
                <Clock size={18} />
                <span>Today's Status</span>
              </div>
              <div className="frappe-card-content">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500 mb-1">Clock In</div>
                    <div className="text-lg font-semibold text-gray-900" data-testid="clock-in-time">
                      {optimisticAction === 'clock_in' 
                        ? formatTime(new Date())
                        : formatTimeOnly(attendanceStatus?.clock_in_time)}
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500 mb-1">Clock Out</div>
                    <div className="text-lg font-semibold text-gray-900" data-testid="clock-out-display">
                      {optimisticAction === 'clock_out'
                        ? formatTime(new Date())
                        : formatTimeOnly(attendanceStatus?.clock_out_time)}
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
                {canClock ? (
                  <div className="flex gap-4">
                    {!isClockedIn && !isClockedOut && (
                      <button
                        data-testid="clock-in-btn"
                        onClick={handleClockIn}
                        disabled={actionLoading}
                        className="frappe-btn frappe-btn-primary frappe-btn-kiosk flex-1"
                      >
                        {actionLoading && optimisticAction === 'clock_in' ? (
                          <>
                            <CheckCircle size={24} className="text-green-300" />
                            <span>Clocking In...</span>
                          </>
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
                        {actionLoading && optimisticAction === 'clock_out' ? (
                          <>
                            <CheckCircle size={24} className="text-green-300" />
                            <span>Clocking Out...</span>
                          </>
                        ) : (
                          <>
                            <Clock size={24} />
                            <span>Clock Out</span>
                          </>
                        )}
                      </button>
                    )}

                    {isClockedOut && !showClockOutSuccess && (
                      <div className="flex-1 p-6 bg-green-50 rounded-lg text-center">
                        <CheckCircle size={32} className="mx-auto mb-2 text-green-600" />
                        <p className="text-green-700 font-medium">Your shift is complete!</p>
                        <p className="text-green-600 text-sm">Have a great day.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                    <AlertCircle size={24} className="mx-auto mb-2 text-yellow-600" />
                    <p className="text-yellow-700 font-medium">Outside Clocking Window</p>
                    <p className="text-yellow-600 text-sm">
                      You can clock in 30 minutes before your shift and up to 2 hours after it ends.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={goToRequests}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-2"
              data-testid="new-request-btn"
            >
              <CalendarPlus size={16} />
              New Request
            </button>
            <button
              onClick={goToProfile}
              className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              View My Profile
            </button>
          </div>

          {/* Offline Queue Notice */}
          {unsyncedCount > 0 && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm" data-testid="offline-queue-notice">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-yellow-700">
                  <CloudOff size={16} />
                  <strong>Offline Events Pending</strong>
                </div>
                {isOnline && (
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex items-center gap-1 px-3 py-1 bg-yellow-200 hover:bg-yellow-300 rounded text-yellow-800 text-xs font-medium"
                    data-testid="sync-queue-btn"
                  >
                    <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                    {syncing ? 'Syncing...' : 'Sync Now'}
                  </button>
                )}
              </div>
              <p className="text-yellow-700">
                {unsyncedCount} event(s) will sync {isOnline ? 'automatically or click Sync Now' : 'when back online'}.
              </p>
              {lastSyncStatus?.success && (
                <p className="text-green-600 text-xs mt-1">
                  Last sync: {lastSyncStatus.synced} events synced
                </p>
              )}
            </div>
          )}

          {/* Offline Mode Notice */}
          {!isOnline && (
            <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg text-sm" data-testid="offline-mode-notice">
              <div className="flex items-center gap-2 text-orange-700 mb-2">
                <WifiOff size={16} />
                <strong>Offline Mode</strong>
              </div>
              <p className="text-orange-600">
                Clock-in/out events will be queued locally and synced when connection is restored.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default KioskClockScreen;
