import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Plus, Search, MoreVertical, Edit2, KeyRound, Smartphone,
  UserX, UserCheck, X, Printer, Copy
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const JOB_OPTIONS = [
  { value: 'nurse', label: 'Nurse' },
  { value: 'senior_carer', label: 'Senior Carer' },
  { value: 'carer', label: 'Carer' },
  { value: 'activities', label: 'Activities' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'maintenance', label: 'Maintenance' },
];

const SHIFT_PREFERENCE_OPTIONS = [
  { value: 'flexible', label: 'Flexible (Any Shift)' },
  { value: 'earlies_only', label: 'Earlies Only' },
  { value: 'lates_only', label: 'Lates Only' },
  { value: 'nights_only', label: 'Nights Only' },
  { value: 'no_nights', label: 'No Nights' },
  { value: 'weekdays_only', label: 'Weekdays Only' },
  { value: 'weekends_only', label: 'Weekends Only' },
  { value: 'long_days', label: 'Long Days Preferred' },
];

const PREFERENCE_BADGE = {
  flexible: 'bg-gray-100 text-gray-700',
  earlies_only: 'bg-yellow-100 text-yellow-700',
  lates_only: 'bg-orange-100 text-orange-700',
  nights_only: 'bg-indigo-100 text-indigo-700',
  no_nights: 'bg-blue-100 text-blue-700',
  weekdays_only: 'bg-green-100 text-green-700',
  weekends_only: 'bg-purple-100 text-purple-700',
  long_days: 'bg-pink-100 text-pink-700',
};

const JOB_BADGE = {
  nurse: 'bg-blue-100 text-blue-700',
  senior_carer: 'bg-purple-100 text-purple-700',
  carer: 'bg-green-100 text-green-700',
  activities: 'bg-pink-100 text-pink-700',
  kitchen: 'bg-amber-100 text-amber-700',
  maintenance: 'bg-gray-100 text-gray-700',
};

