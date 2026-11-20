import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bell,
  BookOpen,
  Building2,
  CalendarClock,
  CalendarOff,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Cpu,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FileUp,
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
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sun,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { api, getApiActorHeaders, getApiTenantId, setApiActor, setApiTenant } from './api';
import { AdminModule, DEFAULT_RBAC_MATRIX } from './components/AdminModule';
import { AssetsVehiclesModule } from './components/AssetsVehiclesModule';
import { AttendanceModule } from './components/AttendanceModule';
import { ChatModule } from './components/ChatModule';
import { CompanyFormsModule } from './components/CompanyFormsModule';
import { DashboardModule } from './components/DashboardModule';
import { DevicesModule } from './components/DevicesModule';
import { FinanceModule } from './components/FinanceModule';
import { GatePassModule } from './components/GatePassModule';
import { HrPayrollModule } from './components/HrPayrollModule';
import { ImportFilesModal } from './components/ImportFilesModal';
import { LeaveModule } from './components/LeaveModule';
import { LoginScreen } from './components/LoginScreen';
import { OperationsCenterModule } from './components/OperationsCenterModule';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { ReportsModule } from './components/ReportsModule';
import { SalesCrmModule } from './components/SalesCrmModule';
import { SchedulingModule } from './components/SchedulingModule';
import { SecretaryModule } from './components/SecretaryModule';
import { SupplyChainModule, type SupplyChainTab } from './components/SupplyChainModule';
import { ALL_COMPANY_FORMS } from './data/companyFormsCatalog';
import { useOnlineStatus } from './hooks/usePWAInstall';
import { useRealtimeWS, type WsEventPayload } from './hooks/useRealtimeWS';
import { getPendingQueue, syncQueuedMutations } from './offline/syncEngine';
import type {
  CompanySettings,
  DashboardSummary,
  GlobalSearchResult,
  ModuleKey,
  NotificationItem,
  PlatformConfig,
  TenantRecord,
  UserAccount,
  UserRole,
} from './types';
import {
  LANGUAGE_OPTIONS,
  translateUi,
  type AppLang,
} from './utils/ethiopianCalendar';
import {
  parsePlatformConfig,
  setCustomApprovingDepartmentsGlobal,
} from './utils/platformConfig';
import { installGlobalBeforePrintFit } from './utils/printFit';

