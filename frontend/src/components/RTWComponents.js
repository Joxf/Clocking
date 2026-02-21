import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  X,
  ChevronRight,
  User,
  UserCheck,
  Calendar,
  Filter
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ADJUSTMENT_TYPES = [
  { value: 'phased_return', label: 'Phased Return' },
  { value: 'reduced_hours', label: 'Reduced Hours' },
  { value: 'modified_duties', label: 'Modified Duties' },
  { value: 'extra_breaks', label: 'Extra Breaks' },
  { value: 'workstation_change', label: 'Workstation/Equipment Change' },
  { value: 'temp_reassignment', label: 'Temporary Reassignment' }
];

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800'
};

const STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  overdue: 'Overdue'
};

// Status Badge Component
export const RTWStatusBadge = ({ status }) => (
  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-800'}`}>
    {STATUS_LABELS[status] || status}
  </span>
);

// RTW Trigger Component - Shows on Staff Profile and Leave tabs
export const RTWTrigger = ({ rtw, onOpenForm }) => {
  if (!rtw) return null;
  
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
            <FileText size={20} className="text-orange-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Return to Work Form Required</p>
            <p className="text-sm text-gray-500">Due: {rtw.due_date}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <RTWStatusBadge status={rtw.status} />
          <button
            onClick={() => onOpenForm(rtw)}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
            data-testid="rtw-open-form-btn"
          >
            Open Form <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

// Manager Dashboard RTW Counter
export const RTWPendingCounter = ({ onClick }) => {
  const { token } = useAuth();
  const [count, setCount] = useState({ pending: 0, overdue: 0 });

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await axios.get(`${API}/rtw/pending-count`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCount(res.data);
      } catch (err) {
        console.error('Failed to fetch RTW count:', err);
      }
    };
    if (token) fetchCount();
  }, [token]);

  if (count.pending === 0) return null;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 bg-orange-100 text-orange-800 rounded-lg hover:bg-orange-200 transition-colors"
      data-testid="rtw-pending-counter"
    >
      <FileText size={18} />
      <span className="font-medium">RTW Pending: {count.pending}</span>
      {count.overdue > 0 && (
        <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">{count.overdue} overdue</span>
      )}
    </button>
  );
};

