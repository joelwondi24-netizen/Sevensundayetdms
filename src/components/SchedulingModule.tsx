import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Layers,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Repeat,
  Save,
  Shield,
  Sliders,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { api } from '../api';
import type {
  AttendanceRecord,
  CompanySettings,
  DepartmentRecord,
  EmployeeProfile,
  HolidayRecord,
  LeaveRecord,
  ScheduleConflictReport,
  ShiftCategory,
  ShiftDefinition,
  StaffScheduleRecord,
  UserRole,
  WorkforceRules,
} from '../types';
import { toEthiopianDateString } from '../utils/ethiopianCalendar';
import { SendToApproveButton } from './SendToApproveButton';
import { ShareButton } from './ShareButton';

interface SchedulingModuleProps {
  company: CompanySettings | null;
  calendarMode: 'Gregorian' | 'Ethiopian';
  currentUserRole?: UserRole;
  currentUserCode?: string;
  onRefreshDashboard: () => void;
}

type SchedTab = 'timetable' | 'assign' | 'departments' | 'shifts' | 'availability';
type CalViewMode = 'Daily' | 'Weekly' | 'Monthly';

const SHIFT_CATEGORIES: ShiftCategory[] = [
  'Day Shift',
  'Morning Shift',
  'Afternoon Shift',
  'Night Shift',
  'Weekend Shift',
  'Holiday Shift',
  'Security Guard Shift',
  'Special Duty Shift',
  'Overtime Shift',
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MANAGER_ROLES = new Set<string>([
  'System Administrator',
  'Super Administrator',
  'Company Owner',
  'General Manager',
  'Human Resource Manager',
  'Department Manager',
  'Attendance Officer',
  'Security Supervisor',
]);

const ADMIN_SHIFT_DEPT_ROLES = new Set<string>([
  'System Administrator',
  'Super Administrator',
  'Company Owner',
  'General Manager',
  'Human Resource Manager',
  'Department Manager',
]);

function parseDayList(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  }
}

function addDaysIso(isoDate: string, offset: number): string {
  const dt = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return isoDate;
  dt.setUTCDate(dt.getUTCDate() + offset);
  return dt.toISOString().slice(0, 10);
}

function getWeekStartMonday(isoDate: string): string {
  const dt = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return isoDate;
  const day = dt.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}

