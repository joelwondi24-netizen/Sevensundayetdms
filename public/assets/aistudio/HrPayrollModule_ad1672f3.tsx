import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Calculator,
  Check,
  Download,
  FileSpreadsheet,
  FileUp,
  ImagePlus,
  Pencil,
  Play,
  Plus,
  Printer,
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
  PayrollRecord,
  PayrollRules,
  PayrollRun,
  OtSettings,
  TaxBracket,
} from '../types';
import { formatMoney } from '../utils/ethiopianCalendar';
import { RealQrCode } from './RealQrCode';

interface HrPayrollModuleProps {
  mode: 'hr' | 'payroll';
  currency: string;
  company?: CompanySettings | null;
  onRefreshDashboard: () => void;
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
  return Math.max(0, Number(((gross * (b.rate / 100)) - b.deduction).toFixed(2)));
}

export const HrPayrollModule: React.FC<HrPayrollModuleProps> = ({
  mode,
  currency,
  company,
  onRefreshDashboard,
}) => {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [rules, setRules] = useState<PayrollRules | null>(null);
  const [otSettings, setOtSettings] = useState<OtSettings | null>(null);
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
  const [hrPreviewMode, setHrPreviewMode] = useState<'id-card' | 'registration-sheet'>('id-card');
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecord | null>(null);
  const [payrollTab, setPayrollTab] = useState<'sheet' | 'runs' | 'individual' | 'rules'>('sheet');
  const [sheetMonth, setSheetMonth] = useState<string>('');
  const [sheetCategory, setSheetCategory] = useState<string>('ALL');
  const [standardHoursDivisor, setStandardHoursDivisor] = useState<string>('208.00');
  const [sheetOrientation, setSheetOrientation] = useState<'landscape' | 'portrait'>('landscape');

  const [editingPayRowId, setEditingPayRowId] = useState<number | null>(null);
  const [payRowDraft, setPayRowDraft] = useState({
    employee_name: '',
    bank_account: '',
    id_no: '',
    basic_salary: '0',
    absence_hours: '0',
    ot_normal_hours: '0',
    ot_night_hours: '0',
    ot_sunday_hours: '0',
    ot_holiday_hours: '0',
    allowances: '0',
    bonuses: '0',
    deductions: '0',
  });

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
    allowances: '3000',
    overtime_pay: '735',
    bonuses: '0',
    deductions: '0',
  });

  const loadData = async () => {
    try {
      const [e, p, rList, rulesRow, otRow] = await Promise.all([
        api.get<EmployeeProfile[]>('/api/employees'),
        api.get<PayrollRecord[]>('/api/payroll'),
        api.get<PayrollRun[]>('/api/payroll-runs').catch(() => []),
        api.get<PayrollRules>('/api/payroll-rules').catch(() => null),
        api.get<OtSettings>('/api/ot-settings').catch(() => null),
      ]);
      setEmployees(e);
      setPayrolls(p);
      setPayrollRuns(rList);
      if (otRow) setOtSettings(otRow);
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
      'Absence Amt',
      'OT Nor',
      'OT Night',
      'OT Sun',
      'OT Holly',
      'OT Amount',
      'Gross Pay',
      'Income Tax',
      '7% Emp Pension',
      '11% Er Pension',
      'Net Pay',
      'Status',
    ];
    const stdHrs = Math.max(1, Number(standardHoursDivisor) || 208);
    const rows = sheetPayrolls.map((p, idx) => {
      const rate = p.hourly_rate || Number((p.basic_salary / stdHrs).toFixed(2));
      const absAmt = p.absence_amount || 0;
      const gross = Number((p.basic_salary - absAmt + p.allowances + p.overtime_pay + p.bonuses).toFixed(2));
      return [
        idx + 1,
        `"${p.month_label || p.payroll_month}"`,
        `"${p.payroll_category || 'FACTORY PERMANENT'}"`,
        `"${p.employee_name}"`,
        `"${p.bank_account || empBankMap.get(p.employee_code) || ''}"`,
        `"${p.id_no || ''}"`,
        p.basic_salary.toFixed(2),
        rate.toFixed(2),
        (p.absence_hours || 0).toFixed(2),
        absAmt.toFixed(2),
        (p.ot_normal_hours || 0).toFixed(2),
        (p.ot_night_hours || 0).toFixed(2),
        (p.ot_sunday_hours || 0).toFixed(2),
        (p.ot_holiday_hours || 0).toFixed(2),
        p.overtime_pay.toFixed(2),
        gross.toFixed(2),
        p.income_tax.toFixed(2),
        p.employee_pension.toFixed(2),
        p.employer_pension.toFixed(2),
        p.net_salary.toFixed(2),
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

  const bonusPreviewTotal = useMemo(() => {
    const pct = Number(runForm.bonus_percent) || 0;
    const fixed = Number(runForm.fixed_bonus) || 0;
    const active = employees.filter((e) => e.status === 'Active');
    return active.reduce((sum, emp) => sum + fixed + emp.basic_salary * (pct / 100), 0);
  }, [employees, runForm]);

  const empBankMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees) {
      map.set(e.employee_id, e.bank_account || '');
    }
    return map;
  }, [employees]);

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
    const stdHrs = Math.max(1, Number(standardHoursDivisor) || 208);
    return sheetPayrolls.reduce(
      (acc, p) => {
        const rate = Number(p.hourly_rate) || Number((Number(p.basic_salary) / stdHrs).toFixed(2));
        const absHrs = Number(p.absence_hours) || 0;
        const absAmt = Number(p.absence_amount) || 0;
        const otNor = Number(p.ot_normal_hours) || 0;
        const otNight = Number(p.ot_night_hours) || 0;
        const otSun = Number(p.ot_sunday_hours) || 0;
        const otHol = Number(p.ot_holiday_hours) || 0;
        const gross = Number(p.basic_salary) - absAmt + Number(p.allowances) + Number(p.overtime_pay) + Number(p.bonuses);
        acc.basic += Number(p.basic_salary) || 0;
        acc.rate += rate;
        acc.absHrs += absHrs;
        acc.absAmt += absAmt;
        acc.otNor += otNor;
        acc.otNight += otNight;
        acc.otSun += otSun;
        acc.otHol += otHol;
        acc.allowances += Number(p.allowances) || 0;
        acc.ot += Number(p.overtime_pay) || 0;
        acc.bonus += Number(p.bonuses) || 0;
        acc.gross += gross;
        acc.tax += Number(p.income_tax) || 0;
        acc.empPen += Number(p.employee_pension) || 0;
        acc.erPen += Number(p.employer_pension) || 0;
        acc.ded += Number(p.deductions) || 0;
        acc.net += Number(p.net_salary) || 0;
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
        allowances: 0,
        ot: 0,
        bonus: 0,
        gross: 0,
        tax: 0,
        empPen: 0,
        erPen: 0,
        ded: 0,
        net: 0,
      }
    );
  }, [sheetPayrolls, standardHoursDivisor]);

  const logoSrc = company?.logo_data || '/assets/aistudio/Seven_Sunday_Logo_2_desktop_addf2fa7.png';

  if (mode === 'hr') {
    return (
      <div className="space-y-6">
        {/* Structured Employee Registration Format */}
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
                  setNotice(`Saved & registered ${created.full_name} (${created.employee_id}) with QR verification badge.`);
                }
                onRefreshDashboard();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to save employee');
              }
            }}
            className="space-y-5 pt-4 border-t border-slate-200 dark:border-slate-800"
          >
            {/* Section A: Personal & Identity */}
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
                    placeholder="name@sevensunday.et"
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

            {/* Section B: Employment, Bank & Emergency Contact */}
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

            {/* Section C: Education & Document Upload */}
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
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

          {/* Printable Staff QR ID Card & Registration Sheet */}
          <div className="lg:col-span-5 print-only-container bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="no-print flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1 p-1 bg-[#F8FAFC] dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setHrPreviewMode('id-card')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded ${
                    hrPreviewMode === 'id-card' ? 'bg-[#18243A] text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  QR Staff ID
                </button>
                <button
                  type="button"
                  onClick={() => setHrPreviewMode('registration-sheet')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded ${
                    hrPreviewMode === 'registration-sheet' ? 'bg-[#18243A] text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Registration Format
                </button>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#18243A] hover:bg-[#172033] rounded-lg"
              >
                <Printer className="w-3.5 h-3.5 text-[#087CEB]" />
                Print
              </button>
            </div>

            {selectedEmpCard ? (
              hrPreviewMode === 'id-card' ? (
                <div className="border-2 border-[#18243A] rounded-xl overflow-hidden bg-white text-[#172033]">
                  <div className="bg-[#18243A] text-white px-4 py-3 flex items-center justify-between">
                    <img src={logoSrc} alt="Seven Sunday" className="h-7 w-auto object-contain bg-white rounded px-1.5 py-0.5" />
                    <span className="text-[11px] font-mono font-bold text-[#087CEB]">OFFICIAL STAFF ID</span>
                  </div>
                  <div className="p-4 flex gap-4 items-start">
                    <div className="shrink-0">
                      {selectedEmpCard.photo_data ? (
                        <img
                          src={selectedEmpCard.photo_data}
                          alt={selectedEmpCard.full_name}
                          className="w-20 h-24 rounded-lg object-cover border-2 border-[#087CEB]"
                        />
                      ) : (
                        <div className="w-20 h-24 rounded-lg bg-[#18243A] text-[#38BDF8] flex items-center justify-center text-xl font-bold border-2 border-[#087CEB]">
                          {selectedEmpCard.full_name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-bold text-[#18243A] truncate">{selectedEmpCard.full_name}</div>
                      <div className="text-xs font-semibold text-[#087CEB]">{selectedEmpCard.job_title}</div>
                      <div className="mt-2 space-y-0.5 text-[11px] font-mono text-slate-600">
                        <div>ID: {selectedEmpCard.employee_id}</div>
                        <div>DEPT: {selectedEmpCard.department}</div>
                        <div>NID: {selectedEmpCard.national_id || 'N/A'}</div>
                        <div>TEL: {selectedEmpCard.phone || 'N/A'}</div>
                        <div>EMG: {selectedEmpCard.emergency_contact_phone || 'N/A'}</div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <RealQrCode
                        value={`SS-STAFF|${selectedEmpCard.employee_id}|${selectedEmpCard.full_name}|${selectedEmpCard.department}|${selectedEmpCard.national_id || 'VERIFIED'}`}
                        size={76}
                        label={selectedEmpCard.employee_id}
                      />
                    </div>
                  </div>
                  <div className="px-4 py-2.5 bg-[#F8FAFC] border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-600">
                    <div>
                      <div className="font-semibold text-[#18243A]">{company?.brand_name || 'Seven Sunday Ethiopia'}</div>
                      <div>Issued: {selectedEmpCard.start_date}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {company?.stamp_data && (
                        <img src={company.stamp_data} alt="Stamp" className="h-7 w-7 object-contain opacity-90" />
                      )}
                      {company?.signature_data && (
                        <img src={company.signature_data} alt="Signature" className="h-6 w-14 object-contain" />
                      )}
                      <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#18243A]">
                        <BadgeCheck className="w-3.5 h-3.5 text-[#087CEB]" />
                        VERIFIED
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Printable Structured Employee Registration Format Sheet */
                <div className="border border-slate-300 rounded-xl p-5 bg-white text-[#172033] space-y-4 text-xs">
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
      </div>
    );
  }

  // PAYROLL MODE
  return (
    <div className="space-y-6">
      {payrollTab === 'sheet' && (
        <style media="print">{`
          @page {
            size: A4 ${sheetOrientation};
            margin: ${sheetOrientation === 'landscape' ? '8mm' : '10mm'};
          }
        `}</style>
      )}

      <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#172033] dark:text-white">
            Ethiopian Payroll Runs, Landscape Sheet & Tax Rules
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Batch monthly payroll calculation with OT integration, Bonus %, Landscape A4 Payroll Sheet print view, and configurable Ethiopian Income Tax & Pension rates.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['sheet', 'Real Payroll Sheet (Landscape A4)', <FileSpreadsheet className="w-3.5 h-3.5" />],
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

      {/* PAYROLL TAB 1: BATCH MONTHLY PAYROLL RUNS + BONUS CALCULATION */}
      {payrollTab === 'runs' && (
        <div className="space-y-6">
          <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h3 className="text-base font-bold text-[#172033] dark:text-white mb-1">
              Calculate Monthly Payroll & Bonus Run
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Automatically aggregates all Active employees ({employees.filter((e) => e.status === 'Active').length} staff), pulls Attendance OT pay for the selected month, applies Bonus % + Fixed Bonus, and posts Ethiopian Tax ({rules?.employee_pension_rate ?? 7}% / {rules?.employer_pension_rate ?? 11}% pension).
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

      {/* PAYROLL TAB 2: INDIVIDUAL GENERATION & QR PAYSLIPS */}
      {payrollTab === 'individual' && (
        <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <h3 className="text-base font-bold text-[#172033] dark:text-white mb-4">
            Single Staff Salary & Bonus Entry
          </h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              try {
                const created = await api.post<PayrollRecord>('/api/payroll/generate', {
                  ...payForm,
                  basic_salary: Number(payForm.basic_salary),
                  allowances: Number(payForm.allowances),
                  overtime_pay: Number(payForm.overtime_pay),
                  bonuses: Number(payForm.bonuses),
                  deductions: Number(payForm.deductions),
                });
                setPayrolls((prev) => [created, ...prev]);
                setSelectedPayslip(created);
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
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Allow. / OT / Bonus</label>
              <div className="grid grid-cols-3 gap-1">
                <input
                  type="number"
                  title="Allowances"
                  value={payForm.allowances}
                  onChange={(e) => setPayForm({ ...payForm, allowances: e.target.value })}
                  className="px-2 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
                <input
                  type="number"
                  title="OT Pay"
                  value={payForm.overtime_pay}
                  onChange={(e) => setPayForm({ ...payForm, overtime_pay: e.target.value })}
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
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
              >
                <Save className="w-4 h-4" />
                Save & Generate
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PAYROLL TAB: REAL SEVEN SUNDAY PAYROLL SHEET (MATCHING EXCEL / LANDSCAPE A4 FORMAT) */}
      {payrollTab === 'sheet' && (
        <div className="space-y-4">
          <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
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
                  <span className="text-slate-500">Monthly Hrs:</span>
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
                  <Save className="w-3.5 h-3.5" />
                  Save & Approve Drafts
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print {sheetOrientation === 'landscape' ? 'Landscape' : 'Portrait'} Sheet
                </button>
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
                      standard_hours: Number(standardHoursDivisor) || 208,
                      basic_salary: Number(newSheetRow.basic_salary) || 0,
                      absence_hours: Number(newSheetRow.absence_hours) || 0,
                      ot_normal_hours: Number(newSheetRow.ot_normal_hours) || 0,
                      ot_night_hours: Number(newSheetRow.ot_night_hours) || 0,
                      ot_sunday_hours: Number(newSheetRow.ot_sunday_hours) || 0,
                      ot_holiday_hours: Number(newSheetRow.ot_holiday_hours) || 0,
                    });
                    setPayrolls((prev) => [...prev, created]);
                    setNewSheetRow((prev) => ({ ...prev, employee_name: '', bank_account: '', id_no: '' }));
                    setShowAddSheetRow(false);
                    setNotice(`Added ${created.employee_name} to payroll sheet (Net ${formatMoney(created.net_salary, currency)}).`);
                    onRefreshDashboard();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to add row');
                  }
                }}
                className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs"
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
                  placeholder="Absence Hrs"
                  value={newSheetRow.absence_hours}
                  onChange={(e) => setNewSheetRow({ ...newSheetRow, absence_hours: e.target.value })}
                  className="px-2.5 py-1.5 font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1 px-3 py-1.5 font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Row
                </button>
              </form>
            )}
          </div>

          <div className="print-only-container w-full overflow-x-auto pb-4 flex justify-center">
            <div
              className={`${
                sheetOrientation === 'landscape' ? 'a4-landscape-sheet' : 'a4-sheet'
              } border border-slate-300 shadow-sm flex flex-col justify-between`}
            >
              <div>
                {/* Exact Institutional Spreadsheet Header Matching Seven Sunday Format */}
                <div className="flex items-start justify-between pb-2.5 border-b-2 border-[#18243A]">
                  <div className="flex items-start gap-3">
                    <img src={logoSrc} alt="Seven Sunday Ethiopia" className="h-11 w-auto object-contain mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="text-sm font-bold text-[#172033] tracking-tight uppercase">
                        {company?.company_name || 'SEVEN SUNDAY MANUFACTURING & TRADING INDUSTRIES PLC'}
                      </div>
                      <div className="flex flex-wrap items-center gap-6 text-xs font-bold text-[#172033]">
                        <span>PAYROLL FOR THE MONTH OF</span>
                        <span className="text-[#18243A] underline underline-offset-4">{activeHeaderMonth}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-10 text-xs font-bold text-[#172033]">
                        <span>{activeHeaderCategory}</span>
                        <span className="font-mono tabular-nums">{Number(standardHoursDivisor || 208).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right font-mono text-[10px] text-[#172033]">
                      <div>Staff: {sheetPayrolls.length}</div>
                      <div>Net Total: {formatMoney(sheetTotals.net, currency)}</div>
                      <div>Divisor: {Number(standardHoursDivisor || 208).toFixed(2)} hrs</div>
                    </div>
                    <RealQrCode
                      value={`SS-PAYROLL|${activeHeaderMonth}|${activeHeaderCategory}|STAFF:${sheetPayrolls.length}|NET:${sheetTotals.net.toFixed(2)}`}
                      size={56}
                    />
                  </div>
                </div>

                {/* Exact Grouped Real Payroll Table */}
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[10px]">
                    <thead>
                      <tr className="bg-[#F8FAFC] text-[#172033] font-bold">
                        <th colSpan={5} className="py-1 px-1.5 border border-slate-400"></th>
                        <th colSpan={2} className="py-1 px-1.5 border border-slate-400 text-center tracking-wider">ABSENCE</th>
                        <th colSpan={5} className="py-1 px-1.5 border border-slate-400 text-center tracking-wider">OVER TIME</th>
                        <th colSpan={7} className="py-1 px-1.5 border border-slate-400"></th>
                        <th className="no-print py-1 px-1.5 border border-slate-400"></th>
                      </tr>
                      <tr className="bg-[#FFFFFF] text-[#172033] font-bold">
                        <th className="py-2 px-1.5 border border-slate-400 text-center">NAME OF<br />EMPLOYEES</th>
                        <th className="py-2 px-1.5 border border-slate-400 text-center">Account</th>
                        <th className="py-2 px-1.5 border border-slate-400 text-center">ID NO</th>
                        <th className="py-2 px-1.5 border border-slate-400 text-center">BASIC<br />SALARY</th>
                        <th className="py-2 px-1.5 border border-slate-400 text-center">RATE</th>
                        <th className="py-2 px-1 border border-slate-400 text-center">HOURS</th>
                        <th className="py-2 px-1 border border-slate-400 text-center">AMOUNT</th>
                        <th className="py-2 px-1 border border-slate-400 text-center">Nor</th>
                        <th className="py-2 px-1 border border-slate-400 text-center">night</th>
                        <th className="py-2 px-1 border border-slate-400 text-center">SUN</th>
                        <th className="py-2 px-1 border border-slate-400 text-center">HOLLY.</th>
                        <th className="py-2 px-1 border border-slate-400 text-center">AMOUNT</th>
                        <th className="py-2 px-1.5 border border-slate-400 text-center">GROSS<br />PAY</th>
                        <th className="py-2 px-1.5 border border-slate-400 text-center">INCOME<br />TAX</th>
                        <th className="py-2 px-1.5 border border-slate-400 text-center">7%</th>
                        <th className="py-2 px-1.5 border border-slate-400 text-center">11%</th>
                        <th className="py-2 px-1.5 border border-slate-400 text-center">NET PAY</th>
                        <th className="py-2 px-1.5 border border-slate-400 text-center">SIGNATURE</th>
                        <th className="py-2 px-1.5 border border-slate-400 text-center">No</th>
                        <th className="no-print py-2 px-1.5 border border-slate-400 text-center">Edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheetPayrolls.map((p, idx) => {
                        const isEditing = editingPayRowId === p.id;
                        const stdHrs = Math.max(1, Number(standardHoursDivisor) || p.standard_hours || 208);
                        const multNormal = otSettings?.ot_regular_multiplier ?? 1.5;
                        const multNight = otSettings?.ot_night_multiplier ?? 1.75;
                        const multSun = otSettings?.ot_sunday_multiplier ?? 2.0;
                        const multHol = otSettings?.ot_holiday_multiplier ?? 2.5;

                        const basic = isEditing ? Number(payRowDraft.basic_salary) || 0 : Number(p.basic_salary) || 0;
                        const rate = isEditing
                          ? Number((basic / stdHrs).toFixed(2))
                          : Number(p.hourly_rate) || Number((basic / stdHrs).toFixed(2));
                        const absHrs = isEditing ? Number(payRowDraft.absence_hours) || 0 : Number(p.absence_hours) || 0;
                        const absAmt = isEditing ? Number((rate * absHrs).toFixed(2)) : Number(p.absence_amount) || 0;
                        const otNor = isEditing ? Number(payRowDraft.ot_normal_hours) || 0 : Number(p.ot_normal_hours) || 0;
                        const otNight = isEditing ? Number(payRowDraft.ot_night_hours) || 0 : Number(p.ot_night_hours) || 0;
                        const otSun = isEditing ? Number(payRowDraft.ot_sunday_hours) || 0 : Number(p.ot_sunday_hours) || 0;
                        const otHol = isEditing ? Number(payRowDraft.ot_holiday_hours) || 0 : Number(p.ot_holiday_hours) || 0;
                        const otAmt = isEditing
                          ? Number((rate * (otNor * multNormal + otNight * multNight + otSun * multSun + otHol * multHol)).toFixed(2))
                          : Number(p.overtime_pay) || 0;
                        const gross = Math.max(0, Number((basic - absAmt + (Number(p.allowances) || 0) + otAmt + (Number(p.bonuses) || 0)).toFixed(2)));
                        const empPenRate = (rules?.employee_pension_rate ?? 7) / 100;
                        const erPenRate = (rules?.employer_pension_rate ?? 11) / 100;
                        const tax = isEditing ? calcTaxLocal(gross, brackets) : Number(p.income_tax) || 0;
                        const empPen = isEditing ? Number((basic * empPenRate).toFixed(2)) : Number(p.employee_pension) || 0;
                        const erPen = isEditing ? Number((basic * erPenRate).toFixed(2)) : Number(p.employer_pension) || 0;
                        const net = isEditing ? Number((gross - tax - empPen - (Number(p.deductions) || 0)).toFixed(2)) : Number(p.net_salary) || 0;

                        return (
                          <tr key={`sheet-${p.id}`} className={idx % 2 === 1 ? 'bg-[#F8FAFC]' : 'bg-white'}>
                            <td className="py-1.5 px-1.5 border border-slate-400 font-medium whitespace-nowrap">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={payRowDraft.employee_name}
                                  onChange={(e) => setPayRowDraft({ ...payRowDraft, employee_name: e.target.value })}
                                  className="w-28 px-1 py-0.5 border border-[#087CEB] rounded text-[10px]"
                                />
                              ) : (
                                p.employee_name
                              )}
                            </td>
                            <td className="py-1.5 px-1.5 border border-slate-400 font-mono whitespace-nowrap">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={payRowDraft.bank_account}
                                  onChange={(e) => setPayRowDraft({ ...payRowDraft, bank_account: e.target.value })}
                                  className="w-28 px-1 py-0.5 border border-[#087CEB] rounded font-mono text-[10px]"
                                />
                              ) : (
                                p.bank_account || empBankMap.get(p.employee_code) || ''
                              )}
                            </td>
                            <td className="py-1.5 px-1.5 border border-slate-400 text-center font-mono">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={payRowDraft.id_no}
                                  onChange={(e) => setPayRowDraft({ ...payRowDraft, id_no: e.target.value })}
                                  className="w-10 px-1 py-0.5 border border-[#087CEB] rounded text-center font-mono text-[10px]"
                                />
                              ) : (
                                p.id_no || ''
                              )}
                            </td>
                            <td className="py-1.5 px-1.5 border border-slate-400 text-right font-mono tabular-nums">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={payRowDraft.basic_salary}
                                  onChange={(e) => setPayRowDraft({ ...payRowDraft, basic_salary: e.target.value })}
                                  className="w-20 px-1 py-0.5 border border-[#087CEB] rounded text-right font-mono text-[10px]"
                                />
                              ) : (
                                fmtNum(basic)
                              )}
                            </td>
                            <td className="py-1.5 px-1.5 border border-slate-400 text-right font-mono tabular-nums">
                              {fmtNum(rate)}
                            </td>
                            <td className="py-1.5 px-1 border border-slate-400 text-right font-mono tabular-nums">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.5"
                                  value={payRowDraft.absence_hours}
                                  onChange={(e) => setPayRowDraft({ ...payRowDraft, absence_hours: e.target.value })}
                                  className="w-12 px-1 py-0.5 border border-[#087CEB] rounded text-right font-mono text-[10px]"
                                />
                              ) : (
                                absHrs > 0 ? absHrs.toFixed(2) : ''
                              )}
                            </td>
                            <td className="py-1.5 px-1 border border-slate-400 text-right font-mono tabular-nums">
                              {fmtNum(absAmt, true)}
                            </td>
                            <td className="py-1.5 px-1 border border-slate-400 text-right font-mono tabular-nums">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.5"
                                  value={payRowDraft.ot_normal_hours}
                                  onChange={(e) => setPayRowDraft({ ...payRowDraft, ot_normal_hours: e.target.value })}
                                  className="w-11 px-1 py-0.5 border border-[#087CEB] rounded text-right font-mono text-[10px]"
                                />
                              ) : (
                                otNor > 0 ? otNor.toFixed(2) : ''
                              )}
                            </td>
                            <td className="py-1.5 px-1 border border-slate-400 text-right font-mono tabular-nums">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.5"
                                  value={payRowDraft.ot_night_hours}
                                  onChange={(e) => setPayRowDraft({ ...payRowDraft, ot_night_hours: e.target.value })}
                                  className="w-11 px-1 py-0.5 border border-[#087CEB] rounded text-right font-mono text-[10px]"
                                />
                              ) : (
                                otNight > 0 ? otNight.toFixed(2) : ''
                              )}
                            </td>
                            <td className="py-1.5 px-1 border border-slate-400 text-right font-mono tabular-nums">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.5"
                                  value={payRowDraft.ot_sunday_hours}
                                  onChange={(e) => setPayRowDraft({ ...payRowDraft, ot_sunday_hours: e.target.value })}
                                  className="w-11 px-1 py-0.5 border border-[#087CEB] rounded text-right font-mono text-[10px]"
                                />
                              ) : (
                                otSun > 0 ? otSun.toFixed(2) : ''
                              )}
                            </td>
                            <td className="py-1.5 px-1 border border-slate-400 text-right font-mono tabular-nums">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.5"
                                  value={payRowDraft.ot_holiday_hours}
                                  onChange={(e) => setPayRowDraft({ ...payRowDraft, ot_holiday_hours: e.target.value })}
                                  className="w-11 px-1 py-0.5 border border-[#087CEB] rounded text-right font-mono text-[10px]"
                                />
                              ) : (
                                otHol > 0 ? otHol.toFixed(2) : ''
                              )}
                            </td>
                            <td className="py-1.5 px-1 border border-slate-400 text-right font-mono tabular-nums">
                              {fmtNum(otAmt, true)}
                            </td>
                            <td className="py-1.5 px-1.5 border border-slate-400 text-right font-mono tabular-nums">
                              {fmtNum(gross)}
                            </td>
                            <td className="py-1.5 px-1.5 border border-slate-400 text-right font-mono tabular-nums">
                              {fmtNum(tax)}
                            </td>
                            <td className="py-1.5 px-1.5 border border-slate-400 text-right font-mono tabular-nums">
                              {fmtNum(empPen)}
                            </td>
                            <td className="py-1.5 px-1.5 border border-slate-400 text-right font-mono tabular-nums">
                              {fmtNum(erPen)}
                            </td>
                            <td className="py-1.5 px-1.5 border border-slate-400 text-right font-mono font-bold tabular-nums text-[#18243A]">
                              {fmtNum(net)}
                            </td>
                            <td className="py-1.5 px-2 border border-slate-400 min-w-[60px]"></td>
                            <td className="py-1.5 px-1.5 border border-slate-400 text-right font-mono">{idx + 1}</td>
                            <td className="no-print py-1 px-1.5 border border-slate-400">
                              <div className="flex items-center justify-center gap-1">
                                {isEditing ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          const updated = await api.put<PayrollRecord>(`/api/payroll/${p.id}`, {
                                            employee_name: payRowDraft.employee_name,
                                            bank_account: payRowDraft.bank_account,
                                            id_no: payRowDraft.id_no,
                                            basic_salary: Number(payRowDraft.basic_salary) || 0,
                                            standard_hours: Number(standardHoursDivisor) || 208,
                                            absence_hours: Number(payRowDraft.absence_hours) || 0,
                                            ot_normal_hours: Number(payRowDraft.ot_normal_hours) || 0,
                                            ot_night_hours: Number(payRowDraft.ot_night_hours) || 0,
                                            ot_sunday_hours: Number(payRowDraft.ot_sunday_hours) || 0,
                                            ot_holiday_hours: Number(payRowDraft.ot_holiday_hours) || 0,
                                          });
                                          setPayrolls((prev) => prev.map((x) => (x.id === p.id ? updated : x)));
                                          setEditingPayRowId(null);
                                          setNotice(`Saved changes for ${updated.employee_name} (Net ${fmtNum(updated.net_salary)}).`);
                                          onRefreshDashboard();
                                        } catch (err) {
                                          setError(err instanceof Error ? err.message : 'Failed to save payroll row');
                                        }
                                      }}
                                      className="p-1 text-white bg-[#087CEB] rounded"
                                      title="Save Row"
                                    >
                                      <Save className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingPayRowId(null)}
                                      className="p-1 text-slate-600 bg-slate-100 rounded"
                                      title="Cancel"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingPayRowId(p.id);
                                        setPayRowDraft({
                                          employee_name: p.employee_name,
                                          bank_account: p.bank_account || empBankMap.get(p.employee_code) || '',
                                          id_no: p.id_no || '',
                                          basic_salary: String(p.basic_salary),
                                          absence_hours: String(p.absence_hours ?? 0),
                                          ot_normal_hours: String(p.ot_normal_hours ?? 0),
                                          ot_night_hours: String(p.ot_night_hours ?? 0),
                                          ot_sunday_hours: String(p.ot_sunday_hours ?? 0),
                                          ot_holiday_hours: String(p.ot_holiday_hours ?? 0),
                                          allowances: String(p.allowances ?? 0),
                                          bonuses: String(p.bonuses ?? 0),
                                          deductions: String(p.deductions ?? 0),
                                        });
                                      }}
                                      className="p-1 text-[#18243A] bg-[#DBEAFE] rounded"
                                      title="Edit Row"
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
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-[#EAF4FF] font-bold text-[#172033]">
                        <td colSpan={3} className="py-2 px-2 border border-slate-400 uppercase">
                          TOTAL
                        </td>
                        <td className="py-2 px-1.5 border border-slate-400 text-right font-mono tabular-nums">{fmtNum(sheetTotals.basic)}</td>
                        <td className="py-2 px-1.5 border border-slate-400 text-right font-mono tabular-nums">{fmtNum(sheetTotals.rate)}</td>
                        <td className="py-2 px-1 border border-slate-400 text-right font-mono tabular-nums">{fmtNum(sheetTotals.absHrs)}</td>
                        <td className="py-2 px-1 border border-slate-400 text-right font-mono tabular-nums">{fmtNum(sheetTotals.absAmt)}</td>
                        <td className="py-2 px-1 border border-slate-400 text-right font-mono tabular-nums">{fmtNum(sheetTotals.otNor)}</td>
                        <td className="py-2 px-1 border border-slate-400 text-right font-mono tabular-nums">{fmtNum(sheetTotals.otNight)}</td>
                        <td className="py-2 px-1 border border-slate-400 text-right font-mono tabular-nums">{fmtNum(sheetTotals.otSun)}</td>
                        <td className="py-2 px-1 border border-slate-400 text-right font-mono tabular-nums">{fmtNum(sheetTotals.otHol)}</td>
                        <td className="py-2 px-1 border border-slate-400 text-right font-mono tabular-nums">{fmtNum(sheetTotals.ot)}</td>
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
                  <div>
                    Prepared By ____________________________
                  </div>
                  <div>
                    Approved by ____________________________
                  </div>
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
          </div>
        </div>
      )}

      {/* PAYROLL TAB 3: CONFIGURABLE ETHIOPIAN TAX & PENSION RULES */}
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

      {/* Payroll Ledger + QR Payslip Preview */}
      {payrollTab !== 'sheet' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="no-print lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#172033] dark:text-white">Payroll Register ({payrolls.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <th className="py-3 px-4">Month / Staff</th>
                  <th className="py-3 px-4 text-right">Basic + Bonus + OT</th>
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
                      <div className="text-xs font-mono text-slate-500">{p.payroll_month} · {p.employee_code}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                      <div>{formatMoney(p.basic_salary, currency)}</div>
                      <div className="text-slate-500">
                        B {formatMoney(p.bonuses, currency)} · OT {formatMoney(p.overtime_pay, currency)}
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

        {/* Printable Payslip with Real QR Code + Stamp & Signature */}
        <div className="lg:col-span-4 print-only-container bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-[#172033]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <img src={logoSrc} alt="Seven Sunday" className="h-8 w-auto object-contain bg-white rounded px-1" />
            <button
              type="button"
              onClick={() => window.print()}
              className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#18243A] rounded-lg"
            >
              <Printer className="w-3.5 h-3.5 text-[#087CEB]" />
              Print Payslip
            </button>
          </div>
          {selectedPayslip ? (
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-sm text-[#172033] dark:text-white">{selectedPayslip.employee_name}</div>
                  <div className="text-slate-500 font-mono">{selectedPayslip.employee_code} · {selectedPayslip.payroll_month}</div>
                  <div className="text-slate-500">{selectedPayslip.department}</div>
                </div>
                <RealQrCode
                  value={`SS-PAYSLIP|${selectedPayslip.payroll_month}|${selectedPayslip.employee_code}|NET:${selectedPayslip.net_salary}`}
                  size={68}
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5 font-mono tabular-nums dark:text-slate-200">
                <div className="flex justify-between"><span>Basic Salary:</span><span>{formatMoney(selectedPayslip.basic_salary, currency)}</span></div>
                <div className="flex justify-between"><span>Allowances:</span><span>{formatMoney(selectedPayslip.allowances, currency)}</span></div>
                <div className="flex justify-between"><span>Overtime Pay:</span><span>{formatMoney(selectedPayslip.overtime_pay, currency)}</span></div>
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
