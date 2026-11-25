import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Cable,
  CheckCircle2,
  Clock,
  Database,
  Download,
  ExternalLink,
  Fingerprint,
  Loader2,
  Lock,
  Pencil,
  Play,
  Plus,
  Power,
  Radar,
  Radio,
  RefreshCw,
  Save,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Trash2,
  TrendingUp,
  Unplug,
  Usb,
  UserPlus,
  Webhook,
  WifiOff,
  X,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, downloadFile, getApiTenantId } from '../api';
import { useI18n } from '../i18n/I18nProvider';
import type { WsEventPayload } from '../hooks/useRealtimeWS';
import type {
  BiometricAuthLogRecord,
  DeviceRecord,
  DeviceScanResult,
  DeviceSyncLogRecord,
  DeviceTelemetryResponse,
  EmployeeProfile,
  ModuleKey,
  StaffFingerprintRecord,
  UnmatchedDeviceUserRecord,
  ZkEnrollJobRecord,
  ZkRealtimeListenerStatus,
} from '../types';
import {
  captureHardwareFingerprintCredential,
  verifyHardwareFingerprintCredential,
} from '../utils/hardwareBiometric';

const DEVICE_TYPES = [
  'Biometric Fingerprint Terminal',
  'Face Recognition Gate',
  'RFID Card Reader',
  'Thermal / Register Printer',
  'Network Time Clock',
  'Barcode / Warehouse Scanner',
  'Local EMS Gateway Node',
];

const PROTOCOL_OPTIONS = [
  'TCP/IP Socket',
  'HTTP/HTTPS REST',
  'ZKTeco ADMS / iClock Push',
  'Web Serial USB/COM',
  'IoT Gateway',
];

interface DevicesModuleProps {
  lastWsEvent?: WsEventPayload | null;
  onNavigate?: (module: ModuleKey) => void;
  onRefreshDashboard: () => void;
}

const AUTH_METHODS = ['Fingerprint', 'Face ID', 'RFID Card', 'Platform Passkey'] as const;

