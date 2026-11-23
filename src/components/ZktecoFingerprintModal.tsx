import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Fingerprint,
  Loader2,
  Radio,
  ShieldAlert,
  Usb,
  X,
} from 'lucide-react';
import { api, downloadFile } from '../api';
import type {
  DeviceRecord,
  EmployeeProfile,
  StaffFingerprintRecord,
  ZkEnrollJobRecord,
} from '../types';
import { captureHardwareFingerprintCredential } from '../utils/hardwareBiometric';

const FINGER_OPTIONS: Array<{ index: number; label: string }> = [
  { index: 6, label: 'Right Index' },
  { index: 5, label: 'Right Thumb' },
  { index: 7, label: 'Right Middle' },
  { index: 8, label: 'Right Ring' },
  { index: 9, label: 'Right Pinky' },
  { index: 4, label: 'Left Thumb' },
  { index: 3, label: 'Left Index' },
  { index: 2, label: 'Left Middle' },
  { index: 1, label: 'Left Ring' },
  { index: 0, label: 'Left Pinky' },
];

interface ZktecoFingerprintModalProps {
  employee: EmployeeProfile;
  isNewRegistration?: boolean;
  onClose: () => void;
  onEnrolled?: (fp: StaffFingerprintRecord) => void;
}

export const ZktecoFingerprintModal: React.FC<ZktecoFingerprintModalProps> = ({
  employee,
  isNewRegistration = false,
  onClose,
  onEnrolled,
}) => {
  const defaultPin =
    employee.employee_id.replace(/[^0-9]/g, '').replace(/^0+/, '') ||
    String(100 + (employee.id % 899));

  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [fingerIndex, setFingerIndex] = useState<string>('6');
  const [zkUserPin, setZkUserPin] = useState<string>(defaultPin);

  const [activeJob, setActiveJob] = useState<ZkEnrollJobRecord | null>(null);
  const [enrolledRecord, setEnrolledRecord] = useState<StaffFingerprintRecord | null>(null);
  const [requestingK40, setRequestingK40] = useState(false);
  const [scanningHardware, setScanningHardware] = useState(false);
  const [recordingAttendance, setRecordingAttendance] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DeviceRecord[]>('/api/devices')
      .then((list) => {
        const bioDevs = list.filter(
          (d) =>
            d.device_type.includes('Biometric') ||
            (d.protocol || '').includes('ZKTeco') ||
            Number(d.port) === 4370
        );
        const usable = bioDevs.length > 0 ? bioDevs : list;
        setDevices(usable);
        if (usable.length > 0) setSelectedDeviceId(String(usable[0].id));
      })
      .catch(() => {
        // ignore fetch failure
      });
  }, []);

  // Poll active K40 enrollment job while WaitingFinger
  useEffect(() => {
    if (!activeJob || activeJob.status !== 'WaitingFinger') return;
    const timer = window.setInterval(async () => {
      try {
        const latest = await api.get<ZkEnrollJobRecord>(`/api/devices/zkteco/enroll-jobs/${activeJob.id}`);
        setActiveJob(latest);
        if (latest.status === 'Enrolled') {
          const allFps = await api.get<StaffFingerprintRecord[]>('/api/devices/zkteco/fingerprints');
          const matched = allFps.find(
            (fp) =>
              fp.employee_id === employee.employee_id &&
              fp.finger_index === Number(fingerIndex)
          );
          if (matched) {
            setEnrolledRecord(matched);
            onEnrolled?.(matched);
          }
          setStatusMessage(
            latest.status_message ||
              `ZKTeco K40 captured ${employee.full_name}'s real fingerprint!`
          );
        } else if (latest.status === 'Failed' || latest.status === 'Cancelled') {
          setError(latest.status_message || 'ZKTeco K40 enrollment did not complete.');
        }
      } catch {
        // ignore transient poll error
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [activeJob, employee.employee_id, employee.full_name, fingerIndex, onEnrolled]);

  const handleAskZktecoK40 = async () => {
    setError(null);
    setStatusMessage(null);
    setRequestingK40(true);
    try {
      const fLabel =
        FINGER_OPTIONS.find((f) => String(f.index) === fingerIndex)?.label || 'Right Index';
      const res = await api.post<{
        job: ZkEnrollJobRecord;
        tcp_triggered: boolean;
      }>('/api/devices/zkteco/fingerprints/remote-enroll', {
        employee_id: employee.employee_id,
        zk_user_pin: zkUserPin.trim() || defaultPin,
        finger_index: Number(fingerIndex),
        finger_label: fLabel,
        device_id: selectedDeviceId ? Number(selectedDeviceId) : undefined,
      });
      setActiveJob(res.job);
      setStatusMessage(res.job.status_message);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not send enrollment request to ZKTeco K40.'
      );
    } finally {
      setRequestingK40(false);
    }
  };

  const handleCancelK40Wait = async () => {
    if (!activeJob) return;
    try {
      await api.post(`/api/devices/zkteco/enroll-jobs/${activeJob.id}/cancel`);
      setActiveJob({ ...activeJob, status: 'Cancelled' });
      setStatusMessage('Cancelled waiting on ZKTeco K40.');
    } catch {
      // ignore
    }
  };

  const handleScanLocalHardwareReader = async () => {
    setError(null);
    setStatusMessage(null);
    setScanningHardware(true);
    try {
      const fLabel =
        FINGER_OPTIONS.find((f) => String(f.index) === fingerIndex)?.label || 'Right Index';
      const captured = await captureHardwareFingerprintCredential({
        employeeId: employee.employee_id,
        employeeName: employee.full_name,
        fingerLabel: fLabel,
      });
      const res = await api.post<{ fingerprint: StaffFingerprintRecord; message: string }>(
        '/api/devices/zkteco/fingerprints/hardware-register',
        {
          employee_id: employee.employee_id,
          zk_user_pin: zkUserPin.trim() || defaultPin,
          finger_index: Number(fingerIndex),
          finger_label: fLabel,
          device_id: selectedDeviceId ? Number(selectedDeviceId) : undefined,
          credential_id: captured.credentialId,
          public_key: captured.publicKey,
          device_label: captured.deviceLabel,
        }
      );
      setEnrolledRecord(res.fingerprint);
      setActiveJob(null);
      setStatusMessage(res.message);
      onEnrolled?.(res.fingerprint);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not read finger from local hardware fingerprint sensor.'
      );
    } finally {
      setScanningHardware(false);
    }
  };

  const handleImmediateAttendanceScan = async () => {
    if (!enrolledRecord) return;
    setError(null);
    setRecordingAttendance(true);
    try {
      const res = await api.post<{ punch_time: string; punch_type: string }>(
        '/api/devices/zkteco/scan',
        {
          device_id: selectedDeviceId ? Number(selectedDeviceId) : undefined,
          fingerprint_id: enrolledRecord.id,
          punch_type: 'Check-In',
        }
      );
      setStatusMessage(
        `Real-time Attendance recorded: ${employee.full_name} (${employee.employee_id}) ${res.punch_type} at ${res.punch_time}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record attendance scan');
    } finally {
      setRecordingAttendance(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#18243A]/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border-2 border-[#087CEB] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 bg-[#18243A] text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#087CEB]/20 border border-[#38BDF8]/40 flex items-center justify-center shrink-0">
              <Fingerprint className="w-5 h-5 text-[#38BDF8]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold truncate">
                {isNewRegistration
                  ? 'Staff Registered — Enroll Real Fingerprint Now'
                  : 'ZKTeco K40 & Hardware Fingerprint Enrollment'}
              </h3>
              <p className="text-xs text-[#7DD3FC] truncate">
                {employee.full_name} · {employee.employee_id} · {employee.department}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white rounded-lg"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                ZKTeco K40 Terminal
              </label>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full px-2.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                {devices.length === 0 && <option value="">Default K40 (ADMS / Bridge)</option>}
                {devices.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.device_name} ({d.ip_address}:{d.port})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Finger Position
              </label>
              <select
                value={fingerIndex}
                onChange={(e) => setFingerIndex(e.target.value)}
                className="w-full px-2.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                {FINGER_OPTIONS.map((f) => (
                  <option key={f.index} value={String(f.index)}>
                    #{f.index} · {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                K40 User PIN
              </label>
              <input
                type="text"
                value={zkUserPin}
                onChange={(e) => setZkUserPin(e.target.value)}
                className="w-full px-2.5 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {statusMessage && (
            <div className="p-3 text-xs font-medium text-[#18243A] dark:text-[#7DD3FC] bg-[#EAF4FF] dark:bg-sky-950/60 border border-[#087CEB]/30 rounded-lg flex items-start gap-2">
              {activeJob?.status === 'WaitingFinger' ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#087CEB] shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 flex-1">
                <div>{statusMessage}</div>
                {activeJob?.status === 'WaitingFinger' && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#087CEB]">
                      <Radio className="w-3 h-3 animate-pulse" />
                      Channel: {activeJob.channel} · PIN {activeJob.zk_user_pin} · Finger #{activeJob.finger_index}
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelK40Wait}
                      className="text-[11px] font-bold text-red-600 hover:underline"
                    >
                      Cancel Wait
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {!enrolledRecord ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={requestingK40 || scanningHardware}
                onClick={handleAskZktecoK40}
                className="flex flex-col items-start gap-2 p-4 text-left bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-60 text-white rounded-xl transition-colors"
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  {requestingK40 ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Fingerprint className="w-4 h-4" />
                  )}
                  Ask ZKTeco K40 for Real Finger
                </div>
                <p className="text-[11px] text-white/90">
                  Sends enrollment command (TCP 4370 CMD_STARTENROLL + ADMS / LAN Bridge) so the K40 screen prompts {employee.full_name} to place their finger 3 times.
                </p>
              </button>

              <button
                type="button"
                disabled={requestingK40 || scanningHardware}
                onClick={handleScanLocalHardwareReader}
                className="flex flex-col items-start gap-2 p-4 text-left bg-[#18243A] hover:bg-[#172033] disabled:opacity-60 text-white rounded-xl transition-colors"
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  {scanningHardware ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#38BDF8]" />
                  ) : (
                    <Usb className="w-4 h-4 text-[#38BDF8]" />
                  )}
                  Scan Local Hardware Reader
                </div>
                <p className="text-[11px] text-slate-300">
                  Uses attached USB FIDO2 / Windows Hello / Touch ID / Android fingerprint scanner right at this registration desk.
                </p>
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                Fingerprint Enrolled &amp; Ready for Real-Time Attendance
              </div>
              <div className="text-xs font-mono text-emerald-900 dark:text-emerald-200">
                Employee: {enrolledRecord.employee_id} · PIN {enrolledRecord.zk_user_pin} ·{' '}
                {enrolledRecord.finger_label} ({enrolledRecord.auth_source || 'ZKTeco K40'})
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={recordingAttendance}
                  onClick={handleImmediateAttendanceScan}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg"
                >
                  {recordingAttendance ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  Record Initial Check-In Now
                </button>
                <button
                  type="button"
                  onClick={() => setEnrolledRecord(null)}
                  className="px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-lg"
                >
                  Enroll Another Finger
                </button>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>
              Using K40 on a remote factory LAN? Run the local K40 Bridge script on a factory PC.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const url = `/api/devices/zkteco/bridge-script${selectedDeviceId ? `?device_id=${selectedDeviceId}` : ''}`;
                  void downloadFile(url, 'zkteco-k40-bridge.mjs').catch((err) =>
                    setError(err instanceof Error ? err.message : 'Could not download K40 bridge script')
                  );
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#087CEB] bg-[#EAF4FF] dark:bg-slate-800 rounded-lg hover:underline"
              >
                <Download className="w-3 h-3" />
                Download K40 Bridge
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg"
              >
                {enrolledRecord ? 'Done' : 'Skip / Enroll Later'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
