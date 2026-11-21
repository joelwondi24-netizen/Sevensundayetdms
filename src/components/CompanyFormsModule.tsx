import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Check,
  Clock,
  Database,
  Download,
  Eye,
  FilePlus2,
  FolderOpen,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  Sliders,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../api';
import {
  ALL_COMPANY_FORMS,
  COMPANY_FORM_DEPARTMENTS,
  DEFAULT_STAFF_EVALUATION_CRITERIA,
  type CompanyFormDef,
  type CompanyFormFieldDef,
  type StaffEvaluationRow,
} from '../data/companyFormsCatalog';
import type {
  AttendanceRecord,
  CompanyFormSubmission,
  CompanyFormTemplateOverride,
  CompanySettings,
  DepartmentRecord,
  EmployeeProfile,
  HolidayRecord,
  ShiftDefinition,
  StaffScheduleRecord,
} from '../types';
import { toEthiopianDateString } from '../utils/ethiopianCalendar';
import { RealQrCode } from './RealQrCode';
import { SendToApproveButton } from './SendToApproveButton';
import { ShareButton } from './ShareButton';
import { PrintableSheetFrame } from './PrintableSheetFrame';
import { printWithAutoFit } from '../utils/printFit';

interface CompanyFormsModuleProps {
  company?: CompanySettings | null;
  onRefreshDashboard: () => void;
}

interface ParsedSubmissionPayload {
  values: Record<string, string>;
  columns: string[];
  rows: string[][];
  remarks: string;
  includeEvaluation: boolean;
  evaluationPeriod: string;
  evaluatorName: string;
  evaluationRows: StaffEvaluationRow[];
}

function computeEvaluationSummary(rows: StaffEvaluationRow[]) {
  const totalWeight = rows.reduce((s, r) => s + (Number(r.weight) || 0), 0);
  const weightedSum = rows.reduce((s, r) => s + ((Number(r.rating) || 0) / 5) * (Number(r.weight) || 0), 0);
  const scorePct = totalWeight > 0 ? Number(((weightedSum / totalWeight) * 100).toFixed(1)) : 0;
  let grade = 'C';
  let label = 'Meets Expectations';
  if (scorePct >= 90) {
    grade = 'A';
    label = 'Outstanding';
  } else if (scorePct >= 80) {
    grade = 'B';
    label = 'Exceeds Expectations';
  } else if (scorePct >= 65) {
    grade = 'C';
    label = 'Meets Expectations';
  } else if (scorePct >= 50) {
    grade = 'D';
    label = 'Needs Improvement';
  } else {
    grade = 'E';
    label = 'Unsatisfactory';
  }
  return { totalWeight, scorePct, grade, label };
}

