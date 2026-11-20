import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
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
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import type { CompanySettings, DashboardSummary, ModuleKey } from '../types';
import { formatMoney } from '../utils/ethiopianCalendar';
import { ImportFilesButton } from './ImportFilesModal';
import { ShareButton } from './ShareButton';

interface DashboardModuleProps {
  summary: DashboardSummary | null;
  company: CompanySettings | null;
  onNavigate: (module: ModuleKey) => void;
  allowedModules: ModuleKey[];
}

function compactAxis(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
  return String(Math.round(val));
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({
  summary,
  company,
  onNavigate,
  allowedModules,
}) => {
  const currency = company?.default_currency || 'ETB';
  const money = (v: number) => formatMoney(v || 0, currency);

  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);
  const [hoveredOtIdx, setHoveredOtIdx] = useState<number | null>(null);
  const [otMetricMode, setOtMetricMode] = useState<'birr' | 'hours'>('birr');
  const [hoveredDeptIdx, setHoveredDeptIdx] = useState<number | null>(null);
  const [hoveredSliceIdx, setHoveredSliceIdx] = useState<number | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);

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
      detail: `${summary?.payrollStaffCount ?? 0} payroll rows · Absence -${money(summary?.payrollAbsenceTotal ?? 0)}`,
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
      title: 'Single-Use Gate Pass',
      value: `${summary?.activeGatePasses ?? 0} active`,
      detail: 'One-time QR security pass · Auto-locks after exit',
      module: 'gate-pass',
      icon: <ShieldCheck className="w-4 h-4 text-[#087CEB]" />,
    },
    {
      title: 'Department Approvals',
      value: `${summary?.pendingDepartmentApprovals ?? 0} pending`,
      detail: 'Cross-department review & authorization queue',
      module: 'approvals',
      icon: <Activity className="w-4 h-4 text-[#087CEB]" />,
    },
    {
      title: 'Device Connections & Chat',
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

  const monthlyTrend = useMemo(() => {
    if (summary?.monthlyTrend && summary.monthlyTrend.length > 0) {
      return summary.monthlyTrend;
    }
    return [
      { label: 'Meskerm', revenue: revenue * 0.85, expenses: expenses * 0.88, payrollGross: summary?.payrollTotalGross ?? 0 },
      { label: 'Tikimt', revenue, expenses, payrollGross: summary?.payrollTotalGross ?? 0 },
    ];
  }, [summary, revenue, expenses]);

  const maxTrendValue = useMemo(
    () =>
      Math.max(
        1,
        ...monthlyTrend.flatMap((m) => [m.revenue, m.expenses, m.payrollGross])
      ),
    [monthlyTrend]
  );

  const activeMonthPoint =
    hoveredMonthIdx !== null && monthlyTrend[hoveredMonthIdx]
      ? monthlyTrend[hoveredMonthIdx]
      : monthlyTrend[monthlyTrend.length - 1];

  const otCategories = useMemo(() => {
    const base = summary?.otCategoryBreakdown ?? [
      { category: 'Normal' as const, shortLabel: 'Nor (1.5x)', multiplier: 1.5, hours: 0, amountBirr: summary?.payrollOtNormalTotal ?? 0 },
      { category: 'Night' as const, shortLabel: 'Night (1.75x)', multiplier: 1.75, hours: 0, amountBirr: summary?.payrollOtNightTotal ?? 0 },
      { category: 'Sunday' as const, shortLabel: 'Sun (2.0x)', multiplier: 2.0, hours: 0, amountBirr: summary?.payrollOtSundayTotal ?? 0 },
      { category: 'Holiday' as const, shortLabel: 'Holly (2.5x)', multiplier: 2.5, hours: 0, amountBirr: summary?.payrollOtHolidayTotal ?? 0 },
    ];
    return [
      ...base.map((b) => ({
        key: b.category,
        label: b.shortLabel,
        hours: b.hours,
        birr: b.amountBirr,
        multiplier: b.multiplier,
        isAbsence: false,
        color:
          b.category === 'Normal'
            ? '#087CEB'
            : b.category === 'Night'
              ? '#18243A'
              : b.category === 'Sunday'
                ? '#0EA5E9'
                : '#10B981',
      })),
      {
        key: 'Absence',
        label: 'Absence (-)',
        hours: 0,
        birr: summary?.payrollAbsenceTotal ?? 0,
        multiplier: 1,
        isAbsence: true,
        color: '#E11D48',
      },
    ];
  }, [summary]);

  const maxOtChartVal = useMemo(() => {
    if (otMetricMode === 'hours') {
      return Math.max(1, ...otCategories.filter((c) => !c.isAbsence).map((c) => c.hours));
    }
    return Math.max(1, ...otCategories.map((c) => c.birr));
  }, [otCategories, otMetricMode]);

  const departments = summary?.departmentBreakdown ?? [];
  const maxDeptBasic = Math.max(1, ...departments.map((d) => d.monthlyBasic));

  // Statutory Payroll Donut Segments
  const donutSegments = useMemo(() => {
    const net = Math.max(0, summary?.monthlyPayrollTotal ?? 0);
    const tax = Math.max(0, summary?.payrollTotalTax ?? 0);
    const empPen = Math.max(0, summary?.payrollTotalEmpPension ?? 0);
    const erPen = Math.max(0, summary?.payrollTotalErPension ?? 0);
    const total = Math.max(1, net + tax + empPen + erPen);
    const raw = [
      { label: 'Net Payable', value: net, color: '#087CEB' },
      { label: 'Income Tax', value: tax, color: '#18243A' },
      { label: '7% Emp Pension', value: empPen, color: '#38BDF8' },
      { label: '11% Er Pension', value: erPen, color: '#10B981' },
    ];
    const radius = 56;
    const circumference = 2 * Math.PI * radius;
    let cumulative = 0;
    return raw.map((item) => {
      const pct = item.value / total;
      const dashLength = pct * circumference;
      const offset = -cumulative * circumference;
      cumulative += pct;
      return {
        ...item,
        pct: Math.round(pct * 1000) / 10,
        dashArray: `${dashLength} ${circumference}`,
        dashOffset: offset,
      };
    });
  }, [summary]);

  const salesStages = summary?.salesStageBreakdown ?? [];
  const maxStageVal = Math.max(1, ...salesStages.map((s) => s.value));

  const pendingActionCount =
    (summary?.pendingDepartmentApprovals ?? 0) +
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
      ['Payroll Absence Deduction', String(summary?.payrollAbsenceTotal ?? 0)],
      ['Payroll OT Normal Total', String(summary?.payrollOtNormalTotal ?? 0)],
      ['Payroll OT Night Total', String(summary?.payrollOtNightTotal ?? 0)],
      ['Payroll OT Sunday Total', String(summary?.payrollOtSundayTotal ?? 0)],
      ['Payroll OT Holiday Total', String(summary?.payrollOtHolidayTotal ?? 0)],
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

  const shareDashboardSummary = [
    `Active Workforce: ${summary?.activeEmployees ?? 0} / ${summary?.totalEmployees ?? 0}`,
    `Monthly Net Payroll: ${money(summary?.monthlyPayrollTotal ?? 0)}`,
    `Recognized Revenue: ${money(revenue)} | Surplus: ${money(surplus)}`,
    `Inventory Valuation: ${money(summary?.totalInventoryValue ?? 0)}`,
    `Pending Dept Approvals: ${summary?.pendingDepartmentApprovals ?? 0} | Active Gate Passes: ${summary?.activeGatePasses ?? 0}`,
  ].join('\n');

  const primaryCtaTarget: ModuleKey | null = allowedModules.includes('attendance')
    ? 'attendance'
    : allowedModules.includes('payroll')
      ? 'payroll'
      : allowedModules.includes('hr')
        ? 'hr'
        : null;

  return (
    <div className="space-y-6">
      {/* Corporate Identity & Action Header Card (Matching Seven Sunday Dashboard Banner Style) */}
      <div className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs">
        <span
          className="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 w-1.5 bg-[#087CEB]"
          aria-hidden="true"
        />
        <div className="pl-2 rtl:pl-0 rtl:pr-2 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          {/* Left Identity Block: Logo Box + Company Name & Slogans */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0">
            <div className="h-16 sm:h-18 px-4 py-2 bg-white border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center shrink-0">
              {!logoFailed ? (
                <img
                  src={logoSrc}
                  alt={company?.company_name || 'Seven Sunday Manufacturing & Trading PLC'}
                  referrerPolicy="no-referrer"
                  onError={() => setLogoFailed(true)}
                  className="h-10 sm:h-11 w-auto max-w-[165px] object-contain"
                />
              ) : (
                <span className="font-display text-sm font-bold text-[#18243A] whitespace-nowrap">
                  Seven Sunday
                </span>
              )}
            </div>

            <div className="min-w-0">
              <h2 className="font-display text-lg sm:text-xl font-bold text-[#172033] dark:text-white tracking-tight leading-snug">
                {company?.company_name || 'Seven Sunday Manufacturing & Trading PLC'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
                {company?.slogan || 'The Home of quality product'} ·{' '}
                {company?.secondary_slogan || 'Together for a Stronger and Better Tomorrow'}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                <span>{currency}</span>
                <span aria-hidden="true">·</span>
                <span>{company?.calendar_mode || 'Gregorian'}</span>
                <span aria-hidden="true">·</span>
                <span>{summary?.pendingDepartmentApprovals ?? 0} pending approvals</span>
                <span aria-hidden="true">·</span>
                <span>{summary?.activeGatePasses ?? 0} active gate passes</span>
              </div>
            </div>
          </div>

          {/* Right Signature Action Buttons matching Reference Layout */}
          <div className="no-print flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={exportExecutiveCsv}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#172033] dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
              Export Summary CSV
            </button>

            {allowedModules.includes('reports') && (
              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#172033] dark:text-sky-100 bg-[#DBEAFE] hover:bg-[#BFDBFE] dark:bg-sky-950/70 dark:hover:bg-sky-900/80 border border-[#93C5FD]/60 dark:border-sky-800 rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                <FileText className="w-3.5 h-3.5 text-[#172033] dark:text-[#38BDF8]" />
                Corporate Reports
              </button>
            )}

            {primaryCtaTarget && (
              <button
                type="button"
                onClick={() => onNavigate(primaryCtaTarget)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-xl transition-colors whitespace-nowrap shrink-0 shadow-xs"
              >
                <span>
                  {primaryCtaTarget === 'attendance'
                    ? 'Attendance & OT Register'
                    : primaryCtaTarget === 'payroll'
                      ? 'Payroll Sheet'
                      : 'HR Workforce'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Clean Secondary Quick Toolbar Row */}
        <div className="no-print pl-2 rtl:pl-0 rtl:pr-2 mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {allowedModules.includes('payroll') && (
              <button
                type="button"
                onClick={() => onNavigate('payroll')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Wallet className="w-3.5 h-3.5 text-[#087CEB]" />
                Payroll Sheet
              </button>
            )}
            {allowedModules.includes('gate-pass') && (
              <button
                type="button"
                onClick={() => onNavigate('gate-pass')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#087CEB]" />
                Single-Use Gate Pass
              </button>
            )}
            {allowedModules.includes('company-forms') && (
              <button
                type="button"
                onClick={() => onNavigate('company-forms')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <ClipboardCheck className="w-3.5 h-3.5 text-[#087CEB]" />
                Company Forms (305)
              </button>
            )}
            {allowedModules.includes('devices') && (
              <button
                type="button"
                onClick={() => onNavigate('devices')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Cpu className="w-3.5 h-3.5 text-[#087CEB]" />
                Device Connections
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ImportFilesButton
              compact
              company={company}
              onNavigate={onNavigate}
              onImported={() => window.dispatchEvent(new CustomEvent('sevensunday:data-imported'))}
            />
            <ShareButton
              title="Executive Operations & Financial Summary"
              reference={`DASH-${new Date().toISOString().slice(0, 10)}`}
              moduleName="Executive Dashboard"
              summary={shareDashboardSummary}
            />
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5 text-[#087CEB]" />
              Print Brief
            </button>
          </div>
        </div>
      </div>

      {/* Primary Executive KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Recognized Revenue</span>
            <span className="p-1.5 rounded-lg bg-[#EAF4FF] dark:bg-slate-800">
              <TrendingUp className="w-4 h-4 text-[#087CEB]" />
            </span>
          </div>
          <div className="mt-2.5 text-2xl font-bold text-[#172033] dark:text-white font-mono tabular-nums truncate">
            {money(revenue)}
          </div>
          <div className="mt-1.5 text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            Net Surplus: {money(surplus)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Net Payroll Payable</span>
            <span className="p-1.5 rounded-lg bg-[#EAF4FF] dark:bg-slate-800">
              <Wallet className="w-4 h-4 text-[#087CEB]" />
            </span>
          </div>
          <div className="mt-2.5 text-2xl font-bold text-[#172033] dark:text-white font-mono tabular-nums truncate">
            {money(summary?.monthlyPayrollTotal ?? 0)}
          </div>
          <div className="mt-1.5 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            OT +{money(summary?.totalOtPay ?? 0)} · Abs -{money(summary?.payrollAbsenceTotal ?? 0)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Active Workforce</span>
            <span className="p-1.5 rounded-lg bg-[#EAF4FF] dark:bg-slate-800">
              <Users className="w-4 h-4 text-[#087CEB]" />
            </span>
          </div>
          <div className="mt-2.5 text-2xl font-bold text-[#172033] dark:text-white font-mono tabular-nums">
            {summary?.activeEmployees ?? 0}{' '}
            <span className="text-sm font-normal text-slate-400">/ {summary?.totalEmployees ?? 0}</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {summary?.totalAttendanceToday ?? 0} attendance logs · {summary?.pendingLeaves ?? 0} leaves pending
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Inventory & Sales Pipeline</span>
            <span className="p-1.5 rounded-lg bg-[#EAF4FF] dark:bg-slate-800">
              <Package className="w-4 h-4 text-[#087CEB]" />
            </span>
          </div>
          <div className="mt-2.5 text-2xl font-bold text-[#172033] dark:text-white font-mono tabular-nums truncate">
            {money(summary?.totalInventoryValue ?? 0)}
          </div>
          <div className="mt-1.5 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Pipeline: {money(summary?.pipelineValue ?? 0)}
          </div>
        </div>
      </div>

      {/* EXECUTIVE CHARTS ROW 1: Grouped Monthly Financial Bar Chart + OT & Absence Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Grouped Vertical SVG Bar Chart: Revenue vs Operating Expenses vs Payroll Gross */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-[#172033] dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#087CEB]" />
                Monthly Revenue, Expenses & Payroll Bar Chart ({currency})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Hover any month column to inspect exact Revenue, Expense, Payroll Gross & Operating Surplus.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold">
              <span className="inline-flex items-center gap-1.5 text-[#18243A] dark:text-slate-200">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#18243A] dark:bg-[#087CEB]" />
                Revenue
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#087CEB]" />
                Expenses
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#38BDF8]" />
                Payroll Gross
              </span>
            </div>
          </div>

          {/* Interactive SVG Grouped Bar Chart */}
          <div className="w-full overflow-x-auto">
            <svg viewBox="0 0 640 245" className="w-full min-w-[460px] h-60 select-none">
              {[0, 0.25, 0.5, 0.75, 1].map((step) => {
                const y = 200 - step * 165;
                const val = maxTrendValue * step;
                return (
                  <g key={step}>
                    <line
                      x1="54"
                      y1={y}
                      x2="625"
                      y2={y}
                      stroke="currentColor"
                      className="text-slate-200 dark:text-slate-800"
                      strokeDasharray={step === 0 ? undefined : '3 3'}
                    />
                    <text
                      x="48"
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-mono"
                    >
                      {compactAxis(val)}
                    </text>
                  </g>
                );
              })}

              {monthlyTrend.map((pt, idx) => {
                const groupCount = monthlyTrend.length;
                const plotWidth = 560;
                const slotWidth = plotWidth / Math.max(1, groupCount);
                const centerX = 60 + idx * slotWidth + slotWidth / 2;
                const barW = Math.min(20, Math.max(11, Math.floor((slotWidth - 22) / 3)));
                const gap = 4;
                const revH = Math.max(4, (pt.revenue / maxTrendValue) * 165);
                const expH = Math.max(4, (pt.expenses / maxTrendValue) * 165);
                const payH = Math.max(4, (pt.payrollGross / maxTrendValue) * 165);
                const isHovered = hoveredMonthIdx === idx;

                return (
                  <g
                    key={pt.label}
                    onMouseEnter={() => setHoveredMonthIdx(idx)}
                    onMouseLeave={() => setHoveredMonthIdx(null)}
                    className="cursor-pointer"
                  >
                    {isHovered && (
                      <rect
                        x={centerX - slotWidth * 0.44}
                        y={24}
                        width={slotWidth * 0.88}
                        height={180}
                        rx="6"
                        className="fill-[#EAF4FF] dark:fill-slate-800/70"
                      />
                    )}
                    <rect
                      x={centerX - barW * 1.5 - gap}
                      y={200 - revH}
                      width={barW}
                      height={revH}
                      rx="3"
                      className={isHovered ? 'fill-[#087CEB]' : 'fill-[#18243A] dark:fill-[#0284C7]'}
                    />
                    <rect
                      x={centerX - barW * 0.5}
                      y={200 - expH}
                      width={barW}
                      height={expH}
                      rx="3"
                      fill="#087CEB"
                      opacity={isHovered ? 1 : 0.82}
                    />
                    <rect
                      x={centerX + barW * 0.5 + gap}
                      y={200 - payH}
                      width={barW}
                      height={payH}
                      rx="3"
                      fill="#38BDF8"
                    />
                    <text
                      x={centerX}
                      y={222}
                      textAnchor="middle"
                      className={`text-[11px] font-semibold ${
                        isHovered ? 'fill-[#087CEB]' : 'fill-slate-500 dark:fill-slate-400'
                      }`}
                    >
                      {pt.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Interactive Selected / Hovered Month Breakdown Strip */}
          {activeMonthPoint && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div className="p-2.5 bg-[#F8FAFC] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{activeMonthPoint.label} Revenue</div>
                <div className="font-mono font-bold text-[#172033] dark:text-white tabular-nums mt-0.5">
                  {money(activeMonthPoint.revenue)}
                </div>
              </div>
              <div className="p-2.5 bg-[#F8FAFC] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{activeMonthPoint.label} Expenses</div>
                <div className="font-mono font-bold text-[#087CEB] tabular-nums mt-0.5">
                  {money(activeMonthPoint.expenses)}
                </div>
              </div>
              <div className="p-2.5 bg-[#F8FAFC] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Payroll Gross</div>
                <div className="font-mono font-bold text-[#172033] dark:text-slate-200 tabular-nums mt-0.5">
                  {money(activeMonthPoint.payrollGross)}
                </div>
              </div>
              <div className="p-2.5 bg-[#F8FAFC] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Net Surplus</div>
                <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
                  {money(activeMonthPoint.revenue - activeMonthPoint.expenses)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Categorized Overtime (Nor, Night, Sun, Holly) & Absence Bar Chart */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-[#172033] dark:text-white">
                Overtime (Nor / Night / Sun / Holly) & Absence Chart
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Categorized OT earnings vs. Absence deduction ({currency})
              </p>
            </div>
            <div className="flex items-center gap-1 p-0.5 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]">
              <button
                type="button"
                onClick={() => setOtMetricMode('birr')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  otMetricMode === 'birr' ? 'bg-[#087CEB] text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Birr
              </button>
              <button
                type="button"
                onClick={() => setOtMetricMode('hours')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  otMetricMode === 'hours' ? 'bg-[#087CEB] text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Hours
              </button>
            </div>
          </div>

          <div className="w-full">
            <svg viewBox="0 0 420 205" className="w-full h-48 select-none">
              {[0, 0.33, 0.66, 1].map((step) => {
                const y = 165 - step * 135;
                const v = maxOtChartVal * step;
                return (
                  <g key={step}>
                    <line
                      x1="44"
                      y1={y}
                      x2="408"
                      y2={y}
                      stroke="currentColor"
                      className="text-slate-200 dark:text-slate-800"
                      strokeDasharray={step === 0 ? undefined : '3 3'}
                    />
                    <text x="39" y={y + 4} textAnchor="end" className="fill-slate-400 text-[9px] font-mono">
                      {otMetricMode === 'hours' ? `${v.toFixed(0)}h` : compactAxis(v)}
                    </text>
                  </g>
                );
              })}

              {otCategories.map((cat, idx) => {
                const slot = 356 / otCategories.length;
                const cx = 50 + idx * slot + slot / 2;
                const val = otMetricMode === 'hours' ? (cat.isAbsence ? 0 : cat.hours) : cat.birr;
                const h = Math.max(4, (val / maxOtChartVal) * 135);
                const isHov = hoveredOtIdx === idx;
                return (
                  <g
                    key={cat.key}
                    onMouseEnter={() => setHoveredOtIdx(idx)}
                    onMouseLeave={() => setHoveredOtIdx(null)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={cx - 18}
                      y={165 - h}
                      width={36}
                      height={h}
                      rx="4"
                      fill={cat.color}
                      opacity={hoveredOtIdx === null || isHov ? 1 : 0.55}
                    />
                    <text
                      x={cx}
                      y={159 - h}
                      textAnchor="middle"
                      className="fill-[#172033] dark:fill-slate-200 text-[9px] font-mono font-bold"
                    >
                      {otMetricMode === 'hours'
                        ? cat.isAbsence
                          ? '—'
                          : `${cat.hours.toFixed(1)}h`
                        : compactAxis(cat.birr)}
                    </text>
                    <text
                      x={cx}
                      y={184}
                      textAnchor="middle"
                      className={`text-[10px] font-semibold ${
                        cat.isAbsence ? 'fill-rose-600' : 'fill-slate-600 dark:fill-slate-300'
                      }`}
                    >
                      {cat.key}
                    </text>
                    <text
                      x={cx}
                      y={196}
                      textAnchor="middle"
                      className="fill-slate-400 text-[9px] font-mono"
                    >
                      {cat.isAbsence ? 'Deduct' : `${cat.multiplier}x`}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px]">
            {otCategories.map((cat, idx) => (
              <div
                key={cat.key}
                onMouseEnter={() => setHoveredOtIdx(idx)}
                onMouseLeave={() => setHoveredOtIdx(null)}
                className={`p-2 rounded-xl border transition-colors ${
                  hoveredOtIdx === idx
                    ? 'border-[#087CEB] bg-[#EAF4FF]/60 dark:bg-slate-800'
                    : 'border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">{cat.label}</span>
                  <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: cat.color }} />
                </div>
                <div
                  className={`font-mono font-bold tabular-nums mt-0.5 ${
                    cat.isAbsence ? 'text-rose-600 dark:text-rose-400' : 'text-[#172033] dark:text-white'
                  }`}
                >
                  {cat.isAbsence ? `-${money(cat.birr)}` : money(cat.birr)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* EXECUTIVE CHARTS ROW 2: Department Comparative Bar Chart + Statutory Payroll Donut Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Department Payroll & Workforce Bar Chart + Table (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-[#172033] dark:text-white">
                Department Workforce & Monthly Basic Payroll Bar Chart ({currency})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Active headcount distribution and salary commitment across {departments.length} departments
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-[#087CEB] tabular-nums">
              Basic Total: {money(summary?.payrollTotalBasic ?? 0)}
            </span>
          </div>

          {departments.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No active department headcount data available.
            </div>
          ) : (
            <div className="space-y-3">
              {departments.map((d, idx) => {
                const pct = Math.max(6, Math.round((d.monthlyBasic / maxDeptBasic) * 100));
                const isHov = hoveredDeptIdx === idx;
                return (
                  <div
                    key={d.department}
                    onMouseEnter={() => setHoveredDeptIdx(idx)}
                    onMouseLeave={() => setHoveredDeptIdx(null)}
                    className={`p-2 rounded-xl transition-colors ${
                      isHov ? 'bg-[#F8FAFC] dark:bg-slate-800/60' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-[#172033] dark:text-white truncate">{d.department}</span>
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          ({d.headcount} staff)
                        </span>
                      </div>
                      <span className="font-mono font-bold text-[#172033] dark:text-white tabular-nums shrink-0">
                        {money(d.monthlyBasic)}
                      </span>
                    </div>
                    <div className="h-3 w-full bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded overflow-hidden">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: isHov ? '#087CEB' : idx % 2 === 0 ? '#18243A' : '#0EA5E9',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sales Pipeline Stage Bar Chart if Sales CRM allowed */}
          {allowedModules.includes('sales-crm') && salesStages.length > 0 && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#172033] dark:text-white">
                  Sales & CRM Pipeline by Stage ({currency})
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('sales-crm')}
                  className="font-semibold text-[#087CEB] hover:underline"
                >
                  Open Pipeline
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {salesStages.map((st) => {
                  const hPct = Math.max(12, Math.round((st.value / maxStageVal) * 100));
                  return (
                    <div
                      key={st.stage}
                      className="p-2.5 bg-[#F8FAFC] dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col justify-between"
                    >
                      <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                        {st.stage} ({st.count})
                      </div>
                      <div className="h-10 flex items-end my-1.5">
                        <div
                          className="w-full bg-[#087CEB] rounded-t"
                          style={{ height: `${hPct}%` }}
                        />
                      </div>
                      <div className="font-mono text-[11px] font-bold text-[#172033] dark:text-white tabular-nums truncate">
                        {compactAxis(st.value)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Statutory Payroll Donut Chart & Obligations Breakdown (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-[#172033] dark:text-white">
                Payroll & Statutory Allocation Chart
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
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

          {/* Interactive SVG Donut Chart */}
          <div className="flex flex-col sm:flex-row items-center gap-5 py-1">
            <svg viewBox="0 0 150 150" className="w-36 h-36 shrink-0">
              <g transform="rotate(-90 75 75)">
                <circle
                  cx="75"
                  cy="75"
                  r="56"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="20"
                  className="text-slate-100 dark:text-slate-800"
                />
                {donutSegments.map((seg, idx) => (
                  <circle
                    key={seg.label}
                    cx="75"
                    cy="75"
                    r="56"
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={hoveredSliceIdx === idx ? 24 : 20}
                    strokeDasharray={seg.dashArray}
                    strokeDashoffset={seg.dashOffset}
                    className="cursor-pointer transition-all duration-200"
                    onMouseEnter={() => setHoveredSliceIdx(idx)}
                    onMouseLeave={() => setHoveredSliceIdx(null)}
                  />
                ))}
              </g>
              <text
                x="75"
                y="70"
                textAnchor="middle"
                className="fill-slate-500 dark:fill-slate-400 text-[9px] font-semibold"
              >
                {hoveredSliceIdx !== null ? donutSegments[hoveredSliceIdx].label : 'Net Share'}
              </text>
              <text
                x="75"
                y="86"
                textAnchor="middle"
                className="fill-[#172033] dark:fill-white text-[14px] font-bold font-mono"
              >
                {hoveredSliceIdx !== null
                  ? `${donutSegments[hoveredSliceIdx].pct}%`
                  : `${donutSegments[0]?.pct ?? 0}%`}
              </text>
            </svg>

            <div className="flex-1 w-full space-y-2 text-xs">
              {donutSegments.map((seg, idx) => (
                <div
                  key={seg.label}
                  onMouseEnter={() => setHoveredSliceIdx(idx)}
                  onMouseLeave={() => setHoveredSliceIdx(null)}
                  className={`flex items-center justify-between gap-2 px-2 py-1 rounded cursor-pointer ${
                    hoveredSliceIdx === idx ? 'bg-[#F8FAFC] dark:bg-slate-800' : ''
                  }`}
                >
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: seg.color }} />
                    {seg.label}
                  </span>
                  <span className="font-mono font-semibold text-[#172033] dark:text-white tabular-nums">
                    {seg.pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {[
              { label: 'Total Basic Salary', val: summary?.payrollTotalBasic ?? 0 },
              { label: 'Absence Deduction (-)', val: -(summary?.payrollAbsenceTotal ?? 0), neg: true },
              { label: 'Categorized Overtime (+)', val: summary?.totalOtPay ?? 0 },
              { label: 'Total Gross Pay', val: summary?.payrollTotalGross ?? 0 },
              { label: 'Ethiopian Income Tax Withheld', val: summary?.payrollTotalTax ?? 0 },
              { label: 'Employee Pension (7%)', val: summary?.payrollTotalEmpPension ?? 0 },
              { label: 'Employer Pension Contribution (11%)', val: summary?.payrollTotalErPension ?? 0 },
              { label: 'Net Salary Payable', val: summary?.monthlyPayrollTotal ?? 0, strong: true },
            ].map((row) => (
              <div key={row.label} className="py-2 flex items-center justify-between gap-2">
                <span className={row.strong ? 'font-bold text-[#172033] dark:text-white' : 'text-slate-600 dark:text-slate-400'}>
                  {row.label}
                </span>
                <span
                  className={`font-mono tabular-nums ${
                    row.strong
                      ? 'font-bold text-sm text-[#087CEB]'
                      : row.neg
                        ? 'font-semibold text-rose-600 dark:text-rose-400'
                        : 'font-semibold text-[#172033] dark:text-slate-200'
                  }`}
                >
                  {money(row.val)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Module Quick-Access Directory */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#172033] dark:text-white">
            Enterprise Modules & Operational Overview
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Select any module card to open live records
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <button
              key={card.title}
              type="button"
              onClick={() => onNavigate(card.module)}
              className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#087CEB] rounded-2xl p-4 transition-colors group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 group-hover:text-[#087CEB] transition-colors">
                  {card.title}
                </span>
                {card.icon}
              </div>
              <div className="text-lg font-bold text-[#172033] dark:text-white font-mono tabular-nums truncate">
                {card.value}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{card.detail}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Executive Action Queue & Live Audit Feed */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-[#172033] dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#087CEB]" />
              Executive Action Queue & Audit Feed
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
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

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
          {[
            { label: 'Dept Approvals', count: summary?.pendingDepartmentApprovals ?? 0, mod: 'approvals' as ModuleKey },
            { label: 'Active Gate Pass', count: summary?.activeGatePasses ?? 0, mod: 'gate-pass' as ModuleKey },
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
              className="text-left p-3 bg-[#F8FAFC] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-xl transition-colors"
            >
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{item.label}</div>
              <div className="text-base font-bold font-mono tabular-nums text-[#172033] dark:text-white mt-0.5">
                {item.count}
              </div>
            </button>
          ))}
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {(summary?.recentAuditLogs ?? []).slice(0, 6).map((log) => (
            <div key={log.id} className="py-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-[#172033] dark:text-slate-200 truncate">{log.summary}</div>
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
  );
};
