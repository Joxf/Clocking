import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  ChevronDown, ChevronUp, Check, X, Clock, AlertTriangle,
  Thermometer, FileText, ArrowLeftRight, User, Plus, Edit2, Trash2,
  Calendar, Save, Loader2
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_COLORS = {
  approved: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const LEAVE_TYPES = [
  { value: 'annual', label: 'Annual Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'unpaid', label: 'Unpaid Leave' },
  { value: 'compassionate', label: 'Compassionate Leave' },
  { value: 'maternity', label: 'Maternity Leave' },
  { value: 'paternity', label: 'Paternity Leave' },
  { value: 'other', label: 'Other' },
];

const LeaveManagement = ({ token }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedStaff, setExpandedStaff] = useState(null);
  const [sicknessDetail, setSicknessDetail] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [showAddModal, setShowAddModal] = useState(null); // staff object
  const [showEditModal, setShowEditModal] = useState(null); // {staff, request}
  const [deleteConfirm, setDeleteConfirm] = useState(null); // request object
  const [staffList, setStaffList] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, staffRes] = await Promise.all([
        axios.get(`${API}/leave/overview?year=${year}`, { headers }),
        axios.get(`${API}/employees`, { headers })
      ]);
      setData(overviewRes.data);
      setStaffList(staffRes.data.employees || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [year, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openSickness = async (internalId) => {
    try {
      const res = await axios.get(`${API}/leave/sickness-trends/${internalId}`, { headers });
      setSicknessDetail(res.data);
    } catch (err) { console.error(err); }
  };

  const markRtw = async (leaveId) => {
    try {
      await axios.put(`${API}/leave/mark-rtw/${leaveId}?notes=RTW completed`, {}, { headers });
      fetchData();
      if (sicknessDetail) openSickness(sicknessDetail.employee_id);
    } catch (err) { console.error(err); }
  };

  const handleDeleteLeave = async (requestId) => {
    try {
      await axios.delete(`${API}/leave/delete/${requestId}`, { headers });
      setDeleteConfirm(null);
      fetchData();
    } catch (err) { 
      console.error(err);
      alert('Failed to delete leave request');
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="frappe-spinner" /></div>;
  if (!data) return null;

  const leaveStaffList = data.staff || [];
  const rtwStaff = leaveStaffList.filter(s => s.rtw_needed);

  return (
    <div data-testid="leave-management">
      {/* RTW Reminders */}
      {rtwStaff.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg" data-testid="rtw-alerts">
          <div className="flex items-center gap-2 mb-2">
            <Thermometer size={16} className="text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">Return to Work Reminders ({rtwStaff.length})</span>
          </div>
          {rtwStaff.map(s => {
            const sName = s.name;
            const sId = s.internal_id;
            return (
              <div key={sId} className="text-xs text-amber-700 py-0.5">
                <span className="font-medium">{sName}</span> — recent sick leave ended, RTW meeting needed
              </div>
            );
          })}
        </div>
      )}

      {/* Header with Add button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">Leave & Availability — {year}</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button onClick={() => setYear(y => y - 1)} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">&lt;</button>
            <span className="text-sm font-medium px-2">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">&gt;</button>
          </div>
        </div>
      </div>

      {/* Staff leave table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Staff Member</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Annual Used</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Remaining</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Pending</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Sick Days</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Sick Eps</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">RTW</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leaveStaffList.map(s => {
              const isExpanded = expandedStaff === s.internal_id;
              const entitlement = s.annual_entitlement || 28;
              const remaining = s.annual_remaining;
              const balancePct = entitlement > 0 ? (remaining / entitlement) * 100 : 0;
              const balanceColor = balancePct < 20 ? 'text-red-600' : balancePct < 50 ? 'text-amber-600' : 'text-green-600';
              const initials = s.name.split(' ').map(n => n[0]).join('');
              const pendingCount = s.pending_requests;
              const sickDays = s.sick_days;
              const sickEps = s.sick_episodes;
              const rtwNeeded = s.rtw_needed;
              const leaveReqs = s.leave_requests;
              return (
                <React.Fragment key={s.internal_id}>
                  <tr className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-[9px] font-bold text-white">
                          {initials}
                        </div>
                        <div>
                          <div className="font-medium text-gray-800">{s.name}</div>
                          <div className="text-[10px] text-gray-400">{s.job_title}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center font-medium">{s.annual_used} / {entitlement}</td>
                    <td className={`px-3 py-2 text-center font-bold ${balanceColor}`}>{remaining}</td>
                    <td className="px-3 py-2 text-center">
                      {pendingCount > 0 ? (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">{pendingCount}</span>
                      ) : <span className="text-gray-300">0</span>}
                    </td>
                    <td className="px-3 py-2 text-center">{sickDays > 0 ? <span className="text-red-600 font-medium">{sickDays}</span> : <span className="text-gray-300">0</span>}</td>
                    <td className="px-3 py-2 text-center">{sickEps > 0 ? sickEps : <span className="text-gray-300">0</span>}</td>
                    <td className="px-3 py-2 text-center">
                      {rtwNeeded && <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-[10px] font-medium">Needed</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={() => setShowAddModal(s)}
                          className="p-1 hover:bg-blue-100 rounded text-blue-600" 
                          title="Add leave"
                          data-testid={`add-leave-${s.employee_id}`}
                        >
                          <Plus size={14} />
                        </button>
                        <button onClick={() => setExpandedStaff(isExpanded ? null : s.internal_id)}
                          className="p-1 hover:bg-gray-100 rounded" title="View requests">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        {sickEps > 0 && (
                          <button onClick={() => openSickness(s.internal_id)}
                            className="p-1 hover:bg-gray-100 rounded text-red-500" title="Sickness trends"
                            data-testid={`sickness-btn-${s.employee_id}`}>
                            <Thermometer size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="px-3 py-2 bg-gray-50">
                        <LeaveRequestList 
                          requests={leaveReqs} 
                          staff={s}
                          onEdit={(req) => setShowEditModal({ staff: s, request: req })}
                          onDelete={(req) => setDeleteConfirm(req)}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sickness detail modal */}
      {sicknessDetail && (
        <SicknessModal data={sicknessDetail} onClose={() => setSicknessDetail(null)} onMarkRtw={markRtw} />
      )}

      {/* Add Leave Modal */}
      {showAddModal && (
        <AddEditLeaveModal
          mode="add"
          staff={showAddModal}
          token={token}
          onClose={() => setShowAddModal(null)}
          onSuccess={() => { setShowAddModal(null); fetchData(); }}
        />
      )}

      {/* Edit Leave Modal */}
      {showEditModal && (
        <AddEditLeaveModal
          mode="edit"
          staff={showEditModal.staff}
          request={showEditModal.request}
          token={token}
          onClose={() => setShowEditModal(null)}
          onSuccess={() => { setShowEditModal(null); fetchData(); }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <DeleteConfirmModal
          request={deleteConfirm}
          onConfirm={() => handleDeleteLeave(deleteConfirm.id)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
};

const LeaveRequestList = ({ requests, staff, onEdit, onDelete }) => {
  if (!requests || requests.length === 0) return (
    <div className="flex items-center justify-between py-2">
      <p className="text-xs text-gray-400">No leave requests this year</p>
    </div>
  );
  const sorted = [...requests].sort((a, b) => (b.start_date > a.start_date ? 1 : -1));
  return (
    <div className="space-y-1 max-h-60 overflow-y-auto">
      {sorted.map(r => {
        const reqId = r.id;
        const reqStatus = r.status;
        const reqType = r.leave_type;
        const startD = r.start_date;
        const endD = r.end_date;
        const reason = r.reason;
        const statusCls = STATUS_COLORS[reqStatus] || STATUS_COLORS.pending;
        return (
          <div key={reqId} className="flex items-center gap-3 text-xs bg-white rounded px-2 py-1.5 border border-gray-100">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusCls}`}>{reqStatus}</span>
            <span className="font-medium text-gray-700 capitalize">{reqType}</span>
            <span className="text-gray-500">{startD} → {endD}</span>
            {reason && <span className="text-gray-400 truncate max-w-[150px]">{reason}</span>}
            <div className="ml-auto flex items-center gap-1">
              <button 
                onClick={() => onEdit(r)}
                className="p-1 hover:bg-blue-100 rounded text-blue-600"
                title="Edit leave"
                data-testid={`edit-leave-${reqId}`}
              >
                <Edit2 size={12} />
              </button>
              <button 
                onClick={() => onDelete(r)}
                className="p-1 hover:bg-red-100 rounded text-red-600"
                title="Delete leave"
                data-testid={`delete-leave-${reqId}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const AddEditLeaveModal = ({ mode, staff, request, token, onClose, onSuccess }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [formData, setFormData] = useState({
    leave_type: request?.leave_type || 'annual',
    start_date: request?.start_date || '',
    end_date: request?.end_date || '',
    reason: request?.reason || '',
    status: request?.status || 'approved'
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    
    try {
      if (mode === 'add') {
        await axios.post(`${API}/leave/create-for-staff`, {
          employee_id: staff.internal_id,
          ...formData
        }, { headers });
      } else {
        await axios.put(`${API}/leave/update/${request.id}`, formData, { headers });
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save leave request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="leave-modal">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-blue-600" />
            <h3 className="font-semibold text-gray-900">
              {mode === 'add' ? 'Add Leave' : 'Edit Leave'} for {staff.name}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
            <select
              value={formData.leave_type}
              onChange={(e) => setFormData({...formData, leave_type: e.target.value})}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              data-testid="leave-type-select"
            >
              {LEAVE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                data-testid="leave-start-date"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                min={formData.start_date}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                data-testid="leave-end-date"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({...formData, status: e.target.value})}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              data-testid="leave-status-select"
            >
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({...formData, reason: e.target.value})}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={2}
              placeholder="Add notes or reason..."
              data-testid="leave-reason"
            />
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}
          
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formData.start_date || !formData.end_date}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="save-leave-btn"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={14} />
                  {mode === 'add' ? 'Add Leave' : 'Save Changes'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteConfirmModal = ({ request, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="delete-confirm-modal">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 size={20} className="text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Delete Leave Request?</h3>
            <p className="text-sm text-gray-500">This action cannot be undone</p>
          </div>
        </div>
        
        <div className="p-3 bg-gray-50 rounded-lg mb-4 text-sm">
          <div className="flex justify-between mb-1">
            <span className="text-gray-500">Type:</span>
            <span className="font-medium text-gray-900 capitalize">{request.leave_type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Dates:</span>
            <span className="font-medium text-gray-900">{request.start_date} → {request.end_date}</span>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
            data-testid="confirm-delete-btn"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const SicknessModal = ({ data, onClose, onMarkRtw }) => {
  const totalEps = data.total_episodes;
  const totalDays = data.total_days;
  const bradford = data.bradford_factor;
  const episodes = data.episodes || [];
  return (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="sickness-modal">
    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b">
        <h3 className="font-semibold text-gray-900">Sickness Trends</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
      </div>
      <div className="overflow-y-auto px-5 py-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-700">{totalEps}</div>
            <div className="text-xs text-red-500">Episodes</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-amber-700">{totalDays}</div>
            <div className="text-xs text-amber-500">Total Days</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-700">{bradford}</div>
            <div className="text-xs text-purple-500">Bradford Factor</div>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Episodes</h4>
          <div className="space-y-2">
            {episodes.map(ep => {
              const epId = ep.id;
              const epStart = ep.start_date;
              const epEnd = ep.end_date;
              const epDays = ep.days;
              const epReason = ep.reason;
              const hasSickNote = ep.sick_note;
              const rtwDone = ep.rtw_completed;
              return (
                <div key={epId} className="flex items-center gap-3 bg-gray-50 rounded-lg p-2.5 text-xs">
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">{epStart} → {epEnd} ({epDays} days)</div>
                    {epReason && <div className="text-gray-500 mt-0.5">{epReason}</div>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {hasSickNote && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">Sick Note</span>}
                    {rtwDone ? (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px]">RTW Done</span>
                    ) : (
                      <button onClick={() => onMarkRtw(epId)} className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] hover:bg-amber-200" data-testid={`rtw-${epId}`}>
                        Mark RTW
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {episodes.length === 0 && <p className="text-xs text-gray-400">No sickness episodes recorded</p>}
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

export default LeaveManagement;
