import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  BarChart3,
  Calculator,
  Check,
  Download,
  FileSpreadsheet,
  FileUp,
  Fingerprint,
  ImagePlus,
  Minus,
  Pencil,
  Play,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Settings,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { api } from '../api';
import type {
  CompanySettings,
  EmployeeProfile,
  OtSettings,
  PayrollRecord,
  PayrollRules,
  PayrollRun,
  StaffFingerprintRecord,
  TaxBracket,
} from '../types';
import { formatMoney } from '../utils/ethiopianCalendar';
import { RealQrCode } from './RealQrCode';
import { SendToApproveButton } from './SendToApproveButton';
import { ShareButton } from './ShareButton';
import { PrintableSheetFrame } from './PrintableSheetFrame';
import { printWithAutoFit } from '../utils/printFit';
import { exportSignedPayrollSummaryPdf } from '../utils/payrollSignedPdf';
import { ExecutivePayrollAnalytics } from './ExecutivePayrollAnalytics';
import { ZktecoFingerprintModal } from './ZktecoFingerprintModal';

interface HrPayrollModuleProps {
  mode: 'hr' | 'payroll';
  currency: string;
  company?: CompanySettings | null;
  currentUserName?: string;
  currentUserRole?: string;
  onRefreshDashboard: () => void;
}

interface RowEditDraft {
  employee_name: string;
  bank_account: string;
  id_no: string;
  basic_salary: number;
  absence_hours: number;
  absence_rate: number;
  absence_rate_custom: boolean;
  ot_normal_hours: number;
  ot_night_hours: number;
  ot_sunday_hours: number;
  ot_holiday_hours: number;
  allowances: number;
  bonuses: number;
  deductions: number;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read uploaded file'));
    reader.readAsDataURL(file);
  });
}