export const SchedulingModule: React.FC<SchedulingModuleProps> = ({
  company,
  calendarMode,
  currentUserRole = 'Super Administrator',
  currentUserCode,
  onRefreshDashboard,
}) => {
  const canManageSchedules = MANAGER_ROLES.has(currentUserRole);
  const canManageShiftsDepts = ADMIN_SHIFT_DEPT_ROLES.has(currentUserRole);

  const [tab, setTab] = useState<SchedTab>('timetable');
  const [calView, setCalView] = useState<CalViewMode>('Weekly');
  const [anchorDate, setAnchorDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [shifts, setShifts] = useState<ShiftDefinition[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [schedules, setSchedules] = useState<StaffScheduleRecord[]>([]);
  const [holidays, setHolidays] = useState<HolidayRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [rules, setRules] = useState<WorkforceRules>({
    late_grace_minutes: 15,
    early_departure_grace_minutes: 10,
    default_break_minutes: 60,
    min_rest_hours_between_shifts: 11,
    auto_detect_conflicts: 1,
    require_manager_approval: 1,
    default_shift_system: '3-Shift',
  });

  const [filterDept, setFilterDept] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterEmployee, setFilterEmployee] = useState('All');

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<{ type: 'schedule' | 'shift' | 'dept' | 'holiday'; id: number } | null>(null);

  // Assign single schedule state
  const [assignForm, setAssignForm] = useState({
    employee_id: '',
    shift_id: '',
    schedule_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    start_time: '06:00',
    end_time: '14:00',
    break_minutes: 30,
    schedule_type: 'Regular' as StaffScheduleRecord['schedule_type'],
    rotation_group: 'Group-A',
    approval_status: 'Approved' as StaffScheduleRecord['approval_status'],
    notes: '',
    force_override: false,
  });
  const [conflictCheck, setConflictCheck] = useState<ScheduleConflictReport | null>(null);

  // Bulk 3/4-Shift generator state
  const [genForm, setGenForm] = useState({
    department: 'All',
    scheduling_system: '3-Shift' as '3-Shift' | '4-Shift' | 'Security 24/7',
    start_date: new Date().toISOString().slice(0, 10),
    days: 7,
    rotate_weekly: true,
  });

  // Replace/Edit modals
  const [replaceTarget, setReplaceTarget] = useState<StaffScheduleRecord | null>(null);
  const [replaceEmpId, setReplaceEmpId] = useState('');
  const [replaceReason, setReplaceReason] = useState('');
  const [replaceOverride, setReplaceOverride] = useState(false);

  const [editScheduleTarget, setEditScheduleTarget] = useState<StaffScheduleRecord | null>(null);

  // Department editor state
  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);
  const [deptForm, setDeptForm] = useState({
    dept_code: '',
    name: '',
    manager_employee_id: '',
    scheduling_system: '3-Shift' as DepartmentRecord['scheduling_system'],
    default_shift_id: '',
    working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    rest_days: ['Sat', 'Sun'],
    weekend_schedule_enabled: false,
    holiday_schedule_enabled: false,
    security_guard_coverage: 'Standard Business Hours',
    monthly_timetable_notes: '',
  });

  // Shift editor state
  const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
  const [shiftForm, setShiftForm] = useState({
    shift_code: '',
    shift_name: '',
    shift_category: 'Morning Shift' as ShiftCategory,
    scheduling_system: '3-Shift' as ShiftDefinition['scheduling_system'],
    start_time: '06:00',
    end_time: '14:00',
    break_minutes: 30,
    working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    rest_days: ['Sun'],
    min_rest_hours: 11,
    is_rotating: true,
    rotation_pattern: 'Weekly 3-Shift Rotation',
    color_hex: '#0ea5e9',
    ot_multiplier: 1.5,
    grace_late_minutes: 10,
    status: 'Active' as 'Active' | 'Inactive',
    notes: '',
  });

  // Holiday quick form
  const [holidayForm, setHolidayForm] = useState({
    holiday_date: new Date().toISOString().slice(0, 10),
    name: '',
    ot_multiplier: '2.5',
    is_paid: true,
    notes: '',
  });

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [emps, shfs, depts, scheds, hols, wRules, lvs, atts] = await Promise.all([
        api.get<EmployeeProfile[]>('/api/employees'),
        api.get<ShiftDefinition[]>('/api/shifts'),
        api.get<DepartmentRecord[]>('/api/departments'),
        api.get<StaffScheduleRecord[]>('/api/scheduling'),
        api.get<HolidayRecord[]>('/api/holidays'),
        api.get<WorkforceRules>('/api/workforce-rules'),
        api.get<LeaveRecord[]>('/api/leaves'),
        api.get<AttendanceRecord[]>('/api/attendance'),
      ]);
      setEmployees(emps);
      setShifts(shfs);
      setDepartments(depts);
      setSchedules(scheds);
      setHolidays(hols);
      setRules(wRules);
      setLeaves(lvs);
      setAttendance(atts);

      if (!assignForm.employee_id && emps.length > 0) {
        const firstEmp = emps.find((e) => e.status === 'Active') || emps[0];
        const firstShift = shfs[0];
        setAssignForm((prev) => ({
          ...prev,
          employee_id: firstEmp.employee_id,
          shift_id: firstShift ? String(firstShift.id) : '',
          start_time: firstShift?.start_time || '08:00',
          end_time: firstShift?.end_time || '17:00',
          break_minutes: firstShift?.break_minutes ?? 30,
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scheduling & workforce data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Real-time conflict check whenever assignment employee/date/shift time changes
  useEffect(() => {
    if (!assignForm.employee_id || !assignForm.schedule_date || !assignForm.start_time || !assignForm.end_time) return;
    let active = true;
    api
      .post<ScheduleConflictReport>('/api/scheduling/check-conflicts', {
        employee_id: assignForm.employee_id,
        schedule_date: assignForm.schedule_date,
        start_time: assignForm.start_time,
        end_time: assignForm.end_time,
      })
      .then((res) => {
        if (active) setConflictCheck(res);
      })
      .catch(() => {
        if (active) setConflictCheck(null);
      });
    return () => {
      active = false;
    };
  }, [assignForm.employee_id, assignForm.schedule_date, assignForm.start_time, assignForm.end_time]);

  const activeEmployees = useMemo(() => employees.filter((e) => e.status === 'Active'), [employees]);

  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      if (filterDept !== 'All' && s.department !== filterDept) return false;
      if (filterCategory !== 'All' && s.shift_category !== filterCategory) return false;
      if (filterEmployee !== 'All' && s.employee_id !== filterEmployee) return false;
      return true;
    });
  }, [schedules, filterDept, filterCategory, filterEmployee]);

  const weekDaysRange = useMemo(() => {
    const monday = getWeekStartMonday(anchorDate);
    return Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
  }, [anchorDate]);

  const monthCalendarDays = useMemo(() => {
    const ym = anchorDate.slice(0, 7);
    const first = new Date(`${ym}-01T00:00:00Z`);
    const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    const firstWeekday = (first.getUTCDay() + 6) % 7; // Mon=0..Sun=6
    const cells: Array<{ date: string | null; dayNum: number | null }> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push({ date: null, dayNum: null });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: `${ym}-${String(d).padStart(2, '0')}`, dayNum: d });
    }
    return cells;
  }, [anchorDate]);

  const shiftColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const sh of shifts) {
      map.set(sh.shift_name, sh.color_hex || '#2563eb');
      map.set(sh.shift_category, sh.color_hex || '#2563eb');
    }
    return map;
  }, [shifts]);

  const formatDateLabel = (iso: string) =>
    calendarMode === 'Ethiopian' ? toEthiopianDateString(iso) : iso;

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const sh = shifts.find((s) => String(s.id) === assignForm.shift_id);
      const emp = employees.find((em) => em.employee_id === assignForm.employee_id);
      await api.post('/api/scheduling', {
        employee_id: assignForm.employee_id,
        department: emp?.department || 'Operations',
        shift_id: sh ? sh.id : null,
        shift_name: sh?.shift_name || 'Day Shift',
        shift_category: sh?.shift_category || 'Day Shift',
        schedule_date: assignForm.schedule_date,
        end_date: assignForm.end_date || assignForm.schedule_date,
        start_time: assignForm.start_time,
        end_time: assignForm.end_time,
        break_minutes: Number(assignForm.break_minutes),
        schedule_type: assignForm.schedule_type,
        rotation_group: assignForm.rotation_group,
        approval_status: assignForm.approval_status,
        notes: assignForm.notes,
        force_override: assignForm.force_override,
      });
      setNotice(`Scheduled ${emp?.full_name || assignForm.employee_id} for ${sh?.shift_name || 'shift'} on ${assignForm.schedule_date}.`);
      setAssignForm((prev) => ({ ...prev, force_override: false, notes: '' }));
      await loadAll();
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save staff schedule.');
    }
  };

  const handleGenerateRoster = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const res = await api.post<{ created: number; skippedConflicts: number }>('/api/scheduling/generate', genForm);
      setNotice(
        `Generated ${res.created} ${genForm.scheduling_system} schedule entries (${res.skippedConflicts} skipped due to existing conflicts or approved leaves).`
      );
      await loadAll();
      onRefreshDashboard();
      setTab('timetable');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate rotating roster.');
    }
  };

  const handleReplaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replaceTarget || !replaceEmpId) return;
    setError(null);
    setNotice(null);
    try {
      await api.post(`/api/scheduling/${replaceTarget.id}/replace`, {
        replacement_employee_id: replaceEmpId,
        reason: replaceReason || 'Shift change / replacement',
        force_override: replaceOverride,
      });
      setNotice(`Replaced ${replaceTarget.employee_name} on ${replaceTarget.schedule_date}.`);
      setReplaceTarget(null);
      setReplaceEmpId('');
      setReplaceReason('');
      setReplaceOverride(false);
      await loadAll();
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to replace shift assignment.');
    }
  };

  const handleEditScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editScheduleTarget) return;
    setError(null);
    try {
      await api.put(`/api/scheduling/${editScheduleTarget.id}`, editScheduleTarget);
      setNotice(`Updated schedule ${editScheduleTarget.schedule_code}.`);
      setEditScheduleTarget(null);
      await loadAll();
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update schedule.');
    }
  };

  const handleApproveSchedule = async (id: number, status: 'Approved' | 'Rejected') => {
    setError(null);
    try {
      await api.patch(`/api/scheduling/${id}/approve`, { approval_status: status });
      setNotice(`Schedule #${id} marked ${status}.`);
      await loadAll();
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update approval status.');
    }
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const payload = {
        ...deptForm,
        default_shift_id: deptForm.default_shift_id ? Number(deptForm.default_shift_id) : null,
      };
      if (editingDeptId) {
        await api.put(`/api/departments/${editingDeptId}`, payload);
        setNotice(`Updated department timetable for ${deptForm.name}.`);
      } else {
        await api.post('/api/departments', payload);
        setNotice(`Created department ${deptForm.name}.`);
      }
      setEditingDeptId(null);
      setDeptForm({
        dept_code: '',
        name: '',
        manager_employee_id: '',
        scheduling_system: '3-Shift',
        default_shift_id: '',
        working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        rest_days: ['Sat', 'Sun'],
        weekend_schedule_enabled: false,
        holiday_schedule_enabled: false,
        security_guard_coverage: 'Standard Business Hours',
        monthly_timetable_notes: '',
      });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save department.');
    }
  };

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      if (editingShiftId) {
        await api.put(`/api/shifts/${editingShiftId}`, shiftForm);
        setNotice(`Updated shift "${shiftForm.shift_name}".`);
      } else {
        await api.post('/api/shifts', shiftForm);
        setNotice(`Created shift "${shiftForm.shift_name}".`);
      }
      setEditingShiftId(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save shift configuration.');
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/api/holidays', {
        ...holidayForm,
        ot_multiplier: Number(holidayForm.ot_multiplier) || 2.5,
      });
      setHolidayForm({
        holiday_date: new Date().toISOString().slice(0, 10),
        name: '',
        ot_multiplier: '2.5',
        is_paid: true,
        notes: '',
      });
      setNotice('Holiday saved to workforce calendar.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add holiday.');
    }
  };

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const updated = await api.put<WorkforceRules>('/api/workforce-rules', rules);
      setRules(updated);
      setNotice('Workforce attendance grace, break, and rest-period rules saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workforce rules.');
    }
  };

  const executeConfirmedDelete = async () => {
    if (!confirmDeleteId) return;
    setError(null);
    try {
      if (confirmDeleteId.type === 'schedule') await api.del(`/api/scheduling/${confirmDeleteId.id}`);
      else if (confirmDeleteId.type === 'shift') await api.del(`/api/shifts/${confirmDeleteId.id}`);
      else if (confirmDeleteId.type === 'dept') await api.del(`/api/departments/${confirmDeleteId.id}`);
      else if (confirmDeleteId.type === 'holiday') await api.del(`/api/holidays/${confirmDeleteId.id}`);
      setConfirmDeleteId(null);
      setNotice('Record removed.');
      await loadAll();
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const toggleDayInList = (list: string[], day: string): string[] =>
    list.includes(day) ? list.filter((d) => d !== day) : [...list, day];

  // Central availability computation for Today / AnchorDate
  const availabilityRows = useMemo(() => {
    return activeEmployees.map((emp) => {
      const daySchedules = schedules.filter((s) => s.employee_id === emp.employee_id && s.schedule_date === anchorDate && s.approval_status !== 'Rejected');
      const approvedLeave = leaves.find(
        (l) => l.employee_code === emp.employee_id && l.status === 'Approved' && l.start_date <= anchorDate && l.end_date >= anchorDate
      );
      const att = attendance.find((a) => a.employee_code === emp.employee_id && a.attendance_date === anchorDate);
      let availability = 'Available';
      if (approvedLeave) availability = `On Leave (${approvedLeave.leave_type})`;
      else if (daySchedules.length > 1) availability = `Conflict (${daySchedules.length} shifts)`;
      else if (daySchedules.length === 1) availability = daySchedules[0].shift_name;
      return {
        emp,
        daySchedules,
        approvedLeave,
        att,
        availability,
      };
    });
  }, [activeEmployees, schedules, leaves, attendance, anchorDate]);

  const todayCount = useMemo(
    () => schedules.filter((s) => s.schedule_date === anchorDate && s.approval_status !== 'Rejected').length,
    [schedules, anchorDate]
  );

  const pendingApprovalsCount = useMemo(
    () => schedules.filter((s) => s.approval_status === 'Pending').length,
    [schedules]
  );

  const securityGuardsScheduled = useMemo(
    () => schedules.filter((s) => s.schedule_date === anchorDate && s.shift_category === 'Security Guard Shift').length,
    [schedules, anchorDate]
  );

  const employeesInRoster = useMemo(() => {
    const map = new Map<string, { employee_id: string; employee_name: string; department: string }>();
    for (const emp of activeEmployees) {
      if (filterDept !== 'All' && emp.department !== filterDept) continue;
      if (filterEmployee !== 'All' && emp.employee_id !== filterEmployee) continue;
      map.set(emp.employee_id, {
        employee_id: emp.employee_id,
        employee_name: emp.full_name,
        department: emp.department,
      });
    }
    for (const s of filteredSchedules) {
      if (!map.has(s.employee_id)) {
        map.set(s.employee_id, {
          employee_id: s.employee_id,
          employee_name: s.employee_name,
          department: s.department,
        });
      }
    }
    return Array.from(map.values());
  }, [activeEmployees, filteredSchedules, filterDept, filterEmployee]);

  return (
    <div className="space-y-4">
      {/* Header & Top Action Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Staff Scheduling, Shifts & Department Timetables
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            3-Shift & 4-Shift workforce scheduling · Central HR integration · Overlap, leave & {rules.min_rest_hours_between_shifts}h rest protection
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ShareButton
            compact
            title={`Workforce Shift Timetable (${anchorDate})`}
            moduleName="Staff Scheduling"
            reference={`SCH-${anchorDate}`}
            summary={`${company?.brand_name || 'Seven Sunday'} Roster for ${formatDateLabel(anchorDate)} · ${todayCount} active shift assignments across ${departments.length} departments.`}
          />
          <SendToApproveButton
            compact
            sourceModule="scheduling"
            recordRef={`ROSTER-${anchorDate}`}
            title={`Shift Roster Approval (${anchorDate})`}
            summary={`${todayCount} shift assignments for ${anchorDate} (${pendingApprovalsCount} pending approval)`}
            fromDepartment={filterDept === 'All' ? 'Human Resources' : filterDept}
            defaultTargetDepartment="General Manager"
          />
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Timetable
          </button>
          <button
            type="button"
            onClick={loadAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Scheduled on {formatDateLabel(anchorDate)}</span>
            <CalendarDays className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{todayCount}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">{activeEmployees.length} active staff in central HR</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Configured Shifts</span>
            <Clock className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{shifts.length}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">Day · Morning · Afternoon · Night · Guard</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Security Guard Duty</span>
            <Shield className="h-4 w-4 text-slate-700 dark:text-slate-300" />
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{securityGuardsScheduled}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">24/7 Gate & perimeter coverage</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Pending Approvals</span>
            <UserCheck className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{pendingApprovalsCount}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">{departments.length} departments active</div>
        </div>
      </div>

      {/* Notices & Inline Delete Confirmations */}
      {error && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {notice && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {notice}
          </span>
          <button type="button" onClick={() => setNotice(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {confirmDeleteId && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <span>Confirm deleting {confirmDeleteId.type} record #{confirmDeleteId.id}? This action is logged to audit history.</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={executeConfirmedDelete}
              className="rounded-md bg-red-600 px-3 py-1 font-semibold text-white hover:bg-red-700"
            >
              Confirm Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteId(null)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1 font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2 dark:border-slate-800">
        {[
          { id: 'timetable' as const, label: 'Timetable & Calendar', icon: Calendar },
          ...(canManageSchedules ? [{ id: 'assign' as const, label: 'Assign & 3/4-Shift Roster', icon: Plus }] : []),
          { id: 'departments' as const, label: 'Department Timetables', icon: Building2 },
          { id: 'shifts' as const, label: 'Shifts (3-Shift & 4-Shift)', icon: Layers },
          { id: 'availability' as const, label: 'Availability, Holidays & Rules', icon: Sliders },
        ].map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: TIMETABLE & CALENDAR (DAILY / WEEKLY / MONTHLY) */}
      {tab === 'timetable' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {(['Daily', 'Weekly', 'Monthly'] as CalViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCalView(mode)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    calView === mode
                      ? 'bg-slate-900 text-white dark:bg-blue-600'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {mode} View
                </button>
              ))}
              <input
                type="date"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="All">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="All">All 9 Shift Types</option>
                {SHIFT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="All">All Employees</option>
                {activeEmployees.map((emp) => (
                  <option key={emp.id} value={emp.employee_id}>
                    {emp.full_name} ({emp.employee_id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* WEEKLY VIEW */}
          {calView === 'Weekly' && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table className="min-w-[880px] w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                  <tr>
                    <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2.5 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      Employee · Dept
                    </th>
                    {weekDaysRange.map((dStr, idx) => (
                      <th key={dStr} className="px-2.5 py-2.5 font-semibold text-slate-700 dark:text-slate-200">
                        <div>{WEEKDAYS[idx]}</div>
                        <div className="text-[11px] font-normal tabular-nums text-slate-500">{formatDateLabel(dStr)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {employeesInRoster.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        No employees or schedules match the current filter.
                      </td>
                    </tr>
                  ) : (
                    employeesInRoster.map((emp) => (
                      <tr key={emp.employee_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                        <td className="sticky left-0 z-10 border-r border-slate-100 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {emp.employee_name}
                            {currentUserCode && currentUserCode === emp.employee_id && ' (You)'}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {emp.employee_id} · {emp.department}
                          </div>
                        </td>
                        {weekDaysRange.map((dStr) => {
                          const cellItems = filteredSchedules.filter(
                            (s) => s.employee_id === emp.employee_id && s.schedule_date === dStr
                          );
                          return (
                            <td key={dStr} className="align-top px-2 py-2">
                              {cellItems.length === 0 ? (
                                <span className="text-[11px] text-slate-400">Rest / Unassigned</span>
                              ) : (
                                <div className="space-y-1.5">
                                  {cellItems.map((item) => {
                                    const col = shiftColorMap.get(item.shift_name) || shiftColorMap.get(item.shift_category) || '#2563eb';
                                    return (
                                      <div
                                        key={item.id}
                                        className="rounded-lg border border-slate-200 bg-slate-50/90 p-1.5 dark:border-slate-700 dark:bg-slate-800/80"
                                      >
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-100">
                                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: col }} />
                                            <span className="truncate max-w-[96px]">{item.shift_name}</span>
                                          </span>
                                          <span
                                            className={`text-[10px] font-semibold ${
                                              item.approval_status === 'Approved'
                                                ? 'text-emerald-600'
                                                : item.approval_status === 'Rejected'
                                                ? 'text-red-600'
                                                : 'text-amber-600'
                                            }`}
                                          >
                                            {item.approval_status}
                                          </span>
                                        </div>
                                        <div className="mt-0.5 text-[11px] tabular-nums text-slate-600 dark:text-slate-300">
                                          {item.start_time}–{item.end_time}
                                        </div>
                                        {item.availability_status === 'Replaced' && item.replacement_employee_name && (
                                          <div className="mt-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                                            Covered by {item.replacement_employee_name}
                                          </div>
                                        )}
                                        {canManageSchedules && (
                                          <div className="mt-1 flex flex-wrap items-center gap-1 border-t border-slate-200/70 pt-1 dark:border-slate-700">
                                            <button
                                              type="button"
                                              title="Edit Schedule"
                                              onClick={() => setEditScheduleTarget(item)}
                                              className="rounded p-0.5 text-slate-500 hover:bg-white hover:text-blue-600 dark:hover:bg-slate-700"
                                            >
                                              <Pencil className="h-3 w-3" />
                                            </button>
                                            <button
                                              type="button"
                                              title="Replace / Swap Employee"
                                              onClick={() => {
                                                setReplaceTarget(item);
                                                setReplaceEmpId('');
                                                setReplaceReason('');
                                              }}
                                              className="rounded p-0.5 text-slate-500 hover:bg-white hover:text-amber-600 dark:hover:bg-slate-700"
                                            >
                                              <Repeat className="h-3 w-3" />
                                            </button>
                                            {item.approval_status === 'Pending' && (
                                              <button
                                                type="button"
                                                title="Approve Schedule"
                                                onClick={() => handleApproveSchedule(item.id, 'Approved')}
                                                className="rounded p-0.5 text-emerald-600 hover:bg-white dark:hover:bg-slate-700"
                                              >
                                                <CheckCircle2 className="h-3 w-3" />
                                              </button>
                                            )}
                                            <button
                                              type="button"
                                              title="Delete Schedule"
                                              onClick={() => setConfirmDeleteId({ type: 'schedule', id: item.id })}
                                              className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-red-600 dark:hover:bg-slate-700"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* DAILY VIEW */}
          {calView === 'Daily' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Daily Shift Roster — {formatDateLabel(anchorDate)}
                </h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Code</th>
                        <th className="px-3 py-2 font-semibold">Employee</th>
                        <th className="px-3 py-2 font-semibold">Department</th>
                        <th className="px-3 py-2 font-semibold">Shift & Category</th>
                        <th className="px-3 py-2 font-semibold">Hours · Break</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        {canManageSchedules && <th className="px-3 py-2 font-semibold text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredSchedules.filter((s) => s.schedule_date === anchorDate).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                            No scheduled shifts for {formatDateLabel(anchorDate)}.
                          </td>
                        </tr>
                      ) : (
                        filteredSchedules
                          .filter((s) => s.schedule_date === anchorDate)
                          .map((item) => (
                            <tr key={item.id}>
                              <td className="px-3 py-2 font-mono text-[11px]">{item.schedule_code}</td>
                              <td className="px-3 py-2 font-medium">
                                {item.employee_name} <span className="text-slate-400">({item.employee_id})</span>
                              </td>
                              <td className="px-3 py-2">{item.department}</td>
                              <td className="px-3 py-2">
                                <div className="font-semibold">{item.shift_name}</div>
                                <div className="text-[11px] text-slate-500">{item.rotation_group || item.schedule_type}</div>
                              </td>
                              <td className="px-3 py-2 tabular-nums">
                                {item.start_time}–{item.end_time} · {item.break_minutes}m break
                              </td>
                              <td className="px-3 py-2">
                                {item.availability_status} · {item.approval_status}
                              </td>
                              {canManageSchedules && (
                                <td className="px-3 py-2 text-right">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setEditScheduleTarget(item)}
                                      className="rounded border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50 dark:border-slate-700"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setReplaceTarget(item)}
                                      className="rounded border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50 dark:border-slate-700"
                                    >
                                      Replace
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId({ type: 'schedule', id: item.id })}
                                      className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 dark:border-red-900"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MONTHLY VIEW */}
          {calView === 'Monthly' && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Monthly Department & Workforce Timetable ({anchorDate.slice(0, 7)})
                </h3>
                <span className="text-xs text-slate-500">Click any day to open Daily detail</span>
              </div>
              <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-slate-500">
                {WEEKDAYS.map((wd) => (
                  <div key={wd} className="py-1">
                    {wd}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {monthCalendarDays.map((cell, idx) => {
                  if (!cell.date) {
                    return <div key={`empty-${idx}`} className="min-h-[82px] rounded-lg bg-slate-50/40 dark:bg-slate-800/20" />;
                  }
                  const dayItems = filteredSchedules.filter((s) => s.schedule_date === cell.date);
                  const hol = holidays.find((h) => h.holiday_date === cell.date);
                  const isSelected = cell.date === anchorDate;
                  return (
                    <button
                      key={cell.date}
                      type="button"
                      onClick={() => {
                        setAnchorDate(cell.date!);
                        setCalView('Daily');
                      }}
                      className={`min-h-[82px] rounded-lg border p-1.5 text-left transition-colors ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/30'
                          : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold tabular-nums text-slate-800 dark:text-slate-100">{cell.dayNum}</span>
                        {dayItems.length > 0 && (
                          <span className="text-[10px] font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                            {dayItems.length} shifts
                          </span>
                        )}
                      </div>
                      {hol && (
                        <div className="mt-0.5 truncate text-[10px] font-semibold text-pink-600 dark:text-pink-400">
                          {hol.name}
                        </div>
                      )}
                      <div className="mt-1 space-y-0.5">
                        {dayItems.slice(0, 2).map((dItem) => (
                          <div key={dItem.id} className="truncate text-[10px] text-slate-600 dark:text-slate-300">
                            {dItem.employee_name.split(' ')[0]} · {dItem.shift_name.replace(' Shift', '')}
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ASSIGN & 3/4-SHIFT ROSTER GENERATOR */}
      {tab === 'assign' && canManageSchedules && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Single Assignment with Live Conflict Check */}
          <form
            onSubmit={handleAssignSubmit}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Assign Individual Staff Shift</h3>
            <p className="text-xs text-slate-500">
              Pulls directly from Central HR employee records and validates overlaps, approved leaves, and minimum rest periods.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs">
                <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Central Employee</span>
                <select
                  required
                  value={assignForm.employee_id}
                  onChange={(e) => setAssignForm((p) => ({ ...p, employee_id: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {activeEmployees.map((emp) => (
                    <option key={emp.id} value={emp.employee_id}>
                      {emp.full_name} ({emp.employee_id}) · {emp.department}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs">
                <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Shift Definition</span>
                <select
                  required
                  value={assignForm.shift_id}
                  onChange={(e) => {
                    const sh = shifts.find((s) => String(s.id) === e.target.value);
                    setAssignForm((p) => ({
                      ...p,
                      shift_id: e.target.value,
                      start_time: sh?.start_time || p.start_time,
                      end_time: sh?.end_time || p.end_time,
                      break_minutes: sh?.break_minutes ?? p.break_minutes,
                      schedule_type:
                        sh?.shift_category === 'Security Guard Shift'
                          ? 'Security Guard'
                          : sh?.shift_category === 'Weekend Shift'
                          ? 'Weekend'
                          : sh?.shift_category === 'Holiday Shift'
                          ? 'Holiday'
                          : sh?.shift_category === 'Overtime Shift'
                          ? 'Overtime'
                          : sh?.is_rotating
                          ? 'Rotating'
                          : 'Regular',
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {shifts.map((sh) => (
                    <option key={sh.id} value={sh.id}>
                      {sh.shift_name} ({sh.start_time}–{sh.end_time}) · {sh.scheduling_system}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs">
                <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Schedule Date</span>
                <input
                  type="date"
                  required
                  value={assignForm.schedule_date}
                  onChange={(e) => setAssignForm((p) => ({ ...p, schedule_date: e.target.value, end_date: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs">
                  <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Start Time</span>
                  <input
                    type="time"
                    value={assignForm.start_time}
                    onChange={(e) => setAssignForm((p) => ({ ...p, start_time: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">End Time</span>
                  <input
                    type="time"
                    value={assignForm.end_time}
                    onChange={(e) => setAssignForm((p) => ({ ...p, end_time: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </label>
              </div>

              <label className="block text-xs">
                <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Break (Minutes)</span>
                <input
                  type="number"
                  min={0}
                  max={180}
                  value={assignForm.break_minutes}
                  onChange={(e) => setAssignForm((p) => ({ ...p, break_minutes: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>

              <label className="block text-xs">
                <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Rotation Group</span>
                <input
                  type="text"
                  value={assignForm.rotation_group}
                  onChange={(e) => setAssignForm((p) => ({ ...p, rotation_group: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>
            </div>

            {conflictCheck?.hasConflict && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Automatic Conflict Detection Alert
                </div>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[11px]">
                  {conflictCheck.overlaps.map((o) => (
                    <li key={o.id}>
                      Overlaps {o.shift_name} ({o.schedule_code}) on {o.schedule_date} ({o.start_time}–{o.end_time})
                    </li>
                  ))}
                  {conflictCheck.restViolations.map((r) => (
                    <li key={r.id}>
                      Insufficient rest: {r.restHours}h rest vs {r.requiredHours}h required (adjacent to {r.shift_name} on {r.schedule_date})
                    </li>
                  ))}
                  {conflictCheck.leaveConflicts.map((l) => (
                    <li key={l.id}>
                      Employee has Approved {l.leave_type} Leave ({l.start_date} to {l.end_date})
                    </li>
                  ))}
                </ul>
                <label className="mt-2 inline-flex items-center gap-1.5 font-medium">
                  <input
                    type="checkbox"
                    checked={assignForm.force_override}
                    onChange={(e) => setAssignForm((p) => ({ ...p, force_override: e.target.checked }))}
                  />
                  Authorize manager conflict override
                </label>
              </div>
            )}

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Save className="h-3.5 w-3.5" />
              Save Schedule Assignment
            </button>
          </form>

          {/* 3-Shift & 4-Shift Weekly / Monthly Roster Generator */}
          <form
            onSubmit={handleGenerateRoster}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              3-Shift & 4-Shift Weekly / Monthly Roster Generator
            </h3>
            <p className="text-xs text-slate-500">
              Automatically rotates assigned department staff across Morning, Afternoon, Night, Weekend, or 24/7 Security Guard shifts while skipping leave & rest conflicts.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs">
                <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Department Scope</span>
                <select
                  value={genForm.department}
                  onChange={(e) => setGenForm((p) => ({ ...p, department: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="All">All Active Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs">
                <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Shift System</span>
                <select
                  value={genForm.scheduling_system}
                  onChange={(e) =>
                    setGenForm((p) => ({ ...p, scheduling_system: e.target.value as '3-Shift' | '4-Shift' | 'Security 24/7' }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="3-Shift">3-Shift System (Morning · Afternoon · Night)</option>
                  <option value="4-Shift">4-Shift System (+ Weekend Coverage Crew)</option>
                  <option value="Security 24/7">Security 24/7 Guard Rotation</option>
                </select>
              </label>

              <label className="block text-xs">
                <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Start Date</span>
                <input
                  type="date"
                  required
                  value={genForm.start_date}
                  onChange={(e) => setGenForm((p) => ({ ...p, start_date: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>

              <label className="block text-xs">
                <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Timetable Horizon</span>
                <select
                  value={genForm.days}
                  onChange={(e) => setGenForm((p) => ({ ...p, days: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value={7}>Weekly Timetable (7 Days)</option>
                  <option value={14}>Bi-Weekly Rotation (14 Days)</option>
                  <option value={30}>Monthly Timetable (30 Days)</option>
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={genForm.rotate_weekly}
                onChange={(e) => setGenForm((p) => ({ ...p, rotate_weekly: e.target.checked }))}
              />
              Enable automatic weekly shift rotation (Day-to-Night & Morning-Afternoon-Night cycle)
            </label>

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Generate Rotating Timetable
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: DEPARTMENT TIMETABLES */}
      {tab === 'departments' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {departments.map((dept) => {
              const workDays = parseDayList(dept.working_days);
              const restDays = parseDayList(dept.rest_days);
              const deptStaffCount = activeEmployees.filter((e) => e.department === dept.name).length;
              return (
                <div
                  key={dept.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-400">{dept.dept_code}</span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{dept.name}</h4>
                        <span className="text-xs text-blue-600 dark:text-blue-400">· {dept.scheduling_system}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Manager: <strong className="text-slate-700 dark:text-slate-200">{dept.manager_name || 'Unassigned'}</strong> ·{' '}
                        {deptStaffCount} assigned active staff
                      </p>
                    </div>
                    {canManageShiftsDepts && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDeptId(dept.id);
                            setDeptForm({
                              dept_code: dept.dept_code,
                              name: dept.name,
                              manager_employee_id: dept.manager_employee_id,
                              scheduling_system: dept.scheduling_system,
                              default_shift_id: dept.default_shift_id ? String(dept.default_shift_id) : '',
                              working_days: workDays,
                              rest_days: restDays,
                              weekend_schedule_enabled: Boolean(dept.weekend_schedule_enabled),
                              holiday_schedule_enabled: Boolean(dept.holiday_schedule_enabled),
                              security_guard_coverage: dept.security_guard_coverage,
                              monthly_timetable_notes: dept.monthly_timetable_notes,
                            });
                          }}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50 dark:border-slate-700"
                        >
                          Edit Timetable
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId({ type: 'dept', id: dept.id })}
                          className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 border-t border-slate-100 pt-2.5 text-xs sm:grid-cols-3 dark:border-slate-800">
                    <div>
                      <span className="text-slate-400">Working Days: </span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">{workDays.join(', ') || 'None'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Rest Days: </span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">{restDays.join(', ') || 'None'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Guard / Holiday: </span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {dept.weekend_schedule_enabled ? 'Weekend On' : 'Weekend Off'} ·{' '}
                        {dept.holiday_schedule_enabled ? 'Holiday Duty On' : 'Holiday Off'}
                      </span>
                    </div>
                  </div>
                  {dept.security_guard_coverage && (
                    <div className="mt-1.5 text-[11px] text-slate-500">
                      Coverage: {dept.security_guard_coverage} {dept.monthly_timetable_notes ? `· ${dept.monthly_timetable_notes}` : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {canManageShiftsDepts && (
            <form
              onSubmit={handleSaveDepartment}
              className="h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {editingDeptId ? 'Edit Department Timetable' : 'Add Department Timetable'}
              </h3>
              <label className="block text-xs">
                <span className="mb-1 block font-medium">Department Name</span>
                <input
                  type="text"
                  required
                  value={deptForm.name}
                  onChange={(e) => setDeptForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Packaging Line B"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block font-medium">Department Manager (Central HR)</span>
                <select
                  value={deptForm.manager_employee_id}
                  onChange={(e) => setDeptForm((p) => ({ ...p, manager_employee_id: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">-- Select Manager --</option>
                  {activeEmployees.map((emp) => (
                    <option key={emp.id} value={emp.employee_id}>
                      {emp.full_name} ({emp.job_title})
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs">
                  <span className="mb-1 block font-medium">Shift System</span>
                  <select
                    value={deptForm.scheduling_system}
                    onChange={(e) =>
                      setDeptForm((p) => ({ ...p, scheduling_system: e.target.value as DepartmentRecord['scheduling_system'] }))
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="Standard">Standard</option>
                    <option value="3-Shift">3-Shift</option>
                    <option value="4-Shift">4-Shift</option>
                    <option value="Security 24/7">Security 24/7</option>
                  </select>
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block font-medium">Default Shift</span>
                  <select
                    value={deptForm.default_shift_id}
                    onChange={(e) => setDeptForm((p) => ({ ...p, default_shift_id: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">Auto</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.shift_name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="text-xs">
                <span className="mb-1 block font-medium">Working Days</span>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((wd) => (
                    <button
                      key={wd}
                      type="button"
                      onClick={() => {
                        const nextWork = toggleDayInList(deptForm.working_days, wd);
                        const nextRest = WEEKDAYS.filter((d) => !nextWork.includes(d));
                        setDeptForm((p) => ({ ...p, working_days: nextWork, rest_days: nextRest }));
                      }}
                      className={`rounded px-2 py-1 text-[11px] font-medium ${
                        deptForm.working_days.includes(wd)
                          ? 'bg-blue-600 text-white'
                          : 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {wd}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 text-xs">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={deptForm.weekend_schedule_enabled}
                    onChange={(e) => setDeptForm((p) => ({ ...p, weekend_schedule_enabled: e.target.checked }))}
                  />
                  Enable Weekend Schedule
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={deptForm.holiday_schedule_enabled}
                    onChange={(e) => setDeptForm((p) => ({ ...p, holiday_schedule_enabled: e.target.checked }))}
                  />
                  Enable Holiday Duty Schedule
                </label>
              </div>
              <label className="block text-xs">
                <span className="mb-1 block font-medium">Security Guard / Timetable Notes</span>
                <input
                  type="text"
                  value={deptForm.security_guard_coverage}
                  onChange={(e) => setDeptForm((p) => ({ ...p, security_guard_coverage: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Save className="h-3.5 w-3.5" />
                  {editingDeptId ? 'Update Department' : 'Create Department'}
                </button>
                {editingDeptId && (
                  <button
                    type="button"
                    onClick={() => setEditingDeptId(null)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      {/* TAB 4: SHIFTS & 3-SHIFT / 4-SHIFT MANAGEMENT */}
      {tab === 'shifts' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Shift</th>
                  <th className="px-3 py-2.5 font-semibold">System</th>
                  <th className="px-3 py-2.5 font-semibold">Window & Break</th>
                  <th className="px-3 py-2.5 font-semibold">Rotation & Rest</th>
                  <th className="px-3 py-2.5 font-semibold">OT / Grace</th>
                  {canManageShiftsDepts && <th className="px-3 py-2.5 font-semibold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {shifts.map((sh) => (
                  <tr key={sh.id}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: sh.color_hex || '#2563eb' }} />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{sh.shift_name}</div>
                          <div className="text-[11px] text-slate-500">
                            {sh.shift_code} · {sh.shift_category}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">{sh.scheduling_system}</td>
                    <td className="px-3 py-2.5 tabular-nums">
                      <div>
                        {sh.start_time} – {sh.end_time}
                      </div>
                      <div className="text-[11px] text-slate-500">{sh.break_minutes} min break</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div>{sh.is_rotating ? sh.rotation_pattern : 'Fixed Schedule'}</div>
                      <div className="text-[11px] text-slate-500">Min {sh.min_rest_hours}h rest</div>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      <div>{sh.ot_multiplier}x OT</div>
                      <div className="text-[11px] text-slate-500">{sh.grace_late_minutes}m late grace</div>
                    </td>
                    {canManageShiftsDepts && (
                      <td className="px-3 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingShiftId(sh.id);
                              setShiftForm({
                                shift_code: sh.shift_code,
                                shift_name: sh.shift_name,
                                shift_category: sh.shift_category,
                                scheduling_system: sh.scheduling_system,
                                start_time: sh.start_time,
                                end_time: sh.end_time,
                                break_minutes: sh.break_minutes,
                                working_days: parseDayList(sh.working_days),
                                rest_days: parseDayList(sh.rest_days),
                                min_rest_hours: sh.min_rest_hours,
                                is_rotating: Boolean(sh.is_rotating),
                                rotation_pattern: sh.rotation_pattern,
                                color_hex: sh.color_hex,
                                ot_multiplier: sh.ot_multiplier,
                                grace_late_minutes: sh.grace_late_minutes,
                                status: sh.status,
                                notes: sh.notes,
                              });
                            }}
                            className="rounded border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50 dark:border-slate-700"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId({ type: 'shift', id: sh.id })}
                            className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 dark:border-red-900"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canManageShiftsDepts && (
            <form
              onSubmit={handleSaveShift}
              className="h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {editingShiftId ? 'Edit Shift Definition' : 'Create Shift Definition'}
              </h3>
              <label className="block text-xs">
                <span className="mb-1 block font-medium">Shift Name</span>
                <input
                  type="text"
                  required
                  value={shiftForm.shift_name}
                  onChange={(e) => setShiftForm((p) => ({ ...p, shift_name: e.target.value }))}
                  placeholder="e.g. Plant Night Shift B"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs">
                  <span className="mb-1 block font-medium">Category (9 Types)</span>
                  <select
                    value={shiftForm.shift_category}
                    onChange={(e) => setShiftForm((p) => ({ ...p, shift_category: e.target.value as ShiftCategory }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    {SHIFT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block font-medium">Shift System</span>
                  <select
                    value={shiftForm.scheduling_system}
                    onChange={(e) =>
                      setShiftForm((p) => ({ ...p, scheduling_system: e.target.value as ShiftDefinition['scheduling_system'] }))
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="3-Shift">3-Shift</option>
                    <option value="4-Shift">4-Shift</option>
                    <option value="Standard">Standard</option>
                    <option value="Security 24/7">Security 24/7</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="block text-xs">
                  <span className="mb-1 block font-medium">Start</span>
                  <input
                    type="time"
                    value={shiftForm.start_time}
                    onChange={(e) => setShiftForm((p) => ({ ...p, start_time: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block font-medium">End</span>
                  <input
                    type="time"
                    value={shiftForm.end_time}
                    onChange={(e) => setShiftForm((p) => ({ ...p, end_time: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block font-medium">Break (m)</span>
                  <input
                    type="number"
                    value={shiftForm.break_minutes}
                    onChange={(e) => setShiftForm((p) => ({ ...p, break_minutes: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="block text-xs">
                  <span className="mb-1 block font-medium">Min Rest (h)</span>
                  <input
                    type="number"
                    value={shiftForm.min_rest_hours}
                    onChange={(e) => setShiftForm((p) => ({ ...p, min_rest_hours: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block font-medium">OT Mult</span>
                  <input
                    type="number"
                    step="0.05"
                    value={shiftForm.ot_multiplier}
                    onChange={(e) => setShiftForm((p) => ({ ...p, ot_multiplier: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block font-medium">Late Grace</span>
                  <input
                    type="number"
                    value={shiftForm.grace_late_minutes}
                    onChange={(e) => setShiftForm((p) => ({ ...p, grace_late_minutes: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
              </div>
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={shiftForm.is_rotating}
                  onChange={(e) => setShiftForm((p) => ({ ...p, is_rotating: e.target.checked }))}
                />
                Rotating Shift (Day-to-Night / Weekly / Monthly)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Save className="h-3.5 w-3.5" />
                  {editingShiftId ? 'Save Shift' : 'Add Shift'}
                </button>
                {editingShiftId && (
                  <button
                    type="button"
                    onClick={() => setEditingShiftId(null)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      {/* TAB 5: AVAILABILITY, HOLIDAYS & WORKFORCE RULES */}
      {tab === 'availability' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Live Employee Availability & Attendance Sync ({formatDateLabel(anchorDate)})
                </h3>
                <p className="text-xs text-slate-500">
                  Unified view across Central HR, Staff Schedules, Approved Leaves, and Daily Attendance punches.
                </p>
              </div>
              <input
                type="date"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Employee ID</th>
                    <th className="px-3 py-2 font-semibold">Full Name</th>
                    <th className="px-3 py-2 font-semibold">Department</th>
                    <th className="px-3 py-2 font-semibold">Schedule Status</th>
                    <th className="px-3 py-2 font-semibold">Attendance Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {availabilityRows.map(({ emp, availability, att }) => (
                    <tr key={emp.id}>
                      <td className="px-3 py-2 font-mono text-[11px]">{emp.employee_id}</td>
                      <td className="px-3 py-2 font-medium">{emp.full_name}</td>
                      <td className="px-3 py-2">{emp.department}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`font-semibold ${
                            availability.startsWith('Conflict')
                              ? 'text-red-600'
                              : availability.startsWith('On Leave')
                              ? 'text-amber-600'
                              : availability === 'Available'
                              ? 'text-emerald-600'
                              : 'text-blue-600'
                          }`}
                        >
                          {availability}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                        {att ? `${att.status} (${att.check_in}–${att.check_out})` : 'No punch logged yet'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Public & Company Holidays */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Holiday Schedule Calendar</h3>
              <div className="mt-3 max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs dark:divide-slate-800">
                {holidays.map((h) => (
                  <div key={h.id} className="flex items-center justify-between py-2">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100">{h.name}</div>
                      <div className="text-[11px] tabular-nums text-slate-500">
                        {formatDateLabel(h.holiday_date)} · {h.ot_multiplier}x Holiday OT
                      </div>
                    </div>
                    {canManageShiftsDepts && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId({ type: 'holiday', id: h.id })}
                        className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 dark:border-red-900"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {canManageShiftsDepts && (
                <form onSubmit={handleAddHoliday} className="mt-3 grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3 dark:border-slate-800">
                  <input
                    type="date"
                    required
                    value={holidayForm.holiday_date}
                    onChange={(e) => setHolidayForm((p) => ({ ...p, holiday_date: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Holiday name"
                    value={holidayForm.name}
                    onChange={(e) => setHolidayForm((p) => ({ ...p, name: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Add Holiday
                  </button>
                </form>
              )}
            </div>

            {/* Workforce Attendance & Rest Period Rules */}
            <form
              onSubmit={handleSaveRules}
              className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Attendance & Conflict Protection Rules
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <label className="block">
                  <span className="mb-1 block font-medium">Late Arrival Grace (mins)</span>
                  <input
                    type="number"
                    disabled={!canManageShiftsDepts}
                    value={rules.late_grace_minutes}
                    onChange={(e) => setRules((r) => ({ ...r, late_grace_minutes: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block font-medium">Early Exit Grace (mins)</span>
                  <input
                    type="number"
                    disabled={!canManageShiftsDepts}
                    value={rules.early_departure_grace_minutes}
                    onChange={(e) => setRules((r) => ({ ...r, early_departure_grace_minutes: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block font-medium">Default Break Time (mins)</span>
                  <input
                    type="number"
                    disabled={!canManageShiftsDepts}
                    value={rules.default_break_minutes}
                    onChange={(e) => setRules((r) => ({ ...r, default_break_minutes: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block font-medium">Min Rest Between Shifts (hrs)</span>
                  <input
                    type="number"
                    disabled={!canManageShiftsDepts}
                    value={rules.min_rest_hours_between_shifts}
                    onChange={(e) => setRules((r) => ({ ...r, min_rest_hours_between_shifts: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
              </div>
              <div className="flex flex-col gap-1.5 text-xs">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    disabled={!canManageShiftsDepts}
                    checked={Boolean(rules.auto_detect_conflicts)}
                    onChange={(e) => setRules((r) => ({ ...r, auto_detect_conflicts: e.target.checked }))}
                  />
                  Automatically block overlapping shifts & insufficient rest periods
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    disabled={!canManageShiftsDepts}
                    checked={Boolean(rules.require_manager_approval)}
                    onChange={(e) => setRules((r) => ({ ...r, require_manager_approval: e.target.checked }))}
                  />
                  Require manager approval for schedule swaps & changes
                </label>
              </div>
              {canManageShiftsDepts && (
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save Rules
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* REPLACE / SWAP STAFF MODAL */}
      {replaceTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={handleReplaceSubmit}
            className="w-full max-w-md space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Replace / Reassign Shift</h3>
              <button type="button" onClick={() => setReplaceTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Reassigning <strong>{replaceTarget.employee_name}</strong> from <strong>{replaceTarget.shift_name}</strong> on{' '}
              {replaceTarget.schedule_date} ({replaceTarget.start_time}–{replaceTarget.end_time}).
            </p>
            <label className="block text-xs">
              <span className="mb-1 block font-medium">Replacement Employee</span>
              <select
                required
                value={replaceEmpId}
                onChange={(e) => setReplaceEmpId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">-- Select Available Staff --</option>
                {activeEmployees
                  .filter((e) => e.employee_id !== replaceTarget.employee_id)
                  .map((emp) => (
                    <option key={emp.id} value={emp.employee_id}>
                      {emp.full_name} ({emp.employee_id}) · {emp.department}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium">Reason for Shift Change / Replacement</span>
              <input
                type="text"
                required
                placeholder="e.g. Sick leave coverage, shift swap"
                value={replaceReason}
                onChange={(e) => setReplaceReason(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={replaceOverride}
                onChange={(e) => setReplaceOverride(e.target.checked)}
              />
              Override conflict check if emergency coverage is required
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReplaceTarget(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
              >
                Confirm Replacement
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT SCHEDULE MODAL */}
      {editScheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={handleEditScheduleSubmit}
            className="w-full max-w-md space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Edit Schedule ({editScheduleTarget.schedule_code})
              </h3>
              <button type="button" onClick={() => setEditScheduleTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <label className="col-span-2 block">
                <span className="mb-1 block font-medium">Shift</span>
                <select
                  value={editScheduleTarget.shift_id || ''}
                  onChange={(e) => {
                    const sh = shifts.find((s) => String(s.id) === e.target.value);
                    if (sh) {
                      setEditScheduleTarget({
                        ...editScheduleTarget,
                        shift_id: sh.id,
                        shift_name: sh.shift_name,
                        shift_category: sh.shift_category,
                        start_time: sh.start_time,
                        end_time: sh.end_time,
                        break_minutes: sh.break_minutes,
                      });
                    }
                  }}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  {shifts.map((sh) => (
                    <option key={sh.id} value={sh.id}>
                      {sh.shift_name} ({sh.start_time}–{sh.end_time})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block font-medium">Date</span>
                <input
                  type="date"
                  value={editScheduleTarget.schedule_date}
                  onChange={(e) =>
                    setEditScheduleTarget({
                      ...editScheduleTarget,
                      schedule_date: e.target.value,
                      end_date: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-medium">Break (mins)</span>
                <input
                  type="number"
                  value={editScheduleTarget.break_minutes}
                  onChange={(e) =>
                    setEditScheduleTarget({ ...editScheduleTarget, break_minutes: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-medium">Start Time</span>
                <input
                  type="time"
                  value={editScheduleTarget.start_time}
                  onChange={(e) => setEditScheduleTarget({ ...editScheduleTarget, start_time: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-medium">End Time</span>
                <input
                  type="time"
                  value={editScheduleTarget.end_time}
                  onChange={(e) => setEditScheduleTarget({ ...editScheduleTarget, end_time: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditScheduleTarget(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
