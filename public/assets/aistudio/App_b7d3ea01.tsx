import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bell,
  BookOpen,
  CalendarOff,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Cpu,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Globe,
  HardDriveUpload,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Package,
  PackageCheck,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Sun,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { api, getApiActorHeaders, setApiActor } from './api';
import { AdminModule, DEFAULT_RBAC_MATRIX } from './components/AdminModule';
import { AssetsVehiclesModule } from './components/AssetsVehiclesModule';
import { AttendanceModule } from './components/AttendanceModule';
import { ChatModule } from './components/ChatModule';
import { CompanyFormsModule } from './components/CompanyFormsModule';
import { DashboardModule } from './components/DashboardModule';
import { DevicesModule } from './components/DevicesModule';
import { FinanceModule } from './components/FinanceModule';
import { HrPayrollModule } from './components/HrPayrollModule';
import { LeaveModule } from './components/LeaveModule';
import { LoginScreen } from './components/LoginScreen';
import { OperationsCenterModule } from './components/OperationsCenterModule';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { ReportsModule } from './components/ReportsModule';
import { SalesCrmModule } from './components/SalesCrmModule';
import { SecretaryModule } from './components/SecretaryModule';
import { SupplyChainModule, type SupplyChainTab } from './components/SupplyChainModule';
import { useOnlineStatus } from './hooks/usePWAInstall';
import { useRealtimeWS, type WsEventPayload } from './hooks/useRealtimeWS';
import { getPendingQueue, syncQueuedMutations } from './offline/syncEngine';
import type {
  CompanySettings,
  DashboardSummary,
  GlobalSearchResult,
  ModuleKey,
  NotificationItem,
  UserAccount,
  UserRole,
} from './types';
import { UI_LABELS, type AppLang } from './utils/ethiopianCalendar';

const ALL_MODULE_KEYS: ModuleKey[] = [
  'dashboard',
  'approvals',
  'admin',
  'hr',
  'devices',
  'attendance',
  'leave',
  'payroll',
  'secretary',
  'company-forms',
  'materials',
  'material-requests',
  'grn',
  'gin',
  'procurement',
  'purchasing',
  'sales-crm',
  'finance',
  'assets',
  'vehicles',
  'reports',
  'chat',
  'audit',
  'sync',
];

function getAllowedModules(role: UserRole, rbacMatrixJson?: string): ModuleKey[] {
  if (rbacMatrixJson) {
    try {
      const parsed = JSON.parse(rbacMatrixJson) as Partial<Record<UserRole, ModuleKey[]>>;
      const configured = parsed?.[role];
      if (Array.isArray(configured) && configured.length > 0) {
        const filtered = configured.filter((k) => ALL_MODULE_KEYS.includes(k));
        if (
          !filtered.includes('company-forms') &&
          role !== 'Viewer' &&
          (role === 'Super Administrator' ||
            role === 'Company Owner' ||
            role === 'General Manager' ||
            filtered.includes('secretary') ||
            filtered.includes('hr') ||
            filtered.includes('attendance'))
        ) {
          return [...filtered, 'company-forms'];
        }
        return filtered;
      }
    } catch {
      // fall back to default RBAC matrix
    }
  }
  return DEFAULT_RBAC_MATRIX[role] || ['dashboard', 'chat'];
}

