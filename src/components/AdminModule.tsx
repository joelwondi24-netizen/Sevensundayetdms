import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Building2,
  CheckCircle2,
  Cpu,
  Database,
  Download,
  GitBranch,
  Globe2,
  ImagePlus,
  Layers,
  Lock,
  Mail,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Send,
  Shield,
  Sliders,
  Sparkles,
  Trash2,
  Unlock,
  Upload,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { api, getCompanyDeviceUid, getDetectedDeviceLabel } from '../api';
import { useI18n } from '../i18n/I18nProvider';
import { EN_DICTIONARY, STATIC_LOCALE_CODES, WORLD_LANGUAGES, findWorldLanguage } from '../i18n/languages';
import type {
  AuditLogRecord,
  AuthorizedCompanyDeviceRecord,
  CompanySettings,
  DeviceRecord,
  I18nConfigResponse,
  I18nTranslationEntry,
  ModuleKey,
  NotificationChannelConfig,
  PlatformConfig,
  RbacActionPermissions,
  TenantRecord,
  UserAccount,
  UserRole,
} from '../types';
import { type AppLang } from '../utils/ethiopianCalendar';
import {
  DEFAULT_APPROVING_DEPARTMENTS,
  DEFAULT_PLATFORM_CONFIG,
  parsePlatformConfig,
  setCustomApprovingDepartmentsGlobal,
} from '../utils/platformConfig';

const ALL_ROLES: UserRole[] = [
  'System Administrator',
  'Super Administrator',
  'Company Owner',
  'General Manager',
  'Department Manager',
  'Human Resource Manager',
  'Finance Manager',
  'Accountant',
  'Inventory Manager',
  'Warehouse Manager',
  'Procurement Officer',
  'Sales Manager',
  'Attendance Officer',
  'Security Supervisor',
  'Security Guard',
  'Employee',
  'Auditor',
  'Viewer',
];

const ALL_MATRIX_MODULES: Array<{ key: ModuleKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'approvals', label: 'Approvals' },
  { key: 'admin', label: 'Admin' },
  { key: 'hr', label: 'HR & ID' },
  { key: 'devices', label: 'Device Conn.' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'scheduling', label: 'Shifts & Schedule' },
  { key: 'leave', label: 'Leave' },
  { key: 'salary', label: 'Salary' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'secretary', label: 'Secretary' },
  { key: 'company-forms', label: 'Forms' },
  { key: 'gate-pass', label: 'Gate Pass' },
  { key: 'materials', label: 'Materials' },
  { key: 'material-requests', label: 'Mat. Req' },
  { key: 'grn', label: 'GRN' },
  { key: 'gin', label: 'GIN' },
  { key: 'procurement', label: 'Procure' },
  { key: 'purchasing', label: 'Purchase' },
  { key: 'sales-crm', label: 'Sales/CRM' },
  { key: 'finance', label: 'Finance' },
  { key: 'assets', label: 'Assets' },
  { key: 'vehicles', label: 'Fleet' },
  { key: 'reports', label: 'Reports' },
  { key: 'chat', label: 'Chat' },
  { key: 'audit', label: 'Audit' },
  { key: 'sync', label: 'Sync' },
];

export const DEFAULT_RBAC_MATRIX: Record<UserRole, ModuleKey[]> = {
  'System Administrator': ALL_MATRIX_MODULES.map((m) => m.key),
  'Super Administrator': ALL_MATRIX_MODULES.map((m) => m.key),
  'Company Owner': ALL_MATRIX_MODULES.map((m) => m.key),
  'General Manager': ALL_MATRIX_MODULES.map((m) => m.key),
  'Department Manager': [
    'dashboard',
    'approvals',
    'hr',
    'attendance',
    'scheduling',
    'leave',
    'secretary',
    'company-forms',
    'gate-pass',
    'material-requests',
    'assets',
    'vehicles',
    'reports',
    'chat',
    'sync',
  ],
  'Human Resource Manager': [
    'dashboard',
    'approvals',
    'hr',
    'devices',
    'attendance',
    'scheduling',
    'leave',
    'salary',
    'payroll',
    'secretary',
    'company-forms',
    'gate-pass',
    'assets',
    'reports',
    'chat',
    'sync',
  ],
  'Finance Manager': [
    'dashboard',
    'approvals',
    'salary',
    'payroll',
    'company-forms',
    'purchasing',
    'sales-crm',
    'finance',
    'reports',
    'audit',
    'chat',
    'sync',
  ],
  Accountant: ['dashboard', 'salary', 'payroll', 'company-forms', 'finance', 'sales-crm', 'reports', 'chat', 'sync'],
  'Inventory Manager': [
    'dashboard',
    'approvals',
    'company-forms',
    'gate-pass',
    'materials',
    'material-requests',
    'grn',
    'gin',
    'assets',
    'reports',
    'chat',
    'sync',
  ],
  'Warehouse Manager': [
    'dashboard',
    'approvals',
    'company-forms',
    'gate-pass',
    'materials',
    'material-requests',
    'grn',
    'gin',
    'assets',
    'reports',
    'chat',
    'sync',
  ],
  'Procurement Officer': [
    'dashboard',
    'approvals',
    'company-forms',
    'materials',
    'material-requests',
    'procurement',
    'purchasing',
    'grn',
    'reports',
    'chat',
    'sync',
  ],
  'Sales Manager': ['dashboard', 'company-forms', 'sales-crm', 'materials', 'reports', 'chat', 'sync'],
  'Attendance Officer': [
    'dashboard',
    'approvals',
    'hr',
    'devices',
    'attendance',
    'scheduling',
    'leave',
    'company-forms',
    'reports',
    'chat',
    'sync',
  ],
  'Security Supervisor': [
    'dashboard',
    'company-forms',
    'gate-pass',
    'devices',
    'attendance',
    'scheduling',
    'vehicles',
    'assets',
    'reports',
    'chat',
    'sync',
  ],
  'Security Guard': ['dashboard', 'gate-pass', 'attendance', 'scheduling', 'company-forms', 'chat', 'sync'],
  Auditor: ['dashboard', 'company-forms', 'gate-pass', 'gin', 'finance', 'payroll', 'scheduling', 'reports', 'audit', 'approvals', 'chat', 'sync'],
  Employee: ['dashboard', 'attendance', 'scheduling', 'leave', 'company-forms', 'gate-pass', 'material-requests', 'chat', 'sync'],
  Viewer: ['dashboard', 'chat', 'sync'],
};

type AdminTab = 'branding' | 'branches' | 'users' | 'rbac' | 'tenants' | 'platform' | 'logins' | 'device-security' | 'languages' | 'smtp';

