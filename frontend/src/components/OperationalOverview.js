import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  ChevronLeft, ChevronRight, AlertTriangle, Plus, X,
  Trash2, StickyNote, Activity
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TPL_LABELS = { early: 'E', late: 'L', night: 'N', long_day: 'LD' };
const TPL_COLORS = { early: 'amber', late: 'blue', night: 'violet', long_day: 'emerald' };

const OperationalOverview = ({ token }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [heatmap, setHeatmap] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notesModal, setNotesModal] = useState(null); // { employee_id, name }
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [hRes, aRes] = await Promise.all([
        axios.get(`${API}/operational/heatmap?year=${year}&month=${month}`, { headers }),
        axios.get(`${API}/operational/under-coverage`, { headers })
      ]);
      setHeatmap(hRes.data.heatmap);
      setAlerts(aRes.data.alerts || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [year, month, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openNotes = async (empId, name) => {
    setNotesModal({ employee_id: empId, name });
    try {
      const res = await axios.get(`${API}/manager/notes/${empId}`, { headers });
      setNotes(res.data.notes || []);
    } catch (err) { console.error(err); }
  };

  const addNote = async () => {
    if (!newNote.trim() || !notesModal) return;
    try {
      const params = new URLSearchParams({ content: newNote });
      await axios.post(`${API}/manager/notes/${notesModal.employee_id}?${params}`, {}, { headers });
      setNewNote('');
      const res = await axios.get(`${API}/manager/notes/${notesModal.employee_id}`, { headers });
      setNotes(res.data.notes || []);
    } catch (err) { console.error(err); }
  };

  const deleteNote = async (noteId) => {
    try {
      await axios.delete(`${API}/manager/notes/${noteId}`, { headers });
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch (err) { console.error(err); }
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr = today.toISOString().split('T')[0];

  if (loading) return <div className="flex justify-center py-12"><div className="frappe-spinner" /></div>;

  return (
    <div data-testid="operational-overview">
      {/* Under-coverage alerts */}
      {alerts.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg" data-testid="coverage-alerts">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-600" />
            <span className="text-sm font-semibold text-red-800">Under-Coverage Alerts — Next 30 Days ({alerts.length})</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {alerts.map((a, i) => (
              <div key={i} className="text-xs text-red-700 flex items-center gap-2">
                <span className="font-medium min-w-[80px]">{a.date}</span>
                <span className="min-w-[60px]">{a.shift} {a.time}</span>
                <span>
                  <span className={a.nurses < a.nurses_needed ? 'text-red-600 font-bold' : ''}>{a.nurses}/{a.nurses_needed}N</span>
                  {' '}
                  <span className={a.carers < a.carers_needed ? 'text-red-600 font-bold' : ''}>{a.carers}/{a.carers_needed}C</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heatmap */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-gray-600" />
            <h2 className="text-base font-semibold text-gray-800">Staffing Heatmap</h2>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft size={16} /></button>
            <span className="text-sm font-medium min-w-[120px] text-center">{monthNames[month - 1]} {year}</span>
            <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded"><ChevronRight size={16} /></button>
          </div>
        </div>

        {heatmap && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-2 py-1.5 text-left font-medium text-gray-500 min-w-[50px]">Shift</th>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const ds = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isToday = ds === todayStr;
                    const isWeekend = [0, 6].includes(new Date(year, month - 1, day).getDay());
                    return (
                      <th key={day} className={`px-0 py-1.5 text-center font-medium min-w-[28px] ${isToday ? 'bg-blue-100 text-blue-700' : isWeekend ? 'text-gray-400' : 'text-gray-500'}`}>
                        {day}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {['early', 'late', 'night', 'long_day'].map(tpl => (
                  <tr key={tpl} className="border-t border-gray-100">
                    <td className="px-2 py-1 font-medium text-gray-600">{TPL_LABELS[tpl]}</td>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const day = i + 1;
                      const ds = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const dayData = heatmap[ds];
                      const shiftData = dayData ? dayData[tpl] : null;
                      const count = shiftData ? shiftData.total : 0;
                      const ok = shiftData ? shiftData.baseline_met : true;
                      const isToday = ds === todayStr;

                      let bgClass = 'bg-gray-50';
                      if (count > 0) {
                        if (!ok) bgClass = 'bg-red-200';
                        else if (count >= 8) bgClass = 'bg-green-300';
                        else if (count >= 5) bgClass = 'bg-green-200';
                        else bgClass = 'bg-green-100';
                      }

                      return (
                        <td key={day} className={`text-center py-1 ${bgClass} ${isToday ? 'ring-1 ring-inset ring-blue-500' : ''}`}
                            title={`${ds} ${TPL_LABELS[tpl]}: ${count} staff${!ok ? ' (BELOW BASELINE)' : ''}`}>
                          {count > 0 ? <span className={`font-bold ${!ok ? 'text-red-700' : 'text-green-800'}`}>{count}</span> : <span className="text-gray-300">-</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-500">
          <span><span className="inline-block w-3 h-3 bg-red-200 rounded mr-1" />Below baseline</span>
          <span><span className="inline-block w-3 h-3 bg-green-100 rounded mr-1" />1-4 staff</span>
          <span><span className="inline-block w-3 h-3 bg-green-200 rounded mr-1" />5-7 staff</span>
          <span><span className="inline-block w-3 h-3 bg-green-300 rounded mr-1" />8+ staff</span>
        </div>
      </div>

      {/* Notes modal */}
      {notesModal && (
        <NotesModal
          name={notesModal.name}
          notes={notes}
          newNote={newNote}
          setNewNote={setNewNote}
          onAdd={addNote}
          onDelete={deleteNote}
          onClose={() => { setNotesModal(null); setNotes([]); setNewNote(''); }}
        />
      )}
    </div>
  );
};

const NotesModal = ({ name, notes, newNote, setNewNote, onAdd, onDelete, onClose }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="notes-modal">
    <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b">
        <div className="flex items-center gap-2">
          <StickyNote size={16} className="text-gray-600" />
          <h3 className="font-semibold text-gray-900">Notes — {name}</h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
        {notes.length === 0 && <p className="text-xs text-gray-400 py-4 text-center">No notes yet</p>}
        {notes.map(n => (
          <div key={n.id} className="bg-gray-50 rounded-lg p-3 text-xs group">
            <div className="flex items-start justify-between gap-2">
              <p className="text-gray-800 whitespace-pre-wrap">{n.content}</p>
              <button onClick={() => onDelete(n.id)} className="p-0.5 hover:bg-red-100 rounded text-gray-300 group-hover:text-red-500 flex-shrink-0">
                <Trash2 size={12} />
              </button>
            </div>
            <div className="text-[10px] text-gray-400 mt-1.5">
              {n.created_by_name} — {new Date(n.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t px-5 py-3">
        <div className="flex gap-2">
          <textarea
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            placeholder="Add a private note..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none h-16 focus:ring-1 focus:ring-blue-300 focus:outline-none"
            data-testid="note-input"
          />
          <button onClick={onAdd} disabled={!newNote.trim()}
            className="px-3 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 disabled:opacity-50"
            data-testid="add-note-btn">
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  </div>
);

export { OperationalOverview, NotesModal };
export default OperationalOverview;
