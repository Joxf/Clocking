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
  Info
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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
const NumberInput = ({ label, value, onChange, min = 0, max = 999, suffix = '', help }) => (
  <div className="space-y-1">
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
const Toggle = ({ label, value, onChange, help }) => (
  <div className="flex items-center justify-between py-2">
    <div>
      <p className="text-sm text-gray-700">{label}</p>
      {help && <p className="text-[10px] text-gray-400">{help}</p>}
    </div>
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-blue-500' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${value ? 'left-6' : 'left-1'}`} />
    </button>
  </div>
);

// Section Component
const Section = ({ title, icon: Icon, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <Icon size={18} className="text-blue-600" />
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
        <NumberInput label="Min Total" value={data.min_total} onChange={(v) => update('min_total', v)} />
        <NumberInput label="Min Nurses" value={data.min_nurses} onChange={(v) => update('min_nurses', v)} />
        <NumberInput label="Min Sr. Carers" value={data.min_senior_carers} onChange={(v) => update('min_senior_carers', v)} />
        <NumberInput label="Min Carers" value={data.min_carers} onChange={(v) => update('min_carers', v)} />
        <NumberInput label="Activities" value={data.min_activities} onChange={(v) => update('min_activities', v)} />
        <NumberInput label="Kitchen" value={data.min_kitchen} onChange={(v) => update('min_kitchen', v)} />
        <NumberInput label="Domestic" value={data.min_domestic} onChange={(v) => update('min_domestic', v)} />
      </div>
    </div>
  );
};

// Main Control Preferences Page
const ControlPreferences = () => {
  const { token } = useAuth();
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
      const newPrefs = { ...prev };
      const keys = path.split('.');
      let obj = newPrefs;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...obj[keys[i]] };
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

  if (!prefs) {
    return (
      <div className="text-center py-12 text-gray-500">
        Failed to load preferences
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Control Preferences</h1>
          <p className="text-sm text-gray-500">Configure operational rules for the Shift Planner</p>
        </div>
        <button
          onClick={savePreferences}
          disabled={saving}
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

      {/* Save Button (Bottom) */}
      <div className="flex justify-end pb-8">
        <button
          onClick={savePreferences}
          disabled={saving}
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
