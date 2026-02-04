import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
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
  ChevronRight
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, logout, isOnline, offlineQueue } = useAuth();
  
  const [stats, setStats] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [idleTime, setIdleTime] = useState(0);

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
      const [statsRes, attendanceRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/attendance/today`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setStats(statsRes.data);
      setTodayAttendance(attendanceRes.data.records || []);
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
    return (
      <span className={`frappe-badge ${styles[jobTitle] || ''}`}>
        {labels[jobTitle] || jobTitle}
      </span>
    );
  };

  const filteredAttendance = todayAttendance.filter(record => {
    const fullName = `${record.employee.first_name} ${record.employee.last_name}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) ||
           record.employee.employee_id.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (loading) {
    return (
      <div className="kiosk-container">
        <div className="frappe-spinner"></div>
      </div>
    );
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

          <div className="flex items-center gap-2 text-gray-600 text-sm">
            <span>{user?.first_name} {user?.last_name}</span>
          </div>

          <button data-testid="logout-btn" onClick={handleLogout} className="frappe-btn frappe-btn-secondary">
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="frappe-sidebar">
        <div className="frappe-sidebar-section">Main</div>
        <Link to="/manager" className={`frappe-sidebar-item ${location.pathname === '/manager' ? 'active' : ''}`}>
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </Link>
        <Link to="/manager/attendance" className={`frappe-sidebar-item ${location.pathname === '/manager/attendance' ? 'active' : ''}`}>
          <Clock size={18} />
          <span>Attendance</span>
        </Link>
        <Link to="/manager/employees" className={`frappe-sidebar-item ${location.pathname === '/manager/employees' ? 'active' : ''}`}>
          <Users size={18} />
          <span>Staff List</span>
        </Link>
      </aside>

      {/* Main content */}
      <main className="frappe-main">
        <div className="flex items-center justify-between mb-6">
          <h1 className="frappe-page-title mb-0">Dashboard Overview</h1>
          <button onClick={fetchData} className="frappe-btn frappe-btn-secondary" data-testid="refresh-btn">
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="frappe-stat-card" data-testid="stat-total">
            <div className="frappe-stat-label">Total Staff</div>
            <div className="frappe-stat-value">{stats?.total_employees || 0}</div>
          </div>
          <div className="frappe-stat-card" data-testid="stat-clocked-in">
            <div className="frappe-stat-label">Clocked In</div>
            <div className="frappe-stat-value text-green-600">{stats?.today?.clocked_in || 0}</div>
          </div>
          <div className="frappe-stat-card" data-testid="stat-not-arrived">
            <div className="frappe-stat-label">Not Arrived</div>
            <div className="frappe-stat-value text-orange-600">{stats?.today?.not_arrived || 0}</div>
          </div>
          <div className="frappe-stat-card" data-testid="stat-on-leave">
            <div className="frappe-stat-label">On Leave</div>
            <div className="frappe-stat-value text-gray-500">{stats?.on_leave || 0}</div>
          </div>
        </div>

        {/* Today's Attendance */}
        <div className="frappe-card">
          <div className="frappe-card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={18} />
              <span>Today's Attendance</span>
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="frappe-input pl-9 w-64"
                data-testid="search-input"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="frappe-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Type</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendance.map((record) => (
                  <tr key={record.employee.id} data-testid={`attendance-row-${record.employee.employee_id}`}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="frappe-avatar">
                          {record.employee.first_name[0]}{record.employee.last_name[0]}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {record.employee.first_name} {record.employee.last_name}
                          </div>
                          <div className="text-xs text-gray-500">{record.employee.employee_id}</div>
                        </div>
                      </div>
                    </td>
                    <td>{getJobTitleBadge(record.employee.job_title)}</td>
                    <td>
                      <span className={`frappe-badge ${record.employee.employment_type === 'agency' ? 'frappe-badge-warning' : 'frappe-badge-gray'}`}>
                        {record.employee.employment_type === 'agency' ? 'Agency' : 'Permanent'}
                      </span>
                    </td>
                    <td>
                      {record.clock_in 
                        ? new Date(record.clock_in).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                        : '--:--'}
                    </td>
                    <td>
                      {record.clock_out
                        ? new Date(record.clock_out).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                        : '--:--'}
                    </td>
                    <td>
                      {record.clock_out ? (
                        <span className="frappe-badge frappe-badge-gray flex items-center gap-1 w-fit">
                          <CheckCircle size={12} />
                          Complete
                        </span>
                      ) : record.clock_in ? (
                        <span className="frappe-badge frappe-badge-success flex items-center gap-1 w-fit">
                          <CheckCircle size={12} />
                          Working
                        </span>
                      ) : (
                        <span className="frappe-badge frappe-badge-error flex items-center gap-1 w-fit">
                          <XCircle size={12} />
                          Absent
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredAttendance.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No staff records found
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ManagerDashboard;