interface AdminModuleProps {
  settings: CompanySettings | null;
  onSettingsUpdated: (s: CompanySettings) => void;
  onRefreshDashboard: () => void;
  currentUserRole?: UserRole;
  tenants?: TenantRecord[];
  activeTenantId?: number;
  onSwitchTenant?: (id: number) => void;
  onTenantsChanged?: () => Promise<void> | void;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

export const AdminModule: React.FC<AdminModuleProps> = ({
  settings,
  onSettingsUpdated,
  onRefreshDashboard,
  currentUserRole = 'System Administrator',
  tenants: propTenants,
  activeTenantId = 1,
  onSwitchTenant,
  onTenantsChanged,
}) => {
  const i18n = useI18n();
  const [tab, setTab] = useState<AdminTab>(
    currentUserRole === 'System Administrator' ? 'platform' : 'branding'
  );
  const [form, setForm] = useState<CompanySettings>(
    settings || {
      id: 1,
      company_name: 'Seven Sunday Manufacturing & Trading PLC',
      brand_name: 'Seven Sunday Ethiopia',
      slogan: 'The Home of quality product',
      secondary_slogan: 'Together for a Stronger and Better Tomorrow',
      address: 'Bole Sub-City, Addis Ababa, Ethiopia',
      phone: '+251 11 000 0000',
      email: 'info@sevensundayethiopia.com',
      website: 'https://sevensundayethiopia.com',
      tin_number: '',
      default_currency: 'ETB',
      calendar_mode: 'Gregorian',
      default_language: 'en',
      branches: 'Addis Ababa HQ, Adama Factory, Hawassa Depot',
      departments: 'Operations, HR, Secretary, Finance, Inventory, Procurement, Sales & CRM',
      logo_data: '',
      stamp_data: '',
      signature_data: '',
      smtp_host: 'smtp.sevensundayethiopia.com',
      smtp_port: 587,
      smtp_user: 'noreply@sevensundayethiopia.com',
      smtp_pass: '',
      smtp_from: 'Seven Sunday Ethiopia <noreply@sevensundayethiopia.com>',
      smtp_secure: 0,
      rbac_matrix: '{}',
      platform_config: JSON.stringify(DEFAULT_PLATFORM_CONFIG),
      updated_at: '',
    }
  );

  const [platformCfg, setPlatformCfg] = useState<PlatformConfig>(() =>
    parsePlatformConfig(settings?.platform_config)
  );
  const [newApproveDept, setNewApproveDept] = useState('');

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<
    Array<{
      id: number;
      email: string;
      ip_address: string;
      user_agent: string;
      success: number;
      reason: string;
      created_at: string;
    }>
  >([]);
  const [localTenants, setLocalTenants] = useState<TenantRecord[]>(propTenants || []);

  // Tenant CRUD state
  const emptyTenantForm = {
    tenant_code: '',
    name: '',
    brand_name: '',
    slogan: 'The Home of quality product',
    secondary_slogan: 'Together for a Stronger and Better Tomorrow',
    address: 'Addis Ababa, Ethiopia',
    phone: '+251 11 000 0000',
    email: 'workspace@sevensundayethiopia.com',
    default_currency: 'ETB' as TenantRecord['default_currency'],
    calendar_mode: 'Gregorian' as 'Gregorian' | 'Ethiopian',
    default_language: 'en' as AppLang,
    plan: 'Ethiopia Branch',
    branches: 'Main Branch HQ',
    departments: 'Operations, HR, Secretary, Finance, Inventory, Procurement, Sales & CRM',
  };
  const [tenantForm, setTenantForm] = useState(emptyTenantForm);
  const [editingTenantId, setEditingTenantId] = useState<number | null>(null);

  const [newBranch, setNewBranch] = useState('');
  const [newDept, setNewDept] = useState('');
  const [userForm, setUserForm] = useState({
    full_name: '',
    email: '',
    password: '',
    department: 'Operations',
    job_title: 'Staff',
    role: 'Employee' as UserRole,
  });
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpResult, setSmtpResult] = useState<string | null>(null);
  const [confirmPurgeEmailUsers, setConfirmPurgeEmailUsers] = useState(false);
  const [purgingUsers, setPurgingUsers] = useState(false);
  const [actionPerms, setActionPerms] = useState<Record<string, RbacActionPermissions>>({});
  const [savingActionRole, setSavingActionRole] = useState<string | null>(null);
  const [channelsCfg, setChannelsCfg] = useState<NotificationChannelConfig>({
    tenant_id: activeTenantId,
    email_enabled: 1,
    telegram_enabled: 0,
    telegram_bot_token: '',
    telegram_chat_id: '',
    whatsapp_webhook_url: '',
    webhook_enabled: 0,
    notify_on_events_json: JSON.stringify([
      'APPROVAL_REQUEST',
      'LOW_STOCK',
      'LEAVE_STATUS',
      'PAYROLL_RUN',
      'ATTENDANCE_ALERT',
      'SECURITY_LOCKOUT',
      'EMPLOYEE_CREATED',
    ]),
    updated_at: '',
  });
  const [savingChannels, setSavingChannels] = useState(false);
  const [companySecPolicy, setCompanySecPolicy] = useState<{
    policy_enabled: boolean;
    company_code_hint: string;
    configured_by: string;
    configured_at: string | null;
  }>({ policy_enabled: false, company_code_hint: '', configured_by: '', configured_at: null });
  const [authorizedDevices, setAuthorizedDevices] = useState<AuthorizedCompanyDeviceRecord[]>([]);
  const [companyCodeInput, setCompanyCodeInput] = useState('');
  const [companyPolicyActiveInput, setCompanyPolicyActiveInput] = useState(true);
  const [savingDevicePolicy, setSavingDevicePolicy] = useState(false);
  const [newCompanyDeviceForm, setNewCompanyDeviceForm] = useState({
    device_uid: '',
    device_name: '',
    assigned_branch: 'Addis Ababa HQ',
    assigned_to_email: '',
    pre_verify: false,
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Multilingual & Translations Manager state
  const [i18nDefaultLang, setI18nDefaultLang] = useState<string>('en');
  const [i18nEnabledLangs, setI18nEnabledLangs] = useState<string[]>([]);
  const [i18nRtlAuto, setI18nRtlAuto] = useState<boolean>(true);
  const [i18nSavingSettings, setI18nSavingSettings] = useState<boolean>(false);
  const [i18nCatalogSearch, setI18nCatalogSearch] = useState<string>('');
  const [i18nEditorLang, setI18nEditorLang] = useState<string>('am');
  const [i18nEntries, setI18nEntries] = useState<I18nTranslationEntry[]>([]);
  const [i18nStaticPack, setI18nStaticPack] = useState<Record<string, string>>({});
  const [i18nDraftValues, setI18nDraftValues] = useState<Record<string, string>>({});
  const [i18nKeyFilter, setI18nKeyFilter] = useState<string>('');
  const [i18nSavingKey, setI18nSavingKey] = useState<string | null>(null);
  const [i18nBatchAiBusy, setI18nBatchAiBusy] = useState<boolean>(false);
  const [i18nCoverageMap, setI18nCoverageMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (settings) {
      setForm(settings);
      setPlatformCfg(parsePlatformConfig(settings.platform_config));
    }
  }, [settings]);

  useEffect(() => {
    if (propTenants) {
      setLocalTenants(propTenants);
    }
  }, [propTenants]);

  const loadAdminData = async () => {
    try {
      const [uData, dData, aData, tData, pData, cData, compDevData, attemptData] = await Promise.all([
        api.get<UserAccount[]>('/api/users'),
        api.get<DeviceRecord[]>('/api/devices'),
        api.get<AuditLogRecord[]>('/api/audit-logs'),
        api.get<TenantRecord[]>('/api/tenants'),
        api.get<Record<string, RbacActionPermissions>>('/api/rbac/permissions').catch(() => null),
        api.get<NotificationChannelConfig>('/api/notifications/channels').catch(() => null),
        api
          .get<{
            policy: {
              policy_enabled: boolean;
              company_code_hint: string;
              configured_by: string;
              configured_at: string | null;
            };
            devices: AuthorizedCompanyDeviceRecord[];
          }>('/api/admin/company-devices')
          .catch(() => null),
        api
          .get<
            Array<{
              id: number;
              email: string;
              ip_address: string;
              user_agent: string;
              success: number;
              reason: string;
              created_at: string;
            }>
          >('/api/auth/login-attempts')
          .catch(() => []),
      ]);
      setUsers(uData);
      setDevices(dData);
      setAuditLogs(aData);
      setLoginAttempts(attemptData);
      setLocalTenants(tData);
      if (pData) {
        setActionPerms(pData);
      }
      if (cData) {
        setChannelsCfg(cData);
      }
      if (compDevData) {
        setCompanySecPolicy(compDevData.policy);
        setCompanyPolicyActiveInput(compDevData.policy.policy_enabled || !compDevData.policy.configured_at);
        setAuthorizedDevices(compDevData.devices || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load administration records');
    }
  };

  const loadI18nAdminData = async (targetLang = i18nEditorLang) => {
    try {
      const [cfg, rows] = await Promise.all([
        api.get<I18nConfigResponse>(`/api/i18n/config?lang=${encodeURIComponent(targetLang)}`),
        api.get<I18nTranslationEntry[]>(`/api/i18n/admin/translations?lang=${encodeURIComponent(targetLang)}`).catch(() => []),
      ]);
      setI18nDefaultLang(cfg.default_language || 'en');
      setI18nEnabledLangs(Array.isArray(cfg.enabled_languages) ? cfg.enabled_languages : []);
      setI18nRtlAuto(cfg.rtl_auto !== false);
      setI18nEntries(rows);
      const cov: Record<string, number> = {};
      for (const c of cfg.coverage_counts || []) {
        cov[c.lang_code] = Number(c.count || 0);
      }
      setI18nCoverageMap(cov);

      let pack: Record<string, string> = {};
      if (targetLang === 'en') {
        pack = EN_DICTIONARY;
      } else if (STATIC_LOCALE_CODES.has(targetLang)) {
        try {
          const res = await fetch(`/locales/${encodeURIComponent(targetLang)}.json`, { cache: 'no-cache' });
          if (res.ok) pack = (await res.json()) as Record<string, string>;
        } catch {
          pack = {};
        }
      }
      setI18nStaticPack(pack);

      const drafts: Record<string, string> = {};
      const dbMap = new Map(rows.map((r) => [r.translation_key, r.value_text]));
      for (const k of Object.keys(EN_DICTIONARY)) {
        drafts[k] = dbMap.get(k) || pack[k] || '';
      }
      setI18nDraftValues(drafts);
    } catch {
      // non-blocking
    }
  };

  useEffect(() => {
    loadAdminData();
    void loadI18nAdminData(i18nEditorLang);
  }, [activeTenantId]);

  useEffect(() => {
    if (tab === 'languages') {
      void loadI18nAdminData(i18nEditorLang);
    }
  }, [tab, i18nEditorLang]);

  const rbacMatrix = useMemo<Record<UserRole, ModuleKey[]>>(() => {
    try {
      const parsed = JSON.parse(form.rbac_matrix || '{}');
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return { ...DEFAULT_RBAC_MATRIX, ...parsed };
      }
    } catch {
      // fallback
    }
    return DEFAULT_RBAC_MATRIX;
  }, [form.rbac_matrix]);

  const branchesList = useMemo(
    () =>
      String(form.branches || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [form.branches]
  );

  const departmentsList = useMemo(
    () =>
      String(form.departments || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [form.departments]
  );

  const persistCompanySettings = async (nextForm: CompanySettings, successMessage: string) => {
    setError(null);
    setNotice(null);
    try {
      const updated = await api.put<CompanySettings>('/api/company-settings', nextForm);
      setForm(updated);
      setPlatformCfg(parsePlatformConfig(updated.platform_config));
      onSettingsUpdated(updated);
      setNotice(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save company settings');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistCompanySettings(form, 'Company registration, branding, stamp & signature saved across active tenant.');
  };

  const handleSavePlatformConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setCustomApprovingDepartmentsGlobal(platformCfg.custom_approving_departments);
    const nextForm: CompanySettings = {
      ...form,
      platform_config: JSON.stringify(platformCfg),
    };
    await persistCompanySettings(
      nextForm,
      'System Administrator platform customizations applied live across sidebar, titles, theme & departments.'
    );
  };

  const handleResetPlatformDefaults = async () => {
    setPlatformCfg(DEFAULT_PLATFORM_CONFIG);
    setCustomApprovingDepartmentsGlobal(DEFAULT_APPROVING_DEPARTMENTS);
    const nextForm: CompanySettings = {
      ...form,
      platform_config: JSON.stringify(DEFAULT_PLATFORM_CONFIG),
    };
    await persistCompanySettings(nextForm, 'Restored platform defaults.');
  };

  const handleImageUpload = async (
    field: 'logo_data' | 'stamp_data' | 'signature_data',
    file?: File
  ) => {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setForm((prev) => ({ ...prev, [field]: dataUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load image asset');
    }
  };

  const handleToggleRbacModule = (role: UserRole, mod: ModuleKey) => {
    if (role === 'System Administrator' || role === 'Super Administrator') return;
    const current = rbacMatrix[role] || [];
    const next = current.includes(mod) ? current.filter((m) => m !== mod) : [...current, mod];
    const updatedMatrix = { ...rbacMatrix, [role]: next };
    setForm((prev) => ({ ...prev, rbac_matrix: JSON.stringify(updatedMatrix) }));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const pw = userForm.password.trim();
    if (pw.length < 8 || !/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
      setError('Password must be at least 8 characters and include both a letter and a number.');
      return;
    }
    try {
      const created = await api.post<UserAccount>('/api/users', userForm);
      setUsers((prev) => [...prev, created]);
      setUserForm({
        full_name: '',
        email: '',
        password: '',
        department: departmentsList[0] || 'Operations',
        job_title: 'Staff',
        role: 'Employee',
      });
      setNotice(`Created account for ${created.full_name} (${created.role}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  const handleUnlockUser = async (id: number, email: string) => {
    setError(null);
    setNotice(null);
    try {
      const updated = await api.post<UserAccount>(`/api/users/${id}/unlock`);
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
      setNotice(`Unlocked corporate account for ${email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlock user account');
    }
  };

  const handleToggleActionPerm = (role: string, key: keyof RbacActionPermissions) => {
    if (role === 'System Administrator' || role === 'Super Administrator') return;
    setActionPerms((prev) => {
      const current: RbacActionPermissions = prev[role] || {
        view: true,
        create: false,
        edit: false,
        delete: false,
        approve: false,
        export: false,
        manage: false,
      };
      return {
        ...prev,
        [role]: { ...current, [key]: !current[key] },
      };
    });
  };

  const handleSaveActionPerms = async (role: string) => {
    setSavingActionRole(role);
    setError(null);
    setNotice(null);
    try {
      const perms = actionPerms[role] || {
        view: true,
        create: false,
        edit: false,
        delete: false,
        approve: false,
        export: false,
        manage: false,
      };
      const res = await api.put<{ role: string; permissions: RbacActionPermissions }>(
        `/api/rbac/permissions/${encodeURIComponent(role)}`,
        perms
      );
      setActionPerms((prev) => ({ ...prev, [role]: res.permissions }));
      setNotice(`Saved granular action permissions for "${role}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save granular action permissions');
    } finally {
      setSavingActionRole(null);
    }
  };

  const handleSaveChannels = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingChannels(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.put<NotificationChannelConfig>('/api/notifications/channels', {
        email_enabled: Boolean(channelsCfg.email_enabled),
        telegram_enabled: Boolean(channelsCfg.telegram_enabled),
        telegram_bot_token: channelsCfg.telegram_bot_token,
        telegram_chat_id: channelsCfg.telegram_chat_id,
        webhook_enabled: Boolean(channelsCfg.webhook_enabled),
        whatsapp_webhook_url: channelsCfg.whatsapp_webhook_url,
        notify_on_events_json: channelsCfg.notify_on_events_json,
      });
      setChannelsCfg(updated);
      setNotice('Saved multi-channel Email, Telegram & Webhook notification settings.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update notification channels');
    } finally {
      setSavingChannels(false);
    }
  };

  const handleSaveTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      if (editingTenantId !== null) {
        const updated = await api.put<TenantRecord>(`/api/tenants/${editingTenantId}`, tenantForm);
        setLocalTenants((prev) => prev.map((t) => (t.id === editingTenantId ? { ...t, ...updated } : t)));
        setEditingTenantId(null);
        setTenantForm(emptyTenantForm);
        setNotice(`Updated tenant workspace "${updated.brand_name}".`);
      } else {
        const created = await api.post<TenantRecord>('/api/tenants', tenantForm);
        setLocalTenants((prev) => [...prev, created]);
        setTenantForm(emptyTenantForm);
        setNotice(`Created isolated tenant workspace "${created.brand_name}" (${created.tenant_code}) with default Chart of Accounts & Chat channels.`);
      }
      if (onTenantsChanged) await onTenantsChanged();
      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tenant workspace');
    }
  };

  const handleToggleTenantStatus = async (t: TenantRecord) => {
    setError(null);
    setNotice(null);
    try {
      const nextStatus = t.status === 'Active' ? 'Suspended' : 'Active';
      const updated = await api.patch<TenantRecord>(`/api/tenants/${t.id}/status`, { status: nextStatus });
      setLocalTenants((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: updated.status } : x)));
      setNotice(`Tenant "${t.brand_name}" is now ${updated.status}.`);
      if (onTenantsChanged) await onTenantsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tenant status');
    }
  };

  const handleDeleteTenant = async (t: TenantRecord) => {
    setError(null);
    setNotice(null);
    try {
      await api.del(`/api/tenants/${t.id}`);
      setLocalTenants((prev) => prev.filter((x) => x.id !== t.id));
      if (activeTenantId === t.id && onSwitchTenant) {
        onSwitchTenant(1);
      }
      setNotice(`Deleted tenant workspace "${t.brand_name}".`);
      if (onTenantsChanged) await onTenantsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tenant');
    }
  };

  const handleExportBackup = async () => {
    try {
      const dump = await api.get<Record<string, unknown>>('/api/backup/export');
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `seven-sunday-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backup export failed');
    }
  };

  const handleClearOperationalRecords = async () => {
    setError(null);
    setNotice(null);
    try {
      await api.post('/api/admin/clear-demo');
      setNotice('Operational records for active tenant cleared safely. Users, Chart of Accounts, and Settings preserved.');
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear operational records');
    }
  };

  const handlePurgeAllEmailUsers = async () => {
    setError(null);
    setNotice(null);
    setPurgingUsers(true);
    try {
      const res = await api.post<{ ok: boolean; deletedCount: number; currentUserRemoved: boolean }>(
        '/api/users/purge-email-users'
      );
      setConfirmPurgeEmailUsers(false);
      setUsers([]);
      setNotice(`Removed ${res.deletedCount} email-registered user account(s) including Super Administrators.`);
      onRefreshDashboard();
      if (res.currentUserRemoved) {
        window.dispatchEvent(new CustomEvent('sevensunday:unauthorized'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove email-registered users');
    } finally {
      setPurgingUsers(false);
    }
  };

  const handleTestSmtp = async () => {
    setSmtpTesting(true);
    setSmtpResult(null);
    try {
      const res = await api.post<{ ok: boolean; latencyMs: number; message: string }>('/api/admin/test-smtp', {
        smtp_host: form.smtp_host,
        smtp_port: form.smtp_port,
      });
      setSmtpResult(`${res.ok ? 'Connected' : 'Probe response'}: ${res.message} (${res.latencyMs}ms)`);
    } catch (err) {
      setSmtpResult(err instanceof Error ? err.message : 'SMTP connection probe failed');
    } finally {
      setSmtpTesting(false);
    }
  };

  const handleSaveCompanyDevicePolicy = async (e: React.FormEvent, registerThisDevice = true) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSavingDevicePolicy(true);
    try {
      const res = await api.post<{
        ok: boolean;
        policy_enabled: boolean;
        company_code_hint: string;
        registered_device_uid: string | null;
      }>('/api/admin/company-devices/policy', {
        company_code: companyCodeInput.trim() || undefined,
        policy_enabled: companyPolicyActiveInput,
        register_current_device_uid: registerThisDevice ? getCompanyDeviceUid() : undefined,
        register_current_device_name: `Admin Terminal · ${getDetectedDeviceLabel()}`,
        register_current_device_os: getDetectedDeviceLabel(),
      });
      setCompanyCodeInput('');
      await loadAdminData();
      window.dispatchEvent(new CustomEvent('sevensunday:device-security-changed'));
      setNotice(
        `Company Device Security Policy ${res.policy_enabled ? 'ENFORCED' : 'Paused'} (Code: ${res.company_code_hint}).${
          res.registered_device_uid ? ` Registered this device (${res.registered_device_uid}).` : ''
        }`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Company Device Security Policy');
    } finally {
      setSavingDevicePolicy(false);
    }
  };

  const handleRegisterCompanyDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const created = await api.post<AuthorizedCompanyDeviceRecord>('/api/admin/company-devices', newCompanyDeviceForm);
      setAuthorizedDevices((prev) => [created, ...prev.filter((d) => d.id !== created.id)]);
      setNewCompanyDeviceForm({
        device_uid: '',
        device_name: '',
        assigned_branch: 'Addis Ababa HQ',
        assigned_to_email: '',
        pre_verify: false,
      });
      setNotice(`Registered authorized company device "${created.device_name}" (${created.device_uid}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register company device');
    }
  };

  const handleToggleCompanyDeviceStatus = async (dev: AuthorizedCompanyDeviceRecord) => {
    setError(null);
    try {
      const next = dev.status === 'Active' ? 'Suspended' : 'Active';
      const updated = await api.patch<AuthorizedCompanyDeviceRecord>(`/api/admin/company-devices/${dev.id}`, {
        status: next,
      });
      setAuthorizedDevices((prev) => prev.map((d) => (d.id === dev.id ? updated : d)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update device status');
    }
  };

  const handleResetCompanyDeviceVerification = async (dev: AuthorizedCompanyDeviceRecord) => {
    setError(null);
    try {
      const updated = await api.patch<AuthorizedCompanyDeviceRecord>(`/api/admin/company-devices/${dev.id}`, {
        reset_verification: true,
      });
      setAuthorizedDevices((prev) => prev.map((d) => (d.id === dev.id ? updated : d)));
      setNotice(`Cleared Company Code verification for ${dev.device_uid}. That device will require re-entering the Company Code.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset verification');
    }
  };

  const handleDeleteCompanyDevice = async (dev: AuthorizedCompanyDeviceRecord) => {
    setError(null);
    try {
      await api.del(`/api/admin/company-devices/${dev.id}`);
      setAuthorizedDevices((prev) => prev.filter((d) => d.id !== dev.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete device');
    }
  };

  const handleSaveI18nSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setI18nSavingSettings(true);
    try {
      await api.put('/api/i18n/admin/settings', {
        default_language: i18nDefaultLang,
        enabled_languages: i18nEnabledLangs,
        rtl_auto: i18nRtlAuto,
      });
      await i18n.refreshConfig();
      await loadI18nAdminData(i18nEditorLang);
      setNotice(`Saved global language settings (Default: ${findWorldLanguage(i18nDefaultLang).name}, Auto-RTL: ${i18nRtlAuto ? 'On' : 'Off'}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save language settings');
    } finally {
      setI18nSavingSettings(false);
    }
  };

  const handleSaveTranslationKey = async (translationKey: string) => {
    const val = (i18nDraftValues[translationKey] || '').trim();
    if (!val) {
      setError(`Enter a translated value for "${translationKey}" before saving.`);
      return;
    }
    setError(null);
    setI18nSavingKey(translationKey);
    try {
      await api.put('/api/i18n/admin/translations', {
        lang_code: i18nEditorLang,
        translation_key: translationKey,
        value_text: val,
        is_approved: true,
        source: 'manual',
      });
      await Promise.all([loadI18nAdminData(i18nEditorLang), i18n.refreshConfig()]);
      setNotice(`Saved & approved [${i18nEditorLang}] translation for "${translationKey}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save translation');
    } finally {
      setI18nSavingKey(null);
    }
  };

  const handleBatchAiTranslateLang = async () => {
    if (i18nEditorLang === 'en') return;
    setError(null);
    setNotice(null);
    setI18nBatchAiBusy(true);
    try {
      const res = await i18n.translateMissingWithAi(i18nEditorLang);
      await loadI18nAdminData(i18nEditorLang);
      setNotice(
        `AI translated ${res.generated} missing label(s) for ${findWorldLanguage(i18nEditorLang).name} (${res.cached} already cached).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI translation batch failed');
    } finally {
      setI18nBatchAiBusy(false);
    }
  };

  const handleImportJsonPack = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setNotice(null);
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const targetLang =
        typeof parsed.lang_code === 'string' && parsed.lang_code.trim()
          ? parsed.lang_code.trim()
          : i18nEditorLang;
      const translationsObj =
        parsed.translations && typeof parsed.translations === 'object'
          ? (parsed.translations as Record<string, unknown>)
          : parsed;
      const res = await api.post<{ ok: boolean; lang_code: string; imported: number }>('/api/i18n/admin/import', {
        lang_code: targetLang,
        translations: translationsObj,
      });
      await Promise.all([loadI18nAdminData(targetLang), i18n.refreshConfig()]);
      setI18nEditorLang(res.lang_code);
      setNotice(`Imported ${res.imported} JSON translation keys for "${res.lang_code}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON language pack file');
    } finally {
      e.target.value = '';
    }
  };

  const handleExportJsonPack = () => {
    const out: Record<string, string> = {};
    for (const k of Object.keys(EN_DICTIONARY)) {
      out[k] = i18nDraftValues[k] || i18nStaticPack[k] || (i18nEditorLang === 'en' ? EN_DICTIONARY[k] : '');
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sevensunday-locale-${i18nEditorLang}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: Array<{ key: AdminTab; label: string; icon: React.ReactNode }> = [
    { key: 'platform', label: 'System Admin Customizer', icon: <Sliders className="w-3.5 h-3.5" /> },
    { key: 'device-security', label: 'Company Devices & Code', icon: <Lock className="w-3.5 h-3.5" /> },
    { key: 'languages', label: i18n.t('admin.tab.languages', 'Language & Translations'), icon: <Globe2 className="w-3.5 h-3.5" /> },
    { key: 'tenants', label: 'Tenants (Multi-Tenancy)', icon: <Layers className="w-3.5 h-3.5" /> },
    { key: 'branding', label: 'Company & Branding', icon: <Building2 className="w-3.5 h-3.5" /> },
    { key: 'branches', label: 'Branches & Depts', icon: <GitBranch className="w-3.5 h-3.5" /> },
    { key: 'users', label: 'User Accounts', icon: <Users className="w-3.5 h-3.5" /> },
    { key: 'rbac', label: 'RBAC Roles', icon: <Shield className="w-3.5 h-3.5" /> },
    { key: 'logins', label: 'Logins & Device Connections', icon: <Cpu className="w-3.5 h-3.5" /> },
    { key: 'smtp', label: 'Backup, Reset & SMTP', icon: <Database className="w-3.5 h-3.5" /> },
  ];

  const loginAudits = auditLogs.filter((l) => l.action === 'LOGIN' || l.module === 'Authentication' || l.module === 'Auth');

  return (
    <div className="space-y-6">
      {/* Header Banner + Admin Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#172033] dark:text-white">
              System Administrator & Company Governance Console
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Full-platform System Administrator controls: customize all {ALL_MATRIX_MODULES.length} modules, multi-tenant workspaces, approving departments, 200+ languages &amp; RTL, branding, RBAC, and SMTP.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              Tenant #{activeTenantId} · {currentUserRole}
            </span>
            <button
              type="button"
              onClick={handleExportBackup}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded-lg whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export Full JSON Backup
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key);
                  setError(null);
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#18243A] text-white'
                    : 'bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-slate-200 hover:bg-[#EAF4FF]'
                }`}
              >
                <span className={active ? 'text-[#087CEB]' : 'text-[#18243A] dark:text-[#38BDF8]'}>{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {notice && (
        <div className="px-4 py-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg">
          {notice}
        </div>
      )}
      {error && (
        <div className="px-4 py-2.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg">
          {error}
        </div>
      )}

      {/* TAB: SYSTEM ADMIN PLATFORM CUSTOMIZER */}
      {tab === 'platform' && (
        <form onSubmit={handleSavePlatformConfig} className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#172033] dark:text-white">
                  System Administrator — Full Platform & Brand Customizer
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Edit platform title, theme colors, monthly standard payroll hours, feature flags, approving departments, and all 25 module labels/availability for this tenant.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetPlatformDefaults}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Defaults
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Platform Customizations
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Platform Browser & Header Title
                </label>
                <input
                  type="text"
                  value={platformCfg.platform_title}
                  onChange={(e) => setPlatformCfg({ ...platformCfg, platform_title: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Standard Monthly Work Hours (Payroll Rate)
                </label>
                <input
                  type="number"
                  min={80}
                  max={300}
                  value={platformCfg.standard_monthly_hours}
                  onChange={(e) =>
                    setPlatformCfg({ ...platformCfg, standard_monthly_hours: Number(e.target.value) || 208 })
                  }
                  className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Login Screen Announcement Banner
                </label>
                <input
                  type="text"
                  placeholder="Optional notice on login screen..."
                  value={platformCfg.login_notice}
                  onChange={(e) => setPlatformCfg({ ...platformCfg, login_notice: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Primary Brand Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={platformCfg.primary_color}
                    onChange={(e) => setPlatformCfg({ ...platformCfg, primary_color: e.target.value })}
                    className="w-10 h-9 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={platformCfg.primary_color}
                    onChange={(e) => setPlatformCfg({ ...platformCfg, primary_color: e.target.value })}
                    className="flex-1 px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Secondary Sidebar Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={platformCfg.secondary_color}
                    onChange={(e) => setPlatformCfg({ ...platformCfg, secondary_color: e.target.value })}
                    className="w-10 h-9 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={platformCfg.secondary_color}
                    onChange={(e) => setPlatformCfg({ ...platformCfg, secondary_color: e.target.value })}
                    className="flex-1 px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Accent Highlight Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={platformCfg.accent_color}
                    onChange={(e) => setPlatformCfg({ ...platformCfg, accent_color: e.target.value })}
                    className="w-10 h-9 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={platformCfg.accent_color}
                    onChange={(e) => setPlatformCfg({ ...platformCfg, accent_color: e.target.value })}
                    className="flex-1 px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <label className="flex items-center gap-2.5 p-3 bg-[#F8FAFC] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={platformCfg.enable_multi_language}
                  onChange={(e) => setPlatformCfg({ ...platformCfg, enable_multi_language: e.target.checked })}
                  className="w-4 h-4 accent-[#087CEB]"
                />
                <span>Enable Multi-Language Switcher (200+ Languages)</span>
              </label>
              <label className="flex items-center gap-2.5 p-3 bg-[#F8FAFC] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={platformCfg.enable_multi_tenant}
                  onChange={(e) => setPlatformCfg({ ...platformCfg, enable_multi_tenant: e.target.checked })}
                  className="w-4 h-4 accent-[#087CEB]"
                />
                <span>Enable Multi-Tenant Switcher in Header</span>
              </label>
              <label className="flex items-center gap-2.5 p-3 bg-[#F8FAFC] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={platformCfg.enable_gate_pass_qr}
                  onChange={(e) => setPlatformCfg({ ...platformCfg, enable_gate_pass_qr: e.target.checked })}
                  className="w-4 h-4 accent-[#087CEB]"
                />
                <span>Enforce Single-Use Gate Pass QR Token</span>
              </label>
            </div>
          </div>

          {/* Approving Departments Customizer */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-[#172033] dark:text-white">
                  Editable Approving Departments ("Send to Approve Dept" Workflow Targets)
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Changes apply across Payroll, Secretary, Company Forms, Finance, Gate Pass, and Supply Chain approval routing.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add approving dept..."
                  value={newApproveDept}
                  onChange={(e) => setNewApproveDept(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    const clean = newApproveDept.trim();
                    if (!clean || platformCfg.custom_approving_departments.includes(clean)) return;
                    setPlatformCfg({
                      ...platformCfg,
                      custom_approving_departments: [...platformCfg.custom_approving_departments, clean],
                    });
                    setNewApproveDept('');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-[#18243A] hover:bg-[#172033] rounded-lg whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5 text-[#087CEB]" />
                  Add Target
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {platformCfg.custom_approving_departments.map((dept, idx) => (
                <div
                  key={`${dept}-${idx}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
                >
                  <span className="truncate text-[#172033] dark:text-white">{dept}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setPlatformCfg({
                        ...platformCfg,
                        custom_approving_departments: platformCfg.custom_approving_departments.filter(
                          (_, i) => i !== idx
                        ),
                      })
                    }
                    className="text-slate-400 hover:text-red-600 shrink-0"
                    title="Remove department"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* All 25 Platform Modules Editable Registry */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <h4 className="text-sm font-bold text-[#172033] dark:text-white">
                All {ALL_MATRIX_MODULES.length} Platform Modules — Custom Sidebar Labels, Header Titles & Active Status
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Leave custom labels blank to use automatic 6-language translations, or enter custom names for this tenant. System Administrator always retains Admin & Dashboard access.
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#18243A] text-white">
                    <th className="py-2.5 px-3">Module Key</th>
                    <th className="py-2.5 px-3">Enabled</th>
                    <th className="py-2.5 px-3">Custom Sidebar Label Override</th>
                    <th className="py-2.5 px-3">Custom Page Header Title Override</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {ALL_MATRIX_MODULES.map((m) => {
                    const isDisabled = platformCfg.disabled_modules.includes(m.key);
                    const lockedCore = m.key === 'dashboard' || m.key === 'admin';
                    return (
                      <tr key={m.key} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-mono font-semibold text-[#172033] dark:text-white">
                          {m.key} <span className="font-sans text-slate-400 font-normal">({m.label})</span>
                        </td>
                        <td className="py-2 px-3">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!isDisabled}
                              disabled={lockedCore}
                              onChange={(e) => {
                                const enabled = e.target.checked;
                                setPlatformCfg((prev) => ({
                                  ...prev,
                                  disabled_modules: enabled
                                    ? prev.disabled_modules.filter((x) => x !== m.key)
                                    : [...prev.disabled_modules, m.key],
                                }));
                              }}
                              className="w-4 h-4 accent-[#087CEB]"
                            />
                            <span className={isDisabled ? 'text-red-600 font-semibold' : 'text-emerald-700 dark:text-emerald-400 font-semibold'}>
                              {isDisabled ? 'Hidden' : 'Active'}
                            </span>
                          </label>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            placeholder={`Default (${m.label})`}
                            value={platformCfg.custom_module_labels[m.key] || ''}
                            onChange={(e) =>
                              setPlatformCfg((prev) => ({
                                ...prev,
                                custom_module_labels: {
                                  ...prev.custom_module_labels,
                                  [m.key]: e.target.value,
                                },
                              }))
                            }
                            className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            placeholder="Use localized default title"
                            value={platformCfg.custom_module_titles[m.key] || ''}
                            onChange={(e) =>
                              setPlatformCfg((prev) => ({
                                ...prev,
                                custom_module_titles: {
                                  ...prev.custom_module_titles,
                                  [m.key]: e.target.value,
                                },
                              }))
                            }
                            className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </form>
      )}

      {/* TAB: TENANTS (MULTI-TENANCY) */}
      {tab === 'tenants' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#172033] dark:text-white">
                  {editingTenantId !== null ? `Edit Tenant Workspace #${editingTenantId}` : 'Create Isolated Multi-Tenant Organization / Plant'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Each tenant has isolated SQLite Employees, Payroll, Attendance, Devices, Inventory, Finance Ledger, Approvals, Forms & Chat channels.
                </p>
              </div>
              {editingTenantId !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTenantId(null);
                    setTenantForm(emptyTenantForm);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-[#172033]"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <form onSubmit={handleSaveTenant} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Tenant Code</label>
                <input
                  type="text"
                  placeholder="SS-BD-04"
                  value={tenantForm.tenant_code}
                  onChange={(e) => setTenantForm({ ...tenantForm, tenant_code: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Legal Workspace Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Seven Sunday Bahir Dar Plant"
                  value={tenantForm.name}
                  onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Brand Display Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Bahir Dar Plant"
                  value={tenantForm.brand_name}
                  onChange={(e) => setTenantForm({ ...tenantForm, brand_name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Location / Address</label>
                <input
                  type="text"
                  value={tenantForm.address}
                  onChange={(e) => setTenantForm({ ...tenantForm, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Default Currency</label>
                <select
                  value={tenantForm.default_currency}
                  onChange={(e) =>
                    setTenantForm({
                      ...tenantForm,
                      default_currency: e.target.value as TenantRecord['default_currency'],
                    })
                  }
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="ETB">ETB</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="CNY">CNY</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Calendar Mode</label>
                <select
                  value={tenantForm.calendar_mode}
                  onChange={(e) =>
                    setTenantForm({ ...tenantForm, calendar_mode: e.target.value as 'Gregorian' | 'Ethiopian' })
                  }
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="Gregorian">Gregorian</option>
                  <option value="Ethiopian">Ethiopian (E.C.)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Default Language</label>
                <select
                  value={tenantForm.default_language}
                  onChange={(e) =>
                    setTenantForm({ ...tenantForm, default_language: e.target.value as AppLang })
                  }
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  {WORLD_LANGUAGES.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.name} ({opt.nativeName})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {editingTenantId !== null ? 'Save Tenant Changes' : 'Provision New Tenant'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#172033] dark:text-white">
                Active Multi-Tenant Workspaces ({localTenants.length})
              </h3>
              <span className="text-xs text-slate-500">Click Switch Workspace to enter any tenant immediately</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#18243A] text-white">
                    <th className="py-2.5 px-4">Tenant / Code</th>
                    <th className="py-2.5 px-4">Location & Localization</th>
                    <th className="py-2.5 px-4">Isolated Metrics</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {localTenants.map((t) => {
                    const isCurrent = t.id === activeTenantId;
                    return (
                      <tr key={t.id} className={isCurrent ? 'bg-[#EAF4FF]/40 dark:bg-slate-800/50' : ''}>
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#172033] dark:text-white flex items-center gap-1.5">
                            <span>{t.brand_name}</span>
                            {isCurrent && (
                              <span className="text-[10px] font-mono font-bold text-[#087CEB]">· ACTIVE</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {t.tenant_code} · {t.name}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          <div>{t.address}</div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {t.default_currency} · {t.calendar_mode} · {t.default_language.toUpperCase()}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-[#172033] dark:text-slate-200">
                          {t.employee_count ?? 0} staff · {t.device_count ?? 0} devices · {t.pending_approvals ?? 0} pending
                        </td>
                        <td className="py-3 px-4 font-semibold">
                          <span className={t.status === 'Active' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}>
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {onSwitchTenant && (
                              <button
                                type="button"
                                disabled={isCurrent}
                                onClick={() => onSwitchTenant(t.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-40 rounded-lg whitespace-nowrap"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {isCurrent ? 'Current' : 'Switch'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTenantId(t.id);
                                setTenantForm({
                                  tenant_code: t.tenant_code,
                                  name: t.name,
                                  brand_name: t.brand_name,
                                  slogan: t.slogan,
                                  secondary_slogan: t.secondary_slogan,
                                  address: t.address,
                                  phone: t.phone,
                                  email: t.email,
                                  default_currency: t.default_currency,
                                  calendar_mode: t.calendar_mode,
                                  default_language: t.default_language,
                                  plan: t.plan,
                                  branches: t.branches,
                                  departments: t.departments,
                                });
                              }}
                              className="p-1.5 text-[#172033] dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg"
                              title="Edit Tenant"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {t.id !== 1 && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleToggleTenantStatus(t)}
                                  className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg whitespace-nowrap"
                                >
                                  {t.status === 'Active' ? 'Suspend' : 'Activate'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTenant(t)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg whitespace-nowrap"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: COMPANY & BRANDING */}
      {tab === 'branding' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-[#172033] dark:text-white">
                Official Company Logo, Stamp & Authorized Signature
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Uploaded assets render automatically on A4 Secretary letters, Staff ID cards, Payslips, Vouchers, and Corporate Reports for Tenant #{activeTenantId}.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Logo Upload */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-[#F8FAFC] dark:bg-slate-800/50 flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#172033] dark:text-white">Official Company Logo</span>
                  {form.logo_data && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, logo_data: '' })}
                      className="text-[11px] text-red-600 hover:underline"
                    >
                      Reset Default
                    </button>
                  )}
                </div>
                <div className="h-24 bg-white border border-slate-200 rounded-lg flex items-center justify-center p-2 overflow-hidden">
                  <img
                    src={form.logo_data || '/assets/aistudio/Seven_Sunday_Logo_2_desktop_addf2fa7.png'}
                    alt="Official Company Logo"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg cursor-pointer whitespace-nowrap">
                  <ImagePlus className="w-3.5 h-3.5" />
                  Upload Official Company Logo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      handleImageUpload('logo_data', e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              {/* Stamp Upload */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-[#F8FAFC] dark:bg-slate-800/50 flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#172033] dark:text-white">Official Company Stamp</span>
                  {form.stamp_data && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, stamp_data: '' })}
                      className="text-[11px] text-red-600 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="h-24 bg-white border border-slate-200 rounded-lg flex items-center justify-center p-2 overflow-hidden">
                  {form.stamp_data ? (
                    <img src={form.stamp_data} alt="Official Company Stamp" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <div className="w-20 h-20 rounded-full border-2 border-dashed border-[#18243A]/40 flex flex-col items-center justify-center text-[9px] font-bold text-[#18243A] text-center leading-tight px-1">
                      <span>SEVEN SUNDAY</span>
                      <span className="text-[#087CEB]">OFFICIAL SEAL</span>
                    </div>
                  )}
                </div>
                <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg cursor-pointer whitespace-nowrap">
                  <ImagePlus className="w-3.5 h-3.5" />
                  Upload Official Company Stamp
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      handleImageUpload('stamp_data', e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              {/* Signature Upload */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-[#F8FAFC] dark:bg-slate-800/50 flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#172033] dark:text-white">Authorized Signature</span>
                  {form.signature_data && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, signature_data: '' })}
                      className="text-[11px] text-red-600 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="h-24 bg-white border border-slate-200 rounded-lg flex items-center justify-center p-2 overflow-hidden">
                  {form.signature_data ? (
                    <img src={form.signature_data} alt="Authorized Signature" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-xs italic text-slate-400">No signature image uploaded yet</span>
                  )}
                </div>
                <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg cursor-pointer whitespace-nowrap">
                  <ImagePlus className="w-3.5 h-3.5" />
                  Upload Authorized Signature
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      handleImageUpload('signature_data', e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h3 className="text-base font-bold text-[#172033] dark:text-white mb-4">
              Verified Company Registration & Localization
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Company Legal Name</label>
                <input
                  type="text"
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Brand Name</label>
                <input
                  type="text"
                  value={form.brand_name}
                  onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">TIN / Registration Number</label>
                <input
                  type="text"
                  placeholder="Enter verified TIN"
                  value={form.tin_number}
                  onChange={(e) => setForm({ ...form, tin_number: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Primary Slogan</label>
                <input
                  type="text"
                  value={form.slogan}
                  onChange={(e) => setForm({ ...form, slogan: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Secondary Slogan</label>
                <input
                  type="text"
                  value={form.secondary_slogan}
                  onChange={(e) => setForm({ ...form, secondary_slogan: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Headquarters Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Official Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Website</label>
                <input
                  type="text"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Default Currency</label>
                <select
                  value={form.default_currency}
                  onChange={(e) => setForm({ ...form, default_currency: e.target.value as CompanySettings['default_currency'] })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="ETB">ETB (Ethiopian Birr)</option>
                  <option value="USD">USD (US Dollar)</option>
                  <option value="EUR">EUR (Euro)</option>
                  <option value="CNY">CNY (Chinese Yuan)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Calendar Mode</label>
                <select
                  value={form.calendar_mode}
                  onChange={(e) => setForm({ ...form, calendar_mode: e.target.value as 'Gregorian' | 'Ethiopian' })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="Gregorian">Gregorian Calendar</option>
                  <option value="Ethiopian">Ethiopian Calendar (E.C.)</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  <Globe2 className="w-3.5 h-3.5 text-[#087CEB]" />
                  <span>System Default Language</span>
                </label>
                <select
                  value={form.default_language}
                  onChange={(e) => setForm({ ...form, default_language: e.target.value as AppLang })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  {WORLD_LANGUAGES.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.nativeName} · {opt.name} ({opt.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#18243A] hover:bg-[#172033] rounded-lg whitespace-nowrap"
              >
                <Save className="w-4 h-4 text-[#087CEB]" />
                Save Company & Branding
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: BRANCHES & DEPARTMENTS */}
      {tab === 'branches' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-[#172033] dark:text-white">
              Registered Company Branches ({branchesList.length})
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add new branch (e.g. Dire Dawa Hub)"
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newBranch.trim()) return;
                  const updated = [...branchesList, newBranch.trim()].join(', ');
                  const next = { ...form, branches: updated };
                  setForm(next);
                  setNewBranch('');
                  persistCompanySettings(next, 'Branch list updated.');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Branch
              </button>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
              {branchesList.map((b, idx) => (
                <div key={`${b}-${idx}`} className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <span className="font-medium text-[#172033] dark:text-white">{b}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = branchesList.filter((_, i) => i !== idx).join(', ');
                      const next = { ...form, branches: updated };
                      setForm(next);
                      persistCompanySettings(next, 'Removed branch.');
                    }}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="Remove branch"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-[#172033] dark:text-white">
              Organizational Departments ({departmentsList.length})
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add new department (e.g. Quality Control)"
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newDept.trim()) return;
                  const updated = [...departmentsList, newDept.trim()].join(', ');
                  const next = { ...form, departments: updated };
                  setForm(next);
                  setNewDept('');
                  persistCompanySettings(next, 'Departments updated.');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Dept
              </button>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
              {departmentsList.map((d, idx) => (
                <div key={`${d}-${idx}`} className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <span className="font-medium text-[#172033] dark:text-white">{d}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = departmentsList.filter((_, i) => i !== idx).join(', ');
                      const next = { ...form, departments: updated };
                      setForm(next);
                      persistCompanySettings(next, 'Removed department.');
                    }}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="Remove department"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: USER ACCOUNTS */}
      {tab === 'users' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#087CEB]" />
              <h3 className="text-base font-bold text-[#172033] dark:text-white">
                Ethiopia User Accounts ({users.length})
              </h3>
            </div>
            {(currentUserRole === 'Super Administrator' || currentUserRole === 'System Administrator') && users.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmPurgeEmailUsers((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 hover:bg-red-100 rounded-lg whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove All Email Users (incl. Super Admin)
              </button>
            )}
          </div>

          {confirmPurgeEmailUsers && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="text-red-800 dark:text-red-200">
                <span className="font-bold">Confirm User Purge:</span> This permanently removes all email-registered user accounts (including Super Administrator accounts) and signs out active sessions.
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setConfirmPurgeEmailUsers(false)}
                  className="px-3 py-1.5 font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={purgingUsers}
                  onClick={handlePurgeAllEmailUsers}
                  className="px-3 py-1.5 font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg"
                >
                  {purgingUsers ? 'Removing...' : 'Confirm Remove All'}
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            <input
              type="text"
              required
              placeholder="Full Name"
              value={userForm.full_name}
              onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
              className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
            <input
              type="email"
              required
              placeholder="user@sevensundayethiopia.com"
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
            <input
              type="password"
              required
              minLength={8}
              placeholder="Password (min 8, A-z + 0-9)"
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
            <input
              type="text"
              placeholder="Department"
              value={userForm.department}
              onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
              className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
            <input
              type="text"
              placeholder="Job Title"
              value={userForm.job_title}
              onChange={(e) => setUserForm({ ...userForm, job_title: e.target.value })}
              className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
            <select
              value={userForm.role}
              onChange={(e) => setUserForm({ ...userForm, role: e.target.value as UserRole })}
              className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#18243A] hover:bg-[#172033] rounded-lg whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-[#087CEB]" />
              Add User
            </button>
          </form>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <th className="py-2.5 px-4">User / Email</th>
                  <th className="py-2.5 px-4">Department & Title</th>
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-4">Status & Security</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {users.map((u) => {
                  const isLocked = Boolean(u.locked_until && new Date(u.locked_until).getTime() > Date.now());
                  return (
                    <tr key={u.id}>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-[#172033] dark:text-white">{u.full_name}</div>
                        <div className="text-xs font-mono text-slate-500">
                          {u.email} · {u.employee_code}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                        {u.department} · {u.job_title}
                      </td>
                      <td className="py-2.5 px-4 text-xs">
                        <select
                          value={u.role}
                          onChange={async (e) => {
                            const updated = await api.patch<UserAccount>(`/api/users/${u.id}/status`, {
                              role: e.target.value,
                            });
                            setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
                          }}
                          className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800"
                        >
                          {ALL_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-4 text-xs font-semibold">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={u.status === 'Active' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}>
                            {u.status}
                          </span>
                          {Boolean(u.mfa_enabled) && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 rounded">
                              <Shield className="w-2.5 h-2.5" />
                              2FA Active
                            </span>
                          )}
                          {isLocked && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded">
                              <Lock className="w-2.5 h-2.5" />
                              Locked
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isLocked && (
                            <button
                              type="button"
                              onClick={() => handleUnlockUser(u.id, u.email)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg whitespace-nowrap"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              Unlock
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              const nextStatus = u.status === 'Active' ? 'Suspended' : 'Active';
                              const updated = await api.patch<UserAccount>(`/api/users/${u.id}/status`, {
                                status: nextStatus,
                              });
                              setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg whitespace-nowrap"
                          >
                            {u.status === 'Active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            {u.status === 'Active' ? 'Suspend' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await api.del(`/api/users/${u.id}`);
                              setUsers((prev) => prev.filter((x) => x.id !== u.id));
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg whitespace-nowrap"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: RBAC ROLES */}
      {tab === 'rbac' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#172033] dark:text-white">
                16-Role Access Control (RBAC) Matrix
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                System Administrator & Super Administrator hold full locked access across all 25 modules. Toggle permissions for other roles and save.
              </p>
            </div>
            <button
              type="button"
              onClick={() => persistCompanySettings(form, 'RBAC role permissions matrix saved.')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#18243A] hover:bg-[#172033] rounded-lg whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5 text-[#087CEB]" />
              Save RBAC Matrix
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#18243A] text-white">
                  <th className="py-2.5 px-3 sticky left-0 bg-[#18243A] z-10 min-w-[180px]">Role</th>
                  {ALL_MATRIX_MODULES.map((m) => (
                    <th key={m.key} className="py-2.5 px-2 text-center whitespace-nowrap font-semibold">
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {ALL_ROLES.map((role) => {
                  const allowed = rbacMatrix[role] || [];
                  const locked = role === 'System Administrator' || role === 'Super Administrator';
                  return (
                    <tr key={role} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 font-semibold text-[#172033] dark:text-white sticky left-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                        {role}
                      </td>
                      {ALL_MATRIX_MODULES.map((m) => {
                        const checked = locked ? true : allowed.includes(m.key);
                        return (
                          <td key={`${role}-${m.key}`} className="py-2 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={locked}
                              onChange={() => handleToggleRbacModule(role, m.key)}
                              className="w-3.5 h-3.5 accent-[#087CEB] cursor-pointer"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Granular Action Permissions Matrix (Enforced Server-Side) */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div>
              <h4 className="text-sm font-bold text-[#172033] dark:text-white">
                Granular Action Permissions (View, Create, Edit, Delete, Approve, Export, Manage)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Server-enforced per-role operation privileges across Tenant #{activeTenantId}. Save individual roles below.
              </p>
            </div>
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 font-semibold text-slate-600 dark:text-slate-300">
                    <th className="py-2.5 px-3 min-w-[180px]">Role</th>
                    {(['view', 'create', 'edit', 'delete', 'approve', 'export', 'manage'] as const).map((k) => (
                      <th key={k} className="py-2.5 px-3 text-center uppercase">
                        {k}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {ALL_ROLES.map((role) => {
                    const locked = role === 'System Administrator' || role === 'Super Administrator';
                    const p: RbacActionPermissions = actionPerms[role] || {
                      view: true,
                      create: locked,
                      edit: locked,
                      delete: locked,
                      approve: locked,
                      export: locked,
                      manage: locked,
                    };
                    return (
                      <tr key={`act-${role}`} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-semibold text-[#172033] dark:text-white whitespace-nowrap">
                          {role}
                        </td>
                        {(['view', 'create', 'edit', 'delete', 'approve', 'export', 'manage'] as const).map((k) => (
                          <td key={`${role}-${k}`} className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={locked ? true : Boolean(p[k])}
                              disabled={locked}
                              onChange={() => handleToggleActionPerm(role, k)}
                              className="w-3.5 h-3.5 accent-[#087CEB] cursor-pointer"
                            />
                          </td>
                        ))}
                        <td className="py-2 px-3 text-right">
                          {locked ? (
                            <span className="text-[11px] font-mono text-slate-400">Locked</span>
                          ) : (
                            <button
                              type="button"
                              disabled={savingActionRole === role}
                              onClick={() => handleSaveActionPerms(role)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded disabled:opacity-60"
                            >
                              <Save className="w-3 h-3" />
                              {savingActionRole === role ? 'Saving...' : 'Save Actions'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: LOGINS & DEVICE CONNECTIONS */}
      {tab === 'logins' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#172033] dark:text-white">Account Login Sessions</h3>
              <span className="text-xs font-mono text-slate-500">{loginAudits.length} events</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 font-semibold text-slate-600 dark:text-slate-300">
                    <th className="py-2.5 px-4">Account & Role</th>
                    <th className="py-2.5 px-4">Last Login</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {users.map((u) => {
                    const lastSeen = u.last_login || u.last_login_at;
                    return (
                      <tr key={u.id}>
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-[#172033] dark:text-white">{u.full_name}</div>
                          <div className="text-[11px] text-slate-500">
                            {u.email} · {u.role}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                          {lastSeen ? new Date(lastSeen).toLocaleString() : 'Never signed in'}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-emerald-700 dark:text-emerald-400">
                          {u.status}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#172033] dark:text-white">Device Connections (Tenant #{activeTenantId})</h3>
              <span className="text-xs font-mono text-slate-500">{devices.length} endpoints</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 font-semibold text-slate-600 dark:text-slate-300">
                    <th className="py-2.5 px-4">Device Connection</th>
                    <th className="py-2.5 px-4">Protocol / IP : Port / SN</th>
                    <th className="py-2.5 px-4">Status & Syncs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {devices.map((d) => (
                    <tr key={d.id}>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-[#172033] dark:text-white">{d.device_name}</div>
                        <div className="text-[11px] text-slate-500">{d.device_type}</div>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                        <div className="text-[#087CEB] font-semibold">{d.protocol || 'TCP/IP Socket'}</div>
                        <div>
                          {d.ip_address}:{d.port} · {d.serial_number}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 font-semibold">
                        <span className={d.status === 'Connected' ? 'text-emerald-700' : 'text-amber-700'}>
                          {d.status}
                        </span>
                        <div className="text-[11px] font-mono text-slate-400">{d.punch_count || 0} syncs</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#172033] dark:text-white">
                Login Attempt &amp; Brute-Force Security Monitor
              </h3>
              <span className="text-xs font-mono text-slate-500">{loginAttempts.length} recorded attempts</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 font-semibold text-slate-600 dark:text-slate-300">
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4">Email</th>
                    <th className="py-2.5 px-4">Client IP</th>
                    <th className="py-2.5 px-4">Outcome</th>
                    <th className="py-2.5 px-4">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {loginAttempts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500">
                        No login attempt events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    loginAttempts.map((att) => (
                      <tr key={att.id}>
                        <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {new Date(att.created_at).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-semibold text-[#172033] dark:text-white">
                          {att.email}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-500">{att.ip_address || '--'}</td>
                        <td className="py-2.5 px-4 font-bold">
                          {att.success ? (
                            <span className="text-emerald-700 dark:text-emerald-400">Success</span>
                          ) : (
                            <span className="text-red-700 dark:text-red-400">Blocked / Failed</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{att.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: COMPANY DEVICES & SECURITY CODE */}
      {tab === 'device-security' && (
        <div className="space-y-6">
          <form
            onSubmit={(e) => handleSaveCompanyDevicePolicy(e, true)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-[#172033] dark:text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#087CEB]" />
                  Company Security Code &amp; Device Authorization Policy
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure the Company Code once. Once enforced, any unregistered device sees a blocking 35% security
                  popup until registered here by an Admin / Super Administrator and unlocked with the Company Code.
                </p>
              </div>
              <div className="text-xs font-mono">
                {companySecPolicy.policy_enabled ? (
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold">
                    ENFORCED · Code {companySecPolicy.company_code_hint || 'Set'}
                  </span>
                ) : (
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded font-bold">
                    FIRST-TIME SETUP (OPEN)
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  {companySecPolicy.company_code_hint
                    ? `Update Company Code (Current: ${companySecPolicy.company_code_hint})`
                    : 'Set New Company Security Code *'}
                </label>
                <input
                  type="text"
                  placeholder={companySecPolicy.company_code_hint ? 'Leave blank to keep existing code' : 'e.g. SS-ETH-2026'}
                  value={companyCodeInput}
                  onChange={(e) => setCompanyCodeInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] text-slate-500">Current Workstation Device ID</div>
                <div className="text-xs font-mono font-bold text-[#172033] dark:text-white">
                  {getCompanyDeviceUid()}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#172033] dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={companyPolicyActiveInput}
                    onChange={(e) => setCompanyPolicyActiveInput(e.target.checked)}
                    className="w-4 h-4 accent-[#087CEB]"
                  />
                  Enforce Device Gate
                </label>
                <button
                  type="submit"
                  disabled={savingDevicePolicy}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-60 rounded-lg whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingDevicePolicy ? 'Saving...' : 'Save Code & Register This Device'}
                </button>
              </div>
            </div>
          </form>

          {/* Register Additional Company Devices */}
          <form
            onSubmit={handleRegisterCompanyDevice}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
          >
            <div>
              <h4 className="text-sm font-bold text-[#172033] dark:text-white">
                Register Authorized Company Device
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Copy the Device ID shown on a staff laptop, tablet, or gate kiosk popup and register it here so the
                user can unlock it using the Company Code.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Device UID *</label>
                <input
                  type="text"
                  required
                  placeholder="SS-TERM-XXXX-XXXX-XXXX"
                  value={newCompanyDeviceForm.device_uid}
                  onChange={(e) =>
                    setNewCompanyDeviceForm({ ...newCompanyDeviceForm, device_uid: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Device Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HR Reception PC"
                  value={newCompanyDeviceForm.device_name}
                  onChange={(e) => setNewCompanyDeviceForm({ ...newCompanyDeviceForm, device_name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Branch</label>
                <input
                  type="text"
                  placeholder="Addis Ababa HQ"
                  value={newCompanyDeviceForm.assigned_branch}
                  onChange={(e) =>
                    setNewCompanyDeviceForm({ ...newCompanyDeviceForm, assigned_branch: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Assigned Staff Email
                </label>
                <input
                  type="email"
                  placeholder="optional@sevensundayethiopia.com"
                  value={newCompanyDeviceForm.assigned_to_email}
                  onChange={(e) =>
                    setNewCompanyDeviceForm({ ...newCompanyDeviceForm, assigned_to_email: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#18243A] hover:bg-[#172033] rounded-lg whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5 text-[#087CEB]" />
                  Register Device
                </button>
              </div>
            </div>
          </form>

          {/* Authorized Devices List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h4 className="text-sm font-bold text-[#172033] dark:text-white">
                Authorized Company Devices ({authorizedDevices.length})
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#18243A] text-white">
                    <th className="py-2.5 px-4">Device UID</th>
                    <th className="py-2.5 px-4">Device Name &amp; Branch</th>
                    <th className="py-2.5 px-4">Registered By</th>
                    <th className="py-2.5 px-4">Company Code Status</th>
                    <th className="py-2.5 px-4">Access Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {authorizedDevices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        No company devices registered yet. Save a Company Security Code above to register this workstation.
                      </td>
                    </tr>
                  ) : (
                    authorizedDevices.map((dev) => (
                      <tr key={dev.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-mono font-bold text-[#172033] dark:text-white">
                          {dev.device_uid}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-[#172033] dark:text-white">{dev.device_name}</div>
                          <div className="text-[11px] text-slate-500">
                            {dev.assigned_branch}
                            {dev.assigned_to_email ? ` · ${dev.assigned_to_email}` : ''}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{dev.registered_by || 'Admin'}</td>
                        <td className="py-2.5 px-4">
                          {dev.verified_at ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Code Verified
                            </span>
                          ) : (
                            <span className="text-amber-700 dark:text-amber-400 font-semibold">
                              Awaiting Code Entry
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`font-bold ${
                              dev.status === 'Active' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'
                            }`}
                          >
                            {dev.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleResetCompanyDeviceVerification(dev)}
                            className="px-2 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded"
                            title="Require device to re-enter Company Code"
                          >
                            Require Code
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleCompanyDeviceStatus(dev)}
                            className="px-2 py-1 text-[11px] font-semibold bg-[#EAF4FF] text-[#087CEB] rounded"
                          >
                            {dev.status === 'Active' ? 'Suspend' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCompanyDevice(dev)}
                            className="px-2 py-1 text-[11px] font-semibold bg-red-50 text-red-700 rounded"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: LANGUAGE & TRANSLATIONS MANAGER (200+ LANGUAGES) */}
      {tab === 'languages' && (() => {
        const totalDictKeys = Object.keys(EN_DICTIONARY).length;
        const catalogFiltered = WORLD_LANGUAGES.filter((l) => {
          const q = i18nCatalogSearch.trim().toLowerCase();
          if (!q) return true;
          return (
            l.name.toLowerCase().includes(q) ||
            l.nativeName.toLowerCase().includes(q) ||
            l.code.toLowerCase().includes(q) ||
            l.region.toLowerCase().includes(q)
          );
        });
        const dbMap = new Map(i18nEntries.map((r) => [r.translation_key, r]));
        const editorKeys = Object.keys(EN_DICTIONARY).filter((k) => {
          const q = i18nKeyFilter.trim().toLowerCase();
          if (!q) return true;
          return (
            k.toLowerCase().includes(q) ||
            EN_DICTIONARY[k].toLowerCase().includes(q) ||
            (i18nDraftValues[k] || '').toLowerCase().includes(q)
          );
        });

        return (
          <div className="space-y-6">
            {/* Global Language Policy */}
            <form
              onSubmit={handleSaveI18nSettings}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#172033] dark:text-white flex items-center gap-2">
                    <Globe2 className="w-4 h-4 text-[#087CEB]" />
                    {i18n.t('admin.i18n.title', 'Multilingual Language & Translation Management')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Configure default company language, active languages (blank = all {WORLD_LANGUAGES.length}+ world languages), RTL auto-layout, and AI-assisted UI pack caching.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={i18nSavingSettings}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-60 rounded-lg whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  {i18nSavingSettings ? 'Saving...' : 'Save Language Policy'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {i18n.t('admin.i18n.defaultLang', 'Default Company Language')}
                  </label>
                  <select
                    value={i18nDefaultLang}
                    onChange={(e) => setI18nDefaultLang(e.target.value)}
                    data-no-translate="true"
                    className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    {WORLD_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.nativeName} · {l.name} ({l.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="w-full flex items-center gap-2.5 p-2.5 bg-[#F8FAFC] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={i18nRtlAuto}
                      onChange={(e) => setI18nRtlAuto(e.target.checked)}
                      className="w-4 h-4 accent-[#087CEB]"
                    />
                    <span>{i18n.t('admin.i18n.autoRtl', 'Automatic RTL Layout (Arabic, Hebrew, Urdu, Persian)')}</span>
                  </label>
                </div>

                <div className="flex items-end justify-between gap-2 p-2.5 bg-[#EAF4FF]/60 dark:bg-sky-950/30 border border-[#087CEB]/20 rounded-lg text-xs">
                  <div>
                    <div className="font-bold text-[#18243A] dark:text-[#38BDF8]">
                      Active Catalog: {i18nEnabledLangs.length === 0 ? `All ${WORLD_LANGUAGES.length}+ Languages` : `${i18nEnabledLangs.length} Selected`}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Current UI: {i18n.currentLanguage.nativeName} ({i18n.lang}) · {i18n.dir.toUpperCase()}
                    </div>
                  </div>
                  {i18nEnabledLangs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setI18nEnabledLangs([])}
                      className="text-[11px] font-semibold text-[#087CEB] hover:underline whitespace-nowrap"
                    >
                      Enable All
                    </button>
                  )}
                </div>
              </div>
            </form>

            {/* 200+ World Languages Catalog + Coverage */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-[#172033] dark:text-white">
                    Supported World Languages Directory ({WORLD_LANGUAGES.length} ISO Languages)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Click a language to open its Translation Editor below, or check boxes to restrict the switcher to specific languages.
                  </p>
                </div>
                <input
                  type="text"
                  placeholder="Search language, native name, ISO code, region..."
                  value={i18nCatalogSearch}
                  onChange={(e) => setI18nCatalogSearch(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg w-72"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">
                {catalogFiltered.map((l) => {
                  const isStatic = l.code === 'en' || STATIC_LOCALE_CODES.has(l.code);
                  const dbCount = i18nCoverageMap[l.code] || 0;
                  const covPct = isStatic ? 100 : Math.min(100, Math.round((dbCount / Math.max(1, totalDictKeys)) * 100));
                  const isEditing = i18nEditorLang === l.code;
                  const isEnabled = i18nEnabledLangs.length === 0 || i18nEnabledLangs.includes(l.code);

                  return (
                    <div
                      key={l.code}
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 transition-colors ${
                        isEditing
                          ? 'border-[#087CEB] bg-[#EAF4FF] dark:bg-sky-950/50'
                          : 'border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/50 hover:border-[#087CEB]/50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setI18nEditorLang(l.code)}
                        className="flex-1 text-left min-w-0"
                      >
                        <div data-no-translate="true" className="font-bold text-[#172033] dark:text-white truncate">
                          {l.nativeName} <span className="font-normal text-slate-500">· {l.name}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>{l.code}</span>
                          {l.dir === 'rtl' && (
                            <span className="px-1 rounded bg-amber-100 text-amber-800 font-bold">RTL</span>
                          )}
                          <span
                            className={`px-1 rounded font-semibold ${
                              covPct === 100
                                ? 'bg-emerald-100 text-emerald-700'
                                : covPct > 0
                                ? 'bg-sky-100 text-sky-700'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {covPct}%
                          </span>
                        </div>
                      </button>
                      <input
                        type="checkbox"
                        title="Include when custom language whitelist is active"
                        checked={isEnabled}
                        onChange={() => {
                          setI18nEnabledLangs((prev) => {
                            const base = prev.length === 0 ? [l.code] : prev.includes(l.code) ? prev.filter((c) => c !== l.code) : [...prev, l.code];
                            return base;
                          });
                        }}
                        className="accent-[#087CEB] shrink-0"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Translation Editor & JSON Pack Import/Export */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-[#172033] dark:text-white">
                    Translation Key Editor — {findWorldLanguage(i18nEditorLang).nativeName} ({i18nEditorLang})
                  </h4>
                  <p className="text-xs text-slate-500">
                    Override or approve UI labels, import/export JSON packs, or auto-translate missing UI labels via Gemini (zero PII/biometrics sent).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={i18nEditorLang}
                    onChange={(e) => setI18nEditorLang(e.target.value)}
                    data-no-translate="true"
                    className="px-2.5 py-1.5 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    {WORLD_LANGUAGES.map((l) => (
                      <option key={`ed-${l.code}`} value={l.code}>
                        {l.nativeName} ({l.code})
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    placeholder="Filter key or English text..."
                    value={i18nKeyFilter}
                    onChange={(e) => setI18nKeyFilter(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg w-48"
                  />

                  {i18nEditorLang !== 'en' && (
                    <button
                      type="button"
                      disabled={i18nBatchAiBusy}
                      onClick={handleBatchAiTranslateLang}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-60 rounded-lg whitespace-nowrap"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {i18nBatchAiBusy ? 'Translating...' : i18n.t('admin.i18n.aiBatchTranslate', 'AI Translate Missing Keys')}
                    </button>
                  )}

                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-[#087CEB] rounded-lg cursor-pointer whitespace-nowrap">
                    <Upload className="w-3.5 h-3.5" />
                    {i18n.t('admin.i18n.importJson', 'Import JSON Pack')}
                    <input type="file" accept=".json,application/json" onChange={handleImportJsonPack} className="hidden" />
                  </label>

                  <button
                    type="button"
                    onClick={handleExportJsonPack}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded-lg whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {i18n.t('admin.i18n.exportJson', 'Export JSON Pack')}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-[#18243A] text-white">
                    <tr>
                      <th className="py-2.5 px-4">Dictionary Key</th>
                      <th className="py-2.5 px-4">English Source</th>
                      <th className="py-2.5 px-4">Target Translation ({i18nEditorLang})</th>
                      <th className="py-2.5 px-4">Origin</th>
                      <th className="py-2.5 px-4 text-right">Save</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {editorKeys.map((k) => {
                      const entry = dbMap.get(k);
                      const hasStatic = Boolean(i18nStaticPack[k]);
                      return (
                        <tr key={k} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                          <td className="py-2 px-4 font-mono font-semibold text-[#172033] dark:text-slate-200 whitespace-nowrap">
                            {k}
                          </td>
                          <td className="py-2 px-4 text-slate-600 dark:text-slate-400 max-w-[240px]">
                            {EN_DICTIONARY[k]}
                          </td>
                          <td className="py-2 px-4 min-w-[260px]">
                            <input
                              type="text"
                              dir={findWorldLanguage(i18nEditorLang).dir}
                              value={i18nDraftValues[k] ?? ''}
                              placeholder={EN_DICTIONARY[k]}
                              onChange={(e) =>
                                setI18nDraftValues((prev) => ({ ...prev, [k]: e.target.value }))
                              }
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                            />
                          </td>
                          <td className="py-2 px-4 whitespace-nowrap">
                            {entry ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                DB · {entry.source}
                              </span>
                            ) : hasStatic ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                                Static Pack
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-500 dark:bg-slate-800">
                                Fallback EN
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              disabled={i18nSavingKey === k}
                              onClick={() => handleSaveTranslationKey(k)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-[#18243A] hover:bg-[#087CEB] disabled:opacity-50 rounded"
                            >
                              <Save className="w-3 h-3" />
                              {i18nSavingKey === k ? '...' : 'Save'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TAB 6: BACKUP, RESET & SMTP */}
      {tab === 'smtp' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSaveSettings}
            className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#087CEB]" />
                <h3 className="text-base font-bold text-[#172033] dark:text-white">SMTP Corporate Email Server</h3>
              </div>
              <button
                type="button"
                disabled={smtpTesting}
                onClick={handleTestSmtp}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded-lg whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                {smtpTesting ? 'Testing...' : 'Test SMTP Connection'}
              </button>
            </div>

            {smtpResult && (
              <div className="px-3 py-2 text-xs font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[#172033] dark:text-slate-200">
                {smtpResult}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">SMTP Host</label>
                <input
                  type="text"
                  value={form.smtp_host || ''}
                  onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">SMTP Port</label>
                <input
                  type="number"
                  value={form.smtp_port ?? 587}
                  onChange={(e) => setForm({ ...form, smtp_port: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">SMTP Username</label>
                <input
                  type="text"
                  value={form.smtp_user || ''}
                  onChange={(e) => setForm({ ...form, smtp_user: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">SMTP Password</label>
                <input
                  type="password"
                  value={form.smtp_pass || ''}
                  onChange={(e) => setForm({ ...form, smtp_pass: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Sender From Address</label>
                <input
                  type="text"
                  value={form.smtp_from || ''}
                  onChange={(e) => setForm({ ...form, smtp_from: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-[#172033] dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(form.smtp_secure)}
                  onChange={(e) => setForm({ ...form, smtp_secure: e.target.checked ? 1 : 0 })}
                  className="w-4 h-4 accent-[#087CEB]"
                />
                Use TLS / SSL Encryption
              </label>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#18243A] hover:bg-[#172033] rounded-lg whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5 text-[#087CEB]" />
                Save SMTP Config
              </button>
            </div>
          </form>

          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-[#172033] dark:text-white">Database Backup & Tenant Reset Controls</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Download a full SQLite JSON snapshot across all tenants before clearing operational records for Tenant #{activeTenantId}.
            </p>
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleExportBackup}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                Download Full Database JSON Backup
              </button>
              <button
                type="button"
                onClick={handleClearOperationalRecords}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4" />
                Clear Operational Records (Reset Tenant)
              </button>
            </div>
          </div>

          {/* Multi-Channel Notifications (Telegram Bot & Webhook) */}
          <form
            onSubmit={handleSaveChannels}
            className="lg:col-span-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#087CEB]" />
                <div>
                  <h3 className="text-base font-bold text-[#172033] dark:text-white">
                    Multi-Channel Real-Time Notification Dispatch (Email, Telegram Bot & Webhook)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configure live external alerts for approvals, payroll runs, low stock, attendance events, and account lockouts.
                  </p>
                </div>
              </div>
              <button
                type="submit"
                disabled={savingChannels}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#18243A] hover:bg-[#172033] disabled:opacity-60 rounded-lg whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5 text-[#087CEB]" />
                {savingChannels ? 'Saving Channels...' : 'Save Notification Channels'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-[#F8FAFC] dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-[#172033] dark:text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(channelsCfg.email_enabled)}
                    onChange={(e) => setChannelsCfg({ ...channelsCfg, email_enabled: e.target.checked ? 1 : 0 })}
                    className="w-4 h-4 accent-[#087CEB]"
                  />
                  Enable SMTP Email Alerts
                </label>
                <p className="text-[11px] text-slate-500">
                  Dispatches real emails using the SMTP server configured above when recipients are present.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-[#F8FAFC] dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-[#172033] dark:text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(channelsCfg.telegram_enabled)}
                    onChange={(e) => setChannelsCfg({ ...channelsCfg, telegram_enabled: e.target.checked ? 1 : 0 })}
                    className="w-4 h-4 accent-[#087CEB]"
                  />
                  Enable Telegram Bot Alerts
                </label>
                <input
                  type="password"
                  placeholder="Bot Token (123456:ABC...)"
                  value={channelsCfg.telegram_bot_token}
                  onChange={(e) => setChannelsCfg({ ...channelsCfg, telegram_bot_token: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Telegram Chat / Channel ID (-100...)"
                  value={channelsCfg.telegram_chat_id}
                  onChange={(e) => setChannelsCfg({ ...channelsCfg, telegram_chat_id: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="p-4 rounded-lg bg-[#F8FAFC] dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-[#172033] dark:text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(channelsCfg.webhook_enabled)}
                    onChange={(e) => setChannelsCfg({ ...channelsCfg, webhook_enabled: e.target.checked ? 1 : 0 })}
                    className="w-4 h-4 accent-[#087CEB]"
                  />
                  Enable HTTPS Webhook Alerts
                </label>
                <input
                  type="url"
                  placeholder="https://hooks.example.com/sevensunday"
                  value={channelsCfg.whatsapp_webhook_url}
                  onChange={(e) => setChannelsCfg({ ...channelsCfg, whatsapp_webhook_url: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
                <p className="text-[11px] text-slate-500">
                  Sends signed JSON alert payloads to Slack, Microsoft Teams, or WhatsApp Gateway bridges.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                Trigger External Channels For Events:
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  'APPROVAL_REQUEST',
                  'LOW_STOCK',
                  'LEAVE_STATUS',
                  'PAYROLL_RUN',
                  'ATTENDANCE_ALERT',
                  'SECURITY_LOCKOUT',
                  'EMPLOYEE_CREATED',
                ].map((ev) => {
                  let selected: string[] = [];
                  try {
                    selected = JSON.parse(channelsCfg.notify_on_events_json || '[]');
                  } catch {
                    selected = [];
                  }
                  const checked = selected.includes(ev);
                  return (
                    <label
                      key={ev}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked ? selected.filter((x) => x !== ev) : [...selected, ev];
                          setChannelsCfg({ ...channelsCfg, notify_on_events_json: JSON.stringify(next) });
                        }}
                        className="accent-[#087CEB]"
                      />
                      {ev}
                    </label>
                  );
                })}
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
