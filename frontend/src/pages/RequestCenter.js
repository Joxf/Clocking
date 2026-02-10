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
  Loader2
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Request type configurations
const REQUEST_TYPES = {
  leave: {
    id: 'leave',
    label: 'Leave Request',
    description: 'Annual, sick, or other leave',
    icon: Calendar,
    color: 'blue',
    subtypes: [
      { value: 'annual', label: 'Annual Leave', icon: Calendar, description: 'Holiday time from your allowance' },
      { value: 'sick', label: 'Sick Leave', icon: Stethoscope, description: 'Time off due to illness' },
      { value: 'unpaid', label: 'Unpaid Leave', icon: Briefcase, description: 'Leave without pay' },
      { value: 'compassionate', label: 'Compassionate', icon: Heart, description: 'Family emergency or bereavement' },
      { value: 'maternity', label: 'Maternity', icon: Baby, description: 'Maternity leave' },
      { value: 'paternity', label: 'Paternity', icon: Baby, description: 'Paternity leave' },
      { value: 'other', label: 'Other', icon: HelpCircle, description: 'Other leave type' }
    ]
  },
  day_off: {
    id: 'day_off',
    label: 'Request Day Off',
    description: 'Request a specific day off',
    icon: CalendarMinus,
    color: 'orange'
  },
  day_on: {
    id: 'day_on',
    label: 'Pick Up Shift',
    description: 'Request to work an extra day',
    icon: CalendarPlus,
    color: 'green'
  },
  shift_swap: {
    id: 'shift_swap',
    label: 'Swap Shift',
    description: 'Swap your shift with a colleague',
    icon: RefreshCcw,
    color: 'purple'
  }
};