function formatLogTimestamp(iso: string): { date: string; time: string } {
  if (!iso) return { date: '--', time: '--' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { date: iso.slice(0, 10), time: iso.slice(11, 19) || '--' };
  }
  return {
    date: d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' }),
    time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
}

const FINGER_OPTIONS: Array<{ index: number; label: string }> = [
  { index: 6, label: 'Right Index (Recommended)' },
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

function isZktK40Device(dev: DeviceRecord | null | undefined): boolean {
  if (!dev) return false;
  const hay = `${dev.device_name || ''} ${dev.serial_number || ''} ${dev.protocol || ''} ${dev.device_type || ''}`.toLowerCase();
  return (
    hay.includes('k40') ||
    hay.includes('zkteco') ||
    hay.includes('zk-') ||
    dev.device_type.includes('Biometric') ||
    Number(dev.port) === 4370
  );
}

export const DevicesModule: React.FC<DevicesModuleProps> = ({
  lastWsEvent,
  onNavigate,
  onRefreshDashboard,
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<
    'connections' | 'zkteco-k40' | 'biometric-logs' | 'sync-logs' | 'unmatched-pins'
  >('connections');
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [fingerprints, setFingerprints] = useState<StaffFingerprintRecord[]>([]);
  const [bioLogs, setBioLogs] = useState<BiometricAuthLogRecord[]>([]);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioStatusFilter, setBioStatusFilter] = useState<'All' | 'Success' | 'Failure'>('All');
  const [bioDeviceFilter, setBioDeviceFilter] = useState<string>('All');
  const [bioSearch, setBioSearch] = useState('');
  const [verifyingScan, setVerifyingScan] = useState(false);
  const [markingLogId, setMarkingLogId] = useState<number | null>(null);
  const [lastLiveEventAt, setLastLiveEventAt] = useState<string | null>(null);

  // Read-Only K40 Sync Logs & Unmatched PINs state
  const [syncLogs, setSyncLogs] = useState<DeviceSyncLogRecord[]>([]);
  const [syncLogsLoading, setSyncLogsLoading] = useState(false);
  const [unmatchedUsers, setUnmatchedUsers] = useState<UnmatchedDeviceUserRecord[]>([]);
  const [unmatchedLoading, setUnmatchedLoading] = useState(false);
  const [mapTargetById, setMapTargetById] = useState<Record<number, string>>({});
  const [mappingId, setMappingId] = useState<number | null>(null);
  const [testingConnId, setTestingConnId] = useState<number | null>(null);
  const [syncingNowId, setSyncingNowId] = useState<number | null>(null);

  // ZKTeco K40 Enrollment & Scan state
  const [enrollingFinger, setEnrollingFinger] = useState(false);
  const [waitingK40Enroll, setWaitingK40Enroll] = useState(false);
  const [hwEnrolling, setHwEnrolling] = useState(false);
  const [hwScanning, setHwScanning] = useState(false);
  const [activeEnrollJob, setActiveEnrollJob] = useState<ZkEnrollJobRecord | null>(null);
  const [realtimeListeners, setRealtimeListeners] = useState<ZkRealtimeListenerStatus[]>([]);
  const [togglingListenerId, setTogglingListenerId] = useState<number | null>(null);
  const [scanningFinger, setScanningFinger] = useState(false);
  const [pullingId, setPullingId] = useState<number | null>(null);
  const [zkEnrollForm, setZkEnrollForm] = useState({
    employee_id: '',
    zk_user_pin: '',
    finger_index: '6',
    device_id: '',
    template_sample: '',
  });
  const [zkScanForm, setZkScanForm] = useState({
    device_id: '',
    fingerprint_id: '',
    employee_id: '',
    zk_user_pin: '',
    punch_type: 'Auto' as 'Auto' | 'Check-In' | 'Check-Out',
  });

  const [verifyForm, setVerifyForm] = useState({
    device_id: '',
    employee_code: '',
    auth_method: 'Fingerprint' as (typeof AUTH_METHODS)[number],
    punch_type: 'Check-In' as 'Check-In' | 'Check-Out',
    auto_mark_attendance: true,
  });

  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState<number | null>(null);
  const [probingAll, setProbingAll] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Network Scanner state
  const [scanPanelOpen, setScanPanelOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanSubnetPrefix, setScanSubnetPrefix] = useState('192.168.10');
  const [scanHosts, setScanHosts] = useState('127.0.0.1');
  const [scanPorts, setScanPorts] = useState('3000,4370,80,8080,502');
  const [scanResults, setScanResults] = useState<DeviceScanResult[]>([]);
  const [lastScanCount, setLastScanCount] = useState<number | null>(null);

  // Sync / Webhook Punch Modal state
  const [punchModalDevice, setPunchModalDevice] = useState<DeviceRecord | null>(null);
  const [punchSending, setPunchSending] = useState(false);
  const [punchForm, setPunchForm] = useState({
    employee_code: '',
    employee_name: '',
    department: '',
    punch_type: 'Check-In' as 'Check-In' | 'Check-Out',
    ot_type: 'None' as 'None' | 'Regular' | 'Night' | 'Sunday' | 'Holiday',
    ot_hours: '0',
  });

  // Register New Biometric Modal state (with connecting/scanning/success/error live status)
  type ScannerLiveStatus = 'connecting' | 'scanning' | 'success' | 'error';
  const [registerBioModalOpen, setRegisterBioModalOpen] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<ScannerLiveStatus>('connecting');
  const [scannerStatusDetail, setScannerStatusDetail] = useState('');
  const [scannerDeviceProbeInfo, setScannerDeviceProbeInfo] = useState('');
  const [modalBioForm, setModalBioForm] = useState({
    employee_id: '',
    zk_user_pin: '',
    finger_index: '6',
    mode: 'k40' as 'k40' | 'hardware',
  });
  const [modalEnrollJob, setModalEnrollJob] = useState<ZkEnrollJobRecord | null>(null);
  const [modalEnrolledFp, setModalEnrolledFp] = useState<StaffFingerprintRecord | null>(null);
  const [modalCheckinBusy, setModalCheckinBusy] = useState(false);

  // 30-Day Telemetry & Latency Threshold Config state
  const [telemetry, setTelemetry] = useState<DeviceTelemetryResponse | null>(null);
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [telemetryChartView, setTelemetryChartView] = useState<'daily' | 'probes'>('daily');
  const [thresholdInput, setThresholdInput] = useState('150');
  const [savingThreshold, setSavingThreshold] = useState(false);

  const emptyForm = {
    device_type: DEVICE_TYPES[0],
    model: 'ZKTeco K40',
    protocol: PROTOCOL_OPTIONS[0],
    device_name: '',
    ip_address: '',
    port: '4370',
    endpoint_url: '',
    subnet_mask: '255.255.255.0',
    gateway: '192.168.10.1',
    serial_number: '',
    api_key: '',
    comm_password: '',
    sync_interval_sec: '3',
    auto_sync_enabled: true,
    latency_threshold_ms: '150',
    has_comm_password: false,
  };
  const [form, setForm] = useState(emptyForm);

  const loadDevices = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await api.get<DeviceRecord[]>('/api/devices');
      setDevices(data);
      const firstK40 = data.find((d) => isZktK40Device(d)) || null;
      setSelectedDeviceId((prev) => {
        if (prev !== null && data.some((d) => d.id === prev)) return prev;
        return firstK40 ? firstK40.id : null;
      });
      if (firstK40) {
        setZkEnrollForm((prev) => (prev.device_id ? prev : { ...prev, device_id: String(firstK40.id) }));
        setZkScanForm((prev) => (prev.device_id ? prev : { ...prev, device_id: String(firstK40.id) }));
      }
      setVerifyForm((prev) => {
        if (prev.device_id || data.length === 0) return prev;
        return { ...prev, device_id: String(data[0].id) };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadBioLogs = async () => {
    try {
      setBioLoading(true);
      const data = await api.get<BiometricAuthLogRecord[]>('/api/devices/biometric-logs?limit=250');
      setBioLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load biometric authentication logs');
    } finally {
      setBioLoading(false);
    }
  };

  const loadFingerprints = async () => {
    try {
      const list = await api.get<StaffFingerprintRecord[]>('/api/devices/zkteco/fingerprints');
      setFingerprints(list);
      setZkScanForm((prev) => {
        if (prev.fingerprint_id || list.length === 0) return prev;
        return {
          ...prev,
          fingerprint_id: String(list[0].id),
          employee_id: list[0].employee_id,
          zk_user_pin: list[0].zk_user_pin,
        };
      });
    } catch {
      // ignore initial fetch error
    }
  };

  const loadEmployees = async () => {
    try {
      const empData = await api.get<EmployeeProfile[]>('/api/employees');
      setEmployees(empData);
      const active = empData.find((e) => e.status === 'Active') || empData[0];
      if (active) {
        setVerifyForm((prev) => (prev.employee_code ? prev : { ...prev, employee_code: active.employee_id }));
        setZkEnrollForm((prev) => (prev.employee_id ? prev : { ...prev, employee_id: active.employee_id }));
      }
    } catch {
      // Non-HR roles may not have employee directory read access; manual employee ID still works
    }
  };

  const loadSyncLogs = async () => {
    try {
      setSyncLogsLoading(true);
      const list = await api.get<DeviceSyncLogRecord[]>('/api/devices/zkteco/sync-logs?limit=80');
      setSyncLogs(list);
    } catch {
      // ignore initial sync log fetch error
    } finally {
      setSyncLogsLoading(false);
    }
  };

  const loadUnmatchedUsers = async () => {
    try {
      setUnmatchedLoading(true);
      const list = await api.get<UnmatchedDeviceUserRecord[]>('/api/devices/zkteco/unmatched');
      setUnmatchedUsers(list);
    } catch {
      // ignore initial unmatched fetch error
    } finally {
      setUnmatchedLoading(false);
    }
  };

  const loadRealtimeListeners = async () => {
    try {
      const list = await api.get<ZkRealtimeListenerStatus[]>('/api/devices/zkteco/realtime/status');
      setRealtimeListeners(list);
    } catch {
      // ignore initial listener fetch error
    }
  };

  const loadTelemetry = async (deviceId: number, silent = false) => {
    try {
      if (!silent) setTelemetryLoading(true);
      const res = await api.get<DeviceTelemetryResponse>(`/api/devices/${deviceId}/telemetry?days=30`);
      setTelemetry(res);
    } catch {
      // ignore transient telemetry load failure
    } finally {
      if (!silent) setTelemetryLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
    loadBioLogs();
    loadFingerprints();
    loadEmployees();
    loadRealtimeListeners();
    loadSyncLogs();
    loadUnmatchedUsers();
  }, []);

  // Poll active K40 remote enrollment job while WaitingFinger (shared for inline & modal)
  useEffect(() => {
    if (!activeEnrollJob || activeEnrollJob.status !== 'WaitingFinger') return;
    const timer = window.setInterval(async () => {
      try {
        const latest = await api.get<ZkEnrollJobRecord>(
          `/api/devices/zkteco/enroll-jobs/${activeEnrollJob.id}`
        );
        setActiveEnrollJob(latest);
        if (latest.status === 'Enrolled') {
          loadFingerprints();
          setNotice(
            latest.status_message ||
              `ZKTeco K40 captured real fingerprint for ${latest.employee_name} (${latest.employee_id}).`
          );
        } else if (latest.status === 'Failed' || latest.status === 'Cancelled') {
          setError(latest.status_message || 'ZKTeco K40 remote enrollment stopped.');
        }
      } catch {
        // ignore transient poll error
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [activeEnrollJob]);

  // Poll modal K40 remote enrollment job while modal is open and scanning
  useEffect(() => {
    if (!registerBioModalOpen || !modalEnrollJob || modalEnrollJob.status !== 'WaitingFinger') return;
    const timer = window.setInterval(async () => {
      try {
        const latest = await api.get<ZkEnrollJobRecord>(
          `/api/devices/zkteco/enroll-jobs/${modalEnrollJob.id}`
        );
        setModalEnrollJob(latest);
        if (latest.status === 'Enrolled') {
          const updatedFps = await api.get<StaffFingerprintRecord[]>('/api/devices/zkteco/fingerprints').catch(() => [] as StaffFingerprintRecord[]);
          if (updatedFps.length > 0) setFingerprints(updatedFps);
          const matched = updatedFps.find(
            (fp) => fp.employee_id === latest.employee_id && fp.finger_index === latest.finger_index
          ) || null;
          setModalEnrolledFp(matched);
          setScannerStatus('success');
          setScannerStatusDetail(
            latest.status_message ||
              `ZKTeco K40 captured and saved fingerprint for ${latest.employee_name} (${latest.employee_id}, PIN ${latest.zk_user_pin}).`
          );
        } else if (latest.status === 'Failed' || latest.status === 'Cancelled') {
          setScannerStatus('error');
          setScannerStatusDetail(latest.status_message || 'ZKTeco K40 biometric capture was cancelled or failed.');
        }
      } catch (err) {
        setScannerStatus('error');
        setScannerStatusDetail(err instanceof Error ? err.message : 'Lost connection while polling ZKTeco K40 enrollment status.');
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [registerBioModalOpen, modalEnrollJob]);

  const lastWsRef = useRef<WsEventPayload | null>(null);
  useEffect(() => {
    if (!lastWsEvent || lastWsEvent === lastWsRef.current) return;
    lastWsRef.current = lastWsEvent;
    const payload = (lastWsEvent.payload || {}) as Record<string, unknown>;
    const activeTenant = getApiTenantId();
    if (payload.tenant_id !== undefined && Number(payload.tenant_id) !== activeTenant) {
      return;
    }

    if (lastWsEvent.event === 'biometric:auth_log') {
      const incoming = payload as unknown as BiometricAuthLogRecord;
      if (incoming && typeof incoming.id === 'number') {
        setBioLogs((prev) => {
          const exists = prev.some((item) => item.id === incoming.id);
          if (exists) {
            return prev.map((item) => (item.id === incoming.id ? incoming : item));
          }
          return [incoming, ...prev].slice(0, 250);
        });
        setLastLiveEventAt(new Date().toLocaleTimeString());
      }
      return;
    }

    if (lastWsEvent.event === 'zkteco:finger_enrolled') {
      loadFingerprints();
      const enrolledFp = payload.fingerprint as StaffFingerprintRecord | undefined;
      if (enrolledFp) {
        setNotice(
          `Real fingerprint enrolled for ${enrolledFp.employee_name} (${enrolledFp.employee_id}) via ${
            enrolledFp.auth_source || 'ZKTeco K40'
          }.`
        );
        if (
          registerBioModalOpen &&
          (!modalBioForm.employee_id || enrolledFp.employee_id === modalBioForm.employee_id.trim())
        ) {
          setModalEnrolledFp(enrolledFp);
          setScannerStatus('success');
          setScannerStatusDetail(
            `Real fingerprint enrolled for ${enrolledFp.employee_name} (${enrolledFp.employee_id}, PIN ${enrolledFp.zk_user_pin}) via ${
              enrolledFp.auth_source || 'ZKTeco K40'
            }.`
          );
        }
      }
      return;
    }

    if (lastWsEvent.event === 'zkteco:realtime_status') {
      loadRealtimeListeners();
      return;
    }

    if (lastWsEvent.event === 'device:telemetry') {
      const targetId = analyticsDeviceIdRef.current;
      if (targetId && (payload.id === undefined || Number(payload.id) === targetId)) {
        loadTelemetry(targetId, true);
      }
      return;
    }

    if (lastWsEvent.event === 'zkteco:sync_complete') {
      loadDevices(true);
      loadSyncLogs();
      loadBioLogs();
      loadUnmatchedUsers();
      if (analyticsDeviceIdRef.current) loadTelemetry(analyticsDeviceIdRef.current, true);
      setLastLiveEventAt(new Date().toLocaleTimeString());
      return;
    }

    if (lastWsEvent.event === 'zkteco:unmatched_user') {
      loadUnmatchedUsers();
      return;
    }

    if (
      lastWsEvent.event === 'device:punch' ||
      lastWsEvent.event === 'device:status' ||
      lastWsEvent.event === 'attendance:updated' ||
      lastWsEvent.event === 'ws:reconnected'
    ) {
      loadDevices(true);
      loadRealtimeListeners();
      loadSyncLogs();
      loadBioLogs();
      if (analyticsDeviceIdRef.current) loadTelemetry(analyticsDeviceIdRef.current, true);
    }
  }, [lastWsEvent]);

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const payload = {
        device_type: form.device_type,
        model: form.model || 'ZKTeco K40',
        protocol: form.protocol,
        device_name: form.device_name,
        ip_address: form.ip_address,
        port: Number(form.port) || 4370,
        endpoint_url: form.endpoint_url,
        subnet_mask: form.subnet_mask,
        gateway: form.gateway,
        serial_number: form.serial_number,
        api_key: form.api_key,
        comm_password: form.comm_password.trim()
          ? form.comm_password.trim()
          : editingId !== null && form.has_comm_password
          ? '********'
          : '',
        sync_interval_sec: Math.min(60, Math.max(2, Number(form.sync_interval_sec) || 3)),
        auto_sync_enabled: Boolean(form.auto_sync_enabled),
        latency_threshold_ms: Math.min(10000, Math.max(10, Math.round(Number(form.latency_threshold_ms) || 150))),
        timezone: 'Africa/Addis_Ababa',
      };
      if (editingId !== null) {
        const updated = await api.put<DeviceRecord>(`/api/devices/${editingId}`, payload);
        setDevices((prev) => prev.map((d) => (d.id === editingId ? updated : d)));
        if (analyticsDeviceIdRef.current === editingId) {
          setThresholdInput(String(updated.latency_threshold_ms || 150));
          loadTelemetry(editingId, true);
        }
        setEditingId(null);
        setForm(emptyForm);
        setNotice(`Saved device connection "${updated.device_name}".`);
      } else {
        const created = await api.post<DeviceRecord>('/api/devices', payload);
        setDevices((prev) => [created, ...prev]);
        setSelectedDeviceId(created.id);
        setForm(emptyForm);
        setNotice(`Registered device connection "${created.device_name}".`);
      }
      loadRealtimeListeners();
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save device connection');
    }
  };

  const handleConnect = async (id: number) => {
    setError(null);
    setNotice(null);
    setConnectingId(id);
    try {
      const updated = await api.post<DeviceRecord>(`/api/devices/${id}/connect`);
      setDevices((prev) => prev.map((d) => (d.id === id ? updated : d)));
      setNotice(
        `${updated.device_name}: ${updated.status}${
          updated.last_latency_ms !== null ? ` (${updated.last_latency_ms}ms)` : ''
        }`
      );
      if (analyticsDeviceIdRef.current === id) {
        loadTelemetry(id, true);
      }
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection probe failed');
    } finally {
      setConnectingId(null);
    }
  };

  const handleProbeAll = async () => {
    setError(null);
    setNotice(null);
    setProbingAll(true);
    try {
      const refreshed = await api.post<DeviceRecord[]>('/api/devices/probe-all');
      setDevices(refreshed);
      const onlineCount = refreshed.filter((d) => d.status === 'Connected').length;
      setNotice(`Probed ${refreshed.length} device connections · ${onlineCount} live and connected.`);
      if (analyticsDeviceIdRef.current) {
        loadTelemetry(analyticsDeviceIdRef.current, true);
      }
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch probe failed');
    } finally {
      setProbingAll(false);
    }
  };

  const handleRunScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setScanning(true);
    try {
      const hosts = scanHosts
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const ports = scanPorts
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0 && n <= 65535);
      const res = await api.post<{ scanned: number; discovered: DeviceScanResult[] }>('/api/devices/scan-subnet', {
        hosts: hosts.length > 0 ? hosts : undefined,
        subnet_prefix: hosts.length === 0 ? scanSubnetPrefix : undefined,
        ports,
      });
      setScanResults(res.discovered || []);
      setLastScanCount(res.scanned);
      setNotice(`Scanned ${res.scanned} IP/Port endpoints · found ${res.discovered?.length || 0} reachable endpoint(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network scan failed');
    } finally {
      setScanning(false);
    }
  };

  const handleQuickRegisterScan = async (hit: DeviceScanResult) => {
    setError(null);
    try {
      const created = await api.post<DeviceRecord>('/api/devices', {
        device_type: hit.suggested_type || 'Local EMS Gateway Node',
        protocol: hit.port === 3000 || hit.port === 80 || hit.port === 8080 ? 'HTTP/HTTPS REST' : 'TCP/IP Socket',
        device_name: `Discovered ${hit.ip_address}:${hit.port}`,
        ip_address: hit.ip_address,
        port: hit.port,
        endpoint_url:
          hit.port === 3000 ? `http://${hit.ip_address}:3000/api/health` : '',
        subnet_mask: '255.255.255.0',
        gateway: '192.168.10.1',
        serial_number: `SCAN-${hit.port}-${Date.now().toString().slice(-4)}`,
      });
      const connected = await api.post<DeviceRecord>(`/api/devices/${created.id}/connect`);
      setDevices((prev) => [connected, ...prev.filter((d) => d.id !== connected.id)]);
      setNotice(`Registered & connected ${connected.device_name} (${connected.status}).`);
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quick registration failed');
    }
  };

  const handleDiscoverLocalUsbSerial = async () => {
    setError(null);
    setNotice(null);
    const nav = navigator as Navigator & {
      serial?: { requestPort: () => Promise<{ getInfo: () => { usbVendorId?: number; usbProductId?: number } }> };
      usb?: { requestDevice: (opts: { filters: unknown[] }) => Promise<{ productName?: string; vendorId: number; productId: number; serialNumber?: string }> };
    };
    try {
      if (nav.serial) {
        const port = await nav.serial.requestPort();
        const info = port.getInfo();
        const vid = info.usbVendorId ? info.usbVendorId.toString(16).toUpperCase() : 'COM';
        const pid = info.usbProductId ? info.usbProductId.toString(16).toUpperCase() : 'PORT';
        setForm((prev) => ({
          ...prev,
          device_type: 'Barcode / Warehouse Scanner',
          protocol: 'Web Serial USB/COM',
          device_name: prev.device_name || `USB Serial Terminal (${vid}:${pid})`,
          ip_address: prev.ip_address || '127.0.0.1',
          port: prev.port || '3000',
          serial_number: prev.serial_number || `USB-${vid}-${pid}`,
        }));
        setNotice(`Detected local Web Serial port (${vid}:${pid}). Complete fields and click Save to register.`);
        return;
      }
      if (nav.usb) {
        const dev = await nav.usb.requestDevice({ filters: [] });
        setForm((prev) => ({
          ...prev,
          device_type: 'Biometric Fingerprint Terminal',
          protocol: 'Web Serial USB/COM',
          device_name: prev.device_name || dev.productName || 'USB Biometric Reader',
          ip_address: prev.ip_address || '127.0.0.1',
          port: prev.port || '3000',
          serial_number: prev.serial_number || dev.serialNumber || `USB-${dev.vendorId}-${dev.productId}`,
        }));
        setNotice(`Detected local USB device "${dev.productName || 'Hardware Reader'}". Save to register.`);
        return;
      }
      setError(
        'Web Serial / WebUSB browser discovery is unavailable or blocked by iframe policy. Register LAN TCP/IP, HTTP/REST, or ZKTeco ADMS hardware above.'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'USB/Serial selection cancelled';
      setError(`Local USB/Serial prompt closed: ${msg}`);
    }
  };

  const handleDisconnect = async (id: number) => {
    setError(null);
    try {
      const updated = await api.post<DeviceRecord>(`/api/devices/${id}/disconnect`);
      setDevices((prev) => prev.map((d) => (d.id === id ? updated : d)));
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed');
    }
  };

  const handleDelete = async (id: number) => {
    setError(null);
    try {
      await api.del(`/api/devices/${id}`);
      setDevices((prev) => prev.filter((d) => d.id !== id));
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handlePushPunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!punchModalDevice) return;
    setError(null);
    setPunchSending(true);
    try {
      const res = await api.post<{ device: DeviceRecord; attendance: Record<string, unknown> }>(
        `/api/devices/${punchModalDevice.id}/push-punch`,
        {
          employee_code: punchForm.employee_code,
          employee_name: punchForm.employee_name || undefined,
          department: punchForm.department || undefined,
          punch_type: punchForm.punch_type,
          ot_type: punchForm.ot_type,
          ot_hours: Number(punchForm.ot_hours) || 0,
        }
      );
      setDevices((prev) => prev.map((d) => (d.id === res.device.id ? res.device : d)));
      setPunchModalDevice(res.device);
      setNotice(
        `Live punch ingested from ${res.device.device_name} for ${punchForm.employee_code} into Attendance Register.`
      );
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Biometric punch push failed');
    } finally {
      setPunchSending(false);
    }
  };

  const handleVerifyBiometricScan = async () => {
    setError(null);
    setNotice(null);
    setVerifyingScan(true);
    try {
      const selectedDev = devices.find((d) => String(d.id) === verifyForm.device_id);
      const res = await api.post<{
        log: BiometricAuthLogRecord;
        attendance: Record<string, unknown> | null;
        device: DeviceRecord | null;
      }>('/api/devices/biometric-logs/verify', {
        device_id: selectedDev ? selectedDev.id : undefined,
        device_identifier: selectedDev ? selectedDev.serial_number : 'GATE-TERMINAL-01',
        device_name: selectedDev ? selectedDev.device_name : 'Primary Biometric Gate',
        employee_code: verifyForm.employee_code.trim(),
        auth_method: verifyForm.auth_method,
        punch_type: verifyForm.punch_type,
        auto_mark_attendance: verifyForm.auto_mark_attendance,
      });

      setBioLogs((prev) => {
        const exists = prev.some((r) => r.id === res.log.id);
        return exists ? prev.map((r) => (r.id === res.log.id ? res.log : r)) : [res.log, ...prev];
      });
      if (res.device) {
        setDevices((prev) => prev.map((d) => (d.id === res.device!.id ? res.device! : d)));
      }
      setNotice(
        `Biometric ${res.log.auth_method} verified for ${res.log.employee_name} (${res.log.employee_code})${
          res.log.attendance_marked && res.log.attendance_record_id
            ? ` · Attendance #${res.log.attendance_record_id} automatically marked.`
            : '.'
        }`
      );
      onRefreshDashboard();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Biometric scan failed';
      setError(`Biometric Verification Failed: ${msg}`);
      loadBioLogs();
    } finally {
      setVerifyingScan(false);
    }
  };

  const handleLoadZktecoK40Preset = () => {
    setEditingId(null);
    setForm({
      device_type: 'Biometric Fingerprint Terminal',
      model: 'ZKTeco K40',
      protocol: 'TCP/IP Socket',
      device_name: 'ZKTeco K40 Biometric Terminal',
      ip_address: '192.168.1.201',
      port: '4370',
      endpoint_url: '/iclock/cdata',
      subnet_mask: '255.255.255.0',
      gateway: '192.168.1.1',
      serial_number: `ZKT-K40-${Date.now().toString().slice(-4)}`,
      api_key: '',
      comm_password: '',
      sync_interval_sec: '3',
      auto_sync_enabled: true,
      latency_threshold_ms: '150',
      has_comm_password: false,
    });
    setNotice('Loaded ZKTeco K40 Read-Only preset (TCP 4370 + ADMS /iclock/cdata · 3s auto-poll). Enter your K40 LAN IP & Serial Number and click Save.');
  };

  const handleTestK40Connection = async (dev: DeviceRecord) => {
    setError(null);
    setNotice(null);
    setTestingConnId(dev.id);
    try {
      const res = await api.post<{ ok: boolean; latencyMs?: number; message?: string; error?: string; device: DeviceRecord }>(
        `/api/devices/${dev.id}/zkteco/test-connection`
      );
      if (res.device) {
        setDevices((prev) => prev.map((d) => (d.id === dev.id ? res.device : d)));
      }
      setNotice(
        `Connection verified: ${dev.device_name} responded in ${res.latencyMs ?? 0}ms (${res.message || 'ZKTeco TCP 4370 OK'}).`
      );
      if (analyticsDeviceIdRef.current === dev.id) {
        loadTelemetry(dev.id, true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Connection test failed for ${dev.device_name}`);
      loadDevices(true);
      if (analyticsDeviceIdRef.current === dev.id) {
        loadTelemetry(dev.id, true);
      }
    } finally {
      setTestingConnId(null);
    }
  };

  const handleSyncNowK40 = async (dev: DeviceRecord) => {
    setError(null);
    setNotice(null);
    setSyncingNowId(dev.id);
    try {
      const res = await api.post<{
        device: DeviceRecord;
        ok: boolean;
        latencyMs: number;
        message: string;
        fetched: number;
        imported: number;
        skipped_duplicates: number;
        unmatched: number;
      }>(`/api/devices/${dev.id}/zkteco/sync-now`);
      if (res.device) {
        setDevices((prev) => prev.map((d) => (d.id === dev.id ? res.device : d)));
      }
      setNotice(
        `Read-Only Sync (${dev.device_name}): fetched ${res.fetched}, imported ${res.imported}, duplicates skipped ${res.skipped_duplicates}, unmatched PINs ${res.unmatched} (${res.latencyMs}ms).`
      );
      loadSyncLogs();
      loadUnmatchedUsers();
      loadBioLogs();
      if (analyticsDeviceIdRef.current === dev.id) {
        loadTelemetry(dev.id, true);
      }
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ZKTeco K40 Read-Only Sync failed');
      loadDevices(true);
      loadSyncLogs();
      if (analyticsDeviceIdRef.current === dev.id) {
        loadTelemetry(dev.id, true);
      }
    } finally {
      setSyncingNowId(null);
    }
  };

  const handleToggleAutoSync = async (dev: DeviceRecord) => {
    setError(null);
    try {
      const nextEnabled = !Boolean(dev.auto_sync_enabled);
      const updated = await api.put<DeviceRecord>(`/api/devices/${dev.id}`, {
        auto_sync_enabled: nextEnabled,
        sync_interval_sec: dev.sync_interval_sec || 3,
      });
      setDevices((prev) => prev.map((d) => (d.id === dev.id ? updated : d)));
      setNotice(
        `${dev.device_name}: Read-Only Auto-Polling ${nextEnabled ? `enabled (${updated.sync_interval_sec || 3}s)` : 'paused'}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle auto-polling');
    }
  };

  const handleMapUnmatchedUser = async (row: UnmatchedDeviceUserRecord) => {
    const empId = (mapTargetById[row.id] || '').trim();
    if (!empId) {
      setError(`Select or enter an HR Employee ID for device PIN "${row.device_user_id}" before mapping.`);
      return;
    }
    setError(null);
    setNotice(null);
    setMappingId(row.id);
    try {
      const res = await api.post<{ ok: boolean; mapped_employee_id: string; backfilled: number }>(
        `/api/devices/zkteco/unmatched/${row.id}/map`,
        { employee_id: empId }
      );
      setNotice(
        `Mapped device PIN ${row.device_user_id} to HR Employee ${res.mapped_employee_id} (backfilled ${res.backfilled} raw punch(es)). Physical K40 data was NOT modified.`
      );
      await Promise.all([loadUnmatchedUsers(), loadSyncLogs(), loadBioLogs()]);
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to map unmatched PIN');
    } finally {
      setMappingId(null);
    }
  };

  const handlePullK40Attendance = async (dev: DeviceRecord) => {
    setError(null);
    setNotice(null);
    setPullingId(dev.id);
    try {
      const res = await api.post<{ device: DeviceRecord; ingested: number; message: string }>(
        `/api/devices/${dev.id}/zkteco/pull-attendance`
      );
      setDevices((prev) => prev.map((d) => (d.id === dev.id ? res.device : d)));
      setNotice(`${res.message} · Ingested ${res.ingested} attendance record(s) into Attendance Register.`);
      loadBioLogs();
      loadSyncLogs();
      loadUnmatchedUsers();
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ZKTeco K40 TCP 4370 pull failed');
      loadDevices(true);
      loadSyncLogs();
    } finally {
      setPullingId(null);
    }
  };

  const handleEnrollFingerprint = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setEnrollingFinger(true);
    try {
      const fingerObj = FINGER_OPTIONS.find((f) => String(f.index) === zkEnrollForm.finger_index);
      const res = await api.post<{ fingerprint: StaffFingerprintRecord; message: string }>(
        '/api/devices/zkteco/fingerprints/register',
        {
          employee_id: zkEnrollForm.employee_id.trim(),
          zk_user_pin: zkEnrollForm.zk_user_pin.trim() || undefined,
          finger_index: Number(zkEnrollForm.finger_index),
          finger_label: fingerObj ? fingerObj.label.replace(' (Recommended)', '') : undefined,
          device_id: zkEnrollForm.device_id ? Number(zkEnrollForm.device_id) : undefined,
          template_sample: zkEnrollForm.template_sample.trim() || undefined,
        }
      );
      setFingerprints((prev) => [
        res.fingerprint,
        ...prev.filter((fp) => fp.id !== res.fingerprint.id),
      ]);
      setZkScanForm((prev) => ({
        ...prev,
        fingerprint_id: String(res.fingerprint.id),
        employee_id: res.fingerprint.employee_id,
        zk_user_pin: res.fingerprint.zk_user_pin,
      }));
      setZkEnrollForm((prev) => ({ ...prev, template_sample: '' }));
      setNotice(
        `Enrolled ${res.fingerprint.finger_label} for ${res.fingerprint.employee_name} (${res.fingerprint.employee_id}, ZK PIN ${res.fingerprint.zk_user_pin}). ${res.message}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll ZKTeco K40 fingerprint');
    } finally {
      setEnrollingFinger(false);
    }
  };

  const handleDeleteFingerprint = async (id: number) => {
    setError(null);
    try {
      await api.del(`/api/devices/zkteco/fingerprints/${id}`);
      setFingerprints((prev) => prev.filter((fp) => fp.id !== id));
      setNotice('Removed enrolled staff fingerprint.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove enrolled fingerprint');
    }
  };

  const handleZktecoScan = async () => {
    setError(null);
    setNotice(null);
    setScanningFinger(true);
    try {
      const res = await api.post<{
        log: BiometricAuthLogRecord;
        attendance: Record<string, unknown>;
        device: DeviceRecord | null;
        punch_time: string;
        punch_type: 'Check-In' | 'Check-Out';
      }>('/api/devices/zkteco/scan', {
        device_id: zkScanForm.device_id ? Number(zkScanForm.device_id) : undefined,
        fingerprint_id: zkScanForm.fingerprint_id ? Number(zkScanForm.fingerprint_id) : undefined,
        employee_id: zkScanForm.employee_id.trim() || undefined,
        zk_user_pin: zkScanForm.zk_user_pin.trim() || undefined,
        punch_type: zkScanForm.punch_type,
      });

      setBioLogs((prev) => [res.log, ...prev.filter((r) => r.id !== res.log.id)]);
      if (res.device) {
        setDevices((prev) => prev.map((d) => (d.id === res.device!.id ? res.device! : d)));
      }
      loadFingerprints();
      setNotice(
        `ZKTeco K40 finger verified for ${res.log.employee_name} (${res.log.employee_code}) · Recorded ${res.punch_type} at ${res.punch_time} in Attendance Register.`
      );
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ZKTeco K40 finger scan failed');
      loadBioLogs();
    } finally {
      setScanningFinger(false);
    }
  };

  const handleStartRealtimeListener = async (deviceId: number) => {
    setError(null);
    setNotice(null);
    setTogglingListenerId(deviceId);
    try {
      const res = await api.post<{ ok: boolean; message: string }>(
        `/api/devices/${deviceId}/zkteco/realtime/start`
      );
      setNotice(res.message);
      await Promise.all([loadRealtimeListeners(), loadDevices(true)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start ZKTeco K40 TCP 4370 listener');
    } finally {
      setTogglingListenerId(null);
    }
  };

  const handleStopRealtimeListener = async (deviceId: number) => {
    setError(null);
    setTogglingListenerId(deviceId);
    try {
      await api.post(`/api/devices/${deviceId}/zkteco/realtime/stop`);
      setNotice('Stopped ZKTeco K40 real-time TCP 4370 stream.');
      await loadRealtimeListeners();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop real-time listener');
    } finally {
      setTogglingListenerId(null);
    }
  };

  const handleDownloadBridgeScript = async (deviceId?: number) => {
    setError(null);
    try {
      const url = `/api/devices/zkteco/bridge-script${deviceId ? `?device_id=${deviceId}` : ''}`;
      await downloadFile(url, 'zkteco-k40-readonly-connector.mjs');
      setNotice('Downloaded zkteco-k40-readonly-connector.mjs (Strict Read-Only). Run "node zkteco-k40-readonly-connector.mjs" on any PC in your factory LAN.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download ZKTeco K40 Read-Only LAN connector script');
    }
  };

  const handleAskK40RemoteEnroll = async () => {
    const empId = zkEnrollForm.employee_id.trim();
    if (!empId) {
      setError('Select or enter a Staff Employee ID before requesting a real finger on ZKTeco K40.');
      return;
    }
    setError(null);
    setNotice(null);
    setWaitingK40Enroll(true);
    try {
      const fingerObj = FINGER_OPTIONS.find((f) => String(f.index) === zkEnrollForm.finger_index);
      const res = await api.post<{ job: ZkEnrollJobRecord; tcp_triggered: boolean }>(
        '/api/devices/zkteco/fingerprints/remote-enroll',
        {
          employee_id: empId,
          zk_user_pin: zkEnrollForm.zk_user_pin.trim() || undefined,
          finger_index: Number(zkEnrollForm.finger_index),
          finger_label: fingerObj ? fingerObj.label.replace(' (Recommended)', '') : 'Right Index',
          device_id: zkEnrollForm.device_id ? Number(zkEnrollForm.device_id) : undefined,
        }
      );
      setActiveEnrollJob(res.job);
      setNotice(res.job.status_message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ask ZKTeco K40 for finger enrollment');
    } finally {
      setWaitingK40Enroll(false);
    }
  };

  const handleCancelRemoteEnroll = async () => {
    if (!activeEnrollJob) return;
    try {
      await api.post(`/api/devices/zkteco/enroll-jobs/${activeEnrollJob.id}/cancel`);
      setActiveEnrollJob({ ...activeEnrollJob, status: 'Cancelled' });
      setNotice('Cancelled waiting on ZKTeco K40.');
    } catch {
      // ignore cancel failure
    }
  };

  const handleHardwareSensorEnroll = async () => {
    const empId = zkEnrollForm.employee_id.trim();
    if (!empId) {
      setError('Enter or select a Staff Employee ID first before scanning a finger on the hardware reader.');
      return;
    }
    setError(null);
    setNotice(null);
    setHwEnrolling(true);
    try {
      const emp = employees.find((e) => e.employee_id === empId);
      const fingerObj = FINGER_OPTIONS.find((f) => String(f.index) === zkEnrollForm.finger_index);
      const fingerLabel = fingerObj ? fingerObj.label.replace(' (Recommended)', '') : 'Right Index';
      const captured = await captureHardwareFingerprintCredential({
        employeeId: empId,
        employeeName: emp?.full_name || empId,
        fingerLabel,
      });
      const res = await api.post<{ fingerprint: StaffFingerprintRecord; message: string }>(
        '/api/devices/zkteco/fingerprints/hardware-register',
        {
          employee_id: empId,
          zk_user_pin: zkEnrollForm.zk_user_pin.trim() || undefined,
          finger_index: Number(zkEnrollForm.finger_index),
          finger_label: fingerLabel,
          device_id: zkEnrollForm.device_id ? Number(zkEnrollForm.device_id) : undefined,
          credential_id: captured.credentialId,
          public_key: captured.publicKey,
          device_label: captured.deviceLabel,
        }
      );
      setFingerprints((prev) => [
        res.fingerprint,
        ...prev.filter((fp) => fp.id !== res.fingerprint.id),
      ]);
      setZkScanForm((prev) => ({
        ...prev,
        fingerprint_id: String(res.fingerprint.id),
        employee_id: res.fingerprint.employee_id,
        zk_user_pin: res.fingerprint.zk_user_pin,
      }));
      setNotice(
        `Real hardware fingerprint enrolled for ${res.fingerprint.employee_name} (${res.fingerprint.employee_id}). ${res.message}`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Local hardware fingerprint sensor enrollment failed'
      );
    } finally {
      setHwEnrolling(false);
    }
  };

  const handleHardwareSensorScan = async () => {
    setError(null);
    setNotice(null);
    setHwScanning(true);
    try {
      const registeredCredentialIds = fingerprints
        .map((fp) => fp.credential_id)
        .filter((id): id is string => Boolean(id));
      const verified = await verifyHardwareFingerprintCredential({
        allowCredentialIds: registeredCredentialIds,
      });
      const res = await api.post<{
        log: BiometricAuthLogRecord;
        attendance: Record<string, unknown>;
        punch_time: string;
        punch_type: 'Check-In' | 'Check-Out';
      }>('/api/devices/zkteco/hardware-scan', {
        device_id: zkScanForm.device_id ? Number(zkScanForm.device_id) : undefined,
        credential_id: verified.credentialId,
        punch_type: zkScanForm.punch_type,
      });
      setBioLogs((prev) => [res.log, ...prev.filter((r) => r.id !== res.log.id)]);
      loadFingerprints();
      setNotice(
        `Real hardware finger verified for ${res.log.employee_name} (${res.log.employee_code}) · Recorded ${res.punch_type} at ${res.punch_time} in Attendance Register.`
      );
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hardware fingerprint attendance scan failed');
      loadBioLogs();
    } finally {
      setHwScanning(false);
    }
  };

  const handleMarkAttendanceFromLog = async (logId: number) => {
    setError(null);
    setNotice(null);
    setMarkingLogId(logId);
    try {
      const res = await api.post<{ log: BiometricAuthLogRecord; attendance: Record<string, unknown> }>(
        `/api/devices/biometric-logs/${logId}/mark-attendance`
      );
      setBioLogs((prev) => prev.map((r) => (r.id === logId ? res.log : r)));
      setNotice(
        `Linked biometric log #${logId} to Attendance Record #${res.log.attendance_record_id} for ${res.log.employee_name}.`
      );
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark attendance from biometric log');
    } finally {
      setMarkingLogId(null);
    }
  };

  const filteredBioLogs = useMemo(() => {
    const q = bioSearch.trim().toLowerCase();
    return bioLogs.filter((log) => {
      if (bioStatusFilter !== 'All' && log.status !== bioStatusFilter) return false;
      if (bioDeviceFilter !== 'All') {
        if (bioDeviceFilter === 'UNREGISTERED') {
          if (log.device_id !== null) return false;
        } else if (String(log.device_id || '') !== bioDeviceFilter) {
          return false;
        }
      }
      if (q) {
        const hay = `${log.employee_code} ${log.employee_name} ${log.department} ${log.device_identifier} ${log.device_name} ${log.auth_method} ${log.failure_reason}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [bioLogs, bioStatusFilter, bioDeviceFilter, bioSearch]);

  const bioStats = useMemo(() => {
    let success = 0;
    let failure = 0;
    let marked = 0;
    for (const l of bioLogs) {
      if (l.status === 'Success') success += 1;
      else failure += 1;
      if (l.attendance_marked) marked += 1;
    }
    return { total: bioLogs.length, success, failure, marked };
  }, [bioLogs]);

  const selectedDevice = useMemo(
    () => devices.find((d) => d.id === selectedDeviceId) || null,
    [devices, selectedDeviceId]
  );
  const selectedIsZktK40 = useMemo(() => isZktK40Device(selectedDevice), [selectedDevice]);
  const analyticsDevice = useMemo(
    () =>
      (selectedDevice && isZktK40Device(selectedDevice) ? selectedDevice : null) ||
      devices.find((d) => isZktK40Device(d)) ||
      selectedDevice ||
      devices[0] ||
      null,
    [devices, selectedDevice]
  );
  const analyticsDeviceIdRef = useRef<number | null>(null);

  useEffect(() => {
    analyticsDeviceIdRef.current = analyticsDevice?.id ?? null;
    if (analyticsDevice) {
      setThresholdInput(String(analyticsDevice.latency_threshold_ms || 150));
      loadTelemetry(analyticsDevice.id);
    } else {
      setTelemetry(null);
    }
  }, [analyticsDevice?.id]);

  const handleSaveLatencyThreshold = async (e?: React.FormEvent, overrideMs?: number) => {
    if (e) e.preventDefault();
    if (!analyticsDevice) return;
    const raw = overrideMs !== undefined ? overrideMs : Number(thresholdInput);
    if (!Number.isFinite(raw) || raw < 10 || raw > 10000) {
      setError('Latency threshold must be a number between 10ms and 10,000ms.');
      return;
    }
    const nextThreshold = Math.round(raw);
    setError(null);
    setNotice(null);
    setSavingThreshold(true);
    try {
      const updated = await api.patch<DeviceRecord>(`/api/devices/${analyticsDevice.id}/latency-threshold`, {
        latency_threshold_ms: nextThreshold,
      });
      setDevices((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setThresholdInput(String(updated.latency_threshold_ms || nextThreshold));
      await loadTelemetry(analyticsDevice.id, true);
      setNotice(
        `Latency threshold for ${updated.device_name} updated to ${updated.latency_threshold_ms || nextThreshold}ms. Chart breach highlighting refreshed.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save latency threshold');
    } finally {
      setSavingThreshold(false);
    }
  };

  const handleOpenRegisterBiometricModal = async (targetDev?: DeviceRecord | null) => {
    const dev = targetDev || selectedDevice;
    if (!dev || !isZktK40Device(dev)) return;
    setSelectedDeviceId(dev.id);
    setZkEnrollForm((prev) => ({ ...prev, device_id: String(dev.id) }));
    const activeEmp = employees.find((e) => e.status === 'Active') || employees[0];
    setModalBioForm({
      employee_id: zkEnrollForm.employee_id || activeEmp?.employee_id || '',
      zk_user_pin: zkEnrollForm.zk_user_pin || '',
      finger_index: zkEnrollForm.finger_index || '6',
      mode: 'k40',
    });
    setModalEnrollJob(null);
    setModalEnrolledFp(null);
    setRegisterBioModalOpen(true);
    setScannerStatus('connecting');
    setScannerDeviceProbeInfo(`${dev.device_name} (${dev.ip_address}:${dev.port} · ${dev.serial_number})`);
    setScannerStatusDetail(`Connecting to ZKTeco K40 terminal ${dev.device_name} at ${dev.ip_address}:${dev.port}...`);

    try {
      const probed = await api.post<DeviceRecord>(`/api/devices/${dev.id}/connect`);
      setDevices((prev) => prev.map((d) => (d.id === dev.id ? probed : d)));
      if (probed.status === 'Connected') {
        setScannerStatus('scanning');
        setScannerStatusDetail(
          `Connected to ${probed.device_name} (${probed.last_latency_ms ?? 0}ms). Select staff member below and initiate finger capture.`
        );
      } else {
        setScannerStatus('scanning');
        setScannerStatusDetail(
          `ADMS HTTP Push (/iclock/cdata?SN=${probed.serial_number}) & LAN Bridge standby active. Direct TCP probe returned: ${probed.last_message || 'Unreachable from cloud'}. Ready to queue biometric scan.`
        );
      }
    } catch (err) {
      setScannerStatus('error');
      setScannerStatusDetail(
        err instanceof Error ? err.message : `Failed to connect to ZKTeco K40 terminal ${dev.device_name}.`
      );
    }
  };

  const handleModalStartBiometricRegistration = async () => {
    const dev = selectedDevice;
    const empId = modalBioForm.employee_id.trim();
    if (!dev || !isZktK40Device(dev)) {
      setScannerStatus('error');
      setScannerStatusDetail('Select a ZKTeco K40 biometric terminal first.');
      return;
    }
    if (!empId) {
      setScannerStatus('error');
      setScannerStatusDetail('Enter or select a Staff Employee ID before scanning a fingerprint.');
      return;
    }

    const fingerObj = FINGER_OPTIONS.find((f) => String(f.index) === modalBioForm.finger_index);
    const fingerLabel = fingerObj ? fingerObj.label.replace(' (Recommended)', '') : 'Right Index';

    setScannerStatus('connecting');
    setModalEnrolledFp(null);
    setModalEnrollJob(null);
    setScannerStatusDetail(`Handshaking with ${dev.device_name} (${dev.ip_address}:${dev.port})...`);

    if (modalBioForm.mode === 'hardware') {
      try {
        const emp = employees.find((e) => e.employee_id === empId);
        setScannerStatus('scanning');
        setScannerStatusDetail(`Place staff finger on attached USB / Platform biometric reader for ${emp?.full_name || empId}...`);
        const captured = await captureHardwareFingerprintCredential({
          employeeId: empId,
          employeeName: emp?.full_name || empId,
          fingerLabel,
        });
        const res = await api.post<{ fingerprint: StaffFingerprintRecord; message: string }>(
          '/api/devices/zkteco/fingerprints/hardware-register',
          {
            employee_id: empId,
            zk_user_pin: modalBioForm.zk_user_pin.trim() || undefined,
            finger_index: Number(modalBioForm.finger_index),
            finger_label: fingerLabel,
            device_id: dev.id,
            credential_id: captured.credentialId,
            public_key: captured.publicKey,
            device_label: captured.deviceLabel,
          }
        );
        setFingerprints((prev) => [res.fingerprint, ...prev.filter((fp) => fp.id !== res.fingerprint.id)]);
        setModalEnrolledFp(res.fingerprint);
        setScannerStatus('success');
        setScannerStatusDetail(
          `Hardware biometric registered for ${res.fingerprint.employee_name} (${res.fingerprint.employee_id}, PIN ${res.fingerprint.zk_user_pin}).`
        );
      } catch (err) {
        setScannerStatus('error');
        setScannerStatusDetail(
          err instanceof Error ? err.message : 'Hardware biometric reader capture failed.'
        );
      }
      return;
    }

    try {
      const res = await api.post<{ job: ZkEnrollJobRecord; tcp_triggered: boolean }>(
        '/api/devices/zkteco/fingerprints/remote-enroll',
        {
          employee_id: empId,
          zk_user_pin: modalBioForm.zk_user_pin.trim() || undefined,
          finger_index: Number(modalBioForm.finger_index),
          finger_label: fingerLabel,
          device_id: dev.id,
        }
      );
      setModalEnrollJob(res.job);
      setScannerStatus('scanning');
      setScannerStatusDetail(
        res.job.status_message ||
          `Scanner Active — Ask ${res.job.employee_name} (PIN ${res.job.zk_user_pin}) to place finger on ZKTeco K40 (${res.job.channel}).`
      );
    } catch (err) {
      setScannerStatus('error');
      setScannerStatusDetail(
        err instanceof Error ? err.message : 'Failed to start ZKTeco K40 biometric enrollment.'
      );
    }
  };

  const handleModalCancelScan = async () => {
    if (modalEnrollJob && modalEnrollJob.status === 'WaitingFinger') {
      try {
        await api.post(`/api/devices/zkteco/enroll-jobs/${modalEnrollJob.id}/cancel`);
        setModalEnrollJob({ ...modalEnrollJob, status: 'Cancelled' });
      } catch {
        // ignore cancel error
      }
    }
    setScannerStatus('error');
    setScannerStatusDetail('Biometric registration scan cancelled by operator.');
  };

  const handleModalRecordCheckIn = async () => {
    if (!modalEnrolledFp) return;
    setModalCheckinBusy(true);
    try {
      const res = await api.post<{ punch_time: string; punch_type: string }>('/api/devices/zkteco/scan', {
        device_id: selectedDevice?.id,
        fingerprint_id: modalEnrolledFp.id,
        punch_type: 'Check-In',
      });
      setNotice(
        `Recorded ${res.punch_type} at ${res.punch_time} for ${modalEnrolledFp.employee_name} (${modalEnrolledFp.employee_id}).`
      );
      loadBioLogs();
      onRefreshDashboard();
    } catch (err) {
      setScannerStatus('error');
      setScannerStatusDetail(err instanceof Error ? err.message : 'Failed to record attendance check-in');
    } finally {
      setModalCheckinBusy(false);
    }
  };

  const connectedCount = devices.filter((d) => d.status === 'Connected').length;
  const totalPunches = devices.reduce((acc, d) => acc + (Number(d.punch_count) || 0), 0);

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Module Tab Navigation */}
      <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('connections')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'connections'
                ? 'bg-[#18243A] text-white shadow-sm'
                : 'text-[#172033] dark:text-slate-300 hover:bg-[#F8FAFC] dark:hover:bg-slate-800'
            }`}
          >
            <Cable className="w-3.5 h-3.5 text-[#087CEB]" />
            Device Connections Registry
            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/15 dark:bg-slate-700/60 tabular-nums">
              {devices.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('zkteco-k40');
              loadFingerprints();
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'zkteco-k40'
                ? 'bg-[#18243A] text-white shadow-sm'
                : 'text-[#172033] dark:text-slate-300 hover:bg-[#F8FAFC] dark:hover:bg-slate-800'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 text-[#087CEB]" />
            ZKTeco K40 Finger Enroll &amp; Scan
            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/15 dark:bg-slate-700/60 tabular-nums">
              {fingerprints.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('biometric-logs');
              loadBioLogs();
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'biometric-logs'
                ? 'bg-[#18243A] text-white shadow-sm'
                : 'text-[#172033] dark:text-slate-300 hover:bg-[#F8FAFC] dark:hover:bg-slate-800'
            }`}
          >
            <Fingerprint className="w-3.5 h-3.5 text-[#087CEB]" />
            {t('dev.k40.biometricLogsTab', 'Biometric Auth Logs')}
            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/15 dark:bg-slate-700/60 tabular-nums">
              {bioLogs.length}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Live WebSocket stream active" />
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('sync-logs');
              loadSyncLogs();
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'sync-logs'
                ? 'bg-[#18243A] text-white shadow-sm'
                : 'text-[#172033] dark:text-slate-300 hover:bg-[#F8FAFC] dark:hover:bg-slate-800'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-[#087CEB]" />
            {t('dev.k40.syncLogsTab', 'Device Sync Logs')}
            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/15 dark:bg-slate-700/60 tabular-nums">
              {syncLogs.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('unmatched-pins');
              loadUnmatchedUsers();
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'unmatched-pins'
                ? 'bg-[#18243A] text-white shadow-sm'
                : 'text-[#172033] dark:text-slate-300 hover:bg-[#F8FAFC] dark:hover:bg-slate-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            {t('dev.k40.unmatchedTab', 'Unmatched PINs')}
            <span
              className={`px-1.5 py-0.5 text-[10px] font-mono rounded tabular-nums ${
                unmatchedUsers.filter((u) => u.status === 'Pending').length > 0
                  ? 'bg-amber-500 text-white'
                  : 'bg-white/15 dark:bg-slate-700/60'
              }`}
            >
              {unmatchedUsers.filter((u) => u.status === 'Pending').length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 px-2">
          {lastLiveEventAt && (
            <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
              Live Sync · {lastLiveEventAt}
            </span>
          )}
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('attendance')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#087CEB] bg-[#EAF4FF] dark:bg-slate-800 hover:bg-[#DBEAFE] rounded-lg transition-colors whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Attendance Register
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="px-4 py-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-between gap-2">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="px-4 py-2.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg flex items-center justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {activeTab === 'connections' && (
        <>
      <div className="px-4 py-3 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-200">
        <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold uppercase tracking-wide">Strict Read-Only Protection Active: </span>
          <span>{t('dev.k40.readOnlyBanner', 'STRICT READ-ONLY MODE: Existing K40 fingerprint templates, users, and device logs are permanently protected. No delete, clear, overwrite, or enrollment commands are sent during sync.')}</span>
        </div>
      </div>

      <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-bold text-[#172033] dark:text-white">{t('dev.k40.title', 'ZKTeco K40 Read-Only Device Integration')}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Manage real TCP/IP sockets (port 4370), CommKey authentication, 2–5s auto-polling, ADMS push terminals, and downloadable LAN connectors.{' '}
              <span className="font-mono font-semibold text-[#172033] dark:text-slate-200 tabular-nums">
                {connectedCount}/{devices.length} online · {totalPunches} punches synced
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedIsZktK40 && selectedDevice && (
              <button
                type="button"
                onClick={() => handleOpenRegisterBiometricModal(selectedDevice)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0"
              >
                <Fingerprint className="w-4 h-4" />
                Register New Biometric
              </button>
            )}
            <button
              type="button"
              disabled={probingAll || devices.length === 0}
              onClick={handleProbeAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {probingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
              Probe All Connections
            </button>
            <button
              type="button"
              onClick={() => setScanPanelOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                scanPanelOpen
                  ? 'bg-[#18243A] text-white border-[#18243A]'
                  : 'bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-[#087CEB]'
              }`}
            >
              <Radar className="w-3.5 h-3.5 text-[#087CEB]" />
              Scan Network IP/Ports
            </button>
            <button
              type="button"
              onClick={handleLoadZktecoK40Preset}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#087CEB] bg-[#EAF4FF] dark:bg-sky-950/60 border border-[#087CEB]/30 hover:bg-[#DBEAFE] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Fingerprint className="w-3.5 h-3.5" />
              ZKTeco K40 Preset
            </button>
            <button
              type="button"
              onClick={handleDiscoverLocalUsbSerial}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Usb className="w-3.5 h-3.5 text-[#087CEB]" />
              Local USB / Serial
            </button>
            <button
              type="button"
              onClick={() => loadDevices()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Selected ZKT K40 Action Bar */}
        {selectedDevice && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selectedIsZktK40 ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                {selectedIsZktK40 ? <Fingerprint className="w-4 h-4" /> : <Cable className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#172033] dark:text-white truncate">
                  Selected Device: {selectedDevice.device_name}
                  <span className="ml-2 font-mono text-[11px] font-normal text-slate-500 dark:text-slate-400">
                    {selectedDevice.ip_address}:{selectedDevice.port} · {selectedDevice.serial_number}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {selectedIsZktK40
                    ? 'ZKTeco K40 biometric terminal selected — click "Register New Biometric" to launch the live enrollment scanner.'
                    : 'Click any ZKTeco K40 / Biometric row below to enable live biometric registration.'}
                </div>
              </div>
            </div>
            {selectedIsZktK40 && (
              <button
                type="button"
                onClick={() => handleOpenRegisterBiometricModal(selectedDevice)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0"
              >
                <Fingerprint className="w-4 h-4" />
                Register New Biometric
              </button>
            )}
          </div>
        )}

        {/* Live Network / Subnet Scanner Panel */}
        {scanPanelOpen && (
          <div className="mb-5 p-4 bg-[#F8FAFC] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#172033] dark:text-white">
                  Live TCP / IP Subnet & Port Discovery Scanner
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Probes specified hosts or LAN subnet prefix across hardware ports (3000, 4370 ZKTeco, 80/8080 HTTP, 502 Modbus).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScanPanelOpen(false)}
                className="p-1 text-slate-400 hover:text-[#172033] dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRunScan} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">
                  Target Host IPs (Comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="127.0.0.1, 192.168.10.50"
                  value={scanHosts}
                  onChange={(e) => setScanHosts(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">
                  Or Subnet Prefix (if Hosts empty)
                </label>
                <input
                  type="text"
                  placeholder="192.168.10"
                  value={scanSubnetPrefix}
                  onChange={(e) => setScanSubnetPrefix(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">
                  Ports to Probe
                </label>
                <input
                  type="text"
                  placeholder="3000,4370,80,8080"
                  value={scanPorts}
                  onChange={(e) => setScanPorts(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={scanning}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#18243A] hover:bg-[#172033] disabled:opacity-60 rounded-lg whitespace-nowrap"
                >
                  {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#087CEB]" /> : <Radar className="w-3.5 h-3.5 text-[#087CEB]" />}
                  {scanning ? 'Scanning...' : 'Run Live Scan'}
                </button>
              </div>
            </form>

            {lastScanCount !== null && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                <div className="text-xs font-semibold text-[#172033] dark:text-slate-200">
                  Scan Results ({scanResults.length} reachable of {lastScanCount} probed)
                </div>
                {scanResults.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No open TCP ports responded in this range. Include 127.0.0.1 with port 3000 to verify the active local gateway.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {scanResults.map((hit, idx) => (
                      <div
                        key={`${hit.ip_address}-${hit.port}-${idx}`}
                        className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-mono font-bold text-[#172033] dark:text-white tabular-nums">
                            {hit.ip_address}:{hit.port} · {hit.latencyMs}ms
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{hit.suggested_type}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickRegisterScan(hit)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          1-Click Register
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleAddDevice} className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Device Type</label>
            <select
              value={form.device_type}
              onChange={(e) => setForm({ ...form, device_type: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
            >
              {DEVICE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Connection Protocol</label>
            <select
              value={form.protocol}
              onChange={(e) => setForm({ ...form, protocol: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
            >
              {PROTOCOL_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Device Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Gate 2 Fingerprint"
              value={form.device_name}
              onChange={(e) => setForm({ ...form, device_name: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">IP Address / Host</label>
            <input
              type="text"
              required
              placeholder="192.168.10.105"
              value={form.ip_address}
              onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Port</label>
            <input
              type="number"
              required
              min={1}
              max={65535}
              placeholder="4370"
              value={form.port}
              onChange={(e) => setForm({ ...form, port: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">
              HTTP/REST Health URL (Optional)
            </label>
            <input
              type="text"
              placeholder="http://127.0.0.1:3000/api/health"
              value={form.endpoint_url}
              onChange={(e) => setForm({ ...form, endpoint_url: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Subnet / Gateway</label>
            <input
              type="text"
              required
              placeholder="255.255.255.0"
              value={form.subnet_mask}
              onChange={(e) => setForm({ ...form, subnet_mask: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Serial Number</label>
            <input
              type="text"
              required
              placeholder="SN-2026-99012"
              value={form.serial_number}
              onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Device Model</label>
            <input
              type="text"
              placeholder="ZKTeco K40"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">
              {t('dev.k40.commKey', 'CommKey Password')} {form.has_comm_password && !form.comm_password ? '(Saved · Encrypted)' : ''}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              placeholder={form.has_comm_password ? '•••••••• (unchanged)' : '0 / Optional CommKey'}
              value={form.comm_password}
              onChange={(e) => setForm({ ...form, comm_password: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">
              {t('dev.k40.autoSync', 'Auto-Poll Interval (2–5s)')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={2}
                max={60}
                value={form.sync_interval_sec}
                onChange={(e) => setForm({ ...form, sync_interval_sec: e.target.value })}
                className="w-20 px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
              />
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#172033] dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.auto_sync_enabled}
                  onChange={(e) => setForm({ ...form, auto_sync_enabled: e.target.checked })}
                  className="rounded border-slate-300 text-[#087CEB]"
                />
                Auto-Sync
              </label>
            </div>
          </div>

          <div className="flex items-end gap-2 md:col-span-2">
            {editingId !== null && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
                className="px-3 py-2 text-sm font-semibold text-[#172033] bg-slate-100 hover:bg-slate-200 rounded-lg"
                title="Cancel Edit"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg transition-colors whitespace-nowrap"
            >
              <Save className="w-4 h-4" />
              {editingId !== null ? 'Save Connection' : 'Save & Add Connection'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#18243A] text-white text-xs font-semibold">
                <th className="py-3 px-4">Device Connection / Protocol</th>
                <th className="py-3 px-4">Endpoint & IP : Port</th>
                <th className="py-3 px-4">Serial & API Key</th>
                <th className="py-3 px-4">Connection State & Sync</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    Loading registered device connections...
                  </td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    No device connections configured yet. Register your hardware or run a subnet scan above.
                  </td>
                </tr>
              ) : (
                devices.map((dev) => {
                  const isSelected = selectedDeviceId === dev.id;
                  const k40Capable = isZktK40Device(dev);
                  return (
                  <tr
                    key={dev.id}
                    onClick={() => {
                      setSelectedDeviceId(dev.id);
                      if (k40Capable) {
                        setZkEnrollForm((prev) => ({ ...prev, device_id: String(dev.id) }));
                        setZkScanForm((prev) => ({ ...prev, device_id: String(dev.id) }));
                      }
                    }}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#EAF4FF]/80 dark:bg-sky-950/40 ring-1 ring-inset ring-[#087CEB]/50'
                        : 'hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[#172033] dark:text-white">{dev.device_name}</span>
                        {isSelected && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-[#087CEB] text-white rounded">
                            Selected
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded">
                          <Lock className="w-2.5 h-2.5" />
                          READ-ONLY
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {dev.model ? `${dev.model} · ` : ''}{dev.device_type} · <span className="font-semibold text-[#087CEB]">{dev.protocol || 'TCP/IP Socket'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-[#172033] dark:text-slate-200 tabular-nums">
                      <div>
                        {dev.ip_address}:{dev.port}
                      </div>
                      {dev.endpoint_url ? (
                        <div className="text-[11px] text-[#087CEB] truncate max-w-[230px]" title={dev.endpoint_url}>
                          {dev.endpoint_url}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400">
                          {dev.subnet_mask} · GW {dev.gateway}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums">
                      <div>{dev.serial_number}</div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 flex-wrap">
                        {dev.has_comm_password && <span className="text-emerald-700 dark:text-emerald-400 font-semibold">CommKey Set</span>}
                        {dev.api_key && <span>Key: {dev.api_key}</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-xs font-semibold ${
                            dev.status === 'Connected'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : dev.status === 'Unreachable'
                              ? 'text-red-700 dark:text-red-400'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {dev.status}
                        </span>
                        {dev.last_latency_ms !== null && (
                          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                            · {dev.last_latency_ms}ms
                          </span>
                        )}
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                          · {dev.total_imported_count ?? dev.punch_count ?? 0} synced
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleAutoSync(dev);
                          }}
                          className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded ${
                            dev.auto_sync_enabled
                              ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                          }`}
                          title="Toggle Read-Only Auto-Polling"
                        >
                          {dev.auto_sync_enabled ? `Auto ${dev.sync_interval_sec || 3}s` : 'Auto Off'}
                        </button>
                      </div>
                      {dev.last_sync_at && (
                        <div className="text-[10px] font-mono text-slate-500">
                          Last Sync: {formatLogTimestamp(dev.last_sync_at).time}
                        </div>
                      )}
                      {k40Capable && (dev.k40_fp_count !== null && dev.k40_fp_count !== undefined) && (
                        <div className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400">
                          K40 Memory (Read-Only): {dev.k40_user_count ?? 0} users · {dev.k40_fp_count} FPs unchanged · {dev.k40_attlog_count ?? 0} logs
                        </div>
                      )}
                      {(dev.last_error || dev.last_message) && (
                        <div
                          className={`text-xs truncate max-w-[260px] ${
                            dev.last_error ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
                          }`}
                          title={dev.last_error || dev.last_message}
                        >
                          {dev.last_error || dev.last_message}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {isZktK40Device(dev) && selectedDeviceId === dev.id && (
                          <button
                            type="button"
                            onClick={() => handleOpenRegisterBiometricModal(dev)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                          >
                            <Fingerprint className="w-3.5 h-3.5" />
                            Register New Biometric
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={connectingId === dev.id}
                          onClick={() => handleConnect(dev.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
                        >
                          {connectingId === dev.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Cable className="w-3.5 h-3.5" />
                          )}
                          Connect
                        </button>
                        {k40Capable && (
                          <>
                            <button
                              type="button"
                              disabled={testingConnId === dev.id}
                              onClick={() => handleTestK40Connection(dev)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#087CEB] bg-[#EAF4FF] dark:bg-sky-950/60 hover:bg-[#DBEAFE] border border-[#087CEB]/30 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
                              title="Test TCP 4370 Connection"
                            >
                              {testingConnId === dev.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Activity className="w-3.5 h-3.5" />
                              )}
                              {t('dev.k40.testConn', 'Test Connection')}
                            </button>
                            <button
                              type="button"
                              disabled={syncingNowId === dev.id}
                              onClick={() => handleSyncNowK40(dev)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
                              title="Read-Only Attendance Pull (never modifies K40 fingerprints or logs)"
                            >
                              {syncingNowId === dev.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3.5 h-3.5" />
                              )}
                              {t('dev.k40.syncNow', 'Read-Only Sync')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadBridgeScript(dev.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#18243A] dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                              title="Download Local Read-Only LAN Connector"
                            >
                              <Download className="w-3.5 h-3.5 text-[#087CEB]" />
                              LAN Connector
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => setPunchModalDevice(dev)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#18243A] dark:text-white bg-[#EAF4FF] dark:bg-slate-800 hover:bg-[#DBEAFE] border border-[#087CEB]/30 rounded-lg transition-colors whitespace-nowrap shrink-0"
                          title="Sync Punch / Live Webhook Endpoint"
                        >
                          <Webhook className="w-3.5 h-3.5 text-[#087CEB]" />
                          Webhook
                        </button>
                        {dev.status === 'Connected' && (
                          <button
                            type="button"
                            onClick={() => handleDisconnect(dev.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#172033] dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                            title="Disconnect"
                          >
                            <Unplug className="w-3.5 h-3.5" />
                            Disconnect
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(dev.id);
                            setForm({
                              device_type: dev.device_type,
                              model: dev.model || 'ZKTeco K40',
                              protocol: dev.protocol || PROTOCOL_OPTIONS[0],
                              device_name: dev.device_name,
                              ip_address: dev.ip_address,
                              port: String(dev.port),
                              endpoint_url: dev.endpoint_url || '',
                              subnet_mask: dev.subnet_mask,
                              gateway: dev.gateway,
                              serial_number: dev.serial_number,
                              api_key: dev.api_key || '',
                              comm_password: '',
                              sync_interval_sec: String(dev.sync_interval_sec || 3),
                              auto_sync_enabled: Boolean(dev.auto_sync_enabled ?? true),
                              latency_threshold_ms: String(dev.latency_threshold_ms || 150),
                              has_comm_password: Boolean(dev.has_comm_password),
                            });
                          }}
                          className="p-1.5 text-[#172033] dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
                          title="Edit Device Connection"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(dev.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
                          title="Delete Device Connection"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 30-Day ZKTeco K40 Connectivity Latency & Downtime Frequency Analytics + Latency Threshold Config */}
      <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-[#172033] dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#087CEB]" />
              ZKTeco K40 Hardware Performance · 30-Day Connectivity Latency &amp; Downtime
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Real probe &amp; sync telemetry recorded from TCP 4370 handshakes, background auto-polling, and LAN connector heartbeats. Periods exceeding your threshold are highlighted in red.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {devices.length > 0 && (
              <select
                value={analyticsDevice ? String(analyticsDevice.id) : ''}
                onChange={(e) => setSelectedDeviceId(Number(e.target.value))}
                className="px-3 py-1.5 text-xs font-semibold bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
                aria-label="Select device for 30-day latency telemetry"
              >
                {devices.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.device_name} ({d.ip_address}:{d.port})
                  </option>
                ))}
              </select>
            )}

            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 p-0.5">
              <button
                type="button"
                onClick={() => setTelemetryChartView('daily')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors ${
                  telemetryChartView === 'daily'
                    ? 'bg-[#18243A] text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-[#172033]'
                }`}
              >
                30-Day Trend
              </button>
              <button
                type="button"
                onClick={() => setTelemetryChartView('probes')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors ${
                  telemetryChartView === 'probes'
                    ? 'bg-[#18243A] text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-[#172033]'
                }`}
              >
                Live Probes ({telemetry?.recent_checks?.length ?? 0})
              </button>
            </div>

            {analyticsDevice && (
              <>
                <button
                  type="button"
                  disabled={connectingId === analyticsDevice.id}
                  onClick={() => handleConnect(analyticsDevice.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-60 rounded-lg whitespace-nowrap"
                >
                  {connectingId === analyticsDevice.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Activity className="w-3.5 h-3.5" />
                  )}
                  Probe Latency Now
                </button>
                <button
                  type="button"
                  disabled={telemetryLoading}
                  onClick={() => loadTelemetry(analyticsDevice.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${telemetryLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </>
            )}
          </div>
        </div>

        {!analyticsDevice ? (
          <div className="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/40 text-center space-y-2">
            <p className="text-xs font-semibold text-[#172033] dark:text-slate-200">
              No ZKTeco K40 hardware terminal registered yet.
            </p>
            <p className="text-xs text-slate-500">
              Load the ZKTeco K40 Preset or register your terminal above to configure latency thresholds and track real 30-day connectivity latency &amp; downtime.
            </p>
          </div>
        ) : (
          <>
            {/* Latency Threshold Configuration Bar */}
            <form
              onSubmit={(e) => handleSaveLatencyThreshold(e)}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#EAF4FF] dark:bg-sky-950/70 text-[#087CEB] flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#172033] dark:text-white">
                    Latency Threshold Alert Limit · {analyticsDevice.device_name}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Active ceiling:{' '}
                    <span className="font-mono font-bold text-red-600 dark:text-red-400">
                      {telemetry?.threshold_ms ?? analyticsDevice.latency_threshold_ms ?? 150}ms
                    </span>
                    . Chart periods exceeding this limit are shaded red and listed below.
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  {[50, 100, 150, 300, 500].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={savingThreshold}
                      onClick={() => {
                        setThresholdInput(String(preset));
                        void handleSaveLatencyThreshold(undefined, preset);
                      }}
                      className={`px-2 py-1 text-[11px] font-mono font-bold rounded border transition-colors ${
                        Number(thresholdInput) === preset
                          ? 'bg-[#18243A] text-white border-[#18243A]'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-[#087CEB]'
                      }`}
                    >
                      {preset}ms
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={10}
                    max={10000}
                    step={5}
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(e.target.value)}
                    aria-label="Latency threshold in milliseconds"
                    className="w-24 px-2.5 py-1.5 text-xs font-mono font-bold bg-white dark:bg-slate-900 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
                  />
                  <span className="text-xs font-mono text-slate-500">ms</span>
                  <button
                    type="submit"
                    disabled={savingThreshold}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#18243A] hover:bg-[#172033] disabled:opacity-60 rounded-lg whitespace-nowrap"
                  >
                    {savingThreshold ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-[#38BDF8]" />}
                    Save Threshold
                  </button>
                </div>
              </div>
            </form>

            {/* 30-Day Telemetry KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/40">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  30-Day Avg Latency
                </div>
                <div className="mt-1 text-xl font-extrabold font-mono text-[#172033] dark:text-white tabular-nums">
                  {telemetry?.summary.avg_latency_ms !== null && telemetry?.summary.avg_latency_ms !== undefined
                    ? `${telemetry.summary.avg_latency_ms}ms`
                    : '--'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                  {telemetry?.summary.online_checks ?? 0} online check(s)
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/40">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Peak Latency (30d)
                </div>
                <div
                  className={`mt-1 text-xl font-extrabold font-mono tabular-nums ${
                    telemetry?.summary.peak_latency_ms !== null &&
                    telemetry?.summary.peak_latency_ms !== undefined &&
                    telemetry.summary.peak_latency_ms > (telemetry.threshold_ms || 150)
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-[#087CEB]'
                  }`}
                >
                  {telemetry?.summary.peak_latency_ms !== null && telemetry?.summary.peak_latency_ms !== undefined
                    ? `${telemetry.summary.peak_latency_ms}ms`
                    : '--'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                  Min:{' '}
                  {telemetry?.summary.min_latency_ms !== null && telemetry?.summary.min_latency_ms !== undefined
                    ? `${telemetry.summary.min_latency_ms}ms`
                    : '--'}
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/40">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Downtime Frequency
                </div>
                <div className="mt-1 text-xl font-extrabold font-mono text-amber-700 dark:text-amber-400 tabular-nums">
                  {telemetry?.summary.downtime_events ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                  Uptime:{' '}
                  {telemetry?.summary.uptime_pct !== null && telemetry?.summary.uptime_pct !== undefined
                    ? `${telemetry.summary.uptime_pct}%`
                    : '--'}
                </div>
              </div>

              <div
                className={`p-3.5 rounded-xl border ${
                  (telemetry?.summary.threshold_breach_count ?? 0) > 0
                    ? 'border-red-300 dark:border-red-800 bg-red-50/70 dark:bg-red-950/30'
                    : 'border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/40'
                }`}
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider text-red-700 dark:text-red-400">
                  Threshold Breaches (&gt;{telemetry?.threshold_ms ?? 150}ms)
                </div>
                <div className="mt-1 text-xl font-extrabold font-mono text-red-700 dark:text-red-400 tabular-nums">
                  {telemetry?.summary.threshold_breach_count ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                  Across {telemetry?.summary.exceeded_days_count ?? 0} day(s) in last 30d
                </div>
              </div>
            </div>

            {/* Recharts Connectivity Latency & Downtime Chart */}
            {telemetryLoading && !telemetry ? (
              <div className="h-[320px] flex items-center justify-center text-xs text-slate-500 border border-slate-200 dark:border-slate-800 rounded-xl">
                <Loader2 className="w-4 h-4 animate-spin mr-2 text-[#087CEB]" />
                Loading 30-day hardware latency &amp; downtime telemetry...
              </div>
            ) : !telemetry || telemetry.summary.total_checks === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/40 text-center space-y-2">
                <WifiOff className="w-6 h-6 text-slate-400 mx-auto" />
                <div className="text-xs font-bold text-[#172033] dark:text-white">
                  No real connectivity samples recorded yet for {analyticsDevice.device_name}
                </div>
                <p className="text-xs text-slate-500 max-w-lg mx-auto">
                  Click <span className="font-semibold text-[#087CEB]">Probe Latency Now</span>, run{' '}
                  <span className="font-semibold">Test Connection</span>, or enable <span className="font-semibold">Auto-Sync</span> to capture live TCP 4370 latency and downtime telemetry.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-full h-[320px] pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    {telemetryChartView === 'daily' ? (
                      <ComposedChart
                        data={telemetry.daily}
                        margin={{ top: 14, right: 20, left: 4, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.45} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          minTickGap={18}
                        />
                        <YAxis
                          yAxisId="latency"
                          unit="ms"
                          tick={{ fontSize: 11, fill: '#087CEB' }}
                          domain={[
                            0,
                            (dataMax: number) =>
                              Math.max(
                                Math.ceil((telemetry.threshold_ms || 150) * 1.25),
                                Math.ceil((Number.isFinite(dataMax) ? dataMax : 100) * 1.15)
                              ),
                          ]}
                        />
                        <YAxis
                          yAxisId="downtime"
                          orientation="right"
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: '#d97706' }}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const row = payload[0]?.payload as (typeof telemetry.daily)[number] | undefined;
                            if (!row) return null;
                            return (
                              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 shadow-lg text-xs space-y-1">
                                <div className="font-bold text-[#172033] dark:text-white flex items-center justify-between gap-4">
                                  <span>
                                    {row.label} ({row.date})
                                  </span>
                                  {row.exceeds_threshold && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 rounded">
                                      THRESHOLD EXCEEDED
                                    </span>
                                  )}
                                </div>
                                <div className="font-mono text-[#087CEB]">
                                  Avg Latency: {row.avg_latency_ms !== null ? `${row.avg_latency_ms}ms` : 'No online probe'}
                                </div>
                                <div className="font-mono text-red-600">
                                  Peak Latency: {row.max_latency_ms !== null ? `${row.max_latency_ms}ms` : '--'}
                                  {row.exceeds_threshold && row.max_latency_ms !== null
                                    ? ` (+${row.max_latency_ms - telemetry.threshold_ms}ms over ${telemetry.threshold_ms}ms)`
                                    : ''}
                                </div>
                                <div className="font-mono text-amber-600">
                                  Downtime Events: {row.downtime_count} · Checks: {row.checks_count}
                                </div>
                                {row.uptime_pct !== null && (
                                  <div className="font-mono text-emerald-600">Uptime: {row.uptime_pct}%</div>
                                )}
                              </div>
                            );
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />

                        {/* Highlight daily periods where latency exceeded configured threshold */}
                        {telemetry.daily.map((d) =>
                          d.exceeds_threshold ? (
                            <ReferenceArea
                              key={`breach-band-${d.date}`}
                              yAxisId="latency"
                              x1={d.label}
                              x2={d.label}
                              fill="#ef4444"
                              fillOpacity={0.18}
                              stroke="#ef4444"
                              strokeOpacity={0.35}
                            />
                          ) : null
                        )}

                        <ReferenceLine
                          yAxisId="latency"
                          y={telemetry.threshold_ms}
                          stroke="#dc2626"
                          strokeDasharray="6 4"
                          strokeWidth={2}
                          label={{
                            value: `Limit: ${telemetry.threshold_ms}ms`,
                            position: 'insideTopRight',
                            fill: '#dc2626',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        />

                        <Bar
                          yAxisId="downtime"
                          dataKey="downtime_count"
                          name="Downtime Frequency"
                          fill="#f59e0b"
                          barSize={14}
                          radius={[4, 4, 0, 0]}
                        />

                        <Line
                          yAxisId="latency"
                          type="monotone"
                          dataKey="avg_latency_ms"
                          name="Avg Latency (ms)"
                          stroke="#087CEB"
                          strokeWidth={2.5}
                          connectNulls
                          dot={(dotProps) => {
                            const { cx, cy, payload, index } = dotProps;
                            if (typeof cx !== 'number' || typeof cy !== 'number') return <g key={`empty-${index}`} />;
                            const exceeded = Boolean(payload?.exceeds_threshold);
                            return (
                              <circle
                                key={`avg-dot-${index}`}
                                cx={cx}
                                cy={cy}
                                r={exceeded ? 5.5 : 3.5}
                                fill={exceeded ? '#dc2626' : '#087CEB'}
                                stroke="#ffffff"
                                strokeWidth={1.5}
                              />
                            );
                          }}
                          activeDot={{ r: 6 }}
                        />

                        <Line
                          yAxisId="latency"
                          type="monotone"
                          dataKey="max_latency_ms"
                          name="Peak Latency (ms)"
                          stroke="#ef4444"
                          strokeWidth={1.75}
                          strokeDasharray="4 3"
                          connectNulls
                          dot={(dotProps) => {
                            const { cx, cy, payload, index } = dotProps;
                            if (typeof cx !== 'number' || typeof cy !== 'number') return <g key={`empty-p-${index}`} />;
                            const exceeded =
                              payload?.max_latency_ms !== null &&
                              payload?.max_latency_ms !== undefined &&
                              Number(payload.max_latency_ms) > telemetry.threshold_ms;
                            if (!exceeded) return <g key={`normal-p-${index}`} />;
                            return (
                              <circle
                                key={`peak-dot-${index}`}
                                cx={cx}
                                cy={cy}
                                r={5}
                                fill="#ef4444"
                                stroke="#ffffff"
                                strokeWidth={1.5}
                              />
                            );
                          }}
                        />
                      </ComposedChart>
                    ) : (
                      <ComposedChart
                        data={telemetry.recent_checks.map((c, idx) => ({
                          ...c,
                          indexLabel: `${formatLogTimestamp(c.checked_at).time} (#${idx + 1})`,
                          shortTime: formatLogTimestamp(c.checked_at).time,
                          downtime_flag: c.status === 'Offline' ? 1 : 0,
                          online_latency: c.status === 'Online' ? c.latency_ms : null,
                        }))}
                        margin={{ top: 14, right: 20, left: 4, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.45} />
                        <XAxis
                          dataKey="shortTime"
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          minTickGap={16}
                        />
                        <YAxis
                          yAxisId="latency"
                          unit="ms"
                          tick={{ fontSize: 11, fill: '#087CEB' }}
                          domain={[
                            0,
                            (dataMax: number) =>
                              Math.max(
                                Math.ceil((telemetry.threshold_ms || 150) * 1.25),
                                Math.ceil((Number.isFinite(dataMax) ? dataMax : 100) * 1.15)
                              ),
                          ]}
                        />
                        <YAxis
                          yAxisId="downtime"
                          orientation="right"
                          allowDecimals={false}
                          domain={[0, 1]}
                          tick={{ fontSize: 11, fill: '#d97706' }}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const row = payload[0]?.payload as
                              | (typeof telemetry.recent_checks)[number] & { shortTime: string }
                              | undefined;
                            if (!row) return null;
                            return (
                              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 shadow-lg text-xs space-y-1">
                                <div className="font-bold text-[#172033] dark:text-white flex items-center justify-between gap-3">
                                  <span>
                                    {formatLogTimestamp(row.checked_at).date} {row.shortTime}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                      row.status === 'Offline'
                                        ? 'bg-amber-100 text-amber-800'
                                        : row.exceeded_threshold
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    {row.status === 'Offline'
                                      ? 'OFFLINE'
                                      : row.exceeded_threshold
                                      ? 'EXCEEDED LIMIT'
                                      : 'OK'}
                                  </span>
                                </div>
                                <div className="font-mono text-[#087CEB]">Latency: {row.latency_ms}ms</div>
                                <div className="text-slate-500">Source: {row.source}</div>
                                {row.error_message && (
                                  <div className="text-red-600 max-w-[240px] break-words">{row.error_message}</div>
                                )}
                              </div>
                            );
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />

                        <ReferenceLine
                          yAxisId="latency"
                          y={telemetry.threshold_ms}
                          stroke="#dc2626"
                          strokeDasharray="6 4"
                          strokeWidth={2}
                          label={{
                            value: `Limit: ${telemetry.threshold_ms}ms`,
                            position: 'insideTopRight',
                            fill: '#dc2626',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        />

                        <Bar
                          yAxisId="downtime"
                          dataKey="downtime_flag"
                          name="Downtime Event"
                          fill="#f59e0b"
                          barSize={10}
                          radius={[3, 3, 0, 0]}
                        />

                        <Line
                          yAxisId="latency"
                          type="monotone"
                          dataKey="online_latency"
                          name="Probe Latency (ms)"
                          stroke="#087CEB"
                          strokeWidth={2}
                          connectNulls
                          dot={(dotProps) => {
                            const { cx, cy, payload, index } = dotProps;
                            if (typeof cx !== 'number' || typeof cy !== 'number') return <g key={`empty-r-${index}`} />;
                            const exceeded = Boolean(payload?.exceeded_threshold);
                            return (
                              <circle
                                key={`probe-dot-${index}`}
                                cx={cx}
                                cy={cy}
                                r={exceeded ? 5.5 : 3.5}
                                fill={exceeded ? '#dc2626' : '#087CEB'}
                                stroke="#ffffff"
                                strokeWidth={1.5}
                              />
                            );
                          }}
                        />
                      </ComposedChart>
                    )}
                  </ResponsiveContainer>
                </div>

                {/* Highlighted Threshold Exceeded Periods List */}
                {telemetry.exceeded_periods.length > 0 ? (
                  <div className="p-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50/70 dark:bg-red-950/30 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-red-800 dark:text-red-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        Periods Exceeding {telemetry.threshold_ms}ms Latency Threshold ({telemetry.exceeded_periods.length})
                      </div>
                      <span className="text-[11px] font-mono text-red-700 dark:text-red-400">
                        Total Breaches: {telemetry.summary.threshold_breach_count}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {telemetry.exceeded_periods.map((ep) => (
                        <div
                          key={ep.date}
                          className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800/70 flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <div className="font-bold text-[#172033] dark:text-white">
                              {ep.label}{' '}
                              <span className="font-mono font-normal text-slate-500">({ep.date})</span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              Avg: {ep.avg_latency_ms !== null ? `${ep.avg_latency_ms}ms` : '--'} · {ep.exceeded_count} breach(es)
                            </div>
                          </div>
                          <div className="text-right font-mono shrink-0">
                            <div className="font-extrabold text-red-600 dark:text-red-400">
                              {ep.peak_latency_ms}ms
                            </div>
                            <div className="text-[10px] font-bold text-red-700 dark:text-red-300">
                              +{ep.over_by_ms}ms over
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      All {telemetry.summary.online_checks} recorded online check(s) in the last 30 days remained within the{' '}
                      <span className="font-mono font-bold">{telemetry.threshold_ms}ms</span> latency threshold.
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <Power className="w-4 h-4 text-[#087CEB] shrink-0" />
          <span>
            Live endpoints: ZKTeco ADMS push URL{' '}
            <span className="font-mono font-semibold text-[#172033] dark:text-white">/api/iclock/cdata?SN=SERIAL</span> · Localhost TCP{' '}
            <span className="font-mono font-semibold text-[#172033] dark:text-white">127.0.0.1:3000</span> verifies immediate live handshake.
          </span>
        </div>
      </div>
        </>
      )}

      {activeTab === 'zkteco-k40' && (
        <div className="space-y-6">
          {/* ZKTeco K40 Connection & Push Guide */}
          <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#172033] dark:text-white flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-[#087CEB]" />
                ZKTeco K40 Read-Only Terminal Sync &amp; Real-Time Attendance Stream
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connects strictly READ-ONLY via TCP port <span className="font-mono font-bold text-[#172033] dark:text-slate-200">4370</span> (<span className="font-mono">CMD_ATTLOG_RRQ</span> + <span className="font-mono">CMD_USER_RRQ</span> + <span className="font-mono">CMD_GET_FREE_SIZES</span> + <span className="font-mono">CMD_REG_EVENT</span>), ZKTeco ADMS HTTP Push at{' '}
                <span className="font-mono font-bold text-[#087CEB]">/iclock/cdata?SN=SERIAL</span>, and the Read-Only LAN Connector. Existing K40 fingerprint templates are never written, altered, or deleted.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {selectedIsZktK40 && selectedDevice && (
                <button
                  type="button"
                  onClick={() => handleOpenRegisterBiometricModal(selectedDevice)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg whitespace-nowrap"
                >
                  <Fingerprint className="w-4 h-4" />
                  Register New Biometric
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  handleDownloadBridgeScript(
                    zkEnrollForm.device_id ? Number(zkEnrollForm.device_id) : undefined
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#087CEB] bg-[#EAF4FF] dark:bg-sky-950/60 border border-[#087CEB]/30 hover:bg-[#DBEAFE] rounded-lg whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Download Read-Only LAN Connector
              </button>
              <button
                type="button"
                onClick={() => {
                  loadFingerprints();
                  loadRealtimeListeners();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Status
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('biometric-logs');
                  loadBioLogs();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#18243A] hover:bg-[#172033] rounded-lg whitespace-nowrap"
              >
                <Activity className="w-3.5 h-3.5 text-[#38BDF8]" />
                View Biometric Logs
              </button>
            </div>
          </div>

          {/* Live ZKTeco K40 TCP 4370 Real-Time Listeners */}
          <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#172033] dark:text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-[#087CEB]" />
                  Live ZKTeco K40 Real-Time Streams (TCP 4370 + ADMS + LAN Bridge)
                </h3>
                <p className="text-xs text-slate-500">
                  Start the persistent TCP 4370 event listener on local LAN K40 devices, or run the K40 LAN Bridge script when the ERP is hosted on Render.
                </p>
              </div>
            </div>

            {realtimeListeners.length === 0 ? (
              <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
                <span>No ZKTeco K40 / Biometric devices registered yet. Add one in the Device Connections tab first.</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('connections');
                    handleLoadZktecoK40Preset();
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg"
                >
                  Load K40 Preset
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {realtimeListeners.map((listener) => (
                  <div
                    key={listener.device_id}
                    className="p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            listener.running ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                          }`}
                        />
                        <span className="text-xs font-bold text-[#172033] dark:text-white truncate">
                          {listener.device_name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">{listener.serial_number}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {listener.ip_address}:{listener.port} · {listener.events_count} live event(s)
                        {listener.last_event_at
                          ? ` · Last ${formatLogTimestamp(listener.last_event_at).time}`
                          : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDownloadBridgeScript(listener.device_id)}
                        className="px-2.5 py-1.5 text-[11px] font-semibold text-[#087CEB] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg"
                        title="Download pre-configured K40 Bridge Script for this terminal"
                      >
                        Bridge
                      </button>
                      {listener.running ? (
                        <button
                          type="button"
                          disabled={togglingListenerId === listener.device_id}
                          onClick={() => handleStopRealtimeListener(listener.device_id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg"
                        >
                          {togglingListenerId === listener.device_id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Square className="w-3 h-3" />
                          )}
                          Stop Live
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={togglingListenerId === listener.device_id}
                          onClick={() => handleStartRealtimeListener(listener.device_id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                        >
                          {togglingListenerId === listener.device_id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                          Start Live (4370)
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Enroll Staff Finger */}
            <form
              onSubmit={handleEnrollFingerprint}
              className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
            >
              <div>
                <h3 className="text-sm font-bold text-[#172033] dark:text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#087CEB]" />
                  1. Enroll Real Staff Fingerprint (ZKTeco K40 &amp; Hardware Reader)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Prompt the physical ZKTeco K40 scanner to ask for the staff member’s real finger, or capture directly from an attached USB / Platform fingerprint sensor.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">
                    Staff Employee ID
                  </label>
                  <input
                    type="text"
                    required
                    list="zk-employee-list"
                    placeholder="e.g. SS-EMP-001"
                    value={zkEnrollForm.employee_id}
                    onChange={(e) => setZkEnrollForm({ ...zkEnrollForm, employee_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <datalist id="zk-employee-list">
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.employee_id}>
                        {emp.full_name} · {emp.department}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">
                    K40 User PIN (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Auto from Employee ID if empty"
                    value={zkEnrollForm.zk_user_pin}
                    onChange={(e) => setZkEnrollForm({ ...zkEnrollForm, zk_user_pin: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">
                    Finger Position
                  </label>
                  <select
                    value={zkEnrollForm.finger_index}
                    onChange={(e) => setZkEnrollForm({ ...zkEnrollForm, finger_index: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    {FINGER_OPTIONS.map((f) => (
                      <option key={f.index} value={String(f.index)}>
                        #{f.index} · {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">
                    ZKTeco K40 Terminal
                  </label>
                  <select
                    value={zkEnrollForm.device_id}
                    onChange={(e) => setZkEnrollForm({ ...zkEnrollForm, device_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="">Default ZKTeco K40 Terminal</option>
                    {devices.map((d) => (
                      <option key={d.id} value={String(d.id)}>
                        {d.device_name} ({d.ip_address}:{d.port})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={waitingK40Enroll || hwEnrolling}
                    onClick={handleAskK40RemoteEnroll}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-60 rounded-lg transition-colors"
                  >
                    {waitingK40Enroll ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Fingerprint className="w-4 h-4" />
                    )}
                    Ask Real Finger from ZKTeco K40
                  </button>

                  <button
                    type="button"
                    disabled={waitingK40Enroll || hwEnrolling}
                    onClick={handleHardwareSensorEnroll}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold text-white bg-[#18243A] hover:bg-[#172033] disabled:opacity-60 rounded-lg transition-colors"
                  >
                    {hwEnrolling ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#38BDF8]" />
                    ) : (
                      <Usb className="w-4 h-4 text-[#38BDF8]" />
                    )}
                    Scan Local Hardware Reader
                  </button>
                </div>

                {activeEnrollJob && activeEnrollJob.status === 'WaitingFinger' && (
                  <div className="sm:col-span-2 p-3 rounded-lg bg-[#EAF4FF] dark:bg-sky-950/60 border border-[#087CEB]/30 text-xs text-[#18243A] dark:text-[#7DD3FC] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Loader2 className="w-4 h-4 animate-spin text-[#087CEB] shrink-0" />
                      <span className="truncate">
                        Waiting for {activeEnrollJob.employee_name} on K40 ({activeEnrollJob.channel} · PIN{' '}
                        {activeEnrollJob.zk_user_pin})...
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelRemoteEnroll}
                      className="text-[11px] font-bold text-red-600 hover:underline shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <div className="sm:col-span-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Manual / Pre-Captured ADMS Template Payload (Optional fallback)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste K40 template string or leave blank to bind PIN"
                      value={zkEnrollForm.template_sample}
                      onChange={(e) => setZkEnrollForm({ ...zkEnrollForm, template_sample: e.target.value })}
                      className="flex-1 px-3 py-2 text-xs font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                    <button
                      type="submit"
                      disabled={enrollingFinger}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 disabled:opacity-60 rounded-lg whitespace-nowrap"
                    >
                      {enrollingFinger ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save Template
                    </button>
                  </div>
                </div>
              </div>
            </form>

            {/* Live Finger Scan -> Attendance Time Recording */}
            <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#172033] dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  2. Scan Staff Finger &amp; Record Real-Time Attendance
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reads a real finger from your attached hardware scanner or verifies an enrolled K40 punch, recording Check-In / Check-Out timestamps directly into Attendance Register.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-emerald-900 dark:text-emerald-200">
                  <div className="font-bold">Real Hardware Fingerprint Reader</div>
                  <div className="text-[11px] opacity-85">
                    Prompts USB FIDO2 / Windows Hello / Touch ID / Android biometric sensor and logs attendance instantly.
                  </div>
                </div>
                <button
                  type="button"
                  disabled={hwScanning}
                  onClick={handleHardwareSensorScan}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {hwScanning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Fingerprint className="w-4 h-4" />
                  )}
                  Scan Real Hardware Finger
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">
                    ZKTeco K40 Reader
                  </label>
                  <select
                    value={zkScanForm.device_id}
                    onChange={(e) => setZkScanForm({ ...zkScanForm, device_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="">ZKTeco K40 Terminal (Primary)</option>
                    {devices.map((d) => (
                      <option key={d.id} value={String(d.id)}>
                        {d.device_name} ({d.serial_number})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">
                    Attendance Punch Mode
                  </label>
                  <select
                    value={zkScanForm.punch_type}
                    onChange={(e) =>
                      setZkScanForm({
                        ...zkScanForm,
                        punch_type: e.target.value as 'Auto' | 'Check-In' | 'Check-Out',
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="Auto">Auto (Check-In first, then Check-Out)</option>
                    <option value="Check-In">Force Check-In Timestamp</option>
                    <option value="Check-Out">Force Check-Out Timestamp</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">
                    Select Enrolled Staff Finger
                  </label>
                  <select
                    value={zkScanForm.fingerprint_id}
                    onChange={(e) => {
                      const picked = fingerprints.find((fp) => String(fp.id) === e.target.value);
                      setZkScanForm({
                        ...zkScanForm,
                        fingerprint_id: e.target.value,
                        employee_id: picked ? picked.employee_id : zkScanForm.employee_id,
                        zk_user_pin: picked ? picked.zk_user_pin : zkScanForm.zk_user_pin,
                      });
                    }}
                    className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="">-- Match by Employee ID or ZK PIN below --</option>
                    {fingerprints.map((fp) => (
                      <option key={fp.id} value={String(fp.id)}>
                        {fp.employee_id} · {fp.employee_name} ({fp.finger_label} · PIN {fp.zk_user_pin})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">
                    Or Employee ID
                  </label>
                  <input
                    type="text"
                    placeholder="SS-EMP-001"
                    value={zkScanForm.employee_id}
                    onChange={(e) =>
                      setZkScanForm({ ...zkScanForm, fingerprint_id: '', employee_id: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">
                    Or K40 User PIN
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 101"
                    value={zkScanForm.zk_user_pin}
                    onChange={(e) =>
                      setZkScanForm({ ...zkScanForm, fingerprint_id: '', zk_user_pin: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={scanningFinger}
                  onClick={() => handleZktecoScan()}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#18243A] hover:bg-[#172033] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                >
                  {scanningFinger ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-[#38BDF8]" />}
                  Verify K40 PIN / Punch &amp; Record Time
                </button>
              </div>
            </div>
          </div>

          {/* Enrolled Staff Fingerprints Table */}
          <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#172033] dark:text-white">
                  Enrolled Staff Fingerprints Registry ({fingerprints.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Synced between ZKTeco K40 hardware templates, local fingerprint sensors, and HR Attendance profiles.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#18243A] text-white text-xs font-semibold">
                    <th className="py-3 px-4">Employee ID</th>
                    <th className="py-3 px-4">Staff Name &amp; Department</th>
                    <th className="py-3 px-4">ZK PIN</th>
                    <th className="py-3 px-4">Enrolled Finger &amp; Source</th>
                    <th className="py-3 px-4">K40 Serial / Last Scan</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {fingerprints.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No staff fingerprints enrolled yet. Register staff in HR Payroll (prompts finger enrollment automatically) or ask ZKTeco K40 above.
                      </td>
                    </tr>
                  ) : (
                    fingerprints.map((fp) => (
                      <tr key={fp.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono font-bold text-[#172033] dark:text-white whitespace-nowrap">
                          {fp.employee_id}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#172033] dark:text-white">{fp.employee_name}</div>
                          <div className="text-[11px] text-slate-500">{fp.department || 'Staff'}</div>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-[#087CEB]">{fp.zk_user_pin}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-[#EAF4FF] dark:bg-sky-950/60 text-[#18243A] dark:text-[#38BDF8] rounded">
                              <Fingerprint className="w-3 h-3" />#{fp.finger_index} · {fp.finger_label}
                            </span>
                            {fp.auth_source && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {fp.auth_source}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          <div>{fp.device_serial || 'ZK-K40'}</div>
                          <div>
                            {fp.last_scanned_at
                              ? `Last scan: ${formatLogTimestamp(fp.last_scanned_at).date} ${formatLogTimestamp(fp.last_scanned_at).time}`
                              : 'Awaiting first scan'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setZkScanForm((prev) => ({
                                  ...prev,
                                  fingerprint_id: String(fp.id),
                                  employee_id: fp.employee_id,
                                  zk_user_pin: fp.zk_user_pin,
                                }));
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                            >
                              Select for Scan
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFingerprint(fp.id)}
                              className="p-1.5 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 rounded-lg"
                              title="Remove Enrolled Fingerprint"
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
        </div>
      )}

      {activeTab === 'biometric-logs' && (
        <div className="space-y-6">
          {/* Summary Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Auth Events</div>
              <div className="mt-1 text-2xl font-extrabold text-[#172033] dark:text-white font-mono tabular-nums">
                {bioStats.total}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Real-time hardware & passkey stream</div>
            </div>
            <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Verified Success
              </div>
              <div className="mt-1 text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                {bioStats.success}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Identity & credential confirmed</div>
            </div>
            <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-red-700 dark:text-red-400">
                Failed Attempts
              </div>
              <div className="mt-1 text-2xl font-extrabold text-red-700 dark:text-red-400 font-mono tabular-nums">
                {bioStats.failure}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Blocked / unmatched credentials</div>
            </div>
            <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#087CEB]">
                Attendance Auto-Marked
              </div>
              <div className="mt-1 text-2xl font-extrabold text-[#087CEB] font-mono tabular-nums">
                {bioStats.marked}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Synced into Attendance Register</div>
            </div>
          </div>

          {/* Live Biometric Verification Console */}
          <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#172033] dark:text-white flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-[#087CEB]" />
                  Live Biometric Verification & Attendance Auto-Marking
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Captures terminal punches, hardware REST pushes, ZKTeco ADMS events, and passkey logins into persistent audit logs and Attendance Register.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadBioLogs}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${bioLoading ? 'animate-spin' : ''}`} />
                  Refresh Stream
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Biometric Device</label>
                <select
                  value={verifyForm.device_id}
                  onChange={(e) => setVerifyForm({ ...verifyForm, device_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  {devices.length === 0 && <option value="">Gate Terminal (Default)</option>}
                  {devices.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.device_name} ({d.serial_number})
                    </option>
                  ))}
                  <option value="">Unregistered Terminal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Employee ID</label>
                <input
                  type="text"
                  list="biometric-employee-list"
                  placeholder="e.g. SS-EMP-001"
                  value={verifyForm.employee_code}
                  onChange={(e) => setVerifyForm({ ...verifyForm, employee_code: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
                <datalist id="biometric-employee-list">
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.employee_id}>
                      {emp.full_name} · {emp.department}
                    </option>
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Auth Method</label>
                <select
                  value={verifyForm.auth_method}
                  onChange={(e) =>
                    setVerifyForm({ ...verifyForm, auth_method: e.target.value as (typeof AUTH_METHODS)[number] })
                  }
                  className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  {AUTH_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Punch Action</label>
                <select
                  value={verifyForm.punch_type}
                  onChange={(e) => setVerifyForm({ ...verifyForm, punch_type: e.target.value as 'Check-In' | 'Check-Out' })}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="Check-In">Check-In</option>
                  <option value="Check-Out">Check-Out</option>
                </select>
              </div>

              <div className="flex flex-col justify-end gap-2">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-[#172033] dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={verifyForm.auto_mark_attendance}
                    onChange={(e) => setVerifyForm({ ...verifyForm, auto_mark_attendance: e.target.checked })}
                    className="rounded border-slate-300 text-[#087CEB] focus:ring-[#087CEB]"
                  />
                  Auto-mark Attendance Register
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={verifyingScan}
                    onClick={() => handleVerifyBiometricScan()}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-60 rounded-lg whitespace-nowrap"
                  >
                    {verifyingScan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    Verify Scan
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Toolbar + Real-Time Authentication Logs Table */}
          <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {(['All', 'Success', 'Failure'] as const).map((statusOption) => (
                  <button
                    key={statusOption}
                    type="button"
                    onClick={() => setBioStatusFilter(statusOption)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                      bioStatusFilter === statusOption
                        ? 'bg-[#18243A] text-white'
                        : 'bg-[#F8FAFC] dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {statusOption === 'All' ? `All Events (${bioStats.total})` : statusOption === 'Success' ? `Success (${bioStats.success})` : `Failure (${bioStats.failure})`}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={bioDeviceFilter}
                  onChange={(e) => setBioDeviceFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="All">All Devices</option>
                  {devices.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      DEV-{d.id} · {d.device_name}
                    </option>
                  ))}
                  <option value="UNREGISTERED">Unregistered / WebAuthn</option>
                </select>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search employee, device ID, serial..."
                    value={bioSearch}
                    onChange={(e) => setBioSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg w-56"
                  />
                </div>
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[880px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#18243A] text-white text-xs font-semibold">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Device ID</th>
                    <th className="py-3 px-4">Employee ID</th>
                    <th className="py-3 px-4">Employee & Method</th>
                    <th className="py-3 px-4">Status (Success/Failure)</th>
                    <th className="py-3 px-4 text-right">Attendance Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {bioLoading && bioLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Loading biometric authentication logs...
                      </td>
                    </tr>
                  ) : filteredBioLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-500">
                        No biometric authentication events match your filter. Verify a scan above or push a terminal punch to see live stream events.
                      </td>
                    </tr>
                  ) : (
                    filteredBioLogs.map((log) => {
                      const ts = formatLogTimestamp(log.verified_at || log.created_at);
                      const isSuccess = log.status === 'Success';
                      return (
                        <tr key={log.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono tabular-nums whitespace-nowrap">
                            <div className="flex items-center gap-1.5 font-semibold text-[#172033] dark:text-white">
                              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {ts.time}
                            </div>
                            <div className="text-[11px] text-slate-500 pl-5">{ts.date}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-[#172033] dark:text-white whitespace-nowrap">
                              {log.device_id ? `DEV-${log.device_id}` : 'EXT'} · {log.device_identifier}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                              {log.device_name} · {log.auth_source}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-[#172033] dark:text-white whitespace-nowrap">
                            {log.employee_code || 'N/A'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-[#172033] dark:text-white">
                              {log.employee_name || 'Unmatched Credential'}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {log.auth_method} · <span className="font-mono text-[#087CEB]">{log.punch_type}</span>
                              {log.department ? ` · ${log.department}` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {isSuccess ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded">
                                <CheckCircle2 className="w-3 h-3" />
                                Success
                              </span>
                            ) : (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded">
                                  <XCircle className="w-3 h-3" />
                                  Failure
                                </span>
                                {log.failure_reason && (
                                  <div className="text-[11px] text-red-600 dark:text-red-400 mt-0.5 max-w-[240px]">
                                    {log.failure_reason}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {log.attendance_marked && log.attendance_record_id ? (
                              <div className="inline-flex items-center gap-2 justify-end">
                                <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono font-bold text-[#087CEB] bg-[#EAF4FF] dark:bg-sky-950/60 border border-[#087CEB]/25 rounded">
                                  Attendance #{log.attendance_record_id}
                                </span>
                                {onNavigate && (
                                  <button
                                    type="button"
                                    onClick={() => onNavigate('attendance')}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[#18243A] dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded"
                                    title="Open Attendance Register"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    View
                                  </button>
                                )}
                              </div>
                            ) : isSuccess ? (
                              <button
                                type="button"
                                disabled={markingLogId === log.id}
                                onClick={() => handleMarkAttendanceFromLog(log.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-60 rounded-lg whitespace-nowrap"
                              >
                                {markingLogId === log.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3" />
                                )}
                                Mark Attendance
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Blocked</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sync-logs' && (
        <div className="space-y-4">
          <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#172033] dark:text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-[#087CEB]" />
                {t('dev.k40.syncLogsTab', 'ZKTeco K40 Read-Only Synchronization Logs')}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Every background auto-poll, manual read-only sync, and LAN connector batch records fetched counts, duplicate prevention skips, and real TCP errors.
              </p>
            </div>
            <button
              type="button"
              onClick={loadSyncLogs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncLogsLoading ? 'animate-spin' : ''}`} />
              Refresh Sync Logs
            </button>
          </div>

          <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#18243A] text-white font-semibold">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Device</th>
                    <th className="py-3 px-4">Source / Operator</th>
                    <th className="py-3 px-4 text-right">Fetched</th>
                    <th className="py-3 px-4 text-right">Imported</th>
                    <th className="py-3 px-4 text-right">Duplicates Skipped</th>
                    <th className="py-3 px-4 text-right">Unmatched PINs</th>
                    <th className="py-3 px-4 text-right">K40 FPs (Unchanged)</th>
                    <th className="py-3 px-4">Status &amp; Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {syncLogs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">
                        No synchronization logs recorded yet. Run Read-Only Sync Now or connect a ZKTeco K40 terminal.
                      </td>
                    </tr>
                  ) : (
                    syncLogs.map((row) => {
                      const ts = formatLogTimestamp(row.started_at);
                      return (
                        <tr key={row.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-mono tabular-nums whitespace-nowrap">
                            <div className="font-semibold text-[#172033] dark:text-white">{ts.time}</div>
                            <div className="text-[11px] text-slate-500">{ts.date}</div>
                          </td>
                          <td className="py-3 px-4 font-semibold text-[#172033] dark:text-white">{row.device_name}</td>
                          <td className="py-3 px-4">
                            <div className="font-mono text-[11px] text-[#087CEB]">{row.sync_source}</div>
                            <div className="text-[11px] text-slate-500">{row.triggered_by}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">{row.total_fetched}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                            {row.imported_count}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                            {row.skipped_duplicates}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-amber-600 tabular-nums">{row.unmatched_count}</td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                            {row.k40_fp_count !== null && row.k40_fp_count !== undefined ? row.k40_fp_count : '--'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                                row.status === 'Success'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : row.status === 'Failed'
                                  ? 'bg-red-50 text-red-800 border border-red-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {row.status}
                            </span>
                            {row.latency_ms > 0 && (
                              <span className="ml-2 font-mono text-[11px] text-slate-400">{row.latency_ms}ms</span>
                            )}
                            {row.error_message && (
                              <div className="text-[11px] text-red-600 dark:text-red-400 mt-0.5 max-w-[260px]">
                                {row.error_message}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'unmatched-pins' && (
        <div className="space-y-4">
          <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#172033] dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                {t('dev.k40.unmatchedTab', 'Unmatched K40 Device User PINs')}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Map unlinked ZKTeco K40 User PINs to existing HR employees inside this software. Physical K40 users and fingerprints are NEVER changed or overwritten.
              </p>
            </div>
            <button
              type="button"
              onClick={loadUnmatchedUsers}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${unmatchedLoading ? 'animate-spin' : ''}`} />
              Refresh PIN Queue
            </button>
          </div>

          <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#18243A] text-white font-semibold">
                    <th className="py-3 px-4">K40 User PIN</th>
                    <th className="py-3 px-4">Device &amp; Serial</th>
                    <th className="py-3 px-4">Sample Punch &amp; Count</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Map to HR Employee (Software Only)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {unmatchedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No unmatched device PINs found. All K40 punches matched existing HR employees cleanly.
                      </td>
                    </tr>
                  ) : (
                    unmatchedUsers.map((row) => (
                      <tr key={row.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono font-bold text-[#172033] dark:text-white">
                          PIN {row.device_user_id}
                          {row.device_user_name && (
                            <div className="text-[11px] font-sans font-normal text-slate-500">{row.device_user_name}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#172033] dark:text-white">{row.device_name}</div>
                          <div className="text-[11px] font-mono text-slate-500">{row.device_serial}</div>
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums">
                          <div>{row.punch_count} punch(es)</div>
                          <div className="text-[11px] text-slate-500">{row.sample_punch_at}</div>
                        </td>
                        <td className="py-3 px-4">
                          {row.status === 'Mapped' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                              Mapped → {row.mapped_employee_id}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                              {row.status}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {row.status === 'Mapped' ? (
                            <span className="text-[11px] text-slate-500 font-mono">
                              Mapped by {row.mapped_by}
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <select
                                value={mapTargetById[row.id] || ''}
                                onChange={(e) =>
                                  setMapTargetById((prev) => ({ ...prev, [row.id]: e.target.value }))
                                }
                                className="px-2.5 py-1.5 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg max-w-[220px]"
                              >
                                <option value="">-- Select HR Employee --</option>
                                {employees.map((emp) => (
                                  <option key={emp.id} value={emp.employee_id}>
                                    {emp.employee_id} · {emp.full_name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={mappingId === row.id}
                                onClick={() => handleMapUnmatchedUser(row)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-60 rounded-lg whitespace-nowrap"
                              >
                                {mappingId === row.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                                {t('dev.k40.mapToEmployee', 'Map to Employee')}
                              </button>
                            </div>
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
      )}

      {/* Live Punch Push & Webhook Modal */}
      {punchModalDevice && (
        <div
          className="fixed inset-0 z-50 bg-[#18243A]/60 flex items-center justify-center p-4"
          onClick={() => setPunchModalDevice(null)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#172033] dark:text-white">
                  Sync Biometric Punch · {punchModalDevice.device_name}
                </h3>
                <p className="text-xs text-slate-500">
                  Real webhook & ZKTeco ADMS endpoint ingesting directly into Attendance Register & Overtime.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPunchModalDevice(null)}
                className="p-1 text-slate-400 hover:text-[#172033] dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-mono space-y-1 text-[#172033] dark:text-slate-200">
              <div>
                <span className="font-bold text-[#087CEB]">REST Push:</span> POST /api/devices/{punchModalDevice.id}/push-punch
              </div>
              <div>
                <span className="font-bold text-[#087CEB]">Header:</span> x-device-key: {punchModalDevice.api_key || 'SS-DEV-KEY'}
              </div>
              <div>
                <span className="font-bold text-[#087CEB]">ZKTeco ADMS:</span> /api/iclock/cdata?SN={punchModalDevice.serial_number}
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Total synced punches: {punchModalDevice.punch_count || 0}</span>
              </div>
            </div>

            <form onSubmit={handlePushPunch} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Employee Code</label>
                <input
                  type="text"
                  required
                  value={punchForm.employee_code}
                  onChange={(e) => setPunchForm({ ...punchForm, employee_code: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Punch Type</label>
                <select
                  value={punchForm.punch_type}
                  onChange={(e) => setPunchForm({ ...punchForm, punch_type: e.target.value as 'Check-In' | 'Check-Out' })}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="Check-In">Check-In</option>
                  <option value="Check-Out">Check-Out</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Employee Name (Optional)</label>
                <input
                  type="text"
                  placeholder="Auto-resolved if matched"
                  value={punchForm.employee_name}
                  onChange={(e) => setPunchForm({ ...punchForm, employee_name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Department (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Production"
                  value={punchForm.department}
                  onChange={(e) => setPunchForm({ ...punchForm, department: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Overtime Type</label>
                <select
                  value={punchForm.ot_type}
                  onChange={(e) =>
                    setPunchForm({
                      ...punchForm,
                      ot_type: e.target.value as 'None' | 'Regular' | 'Night' | 'Sunday' | 'Holiday',
                    })
                  }
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="None">None (Regular Shift)</option>
                  <option value="Regular">Regular OT (1.5x)</option>
                  <option value="Night">Night OT (1.75x)</option>
                  <option value="Sunday">Sunday OT (2.0x)</option>
                  <option value="Holiday">Holiday OT (2.5x)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">OT Hours</label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={punchForm.ot_hours}
                  onChange={(e) => setPunchForm({ ...punchForm, ot_hours: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPunchModalDevice(null)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-[#172033]"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={punchSending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-60 rounded-lg whitespace-nowrap"
                >
                  {punchSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Dispatch Live Punch to Attendance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register New Biometric Modal with Live Scanner Status Indicator (connecting / scanning / success / error) */}
      {registerBioModalOpen && selectedDevice && (
        <div
          className="fixed inset-0 z-50 bg-[#18243A]/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setRegisterBioModalOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-white dark:bg-slate-900 border-2 border-[#087CEB] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-[#18243A] text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#087CEB]/20 border border-[#38BDF8]/40 flex items-center justify-center shrink-0">
                  <Fingerprint className="w-5 h-5 text-[#38BDF8]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold truncate">Register New Biometric</h3>
                  <p className="text-xs text-[#7DD3FC] truncate">{scannerDeviceProbeInfo}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRegisterBioModalOpen(false)}
                className="p-1.5 text-white/70 hover:text-white rounded-lg"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[84vh] overflow-y-auto">
              {/* Live Scanner Status Indicator */}
              <div
                data-scanner-status={scannerStatus}
                className={`p-4 rounded-xl border-2 transition-colors ${
                  scannerStatus === 'connecting'
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700'
                    : scannerStatus === 'scanning'
                    ? 'bg-[#EAF4FF] dark:bg-sky-950/50 border-[#087CEB]'
                    : scannerStatus === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500'
                    : 'bg-red-50 dark:bg-red-950/50 border-red-400 dark:border-red-700'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        scannerStatus === 'connecting'
                          ? 'bg-amber-200/70 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                          : scannerStatus === 'scanning'
                          ? 'bg-[#087CEB] text-white animate-pulse'
                          : scannerStatus === 'success'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-red-600 text-white'
                      }`}
                    >
                      {scannerStatus === 'connecting' ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : scannerStatus === 'scanning' ? (
                        <Fingerprint className="w-5 h-5" />
                      ) : scannerStatus === 'success' ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <ShieldAlert className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Live Scanner Status
                      </div>
                      <div className="text-sm font-extrabold text-[#172033] dark:text-white flex items-center gap-2">
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-full ${
                            scannerStatus === 'connecting'
                              ? 'bg-amber-500 animate-ping'
                              : scannerStatus === 'scanning'
                              ? 'bg-[#087CEB] animate-pulse'
                              : scannerStatus === 'success'
                              ? 'bg-emerald-500'
                              : 'bg-red-500'
                          }`}
                        />
                        {scannerStatus === 'connecting'
                          ? 'Connecting'
                          : scannerStatus === 'scanning'
                          ? 'Scanning'
                          : scannerStatus === 'success'
                          ? 'Success'
                          : 'Error'}
                      </div>
                    </div>
                  </div>

                  {/* 3-Step Indicator */}
                  <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold">
                    <span
                      className={`px-2 py-0.5 rounded ${
                        scannerStatus === 'connecting'
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Connecting
                    </span>
                    <span className="text-slate-400">→</span>
                    <span
                      className={`px-2 py-0.5 rounded ${
                        scannerStatus === 'scanning'
                          ? 'bg-[#087CEB] text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Scanning
                    </span>
                    <span className="text-slate-400">→</span>
                    <span
                      className={`px-2 py-0.5 rounded ${
                        scannerStatus === 'success'
                          ? 'bg-emerald-600 text-white'
                          : scannerStatus === 'error'
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {scannerStatus === 'error' ? 'Error' : 'Success'}
                    </span>
                  </div>
                </div>
                <p className="mt-2.5 text-xs font-medium text-[#172033] dark:text-slate-200">
                  {scannerStatusDetail}
                </p>
              </div>

              {/* Staff & Scanner Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">
                    Staff Employee ID
                  </label>
                  <input
                    type="text"
                    list="zk-modal-employee-list"
                    placeholder="e.g. SS-EMP-101"
                    value={modalBioForm.employee_id}
                    onChange={(e) => {
                      const val = e.target.value;
                      const digits = val.replace(/[^0-9]/g, '').replace(/^0+/, '');
                      setModalBioForm((prev) => ({
                        ...prev,
                        employee_id: val,
                        zk_user_pin: prev.zk_user_pin || digits,
                      }));
                    }}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <datalist id="zk-modal-employee-list">
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.employee_id}>
                        {emp.full_name} · {emp.department}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">
                    K40 User PIN
                  </label>
                  <input
                    type="text"
                    placeholder="Auto from Employee ID"
                    value={modalBioForm.zk_user_pin}
                    onChange={(e) => setModalBioForm({ ...modalBioForm, zk_user_pin: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">
                    Finger Position
                  </label>
                  <select
                    value={modalBioForm.finger_index}
                    onChange={(e) => setModalBioForm({ ...modalBioForm, finger_index: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    {FINGER_OPTIONS.map((f) => (
                      <option key={f.index} value={String(f.index)}>
                        #{f.index} · {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">
                    Capture Hardware Mode
                  </label>
                  <select
                    value={modalBioForm.mode}
                    onChange={(e) =>
                      setModalBioForm({ ...modalBioForm, mode: e.target.value as 'k40' | 'hardware' })
                    }
                    className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="k40">ZKTeco K40 Terminal (TCP 4370 / ADMS)</option>
                    <option value="hardware">Local USB / Platform Fingerprint Reader</option>
                  </select>
                </div>
              </div>

              {modalEnrolledFp && scannerStatus === 'success' && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="font-mono text-emerald-900 dark:text-emerald-200">
                    Registered: <span className="font-bold">{modalEnrolledFp.employee_name}</span> ({modalEnrolledFp.employee_id}) · PIN {modalEnrolledFp.zk_user_pin} · {modalEnrolledFp.finger_label}
                  </div>
                  <button
                    type="button"
                    disabled={modalCheckinBusy}
                    onClick={handleModalRecordCheckIn}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg"
                  >
                    {modalCheckinBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                    Record Initial Check-In
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  {modalEnrollJob?.status === 'WaitingFinger' && (
                    <button
                      type="button"
                      onClick={handleModalCancelScan}
                      className="px-3 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg"
                    >
                      Cancel Scan
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenRegisterBiometricModal(selectedDevice)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Re-Probe Scanner
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRegisterBioModalOpen(false)}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#172033]"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={scannerStatus === 'connecting'}
                    onClick={handleModalStartBiometricRegistration}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-60 rounded-lg whitespace-nowrap"
                  >
                    {scannerStatus === 'connecting' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Fingerprint className="w-3.5 h-3.5" />
                    )}
                    {scannerStatus === 'error'
                      ? 'Retry Biometric Scan'
                      : scannerStatus === 'success'
                      ? 'Register Another Finger'
                      : 'Start Biometric Scan'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
