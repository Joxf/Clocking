import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
  ChevronLeft, ChevronRight, Users, Clock, AlertTriangle,
  Plus, X, GripVertical, Filter, Eye, EyeOff, BarChart3, ArrowLeft
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TEMPLATE_HOURS = { early: 6, late: 6, night: 12, long_day: 12 };

const TEMPLATE_COLORS = {
  early:    { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-800', dot: 'bg-amber-400', label: 'E' },
  late:     { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800', dot: 'bg-blue-400', label: 'L' },
  night:    { bg: 'bg-violet-100', border: 'border-violet-400', text: 'text-violet-800', dot: 'bg-violet-400', label: 'N' },
  long_day: { bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-emerald-800', dot: 'bg-emerald-400', label: 'LD' },
};

const JOB_LABELS = {
  nurse: 'Nurse', senior_carer: 'Sr Carer', carer: 'Carer',
  activities: 'Activities', kitchen: 'Kitchen', maintenance: 'Maint.',
  care_manager: 'Manager', administrator: 'Admin',
};

const StaffPlanner = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const headers = { Authorization: `Bearer ${token}` };

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [plannerData, setPlannerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('on_duty'); // on_duty, off_duty
  const [filterRole, setFilterRole] = useState('all');
  const [showOvertimePanel, setShowOvertimePanel] = useState(false);
  const [warningModal, setWarningModal] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState('early');
  const [dragData, setDragData] = useState(null);

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const fetchPlanner = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/planner/monthly?year=${year}&month=${month}`, { headers });
      setPlannerData(res.data);
    } catch (err) {
      console.error('Failed to fetch planner:', err);
    } finally {
      setLoading(false);
    }
  }, [year, month, token]);

  useEffect(() => { fetchPlanner(); }, [fetchPlanner]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const getDaysInMonth = () => {
    return new Date(year, month, 0).getDate();
  };

  const assignShift = async (employeeId, date, template, force = false) => {
    try {
      const res = await axios.post(`${API}/planner/assign`, {
        employee_id: employeeId, shift_date: date, template, force
      }, { headers });
      if (res.data.requires_confirmation) {
        setWarningModal({ warnings: res.data.warnings, employeeId, date, template });
        return;
      }
      fetchPlanner();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to assign shift';
      alert(msg);
    }
  };

  const removeShift = async (shiftId) => {
    try {
      await axios.delete(`${API}/planner/unassign/${shiftId}`, { headers });
      fetchPlanner();
    } catch (err) { console.error(err); }
  };

  const moveShift = async (shiftId, newDate, newEmployeeId, force = false) => {
    try {
      const res = await axios.put(`${API}/planner/move`, {
        shift_id: shiftId, new_date: newDate, new_employee_id: newEmployeeId, force
      }, { headers });
      if (res.data.requires_confirmation) {
        setWarningModal({ warnings: res.data.warnings, shiftId, newDate, newEmployeeId, isMove: true });
        return;
      }
      fetchPlanner();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to move shift';
      alert(msg);
    }
  };

  const confirmWarning = () => {
    if (!warningModal) return;
    if (warningModal.isMove) {
      moveShift(warningModal.shiftId, warningModal.newDate, warningModal.newEmployeeId, true);
    } else {
      assignShift(warningModal.employeeId, warningModal.date, warningModal.template, true);
    }
    setWarningModal(null);
  };

  const seedMonth = async () => {
    try {
      await axios.post(`${API}/planner/seed-month?year=${year}&month=${month}`, {}, { headers });
      fetchPlanner();
    } catch (err) { console.error(err); }
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
    const newEmpId = targetEmpId !== dragData.empId ? targetEmpId : null;
    moveShift(dragData.shiftId, targetDate, newEmpId);
    setDragData(null);
  };

  const handleCellClick = (empId, dateStr) => {
    // Check if there's already a shift
    const existing = getShiftForCell(empId, dateStr);
    if (!existing) {
      assignShift(empId, dateStr, selectedTemplate);
    }
  };

  const getShiftForCell = (empId, dateStr) => {
    if (!plannerData) return null;
    return plannerData.shifts.find(s => s.employee_id === empId && s.shift_date === dateStr);
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

  // Build week boundaries (Mon-Sun) and column structure
  const buildColumns = () => {
    const cols = [];
    const weeks = [];
    let currentWeek = { days: [], startDay: null };
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dow = new Date(year, month - 1, day).getDay(); // 0=Sun
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

  // Calculate weekly hours for an employee
  const getWeeklyHours = (empId, weekDays) => {
    if (!plannerData) return 0;
    let total = 0;
    for (const wd of weekDays) {
      const shift = plannerData.shifts.find(s => s.employee_id === empId && s.shift_date === wd.dateStr);
      if (shift) total += TEMPLATE_HOURS[shift.template] || 0;
    }
    return total;
  };

  // Calculate monthly total hours
  const getMonthlyHours = (empId) => {
    if (!plannerData) return 0;
    return plannerData.shifts
      .filter(s => s.employee_id === empId)
      .reduce((sum, s) => sum + (TEMPLATE_HOURS[s.template] || 0), 0);
  };

  // Hours color: red=under, green=at/ok, amber=overtime
  const getHoursColor = (hours, target) => {
    if (hours < target) return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' };
    if (hours > target) return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' };
    return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300' };
  };

  // Coverage per shift for a day
  const getDayCoverage = (dateStr) => {
    if (!plannerData) return {};
    const cov = plannerData.coverage[dateStr] || {};
    return cov;
  };

  if (loading || !plannerData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="frappe-spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" data-testid="staff-planner-page">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700" data-testid="planner-back-btn">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Staff Planner</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded" data-testid="prev-month"><ChevronLeft size={18} /></button>
            <span className="text-sm font-medium min-w-[140px] text-center" data-testid="planner-month">
              {monthNames[month - 1]} {year}
            </span>
            <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded" data-testid="next-month"><ChevronRight size={18} /></button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={seedMonth}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              data-testid="seed-month-btn"
            >
              <Plus size={14} /> Seed Month
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar: template selector + filters */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Template palette */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 mr-1">Template:</span>
            {Object.entries(TEMPLATE_COLORS).map(([key, style]) => {
              const tpl = plannerData.templates[key];
              return (
                <button
                  key={key}
                  onClick={() => setSelectedTemplate(key)}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-all ${
                    selectedTemplate === key
                      ? `${style.bg} ${style.border} ${style.text} font-semibold ring-2 ring-offset-1 ring-${key === 'early' ? 'amber' : key === 'late' ? 'blue' : key === 'night' ? 'violet' : 'emerald'}-300`
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                  data-testid={`template-${key}`}
                >
                  <span className={`inline-block w-2 h-2 rounded-full ${style.dot} mr-1`} />
                  {tpl.label} ({tpl.start}-{tpl.end})
                </button>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(v => v === 'on_duty' ? 'off_duty' : 'on_duty')}
              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
              data-testid="view-toggle"
            >
              {viewMode === 'on_duty' ? <Eye size={13} /> : <EyeOff size={13} />}
              {viewMode === 'on_duty' ? 'On Duty' : 'Off Duty'}
            </button>
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              className="text-xs border border-gray-200 rounded-md px-2 py-1 text-gray-600"
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
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <table className="min-w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              {/* Day headers */}
              <tr className="bg-gray-100">
                <th className="sticky left-0 z-20 bg-gray-100 px-2 py-2 text-left font-medium text-gray-600 border-b border-r border-gray-200 min-w-[160px]">
                  <div className="flex items-center gap-1"><Users size={13} /> Staff ({filteredStaff.length})</div>
                </th>
                {cols.map((col, ci) => {
                  if (col.type === 'week') {
                    return (
                      <th key={`wk${col.weekIndex}`} className="px-1 py-1.5 text-center font-semibold border-b border-r border-l-2 border-l-gray-400 border-gray-200 min-w-[48px] bg-slate-200 text-slate-700">
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
                      className={`px-0.5 py-1.5 text-center font-medium border-b border-r border-gray-200 min-w-[44px] ${
                        isMonday ? 'border-l-2 border-l-gray-300' : ''
                      } ${isToday ? 'bg-blue-100 text-blue-700' : isWeekend ? 'bg-gray-50 text-gray-500' : 'text-gray-600'}`}
                    >
                      <div className="text-[10px]">{dayName}</div>
                      <div>{col.day}</div>
                    </th>
                  );
                })}
                <th className="px-2 py-1.5 text-center font-semibold border-b border-l-2 border-l-gray-400 border-gray-200 min-w-[64px] bg-slate-200 text-slate-700">
                  <div className="text-[10px]">Month</div>
                  <div className="text-[10px]">Total</div>
                </th>
              </tr>
              {/* Coverage rows — inside thead so columns align */}
              {['early', 'late', 'night'].map(tplKey => {
                const style = TEMPLATE_COLORS[tplKey];
                const lbl = tplKey === 'early' ? 'Early' : tplKey === 'late' ? 'Late' : 'Night';
                const BASELINE_N = 2;
                const BASELINE_C = 6;
                return (
                  <tr key={`cov-${tplKey}`} className="bg-white">
                    <th className="sticky left-0 z-20 bg-white px-2 py-0.5 text-left border-b border-r border-gray-200 min-w-[160px]">
                      <span className={`text-[10px] font-medium ${style.text}`}>
                        <span className={`inline-block w-2 h-2 rounded-full ${style.dot} mr-1`} />{lbl}
                      </span>
                    </th>
                    {cols.map((col, ci) => {
                      if (col.type === 'week') {
                        return <td key={`wk${col.weekIndex}`} className="border-b border-r border-l-2 border-l-gray-400 border-gray-200 bg-slate-50" />;
                      }
                      const cov = plannerData.coverage[col.dateStr] || {};
                      const shiftCov = cov[tplKey];
                      const isMonday = new Date(year, month - 1, col.day).getDay() === 1 && col.day > 1;
                      const isToday = col.dateStr === todayStr;
                      if (!shiftCov || shiftCov.total === 0) {
                        return <td key={col.day} className={`border-b border-r border-gray-200 text-center text-gray-300 text-[9px] ${isMonday ? 'border-l-2 border-l-gray-300' : ''}`}>-</td>;
                      }
                      const nOk = shiftCov.nurses >= BASELINE_N;
                      const cOk = shiftCov.carers >= BASELINE_C;
                      const allOk = nOk && cOk;
                      const over = shiftCov.nurses > BASELINE_N + 1 || shiftCov.carers > BASELINE_C + 2;
                      const bgClass = !allOk ? 'bg-red-50' : over ? 'bg-sky-50' : 'bg-green-50';
                      return (
                        <td key={col.day}
                            className={`border-b border-r border-gray-200 text-center px-0 py-0 text-[9px] ${bgClass} ${isToday ? 'ring-1 ring-inset ring-blue-400' : ''} ${isMonday ? 'border-l-2 border-l-gray-300' : ''}`}
                            title={`${lbl}: ${shiftCov.nurses}N ${shiftCov.carers}C (baseline ${BASELINE_N}N ${BASELINE_C}C)`}>
                          <span className={`font-bold ${nOk ? 'text-green-700' : 'text-red-600'}`}>{shiftCov.nurses}N</span>
                          <span className={`font-bold ${cOk ? 'text-green-700' : 'text-red-600'}`}>{shiftCov.carers}C</span>
                        </td>
                      );
                    })}
                    <td className="border-b border-l-2 border-l-gray-400 border-gray-200 bg-slate-50 min-w-[64px]" />
                  </tr>
                );
              })}
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
                  <tr key={empId} className="hover:bg-gray-50/50">
                    <td className="sticky left-0 z-10 bg-white px-2 py-1 border-b border-r border-gray-200">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${isAgency ? 'bg-orange-500' : 'bg-slate-600'}`}>
                          {emp.first_name[0]}{emp.last_name[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate text-[11px]">{emp.first_name} {emp.last_name}</div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400">{JOB_LABELS[emp.job_title] || emp.job_title}</span>
                            {isAgency && <span className="text-[9px] px-1 py-0 bg-orange-100 text-orange-700 rounded">AGY</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    {cols.map((col, ci) => {
                      if (col.type === 'week') {
                        const weekHours = getWeeklyHours(empId, weeks[col.weekIndex].days);
                        const wColor = getHoursColor(weekHours, contract);
                        return (
                          <td key={`wk${col.weekIndex}`} className={`border-b border-r border-l-2 border-l-gray-400 border-gray-200 px-1 py-1 text-center ${wColor.bg}`}>
                            <div className={`text-[11px] font-bold ${wColor.text}`} data-testid={`week-hours-${emp.employee_id}-${col.weekIndex}`}>
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
                          <td key={col.day} className={`border-b border-r border-gray-200 text-center ${isMonday ? 'border-l-2 border-l-gray-300' : ''} ${isToday ? 'bg-blue-50' : isWeekend ? 'bg-gray-50/50' : ''}`}>
                            {isOff && <span className="text-gray-300 text-[10px]">OFF</span>}
                            {onLeave && <span className="text-green-600 text-[10px] font-medium">AL</span>}
                            {shift && <span className="text-gray-300 text-[10px]">-</span>}
                          </td>
                        );
                      }

                      return (
                        <td
                          key={col.day}
                          className={`border-b border-r border-gray-200 p-0 ${isMonday ? 'border-l-2 border-l-gray-300' : ''} ${isToday ? 'bg-blue-50' : isWeekend ? 'bg-gray-50/50' : ''}`}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, empId, dateStr)}
                          onClick={() => !shift && !onLeave && handleCellClick(empId, dateStr)}
                          style={{ cursor: !shift && !onLeave ? 'pointer' : 'default' }}
                        >
                          {onLeave && (
                            <div className="mx-0.5 my-0.5 px-1 py-0.5 bg-green-100 border border-green-300 text-green-700 text-[10px] rounded text-center font-medium">AL</div>
                          )}
                          {shift && !onLeave && (
                            <ShiftCell shift={shift} onRemove={removeShift} onDragStart={handleDragStart} empId={empId} />
                          )}
                        </td>
                      );
                    })}
                    {/* Monthly total */}
                    <td className={`border-b border-l-2 border-l-gray-400 border-gray-200 px-1 py-1 text-center ${monthColor.bg}`}>
                      <div className={`text-[11px] font-bold ${monthColor.text}`} data-testid={`month-hours-${emp.employee_id}`}>
                        {monthlyHours}h
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warning modal */}
      {warningModal && (
        <WarningModal
          warnings={warningModal.warnings}
          onConfirm={confirmWarning}
          onCancel={() => setWarningModal(null)}
        />
      )}
    </div>
  );
};

const ShiftCell = ({ shift, onRemove, onDragStart, empId }) => {
  const tpl = shift.template || 'custom';
  const style = TEMPLATE_COLORS[tpl] || { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-700', label: '?' };
  const isAgency = shift.is_agency_cover;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, shift.id, empId)}
      className={`group relative mx-0.5 my-0.5 px-1 py-0.5 ${style.bg} border ${style.border} ${style.text} text-[10px] rounded text-center font-medium cursor-grab active:cursor-grabbing`}
      title={`${shift.start_time}-${shift.end_time}${isAgency ? ' (Agency)' : ''}`}
    >
      {style.label}
      {isAgency && <span className="ml-0.5 text-orange-600">*</span>}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(shift.id); }}
        className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white rounded-full items-center justify-center text-[8px] hidden group-hover:flex"
        data-testid={`remove-shift-${shift.id}`}
      >
        <X size={8} />
      </button>
    </div>
  );
};

