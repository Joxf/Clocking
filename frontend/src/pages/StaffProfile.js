import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import NotificationBell from '../components/NotificationBell';
import MessagesInbox from '../components/MessagesInbox';
import MonthlyCalendar from '../components/MonthlyCalendar';
import TeamCalendar from '../components/TeamCalendar';
import {
  User,
  Calendar,
  Clock,
  RefreshCcw,
  LogOut,
  WifiOff,
  Wifi,
  CalendarDays,
  CalendarPlus,
  CalendarMinus,
  Stethoscope,
  AlertCircle,
  CheckCircle,
  XCircle,
  Plus,
  Users,
  Send,
  Trash2,
  MessageSquare,
  UserCheck,
  UserPlus
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const StaffProfile = () => {
  const navigate = useNavigate();
  const { user, token, logout, isOnline, offlineQueue } = useAuth();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [dayRequests, setDayRequests] = useState([]);
  const [shiftSwaps, setShiftSwaps] = useState({ shift_swaps: [], available_swaps: [], direct_requests: [] });
  const [colleagues, setColleagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [idleTime, setIdleTime] = useState(0);
  
  // Modal states
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showDayRequestModal, setShowDayRequestModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  
  // Form data states (lifted to parent to prevent reset)
  const [leaveFormData, setLeaveFormData] = useState({
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    reason: ''
  });
  const [dayFormData, setDayFormData] = useState({
    request_type: 'day_off',
    requested_date: '',
    reason: ''
  });
  const [swapFormData, setSwapFormData] = useState({
    swapType: 'open',
    targetColleague: '',
    reason: '',
    messageToManager: ''
  });
  const [formSubmitting, setFormSubmitting] = useState(false);

  const IDLE_TIMEOUT = 60;

  useEffect(() => {
    if (!user || !token) {
      navigate('/');
      return;
    }
    fetchAllData();
  }, [user, token, navigate]);

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

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [profileRes, leaveRes, dayRes, swapRes, colleaguesRes] = await Promise.all([
        axios.get(`${API}/staff/profile`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/leave-requests`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/day-requests`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/shift-swaps`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/staff/colleagues`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      setProfile(profileRes.data);
      setLeaveRequests(leaveRes.data.leave_requests || []);
      setDayRequests(dayRes.data.day_requests || []);
      setShiftSwaps(swapRes.data);
      setColleagues(colleaguesRes.data.colleagues || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/');
  }, [logout, navigate]);

  const goToClockScreen = () => {
    navigate('/staff');
  };

  const getJobTitleDisplay = (jobTitle) => {
    const titles = {
      nurse: 'Nurse',
      senior_carer: 'Senior Carer',
      carer: 'Carer',
      activities: 'Activities Coordinator',
      kitchen: 'Kitchen Staff',
      maintenance: 'Maintenance'
    };
    return titles[jobTitle] || jobTitle;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-GB', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'frappe-badge-warning',
      pending_acceptance: 'frappe-badge-warning',
      accepted_pending_approval: 'frappe-badge-primary',
      approved: 'frappe-badge-success',
      rejected: 'frappe-badge-error',
      cancelled: 'frappe-badge-gray',
      open: 'frappe-badge-primary',
      accepted: 'frappe-badge-success'
    };
    const labels = {
      pending: 'Pending',
      pending_acceptance: 'Awaiting Accept',
      accepted_pending_approval: 'Awaiting Approval',
      approved: 'Approved',
      rejected: 'Rejected',
      cancelled: 'Cancelled'
    };
    return <span className={`frappe-badge ${styles[status] || 'frappe-badge-gray'}`}>{labels[status] || status}</span>;
  };

  // Leave Request Modal
  const LeaveRequestModal = () => {
    const [formData, setFormData] = useState({
      leave_type: 'annual',
      start_date: '',
      end_date: '',
      reason: ''
    });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        await axios.post(`${API}/leave-requests`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setShowLeaveModal(false);
        fetchAllData();
      } catch (err) {
        alert(err.response?.data?.detail || 'Failed to submit request');
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Request Leave</h2>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                <select
                  value={formData.leave_type}
                  onChange={(e) => setFormData({...formData, leave_type: e.target.value})}
                  className="frappe-input"
                >
                  <option value="annual">Annual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                  <option value="compassionate">Compassionate Leave</option>
                  <option value="maternity">Maternity Leave</option>
                  <option value="paternity">Paternity Leave</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" value={formData.start_date} onChange={(e) => setFormData({...formData, start_date: e.target.value})} className="frappe-input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" value={formData.end_date} onChange={(e) => setFormData({...formData, end_date: e.target.value})} className="frappe-input" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <textarea value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} className="frappe-input" rows={3} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowLeaveModal(false)} className="frappe-btn frappe-btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={submitting} className="frappe-btn frappe-btn-primary flex-1">{submitting ? 'Submitting...' : 'Submit Request'}</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Day Request Modal
  const DayRequestModal = () => {
    const [formData, setFormData] = useState({ request_type: 'day_off', requested_date: '', reason: '' });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        await axios.post(`${API}/day-requests`, formData, { headers: { Authorization: `Bearer ${token}` } });
        setShowDayRequestModal(false);
        fetchAllData();
      } catch (err) {
        alert(err.response?.data?.detail || 'Failed to submit request');
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Request Day On/Off</h2>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Request Type</label>
                <select value={formData.request_type} onChange={(e) => setFormData({...formData, request_type: e.target.value})} className="frappe-input">
                  <option value="day_off">Request Day Off</option>
                  <option value="day_on">Request Day On (Extra Shift)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={formData.requested_date} onChange={(e) => setFormData({...formData, requested_date: e.target.value})} className="frappe-input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} className="frappe-input" rows={3} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowDayRequestModal(false)} className="frappe-btn frappe-btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={submitting} className="frappe-btn frappe-btn-primary flex-1">{submitting ? 'Submitting...' : 'Submit Request'}</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Enhanced Shift Swap Modal with 3 options
  const ShiftSwapModal = () => {
    const [swapType, setSwapType] = useState('open'); // open, direct, manager
    const [targetColleague, setTargetColleague] = useState('');
    const [reason, setReason] = useState('');
    const [messageToManager, setMessageToManager] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!selectedShift) return;
      
      setSubmitting(true);
      try {
        await axios.post(`${API}/shift-swaps`, {
          original_shift_id: selectedShift.id,
          swap_type: swapType,
          target_id: swapType === 'direct' ? targetColleague : null,
          reason: reason,
          message_to_manager: swapType === 'manager' ? messageToManager : null
        }, { headers: { Authorization: `Bearer ${token}` } });
        
        setShowSwapModal(false);
        setSelectedShift(null);
        fetchAllData();
      } catch (err) {
        alert(err.response?.data?.detail || 'Failed to create swap request');
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Request Shift Swap</h2>
          
          {selectedShift && (
            <div className="p-4 bg-blue-50 rounded-lg mb-4">
              <p className="text-sm text-blue-700"><strong>Shift:</strong> {formatDate(selectedShift.shift_date)}</p>
              <p className="text-sm text-blue-700"><strong>Time:</strong> {selectedShift.start_time} - {selectedShift.end_time}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Swap Type Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">How would you like to swap?</label>
              <div className="space-y-2">
                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${swapType === 'open' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                  <input type="radio" name="swapType" value="open" checked={swapType === 'open'} onChange={(e) => setSwapType(e.target.value)} />
                  <Users size={20} className="text-blue-600" />
                  <div>
                    <p className="font-medium">Post Open Request</p>
                    <p className="text-xs text-gray-500">Any colleague can accept this swap</p>
                  </div>
                </label>
                
                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${swapType === 'direct' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                  <input type="radio" name="swapType" value="direct" checked={swapType === 'direct'} onChange={(e) => setSwapType(e.target.value)} />
                  <UserCheck size={20} className="text-green-600" />
                  <div>
                    <p className="font-medium">Request Specific Colleague</p>
                    <p className="text-xs text-gray-500">Send swap request to someone you've already agreed with</p>
                  </div>
                </label>
                
                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${swapType === 'manager' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                  <input type="radio" name="swapType" value="manager" checked={swapType === 'manager'} onChange={(e) => setSwapType(e.target.value)} />
                  <MessageSquare size={20} className="text-purple-600" />
                  <div>
                    <p className="font-medium">Contact Manager</p>
                    <p className="text-xs text-gray-500">Send message directly to manager for help</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Direct swap - select colleague */}
            {swapType === 'direct' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Colleague</label>
                <select value={targetColleague} onChange={(e) => setTargetColleague(e.target.value)} className="frappe-input" required>
                  <option value="">Choose a colleague...</option>
                  {colleagues.map((c) => (
                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({getJobTitleDisplay(c.job_title)})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Manager message */}
            {swapType === 'manager' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Message to Manager</label>
                <textarea value={messageToManager} onChange={(e) => setMessageToManager(e.target.value)} className="frappe-input" rows={3} placeholder="Explain your situation and what help you need..." required />
              </div>
            )}

            {/* Reason */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason for swap</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="frappe-input" rows={2} placeholder="Why do you need to swap this shift?" />
            </div>

            {/* Info note */}
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4 text-sm text-yellow-700">
              <AlertCircle size={16} className="inline mr-1" />
              All shift swaps require manager approval before they are finalized.
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => { setShowSwapModal(false); setSelectedShift(null); }} className="frappe-btn frappe-btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={submitting} className="frappe-btn frappe-btn-primary flex-1">{submitting ? 'Submitting...' : 'Submit Request'}</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const handleAcceptSwap = async (swapId) => {
    try {
      await axios.post(`${API}/shift-swaps/${swapId}/accept`, {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to accept swap');
    }
  };

  const handleCancelSwap = async (swapId) => {
    try {
      await axios.post(`${API}/shift-swaps/${swapId}/cancel`, {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to cancel swap');
    }
  };

  const handleCancelLeave = async (requestId) => {
    try {
      await axios.delete(`${API}/leave-requests/${requestId}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to cancel request');
    }
  };

  const openSwapModal = (shift) => {
    setSelectedShift(shift);
    setShowSwapModal(true);
  };

  if (loading) {
    return <div className="kiosk-container"><div className="frappe-spinner"></div></div>;
  }

  const availableSwaps = shiftSwaps.available_swaps || [];
  const directRequests = shiftSwaps.direct_requests || [];
  const mySwaps = shiftSwaps.shift_swaps || [];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="frappe-header justify-between">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">CH</span>
          </div>
          <span className="font-semibold text-gray-900">Comber Home</span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600">My Profile</span>
        </div>

        <div className="flex items-center gap-4">
          <div className={`offline-indicator ${isOnline ? 'online' : ''}`}>
            {isOnline ? <><Wifi size={14} /><span>Online</span></> : <><WifiOff size={14} /><span>Offline ({offlineQueue.length})</span></>}
          </div>

          {idleTime > 30 && (
            <div className="flex items-center gap-2 text-orange-600 text-sm">
              <AlertCircle size={14} />
              <span>Session ends in {IDLE_TIMEOUT - idleTime}s</span>
            </div>
          )}

          <button onClick={() => setShowMessagesModal(true)} className="p-2 rounded-lg hover:bg-gray-100" data-testid="messages-btn">
            <MessageSquare size={20} className="text-gray-600" />
          </button>

          <NotificationBell />

          <button onClick={() => navigate('/staff/requests')} className="frappe-btn frappe-btn-primary" data-testid="new-request-btn">
            <Plus size={16} />
            <span>New Request</span>
          </button>

          <button onClick={goToClockScreen} className="frappe-btn frappe-btn-secondary" data-testid="go-to-clock-btn">
            <Clock size={16} />
            <span>Clock In/Out</span>
          </button>

          <button data-testid="logout-btn" onClick={handleLogout} className="frappe-btn frappe-btn-secondary">
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="frappe-sidebar">
        <div className="frappe-sidebar-section">Profile</div>
        <button onClick={() => setActiveTab('overview')} className={`frappe-sidebar-item w-full text-left ${activeTab === 'overview' ? 'active' : ''}`}>
          <User size={18} /><span>Overview</span>
        </button>
        
        <div className="frappe-sidebar-section">Schedule</div>
        <button onClick={() => setActiveTab('rota')} className={`frappe-sidebar-item w-full text-left ${activeTab === 'rota' ? 'active' : ''}`}>
          <CalendarDays size={18} /><span>My Rota</span>
        </button>
        <button onClick={() => setActiveTab('swaps')} className={`frappe-sidebar-item w-full text-left ${activeTab === 'swaps' ? 'active' : ''}`}>
          <RefreshCcw size={18} /><span>Shift Swaps</span>
          {(availableSwaps.length + directRequests.length) > 0 && (
            <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
              {availableSwaps.length + directRequests.length}
            </span>
          )}
        </button>
        
        <div className="frappe-sidebar-section">Time Off</div>
        <button onClick={() => setActiveTab('leave')} className={`frappe-sidebar-item w-full text-left ${activeTab === 'leave' ? 'active' : ''}`}>
          <Calendar size={18} /><span>Annual Leave</span>
        </button>
        <button onClick={() => setActiveTab('teamCalendar')} className={`frappe-sidebar-item w-full text-left ${activeTab === 'teamCalendar' ? 'active' : ''}`}>
          <Users size={18} /><span>Team Calendar</span>
        </button>
        <button onClick={() => setActiveTab('sick')} className={`frappe-sidebar-item w-full text-left ${activeTab === 'sick' ? 'active' : ''}`}>
          <Stethoscope size={18} /><span>Sick Leave</span>
        </button>
        <button onClick={() => setActiveTab('dayRequests')} className={`frappe-sidebar-item w-full text-left ${activeTab === 'dayRequests' ? 'active' : ''}`}>
          <CalendarPlus size={18} /><span>Day Requests</span>
        </button>
      </aside>

      {/* Main content */}
      <main className="frappe-main">
        {/* Overview Tab */}
        {activeTab === 'overview' && profile && (
          <>
            <h1 className="frappe-page-title">Welcome, {profile.employee.first_name}</h1>
            
            <div className="frappe-card mb-6">
              <div className="frappe-card-content">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                    <User size={40} className="text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900">{profile.employee.first_name} {profile.employee.last_name}</h2>
                    <p className="text-gray-500">{getJobTitleDisplay(profile.employee.job_title)}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="frappe-badge frappe-badge-primary">{profile.employee.employee_id}</span>
                      <span className={`frappe-badge ${profile.employee.employment_type === 'agency' ? 'frappe-badge-warning' : 'frappe-badge-gray'}`}>
                        {profile.employee.employment_type === 'agency' ? 'Agency' : 'Permanent'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="frappe-stat-card">
                <div className="frappe-stat-label">Annual Leave Remaining</div>
                <div className="frappe-stat-value text-green-600">{profile.leave_balance.annual_remaining}</div>
                <div className="text-xs text-gray-500">of {profile.leave_balance.annual_total} days</div>
              </div>
              <div className="frappe-stat-card">
                <div className="frappe-stat-label">Upcoming Shifts</div>
                <div className="frappe-stat-value text-blue-600">{profile.upcoming_shifts}</div>
              </div>
              <div className="frappe-stat-card">
                <div className="frappe-stat-label">Pending Requests</div>
                <div className="frappe-stat-value text-orange-600">{profile.pending_counts.leave_requests + profile.pending_counts.day_requests}</div>
              </div>
              <div className="frappe-stat-card">
                <div className="frappe-stat-label">Open Swap Requests</div>
                <div className="frappe-stat-value">{profile.pending_counts.open_swaps}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <button onClick={() => setShowLeaveModal(true)} className="frappe-card p-6 text-left hover:bg-gray-50 transition-colors">
                <CalendarMinus size={24} className="text-blue-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-1">Request Leave</h3>
                <p className="text-sm text-gray-500">Book annual or other leave</p>
              </button>
              <button onClick={() => setShowDayRequestModal(true)} className="frappe-card p-6 text-left hover:bg-gray-50 transition-colors">
                <CalendarPlus size={24} className="text-purple-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-1">Request Day On/Off</h3>
                <p className="text-sm text-gray-500">Request specific days</p>
              </button>
              <button onClick={() => setActiveTab('swaps')} className="frappe-card p-6 text-left hover:bg-gray-50 transition-colors">
                <RefreshCcw size={24} className="text-green-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-1">View Shift Swaps</h3>
                <p className="text-sm text-gray-500">See available swaps</p>
              </button>
            </div>
          </>
        )}

        {/* Rota Tab - Monthly Calendar */}
        {activeTab === 'rota' && (
          <>
            <h1 className="frappe-page-title">My Rota</h1>
            <MonthlyCalendar onSwapClick={openSwapModal} />
          </>
        )}

        {/* Shift Swaps Tab */}
        {activeTab === 'swaps' && (
          <>
            <h1 className="frappe-page-title">Shift Swaps</h1>
            
            {/* Direct requests to me */}
            {directRequests.length > 0 && (
              <div className="frappe-card mb-6">
                <div className="frappe-card-header flex items-center gap-2 bg-orange-50">
                  <UserPlus size={18} className="text-orange-600" />
                  <span>Direct Requests to You</span>
                </div>
                <div className="frappe-card-content">
                  <div className="space-y-3">
                    {directRequests.map((swap) => (
                      <div key={swap.id} className="p-4 border border-orange-200 bg-orange-50 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{swap.requester_name} wants to swap with you</p>
                          <p className="text-sm text-gray-500">{formatDate(swap.shift_date)} • {swap.shift_start} - {swap.shift_end}</p>
                          {swap.reason && <p className="text-sm text-gray-400 mt-1">"{swap.reason}"</p>}
                        </div>
                        <button onClick={() => handleAcceptSwap(swap.id)} className="frappe-btn frappe-btn-primary">Accept Swap</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Available swaps from others */}
            <div className="frappe-card mb-6">
              <div className="frappe-card-header flex items-center gap-2">
                <Users size={18} />
                <span>Available Swaps from Colleagues</span>
              </div>
              <div className="frappe-card-content">
                {availableSwaps.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No open shift swaps available</p>
                ) : (
                  <div className="space-y-3">
                    {availableSwaps.map((swap) => (
                      <div key={swap.id} className="p-4 border border-gray-200 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{swap.requester_name}</p>
                          <p className="text-sm text-gray-500">{formatDate(swap.shift_date)} • {swap.shift_start} - {swap.shift_end}</p>
                          {swap.reason && <p className="text-sm text-gray-400 mt-1">"{swap.reason}"</p>}
                        </div>
                        <button onClick={() => handleAcceptSwap(swap.id)} className="frappe-btn frappe-btn-primary">Accept Swap</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* My swap requests */}
            <div className="frappe-card">
              <div className="frappe-card-header">My Swap Requests</div>
              <div className="frappe-card-content">
                {mySwaps.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">You haven't posted any swap requests</p>
                ) : (
                  <div className="space-y-3">
                    {mySwaps.map((swap) => (
                      <div key={swap.id} className="p-4 border border-gray-200 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{formatDate(swap.shift_date)} • {swap.shift_start} - {swap.shift_end}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {getStatusBadge(swap.status)}
                            {swap.accepted_by_name && <span className="text-sm text-green-600">Accepted by {swap.accepted_by_name}</span>}
                            {swap.swap_type === 'direct' && swap.target_name && <span className="text-sm text-blue-600">Sent to {swap.target_name}</span>}
                          </div>
                        </div>
                        {['pending_acceptance', 'accepted_pending_approval'].includes(swap.status) && (
                          <button onClick={() => handleCancelSwap(swap.id)} className="frappe-btn frappe-btn-secondary text-red-600">
                            <Trash2 size={14} />Cancel
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Leave Tab */}
        {activeTab === 'leave' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h1 className="frappe-page-title mb-0">Annual Leave</h1>
              <button onClick={() => setShowLeaveModal(true)} className="frappe-btn frappe-btn-primary"><Plus size={16} /><span>Request Leave</span></button>
            </div>

            {profile && (
              <div className="frappe-card mb-6">
                <div className="frappe-card-content">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-3xl font-bold text-blue-700">{profile.leave_balance.annual_total}</div>
                      <div className="text-sm text-blue-600">Total Entitlement</div>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <div className="text-3xl font-bold text-orange-700">{profile.leave_balance.annual_used}</div>
                      <div className="text-sm text-orange-600">Days Used</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-3xl font-bold text-green-700">{profile.leave_balance.annual_remaining}</div>
                      <div className="text-sm text-green-600">Days Remaining</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="frappe-card">
              <div className="frappe-card-header">Leave Requests</div>
              <div className="overflow-x-auto">
                <table className="frappe-table">
                  <thead><tr><th>Type</th><th>Start</th><th>End</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {leaveRequests.filter(r => r.leave_type === 'annual').length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-8 text-gray-500">No annual leave requests</td></tr>
                    ) : (
                      leaveRequests.filter(r => r.leave_type === 'annual').map((req) => (
                        <tr key={req.id}>
                          <td><span className="frappe-badge frappe-badge-primary">Annual</span></td>
                          <td>{formatDate(req.start_date)}</td>
                          <td>{formatDate(req.end_date)}</td>
                          <td>{getStatusBadge(req.status)}</td>
                          <td>{req.status === 'pending' && <button onClick={() => handleCancelLeave(req.id)} className="frappe-btn frappe-btn-secondary text-xs py-1 px-2 text-red-600">Cancel</button>}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Team Calendar Tab */}
        {activeTab === 'teamCalendar' && (
          <>
            <h1 className="frappe-page-title">Team Availability Calendar</h1>
            <TeamCalendar />
          </>
        )}

        {/* Sick Leave Tab */}
        {activeTab === 'sick' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h1 className="frappe-page-title mb-0">Sick Leave & Absences</h1>
              <button onClick={() => setShowLeaveModal(true)} className="frappe-btn frappe-btn-primary"><Stethoscope size={16} /><span>Record Absence</span></button>
            </div>
            <div className="frappe-card">
              <div className="frappe-card-header">Sick Leave Records</div>
              <div className="overflow-x-auto">
                <table className="frappe-table">
                  <thead><tr><th>Type</th><th>Start</th><th>End</th><th>Reason</th><th>Status</th></tr></thead>
                  <tbody>
                    {leaveRequests.filter(r => ['sick', 'compassionate', 'unpaid'].includes(r.leave_type)).length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-8 text-gray-500">No sick leave records</td></tr>
                    ) : (
                      leaveRequests.filter(r => ['sick', 'compassionate', 'unpaid'].includes(r.leave_type)).map((req) => (
                        <tr key={req.id}>
                          <td><span className={`frappe-badge ${req.leave_type === 'sick' ? 'frappe-badge-error' : 'frappe-badge-warning'}`}>{req.leave_type}</span></td>
                          <td>{formatDate(req.start_date)}</td>
                          <td>{formatDate(req.end_date)}</td>
                          <td className="text-gray-500">{req.reason || '-'}</td>
                          <td>{getStatusBadge(req.status)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Day Requests Tab */}
        {activeTab === 'dayRequests' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h1 className="frappe-page-title mb-0">Day On/Off Requests</h1>
              <button onClick={() => setShowDayRequestModal(true)} className="frappe-btn frappe-btn-primary"><Plus size={16} /><span>New Request</span></button>
            </div>
            <div className="frappe-card">
              <div className="frappe-card-header">Your Requests</div>
              <div className="overflow-x-auto">
                <table className="frappe-table">
                  <thead><tr><th>Type</th><th>Date</th><th>Reason</th><th>Status</th></tr></thead>
                  <tbody>
                    {dayRequests.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-8 text-gray-500">No day requests</td></tr>
                    ) : (
                      dayRequests.map((req) => (
                        <tr key={req.id}>
                          <td><span className={`frappe-badge ${req.request_type === 'day_on' ? 'frappe-badge-success' : 'frappe-badge-primary'}`}>{req.request_type === 'day_on' ? 'Day On' : 'Day Off'}</span></td>
                          <td>{formatDate(req.requested_date)}</td>
                          <td className="text-gray-500">{req.reason || '-'}</td>
                          <td>{getStatusBadge(req.status)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Modals */}
      {showLeaveModal && <LeaveRequestModal />}
      {showDayRequestModal && <DayRequestModal />}
      {showSwapModal && selectedShift && <ShiftSwapModal />}
      {showMessagesModal && <MessagesInbox onClose={() => setShowMessagesModal(false)} />}
    </div>
  );
};

export default StaffProfile;
