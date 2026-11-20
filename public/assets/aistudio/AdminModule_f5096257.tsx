import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Cpu,
  Database,
  Download,
  GitBranch,
  ImagePlus,
  Mail,
  Plus,
  Save,
  Send,
  Shield,
  Trash2,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { api } from '../api';
import type {
  AuditLogRecord,
  CompanySettings,
  DeviceRecord,
  ModuleKey,
  UserAccount,
  UserRole,
} from '../types';

const ALL_ROLES: UserRole[] = [
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
  'Security Supervisor',
  'Employee',
  'Auditor',
  'Viewer',
];

const ALL_MATRIX_MODULES: Array<{ key: ModuleKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'approvals', label: 'Approvals' },
  { key: 'admin', label: 'Admin' },
  { key: 'hr', label: 'HR & ID' },
  { key: 'devices', label: 'Devices' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'leave', label: 'Leave' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'secretary', label: 'Secretary' },
  { key: 'company-forms', label: 'Forms' },
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
  'Super Administrator': ALL_MATRIX_MODULES.map((m) => m.key),
  'Company Owner': ALL_MATRIX_MODULES.map((m) => m.key),
  'General Manager': ALL_MATRIX_MODULES.map((m) => m.key),
  'Department Manager': [
    'dashboard',
    'approvals',
    'hr',
    'attendance',
    'leave',
    'secretary',
    'company-forms',
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
    'leave',
    'payroll',
    'secretary',
    'company-forms',
    'assets',
    'reports',
    'chat',
    'sync',
  ],
  'Finance Manager': [
    'dashboard',
    'approvals',
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
  Accountant: ['dashboard', 'payroll', 'company-forms', 'finance', 'sales-crm', 'reports', 'chat', 'sync'],
  'Inventory Manager': [
    'dashboard',
    'approvals',
    'company-forms',
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
  'Security Supervisor': ['dashboard', 'company-forms', 'devices', 'attendance', 'vehicles', 'assets', 'chat', 'sync'],
  Auditor: ['dashboard', 'company-forms', 'gin', 'finance', 'payroll', 'reports', 'audit', 'approvals', 'chat', 'sync'],
  Employee: ['dashboard', 'attendance', 'leave', 'company-forms', 'material-requests', 'chat', 'sync'],
  Viewer: ['dashboard', 'chat', 'sync'],
};

type AdminTab = 'branding' | 'branches' | 'users' | 'rbac' | 'logins' | 'smtp';

interface AdminModuleProps {
  settings: CompanySettings | null;
  onSettingsUpdated: (s: CompanySettings) => void;
  onRefreshDashboard: () => void;
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
}) => {
  const [tab, setTab] = useState<AdminTab>('branding');
  const [form, setForm] = useState<CompanySettings>(
    settings || {
      id: 1,
      company_name: 'Seven Sunday Manufacturing & Trading PLC',
      brand_name: 'Seven Sunday Ethiopia',
      slogan: 'The Home of quality product',
      secondary_slogan: 'Together for a Stronger and Better Tomorrow',
      address: 'Bole Sub-City, Addis Ababa, Ethiopia',
      phone: '+251 11 000 0000',
      email: 'info@sevensunday.et',
      website: 'https://sevensunday.et',
      tin_number: '',
      default_currency: 'ETB',
      calendar_mode: 'Gregorian',
      default_language: 'en',
      branches: 'Addis Ababa HQ, Adama Factory, Hawassa Depot',
      departments: 'Operations, HR, Secretary, Finance, Inventory, Procurement, Sales & CRM',
      logo_data: '',
      stamp_data: '',
      signature_data: '',
      smtp_host: 'smtp.sevensunday.et',
      smtp_port: 587,
      smtp_user: 'noreply@sevensunday.et',
      smtp_pass: '',
      smtp_from: 'Seven Sunday EMS <noreply@sevensunday.et>',
      smtp_secure: 0,
      rbac_matrix: '{}',
      updated_at: '',
    }
  );

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [newBranch, setNewBranch] = useState('');
  const [newDept, setNewDept] = useState('');
  const [userForm, setUserForm] = useState({
    full_name: '',
    email: '',
    password: 'SevenSunday@2026',
    department: 'Operations',
    job_title: 'Staff',
    role: 'Employee' as UserRole,
  });
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpResult, setSmtpResult] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const loadAdminData = async () => {
    try {
      const [uData, dData, aData] = await Promise.all([
        api.get<UserAccount[]>('/api/users'),
        api.get<DeviceRecord[]>('/api/devices'),
        api.get<AuditLogRecord[]>('/api/audit-logs'),
      ]);
      setUsers(uData);
      setDevices(dData);
      setAuditLogs(aData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load administration records');
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

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
      onSettingsUpdated(updated);
      setNotice(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save company settings');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistCompanySettings(form, 'Company registration, branding, stamp & signature saved across all modules.');
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
    if (role === 'Super Administrator') return;
    const current = rbacMatrix[role] || [];
    const next = current.includes(mod) ? current.filter((m) => m !== mod) : [...current, mod];
    const updatedMatrix = { ...rbacMatrix, [role]: next };
    setForm((prev) => ({ ...prev, rbac_matrix: JSON.stringify(updatedMatrix) }));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const created = await api.post<UserAccount>('/api/users', userForm);
      setUsers((prev) => [...prev, created]);
      setUserForm({
        full_name: '',
        email: '',
        password: 'SevenSunday@2026',
        department: departmentsList[0] || 'Operations',
        job_title: 'Staff',
        role: 'Employee',
      });
      setNotice(`Created account for ${created.full_name} (${created.role}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
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

  const handleClearDemoData = async () => {
    setError(null);
    setNotice(null);
    try {
      await api.post('/api/admin/clear-demo');
      setNotice('Sample operational records cleared safely. Users, Chart of Accounts, and Company Settings preserved.');
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear demo records');
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

  const tabs: Array<{ key: AdminTab; label: string; icon: React.ReactNode }> = [
    { key: 'branding', label: 'Company & Branding', icon: <Building2 className="w-3.5 h-3.5" /> },
    { key: 'branches', label: 'Branches & Depts', icon: <GitBranch className="w-3.5 h-3.5" /> },
    { key: 'users', label: 'User Accounts', icon: <Users className="w-3.5 h-3.5" /> },
    { key: 'rbac', label: 'RBAC Roles', icon: <Shield className="w-3.5 h-3.5" /> },
    { key: 'logins', label: 'Logins & Devices', icon: <Cpu className="w-3.5 h-3.5" /> },
    { key: 'smtp', label: 'Demo Data & SMTP', icon: <Database className="w-3.5 h-3.5" /> },
  ];

  const loginAudits = auditLogs.filter((l) => l.action === 'LOGIN' || l.module === 'Authentication');

  return (
    <div className="space-y-6">
      {/* Header Banner + 6 Admin Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#172033] dark:text-white">
              Company Administration & Governance
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure verified company registration, official logo/stamp/signature, departments, RBAC roles, SMTP, and sample data.
            </p>
          </div>
          <div className="flex items-center gap-2">
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

      {/* TAB 1: COMPANY & BRANDING */}
      {tab === 'branding' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-[#172033] dark:text-white">
                Official Company Logo, Stamp & Authorized Signature
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Uploaded assets render automatically on A4 Secretary letters, Staff ID cards, Payslips, Vouchers, and Corporate Reports.
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
                  onChange={(e) => setForm({ ...form, default_currency: e.target.value })}
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
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">System Language</label>
                <select
                  value={form.default_language}
                  onChange={(e) => setForm({ ...form, default_language: e.target.value as CompanySettings['default_language'] })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="en">English</option>
                  <option value="am">አማርኛ (Amharic)</option>
                  <option value="om">Afaan Oromoo</option>
                  <option value="zh">中文 (Chinese)</option>
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
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#087CEB]" />
            <h3 className="text-base font-bold text-[#172033] dark:text-white">
              Enterprise User Accounts ({users.length})
            </h3>
          </div>

          <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
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
              placeholder="Email Address"
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
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
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-[#172033] dark:text-white">{u.full_name}</div>
                      <div className="text-xs font-mono text-slate-500">{u.email} · {u.employee_code}</div>
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
                      <span className={u.status === 'Active' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
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
                ))}
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
                15-Role Access Control (RBAC) Matrix
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Toggle module access per enterprise role and save to enforce permissions platform-wide.
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
                  <th className="py-2.5 px-3 sticky left-0 bg-[#18243A] z-10 min-w-[170px]">Role</th>
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
                  return (
                    <tr key={role} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 font-semibold text-[#172033] dark:text-white sticky left-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                        {role}
                      </td>
                      {ALL_MATRIX_MODULES.map((m) => {
                        const checked = allowed.includes(m.key);
                        return (
                          <td key={`${role}-${m.key}`} className="py-2 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={role === 'Super Administrator'}
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
        </div>
      )}

      {/* TAB 5: LOGINS & DEVICES */}
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
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-[#172033] dark:text-white">{u.full_name}</div>
                        <div className="text-[11px] text-slate-500">{u.email} · {u.role}</div>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never signed in'}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-emerald-700 dark:text-emerald-400">
                        {u.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#172033] dark:text-white">Connected Biometric & Network Devices</h3>
              <span className="text-xs font-mono text-slate-500">{devices.length} endpoints</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 font-semibold text-slate-600 dark:text-slate-300">
                    <th className="py-2.5 px-4">Device</th>
                    <th className="py-2.5 px-4">IP : Port / SN</th>
                    <th className="py-2.5 px-4">Status</th>
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
                        <div>{d.ip_address}:{d.port}</div>
                        <div className="text-[11px] text-slate-400">{d.serial_number}</div>
                      </td>
                      <td className="py-2.5 px-4 font-semibold">
                        <span className={d.status === 'Connected' ? 'text-emerald-700' : 'text-amber-700'}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: DEMO DATA & SMTP */}
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
            <h3 className="text-base font-bold text-[#172033] dark:text-white">Database Backup & Demo Data Controls</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Download a full SQLite JSON snapshot before clearing sample records for live production onboarding.
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
                onClick={handleClearDemoData}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4" />
                Remove Demo Operational Records
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
