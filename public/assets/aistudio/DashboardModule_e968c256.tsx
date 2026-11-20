import React from 'react';
import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarOff,
  ClipboardCheck,
  Clock,
  Cpu,
  Download,
  FileSpreadsheet,
  FileText,
  MessageSquare,
  Package,
  Printer,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import type { CompanySettings, DashboardSummary, ModuleKey } from '../types';
import { formatMoney } from '../utils/ethiopianCalendar';

interface DashboardModuleProps {
  summary: DashboardSummary | null;
  company: CompanySettings | null;
  onNavigate: (module: ModuleKey) => void;
  allowedModules: ModuleKey[];
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({
  summary,
  company,
  onNavigate,
  allowedModules,
}) => {
  const currency = company?.default_currency || 'ETB';
  const money = (v: number) => formatMoney(v || 0, currency);

  const logoSrc =
    company?.logo_data && company.logo_data.startsWith('data:')
      ? company.logo_data
      : '/assets/aistudio/Seven_Sunday_Logo_2_desktop_addf2fa7.png';

  const rawCards: Array<{
    title: string;
    value: string;
    detail: string;
    module: ModuleKey;
    icon: React.ReactNode;
  }> = [
    {
      title: 'Workforce Headcount',
      value: `${summary?.activeEmployees ?? 0} / ${summary?.totalEmployees ?? 0}`,
      detail: `${summary?.departmentBreakdown?.length ?? 0} active departments`,
      module: 'hr',
      icon: <Users className="w-4 h-4 text-[#087CEB]" />,
    },
    {
      title: 'Attendance & Overtime',
      value: `${summary?.totalAttendanceToday ?? 0} logs`,
      detail: `${summary?.openRegisters ?? 0} open · ${summary?.closedRegisters ?? 0} closed · OT ${money(summary?.totalOtPay ?? 0)}`,
      module: 'attendance',
      icon: <Clock className="w-4 h-4 text-[#087CEB]" />,
    },
    {
      title: 'Monthly Payroll Net',
      value: money(summary?.monthlyPayrollTotal ?? 0),
      detail: `${summary?.payrollStaffCount ?? 0} payroll rows · Tax ${money(summary?.payrollTotalTax ?? 0)}`,
      module: 'payroll',
      icon: <Wallet className="w-4 h-4 text-[#087CEB]" />,
    },
    {
      title: 'Company Forms & Evaluations',
      value: `${summary?.totalFormSubmissions ?? 0} filed`,
      detail: `${summary?.pendingFormApprovals ?? 0} pending review · 305 templates`,
      module: 'company-forms',
      icon: <ClipboardCheck className="w-4 h-4 text-[#087CEB]" />,
    },
    {
      title: 'Materials Inventory',
      value: money(summary?.totalInventoryValue ?? 0),
      detail: `${summary?.lowStockMaterials ?? 0} low-stock alerts · ${summary?.pendingMaterialRequests ?? 0} requests`,
      module: 'materials',
      icon: <Package className="w-4 h-4 text-[#087CEB]" />,
    },
    {
      title: 'Sales & CRM Pipeline',
      value: money(summary?.pipelineValue ?? 0),
      detail: `Paid orders: ${money(summary?.paidSalesTotal ?? 0)}`,
      module: 'sales-crm',
      icon: <TrendingUp className="w-4 h-4 text-[#087CEB]" />,
    },
    {
      title: 'Double-Entry Ledger',
      value: money(summary?.totalDebits ?? 0),
      detail: `Rev ${money(summary?.totalRevenue ?? 0)} · Exp ${money(summary?.totalExpenses ?? 0)}`,
      module: 'finance',
      icon: <BookOpen className="w-4 h-4 text-[#087CEB]" />,
    },
    {
      title: 'Procurement & Purchasing',
      value: `${summary?.openPurchaseOrders ?? 0} open POs`,
      detail: `${summary?.pendingMaterialRequests ?? 0} pending material requisitions`,
      module: 'purchasing',
      icon: <ShoppingCart className="w-4 h-4 text-[#087CEB]" />,
    },
    {
      title: 'Leave Requests',
      value: `${summary?.pendingLeaves ?? 0} pending`,
      detail: 'Awaiting HR & manager approval',
      module: 'leave',
      icon: <CalendarOff className="w-4 h-4 text-[#087CEB]" />,
    },
    {
      title: 'Secretary A4 Documents',
      value: `${summary?.totalDocuments ?? 0} issued`,
      detail: 'Letters, memos, stamps & QR verification',
      module: 'secretary',
      icon: <FileText className="w-4 h-4 text-[#087CEB]" />,
    },
    {
      title: 'Fleet & Maintenance',
      value: `${summary?.activeVehicles ?? 0} vehicles`,
      detail: `${summary?.pendingMaintenanceCount ?? 0} equipment tasks · ${summary?.totalAssetsIssued ?? 0} assets`,
      module: 'vehicles',
      icon: <Truck className="w-4 h-4 text-[#087CEB]" />,
    },
    {
      title: 'Devices & Corporate Chat',
      value: `${summary?.connectedDevices ?? 0} / ${summary?.totalDevices ?? 0} devices`,
      detail: `${summary?.chatChannels ?? 11} chat channels · ${summary?.chatMessages ?? 0} messages`,
      module: allowedModules.includes('devices') ? 'devices' : 'chat',
      icon: allowedModules.includes('devices') ? (
        <Cpu className="w-4 h-4 text-[#087CEB]" />
      ) : (
        <MessageSquare className="w-4 h-4 text-[#087CEB]" />
      ),
    },
  ];

  const cards = rawCards.filter((c) => allowedModules.includes(c.module));

  const revenue = summary?.totalRevenue ?? 0;
  const expenses = summary?.totalExpenses ?? 0;
  const surplus = revenue - expenses;
  const maxFin = Math.max(
    1,
    revenue,
    expenses,
    summary?.payrollTotalGross ?? summary?.monthlyPayrollTotal ?? 0,
    summary?.totalInventoryValue ?? 0,
    summary?.pipelineValue ?? 0
  );

  const departments = summary?.departmentBreakdown ?? [];
  const maxDeptHeadcount = Math.max(1, ...departments.map((d) => d.headcount));

  const pendingActionCount =
    (summary?.pendingLeaves ?? 0) +
    (summary?.pendingMaterialRequests ?? 0) +
    (summary?.pendingFormApprovals ?? 0) +
    (summary?.pendingMaintenanceCount ?? 0) +
    (summary?.lowStockMaterials ?? 0);

  const exportExecutiveCsv = () => {
    const lines = [
      ['Executive Metric', 'Value'],
      ['Company Name', company?.company_name || 'Seven Sunday Manufacturing & Trading PLC'],
      ['Active Employees', String(summary?.activeEmployees ?? 0)],
      ['Total Employees', String(summary?.totalEmployees ?? 0)],
      ['Payroll Staff Rows', String(summary?.payrollStaffCount ?? 0)],
      ['Payroll Basic Total', String(summary?.payrollTotalBasic ?? 0)],
      ['Payroll Gross Total', String(summary?.payrollTotalGross ?? 0)],
      ['Payroll Income Tax', String(summary?.payrollTotalTax ?? 0)],
      ['Employee Pension (7%)', String(summary?.payrollTotalEmpPension ?? 0)],
      ['Employer Pension (11%)', String(summary?.payrollTotalErPension ?? 0)],
      ['Payroll Net Payable', String(summary?.monthlyPayrollTotal ?? 0)],
      ['Recognized Revenue', String(revenue)],
      ['Operating Expenses', String(expenses)],
      ['Net Operating Surplus', String(surplus)],
      ['Inventory Valuation', String(summary?.totalInventoryValue ?? 0)],
      ['Sales & CRM Pipeline', String(summary?.pipelineValue ?? 0)],
      ['Filed Company Forms', String(summary?.totalFormSubmissions ?? 0)],
      ['Pending Executive Actions', String(pendingActionCount)],
    ];
    const csv = lines.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seven-sunday-executive-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Executive Command Header (Single-Elevation, Clean 1px Border) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <img
            src={logoSrc}
            alt="Seven Sunday Ethiopia"
            className="h-12 w-auto object-contain bg-white rounded-lg px-2 py-1 border border-slate-200 shrink-0"
          />
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Executive Command Dashboard · TIN {company?.tin_number || 'ET-00981244'} · {currency}
            </div>
            <h2 className="text-xl font-bold text-[#172033] dark:text-white tracking-tight truncate">
              {company?.company_name || 'Seven Sunday Manufacturing & Trading PLC'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {company?.slogan || 'The Home of quality product'} · {company?.secondary_slogan || 'Together for a Stronger and Better Tomorrow'}
            </p>
          </div>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={exportExecutiveCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Brief
          </button>
          {allowedModules.includes('company-forms') && (
            <button
              type="button"
              onClick={() => onNavigate('company-forms')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded-lg whitespace-nowrap"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              Company Forms & Evaluations
            </button>
          )}
          {allowedModules.includes('payroll') && (
            <button
              type="button"
              onClick={() => onNavigate('payroll')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
            >
              Payroll Sheet
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Top Executive KPI Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <button
            key={card.title}
            type="button"
            onClick={() => onNavigate(card.module)}
            className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#087CEB] rounded-xl p-5 transition-colors"
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{card.title}</span>
              {card.icon}
            </div>
            <div className="text-xl font-bold text-[#172033] dark:text-white font-mono tabular-nums truncate">
              {card.value}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 truncate">{card.detail}</p>
          </button>
        ))}
      </div>

      {/* Middle Executive Split: Financial Position & Payroll Statutory Obligations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Financial Comparison (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-[#172033] dark:text-white">
                Executive Financial & Operational Comparison ({currency})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real-time SQLite ledger, payroll, sales pipeline, and inventory valuation.
              </p>
            </div>
            <div className="text-xs font-mono font-bold tabular-nums text-[#18243A] dark:text-[#38BDF8]">
              Net Surplus: {money(surplus)}
            </div>
          </div>

          <div className="space-y-3.5">
            {[
              { label: 'Recognized Revenue', val: revenue, color: 'bg-[#18243A] dark:bg-[#087CEB]' },
              { label: 'Operating Expenses', val: expenses, color: 'bg-[#087CEB]' },
              { label: 'Monthly Payroll Gross', val: summary?.payrollTotalGross ?? summary?.monthlyPayrollTotal ?? 0, color: 'bg-[#38BDF8]' },
              { label: 'Materials Inventory Value', val: summary?.totalInventoryValue ?? 0, color: 'bg-emerald-600' },
              { label: 'Sales & CRM Pipeline', val: summary?.pipelineValue ?? 0, color: 'bg-slate-500' },
            ].map((bar) => {
              const pct = Math.max(2, Math.min(100, Math.round((bar.val / maxFin) * 100)));
              return (
                <div key={bar.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-[#172033] dark:text-slate-300">{bar.label}</span>
                    <span className="font-mono font-semibold text-[#172033] dark:text-white tabular-nums">
                      {money(bar.val)}
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-[#F8FAFC] dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${bar.color} rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Statutory Payroll & Tax Breakdown (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-[#172033] dark:text-white">
                Payroll & Statutory Breakdown
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aggregated across {summary?.payrollStaffCount ?? 0} payroll records
              </p>
            </div>
            {allowedModules.includes('reports') && (
              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="text-xs font-semibold text-[#087CEB] hover:underline whitespace-nowrap inline-flex items-center gap-1"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Reports
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {[
              { label: 'Total Basic Salary', val: summary?.payrollTotalBasic ?? 0 },
              { label: 'Total Gross Pay', val: summary?.payrollTotalGross ?? 0 },
              { label: 'Ethiopian Income Tax Withheld', val: summary?.payrollTotalTax ?? 0 },
              { label: 'Employee Pension (7%)', val: summary?.payrollTotalEmpPension ?? 0 },
              { label: 'Employer Pension Contribution (11%)', val: summary?.payrollTotalErPension ?? 0 },
              { label: 'Net Salary Payable', val: summary?.monthlyPayrollTotal ?? 0, strong: true },
            ].map((row) => (
              <div key={row.label} className="py-2.5 flex items-center justify-between gap-2">
                <span className={row.strong ? 'font-bold text-[#172033] dark:text-white' : 'text-slate-600 dark:text-slate-400'}>
                  {row.label}
                </span>
                <span
                  className={`font-mono tabular-nums ${
                    row.strong ? 'font-bold text-sm text-[#087CEB]' : 'font-semibold text-[#172033] dark:text-slate-200'
                  }`}
                >
                  {money(row.val)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Executive Split: Department Workforce Allocation + Pending Queue & Live Audit Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Department Workforce Allocation (6 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#172033] dark:text-white">
                Department Workforce & Base Payroll Allocation
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Active staff distribution across company departments
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {departments.length} Depts
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-600 dark:text-slate-300">
                  <th className="py-2.5 px-4">Department</th>
                  <th className="py-2.5 px-4 text-right">Headcount</th>
                  <th className="py-2.5 px-4">Share</th>
                  <th className="py-2.5 px-4 text-right">Monthly Basic ({currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {departments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      No active department headcount data available.
                    </td>
                  </tr>
                ) : (
                  departments.map((d) => {
                    const w = Math.max(8, Math.round((d.headcount / maxDeptHeadcount) * 100));
                    return (
                      <tr key={d.department} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-semibold text-[#172033] dark:text-white">
                          {d.department}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">{d.headcount}</td>
                        <td className="py-2.5 px-4 w-28">
                          <div className="h-2 bg-[#F8FAFC] dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-[#087CEB] rounded-full" style={{ width: `${w}%` }} />
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold tabular-nums">
                          {money(d.monthlyBasic)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Executive Approvals Queue & Recent Audit Trail (6 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-[#172033] dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#087CEB]" />
                Executive Action Queue & Audit Feed
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {pendingActionCount} items requiring review across HR, Inventory, Maintenance & Forms
              </p>
            </div>
            {allowedModules.includes('audit') && (
              <button
                type="button"
                onClick={() => onNavigate('audit')}
                className="text-xs font-semibold text-[#087CEB] hover:underline whitespace-nowrap"
              >
                Full Audit Trail
              </button>
            )}
          </div>

          {/* Clickable Action Summary Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            {[
              { label: 'Leave Req.', count: summary?.pendingLeaves ?? 0, mod: 'leave' as ModuleKey },
              { label: 'Mat. Req.', count: summary?.pendingMaterialRequests ?? 0, mod: 'material-requests' as ModuleKey },
              { label: 'Low Stock', count: summary?.lowStockMaterials ?? 0, mod: 'materials' as ModuleKey },
              { label: 'Forms Pend.', count: summary?.pendingFormApprovals ?? 0, mod: 'company-forms' as ModuleKey },
              { label: 'Equip. Maint.', count: summary?.pendingMaintenanceCount ?? 0, mod: 'vehicles' as ModuleKey },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => allowedModules.includes(item.mod) && onNavigate(item.mod)}
                className="text-left p-2.5 bg-[#F8FAFC] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg"
              >
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{item.label}</div>
                <div className="text-base font-bold font-mono tabular-nums text-[#172033] dark:text-white mt-0.5">
                  {item.count}
                </div>
              </button>
            ))}
          </div>

          {/* Recent Audit Logs */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {(summary?.recentAuditLogs ?? []).slice(0, 6).map((log) => (
              <div key={log.id} className="py-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-[#172033] dark:text-slate-200 truncate">
                    {log.summary}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {log.actor_name} · {log.module} · {log.action}
                  </div>
                </div>
                <span className="font-mono text-[10px] text-slate-400 shrink-0 tabular-nums">
                  {String(log.created_at).slice(0, 16).replace('T', ' ')}
                </span>
              </div>
            ))}
            {(!summary?.recentAuditLogs || summary.recentAuditLogs.length === 0) && (
              <div className="py-4 text-center text-slate-500">No recent audit events logged.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