interface NavGroup {
  label: string;
  items: Array<{ key: ModuleKey; labelKey?: string; fallbackLabel: string; icon: React.ReactNode }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Command & Overview',
    items: [
      { key: 'dashboard', labelKey: 'dashboard', fallbackLabel: 'Executive Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
      { key: 'approvals', fallbackLabel: 'Approvals & Alerts', icon: <Bell className="w-4 h-4" /> },
      { key: 'reports', fallbackLabel: 'Corporate Reports & Exports', icon: <FileSpreadsheet className="w-4 h-4" /> },
    ],
  },
  {
    label: 'HR, Attendance & Admin',
    items: [
      { key: 'admin', fallbackLabel: 'Company Administration', icon: <Settings className="w-4 h-4" /> },
      { key: 'hr', labelKey: 'hr', fallbackLabel: 'HR & Staff ID Cards', icon: <Users className="w-4 h-4" /> },
      { key: 'devices', labelKey: 'devices', fallbackLabel: 'Real Device Connections', icon: <Cpu className="w-4 h-4" /> },
      { key: 'attendance', labelKey: 'attendance', fallbackLabel: 'Attendance Register & OT', icon: <Clock className="w-4 h-4" /> },
      { key: 'leave', labelKey: 'leave', fallbackLabel: 'Leave Management', icon: <CalendarOff className="w-4 h-4" /> },
      { key: 'payroll', labelKey: 'payroll', fallbackLabel: 'Payroll & Ethiopian Tax', icon: <Wallet className="w-4 h-4" /> },
      { key: 'secretary', labelKey: 'secretary', fallbackLabel: 'Secretary & A4 Documents', icon: <FileText className="w-4 h-4" /> },
      { key: 'company-forms', fallbackLabel: 'Company Forms & Evaluations', icon: <ClipboardCheck className="w-4 h-4" /> },
    ],
  },
  {
    label: 'Inventory & Supply Chain',
    items: [
      { key: 'materials', labelKey: 'materials', fallbackLabel: 'Materials', icon: <Package className="w-4 h-4" /> },
      { key: 'material-requests', fallbackLabel: 'Materials Request', icon: <ClipboardList className="w-4 h-4" /> },
      { key: 'grn', fallbackLabel: 'Goods Receiving (GRN)', icon: <PackageCheck className="w-4 h-4" /> },
      { key: 'gin', fallbackLabel: 'Issuing (GIN) & Audit', icon: <FileCheck2 className="w-4 h-4" /> },
      { key: 'procurement', fallbackLabel: 'Procurement', icon: <ShoppingBag className="w-4 h-4" /> },
      { key: 'purchasing', fallbackLabel: 'Purchasing', icon: <ShoppingCart className="w-4 h-4" /> },
    ],
  },
  {
    label: 'Commercial, Finance & Fleet',
    items: [
      { key: 'sales-crm', fallbackLabel: 'Sales & CRM', icon: <TrendingUp className="w-4 h-4" /> },
      { key: 'finance', labelKey: 'finance', fallbackLabel: 'Finance & Accounting', icon: <BookOpen className="w-4 h-4" /> },
      { key: 'assets', fallbackLabel: 'Uniforms & Assets', icon: <Shield className="w-4 h-4" /> },
      { key: 'vehicles', fallbackLabel: 'Vehicles & Maintenance', icon: <Truck className="w-4 h-4" /> },
    ],
  },
  {
    label: 'Collaboration & System',
    items: [
      { key: 'chat', labelKey: 'chat', fallbackLabel: 'Internal Corporate Chat', icon: <MessageSquare className="w-4 h-4" /> },
      { key: 'audit', fallbackLabel: 'Immutable Audit Trail', icon: <Activity className="w-4 h-4" /> },
      { key: 'sync', fallbackLabel: 'Offline Sync & Backup', icon: <HardDriveUpload className="w-4 h-4" /> },
    ],
  },
];

const MODULE_TITLES: Record<ModuleKey, string> = {
  dashboard: 'Executive Overview',
  approvals: 'Approvals & Notifications',
  admin: 'Company Administration & Master Settings',
  hr: 'Human Resources, Registration Format & QR Staff IDs',
  devices: 'Real Connection Device Management',
  attendance: 'Attendance Register & Overtime Multipliers',
  leave: 'Leave Management',
  payroll: 'Payroll, Bonus & Ethiopian Statutory Tax Rules',
  secretary: 'Secretary Department & A4 Official Company Documents',
  'company-forms': 'Complete Company Forms (16 Departments) & Staff Evaluation',
  materials: 'Materials Master Catalog & Movements',
  'material-requests': 'Materials Request',
  grn: 'Goods Receiving (GRN)',
  gin: 'Issuing (GIN) & Audit',
  procurement: 'Procurement & RFQ Tenders',
  purchasing: 'Purchasing Orders',
  'sales-crm': 'Sales & CRM',
  finance: 'Finance & Double-Entry Accounting',
  assets: 'Staff Uniforms, PPE & Company Assets',
  vehicles: 'Fleet Vehicles & Maintenance Log',
  reports: 'Corporate Reports & Data Exports',
  chat: 'Internal Corporate Chat',
  audit: 'Immutable Security & Activity Audit Trail',
  sync: 'Offline Synchronization, Local DB & Backup Center',
};

