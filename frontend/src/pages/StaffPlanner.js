import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
  ChevronLeft, ChevronRight, Users, Clock, AlertTriangle,
  Plus, X, GripVertical, Filter, Eye, EyeOff, BarChart3, ArrowLeft,
  Settings, Shield, Info, Save, Trash2, CheckSquare, Square
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TEMPLATE_HOURS = { early: 6, late: 6, night: 12, long_day: 12 };

const TEMPLATE_COLORS = {
  early:    { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-800', dot: 'bg-amber-400', label: 'E', darkBg: 'dark:bg-amber-900/40', darkBorder: 'dark:border-amber-600', darkText: 'dark:text-amber-300' },
  late:     { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800', dot: 'bg-blue-400', label: 'L', darkBg: 'dark:bg-blue-900/40', darkBorder: 'dark:border-blue-600', darkText: 'dark:text-blue-300' },
  night:    { bg: 'bg-violet-100', border: 'border-violet-400', text: 'text-violet-800', dot: 'bg-violet-400', label: 'N', darkBg: 'dark:bg-violet-900/40', darkBorder: 'dark:border-violet-600', darkText: 'dark:text-violet-300' },
  long_day: { bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-emerald-800', dot: 'bg-emerald-400', label: 'LD', darkBg: 'dark:bg-emerald-900/40', darkBorder: 'dark:border-emerald-600', darkText: 'dark:text-emerald-300' },
};

const JOB_LABELS = {
  nurse: 'Nurse', senior_carer: 'Sr Carer', carer: 'Carer',
  activities: 'Activities', kitchen: 'Kitchen', maintenance: 'Maint.',
  care_manager: 'Manager', administrator: 'Admin',
};

const SHIFT_PREF_LABELS = {
  nights_only: 'Nights Only',
  weekends_only: 'Weekends Only',
  weekdays_only: 'Weekdays Only',
  earlies_only: 'Earlies Only',
  lates_only: 'Lates Only',
  no_nights: 'No Nights',
  flexible: 'Flexible',
};

const EMPLOYMENT_TYPE_LABELS = {
  permanent: 'Permanent',
  agency: 'Agency',
  bank: 'Bank',
};

// Rule status indicator component
const RuleStatusBadge = ({ mode, label }) => {
  if (mode === 'disabled') return null;
  const styles = mode === 'hard' 
    ? 'bg-red-100 text-red-700 border-red-200' 
    : 'bg-yellow-100 text-yellow-700 border-yellow-200';
  return (
    <span className={`px-1.5 py-0.5 text-[9px] rounded border ${styles}`} title={`${label}: ${mode === 'hard' ? 'Hard Block' : 'Soft Warning'}`}>
      {mode === 'hard' ? 'H' : 'S'}
    </span>
  );
};

// Employee Tooltip Component
const EmployeeTooltip = ({ employee, children }) => {
  const [show, setShow] = useState(false);
  const shiftPrefs = employee.shift_preferences || [];
  
  return (
    <div className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute left-full ml-2 top-0 z-50 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 text-xs">
          <div className="font-semibold text-gray-900 dark:text-white mb-2">{employee.first_name} {employee.last_name}</div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Employment:</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                employee.employment_type === 'agency' 
                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' 
                  : employee.employment_type === 'bank'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                  : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
              }`}>
                {EMPLOYMENT_TYPE_LABELS[employee.employment_type] || employee.employment_type}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Contract Hours:</span>
              <span className="font-medium text-gray-900 dark:text-white">{employee.contract_hours || 36}h/week</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400 block mb-1">Shift Preferences:</span>
              {shiftPrefs.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {shiftPrefs.map((pref, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded text-[10px]">
                      {SHIFT_PREF_LABELS[pref] || pref}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-gray-400 dark:text-gray-500 italic">Flexible (No preferences)</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Unsaved changes dialog
const UnsavedChangesDialog = ({ onSave, onDiscard, onCancel }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="unsaved-changes-dialog">
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Unsaved Changes</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">You have unsaved changes to the schedule</p>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
        Would you like to save your changes before leaving?
      </p>
      <div className="flex gap-3">
        <button
          onClick={onDiscard}
          className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Discard
        </button>
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Save Changes
        </button>
      </div>
    </div>
  </div>
);

const StaffPlanner = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const headers = { Authorization: `Bearer ${token}` };

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [plannerData, setPlannerData] = useState(null);
  const [controlPrefs, setControlPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState('on_duty');
  const [filterRole, setFilterRole] = useState('all');
  const [showRulesPanel, setShowRulesPanel] = useState(false);
  const [warningModal, setWarningModal] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState('early');
  const [dragData, setDragData] = useState(null);
  
  // Local changes tracking (batch mode)
  const [localShifts, setLocalShifts] = useState([]);
  const [pendingAdditions, setPendingAdditions] = useState([]);
  const [pendingDeletions, setPendingDeletions] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Multi-select
  const [selectedShiftIds, setSelectedShiftIds] = useState(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  
  // Unsaved changes dialog
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // Track if we have unsaved changes
  useEffect(() => {
    const changed = pendingAdditions.length > 0 || pendingDeletions.length > 0;
    setHasChanges(changed);
  }, [pendingAdditions, pendingDeletions]);

  // Handle navigation blocking
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  const fetchPlanner = useCallback(async () => {
    setLoading(true);
    try {
      const [plannerRes, prefsRes] = await Promise.all([
        axios.get(`${API}/planner/monthly?year=${year}&month=${month}`, { headers }),
        axios.get(`${API}/control-preferences`, { headers })
      ]);
      setPlannerData(plannerRes.data);
      setLocalShifts(plannerRes.data.shifts);
      setControlPrefs(prefsRes.data.preferences);
      // Reset pending changes
      setPendingAdditions([]);
      setPendingDeletions([]);
      setSelectedShiftIds(new Set());
    } catch (err) {
      console.error('Failed to fetch planner:', err);
    } finally {
      setLoading(false);
    }
  }, [year, month, token]);

  useEffect(() => { fetchPlanner(); }, [fetchPlanner]);

  const handleNavigation = (path) => {
    if (hasChanges) {
      setPendingNavigation(path);
      setShowUnsavedDialog(true);
    } else {
      navigate(path);
    }
  };

  const handleMonthChange = (direction) => {
    if (hasChanges) {
      setPendingNavigation({ type: 'month', direction });
      setShowUnsavedDialog(true);
    } else {
      if (direction === 'prev') {
        if (month === 1) { setMonth(12); setYear(y => y - 1); }
        else setMonth(m => m - 1);
      } else {
        if (month === 12) { setMonth(1); setYear(y => y + 1); }
        else setMonth(m => m + 1);
      }
    }
  };

  const getDaysInMonth = () => new Date(year, month, 0).getDate();

  // Local shift management (batch mode)
  const addShiftLocally = (employeeId, date, template) => {
    // Check shift preferences
    const employee = plannerData?.staff.find(e => e.id === employeeId);
    const prefs = employee?.shift_preferences || [];
    
    // Validate against preferences (soft warning only)
    let prefWarning = null;
    if (prefs.length > 0 && !prefs.includes('flexible')) {
      const dayOfWeek = new Date(date).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      if (template === 'night' && prefs.includes('no_nights')) {
        prefWarning = `${employee.first_name} prefers no night shifts`;
      } else if (prefs.includes('nights_only') && template !== 'night') {
        prefWarning = `${employee.first_name} prefers night shifts only`;
      } else if (prefs.includes('earlies_only') && template !== 'early') {
        prefWarning = `${employee.first_name} prefers early shifts only`;
      } else if (prefs.includes('lates_only') && template !== 'late') {
        prefWarning = `${employee.first_name} prefers late shifts only`;
      } else if (prefs.includes('weekends_only') && !isWeekend) {
        prefWarning = `${employee.first_name} prefers weekends only`;
      } else if (prefs.includes('weekdays_only') && isWeekend) {
        prefWarning = `${employee.first_name} prefers weekdays only`;
      }
    }
    
    if (prefWarning) {
      // Show a toast/notification but still allow
      console.warn(prefWarning);
    }
    
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newShift = {
      id: tempId,
      employee_id: employeeId,
      shift_date: date,
      template: template,
      start_time: plannerData?.templates[template]?.start || '07:00',
      end_time: plannerData?.templates[template]?.end || '13:00',
      status: 'scheduled',
      is_temp: true
    };
    
    setLocalShifts(prev => [...prev, newShift]);
    setPendingAdditions(prev => [...prev, newShift]);
  };

  const removeShiftLocally = (shiftId) => {
    const shift = localShifts.find(s => s.id === shiftId);
    if (!shift) return;
    
    if (shift.is_temp) {
      // Remove from local and pending additions
      setLocalShifts(prev => prev.filter(s => s.id !== shiftId));
      setPendingAdditions(prev => prev.filter(s => s.id !== shiftId));
    } else {
      // Mark for deletion
      setLocalShifts(prev => prev.filter(s => s.id !== shiftId));
      setPendingDeletions(prev => [...prev, shiftId]);
    }
    
    // Remove from selection
    setSelectedShiftIds(prev => {
      const next = new Set(prev);
      next.delete(shiftId);
      return next;
    });
  };

  const removeSelectedShifts = () => {
    selectedShiftIds.forEach(shiftId => {
      removeShiftLocally(shiftId);
    });
    setSelectedShiftIds(new Set());
  };

  const toggleShiftSelection = (shiftId) => {
    setSelectedShiftIds(prev => {
      const next = new Set(prev);
      if (next.has(shiftId)) {
        next.delete(shiftId);
      } else {
        next.add(shiftId);
      }
      return next;
    });
  };

  const saveAllChanges = async () => {
    setSaving(true);
    try {
      // Process deletions
      for (const shiftId of pendingDeletions) {
        await axios.delete(`${API}/planner/unassign/${shiftId}`, { headers });
      }
      
      // Process additions
      for (const shift of pendingAdditions) {
        await axios.post(`${API}/planner/assign`, {
          employee_id: shift.employee_id,
          shift_date: shift.shift_date,
          template: shift.template,
          force: true
        }, { headers });
      }
      
      // Refresh data
      await fetchPlanner();
    } catch (err) {
      console.error('Failed to save changes:', err);
      alert('Failed to save some changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    setLocalShifts(plannerData?.shifts || []);
    setPendingAdditions([]);
    setPendingDeletions([]);
    setSelectedShiftIds(new Set());
  };

  const handleUnsavedDialogSave = async () => {
    await saveAllChanges();
    setShowUnsavedDialog(false);
    if (pendingNavigation) {
      if (typeof pendingNavigation === 'string') {
        navigate(pendingNavigation);
      } else if (pendingNavigation.type === 'month') {
        if (pendingNavigation.direction === 'prev') {
          if (month === 1) { setMonth(12); setYear(y => y - 1); }
          else setMonth(m => m - 1);
        } else {
          if (month === 12) { setMonth(1); setYear(y => y + 1); }
          else setMonth(m => m + 1);
        }
      }
      setPendingNavigation(null);
    }
  };

  const handleUnsavedDialogDiscard = () => {
    discardChanges();
    setShowUnsavedDialog(false);
    if (pendingNavigation) {
      if (typeof pendingNavigation === 'string') {
        navigate(pendingNavigation);
      } else if (pendingNavigation.type === 'month') {
        if (pendingNavigation.direction === 'prev') {
          if (month === 1) { setMonth(12); setYear(y => y - 1); }
          else setMonth(m => m - 1);
        } else {
          if (month === 12) { setMonth(1); setYear(y => y + 1); }
          else setMonth(m => m + 1);
        }
      }
      setPendingNavigation(null);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, shiftId, empId) => {
    setDragData({ shiftId, empId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetEmpId, targetDate) => {
    e.preventDefault();
    if (!dragData) return;
    
    // Move locally
    const shift = localShifts.find(s => s.id === dragData.shiftId);
    if (shift) {
      removeShiftLocally(dragData.shiftId);
      addShiftLocally(targetEmpId, targetDate, shift.template);
    }
    setDragData(null);
  };

  const handleCellClick = (empId, dateStr, e) => {
    if (isSelecting) return;
    const existing = getShiftForCell(empId, dateStr);
    if (!existing) {
      addShiftLocally(empId, dateStr, selectedTemplate);
    }
  };

  const getShiftForCell = (empId, dateStr) => {
    return localShifts.find(s => s.employee_id === empId && s.shift_date === dateStr);
  };

  const isOnLeave = (empId, dateStr) => {
    if (!plannerData) return false;
    return plannerData.leave.some(l =>
      l.employee_id === empId && dateStr >= l.start_date && dateStr <= l.end_date
    );
  };

  const filteredStaff = plannerData ? plannerData.staff.filter(emp => {
    if (filterRole === 'all') return true;
    if (filterRole === 'agency') return emp.employment_type === 'agency';
    return emp.job_title === filterRole;
  }) : [];

  const daysInMonth = getDaysInMonth();
  const todayStr = today.toISOString().split('T')[0];

  const buildColumns = () => {
    const cols = [];
    const weeks = [];
    let currentWeek = { days: [], startDay: null };
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dow = new Date(year, month - 1, day).getDay();
      if (dow === 1 && currentWeek.days.length > 0) {
        weeks.push(currentWeek);
        cols.push({ type: 'week', weekIndex: weeks.length - 1 });
        currentWeek = { days: [], startDay: day };
      }
      if (currentWeek.startDay === null) currentWeek.startDay = day;
      currentWeek.days.push({ day, dateStr });
      cols.push({ type: 'day', day, dateStr });
    }
    if (currentWeek.days.length > 0) {
      weeks.push(currentWeek);
      cols.push({ type: 'week', weekIndex: weeks.length - 1 });
    }
    return { cols, weeks };
  };

  const { cols, weeks } = buildColumns();

  const getWeeklyHours = (empId, weekDays) => {
    let total = 0;
    for (const wd of weekDays) {
      const shift = localShifts.find(s => s.employee_id === empId && s.shift_date === wd.dateStr);
      if (shift) total += TEMPLATE_HOURS[shift.template] || 0;
    }
    return total;
  };

  const getMonthlyHours = (empId) => {
    return localShifts
      .filter(s => s.employee_id === empId)
      .reduce((sum, s) => sum + (TEMPLATE_HOURS[s.template] || 0), 0);
  };

  const getHoursColor = (hours, target) => {
    if (hours < target) return { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400', border: 'border-red-300' };
    if (hours > target) return { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-300' };
    return { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400', border: 'border-green-300' };
  };

  const seedMonth = async () => {
    try {
      await axios.post(`${API}/planner/seed-month?year=${year}&month=${month}`, {}, { headers });
      fetchPlanner();
    } catch (err) { console.error(err); }
  };

  if (loading || !plannerData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="frappe-spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" data-testid="staff-planner-page">
      {/* Top bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => handleNavigation(-1)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" data-testid="planner-back-btn">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Staff Planner</h1>
            {hasChanges && (
              <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs rounded-full">
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleMonthChange('prev')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" data-testid="prev-month"><ChevronLeft size={18} className="text-gray-600 dark:text-gray-300" /></button>
            <span className="text-sm font-medium min-w-[140px] text-center text-gray-900 dark:text-white" data-testid="planner-month">
              {monthNames[month - 1]} {year}
            </span>
            <button onClick={() => handleMonthChange('next')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" data-testid="next-month"><ChevronRight size={18} className="text-gray-600 dark:text-gray-300" /></button>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <>
                <button
                  onClick={discardChanges}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  data-testid="discard-btn"
                >
                  <X size={14} /> Discard
                </button>
                <button
                  onClick={saveAllChanges}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  data-testid="save-btn"
                >
                  <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            )}
            {!hasChanges && (
              <button
                onClick={seedMonth}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                data-testid="seed-month-btn"
              >
                <Plus size={14} /> Seed Month
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Template palette */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Template:</span>
            {Object.entries(TEMPLATE_COLORS).map(([key, style]) => {
              const tpl = plannerData.templates[key];
              return (
                <button
                  key={key}
                  onClick={() => setSelectedTemplate(key)}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-all ${
                    selectedTemplate === key
                      ? `${style.bg} ${style.darkBg} ${style.border} ${style.darkBorder} ${style.text} ${style.darkText} font-semibold ring-2 ring-offset-1 ring-${key === 'early' ? 'amber' : key === 'late' ? 'blue' : key === 'night' ? 'violet' : 'emerald'}-300`
                      : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  data-testid={`template-${key}`}
                >
                  <span className={`inline-block w-2 h-2 rounded-full ${style.dot} mr-1`} />
                  {tpl.label} ({tpl.start}-{tpl.end})
                </button>
              );
            })}
          </div>

          {/* Selection controls + Filters */}
          <div className="flex items-center gap-2">
            {selectedShiftIds.size > 0 && (
              <button
                onClick={removeSelectedShifts}
                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-200 dark:hover:bg-red-900/60"
                data-testid="delete-selected-btn"
              >
                <Trash2 size={13} />
                Delete {selectedShiftIds.size} selected
              </button>
            )}
            <button
              onClick={() => setIsSelecting(!isSelecting)}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border transition-all ${
                isSelecting ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              data-testid="select-mode-btn"
            >
              {isSelecting ? <CheckSquare size={13} /> : <Square size={13} />}
              {isSelecting ? 'Exit Select' : 'Multi-Select'}
            </button>
            <button
              onClick={() => setViewMode(v => v === 'on_duty' ? 'off_duty' : 'on_duty')}
              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              data-testid="view-toggle"
            >
              {viewMode === 'on_duty' ? <Eye size={13} /> : <EyeOff size={13} />}
              {viewMode === 'on_duty' ? 'On Duty' : 'Off Duty'}
            </button>
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              className="text-xs border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700"
              data-testid="role-filter"
            >
              <option value="all">All Staff</option>
              <option value="nurse">Nurses</option>
              <option value="senior_carer">Sr Carers</option>
              <option value="carer">Carers</option>
              <option value="agency">Agency</option>
              <option value="activities">Activities</option>
              <option value="kitchen">Kitchen</option>
            </select>
            <button
              onClick={() => setShowRulesPanel(!showRulesPanel)}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border transition-all ${
                showRulesPanel ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              data-testid="rules-panel-toggle"
            >
              <Shield size={13} />
              Rules
            </button>
            <button
              onClick={() => handleNavigation('/manager/control-preferences')}
              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              data-testid="settings-btn"
            >
              <Settings size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Active Rules Panel */}
      {showRulesPanel && controlPrefs && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-4 py-3" data-testid="rules-panel">
          <div className="flex items-start gap-4">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <Shield size={16} />
              <span className="text-xs font-semibold">Active Rules:</span>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-gray-600 dark:text-gray-400">Consecutive Days:</span>
                <RuleStatusBadge mode={controlPrefs.consecutive?.mode || 'soft'} label="Consecutive" />
                <span className="text-gray-700 dark:text-gray-300 font-medium">{controlPrefs.consecutive?.max_consecutive_day_shifts || 5} max</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-600 dark:text-gray-400">Consecutive Nights:</span>
                <RuleStatusBadge mode={controlPrefs.consecutive?.mode || 'soft'} label="Night" />
                <span className="text-gray-700 dark:text-gray-300 font-medium">{controlPrefs.consecutive?.max_consecutive_night_shifts || 3} max</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-600 dark:text-gray-400">Rest Hours:</span>
                <RuleStatusBadge mode={controlPrefs.rest?.mode || 'soft'} label="Rest" />
                <span className="text-gray-700 dark:text-gray-300 font-medium">{controlPrefs.rest?.min_rest_hours || 11}h min</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <table className="min-w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="sticky left-0 z-20 bg-gray-100 dark:bg-gray-700 px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-300 border-b border-r border-gray-200 dark:border-gray-600 min-w-[180px]">
                  <div className="flex items-center gap-1"><Users size={13} /> Staff ({filteredStaff.length})</div>
                </th>
                {cols.map((col, ci) => {
                  if (col.type === 'week') {
                    return (
                      <th key={`wk${col.weekIndex}`} className="px-1 py-1.5 text-center font-semibold border-b border-r border-l-2 border-l-gray-400 dark:border-l-gray-500 border-gray-200 dark:border-gray-600 min-w-[48px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        <div className="text-[9px]">WK{col.weekIndex + 1}</div>
                        <div className="text-[10px]">Hrs</div>
                      </th>
                    );
                  }
                  const isToday = col.dateStr === todayStr;
                  const dayName = new Date(year, month - 1, col.day).toLocaleDateString('en-GB', { weekday: 'short' });
                  const isWeekend = [0, 6].includes(new Date(year, month - 1, col.day).getDay());
                  const isMonday = new Date(year, month - 1, col.day).getDay() === 1 && col.day > 1;
                  return (
                    <th
                      key={col.day}
                      className={`px-0.5 py-1.5 text-center font-medium border-b border-r border-gray-200 dark:border-gray-600 min-w-[52px] ${
                        isMonday ? 'border-l-2 border-l-gray-300 dark:border-l-gray-500' : ''
                      } ${isToday ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : isWeekend ? 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                      <div className="text-[10px]">{dayName}</div>
                      <div>{col.day}</div>
                    </th>
                  );
                })}
                <th className="px-2 py-1.5 text-center font-semibold border-b border-l-2 border-l-gray-400 dark:border-l-gray-500 border-gray-200 dark:border-gray-600 min-w-[64px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  <div className="text-[10px]">Month</div>
                  <div className="text-[10px]">Total</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map(emp => {
                const empId = emp.id;
                const isAgency = emp.employment_type === 'agency';
                const contract = emp.contract_hours || 36;
                const monthlyHours = getMonthlyHours(empId);
                const monthlyTarget = contract * (daysInMonth / 7);
                const monthColor = getHoursColor(monthlyHours, monthlyTarget);
                return (
                  <tr key={empId} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                    <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 px-2 py-1 border-b border-r border-gray-200 dark:border-gray-700">
                      <EmployeeTooltip employee={emp}>
                        <div className="flex items-center gap-2 cursor-help">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${isAgency ? 'bg-orange-500' : 'bg-slate-600'}`}>
                            {emp.first_name[0]}{emp.last_name[0]}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 dark:text-white truncate text-[11px] flex items-center gap-1">
                              {emp.first_name} {emp.last_name}
                              <Info size={10} className="text-gray-400" />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-400 dark:text-gray-500">{JOB_LABELS[emp.job_title] || emp.job_title}</span>
                              {isAgency && <span className="text-[9px] px-1 py-0 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded">AGY</span>}
                            </div>
                          </div>
                        </div>
                      </EmployeeTooltip>
                    </td>
                    {cols.map((col, ci) => {
                      if (col.type === 'week') {
                        const weekHours = getWeeklyHours(empId, weeks[col.weekIndex].days);
                        const wColor = getHoursColor(weekHours, contract);
                        return (
                          <td key={`wk${col.weekIndex}`} className={`border-b border-r border-l-2 border-l-gray-400 dark:border-l-gray-500 border-gray-200 dark:border-gray-600 px-1 py-1 text-center ${wColor.bg}`}>
                            <div className={`text-[11px] font-bold ${wColor.text}`}>
                              {weekHours}h
                            </div>
                          </td>
                        );
                      }
                      const dateStr = col.dateStr;
                      const shift = getShiftForCell(empId, dateStr);
                      const onLeave = isOnLeave(empId, dateStr);
                      const isToday = dateStr === todayStr;
                      const isWeekend = [0, 6].includes(new Date(year, month - 1, col.day).getDay());
                      const isMonday = new Date(year, month - 1, col.day).getDay() === 1 && col.day > 1;

                      if (viewMode === 'off_duty') {
                        const isOff = !shift && !onLeave;
                        return (
                          <td key={col.day} className={`border-b border-r border-gray-200 dark:border-gray-600 text-center ${isMonday ? 'border-l-2 border-l-gray-300 dark:border-l-gray-500' : ''} ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : isWeekend ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''}`}>
                            {isOff && <span className="text-gray-300 dark:text-gray-600 text-[10px]">OFF</span>}
                            {onLeave && <span className="text-green-600 dark:text-green-400 text-[10px] font-medium">AL</span>}
                            {shift && <span className="text-gray-300 dark:text-gray-600 text-[10px]">-</span>}
                          </td>
                        );
                      }

                      return (
                        <td
                          key={col.day}
                          className={`border-b border-r border-gray-200 dark:border-gray-600 p-0 ${isMonday ? 'border-l-2 border-l-gray-300 dark:border-l-gray-500' : ''} ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : isWeekend ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''}`}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, empId, dateStr)}
                          onClick={(e) => !shift && !onLeave && handleCellClick(empId, dateStr, e)}
                          style={{ cursor: !shift && !onLeave ? 'pointer' : 'default', height: '36px' }}
                        >
                          {onLeave && (
                            <div className="h-full flex items-center justify-center bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 text-[10px] font-medium">AL</div>
                          )}
                          {shift && !onLeave && (
                            <ShiftCell 
                              shift={shift} 
                              onRemove={removeShiftLocally} 
                              onDragStart={handleDragStart} 
                              empId={empId}
                              isSelected={selectedShiftIds.has(shift.id)}
                              onSelect={toggleShiftSelection}
                              isSelecting={isSelecting}
                            />
                          )}
                        </td>
                      );
                    })}
                    <td className={`border-b border-l-2 border-l-gray-400 dark:border-l-gray-500 border-gray-200 dark:border-gray-600 px-1 py-1 text-center ${monthColor.bg}`}>
                      <div className={`text-[11px] font-bold ${monthColor.text}`}>
                        {monthlyHours}h
                      </div>
                      {(() => {
                        const delta = Math.round(monthlyHours - monthlyTarget);
                        const deltaStr = delta === 0 ? '0' : delta > 0 ? `+${delta}` : `${delta}`;
                        const deltaColor = delta === 0 ? 'text-green-600 dark:text-green-400' : delta > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400';
                        return (
                          <div className={`text-[10px] font-semibold ${deltaColor}`}>
                            {deltaStr}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unsaved changes dialog */}
      {showUnsavedDialog && (
        <UnsavedChangesDialog
          onSave={handleUnsavedDialogSave}
          onDiscard={handleUnsavedDialogDiscard}
          onCancel={() => { setShowUnsavedDialog(false); setPendingNavigation(null); }}
        />
      )}

      {/* Warning modal */}
      {warningModal && (
        <WarningModal
          warnings={warningModal.warnings}
          onConfirm={() => setWarningModal(null)}
          onCancel={() => setWarningModal(null)}
        />
      )}
    </div>
  );
};

const ShiftCell = ({ shift, onRemove, onDragStart, empId, isSelected, onSelect, isSelecting }) => {
  const tpl = shift.template || 'custom';
  const style = TEMPLATE_COLORS[tpl] || { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-700', label: '?', darkBg: 'dark:bg-gray-700', darkBorder: 'dark:border-gray-600', darkText: 'dark:text-gray-300' };
  const isAgency = shift.is_agency_cover;
  const isTemp = shift.is_temp;

  const handleClick = (e) => {
    e.stopPropagation();
    if (isSelecting) {
      onSelect(shift.id);
    }
  };

  return (
    <div
      draggable={!isSelecting}
      onDragStart={(e) => !isSelecting && onDragStart(e, shift.id, empId)}
      onClick={handleClick}
      className={`group relative h-full flex items-center justify-center ${style.bg} ${style.darkBg} border-l-4 ${style.border} ${style.darkBorder} ${style.text} ${style.darkText} text-[11px] font-semibold cursor-grab active:cursor-grabbing transition-all ${
        isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''
      } ${isTemp ? 'opacity-80 border-dashed' : ''}`}
      title={`${shift.start_time}-${shift.end_time}${isAgency ? ' (Agency)' : ''}${isTemp ? ' (Unsaved)' : ''}`}
    >
      {isSelecting && (
        <div className={`absolute left-1 top-1 w-4 h-4 rounded border-2 flex items-center justify-center ${
          isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500'
        }`}>
          {isSelected && <span className="text-white text-[8px]">✓</span>}
        </div>
      )}
      <span className="text-sm">{style.label}</span>
      {isAgency && <span className="ml-0.5 text-orange-600 dark:text-orange-400">*</span>}
      {isTemp && <span className="ml-0.5 text-gray-400">•</span>}
      {!isSelecting && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(shift.id); }}
          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full items-center justify-center text-[8px] hidden group-hover:flex shadow-sm"
          data-testid={`remove-shift-${shift.id}`}
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
};

const WarningModal = ({ warnings, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="warning-modal">
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Scheduling Warning</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">This assignment may violate planner rules</p>
        </div>
      </div>
      <div className="space-y-2 mb-6">
        {warnings.map((w, i) => (
          <div key={i} className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">{w.message}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          data-testid="cancel-warning-btn"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          data-testid="confirm-warning-btn"
        >
          Proceed Anyway
        </button>
      </div>
    </div>
  </div>
);

export default StaffPlanner;
