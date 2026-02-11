import React, { useState, memo } from 'react';
import axios from 'axios';
import {
  Users,
  UserCheck,
  MessageSquare,
  AlertCircle
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Leave Request Modal - memoized to prevent re-renders
export const LeaveRequestModal = memo(({ token, onClose, onSuccess }) => {
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
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  // Stop propagation to prevent parent events
  const handleContainerClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={handleContainerClick}>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Request Leave</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
              <select
                value={formData.leave_type}
                onChange={(e) => setFormData(prev => ({...prev, leave_type: e.target.value}))}
                className="frappe-input"
              >
                <option value="annual">Annual Leave</option>
                <option value="unpaid">Unpaid Leave</option>
                <option value="compassionate">Compassionate Leave</option>
                <option value="maternity">Maternity Leave</option>
                <option value="paternity">Paternity Leave</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input 
                  type="date" 
                  value={formData.start_date} 
                  onChange={(e) => setFormData(prev => ({...prev, start_date: e.target.value}))} 
                  className="frappe-input" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input 
                  type="date" 
                  value={formData.end_date} 
                  onChange={(e) => setFormData(prev => ({...prev, end_date: e.target.value}))} 
                  className="frappe-input" 
                  required 
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
              <textarea 
                value={formData.reason} 
                onChange={(e) => setFormData(prev => ({...prev, reason: e.target.value}))} 
                className="frappe-input" 
                rows={3} 
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} className="frappe-btn frappe-btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={submitting} className="frappe-btn frappe-btn-primary flex-1">
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

LeaveRequestModal.displayName = 'LeaveRequestModal';

// Day Request Modal - memoized
export const DayRequestModal = memo(({ token, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    request_type: 'day_off',
    requested_date: '',
    reason: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post(`${API}/day-requests`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleContainerClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={handleContainerClick}>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Request Day On/Off</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Request Type</label>
              <select 
                value={formData.request_type} 
                onChange={(e) => setFormData(prev => ({...prev, request_type: e.target.value}))} 
                className="frappe-input"
              >
                <option value="day_off">Request Day Off</option>
                <option value="day_on">Request Day On (Extra Shift)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input 
                type="date" 
                value={formData.requested_date} 
                onChange={(e) => setFormData(prev => ({...prev, requested_date: e.target.value}))} 
                className="frappe-input" 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea 
                value={formData.reason} 
                onChange={(e) => setFormData(prev => ({...prev, reason: e.target.value}))} 
                className="frappe-input" 
                rows={3} 
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} className="frappe-btn frappe-btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={submitting} className="frappe-btn frappe-btn-primary flex-1">
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

DayRequestModal.displayName = 'DayRequestModal';

// Shift Swap Modal - memoized
export const ShiftSwapModal = memo(({ token, selectedShift, colleagues, onClose, onSuccess, getJobTitleDisplay, formatDate }) => {
  const [swapType, setSwapType] = useState('open');
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
      
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create swap request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleContainerClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={handleContainerClick}>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Request Shift Swap</h2>
        
        {selectedShift && (
          <div className="p-4 bg-blue-50 rounded-lg mb-4">
            <p className="text-sm text-blue-700"><strong>Shift:</strong> {formatDate(selectedShift.shift_date)}</p>
            <p className="text-sm text-blue-700"><strong>Time:</strong> {selectedShift.start_time} - {selectedShift.end_time}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
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

          {swapType === 'manager' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Message to Manager</label>
              <textarea value={messageToManager} onChange={(e) => setMessageToManager(e.target.value)} className="frappe-input" rows={3} placeholder="Explain your situation and what help you need..." required />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for swap</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="frappe-input" rows={2} placeholder="Why do you need to swap this shift?" />
          </div>

          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4 text-sm text-yellow-700">
            <AlertCircle size={16} className="inline mr-1" />
            All shift swaps require manager approval before they are finalized.
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="frappe-btn frappe-btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={submitting} className="frappe-btn frappe-btn-primary flex-1">
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

ShiftSwapModal.displayName = 'ShiftSwapModal';
