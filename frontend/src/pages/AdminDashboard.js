import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
  LayoutDashboard,
  Users,
  Clock,
  Settings,
  LogOut,
  WifiOff,
  Wifi,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Plus,
  Tablet,
  Building,
  UserPlus,
  Key,
  QrCode
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, logout, isOnline, offlineQueue } = useAuth();
  
  const [stats, setStats] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [idleTime, setIdleTime] = useState(0);
  const [enrollmentModal, setEnrollmentModal] = useState(null);

  const IDLE_TIMEOUT = 60;

  useEffect(() => {
    if (!user || !token || user.role !== 'admin') {
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
      const [statsRes, employeesRes, devicesRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/employees`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/kiosk-devices`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setStats(statsRes.data);
      setEmployees(employeesRes.data.employees || []);
      setDevices(devicesRes.data.devices || []);
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

  const handleGenerateEnrollment = async (employeeId) => {
    try {
      const response = await axios.post(`${API}/enrollment/generate-secret`, 
        { employee_id: employeeId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEnrollmentModal(response.data);
    } catch (err) {
      console.error('Failed to generate enrollment:', err);
      alert(err.response?.data?.detail || 'Failed to generate enrollment');
    }
  };

  const handleConfirmEnrollment = async (employeeId) => {
    try {
      await axios.post(`${API}/enrollment/confirm`,
        { employee_id: employeeId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEnrollmentModal(null);
      fetchData();
    } catch (err) {
      console.error('Failed to confirm enrollment:', err);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'frappe-badge-success',
      inactive: 'frappe-badge-error',
      on_leave: 'frappe-badge-warning'
    };
    const labels = {
      active: 'Active',
      inactive: 'Inactive',
      on_leave: 'On Leave'
    };
    return <span className={`frappe-badge ${styles[status]}`}>{labels[status]}</span>;
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

  const filteredEmployees = employees.filter(emp => {
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) ||
           emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase());
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
          <span className="text-gray-600">Admin Dashboard</span>
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
            <span className="frappe-badge frappe-badge-primary">Admin</span>
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
        <button onClick={() => setActiveTab('overview')} className={`frappe-sidebar-item w-full text-left ${activeTab === 'overview' ? 'active' : ''}`}>
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </button>
        
        <div className="frappe-sidebar-section">Management</div>
        <button onClick={() => setActiveTab('employees')} className={`frappe-sidebar-item w-full text-left ${activeTab === 'employees' ? 'active' : ''}`}>
          <Users size={18} />
          <span>Staff Management</span>
        </button>
        <button onClick={() => setActiveTab('devices')} className={`frappe-sidebar-item w-full text-left ${activeTab === 'devices' ? 'active' : ''}`}>
          <Tablet size={18} />
          <span>Kiosk Devices</span>
        </button>
        
        <div className="frappe-sidebar-section">Settings</div>
        <button onClick={() => setActiveTab('settings')} className={`frappe-sidebar-item w-full text-left ${activeTab === 'settings' ? 'active' : ''}`}>
          <Settings size={18} />
          <span>System Settings</span>
        </button>
      </aside>

      {/* Main content */}
      <main className="frappe-main">
        {activeTab === 'overview' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h1 className="frappe-page-title mb-0">Admin Overview</h1>
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
              <div className="frappe-stat-card" data-testid="stat-active">
                <div className="frappe-stat-label">Active</div>
                <div className="frappe-stat-value text-green-600">{stats?.active_employees || 0}</div>
              </div>
              <div className="frappe-stat-card" data-testid="stat-clocked-in">
                <div className="frappe-stat-label">Clocked In Today</div>
                <div className="frappe-stat-value text-blue-600">{stats?.today?.clocked_in || 0}</div>
              </div>
              <div className="frappe-stat-card" data-testid="stat-devices">
                <div className="frappe-stat-label">Kiosk Devices</div>
                <div className="frappe-stat-value">{devices.length}</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <button onClick={() => setActiveTab('employees')} className="frappe-card p-6 text-left hover:bg-gray-50 transition-colors">
                <UserPlus size={24} className="text-blue-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-1">Add New Staff</h3>
                <p className="text-sm text-gray-500">Register new employees</p>
              </button>
              <button onClick={() => setActiveTab('employees')} className="frappe-card p-6 text-left hover:bg-gray-50 transition-colors">
                <QrCode size={24} className="text-purple-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-1">Enroll Staff</h3>
                <p className="text-sm text-gray-500">Generate TOTP enrollment</p>
              </button>
              <button onClick={() => setActiveTab('devices')} className="frappe-card p-6 text-left hover:bg-gray-50 transition-colors">
                <Tablet size={24} className="text-green-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-1">Manage Devices</h3>
                <p className="text-sm text-gray-500">Configure kiosk devices</p>
              </button>
            </div>

            {/* Staff by Status */}
            <div className="frappe-card">
              <div className="frappe-card-header">Staff Overview by Status</div>
              <div className="frappe-card-content">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">{employees.filter(e => e.status === 'active').length}</div>
                    <div className="text-sm text-green-600">Active Staff</div>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-700">{employees.filter(e => e.status === 'on_leave').length}</div>
                    <div className="text-sm text-yellow-600">On Leave</div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-700">{employees.filter(e => e.status === 'inactive').length}</div>
                    <div className="text-sm text-red-600">Inactive/Leavers</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'employees' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h1 className="frappe-page-title mb-0">Staff Management</h1>
              <div className="flex gap-2">
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
            </div>

            <div className="frappe-card">
              <div className="overflow-x-auto">
                <table className="frappe-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Role</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Enrolled</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((emp) => (
                      <tr key={emp.id} data-testid={`employee-row-${emp.employee_id}`}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="frappe-avatar">
                              {emp.first_name[0]}{emp.last_name[0]}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">
                                {emp.first_name} {emp.last_name}
                              </div>
                              <div className="text-xs text-gray-500">{emp.employee_id}</div>
                            </div>
                          </div>
                        </td>
                        <td>{getJobTitleBadge(emp.job_title)}</td>
                        <td>
                          <span className={`frappe-badge ${emp.employment_type === 'agency' ? 'frappe-badge-warning' : 'frappe-badge-gray'}`}>
                            {emp.employment_type === 'agency' ? 'Agency' : 'Permanent'}
                          </span>
                        </td>
                        <td>{getStatusBadge(emp.status)}</td>
                        <td>
                          {emp.totp_enrolled ? (
                            <span className="frappe-badge frappe-badge-success flex items-center gap-1 w-fit">
                              <CheckCircle size={12} />
                              Yes
                            </span>
                          ) : (
                            <span className="frappe-badge frappe-badge-error flex items-center gap-1 w-fit">
                              <XCircle size={12} />
                              No
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            {!emp.totp_enrolled && emp.status === 'active' && (
                              <button
                                onClick={() => handleGenerateEnrollment(emp.employee_id)}
                                className="frappe-btn frappe-btn-secondary text-xs py-1 px-2"
                                data-testid={`enroll-btn-${emp.employee_id}`}
                              >
                                <Key size={14} />
                                Enroll
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'devices' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h1 className="frappe-page-title mb-0">Kiosk Devices</h1>
            </div>

            <div className="frappe-card">
              <div className="frappe-card-content">
                {devices.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Tablet size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>No kiosk devices registered</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {devices.map((device) => (
                      <div key={device.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-3 mb-3">
                          <Tablet size={24} className="text-blue-600" />
                          <div>
                            <div className="font-medium text-gray-900">{device.device_name}</div>
                            <div className="text-sm text-gray-500">{device.location}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={`frappe-badge ${device.is_active ? 'frappe-badge-success' : 'frappe-badge-error'}`}>
                            {device.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {device.last_seen ? `Last seen: ${new Date(device.last_seen).toLocaleString()}` : 'Never connected'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'settings' && (
          <>
            <h1 className="frappe-page-title">System Settings</h1>
            <div className="frappe-card">
              <div className="frappe-card-content">
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900">Care Home</h3>
                      <p className="text-sm text-gray-500">Comber Home</p>
                    </div>
                    <Building size={24} className="text-gray-400" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900">Session Timeout</h3>
                      <p className="text-sm text-gray-500">60 seconds idle</p>
                    </div>
                    <Clock size={24} className="text-gray-400" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900">Offline Mode</h3>
                      <p className="text-sm text-gray-500">Enabled with local queue</p>
                    </div>
                    <WifiOff size={24} className="text-gray-400" />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Enrollment Modal */}
      {enrollmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">TOTP Enrollment</h2>
            <p className="text-sm text-gray-600 mb-4">
              Share this information with the employee's mobile authenticator app.
            </p>
            
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <div className="mb-3">
                <label className="text-xs text-gray-500 uppercase">Employee ID</label>
                <div className="font-mono text-sm">{enrollmentModal.employee_id}</div>
              </div>
              <div className="mb-3">
                <label className="text-xs text-gray-500 uppercase">Secret Key (32 chars)</label>
                <div className="font-mono text-sm break-all bg-white p-2 rounded border">{enrollmentModal.totp_secret}</div>
              </div>
            </div>

            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
              <p className="text-sm text-yellow-700">
                <strong>Important:</strong> Have the employee set up their authenticator app, then click Confirm to activate.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEnrollmentModal(null)}
                className="frappe-btn frappe-btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmEnrollment(enrollmentModal.employee_id)}
                className="frappe-btn frappe-btn-primary flex-1"
              >
                Confirm Enrollment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
