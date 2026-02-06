import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  ChevronLeft, ChevronRight, X, Clock, AlertTriangle,
  Check, UserX, Timer, Edit2, Save
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TEMPLATE_STYLES = {
  early:    { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800', label: 'Early', time: '08:00–14:00' },
  late:     { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800', label: 'Late', time: '14:00–20:00' },
  night:    { bg: 'bg-violet-50', border: 'border-violet-300', text: 'text-violet-800', label: 'Night', time: '20:00–08:00' },
  long_day: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-800', label: 'Long Day', time: '08:00–20:00' },
};

const STATUS_STYLES = {
  present:   { bg: 'bg-green-100', text: 'text-green-700', label: 'Present', icon: Check },
  late:      { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Late', icon: Timer },
  no_show:   { bg: 'bg-red-100', text: 'text-red-700', label: 'No Show', icon: UserX },
  scheduled: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Scheduled', icon: Clock },
};

const AttendanceCalendar = ({ token }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [calData, setCalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayDetail, setDayDetail] = useState(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [wtdAlerts, setWtdAlerts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ clock_in: '', clock_out: '', reason: '' });

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const [calRes, wtdRes] = await Promise.all([
        axios.get(`${API}/attendance/calendar?year=${year}&month=${month}`, { headers }),
        axios.get(`${API}/attendance/wtd-alerts?year=${year}&month=${month}`, { headers })
      ]);
      setCalData(calRes.data.days);
      setWtdAlerts(wtdRes.data.alerts || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [year, month, token]);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

  const openDayDetail = async (dateStr) => {
    setSelectedDay(dateStr);
    setDayLoading(true);
    setEditingId(null);
    try {
      const res = await axios.get(`${API}/attendance/day-detail?date=${dateStr}`, { headers });
      setDayDetail(res.data);
    } catch (err) { console.error(err); }
    finally { setDayLoading(false); }
  };

  const saveAdjustment = async (employeeId) => {
    try {
      const params = new URLSearchParams({
        employee_id: employeeId, date: selectedDay,
        clock_in: editForm.clock_in || '', clock_out: editForm.clock_out || '', reason: editForm.reason
      });
      await axios.put(`${API}/attendance/adjust?${params}`, {}, { headers });
      setEditingId(null);
      openDayDetail(selectedDay);
      fetchCalendar();
    } catch (err) { console.error(err); }
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();
  const startPad = firstDow === 0 ? 6 : firstDow - 1;
  const todayStr = today.toISOString().split('T')[0];

  if (loading) return <div className="flex justify-center py-12"><div className="frappe-spinner" /></div>;

  return (
    <div data-testid="attendance-calendar">
      {/* WTD Alerts */}
      {wtdAlerts.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg" data-testid="wtd-alerts">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-600" />
            <span className="text-sm font-semibold text-red-800">Working Time Directive Alerts ({wtdAlerts.length})</span>
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {wtdAlerts.map((a, i) => (
              <div key={i} className="text-xs text-red-700">
                <span className="font-medium">{a.employee}</span>: {a.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded"><ChevronLeft size={18} /></button>
        <h2 className="text-base font-semibold text-gray-800">{monthNames[month - 1]} {year}</h2>
        <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded"><ChevronRight size={18} /></button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
          <div key={d} className="text-center text-[11px] font-medium text-gray-500 py-1">{d}</div>
        ))}
        {Array.from({ length: startPad }, (_, i) => <div key={`pad-${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const ds = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const info = calData ? calData[ds] : null;
          const isToday = ds === todayStr;
          const scheduled = info ? info.scheduled : 0;
          const noShows = info ? info.no_show : 0;
          const lateCount = info ? info.late : 0;
          const cov = info ? info.coverage : {};

          // Coverage status: worst across all shifts
          let covStatus = 'none';
          for (const tKey of ['early', 'late', 'night']) {
            const c = cov[tKey];
            if (c && c.total > 0) {
              if (c.nurses < 2 || c.carers < 6) covStatus = 'red';
              else if (covStatus !== 'red') covStatus = c.nurses > 3 || c.carers > 8 ? 'blue' : 'green';
            }
          }
          const covBorder = covStatus === 'red' ? 'border-red-400 bg-red-50' : covStatus === 'blue' ? 'border-sky-400 bg-sky-50' : covStatus === 'green' ? 'border-green-400 bg-green-50' : 'border-gray-200';

          return (
            <button
              key={day}
              onClick={() => openDayDetail(ds)}
              className={`relative p-1.5 min-h-[70px] rounded-lg border text-left transition-all hover:shadow-sm ${covBorder} ${isToday ? 'ring-2 ring-blue-500' : ''}`}
              data-testid={`cal-day-${day}`}
            >
              <div className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>{day}</div>
              {scheduled > 0 && (
                <div className="mt-0.5 space-y-0.5">
                  <div className="text-[10px] text-gray-500">{scheduled} staff</div>
                  {lateCount > 0 && <div className="text-[10px] text-amber-600 font-medium">{lateCount} late</div>}
                  {noShows > 0 && <div className="text-[10px] text-red-600 font-medium">{noShows} no-show</div>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500">
        <span><span className="inline-block w-3 h-3 rounded border-2 border-red-400 bg-red-50 mr-1" />Below baseline</span>
        <span><span className="inline-block w-3 h-3 rounded border-2 border-green-400 bg-green-50 mr-1" />At baseline</span>
        <span><span className="inline-block w-3 h-3 rounded border-2 border-sky-400 bg-sky-50 mr-1" />Overstaffed</span>
        <span>Baseline: 2 nurses + 6 care assistants per shift</span>
      </div>

      {/* Day detail dialog */}
      {selectedDay && (
        <DayDetailDialog
          date={selectedDay}
          detail={dayDetail}
          loading={dayLoading}
          onClose={() => { setSelectedDay(null); setDayDetail(null); }}
          editingId={editingId}
          setEditingId={setEditingId}
          editForm={editForm}
          setEditForm={setEditForm}
          onSave={saveAdjustment}
        />
      )}
    </div>
  );
};

const DayDetailDialog = ({ date, detail, loading, onClose, editingId, setEditingId, editForm, setEditForm, onSave }) => {
  const dayLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="day-detail-dialog">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">{dayLabel}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {loading ? <div className="text-center py-8"><div className="frappe-spinner" /></div> : !detail ? (
            <p className="text-gray-500 text-center py-8">No data</p>
          ) : (
            Object.entries(detail.shifts).map(([tplKey, group]) => {
              const style = TEMPLATE_STYLES[tplKey] || {};
              const members = group.members || [];
              if (members.length === 0 && group.total === 0) return null;
              return (
                <div key={tplKey} className={`rounded-lg border ${style.border} ${style.bg} p-3`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${style.text}`}>{style.label}</span>
                      <span className="text-xs text-gray-500">{style.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CoverageBadge nurses={group.nurses} carers={group.carers} baseline={detail.baseline} color={group.color} />
                    </div>
                  </div>
                  {members.length === 0 ? (
                    <p className="text-xs text-gray-400">No staff scheduled</p>
                  ) : (
                    <div className="space-y-1.5">
                      {members.map(m => {
                        const ss = STATUS_STYLES[m.status] || STATUS_STYLES.scheduled;
                        const Icon = ss.icon;
                        const isEditing = editingId === m.shift_id;
                        return (
                          <div key={m.shift_id} className="flex items-center gap-2 bg-white/80 rounded-md px-2.5 py-1.5 text-xs">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${ss.bg}`}>
                              <Icon size={11} className={ss.text} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-gray-800">{m.name}</span>
                              <span className="text-gray-400 ml-1">({m.job_title})</span>
                              {m.is_agency_cover && <span className="ml-1 text-[9px] px-1 bg-orange-100 text-orange-700 rounded">AGY</span>}
                            </div>
                            {!isEditing ? (
                              <>
                                <span className="text-gray-500">{m.clock_in ? new Date(m.clock_in).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                                <span className="text-gray-400">→</span>
                                <span className="text-gray-500">{m.clock_out ? new Date(m.clock_out).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ss.bg} ${ss.text}`}>{ss.label}</span>
                                <button onClick={() => { setEditingId(m.shift_id); setEditForm({ clock_in: m.clock_in ? m.clock_in.slice(11, 16) : '', clock_out: m.clock_out ? m.clock_out.slice(11, 16) : '', reason: '' }); }}
                                  className="p-1 hover:bg-gray-100 rounded text-gray-400" title="Adjust" data-testid={`edit-att-${m.shift_id}`}>
                                  <Edit2 size={12} />
                                </button>
                              </>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <input type="time" value={editForm.clock_in} onChange={e => setEditForm(f => ({ ...f, clock_in: e.target.value }))}
                                  className="border border-gray-300 rounded px-1 py-0.5 text-[11px] w-20" />
                                <span className="text-gray-400">→</span>
                                <input type="time" value={editForm.clock_out} onChange={e => setEditForm(f => ({ ...f, clock_out: e.target.value }))}
                                  className="border border-gray-300 rounded px-1 py-0.5 text-[11px] w-20" />
                                <input type="text" value={editForm.reason} onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))}
                                  className="border border-gray-300 rounded px-1 py-0.5 text-[11px] w-28" placeholder="Reason" />
                                <button onClick={() => onSave(m.employee_id.replace(m.employee_id, (() => { const empIdField = m.employee_id; return m.name; })()) ? m.employee_id : m.employee_id)}
                                  className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600" data-testid={`save-att-${m.shift_id}`}>
                                  <Save size={12} />
                                </button>
                                <button onClick={() => setEditingId(null)} className="p-1 bg-gray-200 rounded hover:bg-gray-300">
                                  <X size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

const CoverageBadge = ({ nurses, carers, baseline, color }) => {
  const bgMap = { red: 'bg-red-100 text-red-700 border-red-300', green: 'bg-green-100 text-green-700 border-green-300', blue: 'bg-sky-100 text-sky-700 border-sky-300' };
  const cls = bgMap[color] || bgMap.green;
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${cls}`}>
      {nurses}N {carers}C
      <span className="text-gray-400 ml-1">(need {baseline.nurse}N {baseline.carer}C)</span>
    </span>
  );
};

export default AttendanceCalendar;
