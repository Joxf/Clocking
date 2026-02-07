import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  ChevronDown, ChevronUp, Check, X, Clock, AlertTriangle,
  Thermometer, FileText, ArrowLeftRight, User
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_COLORS = {
  approved: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const LeaveManagement = ({ token }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedStaff, setExpandedStaff] = useState(null);
  const [sicknessDetail, setSicknessDetail] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/leave/overview?year=${year}`, { headers });
      setData(res.data);
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

  if (loading) return <div className="flex justify-center py-12"><div className="frappe-spinner" /></div>;
  if (!data) return null;

  const staffList = data.staff || [];
  const rtwStaff = staffList.filter(s => s.rtw_needed);

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

      {/* Year selector */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">Leave & Availability — {year}</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => setYear(y => y - 1)} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">&lt;</button>
          <span className="text-sm font-medium px-2">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">&gt;</button>
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
            {staffList.map(s => {
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
                        <LeaveRequestList requests={leaveReqs} />
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
    </div>
  );
};

const LeaveRequestList = ({ requests }) => {
  if (!requests || requests.length === 0) return <p className="text-xs text-gray-400 py-2">No leave requests this year</p>;
  const sorted = [...requests].sort((a, b) => (b.start_date > a.start_date ? 1 : -1));
  return (
    <div className="space-y-1 max-h-40 overflow-y-auto">
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
            {reason && <span className="text-gray-400 truncate max-w-[200px]">{reason}</span>}
          </div>
        );
      })}
    </div>
  );
};

const SicknessModal = ({ data, onClose, onMarkRtw }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="sickness-modal">
    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b">
        <h3 className="font-semibold text-gray-900">Sickness Trends</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
      </div>
      <div className="overflow-y-auto px-5 py-4 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-700">{data.total_episodes}</div>
            <div className="text-xs text-red-500">Episodes</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-amber-700">{data.total_days}</div>
            <div className="text-xs text-amber-500">Total Days</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-700">{data.bradford_factor}</div>
            <div className="text-xs text-purple-500">Bradford Factor</div>
          </div>
        </div>
        {/* Episodes */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Episodes</h4>
          <div className="space-y-2">
            {data.episodes.map(ep => {
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
            {data.episodes.length === 0 && <p className="text-xs text-gray-400">No sickness episodes recorded</p>}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default LeaveManagement;
