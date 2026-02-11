import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import NotificationBell from '../components/NotificationBell';
import MessagesInbox from '../components/MessagesInbox';
import AttendanceCalendar from '../components/AttendanceCalendar';
import LeaveManagement from '../components/LeaveManagement';
import OperationalOverview from '../components/OperationalOverview';
import StaffManagement from '../components/StaffManagement';
import { RTWPendingCounter, RTWRegister } from '../components/RTWComponents';
import {
  LayoutDashboard,
  Users,
  Clock,
  LogOut,
  WifiOff,
  Wifi,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Calendar,
  CalendarDays,
  RefreshCcw,
  MessageSquare,
  Check,
  X,
  Settings
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const { user, token, logout, isOnline, offlineQueue } = useAuth();
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState({ leave_requests: [], day_requests: [], swap_requests: [], total_pending: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [idleTime, setIdleTime] = useState(0);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [showRTWRegister, setShowRTWRegister] = useState(false);
  const [notesTarget, setNotesTarget] = useState(null); // {id, name}

  const IDLE_TIMEOUT = 60;

  useEffect(() => {
    if (!user || !token || user.role === 'staff') {
      navigate('/');
      return;
    }
    fetchData();
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, attendanceRes, approvalsRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/attendance/today`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/manager/pending-approvals`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setStats(statsRes.data);
      setTodayAttendance(attendanceRes.data.records || []);
      setPendingApprovals(approvalsRes.data);
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

  const handleApproveLeave = async (requestId) => {
    try {
      await axios.put(`${API}/leave-requests/${requestId}/approve`, {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to approve');
    }
  };

  const handleRejectLeave = async (requestId) => {
    try {
      await axios.put(`${API}/leave-requests/${requestId}/reject`, {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reject');
    }
  };

  const handleApproveDayRequest = async (requestId) => {
    try {
      await axios.put(`${API}/day-requests/${requestId}/approve`, {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to approve');
    }
  };

  const handleRejectDayRequest = async (requestId) => {
    try {
      await axios.put(`${API}/day-requests/${requestId}/reject`, {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reject');
    }
  };

  const handleApproveSwap = async (swapId) => {
    try {
      await axios.post(`${API}/shift-swaps/${swapId}/approve`, {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to approve');
    }
  };

  const handleRejectSwap = async (swapId) => {
    try {
      await axios.post(`${API}/shift-swaps/${swapId}/reject`, {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reject');
    }
  };

  const getJobTitleBadge = (jobTitle) => {
    const styles = {
      nurse: 'job-nurse',
      senior_carer: 'job-senior_carer',
      carer: 'job-carer',
      activities: 'job-activities',
      kitchen: 'job-kitchen',
      maintenance: 'job-maintenance',
      administrator: 'job-administrator',
      care_manager: 'job-care_manager'
    };
    const labels = {
      nurse: 'Nurse',
      senior_carer: 'Senior Carer',
      carer: 'Carer',
      activities: 'Activities',
      kitchen: 'Kitchen',
      maintenance: 'Maintenance',
      administrator: 'Admin',
      care_manager: 'Manager'
    };
    return <span className={`frappe-badge ${styles[jobTitle] || ''}`}>{labels[jobTitle] || jobTitle}</span>;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  // Extract deeply nested properties to avoid babel plugin recursion
  const leaveApprovals = pendingApprovals.leave_requests || [];
  const dayApprovals = pendingApprovals.day_requests || [];
  const swapApprovals = pendingApprovals.swap_requests || [];
  const totalPending = pendingApprovals.total_pending || 0;

  const filteredAttendance = todayAttendance.filter(record => {
    const emp = record.employee || {};
    const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
    const term = searchTerm.toLowerCase();
    return fullName.includes(term) || (emp.employee_id || '').toLowerCase().includes(term);
  });

  if (loading) {
    return <div className="kiosk-container"><div className="frappe-spinner"></div></div>;
  }

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
          <span className="text-gray-600">Manager Dashboard</span>
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

          <button onClick={() => setShowMessagesModal(true)} className="p-2 rounded-lg hover:bg-gray-100">
            <MessageSquare size={20} className="text-gray-600" />
          </button>

          <NotificationBell />
          
          <RTWPendingCounter onClick={() => setShowRTWRegister(true)} />

          <div className="flex items-center gap-2 text-gray-600 text-sm">
            <span>{user?.first_name} {user?.last_name}</span>
          </div>

          <button data-testid="logout-btn" onClick={handleLogout} className="frappe-btn frappe-btn-secondary">
            <LogOut size={16} /><span>Logout</span>
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="frappe-sidebar">
        <div className="frappe-sidebar-section">Main</div>
        <button onClick={() => setActiveTab('dashboard')} className={`frappe-sidebar-item w-full text-left ${activeTab === 'dashboard' ? 'active' : ''}`}>
          <LayoutDashboard size={18} /><span>Dashboard</span>
        </button>
        <button onClick={() => navigate('/manager/planner')} className="frappe-sidebar-item w-full text-left" data-testid="planner-nav">
          <CalendarDays size={18} /><span>Staff Planner</span>
        </button>
        <button onClick={() => setActiveTab('attendance')} className={`frappe-sidebar-item w-full text-left ${activeTab === 'attendance' ? 'active' : ''}`}>
          <Clock size={18} /><span>Attendance</span>
        </button>
        <button onClick={() => setActiveTab('employees')} className={`frappe-sidebar-item w-full text-left ${activeTab === 'employees' ? 'active' : ''}`}>
          <Users size={18} /><span>Staff List</span>
        </button>
        
        <div className="frappe-sidebar-section">Approvals</div>
        <button onClick={() => setActiveTab('approvals')} className={`frappe-sidebar-item w-full text-left ${activeTab === 'approvals' ? 'active' : ''}`}>
          <CheckCircle size={18} /><span>Pending Approvals</span>
          {totalPending > 0 && (
            <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-0.5">{totalPending}</span>
          )}
        </button>
        <button onClick={() => setActiveTab('swaps')} className={`frappe-sidebar-item w-full text-left ${activeTab === 'swaps' ? 'active' : ''}`}>
          <RefreshCcw size={18} /><span>Shift Swaps</span>
          {swapApprovals.length > 0 && (
            <span className="ml-auto bg-orange-500 text-white text-xs rounded-full px-2 py-0.5">{swapApprovals.length}</span>
          )}
        </button>
        <button onClick={() => setActiveTab('leave')} className={`frappe-sidebar-item w-full text-left ${activeTab === 'leave' ? 'active' : ''}`} data-testid="leave-nav">
          <Calendar size={18} /><span>Leave & Sickness</span>
        </button>
        <button onClick={() => setActiveTab('operational')} className={`frappe-sidebar-item w-full text-left ${activeTab === 'operational' ? 'active' : ''}`} data-testid="operational-nav">
          <AlertCircle size={18} /><span>Operational</span>
        </button>
      </aside>

      {/* Main content */}
      <main className="frappe-main">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h1 className="frappe-page-title mb-0">Dashboard Overview</h1>
              <button onClick={fetchData} className="frappe-btn frappe-btn-secondary" data-testid="refresh-btn">
                <RefreshCw size={16} /><span>Refresh</span>
              </button>
            </div>

            {/* Pending Approvals Alert */}
            {totalPending > 0 && (
              <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle size={24} className="text-orange-600" />
                  <div>
                    <p className="font-medium text-orange-800">You have {totalPending} pending approval(s)</p>
                    <p className="text-sm text-orange-600">
                      {leaveApprovals.length} leave, {dayApprovals.length} day requests, {swapApprovals.length} shift swaps
                    </p>
                  </div>
                </div>
                <button onClick={() => setActiveTab('approvals')} className="frappe-btn frappe-btn-primary">Review Now</button>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="frappe-stat-card">
                <div className="frappe-stat-label">Total Staff</div>
                <div className="frappe-stat-value">{stats?.total_employees || 0}</div>
              </div>
              <div className="frappe-stat-card">
                <div className="frappe-stat-label">Clocked In</div>
                <div className="frappe-stat-value text-green-600">{stats?.today?.clocked_in || 0}</div>
              </div>
              <div className="frappe-stat-card">
                <div className="frappe-stat-label">Not Arrived</div>
                <div className="frappe-stat-value text-orange-600">{stats?.today?.not_arrived || 0}</div>
              </div>
              <div className="frappe-stat-card">
                <div className="frappe-stat-label">On Leave</div>
                <div className="frappe-stat-value text-gray-500">{stats?.on_leave || 0}</div>
              </div>
            </div>

            {/* Today's Attendance Preview */}
            <div className="frappe-card">
              <div className="frappe-card-header flex items-center justify-between">
                <div className="flex items-center gap-2"><Clock size={18} /><span>Today's Attendance</span></div>
                <button onClick={() => setActiveTab('attendance')} className="text-sm text-blue-600 hover:text-blue-700">View All →</button>
              </div>
              <div className="overflow-x-auto">
                <table className="frappe-table">
                  <thead><tr><th>Employee</th><th>Role</th><th>Clock In</th><th>Clock Out</th><th>Status</th></tr></thead>
                  <tbody>
                    {todayAttendance.slice(0, 5).map((record) => {
                      const emp = record.employee || {};
                      const initials = `${(emp.first_name || '')[0] || ''}${(emp.last_name || '')[0] || ''}`;
                      return (
                      <tr key={emp.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="frappe-avatar">{initials}</div>
                            <div>
                              <div className="font-medium text-gray-900">{emp.first_name} {emp.last_name}</div>
                              <div className="text-xs text-gray-500">{emp.employee_id}</div>
                            </div>
                          </div>
                        </td>
                        <td>{getJobTitleBadge(emp.job_title)}</td>
                        <td>{record.clock_in ? new Date(record.clock_in).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</td>
                        <td>{record.clock_out ? new Date(record.clock_out).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</td>
                        <td>
                          {record.clock_out ? (
                            <span className="frappe-badge frappe-badge-gray flex items-center gap-1 w-fit"><CheckCircle size={12} />Complete</span>
                          ) : record.clock_in ? (
                            <span className="frappe-badge frappe-badge-success flex items-center gap-1 w-fit"><CheckCircle size={12} />Working</span>
                          ) : (
                            <span className="frappe-badge frappe-badge-error flex items-center gap-1 w-fit"><XCircle size={12} />Absent</span>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Attendance Tab */}
        {activeTab === 'attendance' && (
          <AttendanceCalendar token={token} />
        )}

        {/* Approvals Tab */}
        {activeTab === 'approvals' && (
          <>
            <h1 className="frappe-page-title">Pending Approvals</h1>

            {/* Leave Requests */}
            <div className="frappe-card mb-6">
              <div className="frappe-card-header flex items-center gap-2">
                <Calendar size={18} />
                <span>Leave Requests ({leaveApprovals.length})</span>
              </div>
              <div className="frappe-card-content">
                {leaveApprovals.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No pending leave requests</p>
                ) : (
                  <div className="space-y-3">
                    {leaveApprovals.map((req) => (
                      <div key={req.id} className="p-4 border border-gray-200 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{req.employee_name}</p>
                          <p className="text-sm text-gray-500">{req.job_title} • {req.leave_type} leave</p>
                          <p className="text-sm text-gray-600">{formatDate(req.start_date)} → {formatDate(req.end_date)}</p>
                          {req.reason && <p className="text-sm text-gray-400 mt-1">"{req.reason}"</p>}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleRejectLeave(req.id)} className="frappe-btn frappe-btn-secondary text-red-600"><X size={16} />Reject</button>
                          <button onClick={() => handleApproveLeave(req.id)} className="frappe-btn frappe-btn-primary"><Check size={16} />Approve</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Day Requests */}
            <div className="frappe-card mb-6">
              <div className="frappe-card-header flex items-center gap-2">
                <CalendarDays size={18} />
                <span>Day Requests ({dayApprovals.length})</span>
              </div>
              <div className="frappe-card-content">
                {dayApprovals.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No pending day requests</p>
                ) : (
                  <div className="space-y-3">
                    {dayApprovals.map((req) => (
                      <div key={req.id} className="p-4 border border-gray-200 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{req.employee_name}</p>
                          <p className="text-sm text-gray-500">{req.job_title} • {req.request_type === 'day_on' ? 'Day On' : 'Day Off'}</p>
                          <p className="text-sm text-gray-600">{formatDate(req.requested_date)}</p>
                          {req.reason && <p className="text-sm text-gray-400 mt-1">"{req.reason}"</p>}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleRejectDayRequest(req.id)} className="frappe-btn frappe-btn-secondary text-red-600"><X size={16} />Reject</button>
                          <button onClick={() => handleApproveDayRequest(req.id)} className="frappe-btn frappe-btn-primary"><Check size={16} />Approve</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Shift Swaps */}
            <div className="frappe-card">
              <div className="frappe-card-header flex items-center gap-2">
                <RefreshCcw size={18} />
                <span>Shift Swaps ({swapApprovals.length})</span>
              </div>
              <div className="frappe-card-content">
                {swapApprovals.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No pending shift swaps</p>
                ) : (
                  <div className="space-y-3">
                    {swapApprovals.map((swap) => (
                      <div key={swap.id} className="p-4 border border-gray-200 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{swap.requester_name} ↔ {swap.accepted_by_name}</p>
                          <p className="text-sm text-gray-600">{formatDate(swap.shift_date)} • {swap.shift_start} - {swap.shift_end}</p>
                          {swap.reason && <p className="text-sm text-gray-400 mt-1">"{swap.reason}"</p>}
                          {swap.message_to_manager && <p className="text-sm text-blue-600 mt-1">Manager message: "{swap.message_to_manager}"</p>}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleRejectSwap(swap.id)} className="frappe-btn frappe-btn-secondary text-red-600"><X size={16} />Reject</button>
                          <button onClick={() => handleApproveSwap(swap.id)} className="frappe-btn frappe-btn-primary"><Check size={16} />Approve</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Shift Swaps Tab */}
        {activeTab === 'swaps' && (
          <>
            <h1 className="frappe-page-title">Shift Swap Management</h1>
            <div className="frappe-card">
              <div className="frappe-card-header">Swaps Pending Your Approval</div>
              <div className="frappe-card-content">
                {swapApprovals.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No shift swaps pending approval</p>
                ) : (
                  <div className="space-y-4">
                    {swapApprovals.map((swap) => (
                      <div key={swap.id} className="p-4 border border-orange-200 bg-orange-50 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold text-gray-900">{swap.requester_name}</span>
                              <span className="text-gray-400">↔</span>
                              <span className="font-semibold text-gray-900">{swap.accepted_by_name}</span>
                            </div>
                            <p className="text-sm text-gray-600 mb-1">
                              <strong>Shift:</strong> {formatDate(swap.shift_date)} • {swap.shift_start} - {swap.shift_end}
                            </p>
                            {swap.reason && <p className="text-sm text-gray-500">Reason: {swap.reason}</p>}
                            {swap.message_to_manager && (
                              <div className="mt-2 p-2 bg-blue-100 rounded text-sm text-blue-800">
                                <strong>Message:</strong> {swap.message_to_manager}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleRejectSwap(swap.id)} className="frappe-btn frappe-btn-secondary text-red-600"><X size={16} />Reject</button>
                            <button onClick={() => handleApproveSwap(swap.id)} className="frappe-btn frappe-btn-primary"><Check size={16} />Approve</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Staff List Tab */}
        {activeTab === 'employees' && (
          <StaffManagement
            token={token}
            onOpenNotes={(id, name) => setNotesTarget({ id, name })}
          />
        )}

        {/* Leave & Sickness Tab */}
        {activeTab === 'leave' && (
          <LeaveManagement token={token} />
        )}

        {/* Operational Tab */}
        {activeTab === 'operational' && (
          <OperationalOverview token={token} />
        )}
      </main>

      {showMessagesModal && <MessagesInbox onClose={() => setShowMessagesModal(false)} />}
      {showRTWRegister && <RTWRegister onClose={() => setShowRTWRegister(false)} />}
      {notesTarget && <ManagerNotesModal target={notesTarget} token={token} onClose={() => setNotesTarget(null)} />}
    </div>
  );
};

const ManagerNotesModal = ({ target, token, onClose }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [notes, setNotes] = React.useState([]);
  const [newNote, setNewNote] = React.useState('');

  React.useEffect(() => {
    axios.get(`${API}/manager/notes/${target.id}`, { headers }).then(r => setNotes(r.data.notes || [])).catch(() => {});
  }, [target.id]);

  const addNote = async () => {
    if (!newNote.trim()) return;
    const params = new URLSearchParams({ content: newNote });
    await axios.post(`${API}/manager/notes/${target.id}?${params}`, {}, { headers });
    setNewNote('');
    const r = await axios.get(`${API}/manager/notes/${target.id}`, { headers });
    setNotes(r.data.notes || []);
  };

  const deleteNote = async (noteId) => {
    await axios.delete(`${API}/manager/notes/${noteId}`, { headers });
    setNotes(prev => prev.filter(n => n.id !== noteId));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="notes-modal">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="font-semibold text-gray-900">Notes — {target.name}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {notes.length === 0 && <p className="text-xs text-gray-400 py-4 text-center">No notes yet</p>}
          {notes.map(n => {
            const nId = n.id;
            const nContent = n.content;
            const nBy = n.created_by_name;
            const nAt = n.created_at;
            return (
              <div key={nId} className="bg-gray-50 rounded-lg p-3 text-xs group">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-gray-800 whitespace-pre-wrap">{nContent}</p>
                  <button onClick={() => deleteNote(nId)} className="p-0.5 hover:bg-red-100 rounded text-gray-300 group-hover:text-red-500 flex-shrink-0">
                    <X size={12} />
                  </button>
                </div>
                <div className="text-[10px] text-gray-400 mt-1.5">
                  {nBy} — {new Date(nAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t px-5 py-3">
          <div className="flex gap-2">
            <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a private note..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none h-16 focus:ring-1 focus:ring-blue-300 focus:outline-none" data-testid="note-input" />
            <button onClick={addNote} disabled={!newNote.trim()}
              className="px-3 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 disabled:opacity-50" data-testid="add-note-btn">
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