const SUPPLY_CHAIN_KEYS: ModuleKey[] = [
  'materials',
  'material-requests',
  'grn',
  'gin',
  'procurement',
  'purchasing',
];

const SESSION_KEY = 'seven_sunday_session_user';
const THEME_KEY = 'seven_sunday_theme';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as UserAccount;
        setApiActor(parsed.full_name, parsed.role);
        return parsed;
      }
    } catch {
      // ignore invalid session
    }
    return null;
  });

  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');
  const [supplySubTab, setSupplySubTab] = useState<SupplyChainTab>('materials');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [lang, setLang] = useState<AppLang>('en');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark';
    } catch {
      return false;
    }
  });
  const [globalSearch, setGlobalSearch] = useState('');
  const [dbSearchResults, setDbSearchResults] = useState<GlobalSearchResult[]>([]);
  const [searchingDb, setSearchingDb] = useState(false);
  const [lastWsEvent, setLastWsEvent] = useState<WsEventPayload | null>(null);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);

  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(THEME_KEY, 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    if (SUPPLY_CHAIN_KEYS.includes(activeModule)) {
      setSupplySubTab(activeModule as SupplyChainTab);
    }
  }, [activeModule]);

  const refreshQueueCount = useCallback(async () => {
    const q = await getPendingQueue();
    setPendingQueueCount(q.length);
  }, []);

  const refreshCompanyAndSummary = useCallback(async () => {
    try {
      const s = await api.get<CompanySettings>('/api/company-settings');
      setCompany(s);
      if (s?.default_language && ['en', 'am', 'om', 'zh'].includes(s.default_language)) {
        setLang(s.default_language);
      }
    } catch {
      // ignore initial transient error
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [sumData, notifData] = await Promise.all([
        api.get<DashboardSummary>('/api/dashboard'),
        api.get<NotificationItem[]>('/api/notifications'),
      ]);
      setSummary(sumData);
      setNotifications(notifData);
    } catch {
      // ignore transient offline fetch failures
    }
  }, [currentUser]);

  useEffect(() => {
    refreshCompanyAndSummary();
    refreshQueueCount();
    const handler = () => {
      refreshQueueCount();
    };
    window.addEventListener('sevensunday-sync-queue-updated', handler);
    window.addEventListener('seven-sunday-sync-updated', handler);
    return () => {
      window.removeEventListener('sevensunday-sync-queue-updated', handler);
      window.removeEventListener('seven-sunday-sync-updated', handler);
    };
  }, [refreshCompanyAndSummary, refreshQueueCount]);

  useEffect(() => {
    if (currentUser) {
      refreshDashboard();
    }
  }, [currentUser, refreshDashboard]);

  // Global database search across employees, documents, materials, finance vouchers, devices, deals
  useEffect(() => {
    const q = globalSearch.trim();
    if (!currentUser || q.length < 2) {
      setDbSearchResults([]);
      setSearchingDb(false);
      return;
    }
    let cancelled = false;
    setSearchingDb(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await api.get<GlobalSearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`);
        if (!cancelled) {
          setDbSearchResults(res);
        }
      } catch {
        if (!cancelled) setDbSearchResults([]);
      } finally {
        if (!cancelled) setSearchingDb(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [globalSearch, currentUser]);

  // Automatic background synchronization when network restores
  useEffect(() => {
    if (isOnline && pendingQueueCount > 0) {
      syncQueuedMutations(getApiActorHeaders()).then(() => {
        refreshQueueCount();
        refreshDashboard();
      });
    }
  }, [isOnline, pendingQueueCount, refreshQueueCount, refreshDashboard]);

  const { connected: wsConnected, onlineUsers } = useRealtimeWS((evt) => {
    setLastWsEvent(evt);
    if (evt.event !== 'presence:count') {
      refreshDashboard();
    }
  });

  const allowedModules = useMemo<ModuleKey[]>(() => {
    if (!currentUser) return [];
    return getAllowedModules(currentUser.role, company?.rbac_matrix);
  }, [currentUser, company?.rbac_matrix]);

  useEffect(() => {
    if (currentUser && !allowedModules.includes(activeModule)) {
      setActiveModule(allowedModules[0] || 'dashboard');
    }
  }, [currentUser, allowedModules, activeModule]);

  const handleLogin = (user: UserAccount) => {
    setApiActor(user.full_name, user.role);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    setCurrentUser(user);
    setActiveModule('dashboard');
  };

  const handleSignOut = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
  };

  const handleSelectModule = (key: ModuleKey) => {
    if (!allowedModules.includes(key)) return;
    setActiveModule(key);
    setSidebarOpen(false);
    setGlobalSearch('');
    setDbSearchResults([]);
  };

  if (!currentUser) {
    return <LoginScreen company={company} onLogin={handleLogin} />;
  }

  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((it) => allowedModules.includes(it.key)),
  })).filter((g) => g.items.length > 0);

  const searchMatches = globalSearch.trim()
    ? visibleGroups
        .flatMap((g) => g.items)
        .filter((it) => {
          const label = it.labelKey ? UI_LABELS[lang]?.[it.labelKey] || it.fallbackLabel : it.fallbackLabel;
          return (
            label.toLowerCase().includes(globalSearch.toLowerCase()) ||
            MODULE_TITLES[it.key].toLowerCase().includes(globalSearch.toLowerCase())
          );
        })
    : [];

  const filteredDbResults = dbSearchResults.filter((r) => allowedModules.includes(r.module));

  const isSupplyChain = SUPPLY_CHAIN_KEYS.includes(activeModule);
  const currency = company?.default_currency || 'ETB';
  const calendarMode = company?.calendar_mode || 'Gregorian';
  const logoSrc =
    company?.logo_data && company.logo_data.startsWith('data:')
      ? company.logo_data
      : '/assets/aistudio/Seven_Sunday_Logo_2_desktop_addf2fa7.png';

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-slate-950 text-[#172033] dark:text-slate-100">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-[#18243A]/60 z-30 lg:hidden no-print"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar (264px) — Secondary #18243A with White text & #087CEB active indicator */}
      <aside
        className={`no-print fixed lg:sticky top-0 left-0 z-40 h-screen w-[264px] shrink-0 bg-[#18243A] text-white border-r border-slate-800 flex flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 px-4 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleSelectModule('dashboard')}
            className="flex items-center gap-2 text-left min-w-0"
          >
            <img
              src={logoSrc}
              alt="Seven Sunday Ethiopia"
              className="h-9 w-auto max-w-[180px] object-contain bg-[#FFFFFF] rounded-lg px-2 py-1 shrink-0"
            />
          </button>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-white/70 hover:text-white rounded-lg"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#7DD3FC]/90">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = activeModule === item.key;
                  const label = item.labelKey
                    ? UI_LABELS[lang]?.[item.labelKey] || item.fallbackLabel
                    : item.fallbackLabel;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleSelectModule(item.key)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-colors text-left whitespace-nowrap ${
                        active
                          ? 'bg-[#087CEB] text-white font-bold shadow-sm'
                          : 'text-white/85 font-medium hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className={active ? 'text-white' : 'text-[#38BDF8]'}>
                        {item.icon}
                      </span>
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10 bg-[#121C2E] flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/assets/aistudio/Seven_Sunday_app_icon_e967a609.png"
              alt="Seven Sunday EMS"
              className="w-8 h-8 rounded-lg border border-[#087CEB]/35 bg-[#FFFFFF] object-contain p-0.5 shrink-0"
            />
            <div className="min-w-0">
              <div className="font-semibold text-white truncate">{currentUser.full_name}</div>
              <div className="text-[11px] text-[#38BDF8] font-medium truncate">{currentUser.role}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            title="Sign Out"
            className="p-1.5 text-white/70 hover:text-red-300 rounded-lg hover:bg-white/10 shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        <OfflineIndicator pendingCount={pendingQueueCount} />

        <header className="no-print h-16 bg-[#FFFFFF] dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-[#172033] dark:text-slate-300 hover:bg-[#F8FAFC] rounded-lg border border-slate-200 dark:border-slate-700"
              aria-label="Open navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-[#18243A] dark:text-[#38BDF8] font-semibold whitespace-nowrap hidden xl:inline">
                {company?.brand_name || 'Seven Sunday Ethiopia'}
              </span>
              <span className="text-slate-300 dark:text-slate-700 hidden xl:inline">/</span>
              <h1 className="font-display font-bold text-[#172033] dark:text-white truncate">
                {MODULE_TITLES[activeModule]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Global Enterprise Search (Modules + Live SQLite Database Records) */}
            <div className="relative hidden md:block">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Global search (employees, docs, SKUs...)"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setGlobalSearch('');
                    setDbSearchResults([]);
                  }
                }}
                className="pl-8 pr-7 py-1.5 text-xs bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg w-48 lg:w-64 focus:outline-none focus:border-[#087CEB]"
              />
              {globalSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setGlobalSearch('');
                    setDbSearchResults([]);
                  }}
                  aria-label="Clear search"
                  className="absolute right-2 top-2 text-slate-400 hover:text-[#172033]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {globalSearch.trim().length > 0 && (
                <div className="absolute right-0 mt-1.5 w-80 sm:w-96 bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-2 z-50 max-h-96 overflow-y-auto">
                  {searchMatches.length > 0 && (
                    <div className="px-2 pb-1">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Modules
                      </div>
                      {searchMatches.slice(0, 5).map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => handleSelectModule(m.key)}
                          className="w-full px-2.5 py-2 text-left text-xs text-[#172033] dark:text-slate-200 hover:bg-[#EAF4FF] dark:hover:bg-slate-800 rounded-lg flex items-center gap-2"
                        >
                          <span className="text-[#087CEB]">{m.icon}</span>
                          <span className="truncate font-semibold">{MODULE_TITLES[m.key]}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="px-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Database Records</span>
                      {searchingDb && <span className="text-[#087CEB]">Searching...</span>}
                    </div>
                    {filteredDbResults.length === 0 ? (
                      <div className="px-2.5 py-2 text-xs text-slate-500">
                        {globalSearch.trim().length < 2
                          ? 'Type at least 2 characters to search live records...'
                          : searchingDb
                          ? 'Querying database...'
                          : 'No matching records found.'}
                      </div>
                    ) : (
                      filteredDbResults.slice(0, 10).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectModule(item.module)}
                          className="w-full px-2.5 py-2 text-left hover:bg-[#EAF4FF] dark:hover:bg-slate-800 rounded-lg flex items-start justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[#172033] dark:text-white truncate">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {item.subtitle}
                            </div>
                          </div>
                          <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded bg-[#18243A] text-[#38BDF8]">
                            {item.category}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Language Switcher */}
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
              <Globe className="w-3.5 h-3.5 text-[#18243A] dark:text-[#38BDF8]" />
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as AppLang)}
                aria-label="Language switcher"
                className="text-xs font-semibold bg-transparent text-[#172033] dark:text-slate-200 focus:outline-none"
              >
                <option value="en" className="text-[#172033]">EN</option>
                <option value="am" className="text-[#172033]">አማርኛ</option>
                <option value="om" className="text-[#172033]">Oromoo</option>
                <option value="zh" className="text-[#172033]">中文</option>
              </select>
            </div>

            {/* Dark / Light Theme Toggle */}
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2 text-[#172033] dark:text-slate-300 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg transition-colors"
            >
              {darkMode ? <Sun className="w-4 h-4 text-[#38BDF8]" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notifications Bell */}
            {allowedModules.includes('approvals') && (
              <button
                type="button"
                onClick={() => handleSelectModule('approvals')}
                title="Approvals & Notifications"
                className="relative p-2 text-[#172033] dark:text-slate-300 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg transition-colors"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#087CEB] text-white text-[10px] font-bold flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </button>
            )}

            <PWAInstallButton />

            {allowedModules.includes('chat') && (
              <button
                type="button"
                onClick={() => handleSelectModule('chat')}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Corporate Chat</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activeModule === 'dashboard' && (
            <DashboardModule
              summary={summary}
              company={company}
              onNavigate={handleSelectModule}
              allowedModules={allowedModules}
            />
          )}
          {activeModule === 'admin' && (
            <AdminModule
              settings={company}
              onSettingsUpdated={(updated) => {
                setCompany(updated);
                if (updated.default_language) setLang(updated.default_language);
              }}
              onRefreshDashboard={refreshDashboard}
            />
          )}
          {activeModule === 'hr' && (
            <HrPayrollModule
              mode="hr"
              currency={currency}
              company={company}
              onRefreshDashboard={refreshDashboard}
            />
          )}
          {activeModule === 'payroll' && (
            <HrPayrollModule
              mode="payroll"
              currency={currency}
              company={company}
              onRefreshDashboard={refreshDashboard}
            />
          )}
          {activeModule === 'devices' && <DevicesModule onRefreshDashboard={refreshDashboard} />}
          {activeModule === 'attendance' && (
            <AttendanceModule
              currency={currency}
              calendarMode={calendarMode}
              onRefreshDashboard={refreshDashboard}
            />
          )}
          {activeModule === 'leave' && <LeaveModule onRefreshDashboard={refreshDashboard} />}
          {activeModule === 'secretary' && (
            <SecretaryModule company={company} onRefreshDashboard={refreshDashboard} />
          )}
          {activeModule === 'company-forms' && (
            <CompanyFormsModule company={company} onRefreshDashboard={refreshDashboard} />
          )}
          {isSupplyChain && (
            <SupplyChainModule
              activeTab={supplySubTab}
              onTabChange={(tab) => {
                if (SUPPLY_CHAIN_KEYS.includes(tab as ModuleKey)) {
                  handleSelectModule(tab as ModuleKey);
                } else {
                  setSupplySubTab(tab);
                }
              }}
              onRefreshDashboard={refreshDashboard}
            />
          )}
          {activeModule === 'sales-crm' && <SalesCrmModule onRefreshDashboard={refreshDashboard} />}
          {activeModule === 'finance' && (
            <FinanceModule
              company={company}
              currency={currency}
              onRefreshDashboard={refreshDashboard}
            />
          )}
          {activeModule === 'assets' && (
            <AssetsVehiclesModule mode="assets" currency={currency} onRefreshDashboard={refreshDashboard} />
          )}
          {activeModule === 'vehicles' && (
            <AssetsVehiclesModule mode="vehicles" currency={currency} onRefreshDashboard={refreshDashboard} />
          )}
          {activeModule === 'reports' && (
            <ReportsModule company={company} currency={currency} />
          )}
          {activeModule === 'chat' && (
            <ChatModule
              currentUser={currentUser}
              wsConnected={wsConnected}
              onlineUsers={onlineUsers}
              lastWsEvent={lastWsEvent}
              onRefreshDashboard={refreshDashboard}
            />
          )}
          {(activeModule === 'approvals' || activeModule === 'audit' || activeModule === 'sync') && (
            <OperationsCenterModule
              mode={activeModule}
              isOnline={isOnline}
              onNavigate={handleSelectModule}
            />
          )}
        </main>
      </div>
    </div>
  );
}
