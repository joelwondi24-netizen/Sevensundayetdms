import React, { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { api, getCompanyDeviceUid, getDetectedDeviceLabel } from '../api';
import { useI18n } from '../i18n/I18nProvider';
import type { CompanyDeviceSecurityStatus } from '../types';

interface CompanyDeviceGateModalProps {
  status: CompanyDeviceSecurityStatus;
  onVerified: () => Promise<void> | void;
  onRefreshStatus: () => Promise<void> | void;
}

export const CompanyDeviceGateModal: React.FC<CompanyDeviceGateModalProps> = ({
  status,
  onVerified,
  onRefreshStatus,
}) => {
  const { t, dir } = useI18n();
  const [companyCode, setCompanyCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deviceUid = status.device_uid || getCompanyDeviceUid();
  const deviceLabel = getDetectedDeviceLabel();

  const handleCopyUid = async () => {
    try {
      await navigator.clipboard.writeText(deviceUid);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard restrictions
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await onRefreshStatus();
    } finally {
      setRefreshing(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/api/security/company-devices/verify', {
        device_uid: deviceUid,
        company_code: companyCode.trim(),
        device_os: deviceLabel,
      });
      setCompanyCode('');
      await onVerified();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Verification failed. Ensure this device is registered by Admin/Super Admin and the Company Code is correct.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-[100] bg-[#18243A]/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="company-device-gate-title"
    >
      <div className="w-[92vw] sm:w-[60vw] max-w-2xl min-h-[35vh] bg-white dark:bg-slate-900 border-2 border-[#087CEB] rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col justify-between gap-5">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#18243A] text-white flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-[#38BDF8]" />
              </div>
              <div>
                <h2
                  id="company-device-gate-title"
                  className="text-base sm:text-lg font-extrabold text-[#172033] dark:text-white"
                >
                  {t('gate.title', 'Company Device Registration & Security Code Required')}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  {t('gate.warning')}
                </p>
              </div>
            </div>
          </div>

          {/* Device Registration Status Box */}
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {t('gate.deviceId')} ({deviceLabel})
                </div>
                <div className="text-sm font-mono font-bold text-[#172033] dark:text-white select-all">
                  {deviceUid}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyUid}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[#18243A] dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 hover:border-[#087CEB] rounded-lg"
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy Device ID'}
                </button>
                <button
                  type="button"
                  disabled={refreshing}
                  onClick={handleRefresh}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#087CEB] bg-[#EAF4FF] dark:bg-sky-950/60 border border-[#087CEB]/30 rounded-lg"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  {t('common.refresh', 'Check Status')}
                </button>
              </div>
            </div>

            <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs">
              {status.device_registered ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Registered as "{status.device_name || deviceUid}". Enter the Company Code below to unlock this
                    device.
                  </span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-medium text-amber-800 dark:text-amber-300">
                    {status.device_status === 'Suspended'
                      ? t('gate.deviceSuspended')
                      : `${t('gate.requestRegistration')} — Send the Device ID above to your Admin / Super Administrator to register it in Company Administration → Company Devices & Code.`}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="px-3.5 py-2.5 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleVerifySubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-[#172033] dark:text-slate-200 mb-1">
              {t('gate.enterCode')} {status.company_code_hint ? `(Hint: ${status.company_code_hint})` : ''}
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                autoFocus
                placeholder={t('gate.enterCode')}
                value={companyCode}
                onChange={(e) => setCompanyCode(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-60 rounded-lg transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            {submitting ? t('common.loading', 'Verifying Device & Company Code...') : t('gate.verifyButton')}
          </button>
        </form>
      </div>
    </div>
  );
};
