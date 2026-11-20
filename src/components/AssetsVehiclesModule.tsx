import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Printer,
  RotateCcw,
  Save,
  Shield,
  Trash2,
  Truck,
  Wrench,
  X,
} from 'lucide-react';
import { api } from '../api';
import type { AssetUniformRecord, EquipmentMaintenanceRecord, VehicleRecord } from '../types';
import { formatMoney } from '../utils/ethiopianCalendar';
import { printWithAutoFit } from '../utils/printFit';

interface AssetsVehiclesModuleProps {
  mode: 'assets' | 'vehicles';
  currency: string;
  onRefreshDashboard: () => void;
}

export const AssetsVehiclesModule: React.FC<AssetsVehiclesModuleProps> = ({
  mode,
  currency,
  onRefreshDashboard,
}) => {
  const [assets, setAssets] = useState<AssetUniformRecord[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [equipmentLogs, setEquipmentLogs] = useState<EquipmentMaintenanceRecord[]>([]);
  const [fleetSubTab, setFleetSubTab] = useState<'vehicles' | 'equipment'>('vehicles');
  const [assetStatusFilter, setAssetStatusFilter] = useState<'All' | AssetUniformRecord['status']>('All');

  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);
  const [editingEqId, setEditingEqId] = useState<number | null>(null);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const emptyAssetForm = {
    item_name: '',
    category: 'Office Uniform',
    employee_id: 'SS-EMP-1001',
    employee_name: '',
    quantity: '1',
    condition: 'New' as AssetUniformRecord['condition'],
    date_issued: today,
    expected_return: '',
    notes: '',
  };
  const [assetForm, setAssetForm] = useState(emptyAssetForm);

  const emptyVehForm = {
    plate_number: '',
    vehicle_model: '',
    driver_name: '',
    department: 'Logistics',
    mileage_km: '0',
    fuel_cost: '0',
    maintenance_cost: '0',
    insurance_expiry: today,
    inspection_date: today,
    status: 'Active' as VehicleRecord['status'],
    notes: '',
  };
  const [vehForm, setVehForm] = useState(emptyVehForm);

  const emptyEqForm = {
    equipment_code: '',
    equipment_name: '',
    category: 'Factory Machinery',
    serial_number: '',
    location: 'Adama Factory',
    maintenance_type: 'Preventive' as EquipmentMaintenanceRecord['maintenance_type'],
    technician_name: 'Marcus Vance',
    maintenance_date: today,
    next_service_due: '',
    cost: '0',
    status: 'Scheduled' as EquipmentMaintenanceRecord['status'],
    notes: '',
  };
  const [eqForm, setEqForm] = useState(emptyEqForm);

  const loadData = async () => {
    try {
      const [a, v, eq] = await Promise.all([
        api.get<AssetUniformRecord[]>('/api/assets'),
        api.get<VehicleRecord[]>('/api/vehicles'),
        api.get<EquipmentMaintenanceRecord[]>('/api/equipment-maintenance'),
      ]);
      setAssets(a);
      setVehicles(v);
      setEquipmentLogs(eq);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load asset/fleet data');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredAssets = useMemo(() => {
    if (assetStatusFilter === 'All') return assets;
    return assets.filter((a) => a.status === assetStatusFilter);
  }, [assets, assetStatusFilter]);

  const assetCounts = useMemo(() => {
    return {
      All: assets.length,
      Issued: assets.filter((a) => a.status === 'Issued').length,
      Returned: assets.filter((a) => a.status === 'Returned').length,
      Damaged: assets.filter((a) => a.status === 'Damaged').length,
      Lost: assets.filter((a) => a.status === 'Lost').length,
    };
  }, [assets]);

  if (mode === 'assets') {
    const handleAssetStatus = async (
      asset: AssetUniformRecord,
      nextStatus: AssetUniformRecord['status'],
      nextCondition?: AssetUniformRecord['condition']
    ) => {
      setError(null);
      setNotice(null);
      try {
        const updated = await api.patch<AssetUniformRecord>(`/api/assets/${asset.id}/status`, {
          status: nextStatus,
          condition: nextCondition,
        });
        setAssets((prev) => prev.map((x) => (x.id === asset.id ? updated : x)));
        setNotice(`${asset.item_code} marked as ${nextStatus}.`);
        onRefreshDashboard();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update asset status');
      }
    };

    return (
      <div className="space-y-6">
        <div className="no-print bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-[#172033] dark:text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#087CEB]" />
                Staff Uniform & Company Asset Management
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Issue, Return, mark Damaged, edit, and track office uniforms, security/labor PPE, safety helmets, boots, laptops, and ID cards.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(['All', 'Issued', 'Returned', 'Damaged', 'Lost'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setAssetStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    assetStatusFilter === st
                      ? 'bg-[#18243A] text-white'
                      : 'bg-[#F8FAFC] dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {st} ({assetCounts[st]})
                </button>
              ))}
            </div>
          </div>

          {notice && (
            <div className="mb-3 px-4 py-2 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
              {notice}
            </div>
          )}
          {error && <div className="mb-3 text-xs text-red-700 bg-red-50 p-2.5 rounded-lg">{error}</div>}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setNotice(null);
              try {
                if (editingAssetId !== null) {
                  const updated = await api.put<AssetUniformRecord>(`/api/assets/${editingAssetId}`, {
                    ...assetForm,
                    quantity: Number(assetForm.quantity) || 1,
                  });
                  setAssets((prev) => prev.map((x) => (x.id === editingAssetId ? updated : x)));
                  setEditingAssetId(null);
                  setAssetForm(emptyAssetForm);
                  setNotice(`Saved changes to ${updated.item_code}.`);
                } else {
                  const created = await api.post<AssetUniformRecord>('/api/assets', {
                    ...assetForm,
                    quantity: Number(assetForm.quantity) || 1,
                  });
                  setAssets((prev) => [created, ...prev]);
                  setAssetForm(emptyAssetForm);
                  setNotice(`Saved & issued ${created.item_code} to ${created.employee_name}.`);
                }
                onRefreshDashboard();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not save asset');
              }
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-slate-200 dark:border-slate-800"
          >
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Item Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Safety Helmet / Laptop"
                value={assetForm.item_name}
                onChange={(e) => setAssetForm({ ...assetForm, item_name: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Category</label>
              <select
                value={assetForm.category}
                onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="Office Uniform">Office Uniform</option>
                <option value="Security Uniform">Security Uniform</option>
                <option value="Cleaner Uniform">Cleaner Uniform</option>
                <option value="Construction Uniform">Construction Uniform</option>
                <option value="PPE & Safety">PPE & Safety (Helmet/Boots/Gloves)</option>
                <option value="Laptop / Equipment">Laptop / Phone / Office Equipment</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Employee Name *</label>
              <input
                type="text"
                required
                placeholder="Staff Full Name"
                value={assetForm.employee_name}
                onChange={(e) => setAssetForm({ ...assetForm, employee_name: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Qty</label>
                <input
                  type="number"
                  min={1}
                  value={assetForm.quantity}
                  onChange={(e) => setAssetForm({ ...assetForm, quantity: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Condition</label>
                <select
                  value={assetForm.condition}
                  onChange={(e) => setAssetForm({ ...assetForm, condition: e.target.value as AssetUniformRecord['condition'] })}
                  className="w-full px-2 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="New">New</option>
                  <option value="Good">Good</option>
                  <option value="Worn">Worn</option>
                  <option value="Damaged">Damaged</option>
                  <option value="Lost">Lost</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Date Issued</label>
              <input
                type="date"
                value={assetForm.date_issued}
                onChange={(e) => setAssetForm({ ...assetForm, date_issued: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Expected Return</label>
              <input
                type="date"
                value={assetForm.expected_return}
                onChange={(e) => setAssetForm({ ...assetForm, expected_return: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Notes</label>
              <input
                type="text"
                placeholder="Serial, size, or condition notes..."
                value={assetForm.notes}
                onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div className="flex items-end gap-2">
              {editingAssetId !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingAssetId(null);
                    setAssetForm(emptyAssetForm);
                  }}
                  className="px-3 py-2 text-sm font-semibold text-[#172033] bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
              >
                <Save className="w-4 h-4" />
                {editingAssetId !== null ? 'Save Changes' : 'Save & Issue Asset'}
              </button>
            </div>
          </form>
        </div>

        <div
          data-print-active="true"
          data-print-orientation="landscape"
          className="print-only-container bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#18243A] text-white text-xs font-semibold">
                  <th className="py-3 px-4">Code & Item</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Condition / Issued</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="no-print py-3 px-4 text-right">Return / Damage / Save Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredAssets.map((a) => (
                  <tr key={a.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#172033] dark:text-white">{a.item_name}</div>
                      <div className="text-xs font-mono text-slate-500">
                        {a.item_code} · Qty {a.quantity}
                      </div>
                      {a.notes && <div className="text-[11px] text-slate-500 truncate max-w-[220px]">{a.notes}</div>}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">{a.category}</td>
                    <td className="py-3 px-4 text-xs font-medium text-[#172033] dark:text-slate-200">{a.employee_name}</td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-500">
                      <div className="font-semibold text-[#172033] dark:text-slate-200">{a.condition}</div>
                      <div>{a.date_issued}</div>
                    </td>
                    <td className="py-3 px-4 text-xs font-bold">
                      <span
                        className={
                          a.status === 'Returned'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : a.status === 'Damaged' || a.status === 'Lost'
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-[#087CEB]'
                        }
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="no-print py-3 px-4 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {a.status !== 'Returned' && (
                          <button
                            type="button"
                            onClick={() => handleAssetStatus(a, 'Returned', a.condition === 'Damaged' ? 'Worn' : 'Good')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg whitespace-nowrap"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Return
                          </button>
                        )}
                        {a.status !== 'Damaged' && (
                          <button
                            type="button"
                            onClick={() => handleAssetStatus(a, 'Damaged', 'Damaged')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg whitespace-nowrap"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Damage
                          </button>
                        )}
                        {a.status !== 'Issued' && (
                          <button
                            type="button"
                            onClick={() => handleAssetStatus(a, 'Issued', 'Good')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] rounded-lg whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Reissue
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAssetId(a.id);
                            setAssetForm({
                              item_name: a.item_name,
                              category: a.category,
                              employee_id: a.employee_id,
                              employee_name: a.employee_name,
                              quantity: String(a.quantity),
                              condition: a.condition,
                              date_issued: a.date_issued,
                              expected_return: a.expected_return || '',
                              notes: a.notes || '',
                            });
                          }}
                          className="p-1.5 text-[#172033] bg-slate-100 hover:bg-slate-200 rounded-lg"
                          title="Edit Asset"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await api.del(`/api/assets/${a.id}`);
                            setAssets((prev) => prev.filter((x) => x.id !== a.id));
                            onRefreshDashboard();
                          }}
                          className="p-1.5 text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
                          title="Delete Asset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredAssets.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                      No assets or uniforms match this status filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Sub-tab Switcher: Vehicles & Fleet | Equipment Maintenance Form */}
      <div className="no-print bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#172033] dark:text-white">
            Company Vehicles & Equipment Maintenance
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage fleet vehicles, mileage, insurance/inspection dates, and structured Equipment Maintenance forms & service schedules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFleetSubTab('vehicles')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap ${
              fleetSubTab === 'vehicles'
                ? 'bg-[#18243A] text-white'
                : 'bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-slate-200 hover:bg-[#EAF4FF]'
            }`}
          >
            <Truck className={`w-3.5 h-3.5 ${fleetSubTab === 'vehicles' ? 'text-[#38BDF8]' : 'text-[#087CEB]'}`} />
            Vehicles & Fleet ({vehicles.length})
          </button>
          <button
            type="button"
            onClick={() => setFleetSubTab('equipment')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap ${
              fleetSubTab === 'equipment'
                ? 'bg-[#18243A] text-white'
                : 'bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-slate-200 hover:bg-[#EAF4FF]'
            }`}
          >
            <Wrench className={`w-3.5 h-3.5 ${fleetSubTab === 'equipment' ? 'text-[#38BDF8]' : 'text-[#087CEB]'}`} />
            Equipment Maintenance Form ({equipmentLogs.length})
          </button>
        </div>
      </div>

      {notice && (
        <div className="no-print px-4 py-2.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
          {notice}
        </div>
      )}
      {error && <div className="no-print text-xs text-red-700 bg-red-50 p-3 rounded-lg border border-red-200">{error}</div>}

      {fleetSubTab === 'vehicles' ? (
        <>
          <div className="no-print bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h3 className="text-base font-bold text-[#172033] dark:text-white mb-4">
              {editingVehicleId !== null ? 'Edit & Save Vehicle Record' : 'Register Company Vehicle'}
            </h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                setNotice(null);
                try {
                  const payload = {
                    ...vehForm,
                    mileage_km: Number(vehForm.mileage_km) || 0,
                    fuel_cost: Number(vehForm.fuel_cost) || 0,
                    maintenance_cost: Number(vehForm.maintenance_cost) || 0,
                  };
                  if (editingVehicleId !== null) {
                    const updated = await api.put<VehicleRecord>(`/api/vehicles/${editingVehicleId}`, payload);
                    setVehicles((prev) => prev.map((x) => (x.id === editingVehicleId ? updated : x)));
                    setEditingVehicleId(null);
                    setVehForm(emptyVehForm);
                    setNotice(`Saved vehicle ${updated.plate_number}.`);
                  } else {
                    const created = await api.post<VehicleRecord>('/api/vehicles', payload);
                    setVehicles((prev) => [created, ...prev]);
                    setVehForm(emptyVehForm);
                    setNotice(`Saved new vehicle ${created.plate_number}.`);
                  }
                  onRefreshDashboard();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to save vehicle');
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
            >
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Plate Number *</label>
                <input
                  type="text"
                  required
                  placeholder="AA-3-51200"
                  value={vehForm.plate_number}
                  onChange={(e) => setVehForm({ ...vehForm, plate_number: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Vehicle Model *</label>
                <input
                  type="text"
                  required
                  placeholder="Isuzu / Toyota Hilux"
                  value={vehForm.vehicle_model}
                  onChange={(e) => setVehForm({ ...vehForm, vehicle_model: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Assigned Driver</label>
                <input
                  type="text"
                  placeholder="Driver Name"
                  value={vehForm.driver_name}
                  onChange={(e) => setVehForm({ ...vehForm, driver_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Maintenance Cost ({currency})</label>
                <input
                  type="number"
                  value={vehForm.maintenance_cost}
                  onChange={(e) => setVehForm({ ...vehForm, maintenance_cost: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Insurance Expiry</label>
                <input
                  type="date"
                  value={vehForm.insurance_expiry}
                  onChange={(e) => setVehForm({ ...vehForm, insurance_expiry: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Inspection Date</label>
                <input
                  type="date"
                  value={vehForm.inspection_date}
                  onChange={(e) => setVehForm({ ...vehForm, inspection_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Status</label>
                <select
                  value={vehForm.status}
                  onChange={(e) => setVehForm({ ...vehForm, status: e.target.value as VehicleRecord['status'] })}
                  className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="Active">Active</option>
                  <option value="In Maintenance">In Maintenance</option>
                  <option value="Inspection Due">Inspection Due</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                {editingVehicleId !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingVehicleId(null);
                      setVehForm(emptyVehForm);
                    }}
                    className="px-3 py-2 text-sm font-semibold text-[#172033] bg-slate-100 hover:bg-slate-200 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
                >
                  <Save className="w-4 h-4" />
                  {editingVehicleId !== null ? 'Save Vehicle' : 'Save & Add Vehicle'}
                </button>
              </div>
            </form>
          </div>

          <div
            data-print-active="true"
            data-print-orientation="landscape"
            className="print-only-container bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#18243A] text-white text-xs font-semibold">
                    <th className="py-3 px-4">Plate & Model</th>
                    <th className="py-3 px-4">Driver / Dept</th>
                    <th className="py-3 px-4 text-right">Mileage</th>
                    <th className="py-3 px-4 text-right">Fuel + Maint.</th>
                    <th className="py-3 px-4">Insurance / Insp.</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="no-print py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {vehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-[#172033] dark:text-white">{v.plate_number}</div>
                        <div className="text-xs text-slate-500">{v.vehicle_model}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">
                        <div>{v.driver_name}</div>
                        <div className="text-slate-500">{v.department}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                        {v.mileage_km.toLocaleString()} km
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                        {formatMoney(v.fuel_cost + v.maintenance_cost, currency)}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                        <div>Ins: {v.insurance_expiry}</div>
                        <div>Insp: {v.inspection_date}</div>
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold">
                        <span className={v.status === 'Active' ? 'text-emerald-700' : 'text-[#087CEB]'}>{v.status}</span>
                      </td>
                      <td className="no-print py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingVehicleId(v.id);
                              setVehForm({
                                plate_number: v.plate_number,
                                vehicle_model: v.vehicle_model,
                                driver_name: v.driver_name,
                                department: v.department,
                                mileage_km: String(v.mileage_km),
                                fuel_cost: String(v.fuel_cost),
                                maintenance_cost: String(v.maintenance_cost),
                                insurance_expiry: v.insurance_expiry,
                                inspection_date: v.inspection_date,
                                status: v.status,
                                notes: v.notes,
                              });
                            }}
                            className="p-1.5 text-[#172033] bg-slate-100 hover:bg-slate-200 rounded-lg"
                            title="Edit Vehicle"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await api.del(`/api/vehicles/${v.id}`);
                              setVehicles((prev) => prev.filter((x) => x.id !== v.id));
                              onRefreshDashboard();
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* EQUIPMENT MAINTENANCE FORM & REGISTER */
        <>
          <div className="no-print bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-[#172033] dark:text-white flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-[#087CEB]" />
                  {editingEqId !== null ? 'Edit & Save Equipment Maintenance Record' : 'Equipment Maintenance Form'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Log preventive servicing, repairs, calibration, and safety inspections for factory machines, generators, biometric hardware, and office equipment.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  printWithAutoFit({
                    orientation: 'landscape',
                    targetSelector: '.print-only-container[data-print-active="true"]',
                  })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#18243A] hover:bg-[#243656] rounded-lg whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5 text-[#38BDF8]" />
                Print Maintenance Sheet
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                setNotice(null);
                try {
                  const payload = { ...eqForm, cost: Number(eqForm.cost) || 0 };
                  if (editingEqId !== null) {
                    const updated = await api.put<EquipmentMaintenanceRecord>(`/api/equipment-maintenance/${editingEqId}`, payload);
                    setEquipmentLogs((prev) => prev.map((x) => (x.id === editingEqId ? updated : x)));
                    setEditingEqId(null);
                    setEqForm(emptyEqForm);
                    setNotice(`Saved maintenance record ${updated.equipment_code}.`);
                  } else {
                    const created = await api.post<EquipmentMaintenanceRecord>('/api/equipment-maintenance', payload);
                    setEquipmentLogs((prev) => [created, ...prev]);
                    setEqForm(emptyEqForm);
                    setNotice(`Saved Equipment Maintenance Form ${created.equipment_code}.`);
                  }
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Could not save equipment maintenance record');
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-slate-200 dark:border-slate-800"
            >
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Equipment Code</label>
                <input
                  type="text"
                  placeholder="Auto (e.g. EQM-2026-004)"
                  value={eqForm.equipment_code}
                  onChange={(e) => setEqForm({ ...eqForm, equipment_code: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Equipment Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Packaging Compressor / Generator"
                  value={eqForm.equipment_name}
                  onChange={(e) => setEqForm({ ...eqForm, equipment_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Category</label>
                <select
                  value={eqForm.category}
                  onChange={(e) => setEqForm({ ...eqForm, category: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="Factory Machinery">Factory Machinery</option>
                  <option value="Power & Generator">Power & Generator</option>
                  <option value="Security & Biometric">Security & Biometric</option>
                  <option value="Warehouse Forklift / Lift">Warehouse Forklift / Lift</option>
                  <option value="IT & Office Hardware">IT & Office Hardware</option>
                  <option value="HVAC & Cooling">HVAC & Cooling</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Serial Number</label>
                <input
                  type="text"
                  placeholder="SN-..."
                  value={eqForm.serial_number}
                  onChange={(e) => setEqForm({ ...eqForm, serial_number: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Location / Branch</label>
                <input
                  type="text"
                  value={eqForm.location}
                  onChange={(e) => setEqForm({ ...eqForm, location: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Maintenance Type</label>
                <select
                  value={eqForm.maintenance_type}
                  onChange={(e) => setEqForm({ ...eqForm, maintenance_type: e.target.value as EquipmentMaintenanceRecord['maintenance_type'] })}
                  className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="Preventive">Preventive</option>
                  <option value="Corrective">Corrective Repair</option>
                  <option value="Calibration">Calibration</option>
                  <option value="Inspection">Safety Inspection</option>
                  <option value="Emergency">Emergency Breakdown</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Technician / Vendor</label>
                <input
                  type="text"
                  value={eqForm.technician_name}
                  onChange={(e) => setEqForm({ ...eqForm, technician_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Maintenance Cost ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  value={eqForm.cost}
                  onChange={(e) => setEqForm({ ...eqForm, cost: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Service Date</label>
                <input
                  type="date"
                  value={eqForm.maintenance_date}
                  onChange={(e) => setEqForm({ ...eqForm, maintenance_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Next Service Due</label>
                <input
                  type="date"
                  value={eqForm.next_service_due}
                  onChange={(e) => setEqForm({ ...eqForm, next_service_due: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Status</label>
                <select
                  value={eqForm.status}
                  onChange={(e) => setEqForm({ ...eqForm, status: e.target.value as EquipmentMaintenanceRecord['status'] })}
                  className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="Scheduled">Scheduled</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Out of Service">Out of Service</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Work Performed / Notes</label>
                <input
                  type="text"
                  placeholder="Parts replaced, test readings..."
                  value={eqForm.notes}
                  onChange={(e) => setEqForm({ ...eqForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-end gap-2 pt-1">
                {editingEqId !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEqId(null);
                      setEqForm(emptyEqForm);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-[#172033] bg-slate-100 hover:bg-slate-200 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                    Cancel Edit
                  </button>
                )}
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
                >
                  <Save className="w-4 h-4" />
                  {editingEqId !== null ? 'Save Maintenance Changes' : 'Save Equipment Maintenance Form'}
                </button>
              </div>
            </form>
          </div>

          <div
            data-print-active="true"
            data-print-orientation="landscape"
            className="print-only-container bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-[#172033] dark:text-white">
                  Equipment Maintenance Log ({equipmentLogs.length})
                </h4>
                <span className="text-xs text-slate-500">
                  Total Maintenance Spend: {formatMoney(equipmentLogs.reduce((s, r) => s + Number(r.cost || 0), 0), currency)}
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#18243A] text-white text-xs font-semibold">
                    <th className="py-3 px-4">Code & Equipment</th>
                    <th className="py-3 px-4">Category / Location</th>
                    <th className="py-3 px-4">Type & Technician</th>
                    <th className="py-3 px-4">Service / Next Due</th>
                    <th className="py-3 px-4 text-right">Cost</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="no-print py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {equipmentLogs.map((eq) => (
                    <tr key={eq.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-xs text-[#18243A] dark:text-[#38BDF8]">{eq.equipment_code}</div>
                        <div className="font-semibold text-[#172033] dark:text-white">{eq.equipment_name}</div>
                        {eq.serial_number && <div className="text-[11px] font-mono text-slate-500">SN: {eq.serial_number}</div>}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="text-[#172033] dark:text-slate-200">{eq.category}</div>
                        <div className="text-slate-500">{eq.location}</div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="font-semibold text-[#172033] dark:text-slate-200">{eq.maintenance_type}</div>
                        <div className="text-slate-500">{eq.technician_name}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                        <div>Done: {eq.maintenance_date}</div>
                        {eq.next_service_due && <div>Next: {eq.next_service_due}</div>}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums">
                        {formatMoney(eq.cost, currency)}
                      </td>
                      <td className="py-3 px-4 text-xs font-bold">
                        <span
                          className={
                            eq.status === 'Completed'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : eq.status === 'Out of Service'
                              ? 'text-red-700 dark:text-red-400'
                              : 'text-[#087CEB]'
                          }
                        >
                          {eq.status}
                        </span>
                      </td>
                      <td className="no-print py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {eq.status !== 'Completed' && (
                            <button
                              type="button"
                              onClick={async () => {
                                const updated = await api.patch<EquipmentMaintenanceRecord>(
                                  `/api/equipment-maintenance/${eq.id}/status`,
                                  { status: 'Completed' }
                                );
                                setEquipmentLogs((prev) => prev.map((x) => (x.id === eq.id ? updated : x)));
                              }}
                              className="px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg whitespace-nowrap"
                            >
                              Complete
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEqId(eq.id);
                              setEqForm({
                                equipment_code: eq.equipment_code,
                                equipment_name: eq.equipment_name,
                                category: eq.category,
                                serial_number: eq.serial_number,
                                location: eq.location,
                                maintenance_type: eq.maintenance_type,
                                technician_name: eq.technician_name,
                                maintenance_date: eq.maintenance_date,
                                next_service_due: eq.next_service_due,
                                cost: String(eq.cost),
                                status: eq.status,
                                notes: eq.notes,
                              });
                            }}
                            className="p-1.5 text-[#172033] bg-slate-100 hover:bg-slate-200 rounded-lg"
                            title="Edit Maintenance Record"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await api.del(`/api/equipment-maintenance/${eq.id}`);
                              setEquipmentLogs((prev) => prev.filter((x) => x.id !== eq.id));
                            }}
                            className="p-1.5 text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
                            title="Delete Maintenance Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
