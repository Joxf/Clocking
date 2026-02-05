import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import NotificationBell from '../components/NotificationBell';
import MessagesInbox from '../components/MessagesInbox';
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
  X
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

  const filteredAttendance = todayAttendance.filter(record => {
    const fullName = `${record.employee.first_name} ${record.employee.last_name}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) || record.employee.employee_id.toLowerCase().includes(searchTerm.toLowerCase());
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
        <button onClick={() => setActiveTab('attendance')} className={`frappe-sidebar-item w-full text-left ${activeTab === 'attendance' ? 'active' : ''}`}>
          <Clock size={18} /><span>Attendance</span>
        </button>
        <button onClick={() => setActiveTab('employees')} className={`frappe-sidebar-item w-full text-left ${activeTab === 'employees' ? 'active' : ''}`}>
          <Users size={18} /><span>Staff List</span>
        </button>
        
        <div className="frappe-sidebar-section">Approvals</div>
        <button onClick={() => setActiveTab('approvals')} className={`frappe-sidebar-item w-full text-left ${activeTab === 'approvals' ? 'active' : ''}`}>
          <CheckCircle size={18} /><span>Pending Approvals</span>
          {pendingApprovals.total_pending > 0 && (
            <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-0.5">{pendingApprovals.total_pending}</span>
          )}
        </button>
        <button onClick={() => setActiveTab('swaps')} className={`frappe-sidebar-item w-full text-left ${activeTab === 'swaps' ? 'active' : ''}`}>
          <RefreshCcw size={18} /><span>Shift Swaps</span>
          {pendingApprovals.swap_requests.length > 0 && (
            <span className="ml-auto bg-orange-500 text-white text-xs rounded-full px-2 py-0.5">{pendingApprovals.swap_requests.length}</span>
          )}
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
            {pendingApprovals.total_pending > 0 && (
              <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle size={24} className="text-orange-600" />
                  <div>
                    <p className="font-medium text-orange-800">You have {pendingApprovals.total_pending} pending approval(s)</p>
                    <p className="text-sm text-orange-600">
                      {pendingApprovals.leave_requests.length} leave, {pendingApprovals.day_requests.length} day requests, {pendingApprovals.swap_requests.length} shift swaps
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
                    {todayAttendance.slice(0, 5).map((record) => (
                      <tr key={record.employee.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="frappe-avatar">{record.employee.first_name[0]}{record.employee.last_name[0]}</div>
                            <div>
                              <div className="font-medium text-gray-900">{record.employee.first_name} {record.employee.last_name}</div>
                              <div className="text-xs text-gray-500">{record.employee.employee_id}</div>
                            </div>
                          </div>
                        </td>
                        <td>{getJobTitleBadge(record.employee.job_title)}</td>
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Attendance Tab */}
        {activeTab === 'attendance' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h1 className="frappe-page-title mb-0">Today's Attendance</h1>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search staff..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="frappe-input pl-9 w-64" />
              </div>
            </div>
            <div className="frappe-card">
              <div className="overflow-x-auto">
                <table className="frappe-table">
                  <thead><tr><th>Employee</th><th>Role</th><th>Type</th><th>Clock In</th><th>Clock Out</th><th>Status</th></tr></thead>
                  <tbody>
                    {filteredAttendance.map((record) => (
                      <tr key={record.employee.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="frappe-avatar">{record.employee.first_name[0]}{record.employee.last_name[0]}</div>
                            <div>
                              <div className="font-medium text-gray-900">{record.employee.first_name} {record.employee.last_name}</div>
                              <div className="text-xs text-gray-500">{record.employee.employee_id}</div>
                            </div>
                          </div>
                        </td>
                        <td>{getJobTitleBadge(record.employee.job_title)}</td>
                        <td><span className={`frappe-badge ${record.employee.employment_type === 'agency' ? 'frappe-badge-warning' : 'frappe-badge-gray'}`}>{record.employee.employment_type === 'agency' ? 'Agency' : 'Permanent'}</span></td>
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Approvals Tab */}
        {activeTab === 'approvals' && (
          <>
            <h1 className="frappe-page-title">Pending Approvals</h1>

            {/* Leave Requests */}
            <div className="frappe-card mb-6">
              <div className="frappe-card-header flex items-center gap-2">
                <Calendar size={18} />
                <span>Leave Requests ({pendingApprovals.leave_requests.length})</span>
              </div>
              <div className="frappe-card-content">
                {pendingApprovals.leave_requests.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No pending leave requests</p>
                ) : (
                  <div className="space-y-3">
                    {pendingApprovals.leave_requests.map((req) => (
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
                <span>Day Requests ({pendingApprovals.day_requests.length})</span>
              </div>
              <div className="frappe-card-content">
                {pendingApprovals.day_requests.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No pending day requests</p>
                ) : (
                  <div className="space-y-3">
                    {pendingApprovals.day_requests.map((req) => (
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
                <span>Shift Swaps ({pendingApprovals.swap_requests.length})</span>
              </div>
              <div className="frappe-card-content">
                {pendingApprovals.swap_requests.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No pending shift swaps</p>
                ) : (
                  <div className="space-y-3">
                    {pendingApprovals.swap_requests.map((swap) => (
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
                {pendingApprovals.swap_requests.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No shift swaps pending approval</p>
                ) : (
                  <div className="space-y-4">
                    {pendingApprovals.swap_requests.map((swap) => (
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
          <>
            <h1 className="frappe-page-title">Staff List</h1>
            <div className="frappe-card">
              <div className="overflow-x-auto">
                <table className="frappe-table">
                  <thead><tr><th>Employee</th><th>Role</th><th>Type</th><th>Status</th></tr></thead>
                  <tbody>
                    {todayAttendance.map((record) => (
                      <tr key={record.employee.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="frappe-avatar">{record.employee.first_name[0]}{record.employee.last_name[0]}</div>
                            <div>
                              <div className="font-medium text-gray-900">{record.employee.first_name} {record.employee.last_name}</div>
                              <div className="text-xs text-gray-500">{record.employee.employee_id}</div>
                            </div>
                          </div>
                        </td>
                        <td>{getJobTitleBadge(record.employee.job_title)}</td>
                        <td><span className={`frappe-badge ${record.employee.employment_type === 'agency' ? 'frappe-badge-warning' : 'frappe-badge-gray'}`}>{record.employee.employment_type === 'agency' ? 'Agency' : 'Permanent'}</span></td>
                        <td><span className="frappe-badge frappe-badge-success">Active</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {showMessagesModal && <MessagesInbox onClose={() => setShowMessagesModal(false)} />}
    </div>
  );
};

export default ManagerDashboard;