const StaffManagement = ({ token, onOpenNotes }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [pinResult, setPinResult] = useState(null);
  const [actionMenu, setActionMenu] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active');

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/employees/list`, { headers });
      setEmployees(res.data.employees || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const resetPin = async (empId) => {
    try {
      const res = await axios.put(`${API}/employees/${empId}/reset-pin`, {}, { headers });
      setPinResult(res.data);
      setActionMenu(null);
    } catch (err) { console.error(err); }
  };

  const resetTotp = async (empId) => {
    try {
      await axios.put(`${API}/employees/${empId}/reset-totp`, {}, { headers });
      alert('TOTP reset. Staff member must re-enroll on mobile app.');
      setActionMenu(null);
    } catch (err) { console.error(err); }
  };

  const toggleStatus = async (emp) => {
    const empId = emp.id;
    const isActive = emp.status === 'active';
    const endpoint = isActive ? 'deactivate' : 'activate';
    try {
      await axios.put(`${API}/employees/${empId}/${endpoint}`, {}, { headers });
      fetchEmployees();
      setActionMenu(null);
    } catch (err) { console.error(err); }
  };

  const filtered = employees.filter(e => {
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    const term = search.toLowerCase();
    const fullName = `${e.first_name} ${e.last_name}`.toLowerCase();
    const matchSearch = !term || fullName.includes(term) || (e.employee_id || '').toLowerCase().includes(term);
    return matchStatus && matchSearch;
  });

  if (loading) return <div className="flex justify-center py-12"><div className="frappe-spinner" /></div>;

  return (
    <div data-testid="staff-management">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-base font-semibold text-gray-800">Staff Management</h1>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 font-medium"
          data-testid="add-employee-btn">
          <Plus size={14} /> Add Employee
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search staff..." className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg" data-testid="staff-search" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" data-testid="status-filter">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Employee</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">ID</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Role</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Type</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Contract</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Status</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(emp => {
              const empId = emp.id;
              const empCode = emp.employee_id;
              const fName = emp.first_name;
              const lName = emp.last_name;
              const initials = `${(fName || '')[0] || ''}${(lName || '')[0] || ''}`;
              const jobTitle = emp.job_title;
              const empType = emp.employment_type;
              const contract = emp.contract_hours || 36;
              const empStatus = emp.status;
              const isAgency = empType === 'agency';
              const isActive = empStatus === 'active';
              const badgeCls = JOB_BADGE[jobTitle] || 'bg-gray-100 text-gray-700';
              const menuOpen = actionMenu === empId;

              return (
                <tr key={empId} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${isAgency ? 'bg-orange-500' : 'bg-slate-600'}`}>
                        {initials}
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">{fName} {lName}</div>
                        {emp.email && <div className="text-[10px] text-gray-400">{emp.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-600">{empCode}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${badgeCls}`}>{jobTitle}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-[10px] ${isAgency ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>{isAgency ? 'Agency' : empType === 'bank' ? 'Bank' : 'Perm'}</span>
                  </td>
                  <td className="px-3 py-2 text-center text-gray-600">{contract}h</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="relative inline-block">
                      <button onClick={() => setActionMenu(menuOpen ? null : empId)}
                        className="p-1 hover:bg-gray-100 rounded" data-testid={`actions-${empCode}`}>
                        <MoreVertical size={14} />
                      </button>
                      {menuOpen && (
                        <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 text-left" data-testid={`menu-${empCode}`}>
                          <button onClick={() => { setEditTarget(emp); setActionMenu(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-gray-700">
                            <Edit2 size={12} /> Edit Details
                          </button>
                          <button onClick={() => resetPin(empId)} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-gray-700" data-testid={`reset-pin-${empCode}`}>
                            <KeyRound size={12} /> Reset PIN
                          </button>
                          <button onClick={() => resetTotp(empId)} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-gray-700">
                            <Smartphone size={12} /> Reset TOTP
                          </button>
                          {onOpenNotes && (
                            <button onClick={() => { onOpenNotes(empId, `${fName} ${lName}`); setActionMenu(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-gray-700">
                              <Edit2 size={12} /> Manager Notes
                            </button>
                          )}
                          <hr className="my-1 border-gray-100" />
                          <button onClick={() => toggleStatus(emp)}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 ${isActive ? 'text-red-600' : 'text-green-600'}`}>
                            {isActive ? <><UserX size={12} /> Deactivate</> : <><UserCheck size={12} /> Activate</>}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-xs text-gray-400 text-center py-6">No employees found</p>}
      </div>

      {/* Create modal */}
      {showCreate && (
        <EmployeeFormModal
          token={token}
          onClose={() => setShowCreate(false)}
          onSuccess={(data) => { setShowCreate(false); setPinResult(data); fetchEmployees(); }}
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <EditEmployeeModal
          emp={editTarget}
          token={token}
          onClose={() => setEditTarget(null)}
          onSuccess={() => { setEditTarget(null); fetchEmployees(); }}
        />
      )}

      {/* PIN result dialog */}
      {pinResult && (
        <PinResultDialog data={pinResult} onClose={() => setPinResult(null)} />
      )}
    </div>
  );
};

const EmployeeFormModal = ({ token, onClose, onSuccess }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    job_title: 'carer', employment_type: 'permanent', contract_hours: 36,
    shift_preferences: []
  });
  const [saving, setSaving] = useState(false);

  const togglePreference = (pref) => {
    setForm(f => ({
      ...f,
      shift_preferences: f.shift_preferences.includes(pref)
        ? f.shift_preferences.filter(p => p !== pref)
        : [...f.shift_preferences, pref]
    }));
  };

  const handleSubmit = async () => {
    if (!form.first_name || !form.last_name) return;
    setSaving(true);
    try {
      const res = await axios.post(`${API}/employees/create`, form, { headers });
      onSuccess(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create employee');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="create-employee-modal">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Add New Employee</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">First Name *</label>
              <input type="text" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                className="w-full px-3 py-1.5 text-xs border rounded-lg" data-testid="inp-first-name" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Last Name *</label>
              <input type="text" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                className="w-full px-3 py-1.5 text-xs border rounded-lg" data-testid="inp-last-name" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-1.5 text-xs border rounded-lg" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Phone</label>
              <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-1.5 text-xs border rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Job Title *</label>
              <select value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))}
                className="w-full px-3 py-1.5 text-xs border rounded-lg" data-testid="inp-job-title">
                {JOB_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Employment Type</label>
              <select value={form.employment_type} onChange={e => setForm(f => ({ ...f, employment_type: e.target.value }))}
                className="w-full px-3 py-1.5 text-xs border rounded-lg" data-testid="inp-emp-type">
                <option value="permanent">Permanent</option>
                <option value="agency">Agency</option>
                <option value="bank">Bank</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Contract Hours (weekly)</label>
            <input type="number" value={form.contract_hours} onChange={e => setForm(f => ({ ...f, contract_hours: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-1.5 text-xs border rounded-lg" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-xs border rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={saving || !form.first_name || !form.last_name}
            className="flex-1 px-4 py-2 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium"
            data-testid="submit-create">
            {saving ? 'Creating...' : 'Create Employee'}
          </button>
        </div>
      </div>
    </div>
  );
};

const EditEmployeeModal = ({ emp, token, onClose, onSuccess }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [form, setForm] = useState({
    first_name: emp.first_name, last_name: emp.last_name,
    email: emp.email || '', phone: emp.phone || '',
    job_title: emp.job_title, employment_type: emp.employment_type || 'permanent',
    contract_hours: emp.contract_hours || 36
  });
  const [saving, setSaving] = useState(false);

  const empId = emp.id;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/employees/${empId}/update`, form, { headers });
      onSuccess();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="edit-employee-modal">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Edit — {emp.first_name} {emp.last_name}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">First Name</label>
              <input type="text" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                className="w-full px-3 py-1.5 text-xs border rounded-lg" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Last Name</label>
              <input type="text" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                className="w-full px-3 py-1.5 text-xs border rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Job Title</label>
              <select value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))}
                className="w-full px-3 py-1.5 text-xs border rounded-lg">
                {JOB_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Employment Type</label>
              <select value={form.employment_type} onChange={e => setForm(f => ({ ...f, employment_type: e.target.value }))}
                className="w-full px-3 py-1.5 text-xs border rounded-lg">
                <option value="permanent">Permanent</option>
                <option value="agency">Agency</option>
                <option value="bank">Bank</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Contract Hours</label>
            <input type="number" value={form.contract_hours} onChange={e => setForm(f => ({ ...f, contract_hours: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-1.5 text-xs border rounded-lg" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-xs border rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 px-4 py-2 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium"
            data-testid="submit-edit">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

const PinResultDialog = ({ data, onClose }) => {
  const pinVal = data.new_pin || data.pin;
  const empName = data.name;
  const empCode = data.employee_id;

  const copyPin = () => {
    navigator.clipboard.writeText(pinVal).catch(() => {});
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="pin-result-dialog">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <KeyRound size={24} className="text-green-600" />
        </div>
        <h3 className="font-semibold text-gray-900 mb-1">{empName}</h3>
        <p className="text-xs text-gray-500 mb-4">Employee ID: {empCode}</p>

        <div className="bg-gray-900 rounded-xl p-4 mb-4">
          <p className="text-xs text-gray-400 mb-1">PIN Code</p>
          <p className="text-4xl font-mono font-bold text-white tracking-[0.5em]" data-testid="pin-display">{pinVal}</p>
        </div>

        <p className="text-xs text-red-500 font-medium mb-4">
          This PIN is shown only once. Please hand-copy it for the staff member.
        </p>

        <div className="flex gap-2">
          <button onClick={copyPin} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs border rounded-lg hover:bg-gray-50">
            <Copy size={13} /> Copy
          </button>
          <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs border rounded-lg hover:bg-gray-50">
            <Printer size={13} /> Print
          </button>
          <button onClick={onClose} className="flex-1 px-3 py-2 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium" data-testid="pin-dismiss">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffManagement;
