import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Fingerprint,
  Lock,
  Pencil,
  Printer,
  Save,
  Trash2,
  Unlock,
  Upload,
  X,
} from 'lucide-react';
import { api, getApiTenantId } from '../api';
import type { WsEventPayload } from '../hooks/useRealtimeWS';
import type {
  AttendanceRecord,
  EmployeeProfile,
  OtSettings,
  ShiftDefinition,
  StaffScheduleRecord,
  UserRole,
  WorkforceRules,
} from '../types';
import {
  ETHIOPIAN_SHIFT_WINDOWS,
  formatEthiopianLocalTime,
  formatMoney,
  toEthiopianDateString,
} from '../utils/ethiopianCalendar';
import { printWithAutoFit } from '../utils/printFit';
import { ShareButton } from './ShareButton';

interface AttendanceModuleProps {
  currency: string;
  calendarMode: 'Gregorian' | 'Ethiopian';
  currentUserRole?: UserRole;
  lastWsEvent?: WsEventPayload | null;
  onRefreshDashboard: () => void;
}

const ATTENDANCE_MANAGER_ROLES = new Set<string>([
  'System Administrator',
  'Super Administrator',
  'Company Owner',
  'General Manager',
  'Human Resource Manager',
  'Department Manager',
  'Attendance Officer',
  'Security Supervisor',
]);

const HIGH_ADMIN_ROLES = new Set<string>([
  'System Administrator',
  'Super Administrator',
  'Company Owner',
  'General Manager',
  'Human Resource Manager',
  'Department Manager',
]);

