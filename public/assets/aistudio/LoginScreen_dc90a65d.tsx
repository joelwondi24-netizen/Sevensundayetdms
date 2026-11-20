import React, { useState } from 'react';
import { Lock, LogIn, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import type { CompanySettings, UserAccount } from '../types';

interface LoginScreenProps {
  company: CompanySettings | null;
  onLogin: (user: UserAccount) => void;
}

const QUICK_ACCOUNTS = [
  { label: 'Super Admin', email: 'admin@sevensunday.et', role: 'Super Administrator' },
  { label: 'HR & Secretary', email: 'secretary@sevensunday.et', role: 'Human Resource Manager' },
  { label: 'Finance CFO', email: 'finance@sevensunday.et', role: 'Finance Manager' },
  { label: 'Inventory Lead', email: 'inventory@sevensunday.et', role: 'Inventory Manager' },
  { label: 'Employee (Restricted)', email: 'viewer@sevensunday.et', role: 'Employee' },
];

export const LoginScreen: React.FC<LoginScreenProps> = ({ company, onLogin }) => {
  const [email, setEmail] = useState('admin@sevensunday.et');
  const [password, setPassword] = useState('SevenSunday@2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performLogin = async (loginEmail: string, loginPass: string) => {
    setLoading(true);
    setError(null);
    try {
      const user = await api.post<UserAccount>('/api/auth/login', {
        email: loginEmail,
        password: loginPass,
      });
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(email, password);
  };

  const logoSrc =
    company?.logo_data && company.logo_data.startsWith('data:')
      ? company.logo_data
      : '/assets/aistudio/Seven_Sunday_Logo_2_desktop_addf2fa7.png';

  return (
    <div className="min-h-screen bg-[#18243A] dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-[#FFFFFF] dark:bg-slate-900 border-t-4 border-t-[#087CEB] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col items-center text-center mb-6">
          <img
            src={logoSrc}
            alt="Seven Sunday Ethiopia"
            className="h-14 w-auto object-contain mb-3 bg-[#FFFFFF] rounded-lg px-2 py-1"
          />
          <h1 className="font-display text-xl font-bold text-[#172033] dark:text-white">
            {company?.company_name || 'Seven Sunday Manufacturing & Trading PLC'}
          </h1>
          <p className="text-xs font-semibold text-[#087CEB] mt-1">
            {company?.slogan || 'The Home of quality product'} · {company?.secondary_slogan || 'Together for a Stronger and Better Tomorrow'}
          </p>
        </div>

        {error && (
          <div className="mb-4 px-3.5 py-2.5 text-xs font-medium text-red-700 bg-red-50 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
              Corporate Email
            </label>
            <input
              type="email"
              required
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
            {loading ? 'Signing In...' : 'Sign In to Unified Platform'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#18243A] dark:text-slate-400 mb-2.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#087CEB]" />
            <span>Quick Role Sign-In (RBAC Test Accounts)</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => {
                  setEmail(acc.email);
                  setPassword('SevenSunday@2026');
                  performLogin(acc.email, 'SevenSunday@2026');
                }}
                className="text-left px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#EAF4FF] dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg transition-colors"
              >
                <div className="font-semibold text-[#172033] dark:text-slate-100 truncate">{acc.label}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{acc.role}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
