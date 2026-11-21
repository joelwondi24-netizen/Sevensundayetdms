import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Cable,
  CheckCircle2,
  Clock,
  ExternalLink,
  Fingerprint,
  Loader2,
  Pencil,
  Plus,
  Power,
  Radar,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unplug,
  Usb,
  Webhook,
  X,
  XCircle,
} from 'lucide-react';
import { api, getApiTenantId } from '../api';
import type { WsEventPayload } from '../hooks/useRealtimeWS';
import type {
  BiometricAuthLogRecord,
  DeviceRecord,
  DeviceScanResult,
  EmployeeProfile,
  ModuleKey,
} from '../types';

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

export const DevicesModule: React.FC<DevicesModuleProps> = ({
  lastWsEvent,
  onNavigate,
  onRefreshDashboard,
}) => {
  const [activeTab, setActiveTab] = useState<'connections' | 'biometric-logs'>('connections');
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [bioLogs, setBioLogs] = useState<BiometricAuthLogRecord[]>([]);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioStatusFilter, setBioStatusFilter] = useState<'All' | 'Success' | 'Failure'>('All');
  const [bioDeviceFilter, setBioDeviceFilter] = useState<string>('All');
  const [bioSearch, setBioSearch] = useState('');
  const [verifyingScan, setVerifyingScan] = useState(false);
  const [markingLogId, setMarkingLogId] = useState<number | null>(null);
  const [lastLiveEventAt, setLastLiveEventAt] = useState<string | null>(null);

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
    employee_code: 'SS-EMP-008',
    employee_name: '',
    department: '',
    punch_type: 'Check-In' as 'Check-In' | 'Check-Out',
    ot_type: 'None' as 'None' | 'Regular' | 'Night' | 'Sunday' | 'Holiday',
    ot_hours: '0',
  });

  const emptyForm = {
    device_type: DEVICE_TYPES[0],
    protocol: PROTOCOL_OPTIONS[0],
    device_name: '',
    ip_address: '',
    port: '4370',
    endpoint_url: '',
    subnet_mask: '255.255.255.0',
    gateway: '192.168.10.1',
    serial_number: '',
    api_key: '',
  };
  const [form, setForm] = useState(emptyForm);

  const loadDevices = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await api.get<DeviceRecord[]>('/api/devices');
      setDevices(data);
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

  const loadEmployees = async () => {
    try {
      const empData = await api.get<EmployeeProfile[]>('/api/employees');
      setEmployees(empData);
      setVerifyForm((prev) => {
        if (prev.employee_code || empData.length === 0) return prev;
        const active = empData.find((e) => e.status === 'Active') || empData[0];
        return { ...prev, employee_code: active.employee_id };
      });
    } catch {
      // Non-HR roles may not have employee directory read access; manual employee ID still works
    }
  };

  useEffect(() => {
    loadDevices();
    loadBioLogs();
    loadEmployees();
  }, []);

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

    if (lastWsEvent.event === 'device:punch' || lastWsEvent.event === 'device:status') {
      loadDevices(true);
    }
  }, [lastWsEvent]);

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const payload = {
        ...form,
        port: Number(form.port) || 4370,
      };
      if (editingId !== null) {
        const updated = await api.put<DeviceRecord>(`/api/devices/${editingId}`, payload);
        setDevices((prev) => prev.map((d) => (d.id === editingId ? updated : d)));
        setEditingId(null);
        setForm(emptyForm);
        setNotice(`Saved device connection "${updated.device_name}".`);
      } else {
        const created = await api.post<DeviceRecord>('/api/devices', payload);
        setDevices((prev) => [created, ...prev]);
        setForm(emptyForm);
        setNotice(`Registered device connection "${created.device_name}".`);
      }
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

  const handleVerifyBiometricScan = async (simulateFailure = false) => {
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
        simulate_failure: simulateFailure,
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
      setError(`Biometric Failure Logged: ${msg}`);
      loadBioLogs();
    } finally {
      setVerifyingScan(false);
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
            Biometric Authentication Logs
            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/15 dark:bg-slate-700/60 tabular-nums">
              {bioLogs.length}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Live WebSocket stream active" />
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
      <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-bold text-[#172033] dark:text-white">Device Connections Registry</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Manage real TCP/IP sockets, HTTP/REST probes, ZKTeco ADMS push terminals, and local USB/Serial gateways.{' '}
              <span className="font-mono font-semibold text-[#172033] dark:text-slate-200 tabular-nums">
                {connectedCount}/{devices.length} online · {totalPunches} punches synced
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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

          <div className="flex items-end gap-2">
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
                devices.map((dev) => (
                  <tr key={dev.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#172033] dark:text-white">{dev.device_name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {dev.device_type} · <span className="font-semibold text-[#087CEB]">{dev.protocol || 'TCP/IP Socket'}</span>
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
                      {dev.api_key && <div className="text-[11px] text-slate-500">Key: {dev.api_key}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
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
                          · {dev.punch_count || 0} syncs
                        </span>
                      </div>
                      {dev.last_message && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[260px]" title={dev.last_message}>
                          {dev.last_message}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
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
                        <button
                          type="button"
                          onClick={() => setPunchModalDevice(dev)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#18243A] dark:text-white bg-[#EAF4FF] dark:bg-slate-800 hover:bg-[#DBEAFE] border border-[#087CEB]/30 rounded-lg transition-colors whitespace-nowrap shrink-0"
                          title="Sync Punch / Live Webhook Endpoint"
                        >
                          <Webhook className="w-3.5 h-3.5 text-[#087CEB]" />
                          Sync Punch
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
                              protocol: dev.protocol || PROTOCOL_OPTIONS[0],
                              device_name: dev.device_name,
                              ip_address: dev.ip_address,
                              port: String(dev.port),
                              endpoint_url: dev.endpoint_url || '',
                              subnet_mask: dev.subnet_mask,
                              gateway: dev.gateway,
                              serial_number: dev.serial_number,
                              api_key: dev.api_key || '',
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
                ))
              )}
            </tbody>
          </table>
        </div>
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
                    onClick={() => handleVerifyBiometricScan(false)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-60 rounded-lg whitespace-nowrap"
                  >
                    {verifyingScan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    Verify Scan
                  </button>
                  <button
                    type="button"
                    disabled={verifyingScan}
                    onClick={() => handleVerifyBiometricScan(true)}
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 hover:bg-red-100 disabled:opacity-60 rounded-lg whitespace-nowrap"
                    title="Record a failed biometric authentication attempt"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Test Fail
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
    </div>
  );
};
