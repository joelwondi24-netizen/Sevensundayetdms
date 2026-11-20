import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Clock,
  Download,
  FileSpreadsheet,
  Package,
  Printer,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { api } from '../api';
import type {
  AttendanceRecord,
  CompanySettings,
  CrmDeal,
  EmployeeProfile,
  InventoryMovementRecord,
  LedgerAccount,
  MaterialItem,
  PayrollRecord,
  SalesOrder,
} from '../types';
import { formatMoney } from '../utils/ethiopianCalendar';
import { RealQrCode } from './RealQrCode';

interface ReportsModuleProps {
  company?: CompanySettings | null;
  currency: string;
}

type ReportKey =
  | 'employees'
  | 'inventory'
  | 'attendance'
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
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [movements, setMovements] = useState<InventoryMovementRecord[]>([]);
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [activeReport, setActiveReport] = useState<ReportKey>('employees');

  useEffect(() => {
    Promise.all([
      api.get<EmployeeProfile[]>('/api/employees').catch(() => []),
      api.get<MaterialItem[]>('/api/materials').catch(() => []),
      api.get<AttendanceRecord[]>('/api/attendance').catch(() => []),
      api.get<PayrollRecord[]>('/api/payroll').catch(() => []),
      api.get<InventoryMovementRecord[]>('/api/inventory-movements').catch(() => []),
      api.get<CrmDeal[]>('/api/crm').catch(() => []),
      api.get<SalesOrder[]>('/api/sales-orders').catch(() => []),
      api.get<LedgerAccount[]>('/api/accounts').catch(() => []),
    ]).then(([e, m, att, p, mv, d, so, acc]) => {
      setEmployees(e);
      setMaterials(m);
      setAttendance(att);
      setPayrolls(p);
      setMovements(mv);
      setDeals(d);
      setSalesOrders(so);
      setAccounts(acc);
    });
  }, []);

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
        `attendance-ot-register-${today}.csv`,
        ['Employee Code', 'Employee Name', 'Department', 'Date', 'Shift', 'Check In', 'Check Out', 'Reg Hours', 'OT Type', 'OT Hours', 'OT Pay', 'Register State'],
        attendance.map((a) => [a.employee_code, a.employee_name, a.department, a.attendance_date, a.shift_name, a.check_in, a.check_out, a.regular_hours, a.ot_type, a.ot_hours, a.ot_pay, a.register_state])
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
      key: 'employees',
      title: 'Employee Master Directory',
      countText: `${employees.length} records`,
      subtitle: 'Full staff roster, National IDs, phones, bank accounts & salaries',
      icon: <Users className="w-4 h-4 text-[#18243A] dark:text-[#38BDF8]" />,
    },
    {
      key: 'inventory',
      title: 'Inventory Valuation',
      countText: `${materials.length} items · ${formatMoney(inventoryTotal, currency)}`,
      subtitle: 'Stock balances, reorder thresholds & total warehouse valuation',
      icon: <Package className="w-4 h-4 text-[#18243A] dark:text-[#38BDF8]" />,
    },
    {
      key: 'attendance',
      title: 'Attendance & OT Register',
      countText: `${attendance.length} records`,
      subtitle: 'Shift logs, Night/Sunday/Holiday OT multipliers & register state',
      icon: <Clock className="w-4 h-4 text-[#18243A] dark:text-[#38BDF8]" />,
    },
    {
      key: 'payroll',
      title: 'Payroll & Ethiopian Tax',
      countText: `${payrolls.length} payslips`,
      subtitle: 'Progressive Ethiopian tax, 7%/11% pension & net disbursement',
      icon: <Wallet className="w-4 h-4 text-[#18243A] dark:text-[#38BDF8]" />,
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
      <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-bold text-[#172033] dark:text-white">
          Corporate Reports & Data Exports
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Generate live Excel/CSV and printable A4 reports directly from current SQLite database records.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
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
                    <span className="p-1.5 rounded-lg bg-[#EAF4FF] dark:bg-slate-800">{card.icon}</span>
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
                    Download CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReport(card.key);
                      setTimeout(() => window.print(), 80);
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
      <div className="print-only-container bg-white border border-slate-200 rounded-xl p-6 text-[#172033]">
        <div className="flex items-center justify-between pb-4 border-b-2 border-[#18243A] mb-4">
          <div className="flex items-center gap-3">
            <img src={logoSrc} alt="Seven Sunday" className="h-10 w-auto object-contain" />
            <div>
              <h3 className="text-base font-bold text-[#18243A]">
                {reportCards.find((c) => c.key === activeReport)?.title}
              </h3>
              <p className="text-xs text-slate-500">
                {company?.company_name || 'Seven Sunday Manufacturing & Trading PLC'} · Generated {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {company?.stamp_data && <img src={company.stamp_data} alt="Stamp" className="h-11 w-11 object-contain" />}
            <RealQrCode value={`SS-REPORT|${activeReport}|${new Date().toISOString().slice(0, 10)}`} size={64} />
          </div>
        </div>

        <div className="overflow-x-auto">
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

          {activeReport === 'attendance' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 bg-[#F8FAFC] font-semibold">
                  <th className="py-2 px-3">Staff</th>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">In - Out</th>
                  <th className="py-2 px-3">OT Type</th>
                  <th className="py-2 px-3 text-right">OT Pay</th>
                  <th className="py-2 px-3">Register</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {attendance.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 px-3">{a.employee_name} ({a.employee_code})</td>
                    <td className="py-2 px-3 font-mono">{a.attendance_date}</td>
                    <td className="py-2 px-3 font-mono">{a.check_in}–{a.check_out}</td>
                    <td className="py-2 px-3">{a.ot_type} ({a.ot_hours}h × {a.ot_multiplier}x)</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{formatMoney(a.ot_pay, currency)}</td>
                    <td className="py-2 px-3 font-semibold">{a.register_state}</td>
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
