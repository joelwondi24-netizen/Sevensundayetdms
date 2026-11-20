import React, { useEffect, useState } from 'react';
import {
  Activity,
  Cable,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Power,
  Radar,
  RefreshCw,
  Save,
  Send,
  Trash2,
  Unplug,
  Usb,
  Webhook,
  X,
} from 'lucide-react';
import { api } from '../api';
import type { DeviceRecord, DeviceScanResult } from '../types';

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

export const DevicesModule: React.FC<{ onRefreshDashboard: () => void }> = ({ onRefreshDashboard }) => {
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
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

  const loadDevices = async () => {
    try {
      setLoading(true);
      const data = await api.get<DeviceRecord[]>('/api/devices');
      setDevices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

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

  const connectedCount = devices.filter((d) => d.status === 'Connected').length;
  const totalPunches = devices.reduce((acc, d) => acc + (Number(d.punch_count) || 0), 0);

  return (
    <div className="space-y-6">
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
              onClick={loadDevices}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {notice && (
          <div className="mb-4 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg">
            {notice}
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-2.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg">
            {error}
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
