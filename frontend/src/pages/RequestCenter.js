import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
  Calendar,
  CalendarPlus,
  CalendarMinus,
  Stethoscope,
  RefreshCcw,
  ArrowLeft,
  CheckCircle,
  Clock,
  AlertCircle,
  Send,
  X,
  ChevronRight,
  Briefcase,
  Heart,
  Baby,
  HelpCircle,
  Loader2,
  AlertTriangle,
  Info
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Simple helper to get leave subtypes (Sick removed - use Report Sick instead)
const getLeaveSubtypes = () => [
  { value: 'annual', label: 'Annual Leave', description: 'Holiday time from your allowance' },
  { value: 'unpaid', label: 'Unpaid Leave', description: 'Leave without pay' },
  { value: 'compassionate', label: 'Compassionate', description: 'Family emergency or bereavement' },
  { value: 'maternity', label: 'Maternity', description: 'Maternity leave' },
  { value: 'paternity', label: 'Paternity', description: 'Paternity leave' },
  { value: 'other', label: 'Other', description: 'Other leave type' }
];

const getLeaveIcon = (value) => {
  const icons = {
    annual: Calendar,
    unpaid: Briefcase,
    compassionate: Heart,
    maternity: Baby,
    paternity: Baby,
    other: HelpCircle
  };
  return icons[value] || Calendar;
};

