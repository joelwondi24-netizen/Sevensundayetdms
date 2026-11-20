import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CalendarClock,
  Clock,
  Download,
  FileSpreadsheet,
  Package,
  Printer,
  Shield,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { api } from '../api';
import type {
  AttendanceRecord,
  CompanySettings,
  CrmDeal,
  DepartmentRecord,
  EmployeeProfile,
  HolidayRecord,
  InventoryMovementRecord,
  LedgerAccount,
  MaterialItem,
  PayrollRecord,
  SalesOrder,
  ShiftDefinition,
  StaffScheduleRecord,
} from '../types';
import { formatMoney } from '../utils/ethiopianCalendar';
import { printWithAutoFit } from '../utils/printFit';
import { ImportFilesButton } from './ImportFilesModal';
import { RealQrCode } from './RealQrCode';

interface ReportsModuleProps {
  company?: CompanySettings | null;
  currency: string;
}

type ReportKey =
  | 'employees'
  | 'inventory'
  | 'attendance'
  | 'shift-sessions'
  | 'lateness-absence'
  | 'overtime-detail'
  | 'dept-attendance'
  | 'security-duty'
  | 'weekend-holiday'
  | 'shift-performance'
  | 'payroll'
  | 'movements'
  | 'sales'
  | 'trial';

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escape = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({ company, currency }) => {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [schedules, setSchedules] = useState<StaffScheduleRecord[]>([]);
  const [shifts, setShifts] = useState<ShiftDefinition[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [holidays, setHolidays] = useState<HolidayRecord[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [movements, setMovements] = useState<InventoryMovementRecord[]>([]);
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [activeReport, setActiveReport] = useState<ReportKey>('attendance');
  const [deptFilter, setDeptFilter] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<string>('');

  const loadAllReports = () => {
    Promise.all([
      api.get<EmployeeProfile[]>('/api/employees').catch(() => []),
      api.get<MaterialItem[]>('/api/materials').catch(() => []),
      api.get<AttendanceRecord[]>('/api/attendance').catch(() => []),
      api.get<StaffScheduleRecord[]>('/api/scheduling').catch(() => []),
      api.get<ShiftDefinition[]>('/api/shifts').catch(() => []),
      api.get<DepartmentRecord[]>('/api/departments').catch(() => []),
      api.get<HolidayRecord[]>('/api/holidays').catch(() => []),
      api.get<PayrollRecord[]>('/api/payroll').catch(() => []),
      api.get<InventoryMovementRecord[]>('/api/inventory-movements').catch(() => []),
      api.get<CrmDeal[]>('/api/crm').catch(() => []),
      api.get<SalesOrder[]>('/api/sales-orders').catch(() => []),
      api.get<LedgerAccount[]>('/api/accounts').catch(() => []),
    ]).then(([e, m, att, sch, sh, dep, hol, p, mv, d, so, acc]) => {
      setEmployees(e);
      setMaterials(m);
      setAttendance(att);
      setSchedules(sch);
      setShifts(sh);
      setDepartments(dep);
      setHolidays(hol);
      setPayrolls(p);
      setMovements(mv);
      setDeals(d);
      setSalesOrders(so);
      setAccounts(acc);
    });
  };

  useEffect(() => {
    loadAllReports();
  }, []);

  const deptNames = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => e.department && set.add(e.department));
    departments.forEach((d) => d.name && set.add(d.name));
    attendance.forEach((a) => a.department && set.add(a.department));
    return ['All', ...Array.from(set).sort()];
  }, [employees, departments, attendance]);

  const filteredAttendance = useMemo(() => {
    return attendance.filter((a) => {
      if (deptFilter !== 'All' && a.department !== deptFilter) return false;
      if (dateFilter && !a.attendance_date.startsWith(dateFilter)) return false;
      return true;
    });
  }, [attendance, deptFilter, dateFilter]);

  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      if (deptFilter !== 'All' && s.department !== deptFilter) return false;
      if (dateFilter && !s.schedule_date.startsWith(dateFilter)) return false;
      return true;
    });
  }, [schedules, deptFilter, dateFilter]);

  const latenessAbsenceRows = useMemo(
    () =>
      filteredAttendance.filter(
        (a) =>
          (a.late_minutes || 0) > 0 ||
          (a.early_departure_minutes || 0) > 0 ||
          (a.absence_hours || 0) > 0 ||
          a.status === 'Absent' ||
          a.status === 'On Leave' ||
          a.status.includes('Late') ||
          a.status.includes('Early')
      ),
    [filteredAttendance]
  );

  const overtimeRows = useMemo(
    () => filteredAttendance.filter((a) => Number(a.ot_hours || 0) > 0 || Number(a.ot_pay || 0) > 0),
    [filteredAttendance]
  );

  const securityDutyRows = useMemo(() => {
    const matched = filteredSchedules.filter(
      (s) =>
        s.department.toLowerCase().includes('security') ||
        s.shift_name.toLowerCase().includes('security') ||
        s.shift_name.toLowerCase().includes('guard')
    );
    return matched.length > 0 ? matched : filteredSchedules;
  }, [filteredSchedules]);

  const holidayDateSet = useMemo(() => new Set(holidays.map((h) => h.holiday_date)), [holidays]);

  const weekendHolidayRows = useMemo(() => {
    return filteredAttendance.filter((a) => {
      const d = new Date(`${a.attendance_date}T00:00:00`).getDay();
      return d === 0 || d === 6 || holidayDateSet.has(a.attendance_date) || a.ot_type === 'Sunday' || a.ot_type === 'Holiday';
    });
  }, [filteredAttendance, holidayDateSet]);

  const deptAttendanceStats = useMemo(() => {
    const names = deptNames.filter((n) => n !== 'All');
    return names.map((name) => {
      const deptObj = departments.find((d) => d.name === name);
      const staffCount = employees.filter((e) => e.department === name && e.status === 'Active').length;
      const logs = filteredAttendance.filter((a) => a.department === name);
      const present = logs.filter((a) => a.status !== 'Absent' && a.status !== 'On Leave').length;
      const late = logs.filter((a) => (a.late_minutes || 0) > 0).length;
      const absent = logs.filter((a) => a.status === 'Absent').length;
      const otHrs = logs.reduce((s, a) => s + Number(a.ot_hours || 0), 0);
      const rate = logs.length > 0 ? Math.round((present / logs.length) * 100) : 100;
      return { name, manager: deptObj?.manager_name || '—', staffCount, logs: logs.length, present, late, absent, otHrs, rate };
    });
  }, [deptNames, departments, employees, filteredAttendance]);

  const shiftPerfStats = useMemo(() => {
    const names = Array.from(new Set([...shifts.map((s) => s.shift_name), ...filteredAttendance.map((a) => a.shift_name)]));
    return names.map((sName) => {
      const logs = filteredAttendance.filter((a) => a.shift_name === sName);
      const onTime = logs.filter((a) => (a.late_minutes || 0) === 0 && a.status !== 'Absent').length;
      const late = logs.filter((a) => (a.late_minutes || 0) > 0).length;
      const absHrs = logs.reduce((s, a) => s + Number(a.absence_hours || 0), 0);
      const otHrs = logs.reduce((s, a) => s + Number(a.ot_hours || 0), 0);
      const punctuality = logs.length > 0 ? Math.round((onTime / logs.length) * 100) : 100;
      return { sName, totalLogs: logs.length, onTime, late, absHrs, otHrs, punctuality };
    });
  }, [shifts, filteredAttendance]);

  const inventoryTotal = materials.reduce((s, m) => s + m.stock_qty * m.unit_cost, 0);

  const exportReport = (key: ReportKey) => {
    const today = new Date().toISOString().slice(0, 10);
    if (key === 'employees') {
      downloadCsv(
        `employee-master-directory-${today}.csv`,
        ['Employee ID', 'Full Name', 'National ID', 'Phone', 'Department', 'Job Title', 'Bank Account', 'Basic Salary', 'Status'],
        employees.map((e) => [e.employee_id, e.full_name, e.national_id, e.phone, e.department, e.job_title, e.bank_account, e.basic_salary, e.status])
      );
    } else if (key === 'inventory') {
      downloadCsv(
        `inventory-valuation-${today}.csv`,
        ['SKU', 'Material Name', 'Category', 'Location', 'Stock Qty', 'Unit', 'Unit Cost', 'Total Valuation'],
        materials.map((m) => [m.sku, m.name, m.category, m.location, m.stock_qty, m.unit, m.unit_cost, (m.stock_qty * m.unit_cost).toFixed(2)])
      );
    } else if (key === 'attendance') {
      downloadCsv(
        `daily-weekly-monthly-attendance-${today}.csv`,
        ['Employee Code', 'Employee Name', 'Department', 'Date', 'Shift', 'Check In', 'Check Out', 'Reg Hours', 'Late (Min)', 'Absence (Hrs)', 'OT Type', 'OT Hours', 'OT Pay', 'Status', 'Register State'],
        filteredAttendance.map((a) => [a.employee_code, a.employee_name, a.department, a.attendance_date, a.shift_name, a.check_in, a.check_out, a.regular_hours, a.late_minutes || 0, a.absence_hours || 0, a.ot_type, a.ot_hours, a.ot_pay, a.status, a.register_state])
      );
    } else if (key === 'shift-sessions') {
      downloadCsv(
        `morning-afternoon-night-shifts-${today}.csv`,
        ['Date', 'Code', 'Employee', 'Department', 'Morning In', 'Morning Out', 'Afternoon In', 'Afternoon Out', 'Night In', 'Night Out', 'Status'],
        filteredAttendance.map((a) => [a.attendance_date, a.employee_code, a.employee_name, a.department, a.morning_check_in || '—', a.morning_check_out || '—', a.afternoon_check_in || '—', a.afternoon_check_out || '—', a.night_check_in || '—', a.night_check_out || '—', a.status])
      );
    } else if (key === 'lateness-absence') {
      downloadCsv(
        `employee-lateness-absence-${today}.csv`,
        ['Date', 'Code', 'Employee', 'Department', 'Shift', 'Scheduled Start', 'Actual Check-In', 'Late (Min)', 'Early Exit (Min)', 'Absence (Hrs)', 'Status'],
        latenessAbsenceRows.map((a) => [a.attendance_date, a.employee_code, a.employee_name, a.department, a.shift_name, a.scheduled_start || '08:00', a.check_in, a.late_minutes || 0, a.early_departure_minutes || 0, a.absence_hours || 0, a.status])
      );
    } else if (key === 'overtime-detail') {
      downloadCsv(
        `overtime-hours-report-${today}.csv`,
        ['Date', 'Code', 'Employee', 'Department', 'OT Type', 'Multiplier', 'OT Hours', 'OT Pay'],
        overtimeRows.map((a) => [a.attendance_date, a.employee_code, a.employee_name, a.department, a.ot_type, `${a.ot_multiplier}x`, a.ot_hours, a.ot_pay])
      );
    } else if (key === 'dept-attendance') {
      downloadCsv(
        `department-attendance-summary-${today}.csv`,
        ['Department', 'Manager', 'Active Staff', 'Logs', 'Present', 'Late', 'Absent', 'OT Hours', 'Attendance Rate %'],
        deptAttendanceStats.map((d) => [d.name, d.manager, d.staffCount, d.logs, d.present, d.late, d.absent, d.otHrs.toFixed(1), `${d.rate}%`])
      );
    } else if (key === 'security-duty') {
      downloadCsv(
        `security-guard-duty-schedules-${today}.csv`,
        ['Date', 'Employee Code', 'Guard / Staff Name', 'Department', 'Shift', 'Time', 'Approval', 'Availability'],
        securityDutyRows.map((s) => [s.schedule_date, s.employee_id, s.employee_name, s.department, s.shift_name, `${s.start_time}-${s.end_time}`, s.approval_status, s.availability_status])
      );
    } else if (key === 'weekend-holiday') {
      downloadCsv(
        `weekend-holiday-attendance-${today}.csv`,
        ['Date', 'Code', 'Employee', 'Department', 'OT Type', 'Hours', 'OT Pay', 'Status'],
        weekendHolidayRows.map((a) => [a.attendance_date, a.employee_code, a.employee_name, a.department, a.ot_type, a.regular_hours + a.ot_hours, a.ot_pay, a.status])
      );
    } else if (key === 'shift-performance') {
      downloadCsv(
        `shift-performance-report-${today}.csv`,
        ['Shift Name', 'Total Logs', 'On-Time', 'Late', 'Absence Hrs', 'OT Hrs', 'Punctuality %'],
        shiftPerfStats.map((s) => [s.sName, s.totalLogs, s.onTime, s.late, s.absHrs.toFixed(1), s.otHrs.toFixed(1), `${s.punctuality}%`])
      );
    } else if (key === 'payroll') {
      downloadCsv(
        `payroll-tax-register-${today}.csv`,
        ['Month', 'Code', 'Employee', 'Department', 'Basic', 'OT Pay', 'Bonus', 'Income Tax', 'Emp Pension', 'Employer Pension', 'Net Salary', 'Status'],
        payrolls.map((p) => [p.payroll_month, p.employee_code, p.employee_name, p.department, p.basic_salary, p.overtime_pay, p.bonuses, p.income_tax, p.employee_pension, p.employer_pension, p.net_salary, p.status])
      );
    } else if (key === 'movements') {
      downloadCsv(
        `materials-audit-ledger-${today}.csv`,
        ['Ref #', 'Movement Type', 'Material', 'Qty', 'Source', 'Destination', 'Date', 'Recorded By', 'Status'],
        movements.map((mv) => [mv.movement_number, mv.movement_type, mv.material_name, mv.quantity, mv.source_location, mv.destination_location, mv.movement_date, mv.recorded_by, mv.status])
      );
    } else if (key === 'sales') {
      downloadCsv(
        `sales-crm-report-${today}.csv`,
        ['Type', 'Ref / Company', 'Contact / Product', 'Stage / Status', 'Amount'],
        [
          ...deals.map((d) => ['CRM Deal', d.company_name, d.contact_person, d.stage, d.deal_value]),
          ...salesOrders.map((s) => ['Sales Order', s.order_number, `${s.customer_name} - ${s.product_service}`, s.payment_status, s.amount]),
        ]
      );
    } else {
      downloadCsv(
        `financial-trial-balance-${today}.csv`,
        ['Code', 'Account Name', 'Type', 'Total Debit', 'Total Credit', 'Net Balance'],
        accounts.map((a) => [a.code, a.name, a.account_type, a.debit_total, a.credit_total, a.balance])
      );
    }
  };

  const reportCards: Array<{
    key: ReportKey;
    title: string;
    countText: string;
    subtitle: string;
    icon: React.ReactNode;
  }> = [
    {
      key: 'attendance',
      title: 'Daily / Weekly / Monthly Attendance',
      countText: `${filteredAttendance.length} logs`,
      subtitle: 'Complete attendance register with late minutes, absences & register status',
      icon: <Clock className="w-4 h-4 text-[#18243A] dark:text-[#38BDF8]" />,
    },
    {
      key: 'shift-sessions',
      title: 'Morning, Afternoon & Night Shifts',
      countText: `${filteredAttendance.length} session logs`,
      subtitle: 'Session-by-session Morning, Afternoon & Night check-in / check-out breakdown',
      icon: <CalendarClock className="w-4 h-4 text-[#18243A] dark:text-[#38BDF8]" />,
    },
    {
      key: 'lateness-absence',
      title: 'Employee Lateness & Absence Records',
      countText: `${latenessAbsenceRows.length} exceptions`,
      subtitle: 'Late arrival minutes, early departures & unexcused/leave absence hours',
      icon: <AlertCircle className="w-4 h-4 text-rose-600" />,
    },
    {
      key: 'overtime-detail',
      title: 'Overtime Hours & Multipliers',
      countText: `${overtimeRows.length} OT entries`,
      subtitle: 'Normal (1.5x), Night (1.75x), Sunday (2.0x) & Holiday (2.5x) OT payouts',
      icon: <Clock className="w-4 h-4 text-[#087CEB]" />,
    },
    {
      key: 'dept-attendance',
      title: 'Department Attendance Summary',
      countText: `${deptAttendanceStats.length} departments`,
      subtitle: 'Department headcount, present rate %, lateness & overtime hours',
      icon: <Users className="w-4 h-4 text-[#18243A] dark:text-[#38BDF8]" />,
    },
    {
      key: 'security-duty',
      title: 'Security Guard Duty Schedules',
      countText: `${securityDutyRows.length} duty shifts`,
      subtitle: '24/7 Gate & perimeter guard rosters, shift windows & approvals',
      icon: <Shield className="w-4 h-4 text-[#18243A] dark:text-[#38BDF8]" />,
    },
    {
      key: 'weekend-holiday',
      title: 'Weekend & Holiday Attendance',
      countText: `${weekendHolidayRows.length} logs`,
      subtitle: 'Saturday, Sunday & Ethiopian public holiday duty verification',
      icon: <CalendarClock className="w-4 h-4 text-amber-600" />,
    },
    {
      key: 'shift-performance',
      title: 'Shift Performance Report',
      countText: `${shiftPerfStats.length} shift types`,
      subtitle: 'On-time punctuality %, late incidents, absence & OT across all shifts',
      icon: <TrendingUp className="w-4 h-4 text-emerald-600" />,
    },
    {
      key: 'employees',
      title: 'Employee Master Directory',
      countText: `${employees.length} records`,
      subtitle: 'Full staff roster, National IDs, phones, bank accounts & salaries',
      icon: <Users className="w-4 h-4 text-[#18243A] dark:text-[#38BDF8]" />,
    },
    {
      key: 'payroll',
      title: 'Payroll & Ethiopian Tax',
      countText: `${payrolls.length} payslips`,
      subtitle: 'Progressive Ethiopian tax, 7%/11% pension & net disbursement',
      icon: <Wallet className="w-4 h-4 text-[#18243A] dark:text-[#38BDF8]" />,
    },
    {
      key: 'inventory',
      title: 'Inventory Valuation',
      countText: `${materials.length} items · ${formatMoney(inventoryTotal, currency)}`,
      subtitle: 'Stock balances, reorder thresholds & total warehouse valuation',
      icon: <Package className="w-4 h-4 text-[#18243A] dark:text-[#38BDF8]" />,
    },
    {
      key: 'movements',
      title: 'Materials Audit Ledger',
      countText: `${movements.length} movements`,
      subtitle: 'Transfers, returns, damages, physical audits & adjustments',
      icon: <FileSpreadsheet className="w-4 h-4 text-[#18243A] dark:text-[#38BDF8]" />,
    },
    {
      key: 'sales',
      title: 'Sales & CRM Pipeline',
      countText: `${deals.length} deals · ${salesOrders.length} orders`,
      subtitle: 'Commercial revenue pipeline & order payment status',
      icon: <TrendingUp className="w-4 h-4 text-[#18243A] dark:text-[#38BDF8]" />,
    },
    {
      key: 'trial',
      title: 'Financial Trial Balance',
      countText: `${accounts.length} ledger accounts`,
      subtitle: 'General ledger debits, credits & account balances',
      icon: <BookOpen className="w-4 h-4 text-[#18243A] dark:text-[#38BDF8]" />,
    },
  ];

  const logoSrc = company?.logo_data || '/assets/aistudio/Seven_Sunday_Logo_2_desktop_addf2fa7.png';

  return (
    <div className="space-y-6">
      <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#172033] dark:text-white">
              Corporate Reports, Workforce Analytics & Data Exports
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Generate live Excel/CSV and printable A4 reports across Attendance, Shifts, Lateness, Overtime, Security Guard Duty, Payroll, Inventory & Finance.
            </p>
          </div>
          <ImportFilesButton
            company={company}
            label="Import CSV / Documents"
            defaultTab="csv"
            defaultTargetModule="reports"
            onImported={() => {
              loadAllReports();
              window.dispatchEvent(new CustomEvent('sevensunday:data-imported'));
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <label className="font-semibold text-slate-600 dark:text-slate-300">Department Filter:</label>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-3 py-1.5 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              {deptNames.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="font-semibold text-slate-600 dark:text-slate-300">Date / Month Prefix:</label>
            <input
              type="text"
              placeholder="e.g. 2026-11 or 2026-11-20"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-1.5 font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg w-48"
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                className="text-xs text-[#087CEB] font-semibold hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {reportCards.map((card) => {
            const selected = activeReport === card.key;
            return (
              <div
                key={card.key}
                className={`border rounded-xl p-4 flex flex-col justify-between gap-4 transition-colors ${
                  selected
                    ? 'border-[#087CEB] bg-[#EAF4FF]/70 dark:bg-slate-800/80'
                    : 'border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/30'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveReport(card.key)}
                      className="text-left font-bold text-sm text-[#172033] dark:text-white hover:underline"
                    >
                      {card.title}
                    </button>
                    <span className="p-1.5 rounded-lg bg-[#EAF4FF] dark:bg-slate-800 shrink-0">{card.icon}</span>
                  </div>
                  <div className="text-xs font-mono font-semibold text-[#18243A] dark:text-[#38BDF8] mt-1">
                    {card.countText}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{card.subtitle}</p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => exportReport(card.key)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReport(card.key);
                      window.setTimeout(
                        () =>
                          printWithAutoFit({
                            orientation: 'landscape',
                            targetSelector: '.print-only-container[data-print-active="true"]',
                          }),
                        80
                      );
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#18243A] hover:bg-[#172033] rounded-lg whitespace-nowrap"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#087CEB]" />
                    Print
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Printable Report Preview */}
      <div
        data-print-active="true"
        data-print-orientation="landscape"
        className="print-only-container bg-white border border-slate-200 rounded-xl p-4 sm:p-6 text-[#172033]"
      >
        <div className="flex items-center justify-between pb-4 border-b-2 border-[#18243A] mb-4">
          <div className="flex items-center gap-3">
            <img src={logoSrc} alt="Seven Sunday" className="h-10 w-auto object-contain" />
            <div>
              <h3 className="text-base font-bold text-[#18243A]">
                {reportCards.find((c) => c.key === activeReport)?.title}
              </h3>
              <p className="text-xs text-slate-500">
                {company?.company_name || 'Seven Sunday Manufacturing & Trading PLC'} · Dept: {deptFilter} · Generated {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {company?.stamp_data && <img src={company.stamp_data} alt="Stamp" className="h-11 w-11 object-contain" />}
            <RealQrCode value={`SS-REPORT|${activeReport}|${deptFilter}|${new Date().toISOString().slice(0, 10)}`} size={64} />
          </div>
        </div>

        <div className="overflow-x-auto">
          {activeReport === 'attendance' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 bg-[#F8FAFC] font-semibold">
                  <th className="py-2 px-3">Staff</th>
                  <th className="py-2 px-3">Department</th>
                  <th className="py-2 px-3">Date & Shift</th>
                  <th className="py-2 px-3">In - Out</th>
                  <th className="py-2 px-3 text-right">Late / Abs</th>
                  <th className="py-2 px-3 text-right">OT Pay</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredAttendance.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 px-3 font-medium">{a.employee_name} ({a.employee_code})</td>
                    <td className="py-2 px-3">{a.department}</td>
                    <td className="py-2 px-3 font-mono">{a.attendance_date} · {a.shift_name}</td>
                    <td className="py-2 px-3 font-mono">{a.check_in}–{a.check_out}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{a.late_minutes || 0}m / {a.absence_hours || 0}h</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{formatMoney(a.ot_pay, currency)}</td>
                    <td className="py-2 px-3 font-semibold">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'shift-sessions' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 bg-[#F8FAFC] font-semibold">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Staff</th>
                  <th className="py-2 px-3">Morning (In/Out)</th>
                  <th className="py-2 px-3">Afternoon (In/Out)</th>
                  <th className="py-2 px-3">Night (In/Out)</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredAttendance.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 px-3 font-mono">{a.attendance_date}</td>
                    <td className="py-2 px-3 font-medium">{a.employee_name} ({a.department})</td>
                    <td className="py-2 px-3 font-mono">{a.morning_check_in ? `${a.morning_check_in}–${a.morning_check_out || '--:--'}` : '—'}</td>
                    <td className="py-2 px-3 font-mono">{a.afternoon_check_in ? `${a.afternoon_check_in}–${a.afternoon_check_out || '--:--'}` : '—'}</td>
                    <td className="py-2 px-3 font-mono">{a.night_check_in ? `${a.night_check_in}–${a.night_check_out || '--:--'}` : '—'}</td>
                    <td className="py-2 px-3 font-semibold">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'lateness-absence' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 bg-[#F8FAFC] font-semibold">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Staff & Dept</th>
                  <th className="py-2 px-3">Sched vs In</th>
                  <th className="py-2 px-3 text-right">Late (Min)</th>
                  <th className="py-2 px-3 text-right">Early Exit</th>
                  <th className="py-2 px-3 text-right">Absence (Hrs)</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {latenessAbsenceRows.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 px-3 font-mono">{a.attendance_date}</td>
                    <td className="py-2 px-3 font-medium">{a.employee_name} ({a.department})</td>
                    <td className="py-2 px-3 font-mono">{a.scheduled_start || '08:00'} → {a.check_in}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-amber-700 tabular-nums">{a.late_minutes || 0}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{a.early_departure_minutes || 0}m</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-rose-700 tabular-nums">{a.absence_hours || 0}h</td>
                    <td className="py-2 px-3 font-semibold">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'overtime-detail' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 bg-[#F8FAFC] font-semibold">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Staff & Dept</th>
                  <th className="py-2 px-3">OT Category</th>
                  <th className="py-2 px-3 text-right">Multiplier</th>
                  <th className="py-2 px-3 text-right">OT Hours</th>
                  <th className="py-2 px-3 text-right">OT Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {overtimeRows.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 px-3 font-mono">{a.attendance_date}</td>
                    <td className="py-2 px-3 font-medium">{a.employee_name} ({a.department})</td>
                    <td className="py-2 px-3">{a.ot_type}</td>
                    <td className="py-2 px-3 text-right font-mono">{a.ot_multiplier}x</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{a.ot_hours}h</td>
                    <td className="py-2 px-3 text-right font-mono font-bold tabular-nums">{formatMoney(a.ot_pay, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'dept-attendance' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 bg-[#F8FAFC] font-semibold">
                  <th className="py-2 px-3">Department</th>
                  <th className="py-2 px-3">Manager</th>
                  <th className="py-2 px-3 text-right">Staff</th>
                  <th className="py-2 px-3 text-right">Present</th>
                  <th className="py-2 px-3 text-right">Late</th>
                  <th className="py-2 px-3 text-right">Absent</th>
                  <th className="py-2 px-3 text-right">OT Hrs</th>
                  <th className="py-2 px-3 text-right">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {deptAttendanceStats.map((d) => (
                  <tr key={d.name}>
                    <td className="py-2 px-3 font-semibold">{d.name}</td>
                    <td className="py-2 px-3">{d.manager}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{d.staffCount}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{d.present}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{d.late}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{d.absent}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{d.otHrs.toFixed(1)}h</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-[#087CEB] tabular-nums">{d.rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'security-duty' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 bg-[#F8FAFC] font-semibold">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Staff / Guard</th>
                  <th className="py-2 px-3">Department</th>
                  <th className="py-2 px-3">Shift & Time</th>
                  <th className="py-2 px-3">Approval</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {securityDutyRows.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 px-3 font-mono">{s.schedule_date}</td>
                    <td className="py-2 px-3 font-medium">{s.employee_name} ({s.employee_id})</td>
                    <td className="py-2 px-3">{s.department}</td>
                    <td className="py-2 px-3 font-mono">{s.shift_name} ({s.start_time}–{s.end_time})</td>
                    <td className="py-2 px-3">{s.approval_status}</td>
                    <td className="py-2 px-3 font-semibold">{s.availability_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'weekend-holiday' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 bg-[#F8FAFC] font-semibold">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Staff & Dept</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">In - Out</th>
                  <th className="py-2 px-3 text-right">OT Pay</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {weekendHolidayRows.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 px-3 font-mono">{a.attendance_date}</td>
                    <td className="py-2 px-3 font-medium">{a.employee_name} ({a.department})</td>
                    <td className="py-2 px-3">{a.ot_type} ({a.ot_multiplier}x)</td>
                    <td className="py-2 px-3 font-mono">{a.check_in}–{a.check_out}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold tabular-nums">{formatMoney(a.ot_pay, currency)}</td>
                    <td className="py-2 px-3 font-semibold">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'shift-performance' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 bg-[#F8FAFC] font-semibold">
                  <th className="py-2 px-3">Shift Name</th>
                  <th className="py-2 px-3 text-right">Total Logs</th>
                  <th className="py-2 px-3 text-right">On-Time</th>
                  <th className="py-2 px-3 text-right">Late</th>
                  <th className="py-2 px-3 text-right">Absence Hrs</th>
                  <th className="py-2 px-3 text-right">OT Hrs</th>
                  <th className="py-2 px-3 text-right">Punctuality %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {shiftPerfStats.map((s) => (
                  <tr key={s.sName}>
                    <td className="py-2 px-3 font-semibold">{s.sName}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{s.totalLogs}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{s.onTime}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{s.late}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{s.absHrs.toFixed(1)}h</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{s.otHrs.toFixed(1)}h</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-[#087CEB] tabular-nums">{s.punctuality}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'employees' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 bg-[#F8FAFC] font-semibold">
                  <th className="py-2 px-3">ID</th>
                  <th className="py-2 px-3">Full Name</th>
                  <th className="py-2 px-3">National ID</th>
                  <th className="py-2 px-3">Phone</th>
                  <th className="py-2 px-3">Dept & Title</th>
                  <th className="py-2 px-3">Bank Account</th>
                  <th className="py-2 px-3 text-right">Salary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {employees.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 px-3 font-mono">{e.employee_id}</td>
                    <td className="py-2 px-3 font-medium">{e.full_name}</td>
                    <td className="py-2 px-3 font-mono">{e.national_id || '—'}</td>
                    <td className="py-2 px-3 font-mono">{e.phone}</td>
                    <td className="py-2 px-3">{e.department} · {e.job_title}</td>
                    <td className="py-2 px-3 font-mono">{e.bank_account || '—'}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{formatMoney(e.basic_salary, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'inventory' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 bg-[#F8FAFC] font-semibold">
                  <th className="py-2 px-3">SKU</th>
                  <th className="py-2 px-3">Material</th>
                  <th className="py-2 px-3">Location</th>
                  <th className="py-2 px-3 text-right">Stock</th>
                  <th className="py-2 px-3 text-right">Unit Cost</th>
                  <th className="py-2 px-3 text-right">Valuation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {materials.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2 px-3 font-mono">{m.sku}</td>
                    <td className="py-2 px-3 font-medium">{m.name}</td>
                    <td className="py-2 px-3">{m.location}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{m.stock_qty} {m.unit}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{formatMoney(m.unit_cost, currency)}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold tabular-nums">{formatMoney(m.stock_qty * m.unit_cost, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'payroll' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 bg-[#F8FAFC] font-semibold">
                  <th className="py-2 px-3">Month</th>
                  <th className="py-2 px-3">Employee</th>
                  <th className="py-2 px-3 text-right">Basic</th>
                  <th className="py-2 px-3 text-right">Bonus + OT</th>
                  <th className="py-2 px-3 text-right">Tax + Pension</th>
                  <th className="py-2 px-3 text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {payrolls.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 px-3 font-mono">{p.payroll_month}</td>
                    <td className="py-2 px-3">{p.employee_name}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{formatMoney(p.basic_salary, currency)}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{formatMoney(p.bonuses + p.overtime_pay, currency)}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{formatMoney(p.income_tax + p.employee_pension, currency)}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold tabular-nums">{formatMoney(p.net_salary, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'movements' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 bg-[#F8FAFC] font-semibold">
                  <th className="py-2 px-3">Ref #</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Material</th>
                  <th className="py-2 px-3 text-right">Qty</th>
                  <th className="py-2 px-3">Route</th>
                  <th className="py-2 px-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {movements.map((mv) => (
                  <tr key={mv.id}>
                    <td className="py-2 px-3 font-mono">{mv.movement_number}</td>
                    <td className="py-2 px-3">{mv.movement_type}</td>
                    <td className="py-2 px-3">{mv.material_name}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{mv.quantity}</td>
                    <td className="py-2 px-3">{mv.source_location} → {mv.destination_location}</td>
                    <td className="py-2 px-3 font-mono">{mv.movement_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'sales' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 bg-[#F8FAFC] font-semibold">
                  <th className="py-2 px-3">Order / Deal</th>
                  <th className="py-2 px-3">Customer</th>
                  <th className="py-2 px-3">Stage / Status</th>
                  <th className="py-2 px-3 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {salesOrders.map((s) => (
                  <tr key={`so-${s.id}`}>
                    <td className="py-2 px-3 font-mono">{s.order_number}</td>
                    <td className="py-2 px-3">{s.customer_name} — {s.product_service}</td>
                    <td className="py-2 px-3">{s.payment_status}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{formatMoney(s.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'trial' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 bg-[#F8FAFC] font-semibold">
                  <th className="py-2 px-3">Code</th>
                  <th className="py-2 px-3">Account</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3 text-right">Debit</th>
                  <th className="py-2 px-3 text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 px-3 font-mono">{a.code}</td>
                    <td className="py-2 px-3">{a.name}</td>
                    <td className="py-2 px-3">{a.account_type}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{formatMoney(a.debit_total, currency)}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{formatMoney(a.credit_total, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
