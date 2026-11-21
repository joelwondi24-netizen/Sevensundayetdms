import type { ModuleKey, PlatformConfig } from '../types';

export const DEFAULT_APPROVING_DEPARTMENTS = [
  'General Manager',
  'Human Resources',
  'Finance & Accounting',
  'Procurement & Purchasing',
  'Factory Production',
  'Quality Assurance',
  'Warehouse & Inventory',
  'Security & Gate',
  'Sales & CRM',
  'Internal Audit',
];

export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  platform_title: 'Seven Sunday Ethiopia ETMS',
  primary_color: '#087CEB',
  secondary_color: '#18243A',
  accent_color: '#38BDF8',
  login_notice: '',
  standard_monthly_hours: 208,
  enable_multi_language: true,
  enable_multi_tenant: true,
  enable_gate_pass_qr: true,
  disabled_modules: [],
  custom_module_labels: {},
  custom_module_titles: {},
  custom_approving_departments: DEFAULT_APPROVING_DEPARTMENTS,
  share_channels: ['Email', 'Telegram', 'WhatsApp', 'Copy Link'],
};

export function parsePlatformConfig(raw?: string | null): PlatformConfig {
  if (!raw) return DEFAULT_PLATFORM_CONFIG;
  try {
    const parsed = JSON.parse(raw) as Partial<PlatformConfig>;
    return {
      ...DEFAULT_PLATFORM_CONFIG,
      ...parsed,
      disabled_modules: Array.isArray(parsed.disabled_modules)
        ? (parsed.disabled_modules as ModuleKey[])
        : [],
      custom_module_labels:
        parsed.custom_module_labels && typeof parsed.custom_module_labels === 'object'
          ? parsed.custom_module_labels
          : {},
      custom_module_titles:
        parsed.custom_module_titles && typeof parsed.custom_module_titles === 'object'
          ? parsed.custom_module_titles
          : {},
      custom_approving_departments:
        Array.isArray(parsed.custom_approving_departments) &&
        parsed.custom_approving_departments.length > 0
          ? parsed.custom_approving_departments
          : DEFAULT_APPROVING_DEPARTMENTS,
      share_channels:
        Array.isArray(parsed.share_channels) && parsed.share_channels.length > 0
          ? parsed.share_channels
          : DEFAULT_PLATFORM_CONFIG.share_channels,
    };
  } catch {
    return DEFAULT_PLATFORM_CONFIG;
  }
}

export function getCustomApprovingDepartments(): string[] {
  try {
    const raw = (window as unknown as { __SEVEN_SUNDAY_APPROVING_DEPTS__?: string[] })
      .__SEVEN_SUNDAY_APPROVING_DEPTS__;
    if (Array.isArray(raw) && raw.length > 0) return raw;
  } catch {
    // ignore
  }
  return DEFAULT_APPROVING_DEPARTMENTS;
}

export function setCustomApprovingDepartmentsGlobal(depts: string[]) {
  try {
    (window as unknown as { __SEVEN_SUNDAY_APPROVING_DEPTS__?: string[] })
      .__SEVEN_SUNDAY_APPROVING_DEPTS__ =
      depts.length > 0 ? depts : DEFAULT_APPROVING_DEPARTMENTS;
  } catch {
    // ignore
  }
}
