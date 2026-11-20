import React, { useEffect, useState } from 'react';
import { Cable, Loader2, Pencil, Power, RefreshCw, Save, Trash2, Unplug, X } from 'lucide-react';
import { api } from '../api';
import type { DeviceRecord } from '../types';

const DEVICE_TYPES = [
  'Biometric Fingerprint Terminal',
  'Face Recognition Gate',
  'RFID Card Reader',
  'Thermal / Register Printer',
  'Network Time Clock',
  'Barcode / Warehouse Scanner',
  'Local EMS Gateway Node',
];

export const DevicesModule: React.FC<{ onRefreshDashboard: () => void }> = ({ onRefreshDashboard }) => {
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emptyForm = {
    device_type: DEVICE_TYPES[0],
    device_name: '',
    ip_address: '',
    port: '4370',
    subnet_mask: '255.255.255.0',
    gateway: '192.168.10.1',
    serial_number: '',
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
      if (editingId !== null) {
        const updated = await api.put<DeviceRecord>(`/api/devices/${editingId}`, {
          ...form,
          port: Number(form.port) || 4370,
        });
        setDevices((prev) => prev.map((d) => (d.id === editingId ? updated : d)));
        setEditingId(null);
        setForm(emptyForm);
        setNotice(`Saved changes to ${updated.device_name}.`);
      } else {
        const created = await api.post<DeviceRecord>('/api/devices', {
          ...form,
          port: Number(form.port) || 4370,
        });
        setDevices((prev) => [created, ...prev]);
        setForm(emptyForm);
        setNotice(`Saved device ${created.device_name}.`);
      }
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save device');
    }
  };

  const handleConnect = async (id: number) => {
    setError(null);
    setConnectingId(id);
    try {
      const updated = await api.post<DeviceRecord>(`/api/devices/${id}/connect`);
      setDevices((prev) => prev.map((d) => (d.id === id ? updated : d)));
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection probe failed');
    } finally {
      setConnectingId(null);
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

  return (
    <div className="space-y-6">
      <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-bold text-[#172033] dark:text-white">Real Connection Device Registry</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Register hardware endpoints with IPv4, Port, Subnet Mask, Gateway, and Serial Number. Clicking Connect runs a live backend TCP socket handshake.
            </p>
          </div>
          <button
            type="button"
            onClick={loadDevices}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Registry
          </button>
        </div>

        {notice && (
          <div className="mb-4 px-4 py-2.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
            {notice}
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-2.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleAddDevice} className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Connection Device Type</label>
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
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Connection Device Name</label>
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
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">IP Address</label>
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

          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Subnet Mask</label>
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
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Gateway</label>
            <input
              type="text"
              required
              placeholder="192.168.10.1"
              value={form.gateway}
              onChange={(e) => setForm({ ...form, gateway: e.target.value })}
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
              {editingId !== null ? 'Save Device' : 'Save & Add Device'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#18243A] text-white text-xs font-semibold">
                <th className="py-3 px-4">Device Name / Type</th>
                <th className="py-3 px-4">IP Address : Port</th>
                <th className="py-3 px-4">Subnet Mask</th>
                <th className="py-3 px-4">Gateway</th>
                <th className="py-3 px-4">Serial Number</th>
                <th className="py-3 px-4">Connection State</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    Loading registered devices...
                  </td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    No devices configured yet. Register your first hardware connection above.
                  </td>
                </tr>
              ) : (
                devices.map((dev) => (
                  <tr key={dev.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#172033] dark:text-white">{dev.device_name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{dev.device_type}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-[#172033] dark:text-slate-200 tabular-nums">
                      {dev.ip_address}:{dev.port}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                      {dev.subnet_mask}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                      {dev.gateway}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums">
                      {dev.serial_number}
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
                      </div>
                      {dev.last_message && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[240px]" title={dev.last_message}>
                          {dev.last_message}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={connectingId === dev.id}
                          onClick={() => handleConnect(dev.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
                        >
                          {connectingId === dev.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Cable className="w-3.5 h-3.5" />
                          )}
                          Connect
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
                              device_name: dev.device_name,
                              ip_address: dev.ip_address,
                              port: String(dev.port),
                              subnet_mask: dev.subnet_mask,
                              gateway: dev.gateway,
                              serial_number: dev.serial_number,
                            });
                          }}
                          className="p-1.5 text-[#172033] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          title="Edit Device"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(dev.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
                          title="Delete Device"
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
            Tip: Local loopback <span className="font-mono font-semibold text-[#172033] dark:text-white">127.0.0.1:3000</span> verifies live server socket connectivity immediately; facility LAN biometric IPs probe your local network when deployed on-premises.
          </span>
        </div>
      </div>
    </div>
  );
};
