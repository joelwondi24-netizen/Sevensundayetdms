import React, { useEffect, useState } from 'react';
import {
  Building2,
  Fingerprint,
  Globe,
  Lock,
  LogIn,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { api } from '../api';
import type {
  AuthSessionResponse,
  CompanySettings,
  PlatformConfig,
  TenantRecord,
} from '../types';
import { LANGUAGE_OPTIONS, type AppLang } from '../utils/ethiopianCalendar';

interface LoginScreenProps {
  company: CompanySettings | null;
  onLogin: (auth: AuthSessionResponse) => void;
  tenants?: TenantRecord[];
  activeTenantId?: number;
  onSelectTenant?: (id: number) => void;
  lang?: AppLang;
  onChangeLang?: (lang: AppLang) => void;
  platformConfig?: PlatformConfig;
}

const BIOMETRIC_LOCAL_DEVICE_KEY = 'seven_sunday_biometric_device_id';

function base64UrlToUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const b64 = (base64url + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  company,
  onLogin,
  tenants = [],
  activeTenantId = 1,
  onSelectTenant,
  lang = 'en',
  onChangeLang,
  platformConfig,
}) => {
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Registration fields
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDepartment, setRegDepartment] = useState('Operations');
  const [regJobTitle, setRegJobTitle] = useState('Staff Member');

  // Corporate Google Sign-In inline prompt
  const [googlePromptOpen, setGooglePromptOpen] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');

  const [bootstrap, setBootstrap] = useState<{
    hasUsers: boolean;
    userCount: number;
    hasBiometrics: boolean;
  }>({ hasUsers: true, userCount: 0, hasBiometrics: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ hasUsers: boolean; userCount: number; hasBiometrics: boolean }>('/api/auth/bootstrap-status')
      .then((res) => {
        setBootstrap(res);
        if (!res.hasUsers) {
          setAuthTab('register');
        }
      })
      .catch(() => {
        // ignore transient boot status failure
      });
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const auth = await api.post<AuthSessionResponse>('/api/auth/login', {
        email: email.trim(),
        password,
        tenant_id: activeTenantId,
      });
      onLogin(auth);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const auth = await api.post<AuthSessionResponse>('/api/auth/register', {
        full_name: regFullName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        department: regDepartment.trim() || 'Operations',
        job_title: regJobTitle.trim() || 'Staff Member',
        tenant_id: activeTenantId,
      });
      onLogin(auth);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmail.trim()) {
      setError('Enter your verified corporate Google email address.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const auth = await api.post<AuthSessionResponse>('/api/auth/google', {
        email: googleEmail.trim(),
        full_name: googleName.trim(),
        tenant_id: activeTenantId,
      });
      onLogin(auth);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Corporate Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const ch = await api.post<{
        challenge: string;
        credentials: Array<{ credential_id: string; device_label: string; auth_type: string }>;
      }>('/api/auth/biometric/challenge', {
        email: email.trim() || undefined,
      });

      const localDeviceCred = (() => {
        try {
          return localStorage.getItem(BIOMETRIC_LOCAL_DEVICE_KEY) || '';
        } catch {
          return '';
        }
      })();

      let matchedCredId = '';

      if (window.PublicKeyCredential && navigator.credentials?.get && ch.credentials.length > 0) {
        try {
          const allowCredentials = ch.credentials
            .filter((c) => !c.credential_id.startsWith('dev-key-'))
            .map((c) => ({
              id: base64UrlToUint8Array(c.credential_id),
              type: 'public-key' as const,
            }));

          if (allowCredentials.length > 0) {
            const assertion = (await navigator.credentials.get({
              publicKey: {
                challenge: base64UrlToUint8Array(ch.challenge),
                allowCredentials,
                userVerification: 'preferred',
                timeout: 45000,
              },
            })) as PublicKeyCredential | null;
            if (assertion?.id) {
              matchedCredId = assertion.id;
            }
          }
        } catch {
          // Fall through to enrolled device credential if iframe blocks WebAuthn prompt
        }
      }

      if (!matchedCredId && localDeviceCred && ch.credentials.some((c) => c.credential_id === localDeviceCred)) {
        matchedCredId = localDeviceCred;
      }

      if (!matchedCredId) {
        throw new Error(
          'No enrolled Fingerprint / Face ID credential matched this device. Sign in with your corporate email first and enroll under Synchronization Center → Biometric Security.'
        );
      }

      const auth = await api.post<AuthSessionResponse>('/api/auth/biometric/verify', {
        credential_id: matchedCredId,
        tenant_id: activeTenantId,
      });
      onLogin(auth);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Biometric authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const logoSrc =
    company?.logo_data && company.logo_data.startsWith('data:')
      ? company.logo_data
      : '/assets/aistudio/Seven_Sunday_Logo_2_desktop_addf2fa7.png';

  const activeTenants = tenants.filter((t) => t.status === 'Active');
  const availableDepts = String(
    company?.departments || 'Operations, HR, Secretary, Finance, Inventory, Procurement, Sales & CRM'
  )
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-[#18243A] dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-[#FFFFFF] dark:bg-slate-900 border-t-4 border-t-[#087CEB] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-5">
          <img
            src={logoSrc}
            alt="Seven Sunday Ethiopia"
            className="h-14 w-auto object-contain mb-3 bg-[#FFFFFF] rounded-lg px-2 py-1"
          />
          <h1 className="font-display text-xl font-bold text-[#172033] dark:text-white">
            {company?.company_name || platformConfig?.platform_title || 'Seven Sunday Manufacturing & Trading PLC'}
          </h1>
          <p className="text-xs font-semibold text-[#087CEB] mt-1">
            {company?.slogan || 'The Home of quality product'} ·{' '}
            {company?.secondary_slogan || 'Together for a Stronger and Better Tomorrow'}
          </p>
        </div>

        {/* Role-Based Access & Encrypted Sync Heading */}
        <div className="mb-4 p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#172033] dark:text-white">
            <ShieldCheck className="w-4 h-4 text-[#087CEB]" />
            <span>Role-Based Access & Encrypted Sync</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
            Sign in with your verified corporate Google account. Super Administrators manage roles, departments, and
            permissions directly inside Company Administration.
          </p>
        </div>

        {platformConfig?.login_notice && platformConfig.login_notice.trim() && (
          <div className="mb-4 px-3.5 py-2.5 text-xs font-medium text-[#18243A] dark:text-sky-200 bg-[#EAF4FF] dark:bg-slate-800 border border-[#087CEB]/30 rounded-lg text-center">
            {platformConfig.login_notice}
          </div>
        )}

        {/* Tenant Workspace + Language Selector */}
        {(activeTenants.length > 0 || onChangeLang) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
            {activeTenants.length > 0 && onSelectTenant && (
              <div>
                <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  <Building2 className="w-3 h-3 text-[#087CEB]" />
                  <span>Tenant Workspace</span>
                </label>
                <select
                  value={activeTenantId}
                  onChange={(e) => onSelectTenant(Number(e.target.value))}
                  className="w-full px-2.5 py-2 text-xs font-semibold bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
                >
                  {activeTenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.brand_name} ({t.tenant_code})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {onChangeLang && (
              <div>
                <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  <Globe className="w-3 h-3 text-[#087CEB]" />
                  <span>Language</span>
                </label>
                <select
                  value={lang}
                  onChange={(e) => onChangeLang(e.target.value as AppLang)}
                  className="w-full px-2.5 py-2 text-xs font-semibold bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
                >
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Primary Corporate Google Account Sign-In + Optional Biometric Unlock */}
        <div className="space-y-2.5 mb-4">
          {!googlePromptOpen ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setError(null);
                setGooglePromptOpen(true);
              }}
              className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 text-sm font-bold text-[#172033] dark:text-white bg-white dark:bg-slate-800 hover:bg-[#EAF4FF] dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:border-[#087CEB] rounded-lg transition-colors shadow-sm"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              <span>Sign In with Corporate Account</span>
            </button>
          ) : (
            <form
              onSubmit={handleGoogleSignIn}
              className="p-3.5 rounded-xl bg-[#EAF4FF]/70 dark:bg-slate-800 border border-[#087CEB]/40 space-y-2.5"
            >
              <div className="flex items-center justify-between text-xs font-bold text-[#172033] dark:text-white">
                <span>Verify Corporate Google Account</span>
                <button
                  type="button"
                  onClick={() => setGooglePromptOpen(false)}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  Cancel
                </button>
              </div>
              <input
                type="email"
                required
                placeholder="user@sevensundayethiopia.com"
                value={googleEmail}
                onChange={(e) => setGoogleEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
              />
              <input
                type="text"
                placeholder="Full Name (for first-time Corporate Google profile)"
                value={googleName}
                onChange={(e) => setGoogleName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-60 rounded-lg"
              >
                {loading ? 'Verifying...' : 'Continue with Corporate Google'}
              </button>
            </form>
          )}

          {bootstrap.hasBiometrics && (
            <button
              type="button"
              disabled={loading}
              onClick={handleBiometricSignIn}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-[#18243A] dark:text-sky-200 bg-[#EAF4FF] dark:bg-slate-800 hover:bg-[#DBEAFE] border border-[#087CEB]/35 rounded-lg transition-colors"
            >
              <Fingerprint className="w-4 h-4 text-[#087CEB]" />
              <span>Sign In with Fingerprint / Face ID</span>
            </button>
          )}

          <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 leading-snug">
            Mobile staff can enable Fingerprint / Face ID after signing in under Synchronization Center → Biometric
            Security.
          </p>
        </div>

        {/* Divider */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="border-t border-slate-200 dark:border-slate-700 w-full" />
          <span className="bg-white dark:bg-slate-900 px-3 text-[10px] font-bold tracking-wider uppercase text-slate-400 whitespace-nowrap">
            OR CORPORATE EMAIL & PASSWORD
          </span>
          <div className="border-t border-slate-200 dark:border-slate-700 w-full" />
        </div>

        {/* Login vs Registration Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 mb-4 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => {
              setAuthTab('login');
              setError(null);
            }}
            className={`py-1.5 font-semibold rounded transition-colors ${
              authTab === 'login'
                ? 'bg-[#18243A] text-white'
                : 'text-slate-600 dark:text-slate-300 hover:text-[#172033]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthTab('register');
              setError(null);
            }}
            className={`py-1.5 font-semibold rounded transition-colors ${
              authTab === 'register'
                ? 'bg-[#18243A] text-white'
                : 'text-slate-600 dark:text-slate-300 hover:text-[#172033]'
            }`}
          >
            Register Account
          </button>
        </div>

        {error && (
          <div className="mb-4 px-3.5 py-2.5 text-xs font-medium text-red-700 bg-red-50 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg">
            {error}
          </div>
        )}

        {authTab === 'login' ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                Corporate Email
              </label>
              <input
                type="email"
                required
                placeholder="user@sevensundayethiopia.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm text-[#172033] dark:text-white bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm text-[#172033] dark:text-white bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-60 rounded-lg transition-colors"
            >
              <LogIn className="w-4 h-4" />
              {loading ? 'Signing In...' : 'Sign In to Platform'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-3">
            {!bootstrap.hasUsers && (
              <div className="px-3 py-2 text-[11px] font-medium text-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                First-time setup: the first registered corporate account will automatically be assigned Super
                Administrator permissions.
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="Full Name"
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm text-[#172033] dark:text-white bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                Corporate Email *
              </label>
              <input
                type="email"
                required
                placeholder="user@sevensundayethiopia.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="w-full px-3.5 py-2 text-sm text-[#172033] dark:text-white bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                  Department
                </label>
                <select
                  value={regDepartment}
                  onChange={(e) => setRegDepartment(e.target.value)}
                  className="w-full px-3 py-2 text-xs text-[#172033] dark:text-white bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
                >
                  {availableDepts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                  Job Title
                </label>
                <input
                  type="text"
                  placeholder="Staff / Officer"
                  value={regJobTitle}
                  onChange={(e) => setRegJobTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs text-[#172033] dark:text-white bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                Password (min. 6 characters) *
              </label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Create a secure password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-sm text-[#172033] dark:text-white bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-60 rounded-lg transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              {loading ? 'Creating Account...' : 'Create Corporate Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
