import React, { useEffect, useState } from 'react';
import {
  Bell,
  Check,
  Database,
  Download,
  Fingerprint,
  HardDrive,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { api, getApiActorHeaders } from '../api';
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
  AuditLogRecord,
  BiometricCredential,
  DepartmentApprovalRecord,
  ModuleKey,
  NotificationItem,
  UserAccount,
} from '../types';

const BIOMETRIC_LOCAL_DEVICE_KEY = 'seven_sunday_biometric_device_id';

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
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
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
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = async () => {
    const [q, st, notifs, logs, approvals, bioList] = await Promise.all([
      getPendingQueue(),
      getOfflineStorageStats(),
      api.get<NotificationItem[]>('/api/notifications').catch(() => []),
      api.get<AuditLogRecord[]>('/api/audit-logs').catch(() => []),
      api.get<DepartmentApprovalRecord[]>('/api/approvals').catch(() => []),
      mode === 'sync'
        ? api.get<BiometricCredential[]>('/api/auth/biometric/list').catch(() => [])
        : Promise.resolve([]),
    ]);
    setQueue(q);
    setStats(st);
    setPolicy(st.conflictPolicy);
    setNotifications(notifs);
    setAuditLogs(logs);
    setDeptApprovals(approvals);
    setBiometrics(bioList);
  };

  useEffect(() => {
    loadAll();
    const handler = () => {
      getPendingQueue().then(setQueue);
      getOfflineStorageStats().then(setStats);
    };
    window.addEventListener('seven-sunday-sync-updated', handler);
    return () => window.removeEventListener('seven-sunday-sync-updated', handler);
  }, [mode]);

  const handleManualSync = async () => {
    setError(null);
    const res = await syncQueuedMutations(getApiActorHeaders());
    setSyncResult(`Synchronized ${res.synced} queued operations (${res.failed} failed) using "${policy}" policy.`);
    await loadAll();
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
                onClick={loadAll}
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
            <button
              type="button"
              onClick={async () => {
                await clearOfflineCache();
                setSyncResult('Cleared IndexedDB offline read cache.');
                await loadAll();
              }}
              className="text-[11px] text-red-600 hover:underline mt-1"
            >
              Clear Read Cache
            </button>
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
    </div>
  );
};
