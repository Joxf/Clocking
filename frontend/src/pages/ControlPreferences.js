import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
  Settings,
  Users,
  Clock,
  Calendar,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Moon,
  Sun,
  Briefcase,
  FileText,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Info,
  LogIn,
  ClipboardList,
  CalendarDays,
  Key,
  Smartphone,
  Timer,
  UserCheck,
  Bell,
  Zap,
  TrendingUp,
  Plus,
  Trash2,
  Edit3,
  GripVertical
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ============ SHARED COMPONENTS ============

// Rule Mode Selector Component
const RuleModeSelector = ({ value, onChange, label }) => {
  const modes = [
    { value: 'hard', label: 'Hard Block', color: 'bg-red-100 text-red-700 border-red-300' },
    { value: 'soft', label: 'Soft Warning', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
    { value: 'disabled', label: 'Disabled', color: 'bg-gray-100 text-gray-500 border-gray-300' }
  ];

  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-medium text-gray-600">{label}</label>}
      <div className="flex gap-1">
        {modes.map(mode => (
          <button
            key={mode.value}
            type="button"
            onClick={() => onChange(mode.value)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
              value === mode.value ? mode.color + ' font-medium' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// Number Input Component
const NumberInput = ({ label, value, onChange, min = 0, max = 999, suffix = '', help, className = '' }) => (
  <div className={`space-y-1 ${className}`}>
    <label className="block text-xs font-medium text-gray-600">{label}</label>
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        min={min}
        max={max}
        className="w-20 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
    </div>
    {help && <p className="text-[10px] text-gray-400">{help}</p>}
  </div>
);

// Toggle Component
const Toggle = ({ label, value, onChange, help, disabled = false }) => (
  <div className="flex items-center justify-between py-2">
    <div>
      <p className={`text-sm ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>{label}</p>
      {help && <p className="text-[10px] text-gray-400">{help}</p>}
    </div>
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        disabled ? 'bg-gray-200 cursor-not-allowed' : value ? 'bg-blue-500' : 'bg-gray-300'
      }`}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${value ? 'left-6' : 'left-1'}`} />
    </button>
  </div>
);

// Select Component
const SelectInput = ({ label, value, onChange, options, help }) => (
  <div className="space-y-1">
    <label className="block text-xs font-medium text-gray-600">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
    {help && <p className="text-[10px] text-gray-400">{help}</p>}
  </div>
);

// Section Component
const Section = ({ title, icon: Icon, children, defaultOpen = true, iconColor = 'bg-blue-100 text-blue-600' }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg ${iconColor.split(' ')[0]} flex items-center justify-center`}>
            <Icon size={18} className={iconColor.split(' ')[1]} />
          </div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        {isOpen ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
      </button>
      {isOpen && <div className="p-5 border-t border-gray-100">{children}</div>}
    </div>
  );
};

// Staffing Requirement Editor
const StaffingEditor = ({ label, data, onChange }) => {
  const update = (key, value) => {
    onChange({ ...data, [key]: value });
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg space-y-3">
      <h4 className="font-medium text-gray-700 text-sm">{label}</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <NumberInput label="Min Total" value={data?.min_total || 0} onChange={(v) => update('min_total', v)} />
        <NumberInput label="Min Nurses" value={data?.min_nurses || 0} onChange={(v) => update('min_nurses', v)} />
        <NumberInput label="Min Sr. Carers" value={data?.min_senior_carers || 0} onChange={(v) => update('min_senior_carers', v)} />
        <NumberInput label="Min Carers" value={data?.min_carers || 0} onChange={(v) => update('min_carers', v)} />
        <NumberInput label="Activities" value={data?.min_activities || 0} onChange={(v) => update('min_activities', v)} />
        <NumberInput label="Kitchen" value={data?.min_kitchen || 0} onChange={(v) => update('min_kitchen', v)} />
        <NumberInput label="Domestic" value={data?.min_domestic || 0} onChange={(v) => update('min_domestic', v)} />
      </div>
    </div>
  );
};

// Reason List Editor Component
const ReasonListEditor = ({ reasons = [], onChange, label }) => {
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [newReason, setNewReason] = useState('');

  const handleAdd = () => {
    if (!newReason.trim()) return;
    const newItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      reason_text: newReason.trim(),
      is_active: true,
      order: reasons.length + 1
    };
    onChange([...reasons, newItem]);
    setNewReason('');
  };

  const handleEdit = (id) => {
    const reason = reasons.find(r => r.id === id);
    if (reason) {
      setEditingId(id);
      setEditText(reason.reason_text);
    }
  };

  const handleSaveEdit = () => {
    onChange(reasons.map(r => r.id === editingId ? { ...r, reason_text: editText } : r));
    setEditingId(null);
    setEditText('');
  };

  const handleDelete = (id) => {
    onChange(reasons.filter(r => r.id !== id));
  };

  const handleToggle = (id) => {
    onChange(reasons.map(r => r.id === id ? { ...r, is_active: !r.is_active } : r));
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-gray-600">{label}</label>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {reasons.map((reason, idx) => (
          <div key={reason.id} className={`flex items-center gap-2 p-2 rounded-lg border ${reason.is_active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'}`}>
            <GripVertical size={14} className="text-gray-300" />
            {editingId === reason.id ? (
              <>
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border rounded"
                  autoFocus
                />
                <button onClick={handleSaveEdit} className="text-green-600 hover:text-green-700">
                  <CheckCircle size={16} />
                </button>
                <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                  <XCircle size={16} />
                </button>
              </>
            ) : (
              <>
                <span className={`flex-1 text-sm ${reason.is_active ? 'text-gray-700' : 'text-gray-400 line-through'}`}>
                  {reason.reason_text}
                </span>
                <button 
                  onClick={() => handleToggle(reason.id)} 
                  className={`px-2 py-0.5 text-[10px] rounded ${reason.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {reason.is_active ? 'Active' : 'Inactive'}
                </button>
                <button onClick={() => handleEdit(reason.id)} className="text-gray-400 hover:text-blue-600">
                  <Edit3 size={14} />
                </button>
                <button onClick={() => handleDelete(reason.id)} className="text-gray-400 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newReason}
          onChange={(e) => setNewReason(e.target.value)}
          placeholder="Add new reason..."
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={!newReason.trim()}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
};

// ============ TAB PANELS ============

// SHIFT PLANNER TAB
const ShiftPlannerTab = ({ prefs, updateNested }) => {
  if (!prefs) return null;

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-medium">Rule Validation Modes</p>
          <p className="text-blue-600 mt-1">
            <span className="font-medium text-red-600">Hard Block</span> — Cannot proceed, blocks the action completely<br />
            <span className="font-medium text-yellow-600">Soft Warning</span> — Allows override with mandatory reason (logged for audit)<br />
            <span className="font-medium text-gray-500">Disabled</span> — Rule not enforced
          </p>
        </div>
      </div>

      {/* Staffing Requirements */}
      <Section title="Staffing Requirements Per Shift" icon={Users}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <NumberInput 
              label="Weekend Modifier (%)" 
              value={Math.round((prefs.staffing?.weekend_modifier || 0.8) * 100)} 
              onChange={(v) => updateNested('staffing.weekend_modifier', v / 100)}
              suffix="%"
              help="Weekend staffing as % of weekday (e.g., 80%)"
            />
          </div>
          <StaffingEditor 
            label="Early Shift (08:00 - 14:00)" 
            data={prefs.staffing?.early || {}} 
            onChange={(v) => updateNested('staffing.early', v)} 
          />
          <StaffingEditor 
            label="Late Shift (14:00 - 20:00)" 
            data={prefs.staffing?.late || {}} 
            onChange={(v) => updateNested('staffing.late', v)} 
          />
          <StaffingEditor 
            label="Night Shift (20:00 - 08:00)" 
            data={prefs.staffing?.night || {}} 
            onChange={(v) => updateNested('staffing.night', v)} 
          />
          <StaffingEditor 
            label="Long Day (08:00 - 20:00)" 
            data={prefs.staffing?.long_day || {}} 
            onChange={(v) => updateNested('staffing.long_day', v)} 
          />
        </div>
      </Section>

      {/* Consecutive Shift Limits */}
      <Section title="Consecutive Shift Limits" icon={Calendar}>
        <div className="space-y-4">
          <RuleModeSelector 
            label="Validation Mode" 
            value={prefs.consecutive?.mode || 'soft'} 
            onChange={(v) => updateNested('consecutive.mode', v)} 
          />
          <div className="grid grid-cols-2 gap-4">
            <NumberInput 
              label="Max Consecutive Day Shifts" 
              value={prefs.consecutive?.max_consecutive_day_shifts || 5} 
              onChange={(v) => updateNested('consecutive.max_consecutive_day_shifts', v)}
              help="Maximum days in a row before warning/block"
            />
            <NumberInput 
              label="Max Consecutive Night Shifts" 
              value={prefs.consecutive?.max_consecutive_night_shifts || 3} 
              onChange={(v) => updateNested('consecutive.max_consecutive_night_shifts', v)}
              help="Maximum night shifts in a row"
            />
          </div>
          <Toggle 
            label="Mixing shift types counts toward consecutive" 
            value={prefs.consecutive?.mix_shift_types_counts ?? true} 
            onChange={(v) => updateNested('consecutive.mix_shift_types_counts', v)}
            help="If enabled, Early→Late→Night counts as 3 consecutive"
          />
          <NumberInput 
            label="Long Day counts as" 
            value={prefs.consecutive?.long_day_counts_as || 1} 
            onChange={(v) => updateNested('consecutive.long_day_counts_as', v)}
            suffix="shift(s)"
            help="Does a long day count as 1 or 2 shifts?"
          />
        </div>
      </Section>

      {/* Rest Rules */}
      <Section title="Minimum Rest Between Shifts" icon={Moon}>
        <div className="space-y-4">
          <RuleModeSelector 
            label="Validation Mode" 
            value={prefs.rest?.mode || 'soft'} 
            onChange={(v) => updateNested('rest.mode', v)} 
          />
          <NumberInput 
            label="Minimum Rest Hours" 
            value={prefs.rest?.min_rest_hours || 11} 
            onChange={(v) => updateNested('rest.min_rest_hours', v)}
            suffix="hours"
            help="Minimum hours between end of one shift and start of next"
          />
        </div>
      </Section>

      {/* Weekend Protection */}
      <Section title="Consecutive Weekend Protection" icon={Sun}>
        <div className="space-y-4">
          <RuleModeSelector 
            label="Validation Mode" 
            value={prefs.weekend?.mode || 'soft'} 
            onChange={(v) => updateNested('weekend.mode', v)} 
          />
          <NumberInput 
            label="Max Consecutive Weekends" 
            value={prefs.weekend?.max_consecutive_weekends || 2} 
            onChange={(v) => updateNested('weekend.max_consecutive_weekends', v)}
            help="Maximum weekends worked in a row"
          />
          <Toggle 
            label="Partial weekend counts as full weekend" 
            value={prefs.weekend?.partial_weekend_counts ?? false} 
            onChange={(v) => updateNested('weekend.partial_weekend_counts', v)}
            help="If enabled, working Saturday only counts as full weekend"
          />
        </div>
      </Section>

      {/* Overtime Rules */}
      <Section title="Overtime Control" icon={Clock}>
        <div className="space-y-4">
          <RuleModeSelector 
            label="Validation Mode" 
            value={prefs.overtime?.mode || 'soft'} 
            onChange={(v) => updateNested('overtime.mode', v)} 
          />
          <div className="grid grid-cols-2 gap-4">
            <NumberInput 
              label="Max Weekly Hours" 
              value={prefs.overtime?.max_weekly_hours || 48} 
              onChange={(v) => updateNested('overtime.max_weekly_hours', v)}
              suffix="hours"
            />
            <NumberInput 
              label="Max Monthly Hours" 
              value={prefs.overtime?.max_monthly_hours || 192} 
              onChange={(v) => updateNested('overtime.max_monthly_hours', v)}
              suffix="hours"
            />
            <NumberInput 
              label="Soft Overtime Threshold" 
              value={prefs.overtime?.soft_overtime_threshold || 40} 
              onChange={(v) => updateNested('overtime.soft_overtime_threshold', v)}
              suffix="hours/week"
              help="Warning shown above this"
            />
            <NumberInput 
              label="Hard Overtime Limit" 
              value={prefs.overtime?.hard_overtime_limit || 60} 
              onChange={(v) => updateNested('overtime.hard_overtime_limit', v)}
              suffix="hours/week"
              help="Blocked above this"
            />
          </div>
          <NumberInput 
            label="Max Consecutive Overtime Shifts" 
            value={prefs.overtime?.max_consecutive_overtime_shifts || 3} 
            onChange={(v) => updateNested('overtime.max_consecutive_overtime_shifts', v)}
          />
        </div>
      </Section>

      {/* Agency Rules */}
      <Section title="Agency Staff Management" icon={Briefcase}>
        <div className="space-y-4">
          <Toggle 
            label="Enable Agency Staff" 
            value={prefs.agency?.enabled ?? true} 
            onChange={(v) => updateNested('agency.enabled', v)}
            help="Allow agency staff to be allocated to shifts"
          />
          {prefs.agency?.enabled && (
            <>
              <RuleModeSelector 
                label="Validation Mode" 
                value={prefs.agency?.mode || 'soft'} 
                onChange={(v) => updateNested('agency.mode', v)} 
              />
              <div className="grid grid-cols-2 gap-4">
                <NumberInput 
                  label="Max Agency Per Shift" 
                  value={prefs.agency?.max_agency_per_shift || 4} 
                  onChange={(v) => updateNested('agency.max_agency_per_shift', v)}
                />
                <NumberInput 
                  label="Max Agency Coverage %" 
                  value={prefs.agency?.max_agency_percentage || 30} 
                  onChange={(v) => updateNested('agency.max_agency_percentage', v)}
                  suffix="%"
                />
              </div>
              <Toggle 
                label="Require manager approval for agency" 
                value={prefs.agency?.require_manager_approval ?? true} 
                onChange={(v) => updateNested('agency.require_manager_approval', v)}
              />
              <Toggle 
                label="Require reason for agency usage" 
                value={prefs.agency?.require_reason ?? true} 
                onChange={(v) => updateNested('agency.require_reason', v)}
              />
              <Toggle 
                label="Track agency costs" 
                value={prefs.agency?.track_costs ?? false} 
                onChange={(v) => updateNested('agency.track_costs', v)}
              />
            </>
          )}
        </div>
      </Section>

      {/* Shift Preferences */}
      <Section title="Staff Shift Preferences" icon={Shield}>
        <div className="space-y-4">
          <Toggle 
            label="Respect staff shift preferences" 
            value={prefs.preferences?.respect_preferences ?? true} 
            onChange={(v) => updateNested('preferences.respect_preferences', v)}
            help="Check staff preferences when allocating shifts"
          />
          {prefs.preferences?.respect_preferences && (
            <RuleModeSelector 
              label="When preference is violated" 
              value={prefs.preferences?.mode || 'soft'} 
              onChange={(v) => updateNested('preferences.mode', v)} 
            />
          )}
        </div>
      </Section>

      {/* Leave Validation */}
      <Section title="Leave & Availability Validation" icon={FileText}>
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <h4 className="font-medium text-gray-700 text-sm">Annual Leave</h4>
            <RuleModeSelector 
              value={prefs.leave?.annual_leave_mode || 'hard'} 
              onChange={(v) => updateNested('leave.annual_leave_mode', v)} 
            />
          </div>
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <h4 className="font-medium text-gray-700 text-sm">Sick Leave</h4>
            <RuleModeSelector 
              value={prefs.leave?.sick_leave_mode || 'hard'} 
              onChange={(v) => updateNested('leave.sick_leave_mode', v)} 
            />
          </div>
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <h4 className="font-medium text-gray-700 text-sm">Approved Day Off Requests</h4>
            <RuleModeSelector 
              value={prefs.leave?.approved_day_off_mode || 'hard'} 
              onChange={(v) => updateNested('leave.approved_day_off_mode', v)} 
            />
          </div>
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <h4 className="font-medium text-gray-700 text-sm">Pending Day Off Requests</h4>
            <RuleModeSelector 
              value={prefs.leave?.pending_day_off_mode || 'soft'} 
              onChange={(v) => updateNested('leave.pending_day_off_mode', v)} 
            />
          </div>
        </div>
      </Section>

      {/* Shift Confirmation Rules */}
      <Section title="Shift Confirmation Rules" icon={UserCheck} defaultOpen={false}>
        <div className="space-y-4">
          <Toggle 
            label="Require staff to confirm assigned shifts" 
            value={prefs.additional?.shift_confirmation?.require_shift_confirmation ?? false} 
            onChange={(v) => updateNested('additional.shift_confirmation.require_shift_confirmation', v)}
            help="Staff must acknowledge their assigned shifts"
          />
          {prefs.additional?.shift_confirmation?.require_shift_confirmation && (
            <>
              <NumberInput 
                label="Auto-unassign if not confirmed within" 
                value={prefs.additional?.shift_confirmation?.auto_unassign_hours || 24} 
                onChange={(v) => updateNested('additional.shift_confirmation.auto_unassign_hours', v)}
                suffix="hours"
              />
              <Toggle 
                label="Send shift acknowledgement reminder" 
                value={prefs.additional?.shift_confirmation?.send_confirmation_reminder ?? true} 
                onChange={(v) => updateNested('additional.shift_confirmation.send_confirmation_reminder', v)}
              />
              <NumberInput 
                label="Send reminder before shift" 
                value={prefs.additional?.shift_confirmation?.reminder_hours_before || 48} 
                onChange={(v) => updateNested('additional.shift_confirmation.reminder_hours_before', v)}
                suffix="hours"
              />
            </>
          )}
        </div>
      </Section>

      {/* Escalation Rules */}
      <Section title="Escalation Rules (Under-coverage)" icon={Zap} defaultOpen={false}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">When a shift is under-covered, the system can:</p>
          <Toggle 
            label="Auto-notify backup staff" 
            value={prefs.additional?.escalation?.auto_notify_backup_staff ?? true} 
            onChange={(v) => updateNested('additional.escalation.auto_notify_backup_staff', v)}
          />
          <Toggle 
            label="Auto-suggest overtime to available staff" 
            value={prefs.additional?.escalation?.auto_suggest_overtime ?? true} 
            onChange={(v) => updateNested('additional.escalation.auto_suggest_overtime', v)}
          />
          <Toggle 
            label="Auto-suggest agency cover" 
            value={prefs.additional?.escalation?.auto_suggest_agency ?? false} 
            onChange={(v) => updateNested('additional.escalation.auto_suggest_agency', v)}
          />
          <Toggle 
            label="Escalate to regional manager" 
            value={prefs.additional?.escalation?.escalate_to_regional_manager ?? false} 
            onChange={(v) => updateNested('additional.escalation.escalate_to_regional_manager', v)}
          />
          <NumberInput 
            label="Trigger escalation if under-covered for" 
            value={prefs.additional?.escalation?.under_coverage_threshold_hours || 12} 
            onChange={(v) => updateNested('additional.escalation.under_coverage_threshold_hours', v)}
            suffix="hours"
          />
        </div>
      </Section>

      {/* Conflict Detection */}
      <Section title="Conflict & Overlap Detection" icon={AlertTriangle} defaultOpen={false}>
        <div className="space-y-4">
          <Toggle 
            label="Enable conflict detection" 
            value={prefs.conflict_detection_enabled ?? true} 
            onChange={(v) => updateNested('conflict_detection_enabled', v)}
            help="Prevent double booking and overlapping shifts (always hard block)"
          />
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 flex items-center gap-2">
              <XCircle size={16} />
              Conflict detection is always a hard block when enabled
            </p>
          </div>
        </div>
      </Section>

      {/* Audit Settings */}
      <Section title="Override Logging & Audit" icon={FileText} defaultOpen={false}>
        <div className="space-y-4">
          <Toggle 
            label="Log all rule overrides" 
            value={prefs.log_all_overrides ?? true} 
            onChange={(v) => updateNested('log_all_overrides', v)}
            help="Record when managers override soft rules with justification"
          />
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-600">
              Override logs include: Manager ID, timestamp, rule violated, staff involved, justification, and whether agency staff was used.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
};

// LOGIN TAB
const LoginTab = ({ prefs, updateNested }) => {
  if (!prefs) return null;

  const loginPrefs = prefs.login || {};
  const authPrefs = loginPrefs.authentication || {};
  const pinSettings = authPrefs.pin_settings || {};
  const lateEarly = loginPrefs.late_early || {};
  const session = loginPrefs.session || {};

  return (
    <div className="space-y-6">
      {/* PIN Settings */}
      <Section title="PIN Settings" icon={Key} iconColor="bg-purple-100 text-purple-600">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <NumberInput 
              label="PIN Length" 
              value={pinSettings.pin_length || 4} 
              onChange={(v) => updateNested('login.authentication.pin_settings.pin_length', v)}
              min={4}
              max={8}
              suffix="digits"
            />
            <NumberInput 
              label="Max Failed Attempts" 
              value={pinSettings.max_failed_attempts || 5} 
              onChange={(v) => updateNested('login.authentication.pin_settings.max_failed_attempts', v)}
              help="Lock account after this many failed attempts"
            />
            <NumberInput 
              label="Lockout Duration" 
              value={pinSettings.lockout_duration_minutes || 15} 
              onChange={(v) => updateNested('login.authentication.pin_settings.lockout_duration_minutes', v)}
              suffix="minutes"
            />
            <NumberInput 
              label="Require PIN Change Every" 
              value={pinSettings.require_pin_change_days || 0} 
              onChange={(v) => updateNested('login.authentication.pin_settings.require_pin_change_days', v)}
              suffix="days"
              help="0 = disabled"
            />
          </div>
          <Toggle 
            label="Enable progressive delay after failed attempts" 
            value={pinSettings.enable_progressive_delay ?? false} 
            onChange={(v) => updateNested('login.authentication.pin_settings.enable_progressive_delay', v)}
            help="Increases wait time after each failed attempt"
          />
        </div>
      </Section>

      {/* Authentication Mode */}
      <Section title="Authentication Mode" icon={Smartphone} iconColor="bg-purple-100 text-purple-600">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Select how staff authenticate at the kiosk:</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'pin_only', label: 'PIN Only', desc: 'Staff enter PIN only' },
              { value: 'qr_only', label: 'QR Code Only', desc: 'Scan QR from mobile app' },
              { value: 'qr_and_pin', label: 'QR Code + PIN', desc: 'Most secure - both required' }
            ].map(mode => (
              <button
                key={mode.value}
                type="button"
                onClick={() => updateNested('login.authentication.auth_mode', mode.value)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  (authPrefs.auth_mode || 'qr_and_pin') === mode.value
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium text-sm text-gray-900">{mode.label}</p>
                <p className="text-xs text-gray-500 mt-1">{mode.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Late & Early Clock In Controls */}
      <Section title="Late & Early Clock-In Controls" icon={Clock} iconColor="bg-orange-100 text-orange-600">
        <div className="space-y-6">
          {/* Late Controls */}
          <div className="p-4 bg-red-50 rounded-lg space-y-4">
            <h4 className="font-medium text-red-700 flex items-center gap-2">
              <AlertTriangle size={16} />
              Late Clock-In
            </h4>
            <Toggle 
              label="Enable late reason selection" 
              value={lateEarly.enable_late_reason ?? true} 
              onChange={(v) => updateNested('login.late_early.enable_late_reason', v)}
            />
            {lateEarly.enable_late_reason && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <NumberInput 
                    label="Grace period before marked late" 
                    value={lateEarly.late_grace_minutes || 5} 
                    onChange={(v) => updateNested('login.late_early.late_grace_minutes', v)}
                    suffix="minutes"
                  />
                </div>
                <Toggle 
                  label="Late reason is mandatory" 
                  value={lateEarly.late_reason_mandatory ?? true} 
                  onChange={(v) => updateNested('login.late_early.late_reason_mandatory', v)}
                />
                <Toggle 
                  label="Notify manager when staff is late" 
                  value={lateEarly.notify_manager_on_late ?? true} 
                  onChange={(v) => updateNested('login.late_early.notify_manager_on_late', v)}
                />
              </>
            )}
          </div>

          {/* Early Controls */}
          <div className="p-4 bg-green-50 rounded-lg space-y-4">
            <h4 className="font-medium text-green-700 flex items-center gap-2">
              <Clock size={16} />
              Early Clock-In
            </h4>
            <Toggle 
              label="Enable early login reason selection" 
              value={lateEarly.enable_early_reason ?? true} 
              onChange={(v) => updateNested('login.late_early.enable_early_reason', v)}
            />
            {lateEarly.enable_early_reason && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <NumberInput 
                    label="Grace period before marked early" 
                    value={lateEarly.early_grace_minutes || 15} 
                    onChange={(v) => updateNested('login.late_early.early_grace_minutes', v)}
                    suffix="minutes"
                  />
                </div>
                <Toggle 
                  label="Early reason is mandatory" 
                  value={lateEarly.early_reason_mandatory ?? false} 
                  onChange={(v) => updateNested('login.late_early.early_reason_mandatory', v)}
                />
                <Toggle 
                  label="Notify manager when staff is early" 
                  value={lateEarly.notify_manager_on_early ?? false} 
                  onChange={(v) => updateNested('login.late_early.notify_manager_on_early', v)}
                />
              </>
            )}
          </div>
        </div>
      </Section>

      {/* Late / Early Reason Management */}
      <Section title="Late / Early Reason Management" icon={ClipboardList} iconColor="bg-orange-100 text-orange-600" defaultOpen={false}>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <NumberInput 
              label="Maximum reasons displayed" 
              value={lateEarly.max_reasons_displayed || 10} 
              onChange={(v) => updateNested('login.late_early.max_reasons_displayed', v)}
            />
          </div>
          <Toggle 
            label="Enable free text option" 
            value={lateEarly.enable_free_text ?? false} 
            onChange={(v) => updateNested('login.late_early.enable_free_text', v)}
            help="Allow staff to type their own reason"
          />

          <div className="border-t pt-4">
            <ReasonListEditor 
              label="Late Reasons"
              reasons={lateEarly.late_reasons || []}
              onChange={(v) => updateNested('login.late_early.late_reasons', v)}
            />
          </div>

          <div className="border-t pt-4">
            <ReasonListEditor 
              label="Early Clock-In Reasons"
              reasons={lateEarly.early_reasons || []}
              onChange={(v) => updateNested('login.late_early.early_reasons', v)}
            />
          </div>
        </div>
      </Section>

      {/* Staff Session Controls */}
      <Section title="Staff Session Controls" icon={Timer} iconColor="bg-blue-100 text-blue-600">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <NumberInput 
              label="Staff Session Timeout" 
              value={session.staff_session_timeout_minutes || 5} 
              onChange={(v) => updateNested('login.session.staff_session_timeout_minutes', v)}
              suffix="minutes"
              help="Auto-logout for staff kiosk after inactivity"
            />
            <NumberInput 
              label="Manager Session Timeout" 
              value={session.manager_session_timeout_minutes || 60} 
              onChange={(v) => updateNested('login.session.manager_session_timeout_minutes', v)}
              suffix="minutes"
              help="Auto-logout for manager dashboard"
            />
          </div>
          <Toggle 
            label="Auto logout on inactivity" 
            value={session.auto_logout_on_inactivity ?? true} 
            onChange={(v) => updateNested('login.session.auto_logout_on_inactivity', v)}
          />
          <Toggle 
            label="Allow multiple devices simultaneously" 
            value={session.allow_multiple_devices ?? false} 
            onChange={(v) => updateNested('login.session.allow_multiple_devices', v)}
            help="Allow same user to be logged in on multiple devices"
          />
        </div>
      </Section>

      {/* Grace & Tolerance Controls */}
      <Section title="Grace & Tolerance Controls" icon={TrendingUp} iconColor="bg-amber-100 text-amber-600" defaultOpen={false}>
        <div className="space-y-4">
          <NumberInput 
            label="Maximum monthly late occurrences before escalation" 
            value={prefs.additional?.grace_tolerance?.max_monthly_late_occurrences || 3} 
            onChange={(v) => updateNested('additional.grace_tolerance.max_monthly_late_occurrences', v)}
          />
          <Toggle 
            label="Auto flag habitual lateness" 
            value={prefs.additional?.grace_tolerance?.auto_flag_habitual_lateness ?? true} 
            onChange={(v) => updateNested('additional.grace_tolerance.auto_flag_habitual_lateness', v)}
          />
          <NumberInput 
            label="Auto notify manager after threshold reached" 
            value={prefs.additional?.grace_tolerance?.auto_notify_manager_threshold || 3} 
            onChange={(v) => updateNested('additional.grace_tolerance.auto_notify_manager_threshold', v)}
            suffix="occurrences"
          />
          <Toggle 
            label="Auto generate note in staff record" 
            value={prefs.additional?.grace_tolerance?.auto_generate_staff_note ?? true} 
            onChange={(v) => updateNested('additional.grace_tolerance.auto_generate_staff_note', v)}
          />
        </div>
      </Section>

      {/* Attendance Pattern Monitoring */}
      <Section title="Attendance Pattern Monitoring" icon={TrendingUp} iconColor="bg-amber-100 text-amber-600" defaultOpen={false}>
        <div className="space-y-4">
          <Toggle 
            label="Alert if frequent early leave" 
            value={prefs.additional?.attendance_patterns?.alert_frequent_early_leave ?? true} 
            onChange={(v) => updateNested('additional.attendance_patterns.alert_frequent_early_leave', v)}
          />
          <NumberInput 
            label="Early leave threshold (monthly)" 
            value={prefs.additional?.attendance_patterns?.early_leave_threshold_monthly || 3} 
            onChange={(v) => updateNested('additional.attendance_patterns.early_leave_threshold_monthly', v)}
            suffix="occurrences"
          />
          <Toggle 
            label="Alert if excessive overtime" 
            value={prefs.additional?.attendance_patterns?.alert_excessive_overtime ?? true} 
            onChange={(v) => updateNested('additional.attendance_patterns.alert_excessive_overtime', v)}
          />
          <NumberInput 
            label="Overtime alert threshold" 
            value={prefs.additional?.attendance_patterns?.overtime_alert_threshold_hours || 10} 
            onChange={(v) => updateNested('additional.attendance_patterns.overtime_alert_threshold_hours', v)}
            suffix="hours/week"
          />
        </div>
      </Section>
    </div>
  );
};

// REQUESTS TAB
const RequestsTab = ({ prefs, updateNested }) => {
  if (!prefs) return null;

  const requestsPrefs = prefs.requests || {};
  const leavePrefs = requestsPrefs.leave || {};
  const swapPrefs = requestsPrefs.swap || {};

  return (
    <div className="space-y-6">
      {/* Leave Controls */}
      <Section title="Leave Request Controls" icon={CalendarDays} iconColor="bg-green-100 text-green-600">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <NumberInput 
              label="Minimum Notice Days" 
              value={leavePrefs.minimum_notice_days || 14} 
              onChange={(v) => updateNested('requests.leave.minimum_notice_days', v)}
              suffix="days"
              help="How far in advance leave must be requested"
            />
            <NumberInput 
              label="Max Consecutive Leave Days" 
              value={leavePrefs.max_consecutive_leave_days || 14} 
              onChange={(v) => updateNested('requests.leave.max_consecutive_leave_days', v)}
              suffix="days"
              help="Maximum days for a single leave request"
            />
            <NumberInput 
              label="Max Day Off Requests Per Month" 
              value={leavePrefs.max_day_off_requests_per_month || 4} 
              onChange={(v) => updateNested('requests.leave.max_day_off_requests_per_month', v)}
              help="Limit on monthly day-off requests per staff"
            />
          </div>
          
          <div className="border-t pt-4 space-y-4">
            <Toggle 
              label="Block leave during blackout dates" 
              value={leavePrefs.block_blackout_dates ?? false} 
              onChange={(v) => updateNested('requests.leave.block_blackout_dates', v)}
              help="Prevent leave requests during peak periods"
            />
            <Toggle 
              label="Allow emergency leave override" 
              value={leavePrefs.allow_emergency_leave_override ?? true} 
              onChange={(v) => updateNested('requests.leave.allow_emergency_leave_override', v)}
              help="Managers can approve urgent leave that bypasses rules"
            />
          </div>

          <div className="border-t pt-4 space-y-4">
            <Toggle 
              label="Auto-approve short leave requests" 
              value={leavePrefs.auto_approve_short_leave ?? false} 
              onChange={(v) => updateNested('requests.leave.auto_approve_short_leave', v)}
              help="Automatically approve requests below threshold if coverage exists"
            />
            {leavePrefs.auto_approve_short_leave && (
              <NumberInput 
                label="Short leave threshold" 
                value={leavePrefs.short_leave_threshold_days || 3} 
                onChange={(v) => updateNested('requests.leave.short_leave_threshold_days', v)}
                suffix="days"
                help="Requests under this duration can be auto-approved"
              />
            )}
          </div>
        </div>
      </Section>

      {/* Swap Controls */}
      <Section title="Shift Swap Controls" icon={RefreshCw} iconColor="bg-blue-100 text-blue-600">
        <div className="space-y-4">
          <Toggle 
            label="Allow direct swap requests (person to person)" 
            value={swapPrefs.allow_direct_swaps ?? true} 
            onChange={(v) => updateNested('requests.swap.allow_direct_swaps', v)}
            help="Staff can request swaps with specific colleagues"
          />
          <Toggle 
            label="Allow open swap requests (open to team)" 
            value={swapPrefs.allow_open_swaps ?? true} 
            onChange={(v) => updateNested('requests.swap.allow_open_swaps', v)}
            help="Staff can post shifts for anyone to accept"
          />
          <Toggle 
            label="Require manager approval for swaps" 
            value={swapPrefs.require_manager_approval ?? true} 
            onChange={(v) => updateNested('requests.swap.require_manager_approval', v)}
            help="Manager must approve all shift swaps"
          />
          <Toggle 
            label="Auto-approve swaps if rules satisfied" 
            value={swapPrefs.auto_approve_if_rules_satisfied ?? false} 
            onChange={(v) => updateNested('requests.swap.auto_approve_if_rules_satisfied', v)}
            help="Automatically approve if swap doesn't violate any rules"
          />
          <NumberInput 
            label="Swap Request Expiry" 
            value={swapPrefs.swap_request_expiry_hours || 48} 
            onChange={(v) => updateNested('requests.swap.swap_request_expiry_hours', v)}
            suffix="hours"
            help="How long swap requests stay active"
          />
        </div>
      </Section>

      {/* Planner Leave Validation */}
      <Section title="Planner Leave Validation" icon={Shield} iconColor="bg-purple-100 text-purple-600" defaultOpen={false}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            These settings control how the Shift Planner validates leave when assigning shifts.
            Configure the validation modes in the <span className="font-medium">Shift Planner</span> tab.
          </p>
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <h4 className="font-medium text-gray-700 text-sm">Current Settings:</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-600">Annual Leave:</span>
              <span className={`font-medium ${prefs.leave?.annual_leave_mode === 'hard' ? 'text-red-600' : prefs.leave?.annual_leave_mode === 'soft' ? 'text-yellow-600' : 'text-gray-500'}`}>
                {prefs.leave?.annual_leave_mode || 'hard'}
              </span>
              <span className="text-gray-600">Sick Leave:</span>
              <span className={`font-medium ${prefs.leave?.sick_leave_mode === 'hard' ? 'text-red-600' : prefs.leave?.sick_leave_mode === 'soft' ? 'text-yellow-600' : 'text-gray-500'}`}>
                {prefs.leave?.sick_leave_mode || 'hard'}
              </span>
              <span className="text-gray-600">Approved Day Off:</span>
              <span className={`font-medium ${prefs.leave?.approved_day_off_mode === 'hard' ? 'text-red-600' : prefs.leave?.approved_day_off_mode === 'soft' ? 'text-yellow-600' : 'text-gray-500'}`}>
                {prefs.leave?.approved_day_off_mode || 'hard'}
              </span>
              <span className="text-gray-600">Pending Day Off:</span>
              <span className={`font-medium ${prefs.leave?.pending_day_off_mode === 'hard' ? 'text-red-600' : prefs.leave?.pending_day_off_mode === 'soft' ? 'text-yellow-600' : 'text-gray-500'}`}>
                {prefs.leave?.pending_day_off_mode || 'soft'}
              </span>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
};

// ============ MAIN COMPONENT ============

const ControlPreferences = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('planner');
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchPreferences = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/control-preferences`, { headers });
      setPrefs(res.data.preferences);
    } catch (err) {
      console.error('Failed to fetch preferences:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const savePreferences = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/control-preferences`, prefs, { headers });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const updateNested = (path, value) => {
    setPrefs(prev => {
      const newPrefs = JSON.parse(JSON.stringify(prev)); // Deep clone
      const keys = path.split('.');
      let obj = newPrefs;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) {
          obj[keys[i]] = {};
        }
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return newPrefs;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={24} className="animate-spin text-blue-500" />
      </div>
    );
  }

  const tabs = [
    { id: 'planner', label: 'Shift Planner', icon: CalendarDays },
    { id: 'login', label: 'Login', icon: LogIn },
    { id: 'requests', label: 'Requests', icon: ClipboardList },
  ];

  return (
    <div className="max-w-4xl mx-auto" data-testid="control-preferences-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Control Preferences</h1>
          <p className="text-sm text-gray-500">Configure operational rules and settings</p>
        </div>
        <button
          onClick={savePreferences}
          disabled={saving}
          data-testid="save-preferences-btn"
          className={`px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all ${
            saved 
              ? 'bg-green-500 text-white' 
              : 'bg-blue-600 text-white hover:bg-blue-700'
          } disabled:opacity-50`}
        >
          {saving ? <RefreshCw size={18} className="animate-spin" /> : saved ? <CheckCircle size={18} /> : <Save size={18} />}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="flex border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-6 py-4 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'planner' && <ShiftPlannerTab prefs={prefs} updateNested={updateNested} />}
        {activeTab === 'login' && <LoginTab prefs={prefs} updateNested={updateNested} />}
        {activeTab === 'requests' && <RequestsTab prefs={prefs} updateNested={updateNested} />}
      </div>

      {/* Save Button (Bottom) */}
      <div className="flex justify-end py-8">
        <button
          onClick={savePreferences}
          disabled={saving}
          data-testid="save-preferences-btn-bottom"
          className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all ${
            saved 
              ? 'bg-green-500 text-white' 
              : 'bg-blue-600 text-white hover:bg-blue-700'
          } disabled:opacity-50`}
        >
          {saving ? <RefreshCw size={18} className="animate-spin" /> : saved ? <CheckCircle size={18} /> : <Save size={18} />}
          {saving ? 'Saving...' : saved ? 'All Changes Saved!' : 'Save All Changes'}
        </button>
      </div>
    </div>
  );
};

export default ControlPreferences;
