import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Lock, Pencil, Printer, Save, Trash2, Unlock, Upload, X } from 'lucide-react';
import { api } from '../api';
import type { AttendanceRecord, OtSettings } from '../types';
import { formatMoney, toEthiopianDateString } from '../utils/ethiopianCalendar';

interface AttendanceModuleProps {
  currency: string;
  calendarMode: 'Gregorian' | 'Ethiopian';
  onRefreshDashboard: () => void;
}

export const AttendanceModule: React.FC<AttendanceModuleProps> = ({
  currency,
  calendarMode,
  onRefreshDashboard,
}) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [otSettings, setOtSettings] = useState<OtSettings>({
    id: 1,
    ot_regular_multiplier: 1.5,
    ot_night_multiplier: 1.75,
    ot_sunday_multiplier: 2.0,
    ot_holiday_multiplier: 2.5,
    updated_at: '',
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState('');
  const [filterState, setFilterState] = useState<'All' | 'Open' | 'Closed'>('All');
  const [error, setError] = useState<string | null>(null);

  const emptyForm = {
    employee_code: 'SS-EMP-1025',
    employee_name: '',
    department: 'Operations',
    attendance_date: new Date().toISOString().slice(0, 10),
    shift_name: 'Night Shift',
    check_in: '18:00',
    check_out: '05:00',
    hourly_rate: '140',
    regular_hours: '8',
    ot_type: 'Night' as AttendanceRecord['ot_type'],
    ot_hours: '3',
    status: 'Present' as AttendanceRecord['status'],
    notes: '',
  };
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    try {
      const [attData, settingsData] = await Promise.all([
        api.get<AttendanceRecord[]>('/api/attendance'),
        api.get<OtSettings>('/api/ot-settings'),
      ]);
      setRecords(attData);
      setOtSettings(settingsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attendance data');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const currentMultiplier = useMemo(() => {
    switch (form.ot_type) {
      case 'Night':
        return otSettings.ot_night_multiplier;
      case 'Sunday':
        return otSettings.ot_sunday_multiplier;
      case 'Holiday':
        return otSettings.ot_holiday_multiplier;
      case 'Regular':
        return otSettings.ot_regular_multiplier;
      default:
        return 1.0;
    }
  }, [form.ot_type, otSettings]);

  const previewOtPay = useMemo(() => {
    const hrs = Number(form.ot_hours) || 0;
    const rate = Number(form.hourly_rate) || 0;
    return hrs * rate * currentMultiplier;
  }, [form.ot_hours, form.hourly_rate, currentMultiplier]);

  const handleSaveMultipliers = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setError(null);
    try {
      const updated = await api.put<OtSettings>('/api/ot-settings', otSettings);
      setOtSettings(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update OT multipliers');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const payload = {
        ...form,
        hourly_rate: Number(form.hourly_rate) || 100,
        regular_hours: Number(form.regular_hours) || 8,
        ot_hours: Number(form.ot_hours) || 0,
      };
      if (editingId !== null) {
        const updated = await api.put<AttendanceRecord>(`/api/attendance/${editingId}`, payload);
        setRecords((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
        setEditingId(null);
        setForm(emptyForm);
        setNotice(`Saved attendance entry for ${updated.employee_name}.`);
      } else {
        const created = await api.post<AttendanceRecord>('/api/attendance', payload);
        setRecords((prev) => [created, ...prev]);
        setForm(emptyForm);
        setNotice(`Saved attendance entry for ${created.employee_name}.`);
      }
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save attendance record');
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) return;
      const rows = lines.slice(1).map((line) => {
        const cols = line.split(',').map((c) => c.trim());
        return {
          employee_code: cols[0] || 'SS-EMP-CSV',
          employee_name: cols[1] || 'CSV Staff',
          department: cols[2] || 'Operations',
          attendance_date: cols[3] || new Date().toISOString().slice(0, 10),
          check_in: cols[4] || '08:00',
          check_out: cols[5] || '17:00',
          ot_type: cols[6] || 'None',
          ot_hours: Number(cols[7]) || 0,
        };
      });
      await api.post('/api/attendance/import', { rows });
      await loadData();
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV import failed');
    } finally {
      e.target.value = '';
    }
  };

  const handleToggleClosed = async (rec: AttendanceRecord) => {
    setError(null);
    const nextState = rec.register_state === 'Closed' ? 'Open' : 'Closed';
    try {
      const updated = await api.patch<AttendanceRecord>(`/api/attendance/${rec.id}/close`, {
        register_state: nextState,
      });
      setRecords((prev) => prev.map((r) => (r.id === rec.id ? updated : r)));
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update register state');
    }
  };

  const handleCloseAllVisible = async () => {
    setError(null);
    try {
      await api.post('/api/attendance/close-all', { attendance_date: filterDate || undefined });
      await loadData();
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close register');
    }
  };

  const handleRemove = async (id: number) => {
    setError(null);
    try {
      await api.del(`/api/attendance/${id}`);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove attendance record');
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (filterDate && r.attendance_date !== filterDate) return false;
      if (filterState !== 'All' && r.register_state !== filterState) return false;
      return true;
    });
  }, [records, filterDate, filterState]);

  const totals = useMemo(() => {
    return filteredRecords.reduce(
      (acc, r) => {
        acc.regularHours += Number(r.regular_hours) || 0;
        acc.otHours += Number(r.ot_hours) || 0;
        acc.otPay += Number(r.ot_pay) || 0;
        if (r.ot_type === 'Night') acc.nightHours += Number(r.ot_hours) || 0;
        if (r.ot_type === 'Sunday') acc.sundayHours += Number(r.ot_hours) || 0;
        if (r.ot_type === 'Holiday') acc.holidayHours += Number(r.ot_hours) || 0;
        return acc;
      },
      { regularHours: 0, otHours: 0, nightHours: 0, sundayHours: 0, holidayHours: 0, otPay: 0 }
    );
  }, [filteredRecords]);

  return (
    <div className="space-y-6">
      {/* OT Multipliers */}
      <div className="no-print bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#172033] dark:text-white">Overtime (OT) Multiplier Rules</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Configured multipliers apply automatically when logging Attendance Register shifts and Payroll.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#18243A] dark:text-[#38BDF8] bg-[#EAF4FF] px-3 py-1.5 rounded-lg font-mono font-semibold tabular-nums">
            <span>OT Night: {otSettings.ot_night_multiplier}x</span>
            <span>·</span>
            <span>OT Sunday: {otSettings.ot_sunday_multiplier}x</span>
            <span>·</span>
            <span>OT Holiday: {otSettings.ot_holiday_multiplier}x</span>
          </div>
        </div>

        <form onSubmit={handleSaveMultipliers} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Regular OT Multiplier</label>
            <input
              type="number"
              step="0.05"
              value={otSettings.ot_regular_multiplier}
              onChange={(e) => setOtSettings({ ...otSettings, ot_regular_multiplier: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">OT Night Multiplier</label>
            <input
              type="number"
              step="0.05"
              value={otSettings.ot_night_multiplier}
              onChange={(e) => setOtSettings({ ...otSettings, ot_night_multiplier: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">OT Sunday Multiplier</label>
            <input
              type="number"
              step="0.05"
              value={otSettings.ot_sunday_multiplier}
              onChange={(e) => setOtSettings({ ...otSettings, ot_sunday_multiplier: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">OT Holiday Multiplier</label>
            <input
              type="number"
              step="0.05"
              value={otSettings.ot_holiday_multiplier}
              onChange={(e) => setOtSettings({ ...otSettings, ot_holiday_multiplier: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
            >
              <Save className="w-4 h-4" />
              {savingSettings ? 'Saving...' : 'Save Multipliers'}
            </button>
          </div>
        </form>
      </div>

      {/* Log Entry + CSV Import */}
      <div className="no-print bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-base font-bold text-[#172033] dark:text-white">Log Attendance Register Entry</h3>
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#172033] dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg cursor-pointer whitespace-nowrap">
            <Upload className="w-3.5 h-3.5" />
            Import CSV / Device Export
            <input type="file" accept=".csv" onChange={handleCsvImport} className="hidden" />
          </label>
        </div>

        {notice && (
          <div className="mb-4 px-4 py-2.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
            {notice}
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-2.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleAddAttendance} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Employee Code</label>
            <input
              type="text"
              value={form.employee_code}
              onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Employee Name</label>
            <input
              type="text"
              required
              placeholder="Full name"
              value={form.employee_name}
              onChange={(e) => setForm({ ...form, employee_name: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Department</label>
            <input
              type="text"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Date</label>
            <input
              type="date"
              required
              value={form.attendance_date}
              onChange={(e) => setForm({ ...form, attendance_date: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Shift</label>
            <select
              value={form.shift_name}
              onChange={(e) => setForm({ ...form, shift_name: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              <option value="Day Shift">Day Shift</option>
              <option value="Night Shift">Night Shift</option>
              <option value="Sunday Shift">Sunday Shift</option>
              <option value="Public Holiday">Public Holiday</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Check In</label>
            <input
              type="time"
              value={form.check_in}
              onChange={(e) => setForm({ ...form, check_in: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Check Out</label>
            <input
              type="time"
              value={form.check_out}
              onChange={(e) => setForm({ ...form, check_out: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Hourly Rate</label>
            <input
              type="number"
              step="0.5"
              value={form.hourly_rate}
              onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">OT Category</label>
            <select
              value={form.ot_type}
              onChange={(e) => setForm({ ...form, ot_type: e.target.value as AttendanceRecord['ot_type'] })}
              className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              <option value="None">None (1.0x)</option>
              <option value="Regular">Regular OT ({otSettings.ot_regular_multiplier}x)</option>
              <option value="Night">OT Night ({otSettings.ot_night_multiplier}x)</option>
              <option value="Sunday">OT Sunday ({otSettings.ot_sunday_multiplier}x)</option>
              <option value="Holiday">OT Holiday ({otSettings.ot_holiday_multiplier}x)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">OT Hours</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={form.ot_hours}
              onChange={(e) => setForm({ ...form, ot_hours: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div className="flex items-end gap-1.5">
            {editingId !== null && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
                className="px-2.5 py-2 text-sm font-semibold text-[#172033] bg-slate-100 hover:bg-slate-200 rounded-lg"
                title="Cancel Edit"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
            >
              <Save className="w-4 h-4" />
              {editingId !== null ? 'Save Entry' : `Save (${formatMoney(previewOtPay, currency)})`}
            </button>
          </div>
        </form>
      </div>

      {/* Attendance Register Table with Remove & Closed */}
      <div className="no-print bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-[#172033] dark:text-white">Attendance Register</h3>
            <span className="text-xs text-slate-500 font-mono tabular-nums">{filteredRecords.length} records</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-[#F8FAFC] dark:bg-slate-800"
            />
            {filterDate && (
              <button
                type="button"
                onClick={() => setFilterDate('')}
                className="px-2.5 py-1.5 text-xs text-slate-600 bg-slate-100 rounded-lg"
              >
                Clear
              </button>
            )}
            <div className="flex items-center gap-1 p-1 bg-[#F8FAFC] dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              {(['All', 'Open', 'Closed'] as const).map((state) => (
                <button
                  key={state}
                  type="button"
                  onClick={() => setFilterState(state)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    filterState === state ? 'bg-[#18243A] text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {state}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleCloseAllVisible}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] border border-[#087CEB]/30 hover:bg-[#BFDBFE] rounded-lg whitespace-nowrap"
            >
              <Lock className="w-3.5 h-3.5" />
              Close All Open
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#18243A] hover:bg-[#243656] rounded-lg whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              Print View
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#18243A] text-white text-xs font-semibold">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Date & Shift</th>
                <th className="py-3 px-4">In / Out</th>
                <th className="py-3 px-4 text-right">Reg Hrs</th>
                <th className="py-3 px-4">OT Type & Mult</th>
                <th className="py-3 px-4 text-right">OT Pay</th>
                <th className="py-3 px-4">Register</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {filteredRecords.map((rec) => (
                <tr key={rec.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-[#172033] dark:text-white">{rec.employee_name}</div>
                    <div className="text-xs text-slate-500 font-mono">
                      {rec.employee_code} · {rec.department}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-mono text-xs text-[#172033] dark:text-slate-200 tabular-nums">
                      {calendarMode === 'Ethiopian' ? toEthiopianDateString(rec.attendance_date) : rec.attendance_date}
                    </div>
                    <div className="text-xs text-slate-500">{rec.shift_name}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums">
                    {rec.check_in} – {rec.check_out}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                    {rec.regular_hours.toFixed(1)}h
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <span className="font-medium text-[#172033] dark:text-white">{rec.ot_type}</span>
                    <span className="text-slate-500 font-mono tabular-nums">
                      {' '}· {rec.ot_hours}h × {rec.ot_multiplier}x
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums">
                    {formatMoney(rec.ot_pay, currency)}
                  </td>
                  <td className="py-3 px-4 text-xs font-semibold">
                    <span className={rec.register_state === 'Closed' ? 'text-slate-600 dark:text-slate-400' : 'text-emerald-700 dark:text-emerald-400'}>
                      {rec.register_state}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleClosed(rec)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap ${
                          rec.register_state === 'Closed'
                            ? 'text-[#172033] bg-slate-100 hover:bg-slate-200'
                            : 'text-[#18243A] bg-[#DBEAFE] border border-[#087CEB]/30 hover:bg-[#BFDBFE]'
                        }`}
                      >
                        {rec.register_state === 'Closed' ? (
                          <>
                            <Unlock className="w-3.5 h-3.5" />
                            Reopen
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            Closed
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(rec.id);
                          setForm({
                            employee_code: rec.employee_code,
                            employee_name: rec.employee_name,
                            department: rec.department,
                            attendance_date: rec.attendance_date,
                            shift_name: rec.shift_name,
                            check_in: rec.check_in,
                            check_out: rec.check_out,
                            hourly_rate: String(rec.hourly_rate),
                            regular_hours: String(rec.regular_hours),
                            ot_type: rec.ot_type,
                            ot_hours: String(rec.ot_hours),
                            status: rec.status,
                            notes: rec.notes || '',
                          });
                        }}
                        className="p-1.5 text-[#172033] bg-slate-100 hover:bg-slate-200 rounded-lg"
                        title="Edit Entry"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(rec.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PRINTER VIEW ON BOTTOM SIDE */}
      <div className="print-only-container bg-[#FFFFFF] border-t-4 border-t-[#087CEB] border border-slate-300 rounded-xl p-6 text-[#172033]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-300">
          <div>
            <img
              src="/assets/aistudio/Seven_Sunday_Logo_2_desktop_addf2fa7.png"
              alt="Seven Sunday Ethiopia"
              className="h-10 w-auto object-contain mb-1"
            />
            <h3 className="text-base font-bold text-[#18243A]">
              Seven Sunday Manufacturing & Trading PLC — Attendance Register Printer View
            </h3>
            <p className="text-xs text-slate-600">
              Night {otSettings.ot_night_multiplier}x · Sunday {otSettings.ot_sunday_multiplier}x · Holiday {otSettings.ot_holiday_multiplier}x · The Home of quality product
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="no-print inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4" />
            Print Register Sheet
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 py-4 border-b border-slate-200 text-xs">
          <div>
            <span className="text-slate-500 block">Entries Listed</span>
            <span className="font-mono font-bold text-[#172033] text-sm tabular-nums">{filteredRecords.length}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Regular Hours</span>
            <span className="font-mono font-bold text-[#172033] text-sm tabular-nums">{totals.regularHours.toFixed(1)} hrs</span>
          </div>
          <div>
            <span className="text-slate-500 block">Night OT ({otSettings.ot_night_multiplier}x)</span>
            <span className="font-mono font-bold text-[#172033] text-sm tabular-nums">{totals.nightHours.toFixed(1)} hrs</span>
          </div>
          <div>
            <span className="text-slate-500 block">Sunday / Holiday OT</span>
            <span className="font-mono font-bold text-[#172033] text-sm tabular-nums">
              {totals.sundayHours.toFixed(1)}h / {totals.holidayHours.toFixed(1)}h
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Total OT Payroll</span>
            <span className="font-mono font-bold text-[#172033] text-sm tabular-nums">{formatMoney(totals.otPay, currency)}</span>
          </div>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-[#18243A] text-[#18243A] font-bold">
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Employee Name</th>
                <th className="py-2 pr-3">Department</th>
                <th className="py-2 pr-3">Date (G.C. / E.C.)</th>
                <th className="py-2 pr-3">In - Out</th>
                <th className="py-2 pr-3 text-right">Reg</th>
                <th className="py-2 pr-3">OT Type</th>
                <th className="py-2 pr-3 text-right">OT Hrs × Mult</th>
                <th className="py-2 pr-3 text-right">OT Pay</th>
                <th className="py-2 text-right">Register</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredRecords.map((rec) => (
                <tr key={`print-${rec.id}`}>
                  <td className="py-2 pr-3 font-mono">{rec.employee_code}</td>
                  <td className="py-2 pr-3 font-medium">{rec.employee_name}</td>
                  <td className="py-2 pr-3">{rec.department}</td>
                  <td className="py-2 pr-3 font-mono tabular-nums">
                    {rec.attendance_date} / {toEthiopianDateString(rec.attendance_date)}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums">{rec.check_in}–{rec.check_out}</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">{rec.regular_hours.toFixed(1)}</td>
                  <td className="py-2 pr-3">{rec.ot_type}</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">
                    {rec.ot_hours.toFixed(1)} × {rec.ot_multiplier}x
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">{formatMoney(rec.ot_pay, currency)}</td>
                  <td className="py-2 text-right font-medium">{rec.register_state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8 pt-6 border-t border-slate-200 text-xs text-slate-600 print-break-avoid">
          <div>
            <div className="h-8 border-b border-slate-300 mb-1" />
            <span>Prepared By (HR / Timekeeper)</span>
          </div>
          <div>
            <div className="h-8 border-b border-slate-300 mb-1" />
            <span>Verified By (Secretary Department)</span>
          </div>
          <div>
            <div className="h-8 border-b border-slate-300 mb-1 flex items-end justify-end">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#087CEB] mb-1" />
            </div>
            <span>Approved By (Operations / Finance Director)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
