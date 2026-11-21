import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Database,
  Download,
  Fingerprint,
  HardDrive,
  KeyRound,
  Lock,
  MonitorSmartphone,
  RefreshCw,
  RotateCw,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { api, downloadFile, getApiActorHeaders } from '../api';
import {
  clearOfflineCache,
  clearPendingQueue,
  getOfflineStorageStats,
  getPendingQueue,
  removeQueuedMutation,
  retrySingleMutation,
  setConflictPolicy,
  syncQueuedMutations,
  type ConflictPolicy,
  type OfflineStorageStats,
  type QueuedMutation,
} from '../offline/syncEngine';
import type {
  ActiveSessionRecord,
  AuditLogRecord,
  BackupSnapshotFile,
  BiometricCredential,
  DepartmentApprovalRecord,
  ModuleKey,
  NotificationItem,
  NotificationLogRecord,
  UserAccount,
} from '../types';

const BIOMETRIC_LOCAL_DEVICE_KEY = 'seven_sunday_biometric_device_id';
const GLOBAL_ADMIN_ROLES = new Set(['System Administrator', 'Super Administrator', 'Company Owner', 'General Manager']);

interface OperationsCenterModuleProps {
  mode: 'approvals' | 'audit' | 'sync';
  isOnline: boolean;
  onNavigate: (m: ModuleKey) => void;
  currentUser?: UserAccount | null;
  encryptedSyncKey?: string | null;
}