// Yes/No Question Component
const YesNoQuestion = ({ id, label, value, onChange, required = false }) => (
  <div className="py-3 border-b border-gray-100 last:border-0">
    <div className="flex items-center justify-between">
      <label htmlFor={id} className="text-sm text-gray-700 flex-1 pr-4">{label}</label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            value === true ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          data-testid={`${id}-yes`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            value === false ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          data-testid={`${id}-no`}
        >
          No
        </button>
      </div>
    </div>
  </div>
);

// Multi-select Adjustment Types Component
const AdjustmentSelector = ({ selected, onChange }) => (
  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
    <p className="text-sm font-medium text-gray-700 mb-2">Select adjustment types:</p>
    <div className="grid grid-cols-2 gap-2">
      {ADJUSTMENT_TYPES.map(adj => (
        <label key={adj.value} className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={selected.includes(adj.value)}
            onChange={(e) => {
              if (e.target.checked) {
                onChange([...selected, adj.value]);
              } else {
                onChange(selected.filter(v => v !== adj.value));
              }
            }}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          {adj.label}
        </label>
      ))}
    </div>
  </div>
);

// RTW Form Modal/Dialog
export const RTWFormModal = ({ rtw, onClose, onUpdate }) => {
  const { user, token } = useAuth();
  const isManager = user?.role === 'manager' || user?.role === 'admin';
  const isOwnForm = user?.id === rtw?.employee_id;
  
  const [activeTab, setActiveTab] = useState(isManager ? 'manager' : 'staff');
  const [managerData, setManagerData] = useState({
    fit_to_return: rtw?.mgr_fit_to_return ?? null,
    absence_discussed: rtw?.mgr_absence_discussed ?? null,
    affects_safe_working: rtw?.mgr_affects_safe_working ?? null,
    adjustments_needed: rtw?.mgr_adjustments_needed ?? null,
    adjustment_types: rtw?.mgr_adjustment_types || [],
    occupational_health: rtw?.mgr_occupational_health ?? null,
    work_related: rtw?.mgr_work_related ?? null,
    incident_followup: rtw?.mgr_incident_followup ?? null,
    followup_required: rtw?.mgr_followup_required ?? null,
    followup_timeframe: rtw?.mgr_followup_timeframe || null
  });
  const [staffData, setStaffData] = useState({
    fit_to_return: rtw?.staff_fit_to_return ?? null,
    fully_recovered: rtw?.staff_fully_recovered ?? null,
    ongoing_symptoms: rtw?.staff_ongoing_symptoms ?? null,
    feels_safe: rtw?.staff_feels_safe ?? null,
    needs_adjustments: rtw?.staff_needs_adjustments ?? null,
    adjustment_types: rtw?.staff_adjustment_types || [],
    understands_reporting: rtw?.staff_understands_reporting ?? null,
    agrees_outcome: rtw?.staff_agrees_outcome ?? null
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const isManagerSectionComplete = () => {
    return managerData.fit_to_return !== null &&
      managerData.absence_discussed !== null &&
      managerData.affects_safe_working !== null &&
      managerData.adjustments_needed !== null &&
      managerData.occupational_health !== null &&
      managerData.work_related !== null &&
      managerData.followup_required !== null &&
      (!managerData.adjustments_needed || managerData.adjustment_types.length > 0) &&
      (!managerData.followup_required || managerData.followup_timeframe);
  };

  const isStaffSectionComplete = () => {
    return staffData.fit_to_return !== null &&
      staffData.fully_recovered !== null &&
      staffData.ongoing_symptoms !== null &&
      staffData.feels_safe !== null &&
      staffData.needs_adjustments !== null &&
      staffData.understands_reporting !== null &&
      staffData.agrees_outcome !== null &&
      (!staffData.needs_adjustments || staffData.adjustment_types.length > 0);
  };

  const submitManagerSection = async () => {
    if (!isManagerSectionComplete()) {
      setError('Please answer all questions');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await axios.put(`${API}/rtw/${rtw.id}/manager`, managerData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onUpdate();
      if (!rtw.staff_completed) {
        setActiveTab('staff');
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const submitStaffSection = async () => {
    if (!isStaffSectionComplete()) {
      setError('Please answer all questions');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await axios.put(`${API}/rtw/${rtw.id}/staff`, staffData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onUpdate();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const readOnly = rtw?.status === 'completed';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Return to Work Form</h2>
            <p className="text-sm text-gray-500">{rtw?.employee_name} • Return Date: {rtw?.return_date}</p>
          </div>
          <div className="flex items-center gap-3">
            <RTWStatusBadge status={rtw?.status} />
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg" data-testid="rtw-close-btn">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('manager')}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
              activeTab === 'manager' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
            data-testid="rtw-tab-manager"
          >
            <UserCheck size={18} />
            Manager Section
            {rtw?.manager_completed && <CheckCircle size={16} className="text-green-500" />}
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
              activeTab === 'staff' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
            data-testid="rtw-tab-staff"
          >
            <User size={18} />
            Staff Section
            {rtw?.staff_completed && <CheckCircle size={16} className="text-green-500" />}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {activeTab === 'manager' && (
            <div className="space-y-1">
              <YesNoQuestion
                id="mgr_fit_to_return"
                label="Has the staff member confirmed they are fit to return today?"
                value={managerData.fit_to_return}
                onChange={(v) => !readOnly && setManagerData(p => ({...p, fit_to_return: v}))}
              />
              <YesNoQuestion
                id="mgr_absence_discussed"
                label="Has the absence been discussed with the staff member?"
                value={managerData.absence_discussed}
                onChange={(v) => !readOnly && setManagerData(p => ({...p, absence_discussed: v}))}
              />
              <YesNoQuestion
                id="mgr_affects_safe_working"
                label="Is there any indication the illness could affect safe working?"
                value={managerData.affects_safe_working}
                onChange={(v) => !readOnly && setManagerData(p => ({...p, affects_safe_working: v}))}
              />
              <YesNoQuestion
                id="mgr_adjustments_needed"
                label="Does the staff member require adjustments to duties or rota?"
                value={managerData.adjustments_needed}
                onChange={(v) => !readOnly && setManagerData(p => ({...p, adjustments_needed: v}))}
              />
              {managerData.adjustments_needed && (
                <AdjustmentSelector
                  selected={managerData.adjustment_types}
                  onChange={(v) => !readOnly && setManagerData(p => ({...p, adjustment_types: v}))}
                />
              )}
              <YesNoQuestion
                id="mgr_occupational_health"
                label="Is Occupational Health referral required?"
                value={managerData.occupational_health}
                onChange={(v) => !readOnly && setManagerData(p => ({...p, occupational_health: v}))}
              />
              <YesNoQuestion
                id="mgr_work_related"
                label="Is this absence potentially work related?"
                value={managerData.work_related}
                onChange={(v) => !readOnly && setManagerData(p => ({...p, work_related: v}))}
              />
              {managerData.work_related && (
                <YesNoQuestion
                  id="mgr_incident_followup"
                  label="If work related, require incident follow up?"
                  value={managerData.incident_followup}
                  onChange={(v) => !readOnly && setManagerData(p => ({...p, incident_followup: v}))}
                />
              )}
              <YesNoQuestion
                id="mgr_followup_required"
                label="Follow up review required?"
                value={managerData.followup_required}
                onChange={(v) => !readOnly && setManagerData(p => ({...p, followup_required: v}))}
              />
              {managerData.followup_required && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-2">Select review timeframe:</p>
                  <div className="flex gap-2">
                    {['1_week', '2_weeks', '4_weeks'].map(tf => (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => !readOnly && setManagerData(p => ({...p, followup_timeframe: tf}))}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          managerData.followup_timeframe === tf
                            ? 'bg-blue-500 text-white'
                            : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
                        }`}
                      >
                        {tf.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="space-y-1">
              <YesNoQuestion
                id="staff_fit_to_return"
                label="Do you confirm you are fit to return to work today?"
                value={staffData.fit_to_return}
                onChange={(v) => !readOnly && setStaffData(p => ({...p, fit_to_return: v}))}
              />
              <YesNoQuestion
                id="staff_fully_recovered"
                label="Do you feel fully recovered?"
                value={staffData.fully_recovered}
                onChange={(v) => !readOnly && setStaffData(p => ({...p, fully_recovered: v}))}
              />
              <YesNoQuestion
                id="staff_ongoing_symptoms"
                label="Do you have any ongoing symptoms that could affect work?"
                value={staffData.ongoing_symptoms}
                onChange={(v) => !readOnly && setStaffData(p => ({...p, ongoing_symptoms: v}))}
              />
              <YesNoQuestion
                id="staff_feels_safe"
                label="Do you feel safe returning to your normal duties?"
                value={staffData.feels_safe}
                onChange={(v) => !readOnly && setStaffData(p => ({...p, feels_safe: v}))}
              />
              <YesNoQuestion
                id="staff_needs_adjustments"
                label="Do you need any adjustments to support your return?"
                value={staffData.needs_adjustments}
                onChange={(v) => !readOnly && setStaffData(p => ({...p, needs_adjustments: v}))}
              />
              {staffData.needs_adjustments && (
                <AdjustmentSelector
                  selected={staffData.adjustment_types}
                  onChange={(v) => !readOnly && setStaffData(p => ({...p, adjustment_types: v}))}
                />
              )}
              <YesNoQuestion
                id="staff_understands_reporting"
                label="Do you understand you must report if your condition worsens?"
                value={staffData.understands_reporting}
                onChange={(v) => !readOnly && setStaffData(p => ({...p, understands_reporting: v}))}
              />
              <YesNoQuestion
                id="staff_agrees_outcome"
                label="Do you agree with the RTW outcome and plan?"
                value={staffData.agrees_outcome}
                onChange={(v) => !readOnly && setStaffData(p => ({...p, agrees_outcome: v}))}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        {!readOnly && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              data-testid="rtw-cancel-btn"
            >
              Cancel
            </button>
            {activeTab === 'manager' && isManager && !rtw?.manager_completed && (
              <button
                onClick={submitManagerSection}
                disabled={submitting || !isManagerSectionComplete()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                data-testid="rtw-submit-manager"
              >
                {submitting ? 'Saving...' : 'Complete Manager Section'}
              </button>
            )}
            {activeTab === 'staff' && isOwnForm && !rtw?.staff_completed && (
              <button
                onClick={submitStaffSection}
                disabled={submitting || !isStaffSectionComplete()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                data-testid="rtw-submit-staff"
              >
                {submitting ? 'Saving...' : 'Complete Staff Section'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// RTW Register/List Component
export const RTWRegister = ({ onClose }) => {
  const { token } = useAuth();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', employee: '' });
  const [selectedRTW, setSelectedRTW] = useState(null);
  const [employees, setEmployees] = useState([]);

  const fetchForms = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.employee) params.append('employee_id', filters.employee);
      
      const res = await axios.get(`${API}/rtw?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setForms(res.data.rtw_forms || []);
    } catch (err) {
      console.error('Failed to fetch RTW forms:', err);
    } finally {
      setLoading(false);
    }
  }, [token, filters]);

  useEffect(() => {
    fetchForms();
    // Fetch employees for filter
    axios.get(`${API}/staff`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setEmployees(res.data.staff || []))
      .catch(() => {});
  }, [fetchForms, token]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Return to Work Forms</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" data-testid="rtw-register-close">
            <X size={20} />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex gap-4 items-center">
          <Filter size={18} className="text-gray-400" />
          <select
            id="rtw_status_filter"
            name="status"
            value={filters.status}
            onChange={(e) => setFilters(p => ({...p, status: e.target.value}))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
          </select>
          <select
            id="rtw_employee_filter"
            name="employee"
            value={filters.employee}
            onChange={(e) => setFilters(p => ({...p, employee: e.target.value}))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Staff</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
            ))}
          </select>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-500">Loading...</div>
          ) : forms.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-500">
              <div className="text-center">
                <FileText size={48} className="mx-auto mb-3 text-gray-300" />
                <p>No RTW forms found</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {forms.map(form => (
                <div
                  key={form.id}
                  onClick={() => setSelectedRTW(form)}
                  className="px-6 py-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                  data-testid={`rtw-row-${form.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <User size={20} className="text-gray-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{form.employee_name}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-2">
                        <Calendar size={14} />
                        Return: {form.return_date}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <p className="text-gray-500">
                        Manager: {form.manager_completed ? <CheckCircle size={14} className="inline text-green-500" /> : <Clock size={14} className="inline text-yellow-500" />}
                      </p>
                      <p className="text-gray-500">
                        Staff: {form.staff_completed ? <CheckCircle size={14} className="inline text-green-500" /> : <Clock size={14} className="inline text-yellow-500" />}
                      </p>
                    </div>
                    <RTWStatusBadge status={form.status} />
                    <ChevronRight size={20} className="text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RTW Form Modal */}
      {selectedRTW && (
        <RTWFormModal
          rtw={selectedRTW}
          onClose={() => setSelectedRTW(null)}
          onUpdate={() => {
            fetchForms();
            setSelectedRTW(null);
          }}
        />
      )}
    </div>
  );
};

export default RTWFormModal;