const ALL_MODULE_KEYS: ModuleKey[] = [
  'dashboard',
  'approvals',
  'admin',
  'hr',
  'devices',
  'attendance',
  'scheduling',
  'leave',
  'payroll',
  'secretary',
  'company-forms',
  'gate-pass',
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

const VALID_LANGS: AppLang[] = ['en', 'am', 'om', 'ti', 'ar', 'zh'];

function getAllowedModules(
  role: UserRole,
  rbacMatrixJson?: string,
  platformConfig?: PlatformConfig
): ModuleKey[] {
  const disabledSet = new Set<ModuleKey>(platformConfig?.disabled_modules || []);

  // System Administrator always sees every module across all tenants & can customize everything
  if (role === 'System Administrator') {
    return ALL_MODULE_KEYS;
  }

  let base: ModuleKey[] = DEFAULT_RBAC_MATRIX[role] || ['dashboard', 'chat'];
  if (rbacMatrixJson) {
    try {
      const parsed = JSON.parse(rbacMatrixJson) as Partial<Record<UserRole, ModuleKey[]>>;
      const configured = parsed?.[role];
      if (Array.isArray(configured) && configured.length > 0) {
        const filtered = configured.filter((k) => ALL_MODULE_KEYS.includes(k));
        if (role !== 'Viewer') {
          if (
            !filtered.includes('company-forms') &&
            (role === 'Super Administrator' ||
              role === 'Company Owner' ||
              role === 'General Manager' ||
              filtered.includes('secretary') ||
              filtered.includes('hr') ||
              filtered.includes('attendance'))
          ) {
            filtered.push('company-forms');
          }
          if (
            !filtered.includes('gate-pass') &&
            (role === 'Super Administrator' ||
              role === 'Company Owner' ||
              role === 'General Manager' ||
              role === 'Security Supervisor' ||
              filtered.includes('hr') ||
              filtered.includes('materials'))
          ) {
            filtered.push('gate-pass');
          }
        }
        base = filtered;
      }
    } catch {
      // fall back to default RBAC matrix
    }
  }

  return base.filter((k) => {
    if (k === 'dashboard') return true;
    if (k === 'admin' && role === 'Super Administrator') return true;
    return !disabledSet.has(k);
  });
}

interface NavGroup {
  labelKey: string;
  fallbackGroupLabel: string;
  items: Array<{ key: ModuleKey; fallbackLabel: string; icon: React.ReactNode }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'group_command',
    fallbackGroupLabel: 'Command & Overview',
    items: [
      { key: 'dashboard', fallbackLabel: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
      { key: 'approvals', fallbackLabel: 'Approvals & Alerts', icon: <Bell className="w-4 h-4" /> },
      { key: 'reports', fallbackLabel: 'Corporate Reports & Exports', icon: <FileSpreadsheet className="w-4 h-4" /> },
    ],
  },
  {
    labelKey: 'group_hr_admin',
    fallbackGroupLabel: 'HR, Attendance & Admin',
    items: [
      { key: 'admin', fallbackLabel: 'System & Company Admin', icon: <Settings className="w-4 h-4" /> },
      { key: 'hr', fallbackLabel: 'HR & Staff ID Cards', icon: <Users className="w-4 h-4" /> },
      { key: 'devices', fallbackLabel: 'Device Connections', icon: <Cpu className="w-4 h-4" /> },
      { key: 'attendance', fallbackLabel: 'Attendance Register & OT', icon: <Clock className="w-4 h-4" /> },
      { key: 'scheduling', fallbackLabel: 'Staff Scheduling & Shifts', icon: <CalendarClock className="w-4 h-4" /> },
      { key: 'leave', fallbackLabel: 'Leave Management', icon: <CalendarOff className="w-4 h-4" /> },
      { key: 'payroll', fallbackLabel: 'Payroll & Ethiopian Tax', icon: <Wallet className="w-4 h-4" /> },
      { key: 'secretary', fallbackLabel: 'Secretary & A4 Documents', icon: <FileText className="w-4 h-4" /> },
      { key: 'company-forms', fallbackLabel: 'Company Forms & Evaluations', icon: <ClipboardCheck className="w-4 h-4" /> },
      { key: 'gate-pass', fallbackLabel: 'Single-Use Gate Pass', icon: <ShieldCheck className="w-4 h-4" /> },
    ],
  },
  {
    labelKey: 'group_inventory',
    fallbackGroupLabel: 'Inventory & Supply Chain',
    items: [
      { key: 'materials', fallbackLabel: 'Materials', icon: <Package className="w-4 h-4" /> },
      { key: 'material-requests', fallbackLabel: 'Materials Request', icon: <ClipboardList className="w-4 h-4" /> },
      { key: 'grn', fallbackLabel: 'Goods Receiving (GRN)', icon: <PackageCheck className="w-4 h-4" /> },
      { key: 'gin', fallbackLabel: 'Issuing (GIN) & Audit', icon: <FileCheck2 className="w-4 h-4" /> },
      { key: 'procurement', fallbackLabel: 'Procurement', icon: <ShoppingBag className="w-4 h-4" /> },
      { key: 'purchasing', fallbackLabel: 'Purchasing', icon: <ShoppingCart className="w-4 h-4" /> },
    ],
  },
  {
    labelKey: 'group_commercial',
    fallbackGroupLabel: 'Commercial, Finance & Fleet',
    items: [
      { key: 'sales-crm', fallbackLabel: 'Sales & CRM', icon: <TrendingUp className="w-4 h-4" /> },
      { key: 'finance', fallbackLabel: 'Finance & Accounting', icon: <BookOpen className="w-4 h-4" /> },
      { key: 'assets', fallbackLabel: 'Uniforms & Assets', icon: <Shield className="w-4 h-4" /> },
      { key: 'vehicles', fallbackLabel: 'Vehicles & Maintenance', icon: <Truck className="w-4 h-4" /> },
    ],
  },
  {
    labelKey: 'group_collab',
    fallbackGroupLabel: 'Collaboration & System',
    items: [
      { key: 'chat', fallbackLabel: 'Internal Corporate Chat', icon: <MessageSquare className="w-4 h-4" /> },
      { key: 'audit', fallbackLabel: 'Immutable Audit Trail', icon: <Activity className="w-4 h-4" /> },
      { key: 'sync', fallbackLabel: 'Offline Sync & Backup', icon: <HardDriveUpload className="w-4 h-4" /> },
    ],
  },
];

const MODULE_TITLES: Record<ModuleKey, string> = {
  dashboard: 'Dashboard',
  approvals: 'Approvals & Notifications',
  admin: 'System Administrator & Company Governance',
  hr: 'Human Resources, Registration Format & QR Staff IDs',
  devices: 'Device Connections Management',
  attendance: 'Attendance Register & Overtime Multipliers',
  scheduling: 'Staff Scheduling, 3/4-Shift Management & Dept Timetables',
  leave: 'Leave Management',
  payroll: 'Payroll, Bonus & Ethiopian Statutory Tax Rules',
  secretary: 'Secretary Department & A4 Official Company Documents',
  'company-forms': 'Complete Company Forms (17 Departments) & Staff Evaluation',
  'gate-pass': 'Single-Use Security Gate Pass & Exit Control',
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
const LANG_KEY = 'seven_sunday_lang';

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

  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<number>(() => getApiTenantId());
  const [tenantRefreshKey, setTenantRefreshKey] = useState(0);

  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');
  const [supplySubTab, setSupplySubTab] = useState<SupplyChainTab>('materials');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [lang, setLang] = useState<AppLang>(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY) as AppLang | null;
      if (saved && VALID_LANGS.includes(saved)) return saved;
    } catch {
      // ignore
    }
    return 'en';
  });
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark';
    } catch {
      return false;
    }
  });
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [dbSearchResults, setDbSearchResults] = useState<GlobalSearchResult[]>([]);
  const [searchingDb, setSearchingDb] = useState(false);
  const [lastWsEvent, setLastWsEvent] = useState<WsEventPayload | null>(null);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const isOnline = useOnlineStatus();

  const handleChangeLang = useCallback((nextLang: AppLang) => {
    setLang(nextLang);
    try {
      localStorage.setItem(LANG_KEY, nextLang);
    } catch {
      // ignore
    }
  }, []);

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
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (SUPPLY_CHAIN_KEYS.includes(activeModule)) {
      setSupplySubTab(activeModule as SupplyChainTab);
    }
  }, [activeModule]);

  const platformConfig = useMemo<PlatformConfig>(
    () => parsePlatformConfig(company?.platform_config),
    [company?.platform_config]
  );

  // Sync Platform Customizer CSS tokens, Browser Title, and Global Approving Departments
  useEffect(() => {
    setCustomApprovingDepartmentsGlobal(platformConfig.custom_approving_departments);
    document.documentElement.style.setProperty('--ss-primary', platformConfig.primary_color || '#087CEB');
    document.documentElement.style.setProperty('--ss-secondary', platformConfig.secondary_color || '#18243A');
    document.documentElement.style.setProperty('--ss-accent', platformConfig.accent_color || '#38BDF8');
    if (platformConfig.platform_title || company?.brand_name) {
      document.title = platformConfig.platform_title || company?.brand_name || 'Seven Sunday ETMS';
    }
  }, [platformConfig, company?.brand_name]);

  const refreshQueueCount = useCallback(async () => {
    const q = await getPendingQueue();
    setPendingQueueCount(q.length);
  }, []);

  const refreshTenants = useCallback(async () => {
    try {
      const list = await api.get<TenantRecord[]>('/api/tenants');
      setTenants(list);
    } catch {
      // ignore transient error
    }
  }, []);

  const refreshCompanyAndSummary = useCallback(async () => {
    try {
      const [s, tList] = await Promise.all([
        api.get<CompanySettings>('/api/company-settings'),
        api.get<TenantRecord[]>('/api/tenants'),
      ]);
      setCompany(s);
      setTenants(tList);
      if (s?.default_language && VALID_LANGS.includes(s.default_language)) {
        try {
          if (!localStorage.getItem(LANG_KEY)) {
            setLang(s.default_language);
          }
        } catch {
          // ignore
        }
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

  const handleSwitchTenant = useCallback(
    async (nextTenantId: number) => {
      setApiTenant(nextTenantId);
      setActiveTenantId(nextTenantId);
      setTenantRefreshKey((k) => k + 1);
      await refreshCompanyAndSummary();
      if (currentUser) {
        await refreshDashboard();
      }
    },
    [currentUser, refreshCompanyAndSummary, refreshDashboard]
  );

  useEffect(() => {
    const cleanupPrint = installGlobalBeforePrintFit();
    refreshCompanyAndSummary();
    refreshQueueCount();
    const handler = () => {
      refreshQueueCount();
    };
    window.addEventListener('sevensunday-sync-queue-updated', handler);
    window.addEventListener('seven-sunday-sync-updated', handler);
    return () => {
      cleanupPrint();
      window.removeEventListener('sevensunday-sync-queue-updated', handler);
      window.removeEventListener('seven-sunday-sync-updated', handler);
    };
  }, [refreshCompanyAndSummary, refreshQueueCount]);

  useEffect(() => {
    const onDataImported = () => {
      refreshDashboard();
      setTenantRefreshKey((k) => k + 1);
    };
    window.addEventListener('sevensunday:data-imported', onDataImported);
    return () => window.removeEventListener('sevensunday:data-imported', onDataImported);
  }, [refreshDashboard]);

  useEffect(() => {
    if (currentUser) {
      refreshDashboard();
    }
  }, [currentUser, activeTenantId, refreshDashboard]);

  // Ctrl+K / Cmd+K Global Search Keyboard Shortcut
  useEffect(() => {
    if (!currentUser) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen((open) => !open);
      } else if (e.key === 'Escape' && searchModalOpen) {
        setSearchModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentUser, searchModalOpen]);

  // Global database search across active tenant records
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
  }, [globalSearch, currentUser, activeTenantId]);

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
    if (evt.event === 'tenant:updated') {
      refreshTenants();
      return;
    }
    if (evt.event !== 'presence:count') {
      refreshDashboard();
    }
  });

  const allowedModules = useMemo<ModuleKey[]>(() => {
    if (!currentUser) return [];
    return getAllowedModules(currentUser.role, company?.rbac_matrix, platformConfig);
  }, [currentUser, company?.rbac_matrix, platformConfig]);

  useEffect(() => {
    if (currentUser && !allowedModules.includes(activeModule)) {
      setActiveModule(allowedModules[0] || 'dashboard');
    }
  }, [currentUser, allowedModules, activeModule]);

  const handleLogin = (user: UserAccount) => {
    setApiActor(user.full_name, user.role);
    if (user.tenant_id && user.tenant_id !== activeTenantId) {
      setApiTenant(user.tenant_id);
      setActiveTenantId(user.tenant_id);
      refreshCompanyAndSummary();
    }
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
    setSearchModalOpen(false);
    setGlobalSearch('');
    setDbSearchResults([]);
  };

  if (!currentUser) {
    return (
      <LoginScreen
        company={company}
        onLogin={handleLogin}
        tenants={tenants}
        activeTenantId={activeTenantId}
        onSelectTenant={handleSwitchTenant}
        lang={lang}
        onChangeLang={handleChangeLang}
        platformConfig={platformConfig}
      />
    );
  }

  const getModuleNavLabel = (key: ModuleKey, fallbackLabel: string) =>
    translateUi(lang, key, fallbackLabel, platformConfig.custom_module_labels);

  const getModuleHeaderTitle = (key: ModuleKey) => {
    const customTitle = platformConfig.custom_module_titles?.[key];
    if (customTitle && customTitle.trim()) return customTitle.trim();
    if (lang !== 'en') {
      return translateUi(lang, key, MODULE_TITLES[key]);
    }
    return MODULE_TITLES[key];
  };

  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    displayLabel: translateUi(lang, g.labelKey, g.fallbackGroupLabel),
    items: g.items.filter((it) => allowedModules.includes(it.key)),
  })).filter((g) => g.items.length > 0);

  const searchMatches = globalSearch.trim()
    ? visibleGroups
        .flatMap((g) => g.items)
        .filter((it) => {
          const label = getModuleNavLabel(it.key, it.fallbackLabel);
          const headerTitle = getModuleHeaderTitle(it.key);
          const q = globalSearch.toLowerCase();
          return label.toLowerCase().includes(q) || headerTitle.toLowerCase().includes(q);
        })
    : [];

  const formTemplateMatches =
    globalSearch.trim().length >= 1 && allowedModules.includes('company-forms')
      ? ALL_COMPANY_FORMS.filter((f) => {
          const q = globalSearch.trim().toLowerCase();
          return (
            f.code.toLowerCase().includes(q) ||
            f.name.toLowerCase().includes(q) ||
            f.departmentName.toLowerCase().includes(q)
          );
        }).slice(0, 8)
      : [];

  const filteredDbResults = dbSearchResults.filter((r) => allowedModules.includes(r.module));

  const isSupplyChain = SUPPLY_CHAIN_KEYS.includes(activeModule);
  const currency = company?.default_currency || 'ETB';
  const calendarMode = company?.calendar_mode || 'Gregorian';
  const logoSrc =
    company?.logo_data && company.logo_data.startsWith('data:')
      ? company.logo_data
      : '/assets/aistudio/Seven_Sunday_Logo_2_desktop_addf2fa7.png';
  const isRtl = lang === 'ar';
  const selectableTenants = tenants.filter(
    (t) => t.status === 'Active' || currentUser.role === 'System Administrator' || t.id === activeTenantId
  );

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="app-root-shell min-h-screen flex bg-[#F8FAFC] dark:bg-slate-950 text-[#172033] dark:text-slate-100"
    >
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-[#18243A]/60 z-30 lg:hidden no-print"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left/Start Sidebar (264px) */}
      <aside
        style={{ backgroundColor: platformConfig.secondary_color || '#18243A' }}
        className={`no-print fixed lg:sticky top-0 ${isRtl ? 'right-0 border-l' : 'left-0 border-r'} z-40 h-screen w-[264px] shrink-0 text-white border-slate-800 flex flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : isRtl ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0'
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
              alt={company?.brand_name || 'Seven Sunday Ethiopia'}
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
            <div key={group.labelKey}>
              <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#7DD3FC]/90">
                {group.displayLabel}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = activeModule === item.key;
                  const label = getModuleNavLabel(item.key, item.fallbackLabel);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleSelectModule(item.key)}
                      style={active ? { backgroundColor: platformConfig.primary_color || '#087CEB' } : undefined}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-colors text-start whitespace-nowrap ${
                        active
                          ? 'text-white font-bold shadow-sm'
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
            title={translateUi(lang, 'sign_out', 'Sign Out')}
            className="p-1.5 text-white/70 hover:text-red-300 rounded-lg hover:bg-white/10 shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="app-content-shell flex-1 min-w-0 flex flex-col">
        <OfflineIndicator pendingCount={pendingQueueCount} />

        <header className="no-print h-16 bg-[#FFFFFF] dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-20">
          <div className="flex items-center gap-2.5 min-w-0">
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
                {getModuleHeaderTitle(activeModule)}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Multi-Tenant Workspace Switcher */}
            {platformConfig.enable_multi_tenant !== false && selectableTenants.length > 0 && (
              <div
                className="flex items-center gap-1 px-2 py-1 bg-[#EAF4FF] dark:bg-slate-800 border border-[#087CEB]/30 rounded-lg"
                title={translateUi(lang, 'tenant_workspace', 'Tenant Workspace')}
              >
                <Building2 className="w-3.5 h-3.5 text-[#087CEB] shrink-0" />
                <select
                  value={activeTenantId}
                  onChange={(e) => handleSwitchTenant(Number(e.target.value))}
                  aria-label="Tenant workspace switcher"
                  className="max-w-[130px] sm:max-w-[175px] text-xs font-bold bg-transparent text-[#18243A] dark:text-white focus:outline-none truncate"
                >
                  {selectableTenants.map((t) => (
                    <option key={t.id} value={t.id} className="text-[#172033]">
                      {t.brand_name} ({t.tenant_code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Global Search (Ctrl+K) Trigger Button */}
            <button
              type="button"
              onClick={() => setSearchModalOpen(true)}
              className="inline-flex items-center gap-2 px-2.5 sm:px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg transition-colors whitespace-nowrap shrink-0"
              title="Open Global Search (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5 text-[#087CEB]" />
              <span className="hidden md:inline font-medium">
                {translateUi(lang, 'search_placeholder', `Search modules, ${ALL_COMPANY_FORMS.length} forms, records...`)}
              </span>
              <span className="md:hidden font-medium">{translateUi(lang, 'search_short', 'Search')}</span>
              <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-bold text-[#18243A] dark:text-[#38BDF8] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded">
                Ctrl+K
              </kbd>
            </button>

            {/* Global Import Files & Documents Trigger */}
            <button
              type="button"
              onClick={() => setImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg transition-colors whitespace-nowrap shrink-0"
              title={translateUi(lang, 'import_files', 'Import Files & Docs')}
            >
              <FileUp className="w-3.5 h-3.5 text-[#087CEB]" />
              <span className="hidden md:inline">
                {translateUi(lang, 'import_files', 'Import Files & Docs')}
              </span>
            </button>

            {/* Multi-Language Switcher (6 Languages) */}
            {platformConfig.enable_multi_language !== false && (
              <div className="flex items-center gap-1 px-2 py-1 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                <Globe className="w-3.5 h-3.5 text-[#18243A] dark:text-[#38BDF8] shrink-0" />
                <select
                  value={lang}
                  onChange={(e) => handleChangeLang(e.target.value as AppLang)}
                  aria-label="Language switcher"
                  className="text-xs font-semibold bg-transparent text-[#172033] dark:text-slate-200 focus:outline-none"
                >
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code} className="text-[#172033]">
                      {opt.shortLabel} · {opt.label.split(' ')[0]}
                    </option>
                  ))}
                </select>
              </div>
            )}

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
                style={{ backgroundColor: platformConfig.primary_color || '#087CEB' }}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 rounded-lg transition-opacity whitespace-nowrap shrink-0"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {translateUi(lang, 'corporate_chat', 'Corporate Chat')}
                </span>
              </button>
            )}
          </div>
        </header>

        {/* Keyed by activeTenantId + tenantRefreshKey so switching tenant cleanly reloads all module data */}
        <main key={`${activeTenantId}-${tenantRefreshKey}`} className="app-main-shell flex-1 p-3 sm:p-6 max-w-[1440px] w-full mx-auto">
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
                if (updated.default_language && VALID_LANGS.includes(updated.default_language)) {
                  handleChangeLang(updated.default_language);
                }
                refreshTenants();
              }}
              onRefreshDashboard={refreshDashboard}
              currentUserRole={currentUser.role}
              tenants={tenants}
              activeTenantId={activeTenantId}
              onSwitchTenant={handleSwitchTenant}
              onTenantsChanged={refreshTenants}
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
              currentUserRole={currentUser.role}
              onRefreshDashboard={refreshDashboard}
            />
          )}
          {activeModule === 'scheduling' && (
            <SchedulingModule
              company={company}
              calendarMode={calendarMode}
              currentUserRole={currentUser.role}
              currentUserCode={currentUser.email}
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
          {activeModule === 'gate-pass' && (
            <GatePassModule company={company} onRefreshDashboard={refreshDashboard} />
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

      {/* Global Ctrl+K Search Command Display Modal */}
      {searchModalOpen && (
        <div
          className="no-print fixed inset-0 z-50 bg-[#18243A]/65 flex items-start justify-center p-4 pt-12 sm:pt-20"
          onClick={() => setSearchModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <Search className="w-4 h-4 text-[#087CEB] shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder={translateUi(lang, 'search_placeholder', `Search modules, ${ALL_COMPANY_FORMS.length} company forms, staff, schedules, gate passes, SKUs...`)}
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="flex-1 text-sm bg-transparent text-[#172033] dark:text-white focus:outline-none"
              />
              {globalSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setGlobalSearch('');
                    setDbSearchResults([]);
                  }}
                  className="text-xs font-semibold text-slate-400 hover:text-[#172033] dark:hover:text-white"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                className="px-2 py-1 text-[11px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 rounded"
              >
                ESC
              </button>
            </div>

            <div className="max-h-[68vh] overflow-y-auto p-3 space-y-4">
              {globalSearch.trim().length === 0 ? (
                <div>
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Quick Navigation Shortcuts · Tenant #{activeTenantId} ({company?.brand_name || 'Workspace'})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    {(
                      [
                        ['dashboard', 'Operations & Financial Dashboard'],
                        ['scheduling', '3-Shift & 4-Shift Scheduling & Dept Timetables'],
                        ['attendance', 'Morning / Afternoon / Night Attendance & OT'],
                        ['company-forms', `Company Forms (${ALL_COMPANY_FORMS.length} Templates) & Attendance Sheets`],
                        ['payroll', 'Payroll Sheet, Absence & Overtime'],
                        ['admin', 'System Administrator & Multi-Tenancy'],
                      ] as Array<[ModuleKey, string]>
                    )
                      .filter(([k]) => allowedModules.includes(k))
                      .map(([k, desc]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => handleSelectModule(k)}
                          className="text-left p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-[#087CEB] hover:bg-[#EAF4FF]/60 dark:hover:bg-slate-800 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#172033] dark:text-white truncate">
                              {getModuleHeaderTitle(k)}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{desc}</div>
                          </div>
                          <span className="text-[10px] font-mono text-[#087CEB] shrink-0">Open</span>
                        </button>
                      ))}
                  </div>
                </div>
              ) : (
                <>
                  {searchMatches.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Modules ({searchMatches.length})
                      </div>
                      <div className="space-y-1">
                        {searchMatches.slice(0, 6).map((m) => (
                          <button
                            key={m.key}
                            type="button"
                            onClick={() => handleSelectModule(m.key)}
                            className="w-full px-3 py-2 text-left text-xs text-[#172033] dark:text-slate-200 hover:bg-[#EAF4FF] dark:hover:bg-slate-800 rounded-lg flex items-center justify-between gap-2"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="text-[#087CEB]">{m.icon}</span>
                              <span className="truncate font-semibold">{getModuleHeaderTitle(m.key)}</span>
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">Module</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {formTemplateMatches.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Company Form Templates ({formTemplateMatches.length} shown)
                      </div>
                      <div className="space-y-1">
                        {formTemplateMatches.map((f) => (
                          <button
                            key={f.code}
                            type="button"
                            onClick={() => {
                              handleSelectModule('company-forms');
                              window.setTimeout(() => {
                                window.dispatchEvent(new CustomEvent('sevensunday:open-form', { detail: f.code }));
                              }, 30);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-[#EAF4FF] dark:hover:bg-slate-800 rounded-lg flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-[#172033] dark:text-white truncate">
                                {f.name}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {f.code} · {f.departmentName}
                              </div>
                            </div>
                            <span className="shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#EAF4FF] text-[#18243A]">
                              Form
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Live SQLite Database Records (Tenant #{activeTenantId})</span>
                      {searchingDb && <span className="text-[#087CEB]">Searching...</span>}
                    </div>
                    {filteredDbResults.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-slate-500">
                        {globalSearch.trim().length < 2
                          ? 'Type at least 2 characters to query staff, gate passes, SKUs, approvals, documents...'
                          : searchingDb
                          ? 'Querying database...'
                          : 'No matching database records found.'}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {filteredDbResults.slice(0, 12).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectModule(item.module)}
                            className="w-full px-3 py-2 text-left hover:bg-[#EAF4FF] dark:hover:bg-slate-800 rounded-lg flex items-start justify-between gap-2"
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
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <ImportFilesModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        company={company}
        onNavigate={handleSelectModule}
        onImported={() => {
          refreshDashboard();
          setTenantRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}