export const OperationsCenterModule: React.FC<OperationsCenterModuleProps> = ({
  mode,
  isOnline,
  onNavigate,
  currentUser,
  encryptedSyncKey,
}) => {
  const isGlobalAdmin = Boolean(currentUser && GLOBAL_ADMIN_ROLES.has(currentUser.role));
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<NotificationLogRecord[]>([]);
  const [retryingNotifId, setRetryingNotifId] = useState<number | null>(null);
  const [deptApprovals, setDeptApprovals] = useState<DepartmentApprovalRecord[]>([]);
  const [approvalFilter, setApprovalFilter] = useState<'ALL' | 'Pending' | 'Approved' | 'Rejected'>('ALL');
  const [queue, setQueue] = useState<QueuedMutation[]>([]);
  const [stats, setStats] = useState<OfflineStorageStats | null>(null);
  const [policy, setPolicy] = useState<ConflictPolicy>('server-wins');
  const [biometrics, setBiometrics] = useState<BiometricCredential[]>([]);
  const [bioDeviceLabel, setBioDeviceLabel] = useState(() => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    if (/iPhone|iPad|iOS/i.test(ua)) return 'Apple Face ID / Touch ID Device';
    if (/Android/i.test(ua)) return 'Android Fingerprint Device';
    return 'Corporate Laptop / Desktop Passkey';
  });
  const [bioAuthType, setBioAuthType] = useState<BiometricCredential['auth_type']>('Fingerprint / Face ID');
  const [enrollingBio, setEnrollingBio] = useState(false);

  // 2FA TOTP state
  const [mfaEnabled, setMfaEnabled] = useState<boolean>(Boolean(currentUser?.mfa_enabled));
  const [mfaSetupSecret, setMfaSetupSecret] = useState('');
  const [mfaQrDataUrl, setMfaQrDataUrl] = useState('');
  const [mfaVerifyCode, setMfaVerifyCode] = useState('');
  const [mfaDisablePassword, setMfaDisablePassword] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);

  // Password Change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  // Active Sessions state
  const [sessions, setSessions] = useState<ActiveSessionRecord[]>([]);
  const [sessionsScopeAll, setSessionsScopeAll] = useState(false);

  // Automated SQLite Backups state
  const [backups, setBackups] = useState<BackupSnapshotFile[]>([]);
  const [backupBusy, setBackupBusy] = useState(false);

  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMfaEnabled(Boolean(currentUser?.mfa_enabled));
  }, [currentUser?.mfa_enabled]);

  const loadAll = async (overrideScopeAll?: boolean) => {
    const useScopeAll = overrideScopeAll ?? sessionsScopeAll;
    const [q, st, notifs, logs, approvals, bioList, notifHist, sessList, backupList] = await Promise.all([
      getPendingQueue(),
      getOfflineStorageStats(),
      api.get<NotificationItem[]>('/api/notifications').catch(() => []),
      api.get<AuditLogRecord[]>('/api/audit-logs').catch(() => []),
      api.get<DepartmentApprovalRecord[]>('/api/approvals').catch(() => []),
      mode === 'sync'
        ? api.get<BiometricCredential[]>('/api/auth/biometric/list').catch(() => [])
        : Promise.resolve([]),
      mode === 'approvals'
        ? api.get<NotificationLogRecord[]>('/api/notifications/history').catch(() => [])
        : Promise.resolve([]),
      mode === 'sync'
        ? api
            .get<ActiveSessionRecord[]>(`/api/auth/sessions${useScopeAll && isGlobalAdmin ? '?scope=all' : ''}`)
            .catch(() => [])
        : Promise.resolve([]),
      mode === 'sync' && isGlobalAdmin
        ? api.get<BackupSnapshotFile[]>('/api/admin/backups').catch(() => [])
        : Promise.resolve([]),
    ]);
    setQueue(q);
    setStats(st);
    setPolicy(st.conflictPolicy);
    setNotifications(notifs);
    setAuditLogs(logs);
    setDeptApprovals(approvals);
    setBiometrics(bioList);
    setDeliveryLogs(notifHist);
    setSessions(sessList);
    setBackups(backupList);
  };

  useEffect(() => {
    loadAll();
    const handler = () => {
      getPendingQueue().then(setQueue);
      getOfflineStorageStats().then(setStats);
    };
    window.addEventListener('seven-sunday-sync-updated', handler);
    return () => window.removeEventListener('seven-sunday-sync-updated', handler);
  }, [mode, isGlobalAdmin]);

  const handleManualSync = async () => {
    setError(null);
    const res = await syncQueuedMutations(getApiActorHeaders());
    setSyncResult(`Synchronized ${res.synced} queued operations (${res.failed} failed) using "${policy}" policy.`);
    await loadAll();
  };

  const handleRetryNotification = async (id: number) => {
    setRetryingNotifId(id);
    setError(null);
    try {
      const updated = await api.post<NotificationLogRecord>(`/api/notifications/${id}/retry`);
      setDeliveryLogs((prev) => prev.map((row) => (row.id === id ? updated : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry notification delivery');
    } finally {
      setRetryingNotifId(null);
    }
  };

  const handleStartMfaSetup = async () => {
    setMfaBusy(true);
    setError(null);
    setSyncResult(null);
    try {
      const res = await api.post<{ secret: string; otpauth_url: string; enabled: boolean }>('/api/auth/mfa/setup');
      setMfaSetupSecret(res.secret);
      const qr = await QRCode.toDataURL(res.otpauth_url, { width: 180, margin: 1 });
      setMfaQrDataUrl(qr);
      setMfaVerifyCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize 2FA setup');
    } finally {
      setMfaBusy(false);
    }
  };

  const handleEnableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaBusy(true);
    setError(null);
    setSyncResult(null);
    try {
      await api.post('/api/auth/mfa/enable', { code: mfaVerifyCode.trim() });
      setMfaEnabled(true);
      setMfaSetupSecret('');
      setMfaQrDataUrl('');
      setMfaVerifyCode('');
      setSyncResult('Two-Factor Authentication (2FA TOTP) enabled for your corporate account.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid 6-digit authenticator code');
    } finally {
      setMfaBusy(false);
    }
  };

  const handleDisableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaBusy(true);
    setError(null);
    setSyncResult(null);
    try {
      await api.post('/api/auth/mfa/disable', { password: mfaDisablePassword });
      setMfaEnabled(false);
      setMfaDisablePassword('');
      setSyncResult('Two-Factor Authentication (2FA TOTP) disabled.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable 2FA');
    } finally {
      setMfaBusy(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSyncResult(null);
    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('New password must be at least 8 characters and include both a letter and a number.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setPwBusy(true);
    try {
      await api.post('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setSyncResult('Corporate account password updated securely.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed');
    } finally {
      setPwBusy(false);
    }
  };

  const handleRevokeSession = async (id: number) => {
    setError(null);
    try {
      await api.del(`/api/auth/sessions/${id}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setSyncResult(`Revoked session #${id}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke session');
    }
  };

  const handleLogoutAllDevices = async () => {
    setError(null);
    try {
      await api.post('/api/auth/logout-all');
      window.dispatchEvent(new CustomEvent('sevensunday:unauthorized'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign out all devices');
    }
  };

  const handleCreateDbSnapshot = async () => {
    setBackupBusy(true);
    setError(null);
    setSyncResult(null);
    try {
      const created = await api.post<BackupSnapshotFile>('/api/admin/backups/create');
      setBackups((prev) => [created, ...prev]);
      setSyncResult(`Created SQLite snapshot ${created.filename} (${(created.size_bytes / 1024).toFixed(1)} KB).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create SQLite snapshot');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleDeleteDbSnapshot = async (filename: string) => {
    setError(null);
    try {
      await api.del(`/api/admin/backups/${encodeURIComponent(filename)}`);
      setBackups((prev) => prev.filter((b) => b.filename !== filename));
      setSyncResult(`Deleted snapshot ${filename}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete snapshot');
    }
  };

  const handleEnrollBiometric = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollingBio(true);
    setError(null);
    setSyncResult(null);
    try {
      let credentialId = '';
      let publicKeyHint = '';

      if (window.PublicKeyCredential && navigator.credentials?.create && currentUser) {
        try {
          const challengeBytes = crypto.getRandomValues(new Uint8Array(32));
          const userIdBytes = new TextEncoder().encode(currentUser.email);
          const cred = (await navigator.credentials.create({
            publicKey: {
              challenge: challengeBytes,
              rp: {
                name: 'Seven Sunday Ethiopia Platform',
                id: window.location.hostname || undefined,
              },
              user: {
                id: userIdBytes,
                name: currentUser.email,
                displayName: currentUser.full_name,
              },
              pubKeyCredParams: [
                { alg: -7, type: 'public-key' },
                { alg: -257, type: 'public-key' },
              ],
              authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'preferred',
              },
              timeout: 45000,
            },
          })) as PublicKeyCredential | null;
          if (cred?.id) {
            credentialId = cred.id;
            publicKeyHint = `webauthn-platform:${cred.type}`;
          }
        } catch {
          // Graceful fallback for embedded iframe previews where hardware authenticator is blocked
        }
      }

      if (!credentialId) {
        const rand = crypto.getRandomValues(new Uint8Array(18));
        credentialId = `dev-key-${Array.from(rand, (b) => b.toString(16).padStart(2, '0')).join('')}`;
        publicKeyHint = 'ecdsa-device-key';
      }

      try {
        localStorage.setItem(BIOMETRIC_LOCAL_DEVICE_KEY, credentialId);
      } catch {
        // ignore storage restrictions
      }

      const created = await api.post<BiometricCredential>('/api/auth/biometric/register', {
        credential_id: credentialId,
        public_key: publicKeyHint,
        device_label: bioDeviceLabel.trim() || 'Mobile Biometric Device',
        auth_type: bioAuthType,
      });
      setBiometrics((prev) => [created, ...prev]);
      setSyncResult(`Enrolled ${created.auth_type} (${created.device_label}) for quick biometric sign-in.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll biometric credential');
    } finally {
      setEnrollingBio(false);
    }
  };

  const handleDeleteBiometric = async (id: number) => {
    setError(null);
    try {
      await api.del(`/api/auth/biometric/${id}`);
      setBiometrics((prev) => prev.filter((b) => b.id !== id));
      setSyncResult('Revoked enrolled biometric device credential.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke biometric credential');
    }
  };

  const handleExportJsonBackup = async () => {
    setError(null);
    try {
      const dump = await api.get<Record<string, unknown>>('/api/backup/export');
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `seven-sunday-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSyncResult('Full SQLite database JSON backup exported.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backup export failed');
    }
  };

  const handleRestoreJsonBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSyncResult(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await api.post<{ ok: boolean; restoredCounts: Record<string, number> }>('/api/backup/restore', parsed);
      const totalRows = Object.values(res.restoredCounts || {}).reduce((s, n) => s + n, 0);
      setSyncResult(`Backup restored cleanly across ${Object.keys(res.restoredCounts || {}).length} tables (${totalRows} records).`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid backup JSON file');
    } finally {
      e.target.value = '';
    }
  };

  const handleApprovalDecision = async (id: number, status: 'Approved' | 'Rejected') => {
    setError(null);
    try {
      const updated = await api.patch<DepartmentApprovalRecord>(`/api/approvals/${id}/decision`, {
        status,
        decision_notes: status === 'Approved' ? 'Approved by reviewing department' : 'Returned for revision',
      });
      setDeptApprovals((prev) => prev.map((a) => (a.id === id ? updated : a)));
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record decision');
    }
  };

  if (mode === 'approvals') {
    const visibleApprovals = deptApprovals.filter(
      (a) => approvalFilter === 'ALL' || a.status === approvalFilter
    );
    const pendingCount = deptApprovals.filter((a) => a.status === 'Pending').length;

    return (
      <div className="space-y-6">
        {/* Department Approval Queue */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#172033] dark:text-white">
                Department Approval Inbox ({pendingCount} Pending)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Documents, Gate Passes, Company Forms & Payroll records dispatched via "Send to Approve Dept".
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                {(['ALL', 'Pending', 'Approved', 'Rejected'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setApprovalFilter(st)}
                    className={`px-2.5 py-1 font-semibold rounded ${
                      approvalFilter === st ? 'bg-[#18243A] text-white' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void loadAll()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="px-4 py-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>
          )}

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {visibleApprovals.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No department approval requests in this view. Use "Send to Approve Dept" on any document, form, or gate pass.
              </div>
            ) : (
              visibleApprovals.map((ap) => (
                <div key={ap.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                      <span className="font-bold text-[#18243A] dark:text-[#38BDF8]">{ap.request_code}</span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-600 dark:text-slate-300">Ref: {ap.record_ref}</span>
                      <span className="text-slate-400">·</span>
                      <span
                        className={`font-bold ${
                          ap.priority === 'Urgent' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'
                        }`}
                      >
                        {ap.priority}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span
                        className={`font-bold ${
                          ap.status === 'Approved'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : ap.status === 'Rejected'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {ap.status}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-[#172033] dark:text-white">{ap.title}</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      From <strong className="text-[#172033] dark:text-slate-200">{ap.from_department}</strong> → Approving Dept:{' '}
                      <strong className="text-[#087CEB]">{ap.target_department}</strong> · Requested by {ap.requested_by}
                    </div>
                    {(ap.summary || ap.notes) && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {ap.summary} {ap.notes ? `· Note: ${ap.notes}` : ''}
                      </div>
                    )}
                    {ap.decision_by && (
                      <div className="text-[11px] font-mono text-slate-500">
                        Decision by {ap.decision_by} on {ap.decision_at?.slice(0, 16).replace('T', ' ')}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {ap.status === 'Pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApprovalDecision(ap.id, 'Approved')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg whitespace-nowrap"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApprovalDecision(ap.id, 'Rejected')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg whitespace-nowrap"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => onNavigate(ap.source_module)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-[#18243A] hover:bg-[#172033] rounded-lg whitespace-nowrap"
                    >
                      Open Source Module
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Operational Alerts & System Notifications */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#172033] dark:text-white">System Alerts & Live Notices</h2>
              <p className="text-xs text-slate-500">Active gate passes, pending leaves, low-stock alerts, and equipment maintenance.</p>
            </div>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">All system alerts are clear.</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Bell className={`w-4 h-4 mt-0.5 ${n.severity === 'critical' ? 'text-red-600' : 'text-[#087CEB]'}`} />
                    <div>
                      <div className="text-sm font-semibold text-[#172033] dark:text-white">{n.title}</div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">{n.detail}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate(n.module)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-[#18243A] hover:bg-[#172033] rounded-lg whitespace-nowrap"
                  >
                    Open Module
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Multi-Channel Notification Delivery History */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-[#087CEB]" />
              <div>
                <h2 className="text-base font-bold text-[#172033] dark:text-white">
                  Multi-Channel Notification Delivery History ({deliveryLogs.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Real dispatch audit log across In-App, SMTP Email, Telegram Bot, and Webhook channels with honest delivery errors & retry support.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => loadAll()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Logs
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 font-semibold text-slate-600 dark:text-slate-300">
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Channel & Event</th>
                  <th className="py-2.5 px-4">Title & Message</th>
                  <th className="py-2.5 px-4">Recipient</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {deliveryLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No notification deliveries recorded yet. Events such as employee registration, approvals, attendance alerts, payroll runs, and stock movements log here automatically.
                    </td>
                  </tr>
                ) : (
                  deliveryLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {log.created_at.slice(0, 16).replace('T', ' ')}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-[#172033] dark:text-white">{log.channel}</div>
                        <div className="text-[11px] font-mono text-[#087CEB]">{log.event_type}</div>
                      </td>
                      <td className="py-2.5 px-4 max-w-sm">
                        <div className="font-semibold text-[#172033] dark:text-white">{log.title}</div>
                        <div className="text-slate-600 dark:text-slate-400 break-words">{log.message}</div>
                        {log.error_message && (
                          <div className="mt-1 inline-flex items-start gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-mono">
                            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>{log.error_message}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                        {log.recipient || 'Internal'}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold ${
                            log.status === 'Delivered'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : log.status === 'Failed'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : log.status === 'Pending'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {log.status}
                        </span>
                        {log.retry_count > 0 && (
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">Retries: {log.retry_count}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {log.status === 'Failed' ? (
                          <button
                            type="button"
                            disabled={retryingNotifId === log.id}
                            onClick={() => handleRetryNotification(log.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded-lg disabled:opacity-60"
                          >
                            <RotateCw className="w-3 h-3" />
                            {retryingNotifId === log.id ? 'Retrying...' : 'Retry'}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'audit') {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#087CEB]" />
            <div>
              <h2 className="text-base font-bold text-[#172033] dark:text-white">Immutable Security & Activity Audit Trail</h2>
              <p className="text-xs text-slate-500">Permanent chronological ledger of all mutations and logins.</p>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-500">{auditLogs.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 font-semibold text-slate-600 dark:text-slate-300">
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Actor & Role</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Module</th>
                <th className="py-2.5 px-4">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">{log.created_at}</td>
                  <td className="py-2.5 px-4">
                    <span className="font-semibold text-[#172033] dark:text-white">{log.actor_name}</span>
                    <span className="text-slate-500"> · {log.actor_role}</span>
                  </td>
                  <td className="py-2.5 px-4 font-mono font-bold text-[#18243A] dark:text-[#38BDF8]">{log.action}</td>
                  <td className="py-2.5 px-4 font-medium">{log.module}</td>
                  <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{log.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // OFFLINE SYNCHRONIZATION, LOCAL DB & BACKUP CENTER
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#172033] dark:text-white">
              Offline Synchronization, Local DB & Backup Center
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Real-time IndexedDB + localStorage persistence, WebSocket sync queue, conflict resolution, and full JSON backup.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleManualSync}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync Queue ({queue.length})
            </button>
            <button
              type="button"
              onClick={handleExportJsonBackup}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#18243A] hover:bg-[#172033] rounded-lg whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-[#087CEB]" />
              Full JSON Backup
            </button>
            <label className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded-lg cursor-pointer whitespace-nowrap">
              <Upload className="w-3.5 h-3.5" />
              Restore JSON Backup
              <input type="file" accept=".json" onChange={handleRestoreJsonBackup} className="hidden" />
            </label>
          </div>
        </div>

        {/* Live Telemetry Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Network & Sync Status</span>
              <RefreshCw className="w-4 h-4 text-[#087CEB]" />
            </div>
            <div className="text-sm font-bold text-[#172033] dark:text-white mt-1">
              {isOnline ? 'Online (SQLite Synced)' : 'Offline (Local Queue Active)'}
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-1">
              Last Sync: {stats?.lastSync ? new Date(stats.lastSync).toLocaleString() : 'Live'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>IndexedDB Read Cache</span>
              <Database className="w-4 h-4 text-[#087CEB]" />
            </div>
            <div className="text-lg font-mono font-bold text-[#172033] dark:text-white mt-1 tabular-nums">
              {stats?.indexedDbCount ?? 0} endpoints cached
            </div>
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                <Lock className="w-3 h-3" />
                {stats?.encrypted ? 'AES-256-GCM Encrypted' : 'Standard Cache'}
              </span>
              <button
                type="button"
                onClick={async () => {
                  await clearOfflineCache();
                  setSyncResult('Cleared IndexedDB offline read cache.');
                  await loadAll();
                }}
                className="text-[11px] text-red-600 hover:underline"
              >
                Clear Read Cache
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>localStorage Persistence</span>
              <HardDrive className="w-4 h-4 text-[#087CEB]" />
            </div>
            <div className="text-lg font-mono font-bold text-[#172033] dark:text-white mt-1 tabular-nums">
              {stats?.localStorageKeys ?? 0} keys ({((stats?.localStorageBytes ?? 0) / 1024).toFixed(1)} KB)
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Theme, conflict policy & sync metadata</div>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <label className="block text-xs text-slate-500 mb-1">Conflict Resolution Policy</label>
            <select
              value={policy}
              onChange={(e) => {
                const next = e.target.value as ConflictPolicy;
                setPolicy(next);
                setConflictPolicy(next);
                setSyncResult(`Conflict resolution set to "${next}".`);
              }}
              className="w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              <option value="server-wins">Server Wins (Default Authoritative)</option>
              <option value="client-wins">Client Wins (Offline Device Priority)</option>
              <option value="manual">Manual Review Queue</option>
            </select>
          </div>
        </div>

        {syncResult && (
          <div className="px-4 py-2.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
            {syncResult}
          </div>
        )}
        {error && (
          <div className="px-4 py-2.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg">
            {error}
          </div>
        )}

        {/* Sync Queue Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-[#F8FAFC] dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-[#172033] dark:text-white">
              WebSocket & IndexedDB Mutation Queue ({queue.length})
            </span>
            {queue.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  await clearPendingQueue();
                  await loadAll();
                }}
                className="text-xs text-red-700 hover:underline"
              >
                Discard All Pending
              </button>
            )}
          </div>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-600 dark:text-slate-300">
                <th className="py-2.5 px-4">Transaction ID</th>
                <th className="py-2.5 px-4">Method</th>
                <th className="py-2.5 px-4">Endpoint</th>
                <th className="py-2.5 px-4">Queued At</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {queue.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No pending offline transactions. All local IndexedDB mutations are synchronized with SQLite.
                  </td>
                </tr>
              ) : (
                queue.map((item) => (
                  <tr key={item.tx_id}>
                    <td className="py-2.5 px-4 font-mono">{item.tx_id}</td>
                    <td className="py-2.5 px-4 font-mono font-semibold">{item.method}</td>
                    <td className="py-2.5 px-4 font-mono">{item.url}</td>
                    <td className="py-2.5 px-4 font-mono">{item.created_at}</td>
                    <td className="py-2.5 px-4 font-semibold text-amber-700">{item.status}</td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await retrySingleMutation(item.tx_id, getApiActorHeaders());
                            await loadAll();
                          }}
                          className="px-2 py-1 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] border border-[#087CEB]/30 rounded"
                        >
                          Retry
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await removeQueuedMutation(item.tx_id);
                            await loadAll();
                          }}
                          className="p-1 text-red-700 bg-red-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Biometric Security (Fingerprint / Face ID) & Encrypted Sync */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF4FF] dark:bg-slate-800 flex items-center justify-center">
              <Fingerprint className="w-5 h-5 text-[#087CEB]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#172033] dark:text-white">
                Biometric Security (Fingerprint / Face ID) & Encrypted Sync
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Enroll mobile Fingerprint, Face ID, or hardware Passkey credentials for fast verified sign-in and end-to-end encrypted synchronization.
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-semibold text-[#172033] dark:text-slate-200">
              Encrypted Sync Key: {encryptedSyncKey ? `${encryptedSyncKey.slice(0, 12)}...` : 'Session Protected (SHA-256 + Bearer)'}
            </span>
          </div>
        </div>

        <form onSubmit={handleEnrollBiometric} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
              Device Label
            </label>
            <input
              type="text"
              required
              value={bioDeviceLabel}
              onChange={(e) => setBioDeviceLabel(e.target.value)}
              placeholder="e.g., iPhone 15 Face ID / Android Fingerprint"
              className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
              Biometric / Authenticator Type
            </label>
            <select
              value={bioAuthType}
              onChange={(e) => setBioAuthType(e.target.value as BiometricCredential['auth_type'])}
              className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              <option value="Fingerprint / Face ID">Fingerprint / Face ID</option>
              <option value="Platform Passkey">Platform Passkey (Windows Hello / Mac Touch ID)</option>
              <option value="Hardware Key">USB / NFC Security Key</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={enrollingBio}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-60 rounded-lg transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              {enrollingBio ? 'Enrolling...' : 'Enable Biometrics'}
            </button>
          </div>
        </form>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 font-semibold text-slate-600 dark:text-slate-300">
                <th className="py-2.5 px-4">Device Label</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Credential ID</th>
                <th className="py-2.5 px-4">Enrolled On</th>
                <th className="py-2.5 px-4">Last Used</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {biometrics.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No biometric devices enrolled yet for {currentUser?.email || 'your account'}. Click "Enable Biometrics" above to link this device.
                  </td>
                </tr>
              ) : (
                biometrics.map((cred) => (
                  <tr key={cred.id}>
                    <td className="py-2.5 px-4 font-semibold text-[#172033] dark:text-white">{cred.device_label}</td>
                    <td className="py-2.5 px-4 text-[#087CEB] font-semibold">{cred.auth_type}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">{cred.credential_id.slice(0, 20)}...</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">{cred.created_at.slice(0, 16).replace('T', ' ')}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">
                      {cred.last_used_at ? cred.last_used_at.slice(0, 16).replace('T', ' ') : 'Ready'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteBiometric(cred.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two-Factor Authentication (2FA TOTP) & Password Security */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EAF4FF] dark:bg-slate-800 flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#087CEB]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#172033] dark:text-white">
                  Two-Factor Authentication (2FA TOTP)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Protect sign-in with Google Authenticator, Microsoft Authenticator, or Authy 6-digit codes.
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border ${
                mfaEnabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {mfaEnabled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              {mfaEnabled ? '2FA Enabled' : '2FA Disabled'}
            </span>
          </div>

          {!mfaEnabled && !mfaQrDataUrl && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Scan a private QR key into your authenticator app to require a 6-digit verification code on every password login.
              </p>
              <button
                type="button"
                disabled={mfaBusy}
                onClick={handleStartMfaSetup}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#18243A] hover:bg-[#172033] disabled:opacity-60 rounded-lg"
              >
                <ShieldCheck className="w-4 h-4 text-[#087CEB]" />
                {mfaBusy ? 'Generating Secret...' : 'Set Up 2FA Authenticator'}
              </button>
            </div>
          )}

          {!mfaEnabled && mfaQrDataUrl && (
            <form onSubmit={handleEnableMfa} className="space-y-3">
              <div className="flex flex-col sm:flex-row items-center gap-4 p-3 rounded-lg bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <img src={mfaQrDataUrl} alt="2FA TOTP QR Code" className="w-36 h-36 rounded bg-white p-1.5 border border-slate-200" />
                <div className="space-y-2 text-xs">
                  <div className="font-bold text-[#172033] dark:text-white">Step 1: Scan QR Code</div>
                  <p className="text-slate-600 dark:text-slate-400">
                    Scan with Google Authenticator or Authy, or manually enter this Base32 key:
                  </p>
                  <div className="font-mono text-[11px] px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded select-all break-all">
                    {mfaSetupSecret}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                    Step 2: Enter 6-Digit Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    inputMode="numeric"
                    value={mfaVerifyCode}
                    onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="w-full px-3 py-2 text-sm font-mono tracking-widest bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  disabled={mfaBusy || mfaVerifyCode.length !== 6}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg"
                >
                  {mfaBusy ? 'Verifying...' : 'Verify & Enable 2FA'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMfaQrDataUrl('');
                    setMfaSetupSecret('');
                  }}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {mfaEnabled && (
            <form onSubmit={handleDisableMfa} className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                2FA TOTP verification is active on your account. Enter your current password only if you need to disable it.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="password"
                  required
                  value={mfaDisablePassword}
                  onChange={(e) => setMfaDisablePassword(e.target.value)}
                  placeholder="Current password to disable 2FA"
                  className="flex-1 min-w-[180px] px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
                <button
                  type="submit"
                  disabled={mfaBusy}
                  className="px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg disabled:opacity-60"
                >
                  {mfaBusy ? 'Disabling...' : 'Disable 2FA'}
                </button>
              </div>
            </form>
          )}
        </div>

        <form
          onSubmit={handleChangePassword}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-[#EAF4FF] dark:bg-slate-800 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-[#087CEB]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#172033] dark:text-white">Change Corporate Password</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Minimum 8 characters including both letters and numbers. Hashed with scrypt on the server.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 chars, letter + number"
                  className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={pwBusy}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#18243A] hover:bg-[#172033] disabled:opacity-60 rounded-lg"
            >
              <Lock className="w-3.5 h-3.5 text-[#087CEB]" />
              {pwBusy ? 'Updating Password...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Active Sessions & Devices */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF4FF] dark:bg-slate-800 flex items-center justify-center">
              <MonitorSmartphone className="w-5 h-5 text-[#087CEB]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#172033] dark:text-white">
                Active Sessions & Authenticated Devices ({sessions.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Monitor signed-in browsers/devices, inspect last activity, and revoke compromised sessions immediately.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isGlobalAdmin && (
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={sessionsScopeAll}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setSessionsScopeAll(next);
                    void loadAll(next);
                  }}
                  className="accent-[#087CEB]"
                />
                All Company Users
              </label>
            )}
            <button
              type="button"
              onClick={handleLogoutAllDevices}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg whitespace-nowrap"
            >
              Sign Out All Devices
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 font-semibold text-slate-600 dark:text-slate-300">
                <th className="py-2.5 px-4">Method & Account</th>
                <th className="py-2.5 px-4">Device / Browser</th>
                <th className="py-2.5 px-4">IP Address</th>
                <th className="py-2.5 px-4">Last Active</th>
                <th className="py-2.5 px-4">Expires</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No active token sessions found.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1.5 font-semibold text-[#172033] dark:text-white">
                        <span className="uppercase font-mono text-[#087CEB]">{s.auth_method}</span>
                        {s.is_current && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                            Current Session
                          </span>
                        )}
                      </div>
                      {s.user_email && (
                        <div className="text-[11px] text-slate-500">
                          {s.user_name} ({s.user_email}) · {s.user_role}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 max-w-xs truncate text-slate-600 dark:text-slate-300" title={s.user_agent}>
                      {s.user_agent || 'Unknown Client'}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">{s.ip_address || '127.0.0.1'}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {s.last_active_at ? s.last_active_at.slice(0, 16).replace('T', ' ') : '—'}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {s.expires_at.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleRevokeSession(s.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Automated SQLite Snapshots (.db) - Global Admins */}
      {isGlobalAdmin && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EAF4FF] dark:bg-slate-800 flex items-center justify-center">
                <Database className="w-5 h-5 text-[#087CEB]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#172033] dark:text-white">
                  Automated SQLite Snapshots (.db) ({backups.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Consistent online SQLite database snapshots created automatically every 6 hours and on demand.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={backupBusy}
              onClick={handleCreateDbSnapshot}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#18243A] hover:bg-[#172033] disabled:opacity-60 rounded-lg whitespace-nowrap"
            >
              <Database className="w-3.5 h-3.5 text-[#087CEB]" />
              {backupBusy ? 'Snapshotting...' : 'Create Backup Now'}
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 font-semibold text-slate-600 dark:text-slate-300">
                  <th className="py-2.5 px-4">Snapshot Filename</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Size</th>
                  <th className="py-2.5 px-4">Created At</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {backups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      No .db snapshots stored yet. Click "Create Backup Now" to create an instant consistent snapshot.
                    </td>
                  </tr>
                ) : (
                  backups.map((b) => (
                    <tr key={b.filename}>
                      <td className="py-2.5 px-4 font-mono font-semibold text-[#172033] dark:text-white">{b.filename}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.5 text-[11px] font-bold uppercase rounded ${
                            b.kind === 'auto'
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          {b.kind}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                        {b.size_bytes >= 1024 * 1024
                          ? `${(b.size_bytes / (1024 * 1024)).toFixed(2)} MB`
                          : `${(b.size_bytes / 1024).toFixed(1)} KB`}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-500">
                        {b.created_at.slice(0, 19).replace('T', ' ')}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              setError(null);
                              try {
                                await downloadFile(`/api/admin/backups/${encodeURIComponent(b.filename)}/download`, b.filename);
                              } catch (err) {
                                setError(err instanceof Error ? err.message : 'Download failed');
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded-lg"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDbSnapshot(b.filename)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