const RequestCenter = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  
  const [step, setStep] = useState('select'); // select, form, confirm, success
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
      const [shiftsRes, colleaguesRes, profileRes, leaveRes, dayRes] = await Promise.all([
        axios.get(`${API}/shifts/my-rota`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/staff/colleagues`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/staff/profile`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/leave-requests`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/day-requests`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      setMyShifts(shiftsRes.data.shifts || []);
      setColleagues(colleaguesRes.data.colleagues || []);
      setLeaveBalance(profileRes.data.leave_balance);
      
      // Combine recent requests
      const leaves = (leaveRes.data.leave_requests || []).map(r => ({ ...r, type: 'leave' }));
      const days = (dayRes.data.day_requests || []).map(r => ({ ...r, type: r.request_type }));
      const combined = [...leaves, ...days].sort((a, b) => 
        new Date(b.created_at || b.requested_date) - new Date(a.created_at || a.requested_date)
      ).slice(0, 5);
      setRecentRequests(combined);
      
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSelectType = (type) => {
    setSelectedType(type);
    setSelectedSubtype(null);
    setFormData({});
    setError(null);
    
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
      
      if (selectedType === 'leave') {
        endpoint = '/leave-requests';
        payload = {
          leave_type: selectedSubtype,
          start_date: formData.start_date,
          end_date: formData.end_date || formData.start_date,
          reason: formData.reason || ''
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
      
      await axios.post(`${API}${endpoint}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setStep('success');
      
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit request. Please try again.');
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
    const colors = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-500'
    };
    return colors[status] || 'bg-gray-100 text-gray-500';
  };

  // Render: Type Selection
  const renderTypeSelection = () => (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">What would you like to do?</h2>
      
      <div className="grid gap-3">
        {Object.values(REQUEST_TYPES).map((type) => {
          const IconComponent = type.icon;
          const colorClasses = {
            blue: 'hover:border-blue-300 hover:bg-blue-50',
            orange: 'hover:border-orange-300 hover:bg-orange-50',
            green: 'hover:border-green-300 hover:bg-green-50',
            purple: 'hover:border-purple-300 hover:bg-purple-50'
          };
          const iconColors = {
            blue: 'text-blue-500',
            orange: 'text-orange-500',
            green: 'text-green-500',
            purple: 'text-purple-500'
          };
          
          return (
            <button
              key={type.id}
              onClick={() => handleSelectType(type.id)}
              className={`flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl transition-all ${colorClasses[type.color]}`}
              data-testid={`request-type-${type.id}`}
            >
              <div className={`w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center ${iconColors[type.color]}`}>
                <IconComponent size={24} />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-medium text-gray-900">{type.label}</h3>
                <p className="text-sm text-gray-500">{type.description}</p>
              </div>
              <ChevronRight className="text-gray-400" size={20} />
            </button>
          );
        })}
      </div>
      
      {/* Recent Requests */}
      {recentRequests.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Recent Requests</h3>
          <div className="space-y-2">
            {recentRequests.map((req, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                <div>
                  <span className="font-medium text-gray-900">
                    {req.leave_type || req.request_type || 'Request'}
                  </span>
                  <span className="text-gray-500 ml-2">
                    {formatDate(req.start_date || req.requested_date)}
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(req.status)}`}>
                  {req.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Render: Leave Subtype Selection
  const renderSubtypeSelection = () => (
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
        {REQUEST_TYPES.leave.subtypes.map((subtype) => {
          const IconComponent = subtype.icon;
          return (
            <button
              key={subtype.value}
              onClick={() => handleSelectSubtype(subtype.value)}
              className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all"
              data-testid={`leave-type-${subtype.value}`}
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-500">
                <IconComponent size={20} />
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

  // Render: Form based on request type
  const renderForm = () => {
    if (selectedType === 'leave') {
      return renderLeaveForm();
    } else if (selectedType === 'day_off' || selectedType === 'day_on') {
      return renderDayRequestForm();
    } else if (selectedType === 'shift_swap') {
      return renderShiftSwapForm();
    }
    return null;
  };

  const renderLeaveForm = () => {
    const subtype = REQUEST_TYPES.leave.subtypes.find(s => s.value === selectedSubtype);
    
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-500">
            {subtype && <subtype.icon size={20} />}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{subtype?.label || 'Leave'} Request</h2>
            <p className="text-sm text-gray-500">{subtype?.description}</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
            <input
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
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
            <input
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason {selectedSubtype === 'sick' ? '' : '(optional)'}
            </label>
            <textarea
              value={formData.reason || ''}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder={selectedSubtype === 'sick' ? 'Brief description of illness...' : 'Any additional details...'}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              data-testid="leave-reason"
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
          disabled={!formData.start_date || !formData.end_date}
          className="w-full py-4 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          data-testid="leave-continue-btn"
        >
          Continue
        </button>
      </div>
    );
  };

  const renderDayRequestForm = () => {
    const isPickUp = selectedType === 'day_on';
    const config = REQUEST_TYPES[selectedType];
    const IconComponent = config.icon;
    
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPickUp ? 'bg-green-100 text-green-500' : 'bg-orange-100 text-orange-500'}`}>
            <IconComponent size={20} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{config.label}</h2>
            <p className="text-sm text-gray-500">{config.description}</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isPickUp ? 'Date to Work' : 'Date Off'} *
            </label>
            <input
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Reason (optional)</label>
            <textarea
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
          className={`w-full py-4 text-white rounded-xl font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed ${
            isPickUp ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600'
          }`}
          data-testid="day-request-continue-btn"
        >
          Continue
        </button>
      </div>
    );
  };

  const renderShiftSwapForm = () => {
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Your Shift *</label>
            <select
              value={formData.shift_id || ''}
              onChange={(e) => setFormData({ ...formData, shift_id: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              data-testid="swap-shift-select"
              required
            >
              <option value="">Choose a shift...</option>
              {upcomingShifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {formatDate(shift.shift_date)} - {shift.start_time} to {shift.end_time} ({shift.shift_type})
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Colleague *</label>
              <select
                value={formData.target_employee_id || ''}
                onChange={(e) => setFormData({ ...formData, target_employee_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                data-testid="swap-colleague-select"
                required
              >
                <option value="">Choose a colleague...</option>
                {colleagues.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name} ({c.job_title})
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Message (optional)</label>
            <textarea
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

  // Render: Confirmation
  const renderConfirmation = () => {
    const config = REQUEST_TYPES[selectedType];
    const IconComponent = config.icon;
    
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
            selectedType === 'leave' ? 'bg-blue-100 text-blue-500' :
            selectedType === 'day_on' ? 'bg-green-100 text-green-500' :
            selectedType === 'day_off' ? 'bg-orange-100 text-orange-500' :
            'bg-purple-100 text-purple-500'
          }`}>
            <IconComponent size={32} />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Confirm Your Request</h2>
          <p className="text-gray-500 mt-1">Please review the details below</p>
        </div>
        
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-500">Request Type</span>
            <span className="font-medium text-gray-900">{config.label}</span>
          </div>
          
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
            <>
              <div className="flex justify-between">
                <span className="text-gray-500">Swap Type</span>
                <span className="font-medium text-gray-900 capitalize">{formData.swap_type || 'Open'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Shift</span>
                <span className="font-medium text-gray-900">
                  {myShifts.find(s => s.id === formData.shift_id)?.shift_date || 'Selected'}
                </span>
              </div>
            </>
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
            className={`flex-1 py-4 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
              selectedType === 'leave' ? 'bg-blue-500 hover:bg-blue-600' :
              selectedType === 'day_on' ? 'bg-green-500 hover:bg-green-600' :
              selectedType === 'day_off' ? 'bg-orange-500 hover:bg-orange-600' :
              'bg-purple-500 hover:bg-purple-600'
            }`}
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

  // Render: Success
  const renderSuccess = () => {
    const config = REQUEST_TYPES[selectedType];
    
    return (
      <div className="text-center space-y-6 py-8">
        <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle size={48} className="text-green-500" />
        </div>
        
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Request Submitted!</h2>
          <p className="text-gray-500">
            Your {config.label.toLowerCase()} has been submitted and is pending approval.
          </p>
        </div>
        
        <div className="bg-gray-50 rounded-xl p-4 text-left">
          <div className="flex items-center gap-2 text-gray-700">
            <Clock size={16} />
            <span className="text-sm">What happens next?</span>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Your manager will review your request and you'll receive a notification when it's approved or if more information is needed.
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
      
      {/* Progress indicator */}
      {step !== 'select' && step !== 'success' && (
        <div className="bg-white border-b border-gray-100 px-4 py-2">
          <div className="max-w-lg mx-auto flex items-center gap-2 text-sm">
            <span className={step === 'subtype' || step === 'form' || step === 'confirm' ? 'text-blue-500 font-medium' : 'text-gray-400'}>Type</span>
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
      
      {/* Main Content */}
      <main className="max-w-lg mx-auto p-4" data-testid="request-center">
        {step === 'select' && renderTypeSelection()}
        {step === 'subtype' && renderSubtypeSelection()}
        {step === 'form' && renderForm()}
        {step === 'confirm' && renderConfirmation()}
        {step === 'success' && renderSuccess()}
      </main>
    </div>
  );
};

export default RequestCenter;