function fmtNum(val: number, dashIfZero = false): string {
  const n = Number(val) || 0;
  if (dashIfZero && Math.abs(n) < 0.005) return '-';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcTaxLocal(gross: number, brackets: TaxBracket[]): number {
  const sorted = [...brackets].sort((a, b) => a.min - b.min);
  const b = sorted.find((row) => gross >= row.min && (row.max === null || gross <= row.max)) || sorted[sorted.length - 1];
  if (!b) return 0;
  return Math.max(0, Number((gross * (b.rate / 100) - b.deduction).toFixed(2)));
}

function round2(v: number): number {
  return Number((Number(v) || 0).toFixed(2));
}

export const HrPayrollModule: React.FC<HrPayrollModuleProps> = ({
  mode,
  currency,
  company,
  currentUserName = 'Payroll Officer',
  currentUserRole = 'Authorized Signatory',
  onRefreshDashboard,
}) => {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [rules, setRules] = useState<PayrollRules | null>(null);
  const [otSettings, setOtSettings] = useState<OtSettings | null>(null);
  const [otDraft, setOtDraft] = useState({
    ot_regular_multiplier: '1.5',
    ot_night_multiplier: '1.75',
    ot_sunday_multiplier: '2.0',
    ot_holiday_multiplier: '2.5',
  });
  const [idCardSide, setIdCardSide] = useState<'both' | 'front' | 'back'>('both');
  const [brackets, setBrackets] = useState<TaxBracket[]>([
    { min: 0, max: 2000, rate: 0, deduction: 0 },
    { min: 2001, max: 4000, rate: 15, deduction: 300 },
    { min: 4001, max: 7000, rate: 20, deduction: 500 },
    { min: 7001, max: 10000, rate: 25, deduction: 850 },
    { min: 10001, max: 14000, rate: 30, deduction: 1350 },
    { min: 14001, max: null, rate: 35, deduction: 2050 },
  ]);

  const [selectedEmpCard, setSelectedEmpCard] = useState<EmployeeProfile | null>(null);
  const [editingEmpId, setEditingEmpId] = useState<number | null>(null);
  const [enrolledEmpIds, setEnrolledEmpIds] = useState<Set<string>>(new Set());
  const [fpModalState, setFpModalState] = useState<{ emp: EmployeeProfile; isNew: boolean } | null>(null);
  const [hrPreviewMode, setHrPreviewMode] = useState<'id-card' | 'registration-sheet'>('id-card');
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecord | null>(null);
  const [payrollTab, setPayrollTab] = useState<'sheet' | 'analytics' | 'runs' | 'individual' | 'rules'>('sheet');
  const [sheetMonth, setSheetMonth] = useState<string>('');
  const [sheetCategory, setSheetCategory] = useState<string>('ALL');
  const [standardHoursDivisor, setStandardHoursDivisor] = useState<string>('208.00');
  const [sheetOrientation, setSheetOrientation] = useState<'landscape' | 'portrait'>('landscape');

  // Direct inline edits per payroll row ID (Absence -/+ hours, editable absence rate, Nor/Night/Sun/Holly OT -/+ hours)
  const [rowEdits, setRowEdits] = useState<Record<number, RowEditDraft>>({});
  const [editingIdentityId, setEditingIdentityId] = useState<number | null>(null);
  const [savingRowId, setSavingRowId] = useState<number | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [mobileCardEditOpen, setMobileCardEditOpen] = useState(false);

  const [showAddSheetRow, setShowAddSheetRow] = useState(false);
  const [newSheetRow, setNewSheetRow] = useState({
    payroll_month: '2026-09',
    month_label: 'Meskerm 2019',
    payroll_category: 'FACTORY PERMANENT',
    employee_name: '',
    bank_account: '',
    id_no: '',
    department: 'Production',
    basic_salary: '5000',
    absence_hours: '0',
    absence_rate: '',
    ot_normal_hours: '0',
    ot_night_hours: '0',
    ot_sunday_hours: '0',
    ot_holiday_hours: '0',
  });

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emptyEmpForm = {
    full_name: '',
    gender: 'Male',
    dob: '',
    phone: '',
    email: '',
    address: '',
    national_id: '',
    emergency_contact: '',
    emergency_contact_phone: '',
    department: 'Operations',
    job_title: '',
    employment_type: 'Permanent' as EmployeeProfile['employment_type'],
    start_date: new Date().toISOString().slice(0, 10),
    contract_expiry: '',
    basic_salary: '18000',
    bank_account: '',
    education: '',
    experience: '',
    photo_data: '',
    education_doc_name: '',
    education_doc_data: '',
  };

  const [empForm, setEmpForm] = useState(emptyEmpForm);

  const [runForm, setRunForm] = useState({
    payroll_month: new Date().toISOString().slice(0, 7),
    bonus_percent: '10',
    fixed_bonus: '0',
  });

  const [payForm, setPayForm] = useState({
    payroll_month: new Date().toISOString().slice(0, 7),
    employee_code: '',
    employee_name: '',
    department: 'Operations',
    basic_salary: '28500',
    absence_hours: '0',
    absence_rate: '',
    ot_normal_hours: '0',
    ot_night_hours: '0',
    ot_sunday_hours: '0',
    ot_holiday_hours: '0',
    allowances: '3000',
    bonuses: '0',
    deductions: '0',
  });

  const loadData = async () => {
    try {
      const [e, p, rList, rulesRow, otRow, fpRows] = await Promise.all([
        api.get<EmployeeProfile[]>('/api/employees'),
        api.get<PayrollRecord[]>('/api/payroll'),
        api.get<PayrollRun[]>('/api/payroll-runs').catch(() => []),
        api.get<PayrollRules>('/api/payroll-rules').catch(() => null),
        api.get<OtSettings>('/api/ot-settings').catch(() => null),
        api.get<StaffFingerprintRecord[]>('/api/devices/zkteco/fingerprints').catch(() => []),
      ]);
      setEmployees(e);
      setPayrolls(p);
      setPayrollRuns(rList);
      setEnrolledEmpIds(new Set(fpRows.filter((f) => f.status === 'Active').map((f) => f.employee_id)));
      if (otRow) {
        setOtSettings(otRow);
        setOtDraft({
          ot_regular_multiplier: String(otRow.ot_regular_multiplier),
          ot_night_multiplier: String(otRow.ot_night_multiplier),
          ot_sunday_multiplier: String(otRow.ot_sunday_multiplier),
          ot_holiday_multiplier: String(otRow.ot_holiday_multiplier),
        });
      }
      if (rulesRow) {
        setRules(rulesRow);
        try {
          const parsed = JSON.parse(rulesRow.brackets_json);
          if (Array.isArray(parsed) && parsed.length > 0) setBrackets(parsed);
        } catch {
          // keep defaults
        }
      }
      if (e.length > 0 && !selectedEmpCard) setSelectedEmpCard(e[0]);
      if (e.length > 0 && !payForm.employee_code) {
        setPayForm((prev) => ({
          ...prev,
          employee_code: e[0].employee_id,
          employee_name: e[0].full_name,
          department: e[0].department,
          basic_salary: String(e[0].basic_salary),
        }));
      }
      if (p.length > 0 && !selectedPayslip) setSelectedPayslip(p[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load HR & Payroll');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const multNormal = Number(otDraft.ot_regular_multiplier) || otSettings?.ot_regular_multiplier || 1.5;
  const multNight = Number(otDraft.ot_night_multiplier) || otSettings?.ot_night_multiplier || 1.75;
  const multSun = Number(otDraft.ot_sunday_multiplier) || otSettings?.ot_sunday_multiplier || 2.0;
  const multHol = Number(otDraft.ot_holiday_multiplier) || otSettings?.ot_holiday_multiplier || 2.5;
  const stdHrsDivisor = Math.max(1, Number(standardHoursDivisor) || 208);

  const empBankMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees) {
      map.set(e.employee_id, e.bank_account || '');
    }
    return map;
  }, [employees]);

  const makeInitialDraft = (p: PayrollRecord): RowEditDraft => {
    const basic = Number(p.basic_salary) || 0;
    const calcRate = round2(basic / stdHrsDivisor);
    const savedAbsRate = Number(p.absence_rate);
    return {
      employee_name: p.employee_name,
      bank_account: p.bank_account || empBankMap.get(p.employee_code) || '',
      id_no: p.id_no || '',
      basic_salary: basic,
      absence_hours: Number(p.absence_hours) || 0,
      absence_rate: savedAbsRate > 0 ? savedAbsRate : calcRate,
      absence_rate_custom: savedAbsRate > 0 && Math.abs(savedAbsRate - calcRate) > 0.02,
      ot_normal_hours: Number(p.ot_normal_hours) || 0,
      ot_night_hours: Number(p.ot_night_hours) || 0,
      ot_sunday_hours: Number(p.ot_sunday_hours) || 0,
      ot_holiday_hours: Number(p.ot_holiday_hours) || 0,
      allowances: Number(p.allowances) || 0,
      bonuses: Number(p.bonuses) || 0,
      deductions: Number(p.deductions) || 0,
    };
  };

  const updateRowDraft = (p: PayrollRecord, patch: Partial<RowEditDraft>) => {
    setRowEdits((prev) => {
      const current = prev[p.id] || makeInitialDraft(p);
      const next: RowEditDraft = { ...current, ...patch };
      if (patch.basic_salary !== undefined && !next.absence_rate_custom) {
        next.absence_rate = round2((Number(patch.basic_salary) || 0) / stdHrsDivisor);
      }
      return { ...prev, [p.id]: next };
    });
  };

  const computeRowLive = (p: PayrollRecord) => {
    const draft = rowEdits[p.id];
    const isDirty = Boolean(draft);
    const basic = draft ? draft.basic_salary : Number(p.basic_salary) || 0;
    const rate = round2(basic / stdHrsDivisor);
    const absHrs = draft ? Math.max(0, draft.absence_hours) : Number(p.absence_hours) || 0;
    const absRate = draft
      ? Math.max(0, draft.absence_rate)
      : Number(p.absence_rate) > 0
        ? Number(p.absence_rate)
        : rate;
    const absAmt = round2(absHrs * absRate);

    const otNor = draft ? Math.max(0, draft.ot_normal_hours) : Number(p.ot_normal_hours) || 0;
    const otNight = draft ? Math.max(0, draft.ot_night_hours) : Number(p.ot_night_hours) || 0;
    const otSun = draft ? Math.max(0, draft.ot_sunday_hours) : Number(p.ot_sunday_hours) || 0;
    const otHol = draft ? Math.max(0, draft.ot_holiday_hours) : Number(p.ot_holiday_hours) || 0;

    const otNorBirr = round2(rate * otNor * multNormal);
    const otNightBirr = round2(rate * otNight * multNight);
    const otSunBirr = round2(rate * otSun * multSun);
    const otHolBirr = round2(rate * otHol * multHol);

    const categorizedSum = round2(otNorBirr + otNightBirr + otSunBirr + otHolBirr);
    const hasCategorized = otNor > 0 || otNight > 0 || otSun > 0 || otHol > 0;
    const otAmt = hasCategorized ? categorizedSum : draft ? 0 : Number(p.overtime_pay) || 0;

    const allowances = draft ? draft.allowances : Number(p.allowances) || 0;
    const bonuses = draft ? draft.bonuses : Number(p.bonuses) || 0;
    const deductions = draft ? draft.deductions : Number(p.deductions) || 0;

    const gross = Math.max(0, round2(basic - absAmt + allowances + otAmt + bonuses));
    const empPenRate = (rules?.employee_pension_rate ?? 7) / 100;
    const erPenRate = (rules?.employer_pension_rate ?? 11) / 100;
    const tax = calcTaxLocal(gross, brackets);
    const empPen = round2(basic * empPenRate);
    const erPen = round2(basic * erPenRate);
    const net = Math.max(0, round2(gross - tax - empPen - deductions));

    return {
      isDirty,
      name: draft ? draft.employee_name : p.employee_name,
      bank_account: draft ? draft.bank_account : p.bank_account || empBankMap.get(p.employee_code) || '',
      id_no: draft ? draft.id_no : p.id_no || '',
      basic,
      rate,
      absHrs,
      absRate,
      absAmt,
      otNor,
      otNight,
      otSun,
      otHol,
      otNorBirr,
      otNightBirr,
      otSunBirr,
      otHolBirr,
      otAmt,
      gross,
      tax,
      empPen,
      erPen,
      net,
    };
  };

  const saveSingleRow = async (p: PayrollRecord) => {
    const draft = rowEdits[p.id];
    if (!draft) return;
    setSavingRowId(p.id);
    setError(null);
    setNotice(null);
    try {
      const live = computeRowLive(p);
      const updated = await api.put<PayrollRecord>(`/api/payroll/${p.id}`, {
        employee_name: draft.employee_name,
        bank_account: draft.bank_account,
        id_no: draft.id_no,
        basic_salary: draft.basic_salary,
        standard_hours: stdHrsDivisor,
        absence_hours: draft.absence_hours,
        absence_rate: draft.absence_rate,
        ot_normal_hours: draft.ot_normal_hours,
        ot_night_hours: draft.ot_night_hours,
        ot_sunday_hours: draft.ot_sunday_hours,
        ot_holiday_hours: draft.ot_holiday_hours,
        overtime_pay: live.otAmt,
        allowances: draft.allowances,
        bonuses: draft.bonuses,
        deductions: draft.deductions,
      });
      setPayrolls((prev) => prev.map((x) => (x.id === p.id ? updated : x)));
      setRowEdits((prev) => {
        const next = { ...prev };
        delete next[p.id];
        return next;
      });
      setEditingIdentityId(null);
      setNotice(`Saved ${updated.employee_name}: Absence -${fmtNum(updated.absence_amount)} · OT +${fmtNum(updated.overtime_pay)} · Net ${fmtNum(updated.net_salary)} ${currency}.`);
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save payroll row');
    } finally {
      setSavingRowId(null);
    }
  };

  const saveAllDirtyRows = async () => {
    const dirtyIds = Object.keys(rowEdits).map(Number);
    if (dirtyIds.length === 0) return;
    setSavingAll(true);
    setError(null);
    setNotice(null);
    try {
      const updates: PayrollRecord[] = [];
      for (const id of dirtyIds) {
        const p = payrolls.find((x) => x.id === id);
        if (!p) continue;
        const draft = rowEdits[id];
        const live = computeRowLive(p);
        const updated = await api.put<PayrollRecord>(`/api/payroll/${p.id}`, {
          employee_name: draft.employee_name,
          bank_account: draft.bank_account,
          id_no: draft.id_no,
          basic_salary: draft.basic_salary,
          standard_hours: stdHrsDivisor,
          absence_hours: draft.absence_hours,
          absence_rate: draft.absence_rate,
          ot_normal_hours: draft.ot_normal_hours,
          ot_night_hours: draft.ot_night_hours,
          ot_sunday_hours: draft.ot_sunday_hours,
          ot_holiday_hours: draft.ot_holiday_hours,
          overtime_pay: live.otAmt,
          allowances: draft.allowances,
          bonuses: draft.bonuses,
          deductions: draft.deductions,
        });
        updates.push(updated);
      }
      setPayrolls((prev) => prev.map((row) => updates.find((u) => u.id === row.id) || row));
      setRowEdits({});
      setEditingIdentityId(null);
      setNotice(`Saved ${updates.length} edited payroll row(s) and updated dashboard totals.`);
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save payroll edits');
    } finally {
      setSavingAll(false);
    }
  };

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of payrolls) {
      set.add(p.month_label || p.payroll_month);
    }
    return Array.from(set);
  }, [payrolls]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of payrolls) {
      set.add(p.payroll_category || 'FACTORY PERMANENT');
    }
    return Array.from(set);
  }, [payrolls]);

  const sheetPayrolls = useMemo(() => {
    return payrolls.filter((p) => {
      const mLabel = p.month_label || p.payroll_month;
      const cat = p.payroll_category || 'FACTORY PERMANENT';
      if (sheetMonth && mLabel !== sheetMonth && p.payroll_month !== sheetMonth) return false;
      if (sheetCategory !== 'ALL' && cat !== sheetCategory) return false;
      return true;
    });
  }, [payrolls, sheetMonth, sheetCategory]);

  const activeHeaderMonth = useMemo(() => {
    if (sheetMonth) return sheetMonth;
    if (sheetPayrolls[0]) return sheetPayrolls[0].month_label || sheetPayrolls[0].payroll_month;
    return 'Meskerm 2019';
  }, [sheetMonth, sheetPayrolls]);

  const activeHeaderCategory = useMemo(() => {
    if (sheetCategory !== 'ALL') return sheetCategory;
    if (sheetPayrolls[0]) return sheetPayrolls[0].payroll_category || 'FACTORY PERMANENT';
    return 'FACTORY PERMANENT';
  }, [sheetCategory, sheetPayrolls]);

  const sheetTotals = useMemo(() => {
    return sheetPayrolls.reduce(
      (acc, p) => {
        const row = computeRowLive(p);
        acc.basic += row.basic;
        acc.rate += row.rate;
        acc.absHrs += row.absHrs;
        acc.absAmt += row.absAmt;
        acc.otNor += row.otNor;
        acc.otNight += row.otNight;
        acc.otSun += row.otSun;
        acc.otHol += row.otHol;
        acc.otNorBirr += row.otNorBirr;
        acc.otNightBirr += row.otNightBirr;
        acc.otSunBirr += row.otSunBirr;
        acc.otHolBirr += row.otHolBirr;
        acc.ot += row.otAmt;
        acc.gross += row.gross;
        acc.tax += row.tax;
        acc.empPen += row.empPen;
        acc.erPen += row.erPen;
        acc.net += row.net;
        return acc;
      },
      {
        basic: 0,
        rate: 0,
        absHrs: 0,
        absAmt: 0,
        otNor: 0,
        otNight: 0,
        otSun: 0,
        otHol: 0,
        otNorBirr: 0,
        otNightBirr: 0,
        otSunBirr: 0,
        otHolBirr: 0,
        ot: 0,
        gross: 0,
        tax: 0,
        empPen: 0,
        erPen: 0,
        net: 0,
      }
    );
  }, [sheetPayrolls, rowEdits, stdHrsDivisor, multNormal, multNight, multSun, multHol, rules, brackets]);

  const exportPayrollCsv = () => {
    const headers = [
      'No',
      'Month',
      'Category',
      'Employee Name',
      'Account',
      'ID NO',
      'Basic Salary',
      'Rate',
      'Absence Hrs',
      'Absence Rate',
      'Absence Birr',
      'OT Nor Hrs',
      'OT Nor Birr',
      'OT Night Hrs',
      'OT Night Birr',
      'OT Sun Hrs',
      'OT Sun Birr',
      'OT Holly Hrs',
      'OT Holly Birr',
      'OT Total Birr',
      'Gross Pay',
      'Income Tax',
      '7% Emp Pension',
      '11% Er Pension',
      'Net Pay',
      'Status',
    ];
    const rows = sheetPayrolls.map((p, idx) => {
      const r = computeRowLive(p);
      return [
        idx + 1,
        `"${p.month_label || p.payroll_month}"`,
        `"${p.payroll_category || 'FACTORY PERMANENT'}"`,
        `"${r.name}"`,
        `"${r.bank_account}"`,
        `"${r.id_no}"`,
        r.basic.toFixed(2),
        r.rate.toFixed(2),
        r.absHrs.toFixed(2),
        r.absRate.toFixed(2),
        r.absAmt.toFixed(2),
        r.otNor.toFixed(2),
        r.otNorBirr.toFixed(2),
        r.otNight.toFixed(2),
        r.otNightBirr.toFixed(2),
        r.otSun.toFixed(2),
        r.otSunBirr.toFixed(2),
        r.otHol.toFixed(2),
        r.otHolBirr.toFixed(2),
        r.otAmt.toFixed(2),
        r.gross.toFixed(2),
        r.tax.toFixed(2),
        r.empPen.toFixed(2),
        r.erPen.toFixed(2),
        r.net.toFixed(2),
        p.status,
      ];
    });
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seven-sunday-payroll-sheet-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSignedPdf = async () => {
    setExportingPdf(true);
    setError(null);
    setNotice(null);
    try {
      const viewMode: 'sheet' | 'runs' | 'register' =
        payrollTab === 'runs' ? 'runs' : payrollTab === 'sheet' ? 'sheet' : 'register';

      const sheetRows = sheetPayrolls.map((p, idx) => {
        const live = computeRowLive(p);
        return {
          no: idx + 1,
          monthLabel: p.month_label || p.payroll_month,
          category: p.payroll_category || 'FACTORY PERMANENT',
          name: live.name,
          bankAccount: live.bank_account,
          idNo: live.id_no,
          basic: live.basic,
          rate: live.rate,
          absHrs: live.absHrs,
          absRate: live.absRate,
          absAmt: live.absAmt,
          otNor: live.otNor,
          otNight: live.otNight,
          otSun: live.otSun,
          otHol: live.otHol,
          otNorBirr: live.otNorBirr,
          otNightBirr: live.otNightBirr,
          otSunBirr: live.otSunBirr,
          otHolBirr: live.otHolBirr,
          otAmt: live.otAmt,
          gross: live.gross,
          tax: live.tax,
          empPen: live.empPen,
          erPen: live.erPen,
          net: live.net,
          status: p.status,
        };
      });

      const result = await exportSignedPayrollSummaryPdf({
        viewMode,
        company,
        currency,
        monthLabel: activeHeaderMonth,
        categoryLabel: activeHeaderCategory,
        standardHoursDivisor: stdHrsDivisor,
        multipliers: {
          normal: multNormal,
          night: multNight,
          sunday: multSun,
          holiday: multHol,
        },
        sheetRows,
        sheetTotals,
        payrollRuns,
        registerRows: payrolls,
        selectedPayslip,
        signerName: currentUserName,
        signerRole: currentUserRole,
        preparedBy: currentUserName,
      });

      setNotice(
        `Exported signed A4 Landscape PDF (${result.fileName}) · Digital Seal: ${result.signatureHash}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export signed PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  const bonusPreviewTotal = useMemo(() => {
    const pct = Number(runForm.bonus_percent) || 0;
    const fixed = Number(runForm.fixed_bonus) || 0;
    const active = employees.filter((e) => e.status === 'Active');
    return active.reduce((sum, emp) => sum + fixed + emp.basic_salary * (pct / 100), 0);
  }, [employees, runForm]);

  const dirtyCount = Object.keys(rowEdits).length;
  const logoSrc = company?.logo_data || '/assets/aistudio/Seven_Sunday_Logo_2_desktop_addf2fa7.png';

  // ==================== HR MODE ====================
  if (mode === 'hr') {
    return (
      <div className="space-y-6">
        <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-bold text-[#172033] dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#087CEB]" />
                Employee Registration Format & Human Resources
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Complete official staff onboarding form with Photo Upload, National ID / Passport No, Phone No, Bank Account No, Emergency Contact Phone, Education Document Upload, and Real QR ID Card.
              </p>
            </div>
          </div>

          {notice && (
            <div className="mb-4 px-4 py-2 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
              {notice}
            </div>
          )}
          {error && (
            <div className="mb-4 px-4 py-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setNotice(null);
              try {
                const payload = {
                  ...empForm,
                  basic_salary: Number(empForm.basic_salary) || 0,
                };
                if (editingEmpId !== null) {
                  const updated = await api.put<EmployeeProfile>(`/api/employees/${editingEmpId}`, payload);
                  setEmployees((prev) => prev.map((x) => (x.id === editingEmpId ? updated : x)));
                  setSelectedEmpCard(updated);
                  setEditingEmpId(null);
                  setEmpForm(emptyEmpForm);
                  setNotice(`Saved changes to ${updated.full_name} (${updated.employee_id}).`);
                } else {
                  const created = await api.post<EmployeeProfile>('/api/employees', payload);
                  setEmployees((prev) => [created, ...prev]);
                  setSelectedEmpCard(created);
                  setEmpForm(emptyEmpForm);
                  setNotice(`Saved & registered ${created.full_name} (${created.employee_id}). Please scan their real finger on ZKTeco K40.`);
                  setFpModalState({ emp: created, isNew: true });
                }
                onRefreshDashboard();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to save employee');
              }
            }}
            className="space-y-5 pt-4 border-t border-slate-200 dark:border-slate-800"
          >
            {/* Section A */}
            <div className="bg-[#F8FAFC] dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-[#18243A] dark:text-[#38BDF8] uppercase tracking-wider">
                Section A · Personal Details, Photo & National ID / Passport
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Employee Full Name"
                    value={empForm.full_name}
                    onChange={(e) => setEmpForm({ ...empForm, full_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">National ID / Passport No *</label>
                  <input
                    type="text"
                    placeholder="ETH-ID / Passport #"
                    value={empForm.national_id}
                    onChange={(e) => setEmpForm({ ...empForm, national_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Gender</label>
                  <select
                    value={empForm.gender}
                    onChange={(e) => setEmpForm({ ...empForm, gender: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={empForm.dob}
                    onChange={(e) => setEmpForm({ ...empForm, dob: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Phone No *</label>
                  <input
                    type="text"
                    required
                    placeholder="+251 9..."
                    value={empForm.phone}
                    onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="user@sevensundayethiopia.com"
                    value={empForm.email}
                    onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Residential Address</label>
                  <input
                    type="text"
                    placeholder="Sub-city, Woreda, House #"
                    value={empForm.address}
                    onChange={(e) => setEmpForm({ ...empForm, address: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Photo Upload</label>
                  <div className="flex items-center gap-2">
                    <label className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded-lg cursor-pointer whitespace-nowrap">
                      <ImagePlus className="w-3.5 h-3.5" />
                      {empForm.photo_data ? 'Change Photo' : 'Upload Photo'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const url = await fileToDataUrl(f);
                            setEmpForm((prev) => ({ ...prev, photo_data: url }));
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {empForm.photo_data && (
                      <img
                        src={empForm.photo_data}
                        alt="Staff Preview"
                        className="w-9 h-9 rounded-lg object-cover border border-slate-300 shrink-0"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section B */}
            <div className="bg-[#F8FAFC] dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-[#18243A] dark:text-[#38BDF8] uppercase tracking-wider">
                Section B · Employment Terms, Bank Account & Emergency Contact
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Department *</label>
                  <input
                    type="text"
                    required
                    value={empForm.department}
                    onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Job Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="Position / Role"
                    value={empForm.job_title}
                    onChange={(e) => setEmpForm({ ...empForm, job_title: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Employment Type</label>
                  <select
                    value={empForm.employment_type}
                    onChange={(e) => setEmpForm({ ...empForm, employment_type: e.target.value as EmployeeProfile['employment_type'] })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="Permanent">Permanent</option>
                    <option value="Contract">Contract</option>
                    <option value="Temporary">Temporary</option>
                    <option value="Intern">Intern</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={empForm.start_date}
                    onChange={(e) => setEmpForm({ ...empForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Basic Salary ({currency})</label>
                  <input
                    type="number"
                    value={empForm.basic_salary}
                    onChange={(e) => setEmpForm({ ...empForm, basic_salary: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Bank Account No</label>
                  <input
                    type="text"
                    placeholder="CBE / Awash / Dashen Acc #"
                    value={empForm.bank_account}
                    onChange={(e) => setEmpForm({ ...empForm, bank_account: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Emergency Contact Name</label>
                  <input
                    type="text"
                    placeholder="Full Name / Relation"
                    value={empForm.emergency_contact}
                    onChange={(e) => setEmpForm({ ...empForm, emergency_contact: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Emergency Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+251 9..."
                    value={empForm.emergency_contact_phone}
                    onChange={(e) => setEmpForm({ ...empForm, emergency_contact_phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Section C */}
            <div className="bg-[#F8FAFC] dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-[#18243A] dark:text-[#38BDF8] uppercase tracking-wider">
                Section C · Education Background & Supporting Document Upload
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Education Level / Degree</label>
                  <input
                    type="text"
                    placeholder="e.g. BSc Industrial Engineering"
                    value={empForm.education}
                    onChange={(e) => setEmpForm({ ...empForm, education: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Prior Work Experience</label>
                  <input
                    type="text"
                    placeholder="e.g. 5 Years Manufacturing"
                    value={empForm.experience}
                    onChange={(e) => setEmpForm({ ...empForm, experience: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Upload Education Document</label>
                  <label className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#18243A] bg-white dark:bg-slate-800 dark:text-white border border-slate-300 dark:border-slate-600 hover:bg-slate-50 rounded-lg cursor-pointer truncate">
                    <FileUp className="w-3.5 h-3.5 text-[#087CEB] shrink-0" />
                    <span className="truncate">{empForm.education_doc_name || 'Upload PDF / Image Certificate'}</span>
                    <input
                      type="file"
                      accept=".pdf,image/*,.doc,.docx"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          const url = await fileToDataUrl(f);
                          setEmpForm((prev) => ({
                            ...prev,
                            education_doc_name: f.name,
                            education_doc_data: url,
                          }));
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  {editingEmpId !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingEmpId(null);
                        setEmpForm(emptyEmpForm);
                      }}
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm font-semibold text-[#172033] bg-slate-100 hover:bg-slate-200 rounded-lg"
                      title="Cancel Edit"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
                  >
                    <Save className="w-4 h-4" />
                    {editingEmpId !== null ? 'Save Employee Record' : 'Save & Register Employee'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Employee Directory + Printable ID Badge & Registration Sheet */}
        <div className="print-grid-reset grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="no-print lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#172033] dark:text-white">
                Employee Master Register ({employees.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <th className="py-3 px-4">Staff / Photo</th>
                    <th className="py-3 px-4">ID / National ID</th>
                    <th className="py-3 px-4">Bank & Contact</th>
                    <th className="py-3 px-4 text-right">Salary</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {employees.map((emp) => (
                    <tr
                      key={emp.id}
                      className={`hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40 ${
                        selectedEmpCard?.id === emp.id ? 'bg-[#38BDF8]/15 dark:bg-slate-800/70' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {emp.photo_data ? (
                            <img
                              src={emp.photo_data}
                              alt={emp.full_name}
                              className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-[#18243A] text-[#38BDF8] flex items-center justify-center text-xs font-bold shrink-0">
                              {emp.full_name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-[#172033] dark:text-white">{emp.full_name}</div>
                            <div className="text-xs text-slate-500">{emp.department} · {emp.job_title}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono">
                        <div className="font-semibold text-[#18243A] dark:text-[#38BDF8]">{emp.employee_id}</div>
                        <div className="text-slate-500">{emp.national_id || 'NID: —'}</div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="font-mono text-slate-700 dark:text-slate-300">{emp.phone || '—'}</div>
                        <div className="font-mono text-slate-500">Bank: {emp.bank_account || '—'}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums">
                        {formatMoney(emp.basic_salary, currency)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setFpModalState({ emp, isNew: false })}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap border ${
                              enrolledEmpIds.has(emp.employee_id)
                                ? 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                                : 'text-[#087CEB] bg-[#EAF4FF] hover:bg-[#DBEAFE] border-[#087CEB]/30'
                            }`}
                            title="Enroll real fingerprint from ZKTeco K40 or hardware reader"
                          >
                            <Fingerprint className="w-3.5 h-3.5" />
                            {enrolledEmpIds.has(emp.employee_id) ? 'Finger Ready' : 'Enroll Finger'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedEmpCard(emp)}
                            className="px-2.5 py-1.5 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded-lg whitespace-nowrap"
                          >
                            ID & File
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEmpId(emp.id);
                              setSelectedEmpCard(emp);
                              setEmpForm({
                                full_name: emp.full_name,
                                gender: emp.gender,
                                dob: emp.dob || '',
                                phone: emp.phone || '',
                                email: emp.email || '',
                                address: emp.address || '',
                                national_id: emp.national_id || '',
                                emergency_contact: emp.emergency_contact || '',
                                emergency_contact_phone: emp.emergency_contact_phone || '',
                                department: emp.department,
                                job_title: emp.job_title,
                                employment_type: emp.employment_type,
                                start_date: emp.start_date,
                                contract_expiry: emp.contract_expiry || '',
                                basic_salary: String(emp.basic_salary),
                                bank_account: emp.bank_account || '',
                                education: emp.education || '',
                                experience: emp.experience || '',
                                photo_data: emp.photo_data || '',
                                education_doc_name: emp.education_doc_name || '',
                                education_doc_data: emp.education_doc_data || '',
                              });
                            }}
                            className="p-1.5 text-[#172033] bg-slate-100 hover:bg-slate-200 rounded-lg"
                            title="Edit Employee"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await api.del(`/api/employees/${emp.id}`);
                              const next = employees.filter((x) => x.id !== emp.id);
                              setEmployees(next);
                              if (selectedEmpCard?.id === emp.id) setSelectedEmpCard(next[0] || null);
                              if (editingEmpId === emp.id) {
                                setEditingEmpId(null);
                                setEmpForm(emptyEmpForm);
                              }
                              onRefreshDashboard();
                            }}
                            className="p-1.5 text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
                            title="Delete employee"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div
            data-print-active="true"
            data-print-orientation="portrait"
            className="lg:col-span-5 print-only-container bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-4"
          >
            <div className="no-print flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F8FAFC] dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setHrPreviewMode('id-card')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded whitespace-nowrap ${
                    hrPreviewMode === 'id-card' ? 'bg-[#18243A] text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  QR Staff ID (CR80)
                </button>
                <button
                  type="button"
                  onClick={() => setHrPreviewMode('registration-sheet')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded whitespace-nowrap ${
                    hrPreviewMode === 'registration-sheet' ? 'bg-[#18243A] text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Registration Format
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedEmpCard && (
                  <>
                    <ShareButton
                      compact
                      title={`Staff ID & Record — ${selectedEmpCard.full_name}`}
                      reference={selectedEmpCard.employee_id}
                      moduleName="HR & Staff ID"
                      summary={`Employee: ${selectedEmpCard.full_name} (${selectedEmpCard.employee_id})\nTitle: ${selectedEmpCard.job_title}\nDepartment: ${selectedEmpCard.department}\nStatus: ${selectedEmpCard.status}\nPhone: ${selectedEmpCard.phone || 'N/A'}`}
                    />
                    <SendToApproveButton
                      compact
                      sourceModule="hr"
                      recordRef={selectedEmpCard.employee_id}
                      title={`Staff ID & Registration — ${selectedEmpCard.full_name}`}
                      summary={`${selectedEmpCard.job_title} · ${selectedEmpCard.department} · Start: ${selectedEmpCard.start_date}`}
                      fromDepartment="Human Resources"
                      onDispatched={() => {
                        setNotice(`Sent ${selectedEmpCard.full_name} HR record to approving department.`);
                        onRefreshDashboard();
                      }}
                    />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => printWithAutoFit({ orientation: 'portrait' })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#18243A] hover:bg-[#172033] rounded-lg whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5 text-[#087CEB]" />
                  Print
                </button>
              </div>
            </div>

            {selectedEmpCard ? (
              hrPreviewMode === 'id-card' ? (
                <div className="space-y-4">
                  <div className="no-print flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-mono">
                      ISO/IEC 7810 ID-1 Standard (85.6 × 53.98 mm)
                    </span>
                    <div className="flex items-center gap-1 p-0.5 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                      {(['both', 'front', 'back'] as const).map((side) => (
                        <button
                          key={side}
                          type="button"
                          onClick={() => setIdCardSide(side)}
                          className={`px-2 py-1 text-[11px] font-semibold rounded capitalize ${
                            idCardSide === side ? 'bg-[#087CEB] text-white' : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {side === 'both' ? 'Front & Back' : `${side} Side`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="sheet-scroll-stage py-1">
                    <div className="sheet-scroll-inner flex flex-col items-center gap-4">
                    {/* FRONT SIDE (85.6mm x 53.98mm) */}
                    {(idCardSide === 'both' || idCardSide === 'front') && (
                      <div className="space-y-1">
                        <div className="no-print text-[10px] font-mono uppercase tracking-wider text-slate-400 text-center">
                          Front Side (CR80 Standard)
                        </div>
                        <div className="id-card-cr80 border-2 border-[#18243A] rounded-xl overflow-hidden bg-white text-[#172033] shadow-sm flex flex-col justify-between">
                          <div className="bg-[#18243A] text-white px-3 py-1.5 flex items-center justify-between">
                            <img src={logoSrc} alt="Seven Sunday" className="h-5 w-auto object-contain bg-white rounded px-1 py-0.5" />
                            <div className="text-right leading-tight">
                              <div className="text-[9px] font-mono font-bold text-[#38BDF8]">OFFICIAL STAFF ID</div>
                              <div className="text-[8px] text-slate-300">{selectedEmpCard.status.toUpperCase()}</div>
                            </div>
                          </div>

                          <div className="px-3 py-2 flex items-center gap-2.5 flex-1">
                            <div className="shrink-0">
                              {selectedEmpCard.photo_data ? (
                                <img
                                  src={selectedEmpCard.photo_data}
                                  alt={selectedEmpCard.full_name}
                                  className="w-14 h-16 rounded-md object-cover border border-[#087CEB]"
                                />
                              ) : (
                                <div className="w-14 h-16 rounded-md bg-[#18243A] text-[#38BDF8] flex items-center justify-center text-sm font-bold border border-[#087CEB]">
                                  {selectedEmpCard.full_name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0 leading-tight">
                              <div className="text-xs font-bold text-[#18243A] truncate">{selectedEmpCard.full_name}</div>
                              <div className="text-[10px] font-semibold text-[#087CEB] truncate">{selectedEmpCard.job_title}</div>
                              <div className="mt-1 space-y-0.5 text-[9px] font-mono text-slate-600">
                                <div className="truncate"><span className="text-slate-400">ID:</span> {selectedEmpCard.employee_id}</div>
                                <div className="truncate"><span className="text-slate-400">DEPT:</span> {selectedEmpCard.department}</div>
                                <div className="truncate"><span className="text-slate-400">JOIN:</span> {selectedEmpCard.start_date}</div>
                              </div>
                            </div>

                            <div className="shrink-0">
                              <RealQrCode
                                value={`SS-STAFF-FRONT|${selectedEmpCard.employee_id}|${selectedEmpCard.full_name}|${selectedEmpCard.department}|${selectedEmpCard.status}`}
                                size={52}
                              />
                            </div>
                          </div>

                          <div className="px-3 py-1 bg-[#F8FAFC] border-t border-slate-200 flex items-center justify-between text-[8px] text-slate-600">
                            <span className="font-semibold text-[#18243A] truncate">
                              {company?.brand_name || 'Seven Sunday Ethiopia'}
                            </span>
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-[#087CEB]">
                              <BadgeCheck className="w-3 h-3" />
                              ID-1 VERIFIED
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* BACK SIDE (85.6mm x 53.98mm) */}
                    {(idCardSide === 'both' || idCardSide === 'back') && (
                      <div className="space-y-1">
                        <div className="no-print text-[10px] font-mono uppercase tracking-wider text-slate-400 text-center">
                          Back Side (Emergency & QR Verification)
                        </div>
                        <div className="id-card-cr80 border-2 border-[#18243A] rounded-xl overflow-hidden bg-white text-[#172033] shadow-sm flex flex-col justify-between">
                          <div className="bg-[#18243A] text-white px-3 py-1 flex items-center justify-between text-[8px] font-mono">
                            <span className="truncate font-semibold">{company?.company_name || 'Seven Sunday Manufacturing & Trading PLC'}</span>
                            <span className="text-[#38BDF8] shrink-0">TIN {company?.tin_number || 'ET-00981244'}</span>
                          </div>

                          <div className="px-3 py-2 flex items-start justify-between gap-2.5 flex-1 text-[8.5px] leading-tight">
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono">
                                <div className="truncate"><span className="text-slate-400">NID:</span> {selectedEmpCard.national_id || 'N/A'}</div>
                                <div className="truncate"><span className="text-slate-400">TYPE:</span> {selectedEmpCard.employment_type}</div>
                                <div className="truncate"><span className="text-slate-400">TEL:</span> {selectedEmpCard.phone || 'N/A'}</div>
                                <div className="truncate"><span className="text-slate-400">EXP:</span> {selectedEmpCard.contract_expiry || 'Permanent'}</div>
                              </div>
                              <div className="p-1.5 rounded bg-[#F8FAFC] border border-slate-200">
                                <div className="font-bold text-[#18243A] text-[8px] uppercase">Emergency Contact</div>
                                <div className="text-[8.5px] font-medium truncate">
                                  {selectedEmpCard.emergency_contact || 'HR Safety Desk'} · {selectedEmpCard.emergency_contact_phone || company?.phone || '+251 11 000 0000'}
                                </div>
                              </div>
                              <div className="text-[7.5px] text-slate-500 leading-snug">
                                Property of Seven Sunday PLC ({company?.address || 'Addis Ababa, Ethiopia'}). If found, return immediately to HR Security Office or call {company?.phone || '+251 11 000 0000'}.
                              </div>
                            </div>

                            <div className="shrink-0 flex flex-col items-center gap-1">
                              <RealQrCode
                                value={`SS-STAFF-VERIFY|${selectedEmpCard.employee_id}|NID:${selectedEmpCard.national_id || 'NA'}|EMG:${selectedEmpCard.emergency_contact_phone || 'NA'}`}
                                size={56}
                              />
                              <span className="text-[7px] font-mono text-slate-500">SCAN TO VERIFY</span>
                            </div>
                          </div>

                          <div className="px-3 py-1.5 bg-[#F8FAFC] border-t border-slate-200 flex items-end justify-between gap-2 text-[7.5px] text-slate-600">
                            <div className="flex-1">
                              <div className="h-3.5 border-b border-slate-400 mb-0.5" />
                              <span>Cardholder Signature</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {company?.stamp_data && (
                                <img src={company.stamp_data} alt="Stamp" className="h-6 w-6 object-contain opacity-90" />
                              )}
                              {company?.signature_data && (
                                <img src={company.signature_data} alt="HR Signature" className="h-5 w-11 object-contain" />
                              )}
                              <span className="font-semibold text-[#18243A]">HR Auth.</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-slate-300 rounded-xl p-4 sm:p-5 bg-white text-[#172033] space-y-4 text-xs">
                  <div className="flex items-center justify-between pb-3 border-b-2 border-[#18243A]">
                    <div className="flex items-center gap-3">
                      <img src={logoSrc} alt="Seven Sunday" className="h-9 w-auto object-contain" />
                      <div>
                        <div className="font-bold text-sm text-[#18243A]">EMPLOYEE REGISTRATION RECORD</div>
                        <div className="text-[11px] text-slate-500">{company?.company_name || 'Seven Sunday Manufacturing & Trading PLC'}</div>
                      </div>
                    </div>
                    <RealQrCode
                      value={`SS-REG|${selectedEmpCard.employee_id}|${selectedEmpCard.full_name}|${selectedEmpCard.bank_account}|${selectedEmpCard.national_id}`}
                      size={68}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 bg-[#F8FAFC] p-3 rounded-lg border border-slate-200">
                    <div><span className="text-slate-500">Staff ID:</span> <span className="font-mono font-bold">{selectedEmpCard.employee_id}</span></div>
                    <div><span className="text-slate-500">Full Name:</span> <span className="font-bold">{selectedEmpCard.full_name}</span></div>
                    <div><span className="text-slate-500">National ID / Passport:</span> <span className="font-mono">{selectedEmpCard.national_id || '—'}</span></div>
                    <div><span className="text-slate-500">Phone No:</span> <span className="font-mono">{selectedEmpCard.phone || '—'}</span></div>
                    <div><span className="text-slate-500">Department:</span> <span>{selectedEmpCard.department}</span></div>
                    <div><span className="text-slate-500">Job Title:</span> <span>{selectedEmpCard.job_title}</span></div>
                    <div><span className="text-slate-500">Bank Account No:</span> <span className="font-mono font-semibold">{selectedEmpCard.bank_account || '—'}</span></div>
                    <div><span className="text-slate-500">Basic Salary:</span> <span className="font-mono font-semibold">{formatMoney(selectedEmpCard.basic_salary, currency)}</span></div>
                    <div><span className="text-slate-500">Emergency Contact:</span> <span>{selectedEmpCard.emergency_contact || '—'}</span></div>
                    <div><span className="text-slate-500">Emergency Phone:</span> <span className="font-mono">{selectedEmpCard.emergency_contact_phone || '—'}</span></div>
                    <div><span className="text-slate-500">Education:</span> <span>{selectedEmpCard.education || '—'}</span></div>
                    <div>
                      <span className="text-slate-500">Education Doc:</span>{' '}
                      {selectedEmpCard.education_doc_data ? (
                        <a
                          href={selectedEmpCard.education_doc_data}
                          download={selectedEmpCard.education_doc_name || 'education-doc'}
                          className="text-[#18243A] font-semibold underline"
                        >
                          {selectedEmpCard.education_doc_name || 'Download Attachment'}
                        </a>
                      ) : (
                        <span>{selectedEmpCard.education_doc_name || 'None'}</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-semibold">HR Verification & Official Seal</div>
                      <div className="text-[11px] text-slate-500">Start Date: {selectedEmpCard.start_date} · Status: {selectedEmpCard.status}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {company?.stamp_data && <img src={company.stamp_data} alt="Stamp" className="h-10 w-10 object-contain" />}
                      {company?.signature_data && <img src={company.signature_data} alt="Signature" className="h-8 w-16 object-contain" />}
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="text-xs text-slate-500 py-8 text-center">Select an employee to preview ID Card or Registration Format.</div>
            )}
          </div>
        </div>
        {fpModalState && (
          <ZktecoFingerprintModal
            employee={fpModalState.emp}
            isNewRegistration={fpModalState.isNew}
            onClose={() => setFpModalState(null)}
            onEnrolled={(fp) => {
              setEnrolledEmpIds((prev) => new Set([...prev, fp.employee_id]));
              setNotice(`Enrolled real fingerprint (${fp.finger_label}) for ${fp.employee_name} (${fp.employee_id}).`);
              onRefreshDashboard();
            }}
          />
        )}
      </div>
    );
  }

  // ==================== PAYROLL MODE ====================
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header & Sub-Navigation */}
      <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#172033] dark:text-white">
            Ethiopian Payroll Sheet, Absence & Categorized Overtime
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Interactive Absence (-/+ hours, editable Birr/hr rate & Total Absence Birr) and Categorized OT (Nor {multNormal}x · Night {multNight}x · Sun {multSun}x · Holly {multHol}x) — responsive across all devices & auto-fitted for paper.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['sheet', 'Real Payroll Sheet (Landscape A4)', <FileSpreadsheet className="w-3.5 h-3.5" />],
              ['analytics', 'Executive Payroll Analytics', <BarChart3 className="w-3.5 h-3.5" />],
              ['runs', 'Monthly Payroll Runs & Bonus', <Play className="w-3.5 h-3.5" />],
              ['individual', 'Single Staff Entry & QR Payslip', <Calculator className="w-3.5 h-3.5" />],
              ['rules', 'Ethiopian Tax & Pension Rules', <Settings className="w-3.5 h-3.5" />],
            ] as const
          ).map(([key, label, icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPayrollTab(key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap ${
                payrollTab === key
                  ? 'bg-[#18243A] text-white'
                  : 'bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-slate-200 hover:bg-[#EAF4FF]'
              }`}
            >
              <span className={payrollTab === key ? 'text-[#38BDF8]' : 'text-[#087CEB]'}>{icon}</span>
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={exportPayrollCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded-lg whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            disabled={exportingPdf}
            onClick={handleExportSignedPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#18243A] hover:bg-[#243656] disabled:opacity-60 rounded-lg whitespace-nowrap"
            title="Export current payroll view summary as a digitally signed A4 Landscape PDF"
          >
            <BadgeCheck className="w-3.5 h-3.5 text-[#38BDF8]" />
            {exportingPdf ? 'Signing PDF...' : 'Export Signed PDF (A4 Landscape)'}
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

      {/* TAB: EXECUTIVE PAYROLL ANALYTICS */}
      {payrollTab === 'analytics' && (
        <ExecutivePayrollAnalytics
          payrolls={payrolls}
          payrollRuns={payrollRuns}
          computeRowLive={computeRowLive}
          currency={currency}
          multipliers={{
            normal: multNormal,
            night: multNight,
            sunday: multSun,
            holiday: multHol,
          }}
          selectedMonth={sheetMonth}
          selectedCategory={sheetCategory}
          onExportSignedPdf={handleExportSignedPdf}
          exportingPdf={exportingPdf}
          onBackToSheet={() => setPayrollTab('sheet')}
        />
      )}

      {/* TAB: MONTHLY PAYROLL RUNS */}
      {payrollTab === 'runs' && (
        <div className="space-y-6">
          <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h3 className="text-base font-bold text-[#172033] dark:text-white mb-1">
              Calculate Monthly Payroll & Bonus Run
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Aggregates all Active employees ({employees.filter((e) => e.status === 'Active').length} staff), pulls Attendance OT pay for the selected month, applies Bonus % + Fixed Bonus, and posts Ethiopian Tax ({rules?.employee_pension_rate ?? 7}% / {rules?.employer_pension_rate ?? 11}% pension).
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                setNotice(null);
                try {
                  const res = await api.post<{ run: PayrollRun; payrolls: PayrollRecord[] }>('/api/payroll-runs/calculate', {
                    payroll_month: runForm.payroll_month,
                    bonus_percent: Number(runForm.bonus_percent) || 0,
                    fixed_bonus: Number(runForm.fixed_bonus) || 0,
                  });
                  setPayrollRuns((prev) => [res.run, ...prev]);
                  setPayrolls((prev) => [...res.payrolls, ...prev]);
                  if (res.payrolls[0]) setSelectedPayslip(res.payrolls[0]);
                  setNotice(`Payroll Run ${res.run.run_code} completed for ${res.run.employee_count} employees (Net ${formatMoney(res.run.total_net, currency)}).`);
                  onRefreshDashboard();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Monthly payroll run failed');
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
            >
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Payroll Month</label>
                <input
                  type="month"
                  required
                  value={runForm.payroll_month}
                  onChange={(e) => setRunForm({ ...runForm, payroll_month: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Bonus (% of Basic Salary)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={runForm.bonus_percent}
                  onChange={(e) => setRunForm({ ...runForm, bonus_percent: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Fixed Bonus per Staff ({currency})</label>
                <input
                  type="number"
                  step="10"
                  min="0"
                  value={runForm.fixed_bonus}
                  onChange={(e) => setRunForm({ ...runForm, fixed_bonus: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div className="flex flex-col justify-end">
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
                >
                  <Calculator className="w-4 h-4" />
                  Calculate Monthly Payroll (Bonus {formatMoney(bonusPreviewTotal, currency)})
                </button>
              </div>
            </form>
          </div>

          <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#172033] dark:text-white">Payroll Runs Ledger ({payrollRuns.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <th className="py-3 px-4">Run Code / Month</th>
                    <th className="py-3 px-4 text-right">Staff</th>
                    <th className="py-3 px-4 text-right">Total Gross</th>
                    <th className="py-3 px-4 text-right">Total Bonus</th>
                    <th className="py-3 px-4 text-right">Income Tax</th>
                    <th className="py-3 px-4 text-right">Pension</th>
                    <th className="py-3 px-4 text-right">Total Net</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {payrollRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono text-xs">
                        <div className="font-bold text-[#18243A] dark:text-[#38BDF8]">{run.run_code}</div>
                        <div className="text-slate-500">{run.payroll_month} · by {run.created_by}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">{run.employee_count}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">{formatMoney(run.total_gross, currency)}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-emerald-700">{formatMoney(run.total_bonus, currency)}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-red-700">{formatMoney(run.total_tax, currency)}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">{formatMoney(run.total_pension, currency)}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-bold tabular-nums">{formatMoney(run.total_net, currency)}</td>
                      <td className="py-3 px-4 text-xs font-semibold text-emerald-700 dark:text-emerald-400">{run.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: SINGLE STAFF ENTRY */}
      {payrollTab === 'individual' && (
        <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-[#172033] dark:text-white">
            Single Staff Salary, Absence & Categorized Overtime Entry
          </h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              try {
                const created = await api.post<PayrollRecord>('/api/payroll/generate', {
                  ...payForm,
                  standard_hours: stdHrsDivisor,
                  basic_salary: Number(payForm.basic_salary) || 0,
                  absence_hours: Number(payForm.absence_hours) || 0,
                  absence_rate: payForm.absence_rate ? Number(payForm.absence_rate) : undefined,
                  ot_normal_hours: Number(payForm.ot_normal_hours) || 0,
                  ot_night_hours: Number(payForm.ot_night_hours) || 0,
                  ot_sunday_hours: Number(payForm.ot_sunday_hours) || 0,
                  ot_holiday_hours: Number(payForm.ot_holiday_hours) || 0,
                  allowances: Number(payForm.allowances) || 0,
                  bonuses: Number(payForm.bonuses) || 0,
                  deductions: Number(payForm.deductions) || 0,
                });
                setPayrolls((prev) => [created, ...prev]);
                setSelectedPayslip(created);
                setNotice(`Generated payroll entry for ${created.employee_name}.`);
                onRefreshDashboard();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Payroll generation failed');
              }
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3"
          >
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Month</label>
              <input
                type="month"
                value={payForm.payroll_month}
                onChange={(e) => setPayForm({ ...payForm, payroll_month: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Employee</label>
              <select
                value={payForm.employee_code}
                onChange={(e) => {
                  const found = employees.find((emp) => emp.employee_id === e.target.value);
                  if (found) {
                    setPayForm({
                      ...payForm,
                      employee_code: found.employee_id,
                      employee_name: found.full_name,
                      department: found.department,
                      basic_salary: String(found.basic_salary),
                    });
                  }
                }}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.employee_id}>
                    {emp.employee_id} — {emp.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Basic Salary</label>
              <input
                type="number"
                value={payForm.basic_salary}
                onChange={(e) => setPayForm({ ...payForm, basic_salary: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Absence (Hrs / Rate)</label>
              <div className="grid grid-cols-2 gap-1">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="Hrs"
                  value={payForm.absence_hours}
                  onChange={(e) => setPayForm({ ...payForm, absence_hours: e.target.value })}
                  className="px-2 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Auto"
                  value={payForm.absence_rate}
                  onChange={(e) => setPayForm({ ...payForm, absence_rate: e.target.value })}
                  className="px-2 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Allow. / Bonus</label>
              <div className="grid grid-cols-2 gap-1">
                <input
                  type="number"
                  title="Allowances"
                  value={payForm.allowances}
                  onChange={(e) => setPayForm({ ...payForm, allowances: e.target.value })}
                  className="px-2 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
                <input
                  type="number"
                  title="Bonus"
                  value={payForm.bonuses}
                  onChange={(e) => setPayForm({ ...payForm, bonuses: e.target.value })}
                  className="px-2 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">OT Nor Hrs ({multNormal}x)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={payForm.ot_normal_hours}
                onChange={(e) => setPayForm({ ...payForm, ot_normal_hours: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">OT Night Hrs ({multNight}x)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={payForm.ot_night_hours}
                onChange={(e) => setPayForm({ ...payForm, ot_night_hours: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">OT Sun Hrs ({multSun}x)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={payForm.ot_sunday_hours}
                onChange={(e) => setPayForm({ ...payForm, ot_sunday_hours: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">OT Holly Hrs ({multHol}x)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={payForm.ot_holiday_hours}
                onChange={(e) => setPayForm({ ...payForm, ot_holiday_hours: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div className="lg:col-span-2 flex items-end">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
              >
                <Save className="w-4 h-4" />
                Save & Generate Payslip
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB: REAL PAYROLL SHEET WITH INTERACTIVE ABSENCE & CATEGORIZED OT */}
      {payrollTab === 'sheet' && (
        <div className="space-y-4">
          {/* Control Toolbar + OT Multiplier Controls + Live Category Totals */}
          <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 sm:px-4 py-3.5 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={sheetMonth}
                  onChange={(e) => setSheetMonth(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  title="Filter Payroll Month"
                >
                  <option value="">All Months ({payrolls.length})</option>
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select
                  value={sheetCategory}
                  onChange={(e) => setSheetCategory(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  title="Filter Staff Category"
                >
                  <option value="ALL">All Categories</option>
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Monthly Hrs:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={standardHoursDivisor}
                    onChange={(e) => setStandardHoursDivisor(e.target.value)}
                    className="w-20 px-2 py-1 text-xs font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div className="flex items-center gap-1 p-1 bg-[#F8FAFC] dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setSheetOrientation('landscape')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded whitespace-nowrap ${
                      sheetOrientation === 'landscape' ? 'bg-[#18243A] text-white' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Landscape A4
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheetOrientation('portrait')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded whitespace-nowrap ${
                      sheetOrientation === 'portrait' ? 'bg-[#18243A] text-white' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Portrait A4
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {dirtyCount > 0 && (
                  <button
                    type="button"
                    disabled={savingAll}
                    onClick={saveAllDirtyRows}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg whitespace-nowrap"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savingAll ? 'Saving...' : `Save All Edits (${dirtyCount})`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowAddSheetRow((s) => !s)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Staff to Sheet
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const drafts = sheetPayrolls.filter((p) => p.status === 'Draft');
                    if (drafts.length === 0) {
                      setNotice('All displayed payroll rows are already approved/verified.');
                      return;
                    }
                    const updatedRows = await Promise.all(
                      drafts.map((d) => api.patch<PayrollRecord>(`/api/payroll/${d.id}/status`, { status: 'Approved' }))
                    );
                    setPayrolls((prev) =>
                      prev.map((row) => updatedRows.find((u) => u.id === row.id) || row)
                    );
                    setNotice(`Saved & approved ${updatedRows.length} payroll entries.`);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded-lg whitespace-nowrap"
                >
                  <Check className="w-3.5 h-3.5" />
                  Approve Drafts
                </button>
                <SendToApproveButton
                  compact
                  sourceModule="payroll"
                  recordRef={`PAYROLL-${activeHeaderMonth}`}
                  title={`Monthly Payroll Sheet — ${activeHeaderMonth} (${sheetPayrolls.length} staff)`}
                  summary={`Total Net Payable: ${formatMoney(sheetTotals.net, currency)} · Gross: ${formatMoney(sheetTotals.gross, currency)} · OT: +${formatMoney(sheetTotals.ot, currency)} · Absence: -${formatMoney(sheetTotals.absAmt, currency)}`}
                  fromDepartment="Human Resources"
                  defaultTargetDepartment="Finance & Accounting"
                  onDispatched={() => {
                    setNotice('Payroll Sheet sent to Finance / General Manager for approval.');
                    onRefreshDashboard();
                  }}
                />
                <ShareButton
                  compact
                  title={`Payroll Sheet — ${activeHeaderMonth}`}
                  reference={`PAYROLL-${activeHeaderMonth}`}
                  moduleName="Payroll"
                  summary={`Month: ${activeHeaderMonth} (${activeHeaderCategory})\nStaff Rows: ${sheetPayrolls.length}\nBasic Total: ${formatMoney(sheetTotals.basic, currency)}\nAbsence Deduction: -${formatMoney(sheetTotals.absAmt, currency)}\nOvertime Total: +${formatMoney(sheetTotals.ot, currency)}\nGross Total: ${formatMoney(sheetTotals.gross, currency)}\nNet Payable: ${formatMoney(sheetTotals.net, currency)}`}
                />
                <button
                  type="button"
                  onClick={() => setMobileCardEditOpen((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap border ${
                    mobileCardEditOpen
                      ? 'bg-[#18243A] text-white border-[#18243A]'
                      : 'bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-slate-200 border-slate-200 dark:border-slate-700'
                  }`}
                  title="Edit Absence & Overtime using touch-friendly mobile cards"
                >
                  <Calculator className="w-3.5 h-3.5 text-[#087CEB]" />
                  {mobileCardEditOpen ? 'Hide Card Editor' : 'Mobile / Touch Editor'}
                </button>
                <button
                  type="button"
                  disabled={exportingPdf}
                  onClick={handleExportSignedPdf}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#18243A] hover:bg-[#243656] disabled:opacity-60 rounded-lg whitespace-nowrap"
                  title="Download current sheet summary as a digitally signed A4 Landscape PDF"
                >
                  <BadgeCheck className="w-3.5 h-3.5 text-[#38BDF8]" />
                  {exportingPdf ? 'Signing PDF...' : 'Export Signed PDF'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    printWithAutoFit({
                      orientation: sheetOrientation,
                      targetSelector: '.print-only-container[data-print-active="true"]',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print {sheetOrientation === 'landscape' ? 'Landscape' : 'Portrait'} Sheet
                </button>
              </div>
            </div>

            {/* Editable OT Multipliers Bar + Real-time Birr Totals Strip */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-[#172033] dark:text-slate-200">OT Multipliers:</span>
                <label className="inline-flex items-center gap-1 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1">
                  <span className="text-slate-500">Nor</span>
                  <input
                    type="number"
                    step="0.05"
                    min="1"
                    value={otDraft.ot_regular_multiplier}
                    onChange={(e) => setOtDraft({ ...otDraft, ot_regular_multiplier: e.target.value })}
                    className="w-12 font-mono font-bold text-right bg-transparent outline-none"
                  />
                  <span className="text-slate-400">x</span>
                </label>
                <label className="inline-flex items-center gap-1 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1">
                  <span className="text-slate-500">Night</span>
                  <input
                    type="number"
                    step="0.05"
                    min="1"
                    value={otDraft.ot_night_multiplier}
                    onChange={(e) => setOtDraft({ ...otDraft, ot_night_multiplier: e.target.value })}
                    className="w-12 font-mono font-bold text-right bg-transparent outline-none"
                  />
                  <span className="text-slate-400">x</span>
                </label>
                <label className="inline-flex items-center gap-1 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1">
                  <span className="text-slate-500">Sun</span>
                  <input
                    type="number"
                    step="0.05"
                    min="1"
                    value={otDraft.ot_sunday_multiplier}
                    onChange={(e) => setOtDraft({ ...otDraft, ot_sunday_multiplier: e.target.value })}
                    className="w-12 font-mono font-bold text-right bg-transparent outline-none"
                  />
                  <span className="text-slate-400">x</span>
                </label>
                <label className="inline-flex items-center gap-1 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1">
                  <span className="text-slate-500">Holly</span>
                  <input
                    type="number"
                    step="0.05"
                    min="1"
                    value={otDraft.ot_holiday_multiplier}
                    onChange={(e) => setOtDraft({ ...otDraft, ot_holiday_multiplier: e.target.value })}
                    className="w-12 font-mono font-bold text-right bg-transparent outline-none"
                  />
                  <span className="text-slate-400">x</span>
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    setError(null);
                    setNotice(null);
                    try {
                      const savedOt = await api.put<OtSettings>('/api/ot-settings', {
                        ot_regular_multiplier: Number(otDraft.ot_regular_multiplier) || 1.5,
                        ot_night_multiplier: Number(otDraft.ot_night_multiplier) || 1.75,
                        ot_sunday_multiplier: Number(otDraft.ot_sunday_multiplier) || 2.0,
                        ot_holiday_multiplier: Number(otDraft.ot_holiday_multiplier) || 2.5,
                      });
                      setOtSettings(savedOt);
                      setNotice('Updated OT multipliers (Nor / Night / Sun / Holly).');
                      onRefreshDashboard();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to save OT multipliers');
                    }
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded whitespace-nowrap"
                >
                  Save Multipliers
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[11px]">
                <div className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg">
                  <div className="text-rose-700 dark:text-rose-300 font-semibold">Absence (-)</div>
                  <div className="font-mono font-bold text-rose-700 dark:text-rose-300 tabular-nums">
                    -{fmtNum(sheetTotals.absAmt)}
                  </div>
                </div>
                <div className="px-2.5 py-1.5 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <div className="text-slate-500">Nor ({multNormal}x)</div>
                  <div className="font-mono font-bold text-[#172033] dark:text-white tabular-nums">
                    {fmtNum(sheetTotals.otNorBirr)}
                  </div>
                </div>
                <div className="px-2.5 py-1.5 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <div className="text-slate-500">Night ({multNight}x)</div>
                  <div className="font-mono font-bold text-[#172033] dark:text-white tabular-nums">
                    {fmtNum(sheetTotals.otNightBirr)}
                  </div>
                </div>
                <div className="px-2.5 py-1.5 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <div className="text-slate-500">Sun ({multSun}x)</div>
                  <div className="font-mono font-bold text-[#172033] dark:text-white tabular-nums">
                    {fmtNum(sheetTotals.otSunBirr)}
                  </div>
                </div>
                <div className="px-2.5 py-1.5 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <div className="text-slate-500">Holly ({multHol}x)</div>
                  <div className="font-mono font-bold text-[#172033] dark:text-white tabular-nums">
                    {fmtNum(sheetTotals.otHolBirr)}
                  </div>
                </div>
                <div className="px-2.5 py-1.5 bg-[#EAF4FF] dark:bg-slate-800 border border-[#087CEB]/40 rounded-lg">
                  <div className="text-[#087CEB] font-semibold">Total Net ({currency})</div>
                  <div className="font-mono font-bold text-[#18243A] dark:text-[#38BDF8] tabular-nums">
                    {fmtNum(sheetTotals.net)}
                  </div>
                </div>
              </div>
            </div>

            {showAddSheetRow && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError(null);
                  setNotice(null);
                  try {
                    const created = await api.post<PayrollRecord>('/api/payroll/generate', {
                      ...newSheetRow,
                      standard_hours: stdHrsDivisor,
                      basic_salary: Number(newSheetRow.basic_salary) || 0,
                      absence_hours: Number(newSheetRow.absence_hours) || 0,
                      absence_rate: newSheetRow.absence_rate ? Number(newSheetRow.absence_rate) : undefined,
                      ot_normal_hours: Number(newSheetRow.ot_normal_hours) || 0,
                      ot_night_hours: Number(newSheetRow.ot_night_hours) || 0,
                      ot_sunday_hours: Number(newSheetRow.ot_sunday_hours) || 0,
                      ot_holiday_hours: Number(newSheetRow.ot_holiday_hours) || 0,
                    });
                    setPayrolls((prev) => [...prev, created]);
                    setNewSheetRow((prev) => ({
                      ...prev,
                      employee_name: '',
                      bank_account: '',
                      id_no: '',
                      absence_hours: '0',
                      absence_rate: '',
                      ot_normal_hours: '0',
                      ot_night_hours: '0',
                      ot_sunday_hours: '0',
                      ot_holiday_hours: '0',
                    }));
                    setShowAddSheetRow(false);
                    setNotice(`Added ${created.employee_name} to payroll sheet (Net ${formatMoney(created.net_salary, currency)}).`);
                    onRefreshDashboard();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to add row');
                  }
                }}
                className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs"
              >
                <input
                  type="text"
                  required
                  placeholder="Month (e.g. Meskerm 2019)"
                  value={newSheetRow.month_label}
                  onChange={(e) => setNewSheetRow({ ...newSheetRow, month_label: e.target.value })}
                  className="px-2.5 py-1.5 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                />
                <input
                  type="text"
                  required
                  placeholder="Category (FACTORY PERMANENT)"
                  value={newSheetRow.payroll_category}
                  onChange={(e) => setNewSheetRow({ ...newSheetRow, payroll_category: e.target.value })}
                  className="px-2.5 py-1.5 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                />
                <input
                  type="text"
                  required
                  placeholder="Employee Name *"
                  value={newSheetRow.employee_name}
                  onChange={(e) => setNewSheetRow({ ...newSheetRow, employee_name: e.target.value })}
                  className="px-2.5 py-1.5 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                />
                <input
                  type="text"
                  placeholder="CBE Account #"
                  value={newSheetRow.bank_account}
                  onChange={(e) => setNewSheetRow({ ...newSheetRow, bank_account: e.target.value })}
                  className="px-2.5 py-1.5 font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                />
                <input
                  type="text"
                  placeholder="ID NO"
                  value={newSheetRow.id_no}
                  onChange={(e) => setNewSheetRow({ ...newSheetRow, id_no: e.target.value })}
                  className="px-2.5 py-1.5 font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                />
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Basic Salary"
                  value={newSheetRow.basic_salary}
                  onChange={(e) => setNewSheetRow({ ...newSheetRow, basic_salary: e.target.value })}
                  className="px-2.5 py-1.5 font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                />
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="Absence Hrs"
                  value={newSheetRow.absence_hours}
                  onChange={(e) => setNewSheetRow({ ...newSheetRow, absence_hours: e.target.value })}
                  className="px-2.5 py-1.5 font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Absence Rate (auto)"
                  value={newSheetRow.absence_rate}
                  onChange={(e) => setNewSheetRow({ ...newSheetRow, absence_rate: e.target.value })}
                  className="px-2.5 py-1.5 font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                />
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="OT Nor Hrs"
                  value={newSheetRow.ot_normal_hours}
                  onChange={(e) => setNewSheetRow({ ...newSheetRow, ot_normal_hours: e.target.value })}
                  className="px-2.5 py-1.5 font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                />
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="OT Night Hrs"
                  value={newSheetRow.ot_night_hours}
                  onChange={(e) => setNewSheetRow({ ...newSheetRow, ot_night_hours: e.target.value })}
                  className="px-2.5 py-1.5 font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                />
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="OT Sun Hrs"
                  value={newSheetRow.ot_sunday_hours}
                  onChange={(e) => setNewSheetRow({ ...newSheetRow, ot_sunday_hours: e.target.value })}
                  className="px-2.5 py-1.5 font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="OT Holly Hrs"
                    value={newSheetRow.ot_holiday_hours}
                    onChange={(e) => setNewSheetRow({ ...newSheetRow, ot_holiday_hours: e.target.value })}
                    className="w-full px-2.5 py-1.5 font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-1 px-3 py-1.5 font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded whitespace-nowrap shrink-0"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
              </form>
            )}
            {mobileCardEditOpen && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-[#172033] dark:text-white">
                    Touch Payroll Editor ({sheetPayrolls.length} Staff) — Live Absence &amp; Categorized OT Calculator
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Edits sync live with the A4 print sheet below
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                  {sheetPayrolls.map((p) => {
                    const live = computeRowLive(p);
                    return (
                      <div
                        key={`card-${p.id}`}
                        className={`p-3 rounded-xl border text-xs space-y-2 ${
                          live.isDirty
                            ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                            : 'bg-[#F8FAFC] dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-[#172033] dark:text-white truncate">{live.name}</div>
                            <div className="text-[11px] font-mono text-slate-500">
                              ID {live.id_no || p.employee_code} · Basic {fmtNum(live.basic)} · Rate {fmtNum(live.rate)}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[10px] text-slate-500">NET PAY</div>
                            <div className="font-mono font-bold text-[#087CEB] tabular-nums">{fmtNum(live.net)}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 rounded-lg bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-rose-700 dark:text-rose-300">
                              <span>ABSENCE HRS</span>
                              <span>-{fmtNum(live.absAmt)} Br</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => updateRowDraft(p, { absence_hours: Math.max(0, round2(live.absHrs - 1)) })}
                                className="w-6 h-6 inline-flex items-center justify-center rounded border border-slate-300 bg-white dark:bg-slate-800"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={live.absHrs}
                                onChange={(e) => updateRowDraft(p, { absence_hours: Math.max(0, Number(e.target.value) || 0) })}
                                className="flex-1 min-w-0 px-1.5 py-1 text-center font-mono text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                              />
                              <button
                                type="button"
                                onClick={() => updateRowDraft(p, { absence_hours: round2(live.absHrs + 1) })}
                                className="w-6 h-6 inline-flex items-center justify-center rounded border border-slate-300 bg-white dark:bg-slate-800"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-slate-600 dark:text-slate-300">
                              <span>ABS RATE/HR</span>
                              <span>Tax {fmtNum(live.tax)}</span>
                            </div>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={live.absRate}
                              onChange={(e) =>
                                updateRowDraft(p, {
                                  absence_rate: Math.max(0, Number(e.target.value) || 0),
                                  absence_rate_custom: true,
                                })
                              }
                              className="w-full px-2 py-1 text-right font-mono text-xs border border-slate-300 dark:border-slate-700 rounded bg-[#F8FAFC] dark:bg-slate-800"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
                          {(
                            [
                              ['Nor', multNormal, live.otNor, live.otNorBirr, 'ot_normal_hours'],
                              ['Night', multNight, live.otNight, live.otNightBirr, 'ot_night_hours'],
                              ['Sun', multSun, live.otSun, live.otSunBirr, 'ot_sunday_hours'],
                              ['Holly', multHol, live.otHol, live.otHolBirr, 'ot_holiday_hours'],
                            ] as const
                          ).map(([label, mult, hrs, birr, field]) => (
                            <div key={field} className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                              <div className="flex justify-between font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                <span>{label} ({mult}x)</span>
                                <span className="text-[#087CEB] font-mono">{fmtNum(birr)}</span>
                              </div>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={hrs}
                                onChange={(e) => updateRowDraft(p, { [field]: Math.max(0, Number(e.target.value) || 0) })}
                                className="w-full px-1.5 py-0.5 text-center font-mono text-xs border border-slate-300 dark:border-slate-700 rounded bg-[#F8FAFC] dark:bg-slate-800"
                              />
                            </div>
                          ))}
                        </div>

                        {live.isDirty && (
                          <button
                            type="button"
                            disabled={savingRowId === p.id}
                            onClick={() => saveSingleRow(p)}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                          >
                            <Save className="w-3.5 h-3.5" />
                            {savingRowId === p.id ? 'Saving...' : 'Save Row'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Landscape/Portrait A4 Payroll Sheet (Device-Responsive & Zero-Cutoff Print) */}
          <div
            data-print-active="true"
            data-print-orientation={sheetOrientation}
            className="print-only-container w-full"
          >
            <PrintableSheetFrame
              orientation={sheetOrientation}
              onOrientationChange={setSheetOrientation}
              documentLabel="Payroll & Ethiopian Tax Sheet"
              targetSelector='.print-only-container[data-print-active="true"]'
            >
              <div
                className={`${
                  sheetOrientation === 'landscape' ? 'a4-landscape-sheet' : 'a4-sheet'
                } border border-slate-300 shadow-sm flex flex-col justify-between`}
              >
                <div>
                  {/* Institutional Header */}
                  <div className="flex items-start justify-between gap-3 pb-2.5 border-b-2 border-[#18243A]">
                    <div className="flex items-start gap-3 min-w-0">
                      <img src={logoSrc} alt="Seven Sunday Ethiopia" className="h-11 w-auto object-contain mt-0.5 shrink-0" />
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-sm font-bold text-[#172033] tracking-tight uppercase">
                          {company?.company_name || 'SEVEN SUNDAY MANUFACTURING & TRADING INDUSTRIES PLC'}
                        </div>
                        <div className="flex flex-wrap items-center gap-6 text-xs font-bold text-[#172033]">
                          <span>PAYROLL FOR THE MONTH OF</span>
                          <span className="text-[#18243A] underline underline-offset-4">{activeHeaderMonth}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-10 text-xs font-bold text-[#172033]">
                          <span>{activeHeaderCategory}</span>
                          <span className="font-mono tabular-nums">{stdHrsDivisor.toFixed(2)} hrs</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right font-mono text-[10px] text-[#172033]">
                        <div>Staff: {sheetPayrolls.length}</div>
                        <div>Net Total: {formatMoney(sheetTotals.net, currency)}</div>
                        <div>OT Rates: {multNormal}x / {multNight}x / {multSun}x / {multHol}x</div>
                      </div>
                      <RealQrCode
                        value={`SS-PAYROLL|${activeHeaderMonth}|${activeHeaderCategory}|STAFF:${sheetPayrolls.length}|NET:${sheetTotals.net.toFixed(2)}`}
                        size={56}
                      />
                    </div>
                  </div>

                  {/* Grouped Spreadsheet Table */}
                  <div className="mt-3">
                    <table className="w-full text-left border-collapse text-[10px] ss-payroll-table">
                    <thead>
                      <tr className="bg-[#F8FAFC] text-[#172033] font-bold">
                        <th colSpan={5} className="py-1 px-1.5 border border-slate-400"></th>
                        <th colSpan={3} className="py-1 px-1.5 border border-slate-400 text-center tracking-wider bg-rose-50 text-rose-900">
                          ABSENCE (- DEDUCT)
                        </th>
                        <th colSpan={5} className="py-1 px-1.5 border border-slate-400 text-center tracking-wider bg-[#EAF4FF] text-[#18243A]">
                          OVER TIME (+ HRS &amp; BIRR BY CATEGORY)
                        </th>
                        <th colSpan={7} className="py-1 px-1.5 border border-slate-400"></th>
                        <th className="no-print py-1 px-1.5 border border-slate-400"></th>
                      </tr>
                      <tr className="bg-[#FFFFFF] text-[#172033] font-bold">
                        <th className="py-2 px-1.5 border border-slate-400 text-center">NAME OF<br />EMPLOYEES</th>
                        <th className="py-2 px-1.5 border border-slate-400 text-center">Account</th>
                        <th className="py-2 px-1.5 border border-slate-400 text-center">ID NO</th>
                        <th className="py-2 px-1.5 border border-slate-400 text-center">BASIC<br />SALARY</th>
                        <th className="py-2 px-1.5 border border-slate-400 text-center">RATE</th>
                        <th className="py-2 px-1 border border-slate-400 text-center bg-rose-50/60">HOURS<br />(-/+)</th>
                        <th className="py-2 px-1 border border-slate-400 text-center bg-rose-50/60">RATE<br />(BIRR)</th>
                        <th className="py-2 px-1 border border-slate-400 text-center bg-rose-50/60">TOTAL<br />BIRR</th>
                        <th className="py-2 px-1 border border-slate-400 text-center bg-[#EAF4FF]/50">
                          Nor ({multNormal}x)<br /><span className="font-normal text-[9px]">Hrs / Birr</span>
                        </th>
                        <th className="py-2 px-1 border border-slate-400 text-center bg-[#EAF4FF]/50">
                          Night ({multNight}x)<br /><span className="font-normal text-[9px]">Hrs / Birr</span>
                        </th>
                        <th className="py-2 px-1 border border-slate-400 text-center bg-[#EAF4FF]/50">
                          SUN ({multSun}x)<br /><span className="font-normal text-[9px]">Hrs / Birr</span>
                        </th>
                        <th className="py-2 px-1 border border-slate-400 text-center bg-[#EAF4FF]/50">
                          HOLLY ({multHol}x)<br /><span className="font-normal text-[9px]">Hrs / Birr</span>
                        </th>
                        <th className="py-2 px-1 border border-slate-400 text-center bg-[#EAF4FF]/70">OT TOTAL<br />BIRR</th>
                        <th className="py-2 px-1.5 border border-slate-400 text-center">GROSS<br />PAY</th>
                        <th className="py-2 px-1.5 border border-slate-400 text-center">INCOME<br />TAX</th>
                        <th className="py-2 px-1.5 border border-slate-400 text-center">7%</th>
                        <th className="py-2 px-1.5 border border-slate-400 text-center">11%</th>
                        <th className="py-2 px-1.5 border border-slate-400 text-center">NET PAY</th>
                        <th className="py-2 px-1.5 border border-slate-400 text-center">SIGNATURE</th>
                        <th className="py-2 px-1.5 border border-slate-400 text-center">No</th>
                        <th className="no-print py-2 px-1.5 border border-slate-400 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheetPayrolls.map((p, idx) => {
                        const live = computeRowLive(p);
                        const draft = rowEdits[p.id];
                        const isEditingId = editingIdentityId === p.id;
                        const isSaving = savingRowId === p.id;

                        return (
                          <tr
                            key={`sheet-${p.id}`}
                            className={
                              live.isDirty
                                ? 'bg-amber-50/70'
                                : idx % 2 === 1
                                  ? 'bg-[#F8FAFC]'
                                  : 'bg-white'
                            }
                          >
                            <td className="ss-payroll-name py-1.5 px-1.5 border border-slate-400 font-medium whitespace-nowrap">
                              {isEditingId ? (
                                <input
                                  type="text"
                                  value={live.name}
                                  onChange={(e) => updateRowDraft(p, { employee_name: e.target.value })}
                                  className="w-28 px-1 py-0.5 border border-[#087CEB] rounded text-[10px]"
                                />
                              ) : (
                                live.name
                              )}
                            </td>
                            <td className="ss-payroll-acct py-1.5 px-1.5 border border-slate-400 font-mono whitespace-nowrap">
                              {isEditingId ? (
                                <input
                                  type="text"
                                  value={live.bank_account}
                                  onChange={(e) => updateRowDraft(p, { bank_account: e.target.value })}
                                  className="w-24 px-1 py-0.5 border border-[#087CEB] rounded font-mono text-[10px]"
                                />
                              ) : (
                                live.bank_account
                              )}
                            </td>
                            <td className="py-1.5 px-1.5 border border-slate-400 text-center font-mono">
                              {isEditingId ? (
                                <input
                                  type="text"
                                  value={live.id_no}
                                  onChange={(e) => updateRowDraft(p, { id_no: e.target.value })}
                                  className="w-10 px-1 py-0.5 border border-[#087CEB] rounded text-center font-mono text-[10px]"
                                />
                              ) : (
                                live.id_no
                              )}
                            </td>
                            <td className="py-1.5 px-1.5 border border-slate-400 text-right font-mono tabular-nums">
                              {isEditingId ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={live.basic}
                                  onChange={(e) => updateRowDraft(p, { basic_salary: Number(e.target.value) || 0 })}
                                  className="w-20 px-1 py-0.5 border border-[#087CEB] rounded text-right font-mono text-[10px]"
                                />
                              ) : (
                                fmtNum(live.basic)
                              )}
                            </td>
                            <td className="py-1.5 px-1.5 border border-slate-400 text-right font-mono tabular-nums">
                              {fmtNum(live.rate)}
                            </td>

                            {/* ABSENCE HOURS (-/+) */}
                            <td className="py-1 px-1 border border-slate-400 text-right font-mono tabular-nums bg-rose-50/20">
                              <div className="no-print flex items-center justify-end gap-0.5">
                                <button
                                  type="button"
                                  aria-label={`Decrease absence hours for ${live.name}`}
                                  onClick={() =>
                                    updateRowDraft(p, { absence_hours: Math.max(0, round2(live.absHrs - 1)) })
                                  }
                                  className="w-4 h-4 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-rose-100 text-slate-700"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={live.absHrs}
                                  onChange={(e) =>
                                    updateRowDraft(p, { absence_hours: Math.max(0, Number(e.target.value) || 0) })
                                  }
                                  className="w-11 px-0.5 py-0.5 text-right font-mono text-[10px] border border-slate-300 rounded bg-white"
                                />
                                <button
                                  type="button"
                                  aria-label={`Increase absence hours for ${live.name}`}
                                  onClick={() =>
                                    updateRowDraft(p, { absence_hours: round2(live.absHrs + 1) })
                                  }
                                  className="w-4 h-4 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-rose-100 text-slate-700"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>
                              <span className="print-only-inline">
                                {live.absHrs > 0 ? live.absHrs.toFixed(2) : '-'}
                              </span>
                            </td>

                            {/* ABSENCE RATE (-/+ & editable) */}
                            <td className="py-1 px-1 border border-slate-400 text-right font-mono tabular-nums bg-rose-50/20">
                              <div className="no-print flex items-center justify-end gap-0.5">
                                <button
                                  type="button"
                                  aria-label={`Decrease absence rate for ${live.name}`}
                                  onClick={() =>
                                    updateRowDraft(p, {
                                      absence_rate: Math.max(0, round2(live.absRate - 1)),
                                      absence_rate_custom: true,
                                    })
                                  }
                                  className="w-4 h-4 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={live.absRate}
                                  onChange={(e) =>
                                    updateRowDraft(p, {
                                      absence_rate: Math.max(0, Number(e.target.value) || 0),
                                      absence_rate_custom: true,
                                    })
                                  }
                                  className="w-12 px-0.5 py-0.5 text-right font-mono text-[10px] border border-slate-300 rounded bg-white"
                                />
                                <button
                                  type="button"
                                  aria-label={`Increase absence rate for ${live.name}`}
                                  onClick={() =>
                                    updateRowDraft(p, {
                                      absence_rate: round2(live.absRate + 1),
                                      absence_rate_custom: true,
                                    })
                                  }
                                  className="w-4 h-4 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                                {draft?.absence_rate_custom && (
                                  <button
                                    type="button"
                                    title="Reset Absence Rate to Basic/Divisor"
                                    onClick={() =>
                                      updateRowDraft(p, {
                                        absence_rate: live.rate,
                                        absence_rate_custom: false,
                                      })
                                    }
                                    className="w-4 h-4 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-blue-50 text-[#087CEB]"
                                  >
                                    <RotateCcw className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                              <span className="print-only-inline">{fmtNum(live.absRate)}</span>
                            </td>

                            {/* TOTAL ABSENCE BIRR */}
                            <td className="py-1.5 px-1 border border-slate-400 text-right font-mono font-bold tabular-nums text-rose-700 bg-rose-50/30">
                              {live.absAmt > 0 ? `-${fmtNum(live.absAmt)}` : '-'}
                            </td>

                            {/* OT NORMAL (1.5x) Hrs + Separate Birr */}
                            <td className="py-1 px-1 border border-slate-400 text-right font-mono tabular-nums">
                              <div className="no-print flex items-center justify-end gap-0.5">
                                <button
                                  type="button"
                                  aria-label={`Decrease Normal OT hours for ${live.name}`}
                                  onClick={() =>
                                    updateRowDraft(p, { ot_normal_hours: Math.max(0, round2(live.otNor - 1)) })
                                  }
                                  className="w-4 h-4 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-[#EAF4FF] text-slate-700"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={live.otNor}
                                  onChange={(e) =>
                                    updateRowDraft(p, { ot_normal_hours: Math.max(0, Number(e.target.value) || 0) })
                                  }
                                  className="w-10 px-0.5 py-0.5 text-right font-mono text-[10px] border border-slate-300 rounded bg-white"
                                />
                                <button
                                  type="button"
                                  aria-label={`Increase Normal OT hours for ${live.name}`}
                                  onClick={() =>
                                    updateRowDraft(p, { ot_normal_hours: round2(live.otNor + 1) })
                                  }
                                  className="w-4 h-4 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-[#EAF4FF] text-slate-700"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>
                              <div className="print-only-block">{live.otNor > 0 ? `${live.otNor.toFixed(1)}h` : '-'}</div>
                              <div className={`text-[9px] font-bold tabular-nums mt-0.5 ${live.otNorBirr > 0 ? 'text-[#087CEB]' : 'text-slate-400'}`}>
                                {live.otNorBirr > 0 ? `${fmtNum(live.otNorBirr)} Br` : '0.00 Br'}
                              </div>
                            </td>

                            {/* OT NIGHT (1.75x) Hrs + Separate Birr */}
                            <td className="py-1 px-1 border border-slate-400 text-right font-mono tabular-nums">
                              <div className="no-print flex items-center justify-end gap-0.5">
                                <button
                                  type="button"
                                  aria-label={`Decrease Night OT hours for ${live.name}`}
                                  onClick={() =>
                                    updateRowDraft(p, { ot_night_hours: Math.max(0, round2(live.otNight - 1)) })
                                  }
                                  className="w-4 h-4 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-[#EAF4FF] text-slate-700"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={live.otNight}
                                  onChange={(e) =>
                                    updateRowDraft(p, { ot_night_hours: Math.max(0, Number(e.target.value) || 0) })
                                  }
                                  className="w-10 px-0.5 py-0.5 text-right font-mono text-[10px] border border-slate-300 rounded bg-white"
                                />
                                <button
                                  type="button"
                                  aria-label={`Increase Night OT hours for ${live.name}`}
                                  onClick={() =>
                                    updateRowDraft(p, { ot_night_hours: round2(live.otNight + 1) })
                                  }
                                  className="w-4 h-4 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-[#EAF4FF] text-slate-700"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>
                              <div className="print-only-block">{live.otNight > 0 ? `${live.otNight.toFixed(1)}h` : '-'}</div>
                              <div className={`text-[9px] font-bold tabular-nums mt-0.5 ${live.otNightBirr > 0 ? 'text-[#18243A]' : 'text-slate-400'}`}>
                                {live.otNightBirr > 0 ? `${fmtNum(live.otNightBirr)} Br` : '0.00 Br'}
                              </div>
                            </td>

                            {/* OT SUNDAY (2.0x) Hrs + Separate Birr */}
                            <td className="py-1 px-1 border border-slate-400 text-right font-mono tabular-nums">
                              <div className="no-print flex items-center justify-end gap-0.5">
                                <button
                                  type="button"
                                  aria-label={`Decrease Sunday OT hours for ${live.name}`}
                                  onClick={() =>
                                    updateRowDraft(p, { ot_sunday_hours: Math.max(0, round2(live.otSun - 1)) })
                                  }
                                  className="w-4 h-4 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-[#EAF4FF] text-slate-700"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={live.otSun}
                                  onChange={(e) =>
                                    updateRowDraft(p, { ot_sunday_hours: Math.max(0, Number(e.target.value) || 0) })
                                  }
                                  className="w-10 px-0.5 py-0.5 text-right font-mono text-[10px] border border-slate-300 rounded bg-white"
                                />
                                <button
                                  type="button"
                                  aria-label={`Increase Sunday OT hours for ${live.name}`}
                                  onClick={() =>
                                    updateRowDraft(p, { ot_sunday_hours: round2(live.otSun + 1) })
                                  }
                                  className="w-4 h-4 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-[#EAF4FF] text-slate-700"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>
                              <div className="print-only-block">{live.otSun > 0 ? `${live.otSun.toFixed(1)}h` : '-'}</div>
                              <div className={`text-[9px] font-bold tabular-nums mt-0.5 ${live.otSunBirr > 0 ? 'text-sky-700' : 'text-slate-400'}`}>
                                {live.otSunBirr > 0 ? `${fmtNum(live.otSunBirr)} Br` : '0.00 Br'}
                              </div>
                            </td>

                            {/* OT HOLIDAY (2.5x) Hrs + Separate Birr */}
                            <td className="py-1 px-1 border border-slate-400 text-right font-mono tabular-nums">
                              <div className="no-print flex items-center justify-end gap-0.5">
                                <button
                                  type="button"
                                  aria-label={`Decrease Holiday OT hours for ${live.name}`}
                                  onClick={() =>
                                    updateRowDraft(p, { ot_holiday_hours: Math.max(0, round2(live.otHol - 1)) })
                                  }
                                  className="w-4 h-4 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-[#EAF4FF] text-slate-700"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={live.otHol}
                                  onChange={(e) =>
                                    updateRowDraft(p, { ot_holiday_hours: Math.max(0, Number(e.target.value) || 0) })
                                  }
                                  className="w-10 px-0.5 py-0.5 text-right font-mono text-[10px] border border-slate-300 rounded bg-white"
                                />
                                <button
                                  type="button"
                                  aria-label={`Increase Holiday OT hours for ${live.name}`}
                                  onClick={() =>
                                    updateRowDraft(p, { ot_holiday_hours: round2(live.otHol + 1) })
                                  }
                                  className="w-4 h-4 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-[#EAF4FF] text-slate-700"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>
                              <div className="print-only-block">{live.otHol > 0 ? `${live.otHol.toFixed(1)}h` : '-'}</div>
                              <div className={`text-[9px] font-bold tabular-nums mt-0.5 ${live.otHolBirr > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                                {live.otHolBirr > 0 ? `${fmtNum(live.otHolBirr)} Br` : '0.00 Br'}
                              </div>
                            </td>

                            {/* COMBINED OT TOTAL BIRR */}
                            <td className="py-1.5 px-1 border border-slate-400 text-right font-mono font-bold tabular-nums text-[#087CEB] bg-[#EAF4FF]/30">
                              {fmtNum(live.otAmt, true)}
                            </td>

                            <td className="py-1.5 px-1.5 border border-slate-400 text-right font-mono tabular-nums">
                              {fmtNum(live.gross)}
                            </td>
                            <td className="py-1.5 px-1.5 border border-slate-400 text-right font-mono tabular-nums">
                              {fmtNum(live.tax)}
                            </td>
                            <td className="py-1.5 px-1.5 border border-slate-400 text-right font-mono tabular-nums">
                              {fmtNum(live.empPen)}
                            </td>
                            <td className="py-1.5 px-1.5 border border-slate-400 text-right font-mono tabular-nums">
                              {fmtNum(live.erPen)}
                            </td>
                            <td className="py-1.5 px-1.5 border border-slate-400 text-right font-mono font-bold tabular-nums text-[#18243A]">
                              {fmtNum(live.net)}
                            </td>
                            <td className="py-1.5 px-2 border border-slate-400 min-w-[52px]"></td>
                            <td className="py-1.5 px-1.5 border border-slate-400 text-right font-mono">{idx + 1}</td>
                            <td className="no-print py-1 px-1.5 border border-slate-400">
                              <div className="flex items-center justify-center gap-1">
                                {live.isDirty && (
                                  <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => saveSingleRow(p)}
                                    className="p-1 text-white bg-emerald-600 hover:bg-emerald-700 rounded"
                                    title="Save Absence / OT / Salary changes"
                                  >
                                    <Save className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setEditingIdentityId(isEditingId ? null : p.id)}
                                  className={`p-1 rounded ${
                                    isEditingId ? 'bg-[#18243A] text-white' : 'text-[#18243A] bg-[#DBEAFE]'
                                  }`}
                                  title={isEditingId ? 'Done editing identity/salary' : 'Edit Name / Account / Basic Salary'}
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await api.del(`/api/payroll/${p.id}`);
                                    setPayrolls((prev) => prev.filter((x) => x.id !== p.id));
                                    onRefreshDashboard();
                                  }}
                                  className="p-1 text-red-700 bg-red-50 rounded"
                                  title="Delete Row"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-[#EAF4FF] font-bold text-[#172033]">
                        <td colSpan={3} className="py-2 px-2 border border-slate-400 uppercase">
                          TOTAL ({sheetPayrolls.length} Staff)
                        </td>
                        <td className="py-2 px-1.5 border border-slate-400 text-right font-mono tabular-nums">{fmtNum(sheetTotals.basic)}</td>
                        <td className="py-2 px-1.5 border border-slate-400 text-right font-mono tabular-nums">{fmtNum(sheetTotals.rate)}</td>
                        <td className="py-2 px-1 border border-slate-400 text-right font-mono tabular-nums">{fmtNum(sheetTotals.absHrs)}</td>
                        <td className="py-2 px-1 border border-slate-400 text-right font-mono tabular-nums">—</td>
                        <td className="py-2 px-1 border border-slate-400 text-right font-mono tabular-nums text-rose-700">
                          {sheetTotals.absAmt > 0 ? `-${fmtNum(sheetTotals.absAmt)}` : '0.00'}
                        </td>
                        <td className="py-2 px-1 border border-slate-400 text-right font-mono tabular-nums">
                          <div>{fmtNum(sheetTotals.otNor)}h</div>
                          <div className="text-[9px] text-[#087CEB]">{fmtNum(sheetTotals.otNorBirr)} Br</div>
                        </td>
                        <td className="py-2 px-1 border border-slate-400 text-right font-mono tabular-nums">
                          <div>{fmtNum(sheetTotals.otNight)}h</div>
                          <div className="text-[9px] text-[#18243A]">{fmtNum(sheetTotals.otNightBirr)} Br</div>
                        </td>
                        <td className="py-2 px-1 border border-slate-400 text-right font-mono tabular-nums">
                          <div>{fmtNum(sheetTotals.otSun)}h</div>
                          <div className="text-[9px] text-sky-700">{fmtNum(sheetTotals.otSunBirr)} Br</div>
                        </td>
                        <td className="py-2 px-1 border border-slate-400 text-right font-mono tabular-nums">
                          <div>{fmtNum(sheetTotals.otHol)}h</div>
                          <div className="text-[9px] text-emerald-700">{fmtNum(sheetTotals.otHolBirr)} Br</div>
                        </td>
                        <td className="py-2 px-1 border border-slate-400 text-right font-mono tabular-nums text-[#087CEB]">
                          {fmtNum(sheetTotals.ot)}
                        </td>
                        <td className="py-2 px-1.5 border border-slate-400 text-right font-mono tabular-nums">{fmtNum(sheetTotals.gross)}</td>
                        <td className="py-2 px-1.5 border border-slate-400 text-right font-mono tabular-nums">{fmtNum(sheetTotals.tax)}</td>
                        <td className="py-2 px-1.5 border border-slate-400 text-right font-mono tabular-nums">{fmtNum(sheetTotals.empPen)}</td>
                        <td className="py-2 px-1.5 border border-slate-400 text-right font-mono tabular-nums">{fmtNum(sheetTotals.erPen)}</td>
                        <td className="py-2 px-1.5 border border-slate-400 text-right font-mono tabular-nums">{fmtNum(sheetTotals.net)}</td>
                        <td className="py-2 px-1.5 border border-slate-400"></td>
                        <td className="py-2 px-1.5 border border-slate-400 text-right font-mono">{sheetPayrolls.length}</td>
                        <td className="no-print py-2 px-1.5 border border-slate-400"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

                <div className="mt-6 pt-4 border-t border-slate-300 flex items-end justify-between gap-6 text-[11px] text-[#172033] print-break-avoid">
                  <div className="flex flex-wrap items-end gap-12 flex-1">
                    <div>Prepared By ____________________________</div>
                    <div>Approved by ____________________________</div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    {company?.stamp_data && (
                      <img src={company.stamp_data} alt="Official Stamp" className="h-12 w-12 object-contain" />
                    )}
                    {company?.signature_data && (
                      <img src={company.signature_data} alt="Authorized Signature" className="h-10 w-20 object-contain" />
                    )}
                  </div>
                </div>
              </div>
            </PrintableSheetFrame>
          </div>
        </div>
      )}

      {/* TAB: TAX & PENSION RULES */}
      {payrollTab === 'rules' && (
        <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-[#172033] dark:text-white">
                Configurable Ethiopian Income Tax & Pension Rules
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Modify progressive monthly ETB tax brackets and statutory employee/employer pension percentages (0–2,000 Exempt · 2,001–4,000 15% · 4,001–7,000 20% · 7,001–10,000 25% · 10,001–14,000 30% · 14,001+ 35%).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const reset = await api.post<PayrollRules>('/api/payroll-rules/reset-ethiopian', {});
                    setRules(reset);
                    setBrackets(JSON.parse(reset.brackets_json));
                    setNotice('Reset payroll rules to Ethiopian 2025/2018 E.C. Schedule (7% Emp / 11% Er Pension).');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to reset payroll rules');
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded-lg whitespace-nowrap"
              >
                Reset Ethiopian 2025 Schedule
              </button>
              <button
                type="button"
                onClick={async () => {
                  setError(null);
                  setNotice(null);
                  try {
                    const updated = await api.put<PayrollRules>('/api/payroll-rules', {
                      employee_pension_rate: rules?.employee_pension_rate ?? 7,
                      employer_pension_rate: rules?.employer_pension_rate ?? 11,
                      default_bonus_rate: rules?.default_bonus_rate ?? 10,
                      brackets_json: JSON.stringify(brackets),
                    });
                    setRules(updated);
                    setNotice('Ethiopian Tax Brackets & Pension Rules saved and active.');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to save payroll rules');
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#18243A] hover:bg-[#172033] rounded-lg whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5 text-[#087CEB]" />
                Save Tax & Pension Rules
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Employee Pension (%)</label>
              <input
                type="number"
                step="0.5"
                value={rules?.employee_pension_rate ?? 7}
                onChange={(e) => setRules((prev) => (prev ? { ...prev, employee_pension_rate: Number(e.target.value) } : prev))}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Employer Pension (%)</label>
              <input
                type="number"
                step="0.5"
                value={rules?.employer_pension_rate ?? 11}
                onChange={(e) => setRules((prev) => (prev ? { ...prev, employer_pension_rate: Number(e.target.value) } : prev))}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Default Monthly Bonus (%)</label>
              <input
                type="number"
                step="0.5"
                value={rules?.default_bonus_rate ?? 10}
                onChange={(e) => setRules((prev) => (prev ? { ...prev, default_bonus_rate: Number(e.target.value) } : prev))}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 font-semibold text-slate-600 dark:text-slate-300">
                  <th className="py-2.5 px-4">Min Income (ETB)</th>
                  <th className="py-2.5 px-4">Max Income (blank = ∞)</th>
                  <th className="py-2.5 px-4">Tax Rate (%)</th>
                  <th className="py-2.5 px-4">Deduction Offset (ETB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {brackets.map((b, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-4">
                      <input
                        type="number"
                        value={b.min}
                        onChange={(e) => {
                          const next = [...brackets];
                          next[idx].min = Number(e.target.value);
                          setBrackets(next);
                        }}
                        className="w-28 px-2 py-1 font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                      />
                    </td>
                    <td className="py-2 px-4">
                      <input
                        type="number"
                        placeholder="No cap"
                        value={b.max === null ? '' : b.max}
                        onChange={(e) => {
                          const next = [...brackets];
                          next[idx].max = e.target.value === '' ? null : Number(e.target.value);
                          setBrackets(next);
                        }}
                        className="w-28 px-2 py-1 font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                      />
                    </td>
                    <td className="py-2 px-4">
                      <input
                        type="number"
                        step="0.5"
                        value={b.rate}
                        onChange={(e) => {
                          const next = [...brackets];
                          next[idx].rate = Number(e.target.value);
                          setBrackets(next);
                        }}
                        className="w-20 px-2 py-1 font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                      />
                    </td>
                    <td className="py-2 px-4">
                      <input
                        type="number"
                        step="0.5"
                        value={b.deduction}
                        onChange={(e) => {
                          const next = [...brackets];
                          next[idx].deduction = Number(e.target.value);
                          setBrackets(next);
                        }}
                        className="w-28 px-2 py-1 font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LEDGER + QR PAYSLIP PREVIEW FOR NON-SHEET / NON-ANALYTICS TABS */}
      {payrollTab !== 'sheet' && payrollTab !== 'analytics' && (
        <div className="print-grid-reset grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="no-print lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#172033] dark:text-white">Payroll Register ({payrolls.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <th className="py-3 px-4">Month / Staff</th>
                    <th className="py-3 px-4 text-right">Basic / Absence / OT</th>
                    <th className="py-3 px-4 text-right">Tax & Pension</th>
                    <th className="py-3 px-4 text-right">Net Salary</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {payrolls.map((p) => (
                    <tr key={p.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#172033] dark:text-white">{p.employee_name}</div>
                        <div className="text-xs font-mono text-slate-500">{p.month_label || p.payroll_month} · {p.employee_code}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                        <div>{formatMoney(p.basic_salary, currency)}</div>
                        <div className="text-slate-500">
                          Abs -{formatMoney(p.absence_amount, currency)} · OT +{formatMoney(p.overtime_pay, currency)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
                        <div>Tax {formatMoney(p.income_tax, currency)}</div>
                        <div>Pen {formatMoney(p.employee_pension, currency)}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-bold text-[#172033] dark:text-white tabular-nums">
                        {formatMoney(p.net_salary, currency)}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-[#18243A] dark:text-[#38BDF8]">{p.status}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPayslip(p)}
                            className="px-2.5 py-1 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded"
                          >
                            Payslip
                          </button>
                          {p.status !== 'Paid' && (
                            <button
                              type="button"
                              onClick={async () => {
                                const next = p.status === 'Draft' ? 'Approved' : 'Paid';
                                const updated = await api.patch<PayrollRecord>(`/api/payroll/${p.id}/status`, { status: next });
                                setPayrolls((prev) => prev.map((x) => (x.id === p.id ? updated : x)));
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded"
                            >
                              <Check className="w-3 h-3" />
                              {p.status === 'Draft' ? 'Approve' : 'Paid'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              await api.del(`/api/payroll/${p.id}`);
                              setPayrolls((prev) => prev.filter((x) => x.id !== p.id));
                              onRefreshDashboard();
                            }}
                            className="p-1.5 text-red-700 bg-red-50 hover:bg-red-100 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div
            data-print-active="true"
            data-print-orientation="portrait"
            className="lg:col-span-4 print-only-container bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 text-[#172033]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <img src={logoSrc} alt="Seven Sunday" className="h-8 w-auto object-contain bg-white rounded px-1" />
              <div className="no-print flex flex-wrap items-center gap-1.5">
                {selectedPayslip && (
                  <>
                    <ShareButton
                      compact
                      title={`Payslip — ${selectedPayslip.employee_name}`}
                      reference={`${selectedPayslip.payroll_month}-${selectedPayslip.employee_code}`}
                      moduleName="Payroll Payslip"
                      summary={`Employee: ${selectedPayslip.employee_name} (${selectedPayslip.employee_code})\nMonth: ${selectedPayslip.month_label || selectedPayslip.payroll_month}\nBasic: ${formatMoney(selectedPayslip.basic_salary, currency)}\nOT: +${formatMoney(selectedPayslip.overtime_pay, currency)} | Absence: -${formatMoney(selectedPayslip.absence_amount, currency)}\nNet Pay: ${formatMoney(selectedPayslip.net_salary, currency)}`}
                    />
                    <SendToApproveButton
                      compact
                      sourceModule="payroll"
                      recordRef={`${selectedPayslip.payroll_month}-${selectedPayslip.employee_code}`}
                      title={`Payslip — ${selectedPayslip.employee_name}`}
                      summary={`Net Salary: ${formatMoney(selectedPayslip.net_salary, currency)} · Dept: ${selectedPayslip.department}`}
                      fromDepartment="Human Resources"
                      defaultTargetDepartment="Finance & Accounting"
                      onDispatched={() => {
                        setNotice(`Payslip for ${selectedPayslip.employee_name} sent for approval.`);
                        onRefreshDashboard();
                      }}
                    />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => printWithAutoFit({ orientation: 'portrait' })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#18243A] rounded-lg whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5 text-[#087CEB]" />
                  Print Payslip
                </button>
              </div>
            </div>
            {selectedPayslip ? (
              <div className="mt-4 space-y-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm text-[#172033] dark:text-white">{selectedPayslip.employee_name}</div>
                    <div className="text-slate-500 font-mono">{selectedPayslip.employee_code} · {selectedPayslip.month_label || selectedPayslip.payroll_month}</div>
                    <div className="text-slate-500">{selectedPayslip.department}</div>
                  </div>
                  <RealQrCode
                    value={`SS-PAYSLIP|${selectedPayslip.payroll_month}|${selectedPayslip.employee_code}|NET:${selectedPayslip.net_salary}`}
                    size={68}
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5 font-mono tabular-nums dark:text-slate-200">
                  <div className="flex justify-between"><span>Basic Salary:</span><span>{formatMoney(selectedPayslip.basic_salary, currency)}</span></div>
                  <div className="flex justify-between text-rose-600">
                    <span>Absence ({selectedPayslip.absence_hours}h × {fmtNum(selectedPayslip.absence_rate)}):</span>
                    <span>-{formatMoney(selectedPayslip.absence_amount, currency)}</span>
                  </div>
                  <div className="flex justify-between"><span>Allowances:</span><span>{formatMoney(selectedPayslip.allowances, currency)}</span></div>
                  <div className="flex justify-between text-[#087CEB]"><span>OT Normal ({selectedPayslip.ot_normal_hours}h):</span><span>+{formatMoney(selectedPayslip.ot_normal_amount, currency)}</span></div>
                  <div className="flex justify-between text-[#087CEB]"><span>OT Night ({selectedPayslip.ot_night_hours}h):</span><span>+{formatMoney(selectedPayslip.ot_night_amount, currency)}</span></div>
                  <div className="flex justify-between text-[#087CEB]"><span>OT Sunday ({selectedPayslip.ot_sunday_hours}h):</span><span>+{formatMoney(selectedPayslip.ot_sunday_amount, currency)}</span></div>
                  <div className="flex justify-between text-[#087CEB]"><span>OT Holiday ({selectedPayslip.ot_holiday_hours}h):</span><span>+{formatMoney(selectedPayslip.ot_holiday_amount, currency)}</span></div>
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400"><span>Bonus:</span><span>{formatMoney(selectedPayslip.bonuses, currency)}</span></div>
                  <div className="flex justify-between text-red-600"><span>Income Tax:</span><span>-{formatMoney(selectedPayslip.income_tax, currency)}</span></div>
                  <div className="flex justify-between text-red-600"><span>Employee Pension:</span><span>-{formatMoney(selectedPayslip.employee_pension, currency)}</span></div>
                  <div className="flex justify-between text-slate-500"><span>Employer Pension:</span><span>{formatMoney(selectedPayslip.employer_pension, currency)}</span></div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between font-bold text-sm text-[#18243A] dark:text-[#38BDF8]">
                    <span>Net Payable:</span>
                    <span>{formatMoney(selectedPayslip.net_salary, currency)}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Status: {selectedPayslip.status}</span>
                  <div className="flex items-center gap-2">
                    {company?.stamp_data && <img src={company.stamp_data} alt="Stamp" className="h-8 w-8 object-contain" />}
                    {company?.signature_data && <img src={company.signature_data} alt="Signature" className="h-6 w-14 object-contain" />}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-8 text-center">Select a payroll row to preview payslip.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