const CoverageDetailRow = ({ cols, coverage, todayStr, year, month }) => {
  if (!coverage) return null;
  const BASELINE_N = 2;
  const BASELINE_C = 6;
  return (
    <div className="bg-white border-b border-gray-200 overflow-x-auto">
      <table className="min-w-full border-collapse text-[9px]">
        <tbody>
          {['early', 'late', 'night'].map(tplKey => {
            const style = TEMPLATE_COLORS[tplKey];
            const lbl = tplKey === 'early' ? 'Early' : tplKey === 'late' ? 'Late' : 'Night';
            return (
              <tr key={tplKey}>
                <td className={`sticky left-0 z-10 bg-white px-2 py-0.5 border-r border-gray-200 min-w-[160px] font-medium ${style.text}`}>
                  <span className={`inline-block w-2 h-2 rounded-full ${style.dot} mr-1`} />{lbl}
                </td>
                {cols.map((col, ci) => {
                  if (col.type === 'week') {
                    return <td key={`wk${col.weekIndex}`} className="border-r border-l-2 border-l-gray-400 border-gray-200 bg-slate-100" />;
                  }
                  const cov = coverage[col.dateStr] || {};
                  const shiftCov = cov[tplKey];
                  if (!shiftCov || shiftCov.total === 0) {
                    return <td key={col.day} className="border-r border-gray-200 text-center text-gray-300 px-0.5">-</td>;
                  }
                  const nOk = shiftCov.nurses >= BASELINE_N;
                  const cOk = shiftCov.carers >= BASELINE_C;
                  const allOk = nOk && cOk;
                  const over = shiftCov.nurses > BASELINE_N + 1 || shiftCov.carers > BASELINE_C + 2;
                  const bgClass = !allOk ? 'bg-red-100 text-red-700' : over ? 'bg-sky-100 text-sky-700' : 'bg-green-50 text-green-700';
                  const isToday = col.dateStr === todayStr;
                  const isMonday = new Date(year, month - 1, col.day).getDay() === 1 && col.day > 1;
                  return (
                    <td key={col.day} className={`border-r border-gray-200 text-center px-0 py-0 ${bgClass} ${isToday ? 'ring-1 ring-inset ring-blue-400' : ''} ${isMonday ? 'border-l-2 border-l-gray-300' : ''}`}
                        title={`${lbl}: ${shiftCov.nurses}N ${shiftCov.carers}C (need ${BASELINE_N}N ${BASELINE_C}C)`}>
                      <div className="leading-tight">
                        <span className={`font-bold ${nOk ? '' : 'text-red-600'}`}>{shiftCov.nurses}N</span>
                        {' '}
                        <span className={`font-bold ${cOk ? '' : 'text-red-600'}`}>{shiftCov.carers}C</span>
                      </div>
                    </td>
                  );
                })}
                <td className="border-l-2 border-l-gray-400 border-gray-200 bg-slate-100 min-w-[56px]" />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const WarningModal = ({ warnings, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="warning-modal">
    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
          <AlertTriangle size={20} className="text-amber-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Scheduling Warning</h3>
          <p className="text-sm text-gray-500">This assignment violates planner rules</p>
        </div>
      </div>
      <div className="space-y-2 mb-6">
        {warnings.map((w, i) => (
          <div key={i} className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">{w.message}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          data-testid="warning-cancel"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium"
          data-testid="warning-confirm"
        >
          Assign Anyway
        </button>
      </div>
    </div>
  </div>
);

export default StaffPlanner;