const RequestCenter = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  
  const [step, setStep] = useState('select');
  const [selectedType, setSelectedType] = useState(null);
  const [selectedSubtype, setSelectedSubtype] = useState(null);
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [myShifts, setMyShifts] = useState([]);
  const [colleagues, setColleagues] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [controlPrefs, setControlPrefs] = useState(null);
  const [validationWarnings, setValidationWarnings] = useState([]);

  useEffect(() => {
    if (!user || !token) {
      navigate('/');
      return;
    }
    fetchInitialData();
  }, [user, token, navigate]);

  const fetchInitialData = async () => {
    setLoadingData(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [shiftsRes, colleaguesRes, profileRes, leaveRes, dayRes, prefsRes] = await Promise.all([
        axios.get(`${API}/shifts/my-rota`, { headers }),
        axios.get(`${API}/staff/colleagues`, { headers }),
        axios.get(`${API}/staff/profile`, { headers }),
        axios.get(`${API}/leave-requests`, { headers }),
        axios.get(`${API}/day-requests`, { headers }),
        axios.get(`${API}/control-preferences`, { headers }).catch(() => ({ data: { preferences: null } }))
      ]);
      
      setMyShifts(shiftsRes.data.shifts || []);
      setColleagues(colleaguesRes.data.colleagues || []);
      const balance = profileRes.data.leave_balance;
      setLeaveBalance(balance);
      setControlPrefs(prefsRes.data.preferences);
      
      const leaves = (leaveRes.data.leave_requests || []).map(r => ({ ...r, reqType: 'leave' }));
      const days = (dayRes.data.day_requests || []).map(r => ({ ...r, reqType: r.request_type }));
      const combined = [...leaves, ...days].slice(0, 5);
      setRecentRequests(combined);
      
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  // Validate leave request against control preferences
  const validateLeaveRequest = (startDate, endDate) => {
    const warnings = [];
    if (!controlPrefs?.requests?.leave) return warnings;
    
    const leaveRules = controlPrefs.requests.leave;
    const start = new Date(startDate);
    const end = new Date(endDate || startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Calculate days in advance
    const daysInAdvance = Math.floor((start - today) / (1000 * 60 * 60 * 24));
    if (daysInAdvance < leaveRules.minimum_notice_days) {
      warnings.push({
        type: 'notice',
        message: `Leave should be requested at least ${leaveRules.minimum_notice_days} days in advance. You are requesting ${daysInAdvance} days ahead.`,
        severity: leaveRules.allow_emergency_leave_override ? 'warning' : 'error'
      });
    }
    
    // Calculate consecutive days
    const consecutiveDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (consecutiveDays > leaveRules.max_consecutive_leave_days) {
      warnings.push({
        type: 'consecutive',
        message: `Maximum consecutive leave is ${leaveRules.max_consecutive_leave_days} days. You are requesting ${consecutiveDays} days.`,
        severity: 'error'
      });
    }
    
    return warnings;
  };

  // Validate swap request against control preferences  
  const validateSwapRequest = (swapType) => {
    const warnings = [];
    if (!controlPrefs?.requests?.swap) return warnings;
    
    const swapRules = controlPrefs.requests.swap;
    
    if (swapType === 'direct' && !swapRules.allow_direct_swaps) {
      warnings.push({
        type: 'swap_type',
        message: 'Direct swap requests are not currently allowed.',
        severity: 'error'
      });
    }
    
    if (swapType === 'open' && !swapRules.allow_open_swaps) {
      warnings.push({
        type: 'swap_type',
        message: 'Open swap requests (to all colleagues) are not currently allowed.',
        severity: 'error'
      });
    }
    
    return warnings;
  };

  const handleSelectType = (type) => {
    setSelectedType(type);
    setSelectedSubtype(null);
    setFormData({});
    setError(null);
    setValidationWarnings([]);
    
    if (type === 'leave') {
      setStep('subtype');
    } else {
      setStep('form');
    }
  };

  const handleSelectSubtype = (subtype) => {
    setSelectedSubtype(subtype);
    setStep('form');
  };

  const handleBack = () => {
    setError(null);
    setValidationWarnings([]);
    if (step === 'form' && selectedType === 'leave') {
      setStep('subtype');
    } else if (step === 'subtype' || step === 'form') {
      setStep('select');
      setSelectedType(null);
      setSelectedSubtype(null);
    } else if (step === 'confirm') {
      setStep('form');
    } else {
      navigate(-1);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    
    try {
      let endpoint = '';
      let payload = {};
      const headers = { Authorization: `Bearer ${token}` };
      
      if (selectedType === 'leave') {
        // Validate before submitting
        const warnings = validateLeaveRequest(formData.start_date, formData.end_date);
        const hasErrors = warnings.some(w => w.severity === 'error');
        if (hasErrors) {
          setValidationWarnings(warnings);
          setSubmitting(false);
          return;
        }
        
        endpoint = '/leave-requests';
        payload = {
          leave_type: selectedSubtype,
          start_date: formData.start_date,
          end_date: formData.end_date || formData.start_date,
          reason: formData.reason || ''
        };
      } else if (selectedType === 'sick_report') {
        endpoint = '/sick-leave/record';
        payload = {
          start_date: formData.start_date || new Date().toISOString().split('T')[0],
          end_date: formData.end_date,
          symptoms: formData.symptoms || '',
          doctor_note: formData.doctor_note || false,
          notes: formData.notes || ''
        };
      } else if (selectedType === 'day_off' || selectedType === 'day_on') {
        endpoint = '/day-requests';
        payload = {
          request_type: selectedType,
          requested_date: formData.requested_date,
          reason: formData.reason || ''
        };
      } else if (selectedType === 'shift_swap') {
        endpoint = '/shift-swaps';
        payload = {
          shift_id: formData.shift_id,
          swap_type: formData.swap_type || 'open',
          target_employee_id: formData.target_employee_id || null,
          reason: formData.reason || ''
        };
      }
      
      await axios.post(`${API}${endpoint}`, payload, { headers });
      setStep('success');
      
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    if (status === 'pending') return 'bg-yellow-100 text-yellow-700';
    if (status === 'approved') return 'bg-green-100 text-green-700';
    if (status === 'rejected') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-500';
  };

  // Type Selection Screen
  const TypeSelection = () => {
    const types = [
      { id: 'leave', label: 'Leave Request', desc: 'Annual, compassionate, or other leave', Icon: Calendar, color: 'blue' },
      { id: 'sick_report', label: 'Report Sick', desc: 'Record sick leave today', Icon: Stethoscope, color: 'red' },
      { id: 'day_off', label: 'Request Day Off', desc: 'Request a specific day off', Icon: CalendarMinus, color: 'orange' },
      { id: 'day_on', label: 'Pick Up Shift', desc: 'Request to work an extra day', Icon: CalendarPlus, color: 'green' },
      { id: 'shift_swap', label: 'Swap Shift', desc: 'Swap your shift with a colleague', Icon: RefreshCcw, color: 'purple' }
    ];

    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">What would you like to do?</h2>
        
        <div className="grid gap-3">
          {types.map((t) => {
            const iconColor = `text-${t.color}-500`;
            
            return (
              <button
                key={t.id}
                onClick={() => handleSelectType(t.id)}
                className={`flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl transition-all hover:border-blue-300 hover:bg-blue-50`}
                data-testid={`request-type-${t.id}`}
              >
                <div className={`w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center ${iconColor}`}>
                  <t.Icon size={24} />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-medium text-gray-900">{t.label}</h3>
                  <p className="text-sm text-gray-500">{t.desc}</p>
                </div>
                <ChevronRight className="text-gray-400" size={20} />
              </button>
            );
          })}
        </div>
        
        {recentRequests.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Recent Requests</h3>
            <div className="space-y-2">
              {recentRequests.map((req, idx) => {
                const reqLabel = req.leave_type || req.request_type || 'Request';
                const reqDate = req.start_date || req.requested_date;
                return (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                    <div>
                      <span className="font-medium text-gray-900">{reqLabel}</span>
                      <span className="text-gray-500 ml-2">{formatDate(reqDate)}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(req.status)}`}>
                      {req.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Leave Subtype Selection
  const SubtypeSelection = () => {
    const subtypes = getLeaveSubtypes();
    
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Select Leave Type</h2>
        
        {leaveBalance && (
          <div className="p-4 bg-blue-50 rounded-xl mb-6">
            <div className="flex items-center justify-between">
              <span className="text-blue-700 font-medium">Annual Leave Balance</span>
              <span className="text-2xl font-bold text-blue-700">
                {leaveBalance.remaining || 0} days
              </span>
            </div>
            <p className="text-blue-600 text-sm mt-1">
              {leaveBalance.used || 0} used of {leaveBalance.total || 0} days
            </p>
          </div>
        )}
        
        <div className="grid gap-3">
          {subtypes.map((subtype) => {
            const IconComp = getLeaveIcon(subtype.value);
            return (
              <button
                key={subtype.value}
                onClick={() => handleSelectSubtype(subtype.value)}
                className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all"
                data-testid={`leave-type-${subtype.value}`}
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-500">
                  <IconComp size={20} />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-medium text-gray-900">{subtype.label}</h3>
                  <p className="text-sm text-gray-500">{subtype.description}</p>
                </div>
                <ChevronRight className="text-gray-400" size={20} />
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Leave Form
  const LeaveForm = () => {
    const subtypes = getLeaveSubtypes();
    const subtype = subtypes.find(s => s.value === selectedSubtype);
    const IconComp = getLeaveIcon(selectedSubtype);
    
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-500">
            <IconComp size={20} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{subtype?.label || 'Leave'} Request</h2>
            <p className="text-sm text-gray-500">{subtype?.description}</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="leave_start_date" className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
            <input
              id="leave_start_date"
              name="start_date"
              type="date"
              value={formData.start_date || ''}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              data-testid="leave-start-date"
              required
            />
          </div>
          
          <div>
            <label htmlFor="leave_end_date" className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
            <input
              id="leave_end_date"
              name="end_date"
              type="date"
              value={formData.end_date || ''}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              min={formData.start_date || new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              data-testid="leave-end-date"
              required
            />
          </div>
          
          <div>
            <label htmlFor="leave_reason" className="block text-sm font-medium text-gray-700 mb-2">Reason (optional)</label>
            <textarea
              id="leave_reason"
              name="reason"
              value={formData.reason || ''}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Any additional details..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              data-testid="leave-reason"
            />
          </div>
        </div>
        
        {/* Validation Warnings from Control Preferences */}
        {validationWarnings.length > 0 && (
          <div className="space-y-2">
            {validationWarnings.map((warning, idx) => (
              <div 
                key={idx}
                className={`p-3 rounded-xl text-sm flex items-start gap-2 ${
                  warning.severity === 'error' 
                    ? 'bg-red-50 border border-red-200 text-red-700'
                    : 'bg-amber-50 border border-amber-200 text-amber-700'
                }`}
              >
                {warning.severity === 'error' ? <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />}
                <span>{warning.message}</span>
              </div>
            ))}
          </div>
        )}
        
        {/* Leave Policy Info */}
        {controlPrefs?.requests?.leave && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 flex items-start gap-2">
            <Info size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-medium">Leave Policy:</span> Minimum {controlPrefs.requests.leave.minimum_notice_days} days notice required. 
              Maximum {controlPrefs.requests.leave.max_consecutive_leave_days} consecutive days per request.
            </div>
          </div>
        )}
        
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        
        <button
          onClick={() => {
            // Run validation before continuing
            const warnings = validateLeaveRequest(formData.start_date, formData.end_date);
            setValidationWarnings(warnings);
            const hasErrors = warnings.some(w => w.severity === 'error');
            if (!hasErrors) {
              setStep('confirm');
            }
          }}
          disabled={!formData.start_date || !formData.end_date}
          className="w-full py-4 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          data-testid="leave-continue-btn"
        >
          Continue
        </button>
      </div>
    );
  };

  // Day Request Form
  const DayRequestForm = () => {
    const isPickUp = selectedType === 'day_on';
    const Icon = isPickUp ? CalendarPlus : CalendarMinus;
    const label = isPickUp ? 'Pick Up Shift' : 'Request Day Off';
    const desc = isPickUp ? 'Request to work an extra day' : 'Request a specific day off';
    const bgColor = isPickUp ? 'bg-green-100 text-green-500' : 'bg-orange-100 text-orange-500';
    const btnColor = isPickUp ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600';
    
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${bgColor}`}>
            <Icon size={20} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{label}</h2>
            <p className="text-sm text-gray-500">{desc}</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="day_request_date" className="block text-sm font-medium text-gray-700 mb-2">
              {isPickUp ? 'Date to Work' : 'Date Off'} *
            </label>
            <input
              id="day_request_date"
              name="requested_date"
              type="date"
              value={formData.requested_date || ''}
              onChange={(e) => setFormData({ ...formData, requested_date: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              data-testid="day-request-date"
              required
            />
          </div>
          
          <div>
            <label htmlFor="day_request_reason" className="block text-sm font-medium text-gray-700 mb-2">Reason (optional)</label>
            <textarea
              id="day_request_reason"
              name="reason"
              value={formData.reason || ''}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder={isPickUp ? 'Why do you want to pick up this shift?' : 'Why do you need this day off?'}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              data-testid="day-request-reason"
            />
          </div>
        </div>
        
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        
        <button
          onClick={() => setStep('confirm')}
          disabled={!formData.requested_date}
          className={`w-full py-4 text-white rounded-xl font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed ${btnColor}`}
          data-testid="day-request-continue-btn"
        >
          Continue
        </button>
      </div>
    );
  };

  // Sick Report Form
  const SickReportForm = () => {
    const today = new Date().toISOString().split('T')[0];
    
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-500">
            <Stethoscope size={20} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Report Sick Leave</h2>
            <p className="text-sm text-gray-500">Record your sick leave - your manager will be notified</p>
          </div>
        </div>
        
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-700">
          <strong>Note:</strong> Sick leave is recorded immediately. Please also follow your care home's call-in procedure.
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="sick_start_date" className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
              <input
                id="sick_start_date"
                name="start_date"
                type="date"
                value={formData.start_date || today}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                max={today}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                data-testid="sick-start-date"
                required
              />
            </div>
            
            <div>
              <label htmlFor="sick_end_date" className="block text-sm font-medium text-gray-700 mb-2">Expected Return</label>
              <input
                id="sick_end_date"
                name="end_date"
                type="date"
                value={formData.end_date || ''}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                min={formData.start_date || today}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                data-testid="sick-end-date"
                placeholder="Leave blank if unsure"
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="sick_symptoms" className="block text-sm font-medium text-gray-700 mb-2">Symptoms / Reason</label>
            <textarea
              id="sick_symptoms"
              name="symptoms"
              value={formData.symptoms || ''}
              onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
              placeholder="Brief description (e.g., flu, stomach bug)..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              rows={2}
              data-testid="sick-symptoms"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="doctor_note"
              name="doctor_note"
              checked={formData.doctor_note || false}
              onChange={(e) => setFormData({ ...formData, doctor_note: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-red-500 focus:ring-red-500"
              data-testid="sick-doctor-note"
            />
            <label htmlFor="doctor_note" className="text-sm text-gray-700">
              I will provide a doctor's note (required for 3+ consecutive days)
            </label>
          </div>
          
          <div>
            <label htmlFor="sick_notes" className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
            <textarea
              id="sick_notes"
              name="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional information for your manager..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              rows={2}
              data-testid="sick-notes"
            />
          </div>
        </div>
        
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        
        <button
          onClick={() => setStep('confirm')}
          className="w-full py-4 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
          data-testid="sick-continue-btn"
        >
          Continue
        </button>
      </div>
    );
  };

  // Shift Swap Form
  const ShiftSwapForm = () => {
    const upcomingShifts = myShifts.filter(s => new Date(s.shift_date) >= new Date());
    
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-500">
            <RefreshCcw size={20} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Swap Shift</h2>
            <p className="text-sm text-gray-500">Exchange your shift with a colleague</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="swap_shift_id" className="block text-sm font-medium text-gray-700 mb-2">Select Your Shift *</label>
            <select
              id="swap_shift_id"
              name="shift_id"
              value={formData.shift_id || ''}
              onChange={(e) => setFormData({ ...formData, shift_id: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              data-testid="swap-shift-select"
              required
            >
              <option value="">Choose a shift...</option>
              {upcomingShifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {formatDate(shift.shift_date)} - {shift.start_time} to {shift.end_time}
                </option>
              ))}
            </select>
            {upcomingShifts.length === 0 && (
              <p className="text-sm text-gray-500 mt-2">No upcoming shifts available to swap</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Swap Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, swap_type: 'open' })}
                className={`p-3 border rounded-xl text-center transition-all ${
                  formData.swap_type !== 'direct' 
                    ? 'border-purple-500 bg-purple-50 text-purple-700' 
                    : 'border-gray-200 text-gray-600 hover:border-purple-300'
                }`}
                data-testid="swap-type-open"
              >
                <div className="font-medium">Open Swap</div>
                <div className="text-xs mt-1">Anyone can accept</div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, swap_type: 'direct' })}
                className={`p-3 border rounded-xl text-center transition-all ${
                  formData.swap_type === 'direct' 
                    ? 'border-purple-500 bg-purple-50 text-purple-700' 
                    : 'border-gray-200 text-gray-600 hover:border-purple-300'
                }`}
                data-testid="swap-type-direct"
              >
                <div className="font-medium">Direct Request</div>
                <div className="text-xs mt-1">Ask specific person</div>
              </button>
            </div>
          </div>
          
          {formData.swap_type === 'direct' && (
            <div>
              <label htmlFor="swap_target_employee" className="block text-sm font-medium text-gray-700 mb-2">Select Colleague *</label>
              <select
                id="swap_target_employee"
                name="target_employee_id"
                value={formData.target_employee_id || ''}
                onChange={(e) => setFormData({ ...formData, target_employee_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                data-testid="swap-colleague-select"
                required
              >
                <option value="">Choose a colleague...</option>
                {colleagues.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div>
            <label htmlFor="swap_message" className="block text-sm font-medium text-gray-700 mb-2">Message (optional)</label>
            <textarea
              id="swap_message"
              name="reason"
              value={formData.reason || ''}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Any notes for the swap..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              rows={3}
              data-testid="swap-reason"
            />
          </div>
        </div>
        
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        
        <button
          onClick={() => setStep('confirm')}
          disabled={!formData.shift_id || (formData.swap_type === 'direct' && !formData.target_employee_id)}
          className="w-full py-4 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          data-testid="swap-continue-btn"
        >
          Continue
        </button>
      </div>
    );
  };

  // Confirmation Screen
  const Confirmation = () => {
    const typeLabels = {
      leave: 'Leave Request',
      sick_report: 'Sick Leave Report',
      day_off: 'Request Day Off',
      day_on: 'Pick Up Shift',
      shift_swap: 'Swap Shift'
    };
    const label = typeLabels[selectedType];
    
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${selectedType === 'sick_report' ? 'bg-red-100 text-red-500' : 'bg-blue-100 text-blue-500'}`}>
            {selectedType === 'sick_report' ? <Stethoscope size={32} /> : <CheckCircle size={32} />}
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Confirm Your Request</h2>
          <p className="text-gray-500 mt-1">Please review the details below</p>
        </div>
        
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-500">Request Type</span>
            <span className="font-medium text-gray-900">{label}</span>
          </div>
          
          {selectedType === 'sick_report' && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-500">Start Date</span>
                <span className="font-medium text-gray-900">{formatDate(formData.start_date)}</span>
              </div>
              {formData.end_date && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Expected Return</span>
                  <span className="font-medium text-gray-900">{formatDate(formData.end_date)}</span>
                </div>
              )}
              {formData.symptoms && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Symptoms</span>
                  <span className="font-medium text-gray-900">{formData.symptoms}</span>
                </div>
              )}
              {formData.doctor_note && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Doctor's Note</span>
                  <span className="font-medium text-green-600">Will provide</span>
                </div>
              )}
            </>
          )}
          {selectedType === 'leave' && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-500">Leave Type</span>
                <span className="font-medium text-gray-900 capitalize">{selectedSubtype}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Dates</span>
                <span className="font-medium text-gray-900">
                  {formatDate(formData.start_date)} - {formatDate(formData.end_date)}
                </span>
              </div>
            </>
          )}
          
          {(selectedType === 'day_off' || selectedType === 'day_on') && (
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span className="font-medium text-gray-900">{formatDate(formData.requested_date)}</span>
            </div>
          )}
          
          {selectedType === 'shift_swap' && (
            <div className="flex justify-between">
              <span className="text-gray-500">Swap Type</span>
              <span className="font-medium text-gray-900 capitalize">{formData.swap_type || 'Open'}</span>
            </div>
          )}
          
          {formData.reason && (
            <div className="pt-2 border-t border-gray-200">
              <span className="text-gray-500 text-sm">Note:</span>
              <p className="text-gray-900 mt-1">{formData.reason}</p>
            </div>
          )}
        </div>
        
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        
        <div className="flex gap-3">
          <button
            onClick={handleBack}
            disabled={submitting}
            className="flex-1 py-4 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-4 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
            data-testid="submit-request-btn"
          >
            {submitting ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send size={20} />
                Submit Request
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  // Success Screen
  const Success = () => {
    const typeLabels = {
      leave: 'leave request',
      sick_report: 'sick leave',
      day_off: 'day off request',
      day_on: 'shift pick up request',
      shift_swap: 'shift swap request'
    };
    
    const isSickReport = selectedType === 'sick_report';
    
    return (
      <div className="text-center space-y-6 py-8">
        <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${isSickReport ? 'bg-red-100' : 'bg-green-100'}`}>
          {isSickReport ? (
            <Stethoscope size={48} className="text-red-500" />
          ) : (
            <CheckCircle size={48} className="text-green-500" />
          )}
        </div>
        
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            {isSickReport ? 'Sick Leave Recorded!' : 'Request Submitted!'}
          </h2>
          <p className="text-gray-500">
            {isSickReport 
              ? 'Your sick leave has been recorded and your manager has been notified.'
              : `Your ${typeLabels[selectedType]} has been submitted and is pending approval.`
            }
          </p>
        </div>
        
        <div className="bg-gray-50 rounded-xl p-4 text-left">
          <div className="flex items-center gap-2 text-gray-700">
            <Clock size={16} />
            <span className="text-sm">What happens next?</span>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {isSickReport 
              ? 'Focus on getting better. Remember to provide a doctor\'s note if you\'re off for 3+ days. You\'ll receive a message when you return.'
              : 'Your manager will review your request and you\'ll receive a notification when it\'s approved.'
            }
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => {
              setStep('select');
              setSelectedType(null);
              setSelectedSubtype(null);
              setFormData({});
              fetchInitialData();
            }}
            className="flex-1 py-4 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            data-testid="new-request-btn"
          >
            New Request
          </button>
          <button
            onClick={() => navigate('/staff/profile')}
            className="flex-1 py-4 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
            data-testid="view-requests-btn"
          >
            View My Requests
          </button>
        </div>
      </div>
    );
  };

  if (loadingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Render form based on selected type
  const renderForm = () => {
    if (selectedType === 'leave') return <LeaveForm />;
    if (selectedType === 'sick_report') return <SickReportForm />;
    if (selectedType === 'day_off' || selectedType === 'day_on') return <DayRequestForm />;
    if (selectedType === 'shift_swap') return <ShiftSwapForm />;
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            data-testid="back-btn"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-gray-900">Request Center</h1>
            <p className="text-sm text-gray-500">{user?.first_name} {user?.last_name}</p>
          </div>
          <button
            onClick={() => navigate('/staff')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            data-testid="close-btn"
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>
      </header>
      
      {step !== 'select' && step !== 'success' && (
        <div className="bg-white border-b border-gray-100 px-4 py-2">
          <div className="max-w-lg mx-auto flex items-center gap-2 text-sm">
            <span className="text-blue-500 font-medium">Type</span>
            <ChevronRight size={14} className="text-gray-300" />
            {selectedType === 'leave' && (
              <>
                <span className={step === 'form' || step === 'confirm' ? 'text-blue-500 font-medium' : 'text-gray-400'}>Leave Type</span>
                <ChevronRight size={14} className="text-gray-300" />
              </>
            )}
            <span className={step === 'form' || step === 'confirm' ? 'text-blue-500 font-medium' : 'text-gray-400'}>Details</span>
            <ChevronRight size={14} className="text-gray-300" />
            <span className={step === 'confirm' ? 'text-blue-500 font-medium' : 'text-gray-400'}>Confirm</span>
          </div>
        </div>
      )}
      
      <main className="max-w-lg mx-auto p-4" data-testid="request-center">
        {step === 'select' && <TypeSelection />}
        {step === 'subtype' && <SubtypeSelection />}
        {step === 'form' && renderForm()}
        {step === 'confirm' && <Confirmation />}
        {step === 'success' && <Success />}
      </main>
    </div>
  );
};

export default RequestCenter;