function timeToMin(t: string): number {
  const m = String(t || '').match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

function diffMin(s: string, e: string): number {
  const a = timeToMin(s);
  let b = timeToMin(e);
  if (b <= a) b += 1440;
  return Math.max(0, b - a);
}

function nowTimeHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const AttendanceModule: React.FC<AttendanceModuleProps> = ({
  currency,
  calendarMode,
  currentUserRole = 'Super Administrator',
  lastWsEvent,
  onRefreshDashboard,
}) => {
  const canEditRecords = ATTENDANCE_MANAGER_ROLES.has(currentUserRole);
  const canModifyClosedOrDelete = HIGH_ADMIN_ROLES.has(currentUserRole);

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [shifts, setShifts] = useState<ShiftDefinition[]>([]);
  const [schedules, setSchedules] = useState<StaffScheduleRecord[]>([]);
  const [rules, setRules] = useState<WorkforceRules>({
    late_grace_minutes: 15,
    early_departure_grace_minutes: 10,
    default_break_minutes: 60,
    min_rest_hours_between_shifts: 11,
    auto_detect_conflicts: 1,
    require_manager_approval: 1,
    default_shift_system: '3-Shift',
  });
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState('');
  const [filterDept, setFilterDept] = useState('All');
  const [filterPeriod, setFilterPeriod] = useState<'All' | 'Morning' | 'Afternoon' | 'Night' | 'Day'>('All');
  const [filterState, setFilterState] = useState<'All' | 'Open' | 'Closed'>('All');
  const [error, setError] = useState<string | null>(null);

  const todayIso = new Date().toISOString().slice(0, 10);

  const emptyForm = {
    employee_code: '',
    employee_name: '',
    department: 'Operations',
    attendance_date: todayIso,
    shift_id: '',
    shift_name: 'Morning Shift',
    shift_period: 'Morning' as NonNullable<AttendanceRecord['shift_period']>,
    scheduled_start: '08:00',
    scheduled_end: '12:00',
    check_in: '07:45',
    check_out: '12:00',
    morning_check_in: '07:45',
    morning_check_out: '12:00',
    afternoon_check_in: '',
    afternoon_check_out: '',
    night_check_in: '',
    night_check_out: '',
    break_minutes: '0',
    hourly_rate: '100',
    regular_hours: '',
    ot_type: 'None' as AttendanceRecord['ot_type'],
    ot_hours: '',
    status: 'Auto' as string,
    notes: '',
  };
  const [form, setForm] = useState(emptyForm);

  const applyEmployeeSelection = (
    empCode: string,
    empList: EmployeeProfile[],
    schedList: StaffScheduleRecord[],
    shiftList: ShiftDefinition[],
    targetDate: string
  ) => {
    const emp = empList.find((e) => e.employee_id === empCode);
    const sched = schedList.find(
      (s) => s.employee_id === empCode && s.schedule_date === targetDate && s.approval_status !== 'Rejected'
    );
    const sh = sched
      ? shiftList.find((x) => x.id === sched.shift_id || x.shift_name === sched.shift_name)
      : shiftList.find((x) => x.shift_code === 'SHF-MRN') || shiftList[0];

    const sName = sched?.shift_name || sh?.shift_name || 'Morning Shift';
    const lower = sName.toLowerCase();
    const period: NonNullable<AttendanceRecord['shift_period']> = lower.includes('morning')
      ? 'Morning'
      : lower.includes('afternoon')
      ? 'Afternoon'
      : lower.includes('night')
      ? 'Night'
      : lower.includes('security')
      ? 'Security'
      : lower.includes('weekend')
      ? 'Weekend'
      : lower.includes('holiday')
      ? 'Holiday'
      : 'Day';
    const fallbackStart = period === 'Morning' || period === 'Day' ? '08:00' : period === 'Afternoon' ? '13:00' : period === 'Night' ? '19:00' : '08:00';
    const fallbackEnd = period === 'Morning' ? '12:00' : period === 'Afternoon' || period === 'Day' ? '17:00' : period === 'Night' ? '02:00' : '17:00';
    const sStart = sched?.start_time || sh?.start_time || fallbackStart;
    const sEnd = sched?.end_time || sh?.end_time || fallbackEnd;
    const brk = String(sched?.break_minutes ?? sh?.break_minutes ?? (period === 'Day' ? 60 : 0));

    setForm((prev) => ({
      ...prev,
      employee_code: emp?.employee_id || empCode,
      employee_name: emp?.full_name || prev.employee_name,
      department: emp?.department || prev.department,
      hourly_rate: emp?.basic_salary ? (emp.basic_salary / 208).toFixed(2) : prev.hourly_rate,
      shift_id: sh ? String(sh.id) : '',
      shift_name: sName,
      shift_period: period,
      scheduled_start: sStart,
      scheduled_end: sEnd,
      check_in: sStart,
      check_out: sEnd,
      morning_check_in: period === 'Morning' || period === 'Day' ? sStart : '',
      morning_check_out: period === 'Morning' ? sEnd : period === 'Day' ? '12:00' : '',
      afternoon_check_in: period === 'Afternoon' ? sStart : period === 'Day' ? '13:00' : '',
      afternoon_check_out: period === 'Afternoon' || period === 'Day' ? sEnd : '',
      night_check_in: period === 'Night' || period === 'Security' ? sStart : '',
      night_check_out: period === 'Night' || period === 'Security' ? sEnd : '',
      break_minutes: brk,
    }));
  };

  const loadData = async () => {
    try {
      const [attData, settingsData, empData, shiftData, schedData, ruleData] = await Promise.all([
        api.get<AttendanceRecord[]>('/api/attendance'),
        api.get<OtSettings>('/api/ot-settings'),
        api.get<EmployeeProfile[]>('/api/employees'),
        api.get<ShiftDefinition[]>('/api/shifts'),
        api.get<StaffScheduleRecord[]>('/api/scheduling'),
        api.get<WorkforceRules>('/api/workforce-rules'),
      ]);
      setRecords(attData);
      setOtSettings(settingsData);
      setEmployees(empData);
      setShifts(shiftData);
      setSchedules(schedData);
      setRules(ruleData);
      if (!form.employee_code && empData.length > 0 && editingId === null) {
        const first = empData.find((e) => e.status === 'Active') || empData[0];
        applyEmployeeSelection(first.employee_id, empData, schedData, shiftData, todayIso);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attendance data');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const lastHandledWsRef = useRef<WsEventPayload | null>(null);
  useEffect(() => {
    if (!lastWsEvent || lastWsEvent === lastHandledWsRef.current) return;
    lastHandledWsRef.current = lastWsEvent;
    const evtName = lastWsEvent.event;
    if (evtName !== 'attendance:updated' && evtName !== 'device:punch' && evtName !== 'biometric:auth_log') {
      return;
    }
    const payload = (lastWsEvent.payload || {}) as Record<string, unknown>;
    const activeTenant = getApiTenantId();
    if (payload.tenant_id !== undefined && Number(payload.tenant_id) !== activeTenant) {
      return;
    }
    if (evtName === 'biometric:auth_log' && payload.status !== 'Success') {
      return;
    }
    loadData();
    if (evtName === 'biometric:auth_log' && payload.attendance_marked) {
      setNotice(
        `Live biometric scan verified for ${String(payload.employee_name || payload.employee_code || 'staff')} — Attendance Register synced.`
      );
    } else if (evtName === 'attendance:updated' && payload.source === 'biometric') {
      setNotice('Live biometric update received — Attendance Register synced.');
    }
  }, [lastWsEvent]);

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

  // Live automatic calculation preview (Late, Early Exit, Regular Hours, Absence, OT Pay)
  const livePreview = useMemo(() => {
    const firstIn =
      form.morning_check_in || form.afternoon_check_in || form.night_check_in || form.check_in || form.scheduled_start;
    const lastOut =
      form.night_check_out || form.afternoon_check_out || form.morning_check_out || form.check_out || form.scheduled_end;
    const brk = Number(form.break_minutes) || 0;
    const isAbsentOrLeave = form.status === 'Absent' || form.status === 'On Leave';

    if (isAbsentOrLeave) {
      const schedNet = Math.max(0, (diffMin(form.scheduled_start, form.scheduled_end) - brk) / 60);
      return {
        firstIn: '--:--',
        lastOut: '--:--',
        lateMins: 0,
        earlyMins: 0,
        absenceHours: Number(schedNet.toFixed(2)),
        regHours: 0,
        otHours: 0,
        otPay: 0,
        status: form.status,
      };
    }

    const activeShift = shifts.find((s) => String(s.id) === form.shift_id);
    const period = form.shift_period;
    const hasSplit = Boolean(form.morning_check_in && form.afternoon_check_in);
    const isEthStandard = period === 'Morning' || period === 'Afternoon' || period === 'Night' || period === 'Day';
    const lateGrace = Number(activeShift?.grace_late_minutes ?? (isEthStandard ? 0 : rules.late_grace_minutes ?? 15));
    const earlyGrace = isEthStandard ? 2 : Number(rules.early_departure_grace_minutes ?? 10);

    let lateMins = 0;
    let earlyMins = 0;
    let regHours = 0;
    let autoOtHours = 0;

    if (period === 'Morning' && !form.afternoon_check_in && !form.afternoon_check_out) {
      const mIn = timeToMin(form.morning_check_in || firstIn);
      const mOut = timeToMin(form.morning_check_out || lastOut);
      lateMins = mIn - 8 * 60 > lateGrace ? mIn - 8 * 60 : 0;
      earlyMins = 12 * 60 - mOut > 2 ? 12 * 60 - mOut : 0;
      regHours = Number(Math.min(4, Math.max(0, (mOut - Math.max(mIn, 7 * 60 + 45)) / 60)).toFixed(2));
      if (mOut >= 17 * 60 + 10) {
        autoOtHours = Number(((Math.min(mOut, 19 * 60) - (17 * 60 + 10)) / 60).toFixed(2));
      }
    } else if (period === 'Afternoon' && !form.morning_check_in && !form.morning_check_out) {
      const aIn = timeToMin(form.afternoon_check_in || firstIn);
      const aOut = timeToMin(form.afternoon_check_out || lastOut);
      lateMins = aIn - 13 * 60 > lateGrace ? aIn - 13 * 60 : 0;
      earlyMins = 17 * 60 - aOut > 2 ? 17 * 60 - aOut : 0;
      regHours = Number(Math.min(4, Math.max(0, (Math.min(aOut, 17 * 60) - Math.max(aIn, 12 * 60 + 50)) / 60)).toFixed(2));
      if (aOut >= 17 * 60 + 10) {
        autoOtHours = Number(((Math.min(aOut, 19 * 60) - (17 * 60 + 10)) / 60).toFixed(2));
      }
    } else if (period === 'Day' || hasSplit) {
      const finalOut = form.afternoon_check_out || lastOut;
      const finalOutMin = timeToMin(finalOut);
      if (hasSplit) {
        const mIn = timeToMin(form.morning_check_in);
        const mOut = timeToMin(form.morning_check_out || '12:00');
        const mLate = mIn - 8 * 60 > lateGrace ? mIn - 8 * 60 : 0;
        const mEarly = form.morning_check_out && 12 * 60 - mOut > 2 ? 12 * 60 - mOut : 0;
        const mHrs = form.morning_check_out ? Math.min(4, Math.max(0, (Math.min(mOut, 12 * 60 + 30) - Math.max(mIn, 7 * 60 + 45)) / 60)) : 0;

        const aIn = timeToMin(form.afternoon_check_in);
        const aOut = timeToMin(finalOut);
        const aLate = aIn - 13 * 60 > lateGrace ? aIn - 13 * 60 : 0;
        const aEarly = 17 * 60 - aOut > 2 ? 17 * 60 - aOut : 0;
        const aHrs = Math.min(4, Math.max(0, (Math.min(aOut, 17 * 60) - Math.max(aIn, 12 * 60 + 50)) / 60));

        lateMins = mLate + aLate;
        earlyMins = mEarly + aEarly;
        regHours = Number(Math.min(8, mHrs + aHrs).toFixed(2));
      } else {
        const inMin = timeToMin(firstIn);
        lateMins = inMin - 8 * 60 > lateGrace ? inMin - 8 * 60 : 0;
        earlyMins = 17 * 60 - finalOutMin > 2 ? 17 * 60 - finalOutMin : 0;
        regHours = Number(Math.min(8, Math.max(0, (Math.min(finalOutMin, 17 * 60) - Math.max(inMin, 7 * 60 + 45) - brk) / 60)).toFixed(2));
      }
      if (finalOutMin >= 17 * 60 + 10) {
        autoOtHours = Number(((Math.min(finalOutMin, 19 * 60) - (17 * 60 + 10)) / 60).toFixed(2));
      }
    } else if (period === 'Night') {
      const rawIn = timeToMin(form.night_check_in || firstIn);
      const inRel = rawIn < 12 * 60 ? rawIn + 1440 : rawIn;
      const rawOut = timeToMin(form.night_check_out || lastOut);
      let outRel = rawOut <= 12 * 60 ? rawOut + 1440 : rawOut;
      if (outRel <= inRel) outRel += 1440;

      lateMins = inRel - 19 * 60 > lateGrace ? inRel - 19 * 60 : 0;
      earlyMins = 26 * 60 - outRel > 2 ? 26 * 60 - outRel : 0;
      const regEnd = Math.min(outRel, 26 * 60 + 10);
      regHours = Number(Math.min(7, Math.max(0, (regEnd - Math.max(inRel, 18 * 60 + 50)) / 60)).toFixed(2));
      if (outRel > 26 * 60 + 10) {
        autoOtHours = Number(((Math.min(outRel, 31 * 60) - (26 * 60 + 10)) / 60).toFixed(2));
      }
    } else {
      const schedInMin = timeToMin(form.scheduled_start);
      const actualInMin = timeToMin(firstIn);
      const rawLate = actualInMin - schedInMin;
      lateMins = rawLate > lateGrace ? rawLate : 0;

      const schedDur = diffMin(form.scheduled_start, form.scheduled_end);
      const actualDur = diffMin(firstIn, lastOut);
      const rawEarly = schedDur - (actualInMin - schedInMin + actualDur);
      earlyMins = rawEarly > earlyGrace ? rawEarly : 0;

      const actualNetHrs = Math.max(0, (actualDur - brk) / 60);
      const schedNetHrs = Math.max(0, (schedDur - brk) / 60);
      regHours = Number(Math.min(8, actualNetHrs).toFixed(2));
      autoOtHours = actualNetHrs > schedNetHrs + 0.25 ? Number((actualNetHrs - schedNetHrs).toFixed(2)) : 0;
    }

    const finalRegHours = form.regular_hours ? Number(form.regular_hours) : regHours;
    const otHours = form.ot_hours ? Number(form.ot_hours) : autoOtHours;
    const absenceHours = Number(((lateMins + earlyMins) / 60).toFixed(2));
    const rate = Number(form.hourly_rate) || 0;
    const effMult =
      form.ot_type === 'None' && otHours > 0
        ? period === 'Night'
          ? otSettings.ot_night_multiplier
          : otSettings.ot_regular_multiplier
        : currentMultiplier;
    const otPay = form.ot_type === 'None' && otHours === 0 ? 0 : otHours * rate * effMult;

    let derivedStatus = form.status;
    if (derivedStatus === 'Auto') {
      if (lateMins > 0 && earlyMins > 0) derivedStatus = 'Late & Early';
      else if (lateMins > 0) derivedStatus = 'Late';
      else if (earlyMins > 0) derivedStatus = 'Early Exit';
      else if (finalRegHours > 0 && finalRegHours < 3.5) derivedStatus = 'Half-Day';
      else derivedStatus = 'Present';
    }

    return {
      firstIn,
      lastOut,
      lateMins,
      earlyMins,
      absenceHours,
      regHours: finalRegHours,
      otHours,
      otPay,
      status: derivedStatus,
    };
  }, [form, rules, shifts, otSettings, currentMultiplier]);

  const handleSaveMultipliers = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setError(null);
    try {
      const updated = await api.put<OtSettings>('/api/ot-settings', otSettings);
      setOtSettings(updated);
      setNotice('Overtime multipliers saved.');
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
        shift_id: form.shift_id ? Number(form.shift_id) : null,
        check_in: livePreview.firstIn,
        check_out: livePreview.lastOut,
        break_minutes: Number(form.break_minutes) || 0,
        hourly_rate: Number(form.hourly_rate) || 100,
        regular_hours: form.regular_hours !== '' ? Number(form.regular_hours) : undefined,
        ot_hours: form.ot_hours !== '' ? Number(form.ot_hours) : undefined,
      };
      if (editingId !== null) {
        const updated = await api.put<AttendanceRecord>(`/api/attendance/${editingId}`, payload);
        setRecords((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
        setEditingId(null);
        setNotice(`Corrected & logged audit entry for ${updated.employee_name} (${updated.status}).`);
      } else {
        const created = await api.post<AttendanceRecord>('/api/attendance', payload);
        setRecords((prev) => [created, ...prev]);
        setNotice(`Recorded ${created.shift_period || 'Day'} attendance for ${created.employee_name} (${created.status}).`);
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
          attendance_date: cols[3] || todayIso,
          check_in: cols[4] || '08:00',
          check_out: cols[5] || '17:00',
          ot_type: cols[6] || 'None',
          ot_hours: Number(cols[7]) || 0,
        };
      });
      await api.post('/api/attendance/import', { rows });
      await loadData();
      onRefreshDashboard();
      setNotice(`Imported ${rows.length} attendance punches from CSV.`);
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
      setNotice('All matching attendance registers closed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close register');
    }
  };

  const executeRemove = async (id: number) => {
    setError(null);
    try {
      await api.del(`/api/attendance/${id}`);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setConfirmDeleteId(null);
      setNotice(`Removed attendance entry #${id}.`);
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove attendance record');
    }
  };

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => set.add(e.department));
    records.forEach((r) => set.add(r.department));
    return Array.from(set).sort();
  }, [employees, records]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (filterDate && r.attendance_date !== filterDate) return false;
      if (filterDept !== 'All' && r.department !== filterDept) return false;
      if (filterPeriod !== 'All' && (r.shift_period || 'Day') !== filterPeriod) return false;
      if (filterState !== 'All' && r.register_state !== filterState) return false;
      return true;
    });
  }, [records, filterDate, filterDept, filterPeriod, filterState]);

  const totals = useMemo(() => {
    return filteredRecords.reduce(
      (acc, r) => {
        acc.regularHours += Number(r.regular_hours) || 0;
        acc.otHours += Number(r.ot_hours) || 0;
        acc.otPay += Number(r.ot_pay) || 0;
        acc.lateMinutes += Number(r.late_minutes) || 0;
        acc.earlyMinutes += Number(r.early_departure_minutes) || 0;
        acc.absenceHours += Number(r.absence_hours) || 0;
        if (r.ot_type === 'Night' || r.shift_period === 'Night') acc.nightHours += Number(r.ot_hours) || 0;
        if (r.ot_type === 'Sunday') acc.sundayHours += Number(r.ot_hours) || 0;
        if (r.ot_type === 'Holiday') acc.holidayHours += Number(r.ot_hours) || 0;
        return acc;
      },
      { regularHours: 0, otHours: 0, nightHours: 0, sundayHours: 0, holidayHours: 0, otPay: 0, lateMinutes: 0, earlyMinutes: 0, absenceHours: 0 }
    );
  }, [filteredRecords]);

  return (
    <div className="space-y-6">
      {/* OT Multipliers */}
      {canModifyClosedOrDelete && (
        <div className="no-print bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-bold text-[#172033] dark:text-white">Overtime (OT) & Shift Grace Rules</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Late Grace: {rules.late_grace_minutes}m · Early Exit Grace: {rules.early_departure_grace_minutes}m · Default Break: {rules.default_break_minutes}m
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#18243A] dark:text-[#38BDF8] bg-[#EAF4FF] dark:bg-slate-800 px-3 py-1.5 rounded-lg font-mono font-semibold tabular-nums">
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
                className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">OT Night Multiplier</label>
              <input
                type="number"
                step="0.05"
                value={otSettings.ot_night_multiplier}
                onChange={(e) => setOtSettings({ ...otSettings, ot_night_multiplier: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">OT Sunday Multiplier</label>
              <input
                type="number"
                step="0.05"
                value={otSettings.ot_sunday_multiplier}
                onChange={(e) => setOtSettings({ ...otSettings, ot_sunday_multiplier: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">OT Holiday Multiplier</label>
              <input
                type="number"
                step="0.05"
                value={otSettings.ot_holiday_multiplier}
                onChange={(e) => setOtSettings({ ...otSettings, ot_holiday_multiplier: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
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
      )}

      {/* Morning / Afternoon / Night Shift Attendance Recorder */}
      <div className="no-print bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-[#172033] dark:text-white">
              {editingId !== null ? `Edit / Correct Attendance Record #${editingId}` : 'Staff Attendance Recorder (Morning · Afternoon · Night)'}
            </h3>
            <p className="text-xs text-slate-500">
              Automatically links central employees & scheduled shifts to compute late arrivals, early departures, breaks, overtime & absence.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ShareButton
              compact
              title="Staff Attendance Sheet"
              moduleName="Attendance Register"
              reference={`ATT-${filterDate || todayIso}`}
              summary={`${filteredRecords.length} attendance records · ${totals.lateMinutes}m total lateness · ${totals.otHours.toFixed(1)}h OT`}
            />
            {canEditRecords && (
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#172033] dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg cursor-pointer whitespace-nowrap">
                <Upload className="w-3.5 h-3.5" />
                Import CSV / Device Export
                <input type="file" accept=".csv" onChange={handleCsvImport} className="hidden" />
              </label>
            )}
          </div>
        </div>

        {notice && (
          <div className="mb-4 flex items-center justify-between px-4 py-2.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-center justify-between px-4 py-2.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950/30 dark:border-red-900 dark:text-red-300">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleAddAttendance} className="space-y-4">
          {/* Row 1: Central Employee & Shift */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Central Employee</label>
              <select
                value={form.employee_code}
                onChange={(e) => applyEmployeeSelection(e.target.value, employees, schedules, shifts, form.attendance_date)}
                className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="">-- Select Staff from HR Directory --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.employee_id}>
                    {emp.full_name} ({emp.employee_id}) · {emp.department}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Attendance Date</label>
              <input
                type="date"
                required
                value={form.attendance_date}
                onChange={(e) => {
                  const dt = e.target.value;
                  setForm((p) => ({ ...p, attendance_date: dt }));
                  if (form.employee_code) {
                    applyEmployeeSelection(form.employee_code, employees, schedules, shifts, dt);
                  }
                }}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Assigned Shift</label>
              <select
                value={form.shift_id}
                onChange={(e) => {
                  const sh = shifts.find((s) => String(s.id) === e.target.value);
                  if (sh) {
                    const lower = sh.shift_name.toLowerCase();
                    const period: NonNullable<AttendanceRecord['shift_period']> = lower.includes('morning')
                      ? 'Morning'
                      : lower.includes('afternoon')
                      ? 'Afternoon'
                      : lower.includes('night')
                      ? 'Night'
                      : lower.includes('security')
                      ? 'Security'
                      : lower.includes('weekend')
                      ? 'Weekend'
                      : lower.includes('holiday')
                      ? 'Holiday'
                      : 'Day';
                    setForm((p) => ({
                      ...p,
                      shift_id: String(sh.id),
                      shift_name: sh.shift_name,
                      shift_period: period,
                      scheduled_start: sh.start_time,
                      scheduled_end: sh.end_time,
                      break_minutes: String(sh.break_minutes),
                      ...(editingId === null
                        ? {
                            check_in: sh.start_time,
                            check_out: sh.end_time,
                            morning_check_in: period === 'Morning' || period === 'Day' ? sh.start_time : '',
                            morning_check_out: period === 'Morning' ? sh.end_time : period === 'Day' ? '12:00' : '',
                            afternoon_check_in: period === 'Afternoon' ? sh.start_time : period === 'Day' ? '13:00' : '',
                            afternoon_check_out: period === 'Afternoon' || period === 'Day' ? sh.end_time : '',
                            night_check_in: period === 'Night' || period === 'Security' ? sh.start_time : '',
                            night_check_out: period === 'Night' || period === 'Security' ? sh.end_time : '',
                          }
                        : {}),
                    }));
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                {shifts.map((sh) => (
                  <option key={sh.id} value={sh.id}>
                    {sh.shift_name} ({sh.start_time}–{sh.end_time})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Shift Session</label>
              <select
                value={form.shift_period}
                onChange={(e) =>
                  setForm({ ...form, shift_period: e.target.value as NonNullable<AttendanceRecord['shift_period']> })
                }
                className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="Morning">Morning Shift</option>
                <option value="Afternoon">Afternoon Shift</option>
                <option value="Night">Night Shift</option>
                <option value="Day">Day Shift</option>
                <option value="Weekend">Weekend Shift</option>
                <option value="Holiday">Holiday Shift</option>
                <option value="Security">Security Guard Shift</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Attendance Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="Auto">Auto-Detect (Recommended)</option>
                <option value="Present">Present</option>
                <option value="Late">Late</option>
                <option value="Early Exit">Early Departure</option>
                <option value="Late & Early">Late & Early Exit</option>
                <option value="Half-Day">Half-Day</option>
                <option value="Absent">Absent</option>
                <option value="On Leave">On Leave</option>
              </select>
            </div>
          </div>

          {/* Ethiopian Local Time Signed Shift & Overtime Windows Reference */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2 text-[11px] text-slate-700 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-slate-300">
            <div>
              <span className="font-bold text-sky-900 dark:text-sky-300">Morning (ET):</span>{' '}
              <span className="font-mono">{ETHIOPIAN_SHIFT_WINDOWS.morning.ethLabel}</span>
            </div>
            <div>
              <span className="font-bold text-amber-900 dark:text-amber-300">Afternoon (ET):</span>{' '}
              <span className="font-mono">{ETHIOPIAN_SHIFT_WINDOWS.afternoon.ethLabel}</span>
            </div>
            <div>
              <span className="font-bold text-indigo-900 dark:text-indigo-300">Night (ET):</span>{' '}
              <span className="font-mono">{ETHIOPIAN_SHIFT_WINDOWS.night.ethLabel}</span>
            </div>
          </div>

          {/* Row 2: Dedicated Morning, Afternoon & Night Check-In / Check-Out Sessions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Morning Shift */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Morning Shift (1:45–6:30 ET)</span>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, morning_check_in: p.morning_check_in || nowTimeHHMM(), shift_period: 'Morning' }))}
                  className="text-[11px] font-semibold text-blue-600 hover:underline"
                >
                  Stamp Now
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mb-2">In 07:45–08:00 (1:45–2:00 ET) · Out 11:58–12:30 (5:58–6:30 ET)</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">Morning Check-In</label>
                  <input
                    type="time"
                    value={form.morning_check_in}
                    onChange={(e) => setForm({ ...form, morning_check_in: e.target.value, check_in: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs font-mono tabular-nums bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                  />
                  {form.morning_check_in && (
                    <span className="block text-[10px] text-slate-400 font-mono mt-0.5">{formatEthiopianLocalTime(form.morning_check_in)}</span>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">Morning Check-Out</label>
                  <input
                    type="time"
                    value={form.morning_check_out}
                    onChange={(e) => setForm({ ...form, morning_check_out: e.target.value, check_out: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs font-mono tabular-nums bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                  />
                  {form.morning_check_out && (
                    <span className="block text-[10px] text-slate-400 font-mono mt-0.5">{formatEthiopianLocalTime(form.morning_check_out)}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Afternoon Shift */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Afternoon Shift (6:50–11:00 ET)</span>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, afternoon_check_in: p.afternoon_check_in || nowTimeHHMM(), shift_period: 'Afternoon' }))}
                  className="text-[11px] font-semibold text-blue-600 hover:underline"
                >
                  Stamp Now
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mb-2">In 12:50–13:00 · Out 16:58–17:00 · OT 17:10–19:00 (11:10–1:00 PM ET)</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">Afternoon Check-In</label>
                  <input
                    type="time"
                    value={form.afternoon_check_in}
                    onChange={(e) => setForm({ ...form, afternoon_check_in: e.target.value, check_in: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs font-mono tabular-nums bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                  />
                  {form.afternoon_check_in && (
                    <span className="block text-[10px] text-slate-400 font-mono mt-0.5">{formatEthiopianLocalTime(form.afternoon_check_in)}</span>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">Afternoon Check-Out</label>
                  <input
                    type="time"
                    value={form.afternoon_check_out}
                    onChange={(e) => setForm({ ...form, afternoon_check_out: e.target.value, check_out: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs font-mono tabular-nums bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                  />
                  {form.afternoon_check_out && (
                    <span className="block text-[10px] text-slate-400 font-mono mt-0.5">{formatEthiopianLocalTime(form.afternoon_check_out)}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Night Shift */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Night Shift (12:50–8:10 ET)</span>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, night_check_in: p.night_check_in || nowTimeHHMM(), shift_period: 'Night' }))}
                  className="text-[11px] font-semibold text-blue-600 hover:underline"
                >
                  Stamp Now
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mb-2">In 18:50–19:00 · Out 01:58–02:10 · OT 02:10–07:00 (8:10–1:00 AM ET)</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">Night Check-In</label>
                  <input
                    type="time"
                    value={form.night_check_in}
                    onChange={(e) => setForm({ ...form, night_check_in: e.target.value, check_in: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs font-mono tabular-nums bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                  />
                  {form.night_check_in && (
                    <span className="block text-[10px] text-slate-400 font-mono mt-0.5">{formatEthiopianLocalTime(form.night_check_in)}</span>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">Night Check-Out</label>
                  <input
                    type="time"
                    value={form.night_check_out}
                    onChange={(e) => setForm({ ...form, night_check_out: e.target.value, check_out: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs font-mono tabular-nums bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                  />
                  {form.night_check_out && (
                    <span className="block text-[10px] text-slate-400 font-mono mt-0.5">{formatEthiopianLocalTime(form.night_check_out)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Break, OT, Auto-Computed Preview & Submit */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Break (mins)</label>
              <input
                type="number"
                min={0}
                max={180}
                value={form.break_minutes}
                onChange={(e) => setForm({ ...form, break_minutes: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Hourly Rate</label>
              <input
                type="number"
                step="0.5"
                value={form.hourly_rate}
                onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">OT Category</label>
              <select
                value={form.ot_type}
                onChange={(e) => setForm({ ...form, ot_type: e.target.value as AttendanceRecord['ot_type'] })}
                className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="None">Auto / None</option>
                <option value="Regular">Regular OT ({otSettings.ot_regular_multiplier}x)</option>
                <option value="Night">OT Night ({otSettings.ot_night_multiplier}x)</option>
                <option value="Sunday">OT Sunday ({otSettings.ot_sunday_multiplier}x)</option>
                <option value="Holiday">OT Holiday ({otSettings.ot_holiday_multiplier}x)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">OT Hours (Blank=Auto)</label>
              <input
                type="number"
                step="0.25"
                min="0"
                placeholder="Auto"
                value={form.ot_hours}
                onChange={(e) => setForm({ ...form, ot_hours: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Correction Reason / Notes</label>
              <input
                type="text"
                placeholder="Optional audit note"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {editingId !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                  className="px-2.5 py-2 text-xs font-semibold text-[#172033] bg-slate-100 hover:bg-slate-200 rounded-lg"
                  title="Cancel Edit"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
              >
                <Save className="w-4 h-4" />
                {editingId !== null ? 'Save Correction' : 'Record Punch'}
              </button>
            </div>
          </div>

          {/* Live Calculated Telemetry Preview */}
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs tabular-nums dark:border-slate-800 dark:bg-slate-800/50">
            <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              Status Preview: <strong>{livePreview.status}</strong>
            </span>
            <span>Late: <strong>{livePreview.lateMins}m</strong></span>
            <span>Early Exit: <strong>{livePreview.earlyMins}m</strong></span>
            <span>Regular: <strong>{livePreview.regHours.toFixed(1)}h</strong></span>
            <span>Absence: <strong>{livePreview.absenceHours.toFixed(2)}h</strong></span>
            <span>OT: <strong>{livePreview.otHours.toFixed(2)}h</strong> ({formatMoney(livePreview.otPay, currency)})</span>
          </div>
        </form>
      </div>

      {/* Inline Delete Confirmation Banner */}
      {confirmDeleteId !== null && (
        <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <span>Confirm permanent deletion of Attendance Record #{confirmDeleteId}? Audit log will record this removal.</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => executeRemove(confirmDeleteId)}
              className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700"
            >
              Confirm Remove
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteId(null)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Attendance Register Table */}
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
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-[#F8FAFC] dark:bg-slate-800"
            >
              <option value="All">All Depts</option>
              {departmentOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value as typeof filterPeriod)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-[#F8FAFC] dark:bg-slate-800"
            >
              <option value="All">All Sessions</option>
              <option value="Morning">Morning Shift</option>
              <option value="Afternoon">Afternoon Shift</option>
              <option value="Night">Night Shift</option>
              <option value="Day">Day Shift</option>
            </select>
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
            {canEditRecords && (
              <button
                type="button"
                onClick={handleCloseAllVisible}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] border border-[#087CEB]/30 hover:bg-[#BFDBFE] rounded-lg whitespace-nowrap"
              >
                <Lock className="w-3.5 h-3.5" />
                Close All Open
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                printWithAutoFit({
                  orientation: 'landscape',
                  targetSelector: '.print-only-container[data-print-active="true"]',
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#18243A] hover:bg-[#243656] rounded-lg whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              Print View
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#18243A] text-white text-xs font-semibold">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Date & Shift</th>
                <th className="py-3 px-4">Morning / Afternoon / Night</th>
                <th className="py-3 px-4">Late / Early / Break</th>
                <th className="py-3 px-4">OT & Pay</th>
                <th className="py-3 px-4">Status & Register</th>
                {canEditRecords && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {filteredRecords.map((rec) => {
                const lockedForOfficer = rec.register_state === 'Closed' && !canModifyClosedOrDelete;
                return (
                  <tr key={rec.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#172033] dark:text-white">{rec.employee_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {rec.employee_code} · {rec.department}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs text-[#172033] dark:text-slate-200 tabular-nums">
                        {calendarMode === 'Ethiopian' ? toEthiopianDateString(rec.attendance_date) : rec.attendance_date}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {rec.shift_name} ({rec.shift_period || 'Day'})
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums space-y-0.5 text-[11px]">
                      {rec.morning_check_in || rec.morning_check_out ? (
                        <div>
                          M: {rec.morning_check_in || '--'}–{rec.morning_check_out || '--'}
                          <span className="block text-[10px] text-slate-400">
                            {rec.morning_check_in ? formatEthiopianLocalTime(rec.morning_check_in) : '--'} → {rec.morning_check_out ? formatEthiopianLocalTime(rec.morning_check_out) : '--'}
                          </span>
                        </div>
                      ) : null}
                      {rec.afternoon_check_in || rec.afternoon_check_out ? (
                        <div>
                          A: {rec.afternoon_check_in || '--'}–{rec.afternoon_check_out || '--'}
                          <span className="block text-[10px] text-slate-400">
                            {rec.afternoon_check_in ? formatEthiopianLocalTime(rec.afternoon_check_in) : '--'} → {rec.afternoon_check_out ? formatEthiopianLocalTime(rec.afternoon_check_out) : '--'}
                          </span>
                        </div>
                      ) : null}
                      {rec.night_check_in || rec.night_check_out ? (
                        <div>
                          N: {rec.night_check_in || '--'}–{rec.night_check_out || '--'}
                          <span className="block text-[10px] text-slate-400">
                            {rec.night_check_in ? formatEthiopianLocalTime(rec.night_check_in) : '--'} → {rec.night_check_out ? formatEthiopianLocalTime(rec.night_check_out) : '--'}
                          </span>
                        </div>
                      ) : null}
                      {!rec.morning_check_in && !rec.afternoon_check_in && !rec.night_check_in && (
                        <div>
                          {rec.check_in} – {rec.check_out}
                          <span className="block text-[10px] text-slate-400">
                            {rec.check_in ? formatEthiopianLocalTime(rec.check_in) : '--'} → {rec.check_out ? formatEthiopianLocalTime(rec.check_out) : '--'}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-[11px]">
                      <div className={(rec.late_minutes || 0) > 0 ? 'text-amber-600 font-semibold' : 'text-slate-600 dark:text-slate-300'}>
                        Late: {rec.late_minutes || 0}m · Early: {rec.early_departure_minutes || 0}m
                      </div>
                      <div className="text-slate-500">
                        Reg: {Number(rec.regular_hours).toFixed(1)}h · Brk: {rec.break_minutes ?? 60}m · Abs: {Number(rec.absence_hours || 0).toFixed(1)}h
                      </div>
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      <div className="font-medium text-[#172033] dark:text-white">
                        {rec.ot_type} · {rec.ot_hours}h × {rec.ot_multiplier}x
                      </div>
                      <div className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                        {formatMoney(rec.ot_pay, currency)}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div
                        className={`font-semibold ${
                          rec.status === 'Absent'
                            ? 'text-red-600'
                            : rec.status === 'Late' || rec.status === 'Late & Early' || rec.status === 'Early Exit'
                            ? 'text-amber-600'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {rec.status} · {rec.register_state}
                      </div>
                      {rec.updated_by && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[140px]">By {rec.updated_by}</div>
                      )}
                      {rec.notes && /biometric|adms|passkey|auto-marked/i.test(rec.notes) && (
                        <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-[#EAF4FF] text-[#087CEB] dark:bg-sky-950/60 dark:text-sky-300 rounded">
                          <Fingerprint className="w-3 h-3" />
                          Biometric Auto-Marked
                        </div>
                      )}
                    </td>
                    {canEditRecords && (
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleClosed(rec)}
                            className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg whitespace-nowrap ${
                              rec.register_state === 'Closed'
                                ? 'text-[#172033] bg-slate-100 hover:bg-slate-200'
                                : 'text-[#18243A] bg-[#DBEAFE] border border-[#087CEB]/30 hover:bg-[#BFDBFE]'
                            }`}
                          >
                            {rec.register_state === 'Closed' ? (
                              <>
                                <Unlock className="w-3 h-3" />
                                Reopen
                              </>
                            ) : (
                              <>
                                <Lock className="w-3 h-3" />
                                Close
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={lockedForOfficer}
                            onClick={() => {
                              setEditingId(rec.id);
                              setForm({
                                employee_code: rec.employee_code,
                                employee_name: rec.employee_name,
                                department: rec.department,
                                attendance_date: rec.attendance_date,
                                shift_id: rec.shift_id ? String(rec.shift_id) : '',
                                shift_name: rec.shift_name,
                                shift_period: rec.shift_period || 'Day',
                                scheduled_start: rec.scheduled_start || '08:00',
                                scheduled_end: rec.scheduled_end || '17:00',
                                check_in: rec.check_in,
                                check_out: rec.check_out,
                                morning_check_in: rec.morning_check_in || '',
                                morning_check_out: rec.morning_check_out || '',
                                afternoon_check_in: rec.afternoon_check_in || '',
                                afternoon_check_out: rec.afternoon_check_out || '',
                                night_check_in: rec.night_check_in || '',
                                night_check_out: rec.night_check_out || '',
                                break_minutes: String(rec.break_minutes ?? 60),
                                hourly_rate: String(rec.hourly_rate),
                                regular_hours: String(rec.regular_hours),
                                ot_type: rec.ot_type,
                                ot_hours: String(rec.ot_hours),
                                status: rec.status,
                                notes: rec.notes || '',
                              });
                            }}
                            className="p-1.5 text-[#172033] bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg"
                            title={lockedForOfficer ? 'Closed records require Admin/HR permission' : 'Edit Entry'}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {canModifyClosedOrDelete && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(rec.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg whitespace-nowrap"
                            >
                              <Trash2 className="w-3 h-3" />
                              Remove
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* PRINTER VIEW */}
      <div
        data-print-active="true"
        data-print-orientation="landscape"
        className="print-only-container bg-[#FFFFFF] border-t-4 border-t-[#087CEB] border border-slate-300 rounded-xl p-4 sm:p-6 text-[#172033]"
      >
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
              Night {otSettings.ot_night_multiplier}x · Sunday {otSettings.ot_sunday_multiplier}x · Holiday {otSettings.ot_holiday_multiplier}x · Morning / Afternoon / Night Shift Sessions
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              printWithAutoFit({
                orientation: 'landscape',
                targetSelector: '.print-only-container[data-print-active="true"]',
              })
            }
            className="no-print inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4" />
            Print Register Sheet
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 py-4 border-b border-slate-200 text-xs">
          <div>
            <span className="text-slate-500 block">Entries Listed</span>
            <span className="font-mono font-bold text-[#172033] text-sm tabular-nums">{filteredRecords.length}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Regular Hours</span>
            <span className="font-mono font-bold text-[#172033] text-sm tabular-nums">{totals.regularHours.toFixed(1)} hrs</span>
          </div>
          <div>
            <span className="text-slate-500 block">Total Lateness</span>
            <span className="font-mono font-bold text-[#172033] text-sm tabular-nums">{totals.lateMinutes} mins</span>
          </div>
          <div>
            <span className="text-slate-500 block">Absence Hours</span>
            <span className="font-mono font-bold text-[#172033] text-sm tabular-nums">{totals.absenceHours.toFixed(1)} hrs</span>
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
                <th className="py-2 pr-3">Shift & In–Out</th>
                <th className="py-2 pr-3 text-right">Late / Early</th>
                <th className="py-2 pr-3 text-right">OT Hrs × Mult</th>
                <th className="py-2 pr-3 text-right">OT Pay</th>
                <th className="py-2 text-right">Status</th>
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
                  <td className="py-2 pr-3 font-mono tabular-nums">
                    {rec.shift_period || 'Day'}: {rec.check_in}–{rec.check_out}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">
                    {rec.late_minutes || 0}m / {rec.early_departure_minutes || 0}m
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">
                    {rec.ot_hours.toFixed(1)} × {rec.ot_multiplier}x
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">{formatMoney(rec.ot_pay, currency)}</td>
                  <td className="py-2 text-right font-medium">{rec.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8 pt-6 border-t border-slate-200 text-xs text-slate-600 print-break-avoid">
          <div>
            <div className="h-8 border-b border-slate-300 mb-1" />
            <span>Prepared By (Attendance Officer)</span>
          </div>
          <div>
            <div className="h-8 border-b border-slate-300 mb-1" />
            <span>Verified By (HR Manager)</span>
          </div>
          <div>
            <div className="h-8 border-b border-slate-300 mb-1 flex items-end justify-end">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#087CEB] mb-1" />
            </div>
            <span>Approved By (General Manager)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