export const CompanyFormsModule: React.FC<CompanyFormsModuleProps> = ({
  company,
  onRefreshDashboard,
}) => {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [templates, setTemplates] = useState<CompanyFormTemplateOverride[]>([]);
  const [submissions, setSubmissions] = useState<CompanyFormSubmission[]>([]);

  const [activeDeptKey, setActiveDeptKey] = useState<string>('hr');
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [selectedFormCode, setSelectedFormCode] = useState<string>('SS-HR-18');
  const [workspaceTab, setWorkspaceTab] = useState<'fill' | 'template' | 'preview'>('fill');
  const [sheetOrientation, setSheetOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // Active submission editing state
  const [editingSubId, setEditingSubId] = useState<number | null>(null);
  const [editingSubNumber, setEditingSubNumber] = useState<string | null>(null);
  const [formTitleOverride, setFormTitleOverride] = useState<string>('');
  const [employeeCode, setEmployeeCode] = useState<string>('');
  const [employeeName, setEmployeeName] = useState<string>('');
  const [submissionDate, setSubmissionDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [status, setStatus] = useState<CompanyFormSubmission['status']>('Submitted');
  const [preparedBy, setPreparedBy] = useState<string>('HR & Operations Officer');
  const [checkedBy, setCheckedBy] = useState<string>('Department Manager');
  const [approvedBy, setApprovedBy] = useState<string>('General Manager');

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [tableColumns, setTableColumns] = useState<string[]>(['Item', 'Specification / Detail', 'Value / Qty', 'Status']);
  const [tableRows, setTableRows] = useState<string[][]>([['', '', '', '']]);
  const [remarks, setRemarks] = useState<string>('');

  // Staff Evaluation Rubric state
  const [includeEvaluation, setIncludeEvaluation] = useState<boolean>(true);
  const [evaluationPeriod, setEvaluationPeriod] = useState<string>('Q4 2026');
  const [evaluatorName, setEvaluatorName] = useState<string>('Department Manager');
  const [evaluationRows, setEvaluationRows] = useState<StaffEvaluationRow[]>(
    DEFAULT_STAFF_EVALUATION_CRITERIA.map((r) => ({ ...r }))
  );

  // Template structural editing state
  const [tplTitle, setTplTitle] = useState<string>('');
  const [tplSubtitle, setTplSubtitle] = useState<string>('');
  const [tplDefaultNotes, setTplDefaultNotes] = useState<string>('');
  const [tplFields, setTplFields] = useState<CompanyFormFieldDef[]>([]);
  const [tplColumns, setTplColumns] = useState<string[]>([]);

  // Register filtering & preview state
  const [registerSearch, setRegisterSearch] = useState<string>('');
  const [registerDeptFilter, setRegisterDeptFilter] = useState<string>('all');
  const [previewSubmission, setPreviewSubmission] = useState<CompanyFormSubmission | null>(null);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const logoSrc =
    company?.logo_data && company.logo_data.startsWith('data:')
      ? company.logo_data
      : '/assets/aistudio/Seven_Sunday_Logo_2_desktop_addf2fa7.png';

  const templateMap = useMemo(() => {
    const map = new Map<string, CompanyFormTemplateOverride>();
    for (const t of templates) map.set(t.form_code, t);
    return map;
  }, [templates]);

  const resolvedForm = useMemo<CompanyFormDef>(() => {
    const base = ALL_COMPANY_FORMS.find((f) => f.code === selectedFormCode) || ALL_COMPANY_FORMS[0];
    const override = templateMap.get(base.code);
    if (!override) return base;
    let parsedFields = base.fields;
    let parsedCols = base.defaultColumns;
    try {
      const f = JSON.parse(override.fields_json);
      if (Array.isArray(f) && f.length > 0) parsedFields = f;
    } catch {
      // keep base fields
    }
    try {
      const c = JSON.parse(override.columns_json);
      if (Array.isArray(c) && c.length > 0) parsedCols = c;
    } catch {
      // keep base columns
    }
    return {
      ...base,
      name: override.custom_title || base.name,
      fields: parsedFields,
      defaultColumns: parsedCols,
    };
  }, [selectedFormCode, templateMap]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empList, tplList, subList] = await Promise.all([
        api.get<EmployeeProfile[]>('/api/employees'),
        api.get<CompanyFormTemplateOverride[]>('/api/company-forms/templates'),
        api.get<CompanyFormSubmission[]>('/api/company-forms/submissions'),
      ]);
      setEmployees(empList);
      setTemplates(tplList);
      setSubmissions(subList);
      if (empList.length > 0 && !employeeCode) {
        setEmployeeCode(empList[0].employee_id);
        setEmployeeName(empList[0].full_name);
      }
      if (subList.length > 0 && !previewSubmission) {
        setPreviewSubmission(subList[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load company forms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const onOpenForm = (evt: Event) => {
      const code = (evt as CustomEvent<string>).detail;
      if (!code) return;
      const found = ALL_COMPANY_FORMS.find((f) => f.code === code);
      if (found) {
        setSelectedFormCode(found.code);
        setActiveDeptKey(found.departmentKey);
        const emp = employees.find((e) => e.employee_id === employeeCode) || employees[0];
        initializeFreshForm(found, emp);
        setWorkspaceTab('fill');
      }
    };
    window.addEventListener('sevensunday:open-form', onOpenForm);
    return () => window.removeEventListener('sevensunday:open-form', onOpenForm);
  }, [employees, employeeCode]);

  const initializeFreshForm = (form: CompanyFormDef, emp?: EmployeeProfile) => {
    setEditingSubId(null);
    setEditingSubNumber(null);
    setFormTitleOverride(form.name);
    const initialVals: Record<string, string> = {};
    for (const f of form.fields) {
      if (f.key === 'employee_code' && emp) initialVals[f.key] = emp.employee_id;
      else if (f.key === 'department' && emp) initialVals[f.key] = emp.department;
      else if (f.key === 'job_title' && emp) initialVals[f.key] = emp.job_title;
      else if (f.type === 'date') initialVals[f.key] = new Date().toISOString().slice(0, 10);
      else if (f.type === 'select' && f.options?.[0]) initialVals[f.key] = f.options[0];
      else initialVals[f.key] = f.defaultValue || '';
    }
    setFieldValues(initialVals);
    setTableColumns([...form.defaultColumns]);
    const blankRow = form.defaultColumns.map(() => '');
    setTableRows([blankRow, [...blankRow]]);
    const override = templateMap.get(form.code);
    setRemarks(override?.default_notes || '');
    setIncludeEvaluation(Boolean(form.isEvaluation));
    setEvaluationRows(DEFAULT_STAFF_EVALUATION_CRITERIA.map((r) => ({ ...r })));
    setSubmissionDate(new Date().toISOString().slice(0, 10));
    setReferenceNo('');
    setStatus('Submitted');

    // Also sync template editor state
    setTplTitle(form.name);
    setTplSubtitle(override?.subtitle || form.departmentName);
    setTplDefaultNotes(override?.default_notes || '');
    setTplFields(form.fields.map((f) => ({ ...f })));
    setTplColumns([...form.defaultColumns]);
  };

  useEffect(() => {
    if (editingSubId === null) {
      const emp = employees.find((e) => e.employee_id === employeeCode) || employees[0];
      initializeFreshForm(resolvedForm, emp);
    }
  }, [selectedFormCode, templates]);

  const handleSelectCatalogForm = (form: CompanyFormDef) => {
    setSelectedFormCode(form.code);
    setActiveDeptKey(form.departmentKey);
    const emp = employees.find((e) => e.employee_id === employeeCode) || employees[0];
    initializeFreshForm(
      ALL_COMPANY_FORMS.find((x) => x.code === form.code) || form,
      emp
    );
    setWorkspaceTab('fill');
    setNotice(null);
    setError(null);
  };

  const handleLoadSampleData = (openPreview = false) => {
    const emp = employees.find((e) => e.employee_id === employeeCode) || employees[0];
    const today = new Date().toISOString().slice(0, 10);
    setEditingSubId(null);
    setEditingSubNumber(null);
    setPreviewSubmission(null);
    setFormTitleOverride(resolvedForm.name);
    if (emp) {
      setEmployeeCode(emp.employee_id);
      setEmployeeName(emp.full_name);
    } else {
      setEmployeeCode('SS-EMP-001');
      setEmployeeName('Abebe Bikila');
    }
    setSubmissionDate(today);
    setReferenceNo(`SMP-${resolvedForm.code}-${today.replace(/-/g, '').slice(2)}`);
    setStatus('Submitted');
    setPreparedBy('HR & Operations Officer');
    setCheckedBy(emp?.department ? `${emp.department} Supervisor` : 'Department Manager');
    setApprovedBy('General Manager');

    const sampleVals: Record<string, string> = {};
    for (const f of resolvedForm.fields) {
      const lbl = f.label.toLowerCase();
      if (f.key === 'employee_code') sampleVals[f.key] = emp?.employee_id || 'SS-EMP-001';
      else if (f.key === 'department') sampleVals[f.key] = emp?.department || resolvedForm.departmentName.replace(' Forms', '');
      else if (f.key === 'job_title') sampleVals[f.key] = emp?.job_title || 'Senior Specialist';
      else if (f.type === 'date') sampleVals[f.key] = today;
      else if (f.type === 'number') sampleVals[f.key] = lbl.includes('amount') || lbl.includes('cost') || lbl.includes('salary') ? '12500' : '5';
      else if (f.type === 'select' && f.options?.[0]) sampleVals[f.key] = f.options[0];
      else if (f.type === 'textarea') {
        sampleVals[f.key] = `Sample entry prepared for ${resolvedForm.name} (${resolvedForm.code}) covering ${resolvedForm.departmentName} operations, compliance verification, and departmental review.`;
      } else if (lbl.includes('phone')) sampleVals[f.key] = '+251 911 234 567';
      else if (lbl.includes('email')) sampleVals[f.key] = 'operations@sevensundayethiopia.com';
      else if (lbl.includes('branch') || lbl.includes('location')) sampleVals[f.key] = 'Addis Ababa HQ / Adama Plant';
      else sampleVals[f.key] = f.placeholder || `Sample ${f.label}`;
    }
    setFieldValues(sampleVals);

    const sampleRows = [1, 2, 3].map((rowNum) =>
      tableColumns.map((col, cIdx) => {
        const c = col.toLowerCase();
        if (c.includes('qty') || c.includes('count') || c.includes('hours')) return String(rowNum * 2);
        if (c.includes('amount') || c.includes('price') || c.includes('birr') || c.includes('total')) return String(rowNum * 1500);
        if (c.includes('status')) return rowNum === 3 ? 'Verified' : 'Approved';
        if (c.includes('date')) return today;
        if (cIdx === 0) return `Sample Item ${rowNum} (${resolvedForm.code})`;
        return `Verified ${col} #${rowNum}`;
      })
    );
    setTableRows(sampleRows);
    setRemarks(`Sample populated for ${resolvedForm.code} (${resolvedForm.name}). All fields, line-items, and evaluation scores remain fully editable before saving or printing.`);
    setEvaluationPeriod('Q4 2026');
    setEvaluatorName('Department Manager');
    setEvaluationRows(
      DEFAULT_STAFF_EVALUATION_CRITERIA.map((r, i) => ({
        ...r,
        rating: i % 2 === 0 ? 5 : 4,
        comments: i % 2 === 0 ? 'Consistently exceeds operational targets and quality standards.' : 'Strong teamwork and dependable execution.',
      }))
    );
    if (openPreview) setWorkspaceTab('preview');
    setNotice(`Loaded editable sample data for ${resolvedForm.code} (${resolvedForm.name}). Edit any field or print A4.`);
  };

  const handleLoadLiveAttendanceShiftData = async (openPreview = false) => {
    setError(null);
    setNotice(null);
    setPreviewSubmission(null);
    try {
      const [attList, schedList, shiftList, deptList, holList] = await Promise.all([
        api.get<AttendanceRecord[]>('/api/attendance').catch(() => [] as AttendanceRecord[]),
        api.get<StaffScheduleRecord[]>('/api/scheduling').catch(() => [] as StaffScheduleRecord[]),
        api.get<ShiftDefinition[]>('/api/shifts').catch(() => [] as ShiftDefinition[]),
        api.get<DepartmentRecord[]>('/api/departments').catch(() => [] as DepartmentRecord[]),
        api.get<HolidayRecord[]>('/api/holidays').catch(() => [] as HolidayRecord[]),
      ]);

      const today = submissionDate || new Date().toISOString().slice(0, 10);
      const code = resolvedForm.code;
      const cols = [...resolvedForm.defaultColumns];
      let rows: string[][] = [];
      const nextVals: Record<string, string> = { ...fieldValues };

      if (code === 'SS-ATT-01') {
        const targetDate = nextVals.attendance_date || today;
        const daily = attList.filter((a) => a.attendance_date === targetDate);
        const source = daily.length > 0 ? daily : attList.slice(0, 20);
        nextVals.attendance_date = targetDate;
        nextVals.present_count = String(source.filter((a) => a.status !== 'Absent' && a.status !== 'On Leave').length);
        nextVals.absent_late_summary = `Live attendance snapshot for ${targetDate}: ${source.length} records loaded (${source.filter((a) => (a.late_minutes || 0) > 0).length} late, ${source.filter((a) => a.status === 'Absent').length} absent).`;
        rows = source.map((a) => [
          a.employee_code,
          a.employee_name,
          a.department,
          `${a.shift_name} (${a.shift_period || 'Day'})`,
          a.check_in || '—',
          a.check_out || '—',
          `${a.status}${(a.late_minutes || 0) > 0 ? ` (+${a.late_minutes}m)` : ''}`,
        ]);
      } else if (code === 'SS-ATT-02') {
        const byEmp = new Map<string, { name: string; dept: string; days: number; late: number; ot: number; abs: number }>();
        for (const a of attList) {
          const cur = byEmp.get(a.employee_code) || { name: a.employee_name, dept: a.department, days: 0, late: 0, ot: 0, abs: 0 };
          if (a.status !== 'Absent') cur.days += 1;
          cur.late += Number(a.late_minutes || 0);
          cur.ot += Number(a.ot_hours || 0);
          cur.abs += Number(a.absence_hours || 0);
          byEmp.set(a.employee_code, cur);
        }
        const totalHrs = attList.reduce((s, a) => s + Number(a.regular_hours || 0) + Number(a.ot_hours || 0), 0);
        nextVals.total_hours = totalHrs.toFixed(1);
        nextVals.weekly_summary = `Aggregated weekly attendance across ${byEmp.size} staff members (${totalHrs.toFixed(1)} total hours).`;
        rows = Array.from(byEmp.entries()).map(([id, v]) => [
          id,
          v.name,
          v.dept,
          String(v.days),
          String(v.late),
          v.ot.toFixed(1),
          v.abs > 0 ? `${v.abs}h Abs` : 'Compliant',
        ]);
      } else if (code === 'SS-ATT-03') {
        const monthPrefix = (nextVals.month_period || today.slice(0, 7)).slice(0, 7);
        nextVals.month_period = monthPrefix;
        const monthly = attList.filter((a) => a.attendance_date.startsWith(monthPrefix));
        const source = monthly.length > 0 ? monthly : attList;
        const byEmp = new Map<string, { name: string; dept: string; reg: number; abs: number; ot: number; pay: number }>();
        for (const a of source) {
          const cur = byEmp.get(a.employee_code) || { name: a.employee_name, dept: a.department, reg: 0, abs: 0, ot: 0, pay: 0 };
          cur.reg += Number(a.regular_hours || 0);
          cur.abs += Number(a.absence_hours || 0);
          cur.ot += Number(a.ot_hours || 0);
          cur.pay += Number(a.ot_pay || 0);
          byEmp.set(a.employee_code, cur);
        }
        nextVals.monthly_notes = `Monthly register compiled for ${monthPrefix} covering ${byEmp.size} active employees.`;
        rows = Array.from(byEmp.entries()).map(([id, v]) => [
          id,
          v.name,
          v.dept,
          v.reg.toFixed(1),
          v.abs.toFixed(1),
          v.ot.toFixed(1),
          v.pay.toFixed(2),
        ]);
      } else if (code === 'SS-ATT-04') {
        rows = attList.slice(0, 25).map((a) => [
          a.employee_code,
          a.employee_name,
          a.department,
          a.morning_check_in ? `${a.morning_check_in}–${a.morning_check_out || '--:--'}` : '—',
          a.afternoon_check_in ? `${a.afternoon_check_in}–${a.afternoon_check_out || '--:--'}` : '—',
          a.night_check_in ? `${a.night_check_in}–${a.night_check_out || '--:--'}` : '—',
          a.status,
        ]);
        if (rows.length === 0 && schedList.length > 0) {
          rows = schedList.slice(0, 25).map((s) => [
            s.employee_id,
            s.employee_name,
            s.department,
            s.shift_name.toLowerCase().includes('morning') ? `${s.start_time}–${s.end_time}` : '—',
            s.shift_name.toLowerCase().includes('afternoon') ? `${s.start_time}–${s.end_time}` : '—',
            s.shift_name.toLowerCase().includes('night') ? `${s.start_time}–${s.end_time}` : '—',
            s.availability_status,
          ]);
        }
        nextVals.handover_protocol = `Loaded ${rows.length} multi-session (Morning / Afternoon / Night) records from database.`;
      } else if (code === 'SS-ATT-05') {
        const lates = attList.filter((a) => Number(a.late_minutes || 0) > 0 || a.status.includes('Late'));
        const totalLate = lates.reduce((s, a) => s + Number(a.late_minutes || 0), 0);
        nextVals.total_late_minutes = String(totalLate);
        nextVals.disciplinary_notes = `${lates.length} late arrival records totaling ${totalLate} minutes.`;
        rows = lates.map((a) => [
          a.employee_code,
          a.employee_name,
          a.department,
          a.attendance_date,
          a.scheduled_start || '08:00',
          a.check_in || '—',
          `${a.late_minutes || 0} min`,
        ]);
      } else if (code === 'SS-ATT-06') {
        const absList = attList.filter((a) => Number(a.absence_hours || 0) > 0 || a.status === 'Absent' || a.status === 'On Leave');
        const totalAbs = absList.reduce((s, a) => s + Number(a.absence_hours || 0), 0);
        nextVals.total_absence_hours = totalAbs.toFixed(1);
        nextVals.absence_notes = `${absList.length} absence/leave entries totaling ${totalAbs.toFixed(1)} hours.`;
        rows = absList.map((a) => [
          a.employee_code,
          a.employee_name,
          a.department,
          a.attendance_date,
          String(a.absence_hours || (a.status === 'Absent' ? 8 : 0)),
          a.notes || a.status,
          a.status,
        ]);
      } else if (code === 'SS-ATT-07') {
        const otList = attList.filter((a) => Number(a.ot_hours || 0) > 0 || Number(a.ot_pay || 0) > 0);
        const totalOt = otList.reduce((s, a) => s + Number(a.ot_hours || 0), 0);
        nextVals.total_ot_hours = totalOt.toFixed(1);
        nextVals.ot_justification = `Loaded ${otList.length} categorized overtime entries totaling ${totalOt.toFixed(1)} OT hours.`;
        rows = otList.map((a) => [
          a.employee_code,
          a.employee_name,
          a.attendance_date,
          a.ot_type,
          `${a.ot_multiplier}x`,
          String(a.ot_hours),
          Number(a.ot_pay || 0).toFixed(2),
        ]);
      } else if (code === 'SS-ATT-08') {
        const deptNames = Array.from(new Set([...deptList.map((d) => d.name), ...employees.map((e) => e.department)]));
        rows = deptNames.map((dName) => {
          const deptObj = deptList.find((d) => d.name === dName);
          const staffCount = employees.filter((e) => e.department === dName).length;
          const deptLogs = attList.filter((a) => a.department === dName);
          const present = deptLogs.filter((a) => a.status !== 'Absent' && a.status !== 'On Leave').length;
          const late = deptLogs.filter((a) => (a.late_minutes || 0) > 0).length;
          const absent = deptLogs.filter((a) => a.status === 'Absent').length;
          const rate = deptLogs.length > 0 ? `${Math.round((present / deptLogs.length) * 100)}%` : '100%';
          return [dName, deptObj?.manager_name || 'Dept Manager', String(staffCount), String(present), String(late), String(absent), rate];
        });
        nextVals.dept_remarks = `Live attendance summary across ${rows.length} departments.`;
      } else if (code === 'SS-ATT-09') {
        const guardScheds = schedList.filter(
          (s) =>
            s.department.toLowerCase().includes('security') ||
            s.shift_name.toLowerCase().includes('security') ||
            s.shift_name.toLowerCase().includes('guard')
        );
        const source = guardScheds.length > 0 ? guardScheds : schedList.slice(0, 15);
        rows = source.map((s) => {
          const attMatch = attList.find((a) => a.employee_code === s.employee_id && a.attendance_date === s.schedule_date);
          return [
            s.schedule_date,
            `${s.employee_id} · ${s.employee_name}`,
            s.department || 'Security Gate',
            `${s.shift_name} (${s.start_time}–${s.end_time})`,
            attMatch ? `${attMatch.check_in}–${attMatch.check_out}` : 'Scheduled',
            attMatch ? attMatch.status : s.approval_status,
          ];
        });
        nextVals.guard_briefing = `Security guard duty roster populated with ${rows.length} shift assignments.`;
      } else if (code === 'SS-ATT-10') {
        const holSet = new Set(holList.map((h) => h.holiday_date));
        const wkndHol = attList.filter((a) => {
          const day = new Date(`${a.attendance_date}T00:00:00`).getDay();
          return day === 0 || day === 6 || holSet.has(a.attendance_date) || a.ot_type === 'Sunday' || a.ot_type === 'Holiday';
        });
        rows = wkndHol.map((a) => {
          const holMatch = holList.find((h) => h.holiday_date === a.attendance_date);
          const dayType = holMatch ? `${holMatch.name} (Holiday)` : a.ot_type === 'Holiday' ? 'Holiday Shift' : 'Weekend / Sunday';
          return [
            a.attendance_date,
            `${a.employee_code} · ${a.employee_name}`,
            dayType,
            `${a.check_in}–${a.check_out}`,
            String((Number(a.regular_hours || 0) + Number(a.ot_hours || 0)).toFixed(1)),
            `${a.ot_multiplier}x · ${Number(a.ot_pay || 0).toFixed(2)} ETB`,
          ];
        });
        nextVals.holiday_approval_notes = `Found ${rows.length} weekend and Ethiopian holiday attendance records.`;
      } else if (code === 'SS-ATT-11') {
        const shiftNames = Array.from(new Set([...shiftList.map((s) => s.shift_name), ...attList.map((a) => a.shift_name)]));
        rows = shiftNames.map((sName) => {
          const logs = attList.filter((a) => a.shift_name === sName);
          const onTime = logs.filter((a) => (a.late_minutes || 0) === 0 && a.status !== 'Absent').length;
          const late = logs.filter((a) => (a.late_minutes || 0) > 0).length;
          const absHrs = logs.reduce((s, a) => s + Number(a.absence_hours || 0), 0);
          const otHrs = logs.reduce((s, a) => s + Number(a.ot_hours || 0), 0);
          const score = logs.length > 0 ? `${Math.round((onTime / logs.length) * 100)}%` : '100%';
          return [sName, String(logs.length), String(onTime), String(late), absHrs.toFixed(1), otHrs.toFixed(1), score];
        });
        nextVals.performance_notes = `Shift performance matrix compiled across ${rows.length} shift types (${attList.length} attendance logs).`;
      }

      if (rows.length === 0) {
        rows = [cols.map((_, idx) => (idx === 0 ? 'No matching live rows for current filter' : '—'))];
      }

      setFieldValues(nextVals);
      setTableColumns(cols);
      setTableRows(rows);
      setRemarks(`Populated from live Seven Sunday SQLite Attendance & Workforce Scheduling database on ${new Date().toLocaleDateString()}.`);
      if (openPreview) setWorkspaceTab('preview');
      setNotice(`Populated ${resolvedForm.code} (${resolvedForm.name}) with ${rows.length} live attendance/shift rows. Edit any cell before saving or printing.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to populate live attendance & shift records');
    }
  };

  const loadSubmissionIntoEditor = (sub: CompanyFormSubmission, openTab: 'fill' | 'preview' = 'fill') => {
    setSelectedFormCode(sub.form_code);
    setActiveDeptKey(sub.department_key);
    setEditingSubId(sub.id);
    setEditingSubNumber(sub.submission_number);
    setFormTitleOverride(sub.form_title);
    setEmployeeCode(sub.employee_code || '');
    setEmployeeName(sub.employee_name || '');
    setSubmissionDate(sub.submission_date || new Date().toISOString().slice(0, 10));
    setReferenceNo(sub.reference_no || '');
    setStatus(sub.status);
    setPreparedBy(sub.prepared_by || '');
    setCheckedBy(sub.checked_by || '');
    setApprovedBy(sub.approved_by || '');

    const base = ALL_COMPANY_FORMS.find((f) => f.code === sub.form_code) || ALL_COMPANY_FORMS[0];
    try {
      const parsed = JSON.parse(sub.form_data_json) as Partial<ParsedSubmissionPayload>;
      setFieldValues(parsed.values || {});
      setTableColumns(
        Array.isArray(parsed.columns) && parsed.columns.length > 0 ? parsed.columns : [...base.defaultColumns]
      );
      setTableRows(
        Array.isArray(parsed.rows) && parsed.rows.length > 0
          ? parsed.rows
          : [base.defaultColumns.map(() => '')]
      );
      setRemarks(parsed.remarks || '');
      setIncludeEvaluation(Boolean(parsed.includeEvaluation ?? base.isEvaluation));
      setEvaluationPeriod(parsed.evaluationPeriod || 'Q4 2026');
      setEvaluatorName(parsed.evaluatorName || 'Department Manager');
      setEvaluationRows(
        Array.isArray(parsed.evaluationRows) && parsed.evaluationRows.length > 0
          ? parsed.evaluationRows
          : DEFAULT_STAFF_EVALUATION_CRITERIA.map((r) => ({ ...r }))
      );
    } catch {
      initializeFreshForm(base);
    }
    setPreviewSubmission(sub);
    setWorkspaceTab(openTab);
    setNotice(`Loaded ${sub.submission_number} (${sub.form_title}) for editing.`);
  };

  const evalSummary = useMemo(() => computeEvaluationSummary(evaluationRows), [evaluationRows]);

  const buildSubmissionPayload = (overrideStatus?: CompanyFormSubmission['status']) => {
    const formData: ParsedSubmissionPayload = {
      values: fieldValues,
      columns: tableColumns,
      rows: tableRows,
      remarks,
      includeEvaluation,
      evaluationPeriod,
      evaluatorName,
      evaluationRows,
    };
    return {
      form_code: resolvedForm.code,
      form_title: formTitleOverride.trim() || resolvedForm.name,
      department_key: resolvedForm.departmentKey,
      department_name: resolvedForm.departmentName,
      employee_code: employeeCode,
      employee_name: employeeName,
      submission_date: submissionDate,
      reference_no: referenceNo || editingSubNumber || `REF-${resolvedForm.code}`,
      status: overrideStatus || status,
      form_data_json: JSON.stringify(formData),
      prepared_by: preparedBy,
      checked_by: checkedBy,
      approved_by: approvedBy,
    };
  };

  const handleSaveSubmission = async (openPreview = false, forceCreateNew = false) => {
    setError(null);
    setNotice(null);
    try {
      const payload = buildSubmissionPayload();
      let saved: CompanyFormSubmission;
      if (editingSubId !== null && !forceCreateNew) {
        saved = await api.put<CompanyFormSubmission>(`/api/company-forms/submissions/${editingSubId}`, payload);
        setSubmissions((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
        setNotice(`Saved changes to ${saved.submission_number} (${saved.form_title}).`);
      } else {
        saved = await api.post<CompanyFormSubmission>('/api/company-forms/submissions', payload);
        setSubmissions((prev) => [saved, ...prev]);
        setEditingSubId(saved.id);
        setEditingSubNumber(saved.submission_number);
        setNotice(`Created and saved ${saved.submission_number} (${saved.form_title}).`);
      }
      setPreviewSubmission(saved);
      if (openPreview) setWorkspaceTab('preview');
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save form submission');
    }
  };

  const handleSaveTemplate = async () => {
    setError(null);
    setNotice(null);
    try {
      const savedTpl = await api.put<CompanyFormTemplateOverride>(
        `/api/company-forms/templates/${encodeURIComponent(resolvedForm.code)}`,
        {
          custom_title: tplTitle.trim() || resolvedForm.name,
          department_key: resolvedForm.departmentKey,
          subtitle: tplSubtitle.trim() || resolvedForm.departmentName,
          fields_json: JSON.stringify(tplFields),
          columns_json: JSON.stringify(tplColumns),
          default_notes: tplDefaultNotes,
        }
      );
      setTemplates((prev) => {
        const exists = prev.some((t) => t.form_code === savedTpl.form_code);
        return exists ? prev.map((t) => (t.form_code === savedTpl.form_code ? savedTpl : t)) : [...prev, savedTpl];
      });
      setFormTitleOverride(savedTpl.custom_title);
      setTableColumns([...tplColumns]);
      setNotice(`Saved editable template structure for ${savedTpl.form_code} (${savedTpl.custom_title}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template override');
    }
  };

  const filteredCatalogForms = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (q) {
      return ALL_COMPANY_FORMS.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.code.toLowerCase().includes(q) ||
          f.departmentName.toLowerCase().includes(q)
      );
    }
    return ALL_COMPANY_FORMS.filter((f) => f.departmentKey === activeDeptKey);
  }, [catalogSearch, activeDeptKey]);

  const filteredSubmissions = useMemo(() => {
    const q = registerSearch.trim().toLowerCase();
    return submissions.filter((s) => {
      if (registerDeptFilter !== 'all' && s.department_key !== registerDeptFilter) return false;
      if (!q) return true;
      return (
        s.submission_number.toLowerCase().includes(q) ||
        s.form_code.toLowerCase().includes(q) ||
        s.form_title.toLowerCase().includes(q) ||
        s.employee_name.toLowerCase().includes(q)
      );
    });
  }, [submissions, registerSearch, registerDeptFilter]);

  const exportRegisterCsv = () => {
    const headers = ['Submission #', 'Form Code', 'Form Title', 'Department', 'Employee Code', 'Employee Name', 'Date', 'Status', 'Prepared By'];
    const rows = filteredSubmissions.map((s) => [
      s.submission_number,
      s.form_code,
      `"${s.form_title.replace(/"/g, '""')}"`,
      `"${s.department_name}"`,
      s.employee_code,
      `"${s.employee_name}"`,
      s.submission_date,
      s.status,
      `"${s.prepared_by}"`,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seven-sunday-company-forms-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activePreviewParsed = useMemo<ParsedSubmissionPayload>(() => {
    if (workspaceTab === 'preview' && !previewSubmission) {
      return {
        values: fieldValues,
        columns: tableColumns,
        rows: tableRows,
        remarks,
        includeEvaluation,
        evaluationPeriod,
        evaluatorName,
        evaluationRows,
      };
    }
    if (previewSubmission) {
      try {
        const parsed = JSON.parse(previewSubmission.form_data_json) as Partial<ParsedSubmissionPayload>;
        return {
          values: parsed.values || {},
          columns: parsed.columns || resolvedForm.defaultColumns,
          rows: parsed.rows || [],
          remarks: parsed.remarks || '',
          includeEvaluation: Boolean(parsed.includeEvaluation),
          evaluationPeriod: parsed.evaluationPeriod || 'Q4 2026',
          evaluatorName: parsed.evaluatorName || 'Department Manager',
          evaluationRows:
            Array.isArray(parsed.evaluationRows) && parsed.evaluationRows.length > 0
              ? parsed.evaluationRows
              : DEFAULT_STAFF_EVALUATION_CRITERIA,
        };
      } catch {
        // fallback below
      }
    }
    return {
      values: fieldValues,
      columns: tableColumns,
      rows: tableRows,
      remarks,
      includeEvaluation,
      evaluationPeriod,
      evaluatorName,
      evaluationRows,
    };
  }, [
    workspaceTab,
    previewSubmission,
    fieldValues,
    tableColumns,
    tableRows,
    remarks,
    includeEvaluation,
    evaluationPeriod,
    evaluatorName,
    evaluationRows,
    resolvedForm.defaultColumns,
  ]);

  const previewEvalSummary = useMemo(
    () => computeEvaluationSummary(activePreviewParsed.evaluationRows),
    [activePreviewParsed.evaluationRows]
  );

  const previewFormMeta = useMemo(() => {
    const code = previewSubmission?.form_code || resolvedForm.code;
    return ALL_COMPANY_FORMS.find((f) => f.code === code) || resolvedForm;
  }, [previewSubmission, resolvedForm]);

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#172033] dark:text-white">
            Complete Company Forms & Staff Evaluation Center
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {COMPANY_FORM_DEPARTMENTS.length} Departments · {ALL_COMPANY_FORMS.length} Editable Official Forms · Attendance & Shifts · Staff Evaluation Rubric · A4 Print View
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              const attForm = ALL_COMPANY_FORMS.find((f) => f.code === 'SS-ATT-01');
              if (attForm) handleSelectCatalogForm(attForm);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#18243A] hover:bg-[#172033] rounded-lg whitespace-nowrap"
          >
            <Clock className="w-3.5 h-3.5 text-[#38BDF8]" />
            Attendance & Shift Forms (11)
          </button>
          <button
            type="button"
            onClick={() => handleLoadSampleData(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#18243A] bg-[#EAF4FF] hover:bg-[#DBEAFE] border border-[#087CEB]/40 rounded-lg whitespace-nowrap"
          >
            <Eye className="w-3.5 h-3.5 text-[#087CEB]" />
            View Sample (A4)
          </button>
          <button
            type="button"
            onClick={() => {
              const evalForm = ALL_COMPANY_FORMS.find((f) => f.code === 'SS-HR-18');
              if (evalForm) handleSelectCatalogForm(evalForm);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
          >
            <Award className="w-3.5 h-3.5" />
            Staff Evaluation (SS-HR-18)
          </button>
          <button
            type="button"
            onClick={() => {
              const annualEval = ALL_COMPANY_FORMS.find((f) => f.code === 'SS-MGT-20');
              if (annualEval) handleSelectCatalogForm(annualEval);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded-lg whitespace-nowrap"
          >
            Annual Eval (SS-MGT-20)
          </button>
          <button
            type="button"
            onClick={exportRegisterCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export Register CSV
          </button>
        </div>
      </div>

      {notice && (
        <div className="no-print px-4 py-2.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
          {notice}
        </div>
      )}
      {error && (
        <div className="no-print px-4 py-2.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      {/* Main Split Workspace: Left 17-Dept Catalog (4 cols) + Right Editable Form Workspace (8 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT PANEL: 17 Departments & 316 Form Selector */}
        <div className="no-print xl:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#172033] dark:text-white">
                Form Directory ({ALL_COMPANY_FORMS.length} Forms)
              </h3>
              <span className="text-xs font-mono text-slate-500">{COMPANY_FORM_DEPARTMENTS.length} Depts</span>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder={`Search all ${ALL_COMPANY_FORMS.length} forms by name or code...`}
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
              />
              {catalogSearch && (
                <button
                  type="button"
                  onClick={() => setCatalogSearch('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-[#172033]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Department Filter
              </label>
              <select
                value={activeDeptKey}
                onChange={(e) => {
                  setCatalogSearch('');
                  setActiveDeptKey(e.target.value);
                }}
                className="w-full px-3 py-2 text-xs font-semibold bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                {COMPANY_FORM_DEPARTMENTS.map((dept) => (
                  <option key={dept.key} value={dept.key}>
                    {dept.shortName} ({dept.forms.length} forms)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="max-h-[620px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {filteredCatalogForms.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">No forms match "{catalogSearch}".</div>
            ) : (
              filteredCatalogForms.map((form) => {
                const isSelected = form.code === selectedFormCode;
                const hasOverride = templateMap.has(form.code);
                const displayName = templateMap.get(form.code)?.custom_title || form.name;
                return (
                  <button
                    key={form.code}
                    type="button"
                    onClick={() => handleSelectCatalogForm(form)}
                    className={`w-full text-left px-4 py-2.5 transition-colors flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-[#EAF4FF] dark:bg-[#087CEB]/20 text-[#18243A] dark:text-white'
                        : 'hover:bg-[#F8FAFC] dark:hover:bg-slate-800/50 text-[#172033] dark:text-slate-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">
                        {form.no}. {displayName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {form.code} · {form.departmentName.replace(' Forms', '')}
                        {hasOverride ? ' · Custom Template' : ''}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL: EDITABLE WORKSPACE / TEMPLATE EDITOR / A4 PRINT PREVIEW */}
        <div className="xl:col-span-8 space-y-4">
          {/* Workspace Header Tabs */}
          <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-mono text-[#087CEB] font-semibold">
                {resolvedForm.code} · {resolvedForm.departmentName}
                {editingSubNumber ? ` · Editing ${editingSubNumber}` : ' · New Editable Draft'}
              </div>
              <h3 className="text-base font-bold text-[#172033] dark:text-white truncate">
                {formTitleOverride || resolvedForm.name}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
              <button
                type="button"
                onClick={() => setWorkspaceTab('fill')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap ${
                  workspaceTab === 'fill' ? 'bg-[#18243A] text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <Pencil className="w-3.5 h-3.5" />
                Fill & Edit Form
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceTab('template')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap ${
                  workspaceTab === 'template' ? 'bg-[#18243A] text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Edit Template Fields
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceTab('preview')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap ${
                  workspaceTab === 'preview' ? 'bg-[#18243A] text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                A4 Print View
              </button>
            </div>
          </div>

          {/* TAB 1: FILL & EDIT SUBMISSION */}
          {workspaceTab === 'fill' && (
            <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
              {/* Metadata Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Editable Form Title
                  </label>
                  <input
                    type="text"
                    value={formTitleOverride}
                    onChange={(e) => setFormTitleOverride(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-semibold bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={submissionDate}
                    onChange={(e) => setSubmissionDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Form Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CompanyFormSubmission['status'])}
                    className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Submitted">Submitted</option>
                    <option value="Approved">Approved</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Linked Employee / Staff Member
                  </label>
                  <select
                    value={employeeCode}
                    onChange={(e) => {
                      const emp = employees.find((x) => x.employee_id === e.target.value);
                      setEmployeeCode(e.target.value);
                      if (emp) {
                        setEmployeeName(emp.full_name);
                        setFieldValues((prev) => ({
                          ...prev,
                          ...(prev.employee_code !== undefined ? { employee_code: emp.employee_id } : {}),
                          ...(prev.department !== undefined ? { department: emp.department } : {}),
                          ...(prev.job_title !== undefined ? { job_title: emp.job_title } : {}),
                        }));
                      }
                    }}
                    className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="">Company / General Record (No Specific Employee)</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.employee_id}>
                        {emp.employee_id} — {emp.full_name} ({emp.department})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Staff Name (Editable)
                  </label>
                  <input
                    type="text"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    placeholder="Subject Staff / Counterparty"
                    className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Reference No
                  </label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder={`REF-${resolvedForm.code}`}
                    className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              {/* Dynamic Department / Form Fields */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="text-xs font-bold text-[#18243A] dark:text-[#38BDF8] uppercase tracking-wider">
                  Official Form Details & Fields
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {resolvedForm.fields.map((field) => (
                    <div key={field.key} className={field.type === 'textarea' ? 'sm:col-span-2 lg:col-span-3' : ''}>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                        {field.label}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          rows={3}
                          value={fieldValues[field.key] ?? ''}
                          placeholder={field.placeholder || ''}
                          onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                        />
                      ) : field.type === 'select' ? (
                        <select
                          value={fieldValues[field.key] ?? (field.options?.[0] || '')}
                          onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                        >
                          {(field.options || []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type}
                          value={fieldValues[field.key] ?? ''}
                          placeholder={field.placeholder || ''}
                          onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                          className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg ${
                            field.type === 'number' || field.type === 'date' ? 'font-mono' : ''
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* STAFF EVALUATION KPI RUBRIC SECTION (Auto on Evaluation Forms, Toggleable on All Forms) */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-[#18243A] dark:text-[#38BDF8] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeEvaluation}
                      onChange={(e) => setIncludeEvaluation(e.target.checked)}
                      className="rounded border-slate-300 text-[#087CEB]"
                    />
                    Include Editable Staff Performance Evaluation KPI Rubric (Weighted 1–5 Scale)
                  </label>
                  {includeEvaluation && (
                    <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                      <span className="text-slate-600 dark:text-slate-300">
                        Total Weight: <strong>{evalSummary.totalWeight}%</strong>
                      </span>
                      <span className="font-bold text-[#087CEB]">
                        Score: {evalSummary.scorePct}% · Grade {evalSummary.grade} ({evalSummary.label})
                      </span>
                    </div>
                  )}
                </div>

                {includeEvaluation && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                          Evaluation Review Period
                        </label>
                        <input
                          type="text"
                          value={evaluationPeriod}
                          onChange={(e) => setEvaluationPeriod(e.target.value)}
                          placeholder="e.g. Q4 2026 / Annual 2019 E.C."
                          className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                          Evaluator / Reviewing Supervisor
                        </label>
                        <input
                          type="text"
                          value={evaluatorName}
                          onChange={(e) => setEvaluatorName(e.target.value)}
                          placeholder="Supervisor / Department Head"
                          className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#F8FAFC] dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                            <th className="py-2 px-3">#</th>
                            <th className="py-2 px-3">Evaluation Criterion (Editable)</th>
                            <th className="py-2 px-3 text-right w-24">Weight %</th>
                            <th className="py-2 px-3 text-center w-44">Rating (1 = Poor, 5 = Top)</th>
                            <th className="py-2 px-3">Evaluator Comments</th>
                            <th className="py-2 px-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                          {evaluationRows.map((row, idx) => (
                            <tr key={idx}>
                              <td className="py-2 px-3 font-mono text-slate-500">{idx + 1}</td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.criterion}
                                  onChange={(e) => {
                                    const next = [...evaluationRows];
                                    next[idx] = { ...next[idx], criterion: e.target.value };
                                    setEvaluationRows(next);
                                  }}
                                  className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={row.weight}
                                  onChange={(e) => {
                                    const next = [...evaluationRows];
                                    next[idx] = { ...next[idx], weight: Number(e.target.value) || 0 };
                                    setEvaluationRows(next);
                                  }}
                                  className="w-full px-2 py-1 text-right font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <div className="flex items-center justify-center gap-1">
                                  {[1, 2, 3, 4, 5].map((score) => (
                                    <button
                                      key={score}
                                      type="button"
                                      onClick={() => {
                                        const next = [...evaluationRows];
                                        next[idx] = { ...next[idx], rating: score };
                                        setEvaluationRows(next);
                                      }}
                                      className={`w-7 h-7 rounded font-mono text-xs font-bold transition-colors ${
                                        row.rating === score
                                          ? 'bg-[#087CEB] text-white'
                                          : 'bg-[#F8FAFC] dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB]'
                                      }`}
                                    >
                                      {score}
                                    </button>
                                  ))}
                                </div>
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.comments}
                                  onChange={(e) => {
                                    const next = [...evaluationRows];
                                    next[idx] = { ...next[idx], comments: e.target.value };
                                    setEvaluationRows(next);
                                  }}
                                  placeholder="Remarks..."
                                  className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"
                                />
                              </td>
                              <td className="py-1.5 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => setEvaluationRows((prev) => prev.filter((_, i) => i !== idx))}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  title="Remove criterion"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEvaluationRows((prev) => [
                          ...prev,
                          { criterion: 'New Evaluation Criterion', weight: 10, rating: 4, comments: '' },
                        ])
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded-lg"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Evaluation Criterion
                    </button>
                  </div>
                )}
              </div>

              {/* DYNAMIC EDITABLE LINE-ITEM / CHECKLIST TABLE */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-[#18243A] dark:text-[#38BDF8] uppercase tracking-wider">
                    Editable Form Line-Items / Checklist Table
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTableColumns((prev) => [...prev, `Column ${prev.length + 1}`]);
                        setTableRows((prev) => prev.map((r) => [...r, '']));
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded"
                    >
                      <Plus className="w-3 h-3" />
                      Add Column
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableRows((prev) => [...prev, tableColumns.map(() => '')])}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] rounded"
                    >
                      <Plus className="w-3 h-3" />
                      Add Row
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F8FAFC] dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2 px-2.5 font-mono text-slate-500 w-10">#</th>
                        {tableColumns.map((col, cIdx) => (
                          <th key={cIdx} className="py-1.5 px-2 min-w-[130px]">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={col}
                                onChange={(e) => {
                                  const next = [...tableColumns];
                                  next[cIdx] = e.target.value;
                                  setTableColumns(next);
                                }}
                                className="w-full px-2 py-1 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded"
                              />
                              {tableColumns.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTableColumns((prev) => prev.filter((_, i) => i !== cIdx));
                                    setTableRows((prev) => prev.map((r) => r.filter((_, i) => i !== cIdx)));
                                  }}
                                  className="text-slate-400 hover:text-red-600 p-0.5"
                                  title="Remove column"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </th>
                        ))}
                        <th className="py-2 px-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {tableRows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          <td className="py-2 px-2.5 font-mono text-slate-500">{rIdx + 1}</td>
                          {tableColumns.map((_, cIdx) => (
                            <td key={cIdx} className="py-1.5 px-2">
                              <input
                                type="text"
                                value={row[cIdx] ?? ''}
                                onChange={(e) => {
                                  const next = tableRows.map((r) => [...r]);
                                  next[rIdx][cIdx] = e.target.value;
                                  setTableRows(next);
                                }}
                                className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"
                              />
                            </td>
                          ))}
                          <td className="py-1.5 px-2 text-center">
                            {tableRows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setTableRows((prev) => prev.filter((_, i) => i !== rIdx))}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Remove row"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remarks & Sign-offs */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Official Remarks / Recommendations
                  </label>
                  <textarea
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Additional notes, compliance remarks, or action items..."
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Prepared By</label>
                  <input
                    type="text"
                    value={preparedBy}
                    onChange={(e) => setPreparedBy(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Checked / Reviewed By</label>
                  <input
                    type="text"
                    value={checkedBy}
                    onChange={(e) => setCheckedBy(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Approved By</label>
                  <input
                    type="text"
                    value={approvedBy}
                    onChange={(e) => setApprovedBy(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              {/* Save Action Bar */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveSubmission(false, false)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {editingSubId !== null ? 'Save Updated Submission' : 'Save Form Submission'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveSubmission(true, false)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#18243A] hover:bg-[#172033] rounded-lg whitespace-nowrap"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#38BDF8]" />
                    Save & Print View (A4)
                  </button>
                  <SendToApproveButton
                    sourceModule="company-forms"
                    recordRef={editingSubNumber || referenceNo || resolvedForm.code}
                    title={formTitleOverride || resolvedForm.name}
                    summary={`${resolvedForm.code} · ${resolvedForm.departmentName} · Staff: ${employeeName || 'Company Wide'}${includeEvaluation ? ` · Eval Score: ${evalSummary.scorePct}% (Grade ${evalSummary.grade})` : ''}`}
                    fromDepartment={resolvedForm.departmentName.replace(' Forms', '')}
                    onDispatched={() => {
                      setNotice(`Sent ${formTitleOverride || resolvedForm.name} to Approving Department.`);
                      onRefreshDashboard();
                    }}
                  />
                  <ShareButton
                    title={formTitleOverride || resolvedForm.name}
                    reference={editingSubNumber || referenceNo || resolvedForm.code}
                    moduleName="Company Forms"
                    summary={`Form: ${resolvedForm.code} (${resolvedForm.departmentName})\nStaff: ${employeeName || 'Company Wide'}\nDate: ${submissionDate}\nStatus: ${status}${remarks ? `\nRemarks: ${remarks}` : ''}`}
                  />
                  {editingSubId !== null && (
                    <button
                      type="button"
                      onClick={() => handleSaveSubmission(false, true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded-lg whitespace-nowrap"
                    >
                      <FilePlus2 className="w-3.5 h-3.5" />
                      Save as New Entry
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {resolvedForm.code.startsWith('SS-ATT-') && (
                    <button
                      type="button"
                      onClick={() => handleLoadLiveAttendanceShiftData(false)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#18243A] hover:bg-[#172033] rounded-lg whitespace-nowrap"
                    >
                      <Database className="w-3.5 h-3.5 text-[#38BDF8]" />
                      Load Live Attendance & Shifts
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleLoadSampleData(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#18243A] bg-[#EAF4FF] hover:bg-[#DBEAFE] border border-[#087CEB]/30 rounded-lg whitespace-nowrap"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#087CEB]" />
                    Load Sample
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const emp = employees.find((e) => e.employee_id === employeeCode) || employees[0];
                      initializeFreshForm(resolvedForm, emp);
                      setNotice('Form draft reset to clean template.');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    New Blank Draft
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EDIT FORM TEMPLATE STRUCTURE (PERMANENTLY CUSTOMIZES ANY OF THE 305 FORMS) */}
          {workspaceTab === 'template' && (
            <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-[#172033] dark:text-white">
                    Customize & Save Template Structure: {resolvedForm.code}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Edit the form title, add or remove input fields, and configure default table columns saved permanently in SQLite.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Template Design
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Custom Form Name</label>
                  <input
                    type="text"
                    value={tplTitle}
                    onChange={(e) => setTplTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Subtitle / Section Header</label>
                  <input
                    type="text"
                    value={tplSubtitle}
                    onChange={(e) => setTplSubtitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#18243A] dark:text-[#38BDF8] uppercase">Template Input Fields</span>
                  <button
                    type="button"
                    onClick={() =>
                      setTplFields((prev) => [
                        ...prev,
                        { key: `custom_field_${Date.now()}`, label: 'New Field', type: 'text', placeholder: '' },
                      ])
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] rounded"
                  >
                    <Plus className="w-3 h-3" />
                    Add Field
                  </button>
                </div>
                <div className="space-y-2">
                  {tplFields.map((f, idx) => (
                    <div key={f.key + idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[#F8FAFC] dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      <input
                        type="text"
                        value={f.label}
                        placeholder="Field Label"
                        onChange={(e) => {
                          const next = [...tplFields];
                          next[idx] = { ...next[idx], label: e.target.value };
                          setTplFields(next);
                        }}
                        className="sm:col-span-5 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded"
                      />
                      <select
                        value={f.type}
                        onChange={(e) => {
                          const next = [...tplFields];
                          next[idx] = { ...next[idx], type: e.target.value as CompanyFormFieldDef['type'] };
                          setTplFields(next);
                        }}
                        className="sm:col-span-3 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded"
                      >
                        <option value="text">Text</option>
                        <option value="date">Date</option>
                        <option value="number">Number</option>
                        <option value="textarea">Multi-line Text</option>
                        <option value="select">Dropdown</option>
                      </select>
                      <input
                        type="text"
                        value={f.placeholder || ''}
                        placeholder="Placeholder"
                        onChange={(e) => {
                          const next = [...tplFields];
                          next[idx] = { ...next[idx], placeholder: e.target.value };
                          setTplFields(next);
                        }}
                        className="sm:col-span-3 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded"
                      />
                      <button
                        type="button"
                        onClick={() => setTplFields((prev) => prev.filter((_, i) => i !== idx))}
                        className="sm:col-span-1 p-1.5 text-red-600 hover:bg-red-50 rounded flex justify-center"
                        title="Remove Field"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#18243A] dark:text-[#38BDF8] uppercase">Default Table Columns</span>
                  <button
                    type="button"
                    onClick={() => setTplColumns((prev) => [...prev, `Column ${prev.length + 1}`])}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] rounded"
                  >
                    <Plus className="w-3 h-3" />
                    Add Column
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tplColumns.map((col, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
                      <input
                        type="text"
                        value={col}
                        onChange={(e) => {
                          const next = [...tplColumns];
                          next[idx] = e.target.value;
                          setTplColumns(next);
                        }}
                        className="w-36 text-xs bg-transparent focus:outline-none"
                      />
                      {tplColumns.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setTplColumns((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-red-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Default Form Instructions / Standard Remarks
                </label>
                <textarea
                  rows={2}
                  value={tplDefaultNotes}
                  onChange={(e) => setTplDefaultNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
          )}

          {/* TAB 3: A4 OFFICIAL PRINT VIEW (PORTRAIT & LANDSCAPE) */}
          {workspaceTab === 'preview' && (
            <div
              data-print-active="true"
              data-print-orientation={sheetOrientation}
              className="print-only-container space-y-4"
            >
              <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Official A4 Preview ({sheetOrientation === 'landscape' ? '297×210mm' : '210×297mm'}) · {previewSubmission?.submission_number || 'LIVE DRAFT'}
                  </span>
                  <div className="flex items-center gap-1 p-1 bg-[#F8FAFC] dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setSheetOrientation('portrait')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded whitespace-nowrap ${
                        sheetOrientation === 'portrait' ? 'bg-[#18243A] text-white' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      A4 Portrait
                    </button>
                    <button
                      type="button"
                      onClick={() => setSheetOrientation('landscape')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded whitespace-nowrap ${
                        sheetOrientation === 'landscape' ? 'bg-[#18243A] text-white' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      A4 Landscape
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {resolvedForm.code.startsWith('SS-ATT-') && (
                    <button
                      type="button"
                      onClick={() => handleLoadLiveAttendanceShiftData(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#18243A] hover:bg-[#172033] rounded-lg whitespace-nowrap"
                    >
                      <Database className="w-3.5 h-3.5 text-[#38BDF8]" />
                      Load Live Attendance
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleLoadSampleData(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#18243A] bg-[#EAF4FF] hover:bg-[#DBEAFE] border border-[#087CEB]/30 rounded-lg whitespace-nowrap"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#087CEB]" />
                    Sample Data
                  </button>
                  <SendToApproveButton
                    compact
                    sourceModule="company-forms"
                    recordRef={previewSubmission?.submission_number || referenceNo || resolvedForm.code}
                    title={previewSubmission?.form_title || formTitleOverride || resolvedForm.name}
                    summary={`${previewSubmission?.form_code || resolvedForm.code} · ${previewSubmission?.department_name || resolvedForm.departmentName} · Staff: ${(previewSubmission?.employee_name ?? employeeName) || 'Company Wide'}`}
                    fromDepartment={(previewSubmission?.department_name || resolvedForm.departmentName).replace(' Forms', '')}
                    onDispatched={() => {
                      setNotice('Form dispatched to Approving Department.');
                      onRefreshDashboard();
                    }}
                  />
                  <ShareButton
                    compact
                    title={previewSubmission?.form_title || formTitleOverride || resolvedForm.name}
                    reference={previewSubmission?.submission_number || referenceNo || resolvedForm.code}
                    moduleName="Company Forms"
                    summary={`Form: ${previewSubmission?.form_code || resolvedForm.code}\nDepartment: ${previewSubmission?.department_name || resolvedForm.departmentName}\nStaff: ${(previewSubmission?.employee_name ?? employeeName) || 'Company Wide'}\nDate: ${previewSubmission?.submission_date || submissionDate}`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      printWithAutoFit({
                        orientation: sheetOrientation,
                        targetSelector: '.print-only-container[data-print-active="true"]',
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#18243A] hover:bg-[#172033] rounded-lg whitespace-nowrap"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#38BDF8]" />
                    Print {sheetOrientation === 'landscape' ? 'Landscape' : 'A4'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkspaceTab('fill')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded-lg whitespace-nowrap"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit Form
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewSubmission(null);
                      setWorkspaceTab('fill');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#172033] bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap"
                  >
                    <X className="w-3.5 h-3.5" />
                    Close
                  </button>
                </div>
              </div>

              <PrintableSheetFrame
                orientation={sheetOrientation}
                onOrientationChange={setSheetOrientation}
                documentLabel={`${previewSubmission?.form_code || resolvedForm.code} Form`}
              >
                <div
                  className={`${
                    sheetOrientation === 'landscape' ? 'a4-landscape-sheet' : 'a4-sheet'
                  } border border-slate-300 shadow-sm flex flex-col justify-between`}
                >
                  <div>
                    {/* A4 Letterhead */}
                    <div className="flex items-start justify-between pb-3 border-b-2 border-[#18243A]">
                      <div className="flex items-center gap-3">
                        <img src={logoSrc} alt="Seven Sunday Ethiopia" className="h-12 w-auto object-contain" />
                        <div>
                          <div className="text-sm font-bold text-[#18243A]">
                            {company?.company_name || 'Seven Sunday Manufacturing & Trading PLC'}
                          </div>
                          <div className="text-[11px] text-[#087CEB] font-semibold">
                            {previewSubmission?.department_name || resolvedForm.departmentName}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {company?.address || 'Bole Sub-City, Addis Ababa, Ethiopia'} · TIN: {company?.tin_number || 'ET-00981244'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-mono text-[10px] text-[#172033]">
                        <div className="font-bold text-[#18243A]">{previewSubmission?.form_code || resolvedForm.code}</div>
                        <div>Ref: {previewSubmission?.submission_number || referenceNo || 'DRAFT'}</div>
                        <div>G.C.: {previewSubmission?.submission_date || submissionDate}</div>
                        <div>E.C.: {toEthiopianDateString(previewSubmission?.submission_date || submissionDate)}</div>
                      </div>
                    </div>

                    {/* Title & Metadata */}
                    <div className="mt-4">
                      <h4 className="text-base font-bold text-[#18243A] uppercase tracking-wide border-b border-slate-200 pb-1.5">
                        {previewSubmission?.form_title || formTitleOverride || resolvedForm.name}
                      </h4>
                      <div className="mt-3 grid grid-cols-4 gap-2 text-[11px] bg-[#F8FAFC] p-2.5 rounded border border-slate-200">
                        <div>
                          <span className="text-slate-500 block">Staff / Subject</span>
                          <span className="font-semibold text-[#172033]">
                            {(previewSubmission?.employee_name ?? employeeName) || 'Company Wide'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Employee Code</span>
                          <span className="font-mono font-semibold text-[#172033]">
                            {(previewSubmission?.employee_code ?? employeeCode) || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Reference No.</span>
                          <span className="font-mono font-semibold text-[#172033]">
                            {(previewSubmission?.reference_no ?? referenceNo) || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Status</span>
                          <span className="font-semibold text-[#18243A]">
                            {previewSubmission?.status || status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Rendered Field Values */}
                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                      {previewFormMeta.fields.map((field) => (
                        <div
                          key={field.key}
                          className={`border-b border-slate-200 pb-1.5 ${
                            field.type === 'textarea' ? 'col-span-2' : ''
                          }`}
                        >
                          <div className="text-[10px] font-semibold text-slate-500">{field.label}</div>
                          <div className="text-[#172033] font-medium whitespace-pre-wrap mt-0.5">
                            {activePreviewParsed.values[field.key] || '—'}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Staff Evaluation Table in Print View */}
                    {activePreviewParsed.includeEvaluation && (
                      <div className="mt-5 print-break-avoid">
                        <div className="flex items-center justify-between text-[11px] font-bold text-[#18243A] mb-1.5">
                          <span>STAFF PERFORMANCE EVALUATION SCORING MATRIX</span>
                          <span className="font-mono">
                            Period: {activePreviewParsed.evaluationPeriod} · Weighted Score: {previewEvalSummary.scorePct}% (Grade {previewEvalSummary.grade} · {previewEvalSummary.label})
                          </span>
                        </div>
                        <table className="w-full text-left border-collapse text-[10px]">
                          <thead>
                            <tr className="bg-[#18243A] text-white">
                              <th className="py-1.5 px-2 border border-slate-300">#</th>
                              <th className="py-1.5 px-2 border border-slate-300">Evaluation Criterion</th>
                              <th className="py-1.5 px-2 border border-slate-300 text-right">Weight</th>
                              <th className="py-1.5 px-2 border border-slate-300 text-center">Score / 5</th>
                              <th className="py-1.5 px-2 border border-slate-300">Supervisor Comments</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activePreviewParsed.evaluationRows.map((row, idx) => (
                              <tr key={idx} className={idx % 2 === 1 ? 'bg-[#F8FAFC]' : 'bg-white'}>
                                <td className="py-1 px-2 border border-slate-300 font-mono">{idx + 1}</td>
                                <td className="py-1 px-2 border border-slate-300 font-medium">{row.criterion}</td>
                                <td className="py-1 px-2 border border-slate-300 text-right font-mono">{row.weight}%</td>
                                <td className="py-1 px-2 border border-slate-300 text-center font-mono font-bold">{row.rating} / 5</td>
                                <td className="py-1 px-2 border border-slate-300">{row.comments}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Line-Item / Checklist Table */}
                    {activePreviewParsed.rows.some((r) => r.some((cell) => String(cell).trim() !== '')) && (
                      <div className="mt-5 print-break-avoid">
                        <div className="text-[11px] font-bold text-[#18243A] mb-1.5">RECORD DETAILS / CHECKLIST ITEMS</div>
                        <table className="w-full text-left border-collapse text-[10px]">
                          <thead>
                            <tr className="bg-[#F8FAFC] text-[#18243A] font-bold">
                              <th className="py-1.5 px-2 border border-slate-300 w-8">#</th>
                              {activePreviewParsed.columns.map((col, idx) => (
                                <th key={idx} className="py-1.5 px-2 border border-slate-300">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {activePreviewParsed.rows.map((row, rIdx) => (
                              <tr key={rIdx}>
                                <td className="py-1 px-2 border border-slate-300 font-mono">{rIdx + 1}</td>
                                {activePreviewParsed.columns.map((_, cIdx) => (
                                  <td key={cIdx} className="py-1 px-2 border border-slate-300">{row[cIdx] || ''}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {activePreviewParsed.remarks && (
                      <div className="mt-4 p-2.5 bg-[#F8FAFC] border border-slate-200 rounded text-[11px]">
                        <div className="font-bold text-[#18243A] text-[10px] uppercase">Remarks & Action Items</div>
                        <div className="mt-0.5 whitespace-pre-wrap">{activePreviewParsed.remarks}</div>
                      </div>
                    )}
                  </div>

                  {/* A4 Bottom Stamp, Signatures & Real QR */}
                  <div className="mt-8 pt-4 border-t-2 border-[#18243A] flex items-end justify-between gap-4 print-break-avoid">
                    <div className="grid grid-cols-3 gap-5 flex-1 text-[10px] text-slate-600">
                      <div>
                        <div className="h-7 border-b border-slate-400 mb-1" />
                        <div className="font-bold text-[#172033]">Prepared By</div>
                        <div>{previewSubmission?.prepared_by || preparedBy}</div>
                      </div>
                      <div>
                        <div className="h-7 border-b border-slate-400 mb-1" />
                        <div className="font-bold text-[#172033]">Checked By</div>
                        <div>{previewSubmission?.checked_by || checkedBy}</div>
                      </div>
                      <div>
                        <div className="h-7 border-b border-slate-400 mb-1" />
                        <div className="font-bold text-[#172033]">Approved By</div>
                        <div>{previewSubmission?.approved_by || approvedBy}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {company?.stamp_data && (
                        <img src={company.stamp_data} alt="Official Stamp" className="h-14 w-14 object-contain" />
                      )}
                      {company?.signature_data && (
                        <img src={company.signature_data} alt="Authorized Signature" className="h-10 w-20 object-contain" />
                      )}
                      <RealQrCode
                        value={`SS-FORM|${previewSubmission?.submission_number || resolvedForm.code}|${previewSubmission?.form_title || resolvedForm.name}|${previewSubmission?.submission_date || submissionDate}`}
                        size={68}
                        label={previewSubmission?.form_code || resolvedForm.code}
                      />
                    </div>
                  </div>
                </div>
              </PrintableSheetFrame>
            </div>
          )}
        </div>
      </div>

      {/* SAVED COMPANY FORMS REGISTER */}
      <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#172033] dark:text-white flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-[#087CEB]" />
              Saved Company Forms & Staff Evaluations Register ({filteredSubmissions.length})
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={registerDeptFilter}
              onChange={(e) => setRegisterDeptFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="all">All {COMPANY_FORM_DEPARTMENTS.length} Departments</option>
              {COMPANY_FORM_DEPARTMENTS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.shortName}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Filter saved submissions..."
              value={registerSearch}
              onChange={(e) => setRegisterSearch(e.target.value)}
              className="px-3 py-1.5 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg w-52"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <th className="py-3 px-4">Submission #</th>
                <th className="py-3 px-4">Form Code & Name</th>
                <th className="py-3 px-4">Employee / Dept</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                    Loading company forms register...
                  </td>
                </tr>
              ) : filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                    No saved form submissions match your filter. Select any of the 305 forms above to fill and save.
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono text-xs font-bold text-[#18243A] dark:text-[#38BDF8]">
                      {sub.submission_number}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#172033] dark:text-white text-xs">{sub.form_title}</div>
                      <div className="text-[11px] font-mono text-slate-500">{sub.form_code}</div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="font-medium text-[#172033] dark:text-slate-200">
                        {sub.employee_name || 'Company Record'}
                      </div>
                      <div className="text-[11px] text-slate-500">{sub.department_name}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                      {sub.submission_date}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      {sub.status}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => loadSubmissionIntoEditor(sub, 'fill')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => loadSubmissionIntoEditor(sub, 'preview')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#172033] bg-slate-100 hover:bg-slate-200 rounded"
                        >
                          <Eye className="w-3 h-3" />
                          A4 View
                        </button>
                        {sub.status !== 'Approved' && (
                          <button
                            type="button"
                            onClick={async () => {
                              const updated = await api.patch<CompanyFormSubmission>(
                                `/api/company-forms/submissions/${sub.id}/status`,
                                { status: 'Approved' }
                              );
                              setSubmissions((prev) => prev.map((x) => (x.id === sub.id ? updated : x)));
                              onRefreshDashboard();
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded"
                          >
                            <Check className="w-3 h-3" />
                            Approve
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            await api.del(`/api/company-forms/submissions/${sub.id}`);
                            setSubmissions((prev) => prev.filter((x) => x.id !== sub.id));
                            if (editingSubId === sub.id) {
                              setEditingSubId(null);
                              setEditingSubNumber(null);
                            }
                            if (previewSubmission?.id === sub.id) setPreviewSubmission(null);
                            onRefreshDashboard();
                          }}
                          className="p-1.5 text-red-700 bg-red-50 hover:bg-red-100 rounded"
                          title="Delete submission"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
