import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Banknote,
  Building2,
  Calculator,
  CheckCircle2,
  DollarSign,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { api } from '../api';
import type {
  CompanySettings,
  EmployeeProfile,
  PayrollRules,
  SalaryRecord,
  TaxBracket,
  UserRole,
} from '../types';
import { formatMoney } from '../utils/ethiopianCalendar';
import { printWithAutoFit } from '../utils/printFit';
import { SendToApproveButton } from './SendToApproveButton';

interface SalaryModuleProps {
  currency: string;
  company?: CompanySettings | null;
  currentUserRole?: UserRole;
  onRefreshDashboard: () => void;
}

const DEFAULT_ETH_BRACKETS: TaxBracket[] = [
  { min: 0, max: 600, rate: 0, deduction: 0 },
  { min: 601, max: 1650, rate: 10, deduction: 60 },
  { min: 1651, max: 3200, rate: 15, deduction: 142.5 },
  { min: 3201, max: 5250, rate: 20, deduction: 302.5 },
  { min: 5251, max: 7800, rate: 25, deduction: 565 },
  { min: 7801, max: 10900, rate: 30, deduction: 955 },
  { min: 10901, max: null, rate: 35, deduction: 1500 },
];

const SALARY_GRADES = [
  'Grade I - Operator',
  'Grade II - Technician',
  'Grade III - Specialist',
  'Grade IV - Supervisor',
  'Grade V - Department Head',
  'Management',
  'Executive',
];

const ADJUSTMENT_TYPES: SalaryRecord['adjustment_type'][] = [
  'Initial Salary',
  'Annual Increment',
  'Promotion',
  'Contract Adjustment',
  'Allowance Update',
];

function computeLocalTaxPreview(
  basicSalary: number,
  totalAllowances: number,
  rules: PayrollRules | null
) {
  let brackets = DEFAULT_ETH_BRACKETS;
  let empRate = 7;
  let erRate = 11;
  if (rules) {
    empRate = Number(rules.employee_pension_rate ?? 7);
    erRate = Number(rules.employer_pension_rate ?? 11);
    try {
      const parsed = JSON.parse(rules.brackets_json || '[]') as TaxBracket[];
      if (Array.isArray(parsed) && parsed.length > 0) brackets = parsed;
    } catch {
      // use defaults
    }
  }
  const gross = Math.max(0, basicSalary) + Math.max(0, totalAllowances);
  const bracket =
    brackets.find((b) => gross >= b.min && (b.max === null || gross <= b.max)) ||
    brackets[brackets.length - 1];
  const incomeTax = Math.max(0, Number(((gross * bracket.rate) / 100 - bracket.deduction).toFixed(2)));
  const empPension = Number(((basicSalary * empRate) / 100).toFixed(2));
  const erPension = Number(((basicSalary * erRate) / 100).toFixed(2));
  const net = Math.max(0, Number((gross - incomeTax - empPension).toFixed(2)));
  return {
    gross,
    incomeTax,
    empPension,
    erPension,
    net,
    hourlyRate: Number((basicSalary / 208).toFixed(2)),
    bracketRate: bracket.rate,
  };
}

export const SalaryModule: React.FC<SalaryModuleProps> = ({
  currency,
  company,
  currentUserRole,
  onRefreshDashboard,
}) => {
  const money = (v: number) => formatMoney(v || 0, currency);
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [staff, setStaff] = useState<EmployeeProfile[]>([]);
  const [payrollRules, setPayrollRules] = useState<PayrollRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'roster' | 'history'>('roster');
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Pending' | 'Approved' | 'Applied'>('ALL');
  const [targetMonth, setTargetMonth] = useState(currentMonth);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const departments = useMemo(() => {
    const base = String(company?.departments || 'Operations, HR, Secretary, Finance, Inventory, Procurement, Sales & CRM')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const staffDepts = staff.map((s) => s.department).filter(Boolean);
    return Array.from(new Set([...base, ...staffDepts]));
  }, [company?.departments, staff]);

  const [createNewStaff, setCreateNewStaff] = useState(false);
  const [form, setForm] = useState({
    employee_id: '',
    employee_name: '',
    phone: '',
    email: '',
    department: departments[0] || 'Operations',
    job_title: 'Staff',
    salary_grade: 'Grade III - Specialist',
    adjustment_type: 'Initial Salary' as SalaryRecord['adjustment_type'],
    basic_salary: '',
    housing_allowance: '0',
    transport_allowance: '0',
    position_allowance: '0',
    other_allowance: '0',
    bank_account: '',
    effective_date: new Date().toISOString().slice(0, 10),
    status: 'Approved' as 'Approved' | 'Pending',
    sync_to_payroll: true,
    notes: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [salRes, rulesRes] = await Promise.all([
        api.get<{ records: SalaryRecord[]; staff: EmployeeProfile[] }>('/api/salary'),
        api.get<PayrollRules>('/api/payroll/rules').catch(() => null),
      ]);
      setRecords(salRes.records || []);
      setStaff(salRes.staff || []);
      setPayrollRules(rulesRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load salary records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectExistingStaff = (empId: string) => {
    const emp = staff.find((s) => s.employee_id === empId);
    if (!emp) {
      setForm((prev) => ({ ...prev, employee_id: empId }));
      return;
    }
    setCreateNewStaff(false);
    setForm((prev) => ({
      ...prev,
      employee_id: emp.employee_id,
      employee_name: emp.full_name,
      department: emp.department || prev.department,
      job_title: emp.job_title || prev.job_title,
      bank_account: emp.bank_account || prev.bank_account,
      basic_salary: emp.basic_salary > 0 ? String(emp.basic_salary) : prev.basic_salary,
      adjustment_type: emp.basic_salary > 0 ? 'Annual Increment' : 'Initial Salary',
    }));
  };

  const basicNum = Math.max(0, Number(form.basic_salary) || 0);
  const totalAllowancesNum =
    Math.max(0, Number(form.housing_allowance) || 0) +
    Math.max(0, Number(form.transport_allowance) || 0) +
    Math.max(0, Number(form.position_allowance) || 0) +
    Math.max(0, Number(form.other_allowance) || 0);

  const taxPreview = useMemo(
    () => computeLocalTaxPreview(basicNum, totalAllowancesNum, payrollRules),
    [basicNum, totalAllowancesNum, payrollRules]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!createNewStaff && !form.employee_id) {
      setError('Please select an existing staff member or switch to "+ New Staff & Salary".');
      return;
    }
    if (createNewStaff && !form.employee_name.trim()) {
      setError('Staff full name is required.');
      return;
    }
    if (basicNum <= 0) {
      setError('Basic salary must be greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.post<SalaryRecord>('/api/salary', {
        create_new_staff: createNewStaff,
        employee_id: form.employee_id,
        employee_name: form.employee_name,
        phone: form.phone,
        email: form.email,
        department: form.department,
        job_title: form.job_title,
        salary_grade: form.salary_grade,
        adjustment_type: form.adjustment_type,
        basic_salary: basicNum,
        housing_allowance: Math.max(0, Number(form.housing_allowance) || 0),
        transport_allowance: Math.max(0, Number(form.transport_allowance) || 0),
        position_allowance: Math.max(0, Number(form.position_allowance) || 0),
        other_allowance: Math.max(0, Number(form.other_allowance) || 0),
        bank_account: form.bank_account,
        effective_date: form.effective_date,
        status: form.status,
        sync_to_payroll: form.sync_to_payroll,
        payroll_month: targetMonth,
        notes: form.notes,
      });
      setNotice(
        `Saved ${created.salary_code} for ${created.employee_name} — Basic: ${money(created.basic_salary)}, Net: ${money(created.net_salary)}.`
      );
      setForm((prev) => ({
        ...prev,
        employee_id: '',
        employee_name: '',
        phone: '',
        email: '',
        basic_salary: '',
        housing_allowance: '0',
        transport_allowance: '0',
        position_allowance: '0',
        other_allowance: '0',
        bank_account: '',
        notes: '',
      }));
      setCreateNewStaff(false);
      await loadData();
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save staff salary');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveStatus = async (rec: SalaryRecord, status: 'Approved' | 'Applied') => {
    setError(null);
    setNotice(null);
    try {
      await api.patch(`/api/salary/${rec.id}/status`, { status });
      setNotice(`Updated ${rec.salary_code} (${rec.employee_name}) status to ${status}.`);
      await loadData();
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handlePushToPayroll = async (rec: SalaryRecord) => {
    setError(null);
    setNotice(null);
    try {
      await api.post(`/api/salary/${rec.id}/push-payroll`, { payroll_month: targetMonth });
      setNotice(`Synced ${rec.employee_name}'s salary (${money(rec.basic_salary)}) into ${targetMonth} Payroll Sheet.`);
      await loadData();
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push salary to payroll');
    }
  };

  const handleDeleteRecord = async (id: number) => {
    setError(null);
    try {
      await api.del(`/api/salary/${id}`);
      setConfirmDeleteId(null);
      setNotice('Salary assignment entry deleted.');
      await loadData();
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete salary record');
    }
  };

  const kpis = useMemo(() => {
    const totalMonthlyBasic = staff.reduce((s, e) => s + (Number(e.basic_salary) || 0), 0);
    const assignedStaffCount = staff.filter((e) => Number(e.basic_salary) > 0).length;
    const pendingApprovals = records.filter((r) => r.status === 'Pending').length;
    const avgBasic = assignedStaffCount > 0 ? totalMonthlyBasic / assignedStaffCount : 0;
    return { totalMonthlyBasic, assignedStaffCount, pendingApprovals, avgBasic };
  }, [staff, records]);

  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return staff.filter((s) => {
      if (deptFilter !== 'ALL' && s.department !== deptFilter) return false;
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.employee_id.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q) ||
        s.job_title.toLowerCase().includes(q)
      );
    });
  }, [staff, deptFilter, searchQuery]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (deptFilter !== 'ALL' && r.department !== deptFilter) return false;
      if (!q) return true;
      return (
        r.employee_name.toLowerCase().includes(q) ||
        r.employee_id.toLowerCase().includes(q) ||
        r.salary_code.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q)
      );
    });
  }, [records, statusFilter, deptFilter, searchQuery]);

  const canManage =
    !currentUserRole ||
    [
      'System Administrator',
      'Super Administrator',
      'Company Owner',
      'General Manager',
      'Human Resource Manager',
      'Finance Manager',
      'Accountant',
    ].includes(currentUserRole);

  return (
    <div className="space-y-6">
      {/* KPI Overview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Monthly Basic Salary Base</span>
            <Banknote className="w-4 h-4 text-[#087CEB]" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-[#172033] dark:text-white mt-1.5">
            {money(kpis.totalMonthlyBasic)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Across {staff.length} active staff profiles
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Staff With Assigned Salary</span>
            <Users className="w-4 h-4 text-[#087CEB]" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-[#172033] dark:text-white mt-1.5">
            {kpis.assignedStaffCount} / {staff.length}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {staff.length - kpis.assignedStaffCount} awaiting salary assignment
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Average Staff Basic</span>
            <Calculator className="w-4 h-4 text-[#087CEB]" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-[#172033] dark:text-white mt-1.5">
            {money(kpis.avgBasic)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            208 hrs/month standard divisor
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Salary Revisions & Pending</span>
            <Wallet className="w-4 h-4 text-[#087CEB]" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-[#172033] dark:text-white mt-1.5">
            {records.length} entries ({kpis.pendingApprovals} pending)
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Auto-syncs HR & Monthly Payroll Sheet
          </div>
        </div>
      </div>

      {/* Add / Assign Staff Salary Form */}
      {canManage && (
        <form
          onSubmit={handleSubmit}
          className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#EAF4FF] dark:bg-slate-800 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-[#087CEB]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#172033] dark:text-white">
                  Add & Assign Staff Salary
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Set basic salary, housing/transport/position allowances, Ethiopian Tax & 7%/11% Pension, and sync directly to Payroll.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setCreateNewStaff(false)}
                className={`px-3 py-1.5 font-semibold rounded transition-colors ${
                  !createNewStaff ? 'bg-[#18243A] text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Existing Staff ({staff.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateNewStaff(true);
                  setForm((prev) => ({
                    ...prev,
                    employee_id: '',
                    employee_name: '',
                    adjustment_type: 'Initial Salary',
                  }));
                }}
                className={`inline-flex items-center gap-1 px-3 py-1.5 font-semibold rounded transition-colors ${
                  createNewStaff ? 'bg-[#087CEB] text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                New Staff & Salary
              </button>
            </div>
          </div>

          {error && (
            <div className="px-4 py-2.5 text-xs font-medium text-red-700 bg-red-50 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg">
              {error}
            </div>
          )}
          {notice && (
            <div className="px-4 py-2.5 text-xs font-medium text-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg">
              {notice}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Form Inputs (8 cols) */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {!createNewStaff ? (
                <div className="sm:col-span-2 lg:col-span-2">
                  <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                    Select Registered Staff *
                  </label>
                  <select
                    required
                    value={form.employee_id}
                    onChange={(e) => handleSelectExistingStaff(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="">-- Choose Staff Member --</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.employee_id}>
                        {s.full_name} ({s.employee_id}) — {s.department} · Current: {money(s.basic_salary)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                      Staff Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Full Name"
                      value={form.employee_name}
                      onChange={(e) => setForm({ ...form, employee_name: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                      Staff ID (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Auto-generated if blank"
                      value={form.employee_id}
                      onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                      className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                  Department
                </label>
                <select
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {createNewStaff && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                      Job Title
                    </label>
                    <input
                      type="text"
                      value={form.job_title}
                      onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="+251 9..."
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                      Corporate Email
                    </label>
                    <input
                      type="email"
                      placeholder="user@sevensundayethiopia.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                  Basic Salary ({currency}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="0.00"
                  value={form.basic_salary}
                  onChange={(e) => setForm({ ...form, basic_salary: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono font-bold bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                  Housing Allowance
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.housing_allowance}
                  onChange={(e) => setForm({ ...form, housing_allowance: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                  Transport Allowance
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.transport_allowance}
                  onChange={(e) => setForm({ ...form, transport_allowance: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                  Position Allowance
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.position_allowance}
                  onChange={(e) => setForm({ ...form, position_allowance: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                  Other Allowance
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.other_allowance}
                  onChange={(e) => setForm({ ...form, other_allowance: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                  Salary Grade
                </label>
                <select
                  value={form.salary_grade}
                  onChange={(e) => setForm({ ...form, salary_grade: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  {SALARY_GRADES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                  Adjustment Type
                </label>
                <select
                  value={form.adjustment_type}
                  onChange={(e) =>
                    setForm({ ...form, adjustment_type: e.target.value as SalaryRecord['adjustment_type'] })
                  }
                  className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  {ADJUSTMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                  Bank Account (CBE / Private)
                </label>
                <input
                  type="text"
                  placeholder="1000..."
                  value={form.bank_account}
                  onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                  Effective Date
                </label>
                <input
                  type="date"
                  value={form.effective_date}
                  onChange={(e) => setForm({ ...form, effective_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                  Workflow Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as 'Approved' | 'Pending' })}
                  className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="Approved">Approved (Apply Now)</option>
                  <option value="Pending">Pending Approval</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                  Authorization Notes
                </label>
                <input
                  type="text"
                  placeholder="Contract ref, promotion memo, or salary review note"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center justify-between gap-3 pt-2">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#172033] dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.sync_to_payroll}
                    onChange={(e) => setForm({ ...form, sync_to_payroll: e.target.checked })}
                    className="w-4 h-4 accent-[#087CEB]"
                  />
                  <span>Sync immediately to Monthly Payroll Sheet for</span>
                  <input
                    type="month"
                    value={targetMonth}
                    onChange={(e) => setTargetMonth(e.target.value)}
                    className="px-2 py-1 text-xs font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                  />
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-60 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {submitting ? 'Saving Salary...' : 'Save & Assign Staff Salary'}
                </button>
              </div>
            </div>

            {/* Right Live Ethiopian Statutory Calculator Preview (4 cols) */}
            <div className="lg:col-span-4 bg-[#F8FAFC] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="text-xs font-bold text-[#172033] dark:text-white flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-[#087CEB]" />
                  Ethiopian Tax & Pension Preview
                </span>
                <span className="text-[11px] font-mono text-[#087CEB] font-bold">
                  Bracket {taxPreview.bracketRate}%
                </span>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-700 text-xs">
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Basic Salary</span>
                  <span className="font-mono font-semibold tabular-nums">{money(basicNum)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Total Allowances</span>
                  <span className="font-mono font-semibold tabular-nums">+{money(totalAllowancesNum)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="font-semibold text-[#172033] dark:text-white">Gross Monthly Pay</span>
                  <span className="font-mono font-bold tabular-nums">{money(taxPreview.gross)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Hourly Rate (÷208h)</span>
                  <span className="font-mono tabular-nums">{money(taxPreview.hourlyRate)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-rose-600 dark:text-rose-400">Ethiopian Income Tax</span>
                  <span className="font-mono font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                    -{money(taxPreview.incomeTax)}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-rose-600 dark:text-rose-400">
                    Employee Pension ({payrollRules?.employee_pension_rate ?? 7}%)
                  </span>
                  <span className="font-mono font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                    -{money(taxPreview.empPension)}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">
                    Employer Pension ({payrollRules?.employer_pension_rate ?? 11}%)
                  </span>
                  <span className="font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                    {money(taxPreview.erPension)}
                  </span>
                </div>
                <div className="pt-2.5 flex justify-between items-center">
                  <span className="font-bold text-sm text-[#172033] dark:text-white">Estimated Net Take-Home</span>
                  <span className="font-mono font-extrabold text-base text-[#087CEB] tabular-nums">
                    {money(taxPreview.net)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Filter Toolbar & Tab Switcher */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('roster')}
              className={`px-3 py-1.5 font-semibold rounded transition-colors ${
                activeTab === 'roster' ? 'bg-[#18243A] text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Staff Salary Roster ({filteredStaff.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 font-semibold rounded transition-colors ${
                activeTab === 'history' ? 'bg-[#18243A] text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Salary Assignment & Revision Ledger ({filteredRecords.length})
            </button>
          </div>

          <div className="no-print flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search staff name, ID, code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            {activeTab === 'history' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="px-2.5 py-1.5 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <option value="ALL">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Applied">Applied to Payroll</option>
              </select>
            )}

            <button
              type="button"
              onClick={() => printWithAutoFit({ orientation: 'landscape' })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#18243A] hover:bg-[#172033] rounded-lg"
            >
              <Printer className="w-3.5 h-3.5 text-[#38BDF8]" />
              Print A4 Landscape
            </button>

            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* STAFF SALARY ROSTER TABLE */}
        {activeTab === 'roster' && (
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#18243A] text-white font-semibold">
                  <th className="py-2.5 px-3">Staff ID</th>
                  <th className="py-2.5 px-3">Full Name</th>
                  <th className="py-2.5 px-3">Department & Title</th>
                  <th className="py-2.5 px-3">Bank Account</th>
                  <th className="py-2.5 px-3 text-right">Current Basic Salary</th>
                  <th className="py-2.5 px-3 text-right">Hourly Rate</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right no-print">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No staff profiles found. Add a staff member & salary above or register staff under HR & Staff IDs.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((s) => (
                    <tr key={s.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#18243A] dark:text-[#38BDF8]">
                        {s.employee_id}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[#172033] dark:text-white">
                        {s.full_name}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          {s.department}
                        </div>
                        <div className="text-[11px] text-slate-500">{s.job_title}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                        {s.bank_account || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-[#172033] dark:text-white">
                        {s.basic_salary > 0 ? money(s.basic_salary) : <span className="text-amber-600">Not Assigned</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500">
                        {s.basic_salary > 0 ? money(s.basic_salary / 208) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold">
                        <span className={s.status === 'Active' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-600'}>
                          {s.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right no-print">
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectExistingStaff(s.employee_id);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            {s.basic_salary > 0 ? 'Adjust Salary' : 'Add Salary'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SALARY ASSIGNMENT & REVISION LEDGER */}
        {activeTab === 'history' && (
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#18243A] text-white font-semibold">
                  <th className="py-2.5 px-3">Code & Date</th>
                  <th className="py-2.5 px-3">Staff Member</th>
                  <th className="py-2.5 px-3">Type / Grade</th>
                  <th className="py-2.5 px-3 text-right">Prev → New Basic</th>
                  <th className="py-2.5 px-3 text-right">Allowances</th>
                  <th className="py-2.5 px-3 text-right">Gross</th>
                  <th className="py-2.5 px-3 text-right">Tax + 7% Pen</th>
                  <th className="py-2.5 px-3 text-right">Net Pay</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right no-print">Workflow & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      No salary assignments recorded yet. Use the form above to add or adjust a staff member's salary.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec) => {
                    const totalAllow =
                      Number(rec.housing_allowance || 0) +
                      Number(rec.transport_allowance || 0) +
                      Number(rec.position_allowance || 0) +
                      Number(rec.other_allowance || 0);
                    return (
                      <tr key={rec.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono">
                          <div className="font-bold text-[#18243A] dark:text-[#38BDF8]">{rec.salary_code}</div>
                          <div className="text-[11px] text-slate-500">{rec.effective_date}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-[#172033] dark:text-white">{rec.employee_name}</div>
                          <div className="text-[11px] text-slate-500">
                            {rec.employee_id} · {rec.department}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-700 dark:text-slate-200">{rec.adjustment_type}</div>
                          <div className="text-[11px] text-slate-500">{rec.salary_grade}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {rec.previous_salary > 0 && (
                            <span className="text-slate-400 line-through mr-1">
                              {Number(rec.previous_salary).toLocaleString()}
                            </span>
                          )}
                          {rec.previous_salary > 0 && <ArrowRight className="w-3 h-3 inline text-[#087CEB] mr-1" />}
                          <span className="font-bold text-[#172033] dark:text-white">
                            {money(rec.basic_salary)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          +{money(totalAllow)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums">
                          {money(rec.gross_salary)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">
                          -{money(Number(rec.income_tax || 0) + Number(rec.employee_pension || 0))}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-[#087CEB]">
                          {money(rec.net_salary)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          <span
                            className={
                              rec.status === 'Applied'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : rec.status === 'Approved'
                                  ? 'text-[#087CEB]'
                                  : 'text-amber-600 dark:text-amber-400'
                            }
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right no-print">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {canManage && rec.status === 'Pending' && (
                              <button
                                type="button"
                                onClick={() => handleApproveStatus(rec, 'Approved')}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Approve
                              </button>
                            )}
                            {canManage && rec.status !== 'Pending' && (
                              <button
                                type="button"
                                onClick={() => handlePushToPayroll(rec)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white bg-[#18243A] hover:bg-[#172033] rounded"
                                title={`Push salary into ${targetMonth} Payroll Sheet`}
                              >
                                <Send className="w-3 h-3 text-[#38BDF8]" />
                                Sync Payroll ({targetMonth})
                              </button>
                            )}
                            <SendToApproveButton
                              sourceModule="salary"
                              recordRef={rec.salary_code}
                              title={`Salary Authorization: ${rec.employee_name} (${rec.salary_code})`}
                              summary={`${rec.adjustment_type} · Basic ${money(rec.basic_salary)} · Gross ${money(rec.gross_salary)} · Net ${money(rec.net_salary)}`}
                              fromDepartment={rec.department}
                              defaultTargetDepartment="Finance & Accounting"
                              compact
                              onDispatched={onRefreshDashboard}
                            />
                            {canManage && (
                              confirmDeleteId === rec.id ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRecord(rec.id)}
                                  className="px-2 py-1 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 rounded"
                                >
                                  Confirm
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(rec.id)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  title="Delete salary entry"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
