import React, { useEffect, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import type {
  GinAuditRecord,
  GrnRecord,
  InventoryMovementRecord,
  MaterialItem,
  MaterialRequestItem,
  ProcurementRecord,
  PurchasingOrder,
} from '../types';

export type SupplyChainTab =
  | 'materials'
  | 'material-requests'
  | 'audit-ledger'
  | 'grn'
  | 'gin'
  | 'transfer'
  | 'return'
  | 'damage'
  | 'audit'
  | 'adjustment'
  | 'procurement'
  | 'purchasing';

interface SupplyChainModuleProps {
  activeTab: SupplyChainTab;
  onTabChange: (tab: SupplyChainTab) => void;
  onRefreshDashboard: () => void;
}

const MOVEMENT_TYPE_MAP: Partial<Record<SupplyChainTab, InventoryMovementRecord['movement_type']>> = {
  transfer: 'Transfer',
  return: 'Return',
  damage: 'Damage',
  audit: 'Audit',
  adjustment: 'Adjustment',
};

export const SupplyChainModule: React.FC<SupplyChainModuleProps> = ({
  activeTab,
  onTabChange,
  onRefreshDashboard,
}) => {
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [requests, setRequests] = useState<MaterialRequestItem[]>([]);
  const [grns, setGrns] = useState<GrnRecord[]>([]);
  const [gins, setGins] = useState<GinAuditRecord[]>([]);
  const [movements, setMovements] = useState<InventoryMovementRecord[]>([]);
  const [procurements, setProcurements] = useState<ProcurementRecord[]>([]);
  const [orders, setOrders] = useState<PurchasingOrder[]>([]);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const [matForm, setMatForm] = useState({
    sku: '',
    name: '',
    category: 'Hardware',
    unit: 'pcs',
    stock_qty: '10',
    reorder_level: '5',
    unit_cost: '25',
    location: 'Main Warehouse',
  });

  const [reqForm, setReqForm] = useState({
    requested_by: '',
    department: 'Operations',
    material_id: '',
    material_name: '',
    quantity: '5',
    unit: 'pcs',
    urgency: 'Standard' as MaterialRequestItem['urgency'],
    needed_by: today,
    notes: '',
  });

  const [grnForm, setGrnForm] = useState({
    po_reference: '',
    supplier_name: '',
    material_id: '',
    material_name: '',
    quantity_received: '10',
    unit_cost: '40',
    received_date: today,
    inspected_by: 'Daniel Mekonnen',
    condition_status: 'Accepted' as GrnRecord['condition_status'],
    notes: '',
  });

  const [ginForm, setGinForm] = useState({
    issued_to_department: 'Engineering',
    issued_to_person: '',
    material_id: '',
    material_name: '',
    quantity_issued: '2',
    issue_date: today,
    authorized_by: 'Daniel Mekonnen',
    audit_status: 'Pending Audit' as GinAuditRecord['audit_status'],
    audit_notes: '',
  });

  const [movForm, setMovForm] = useState({
    material_id: '',
    material_name: '',
    quantity: '1',
    source_location: 'Main Warehouse',
    destination_location: 'Adama Factory',
    reason: '',
    variance_qty: '0',
    movement_date: today,
  });

  const [procForm, setProcForm] = useState({
    title: '',
    department: 'Operations',
    material_name: '',
    quantity: '10',
    estimated_budget: '1500',
    vendor_candidates: '',
    selected_vendor: '',
    bid_amount: '0',
    due_date: today,
  });

  const [poForm, setPoForm] = useState({
    vendor_name: '',
    material_id: '',
    material_name: '',
    quantity: '10',
    unit_price: '50',
    order_date: today,
    expected_date: today,
    notes: '',
  });

  const loadAll = async () => {
    try {
      const [m, r, g, gi, mv, pr, po] = await Promise.all([
        api.get<MaterialItem[]>('/api/materials'),
        api.get<MaterialRequestItem[]>('/api/material-requests'),
        api.get<GrnRecord[]>('/api/grn'),
        api.get<GinAuditRecord[]>('/api/gin'),
        api.get<InventoryMovementRecord[]>('/api/inventory-movements').catch(() => []),
        api.get<ProcurementRecord[]>('/api/procurement'),
        api.get<PurchasingOrder[]>('/api/purchasing'),
      ]);
      setMaterials(m);
      setRequests(r);
      setGrns(g);
      setGins(gi);
      setMovements(mv);
      setProcurements(pr);
      setOrders(po);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load supply chain records');
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const totalAuditCount = movements.length + gins.length + grns.length;

  const tabs: Array<{ key: SupplyChainTab; label: string }> = [
    { key: 'materials', label: `Materials (${materials.length})` },
    { key: 'material-requests', label: 'Material Requests' },
    { key: 'audit-ledger', label: `Audit Ledger (${totalAuditCount})` },
    { key: 'grn', label: 'Goods Receiving (GRN)' },
    { key: 'gin', label: 'Goods Issuing (GIN)' },
    { key: 'transfer', label: 'Transfer' },
    { key: 'return', label: 'Return' },
    { key: 'damage', label: 'Damage' },
    { key: 'audit', label: 'Audit' },
    { key: 'adjustment', label: 'Adjustment' },
    { key: 'procurement', label: 'Procurement' },
    { key: 'purchasing', label: 'Purchasing' },
  ];

  const handleMaterialSelect = (
    materialId: string,
    setter: (name: string, unit?: string, cost?: string) => void
  ) => {
    const found = materials.find((m) => String(m.id) === materialId);
    if (found) {
      setter(found.name, found.unit, String(found.unit_cost));
    }
  };

  const activeMovementType = MOVEMENT_TYPE_MAP[activeTab];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-wrap items-center gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setError(null);
              onTabChange(t.key);
            }}
            className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeTab === t.key
                ? 'bg-[#18243A] text-white'
                : 'bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-slate-200 hover:bg-[#EAF4FF]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="px-4 py-2.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      {/* 1. MATERIALS */}
      {activeTab === 'materials' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-[#172033] dark:text-white mb-4">Materials Master Catalog</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                try {
                  const created = await api.post<MaterialItem>('/api/materials', {
                    ...matForm,
                    stock_qty: Number(matForm.stock_qty),
                    reorder_level: Number(matForm.reorder_level),
                    unit_cost: Number(matForm.unit_cost),
                  });
                  setMaterials((prev) => [created, ...prev]);
                  setMatForm({ ...matForm, sku: '', name: '' });
                  onRefreshDashboard();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to create material');
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
            >
              <input
                type="text"
                placeholder="SKU (optional)"
                value={matForm.sku}
                onChange={(e) => setMatForm({ ...matForm, sku: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                required
                placeholder="Material name"
                value={matForm.name}
                onChange={(e) => setMatForm({ ...matForm, name: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                required
                placeholder="Category"
                value={matForm.category}
                onChange={(e) => setMatForm({ ...matForm, category: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                placeholder="Unit (pcs, box, kg)"
                value={matForm.unit}
                onChange={(e) => setMatForm({ ...matForm, unit: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Stock Qty"
                value={matForm.stock_qty}
                onChange={(e) => setMatForm({ ...matForm, stock_qty: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Reorder Level"
                value={matForm.reorder_level}
                onChange={(e) => setMatForm({ ...matForm, reorder_level: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Unit Cost"
                value={matForm.unit_cost}
                onChange={(e) => setMatForm({ ...matForm, unit_cost: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Bin / Location"
                  value={matForm.location}
                  onChange={(e) => setMatForm({ ...matForm, location: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <th className="py-3 px-4">SKU & Material</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4 text-right">Stock</th>
                    <th className="py-3 px-4 text-right">Reorder</th>
                    <th className="py-3 px-4 text-right">Unit Cost</th>
                    <th className="py-3 px-4 text-right">Valuation</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {materials.map((m) => (
                    <tr key={m.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#172033] dark:text-white">{m.name}</div>
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400">{m.sku}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">{m.category}</td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">{m.location}</td>
                      <td className={`py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums ${m.stock_qty <= m.reorder_level ? 'text-red-700' : 'text-[#172033] dark:text-white'}`}>
                        {m.stock_qty} {m.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-500 tabular-nums">{m.reorder_level} {m.unit}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">{m.unit_cost.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums">{(m.stock_qty * m.unit_cost).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            await api.del(`/api/materials/${m.id}`);
                            setMaterials((prev) => prev.filter((x) => x.id !== m.id));
                            onRefreshDashboard();
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg whitespace-nowrap"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. MATERIAL REQUESTS */}
      {activeTab === 'material-requests' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-[#172033] dark:text-white mb-4">Material Requests</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                try {
                  const created = await api.post<MaterialRequestItem>('/api/material-requests', {
                    ...reqForm,
                    material_id: reqForm.material_id ? Number(reqForm.material_id) : null,
                    quantity: Number(reqForm.quantity),
                  });
                  setRequests((prev) => [created, ...prev]);
                  setReqForm({ ...reqForm, requested_by: '', notes: '' });
                  onRefreshDashboard();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to submit material request');
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
            >
              <input
                type="text"
                required
                placeholder="Requested By"
                value={reqForm.requested_by}
                onChange={(e) => setReqForm({ ...reqForm, requested_by: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                placeholder="Department"
                value={reqForm.department}
                onChange={(e) => setReqForm({ ...reqForm, department: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <select
                value={reqForm.material_id}
                onChange={(e) => {
                  const id = e.target.value;
                  setReqForm((prev) => ({ ...prev, material_id: id }));
                  handleMaterialSelect(id, (name, unit) =>
                    setReqForm((prev) => ({ ...prev, material_id: id, material_name: name, unit: unit || 'pcs' }))
                  );
                }}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="">Select catalog material</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.sku} — {m.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="Material Name"
                value={reqForm.material_name}
                onChange={(e) => setReqForm({ ...reqForm, material_name: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="number"
                min="1"
                placeholder="Quantity"
                value={reqForm.quantity}
                onChange={(e) => setReqForm({ ...reqForm, quantity: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <select
                value={reqForm.urgency}
                onChange={(e) => setReqForm({ ...reqForm, urgency: e.target.value as MaterialRequestItem['urgency'] })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="Standard">Standard</option>
                <option value="Urgent">Urgent</option>
                <option value="Critical">Critical</option>
              </select>
              <input
                type="date"
                value={reqForm.needed_by}
                onChange={(e) => setReqForm({ ...reqForm, needed_by: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Submit Request
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <th className="py-3 px-4">Request #</th>
                    <th className="py-3 px-4">Requester / Dept</th>
                    <th className="py-3 px-4">Material</th>
                    <th className="py-3 px-4 text-right">Qty</th>
                    <th className="py-3 px-4">Urgency & Needed By</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td className="py-3 px-4 font-mono text-xs font-semibold">{r.request_number}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{r.requested_by}</div>
                        <div className="text-xs text-slate-500">{r.department}</div>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium">{r.material_name}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">{r.quantity} {r.unit}</td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-500">{r.urgency} · {r.needed_by}</td>
                      <td className="py-3 px-4 text-xs font-semibold">{r.status}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {r.status === 'Pending' && (
                            <button
                              type="button"
                              onClick={async () => {
                                const updated = await api.patch<MaterialRequestItem>(`/api/material-requests/${r.id}/status`, { status: 'Approved' });
                                setRequests((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
                                onRefreshDashboard();
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Approve
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              await api.del(`/api/material-requests/${r.id}`);
                              setRequests((prev) => prev.filter((x) => x.id !== r.id));
                              onRefreshDashboard();
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
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
        </div>
      )}

      {/* 3. AUDIT LEDGER (COMBINED MOVEMENTS + GRN + GIN) */}
      {activeTab === 'audit-ledger' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#172033] dark:text-white">
                Materials & Logistics Audit Ledger ({totalAuditCount})
              </h2>
              <p className="text-xs text-slate-500">
                Unified chronological ledger covering GRN, GIN, Transfer, Return, Damage, Physical Audit, and Stock Adjustments.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 font-semibold text-slate-600 dark:text-slate-300">
                  <th className="py-3 px-4">Voucher / Ref #</th>
                  <th className="py-3 px-4">Operation Type</th>
                  <th className="py-3 px-4">Material</th>
                  <th className="py-3 px-4 text-right">Qty / Variance</th>
                  <th className="py-3 px-4">Location / Route</th>
                  <th className="py-3 px-4">Date & By</th>
                  <th className="py-3 px-4 text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {movements.map((mv) => (
                  <tr key={`mv-${mv.id}`}>
                    <td className="py-2.5 px-4 font-mono font-semibold text-[#18243A] dark:text-[#38BDF8]">{mv.movement_number}</td>
                    <td className="py-2.5 px-4 font-semibold">{mv.movement_type}</td>
                    <td className="py-2.5 px-4">{mv.material_name}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">{mv.quantity} (Var {mv.variance_qty})</td>
                    <td className="py-2.5 px-4 text-slate-500">{mv.source_location} → {mv.destination_location}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">{mv.movement_date} · {mv.recorded_by}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          await api.del(`/api/inventory-movements/${mv.id}`);
                          setMovements((prev) => prev.filter((x) => x.id !== mv.id));
                          onRefreshDashboard();
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-700 bg-red-50 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {grns.map((g) => (
                  <tr key={`grn-${g.id}`}>
                    <td className="py-2.5 px-4 font-mono font-semibold">{g.grn_number}</td>
                    <td className="py-2.5 px-4 font-semibold text-emerald-700">GRN Receiving</td>
                    <td className="py-2.5 px-4">{g.material_name}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">+{g.quantity_received}</td>
                    <td className="py-2.5 px-4 text-slate-500">{g.supplier_name} → {g.warehouse}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">{g.received_date} · {g.inspected_by}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          await api.del(`/api/grn/${g.id}`);
                          setGrns((prev) => prev.filter((x) => x.id !== g.id));
                          onRefreshDashboard();
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-700 bg-red-50 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {gins.map((gi) => (
                  <tr key={`gin-${gi.id}`}>
                    <td className="py-2.5 px-4 font-mono font-semibold">{gi.gin_number}</td>
                    <td className="py-2.5 px-4 font-semibold text-amber-700">GIN Issuing</td>
                    <td className="py-2.5 px-4">{gi.material_name}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">-{gi.quantity_issued}</td>
                    <td className="py-2.5 px-4 text-slate-500">{gi.issued_to_department} ({gi.issued_to_person})</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">{gi.issue_date} · {gi.audit_status}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          await api.del(`/api/gin/${gi.id}`);
                          setGins((prev) => prev.filter((x) => x.id !== gi.id));
                          onRefreshDashboard();
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-700 bg-red-50 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. GOODS RECEIVING (GRN) */}
      {activeTab === 'grn' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-[#172033] dark:text-white mb-1">Goods Receiving Note (GRN)</h2>
            <p className="text-xs text-slate-500 mb-4">Accepted GRN entries automatically increment catalog stock quantities.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                try {
                  const created = await api.post<GrnRecord>('/api/grn', {
                    ...grnForm,
                    material_id: grnForm.material_id ? Number(grnForm.material_id) : null,
                    quantity_received: Number(grnForm.quantity_received),
                    unit_cost: Number(grnForm.unit_cost),
                  });
                  setGrns((prev) => [created, ...prev]);
                  await loadAll();
                  onRefreshDashboard();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to create GRN');
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
            >
              <input
                type="text"
                placeholder="PO Reference"
                value={grnForm.po_reference}
                onChange={(e) => setGrnForm({ ...grnForm, po_reference: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                required
                placeholder="Supplier Name"
                value={grnForm.supplier_name}
                onChange={(e) => setGrnForm({ ...grnForm, supplier_name: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <select
                value={grnForm.material_id}
                onChange={(e) => {
                  const id = e.target.value;
                  setGrnForm((prev) => ({ ...prev, material_id: id }));
                  handleMaterialSelect(id, (name, _unit, cost) =>
                    setGrnForm((prev) => ({ ...prev, material_id: id, material_name: name, unit_cost: cost || '0' }))
                  );
                }}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="">Link catalog material</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>{m.sku} — {m.name}</option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="Material Name"
                value={grnForm.material_name}
                onChange={(e) => setGrnForm({ ...grnForm, material_name: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="number"
                min="1"
                placeholder="Qty Received"
                value={grnForm.quantity_received}
                onChange={(e) => setGrnForm({ ...grnForm, quantity_received: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Unit Cost"
                value={grnForm.unit_cost}
                onChange={(e) => setGrnForm({ ...grnForm, unit_cost: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <select
                value={grnForm.condition_status}
                onChange={(e) => setGrnForm({ ...grnForm, condition_status: e.target.value as GrnRecord['condition_status'] })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="Accepted">Accepted</option>
                <option value="Partial">Partial</option>
                <option value="Quarantine">Quarantine</option>
              </select>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Record GRN
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <th className="py-3 px-4">GRN # / PO</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Material</th>
                    <th className="py-3 px-4 text-right">Qty</th>
                    <th className="py-3 px-4">Condition</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {grns.map((g) => (
                    <tr key={g.id}>
                      <td className="py-3 px-4 font-mono text-xs"><div className="font-semibold">{g.grn_number}</div><div className="text-slate-500">{g.po_reference}</div></td>
                      <td className="py-3 px-4 text-xs">{g.supplier_name}</td>
                      <td className="py-3 px-4 text-xs">{g.material_name}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums">{g.quantity_received}</td>
                      <td className="py-3 px-4 text-xs font-semibold text-emerald-700">{g.condition_status}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            await api.del(`/api/grn/${g.id}`);
                            setGrns((prev) => prev.filter((x) => x.id !== g.id));
                            onRefreshDashboard();
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. GOODS ISSUING (GIN) */}
      {activeTab === 'gin' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-[#172033] dark:text-white mb-1">Goods Issuing Note (GIN) & Audit</h2>
            <p className="text-xs text-slate-500 mb-4">Issuing deducts catalog stock and logs physical audit verification.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                try {
                  const created = await api.post<GinAuditRecord>('/api/gin', {
                    ...ginForm,
                    material_id: ginForm.material_id ? Number(ginForm.material_id) : null,
                    quantity_issued: Number(ginForm.quantity_issued),
                  });
                  setGins((prev) => [created, ...prev]);
                  await loadAll();
                  onRefreshDashboard();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to issue GIN');
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
            >
              <input
                type="text"
                required
                placeholder="Issued To Department"
                value={ginForm.issued_to_department}
                onChange={(e) => setGinForm({ ...ginForm, issued_to_department: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                required
                placeholder="Recipient Name"
                value={ginForm.issued_to_person}
                onChange={(e) => setGinForm({ ...ginForm, issued_to_person: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <select
                value={ginForm.material_id}
                onChange={(e) => {
                  const id = e.target.value;
                  setGinForm((prev) => ({ ...prev, material_id: id }));
                  handleMaterialSelect(id, (name) => setGinForm((prev) => ({ ...prev, material_id: id, material_name: name })));
                }}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="">Link catalog material</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>{m.sku} — {m.name}</option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="Material Name"
                value={ginForm.material_name}
                onChange={(e) => setGinForm({ ...ginForm, material_name: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="number"
                min="1"
                placeholder="Qty Issued"
                value={ginForm.quantity_issued}
                onChange={(e) => setGinForm({ ...ginForm, quantity_issued: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="date"
                value={ginForm.issue_date}
                onChange={(e) => setGinForm({ ...ginForm, issue_date: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                placeholder="Audit Notes"
                value={ginForm.audit_notes}
                onChange={(e) => setGinForm({ ...ginForm, audit_notes: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Issue GIN
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <th className="py-3 px-4">GIN #</th>
                    <th className="py-3 px-4">Issued To</th>
                    <th className="py-3 px-4">Material</th>
                    <th className="py-3 px-4 text-right">Qty</th>
                    <th className="py-3 px-4">Audit</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {gins.map((g) => (
                    <tr key={g.id}>
                      <td className="py-3 px-4 font-mono text-xs font-semibold">{g.gin_number}</td>
                      <td className="py-3 px-4 text-xs"><div>{g.issued_to_person}</div><div className="text-slate-500">{g.issued_to_department}</div></td>
                      <td className="py-3 px-4 text-xs">{g.material_name}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums">{g.quantity_issued}</td>
                      <td className="py-3 px-4 text-xs font-semibold">{g.audit_status}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {g.audit_status !== 'Verified' && (
                            <button
                              type="button"
                              onClick={async () => {
                                const updated = await api.patch<GinAuditRecord>(`/api/gin/${g.id}/audit`, {
                                  audit_status: 'Verified',
                                  audit_variance: 0,
                                  audit_notes: g.audit_notes || 'Audit verified',
                                });
                                setGins((prev) => prev.map((x) => (x.id === g.id ? updated : x)));
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Verify
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              await api.del(`/api/gin/${g.id}`);
                              setGins((prev) => prev.filter((x) => x.id !== g.id));
                              onRefreshDashboard();
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
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
        </div>
      )}

      {/* 6. TRANSFER / RETURN / DAMAGE / AUDIT / ADJUSTMENT */}
      {activeMovementType && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-[#172033] dark:text-white mb-1">
              Material {activeMovementType} Management
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Record stock {activeMovementType.toLowerCase()} transactions with automatic warehouse valuation adjustment & Delete support.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                try {
                  const created = await api.post<InventoryMovementRecord>('/api/inventory-movements', {
                    ...movForm,
                    movement_type: activeMovementType,
                    material_id: movForm.material_id ? Number(movForm.material_id) : null,
                    quantity: Number(movForm.quantity),
                    variance_qty: Number(movForm.variance_qty) || 0,
                  });
                  setMovements((prev) => [created, ...prev]);
                  await loadAll();
                  setMovForm((prev) => ({ ...prev, reason: '' }));
                  onRefreshDashboard();
                } catch (err) {
                  setError(err instanceof Error ? err.message : `Failed to record ${activeMovementType}`);
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
            >
              <select
                value={movForm.material_id}
                onChange={(e) => {
                  const id = e.target.value;
                  setMovForm((prev) => ({ ...prev, material_id: id }));
                  handleMaterialSelect(id, (name) => setMovForm((prev) => ({ ...prev, material_id: id, material_name: name })));
                }}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="">Link catalog material</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>{m.sku} — {m.name} ({m.stock_qty} {m.unit})</option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="Material Name"
                value={movForm.material_name}
                onChange={(e) => setMovForm({ ...movForm, material_name: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="number"
                step="0.01"
                placeholder={activeMovementType === 'Adjustment' ? 'Delta Qty (+/-)' : 'Quantity'}
                value={movForm.quantity}
                onChange={(e) => setMovForm({ ...movForm, quantity: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                placeholder="Source Location"
                value={movForm.source_location}
                onChange={(e) => setMovForm({ ...movForm, source_location: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                placeholder="Destination / Bin"
                value={movForm.destination_location}
                onChange={(e) => setMovForm({ ...movForm, destination_location: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              {activeMovementType === 'Audit' && (
                <input
                  type="number"
                  step="0.01"
                  placeholder="Count Variance"
                  value={movForm.variance_qty}
                  onChange={(e) => setMovForm({ ...movForm, variance_qty: e.target.value })}
                  className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              )}
              <input
                type="date"
                value={movForm.movement_date}
                onChange={(e) => setMovForm({ ...movForm, movement_date: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                placeholder="Reason / Remarks"
                value={movForm.reason}
                onChange={(e) => setMovForm({ ...movForm, reason: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Record {activeMovementType}
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <th className="py-3 px-4">Ref #</th>
                    <th className="py-3 px-4">Material</th>
                    <th className="py-3 px-4 text-right">Qty</th>
                    <th className="py-3 px-4">From → To</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {movements
                    .filter((m) => m.movement_type === activeMovementType)
                    .map((mv) => (
                      <tr key={mv.id}>
                        <td className="py-3 px-4 font-mono text-xs font-semibold">{mv.movement_number}</td>
                        <td className="py-3 px-4 text-xs font-medium">{mv.material_name}</td>
                        <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums">{mv.quantity}</td>
                        <td className="py-3 px-4 text-xs text-slate-500">{mv.source_location} → {mv.destination_location}</td>
                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">{mv.reason || '—'}</td>
                        <td className="py-3 px-4 text-xs font-semibold">{mv.status}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              await api.del(`/api/inventory-movements/${mv.id}`);
                              setMovements((prev) => prev.filter((x) => x.id !== mv.id));
                              onRefreshDashboard();
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 7. PROCUREMENT */}
      {activeTab === 'procurement' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-[#172033] dark:text-white mb-4">Procurement & RFQ Tenders</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                try {
                  const created = await api.post<ProcurementRecord>('/api/procurement', {
                    ...procForm,
                    quantity: Number(procForm.quantity),
                    estimated_budget: Number(procForm.estimated_budget),
                    bid_amount: Number(procForm.bid_amount),
                  });
                  setProcurements((prev) => [created, ...prev]);
                  setProcForm({ ...procForm, title: '', material_name: '' });
                  onRefreshDashboard();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to create RFQ');
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
            >
              <input
                type="text"
                required
                placeholder="RFQ Title"
                value={procForm.title}
                onChange={(e) => setProcForm({ ...procForm, title: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                required
                placeholder="Material / Scope"
                value={procForm.material_name}
                onChange={(e) => setProcForm({ ...procForm, material_name: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="number"
                placeholder="Quantity"
                value={procForm.quantity}
                onChange={(e) => setProcForm({ ...procForm, quantity: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="number"
                placeholder="Budget"
                value={procForm.estimated_budget}
                onChange={(e) => setProcForm({ ...procForm, estimated_budget: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                placeholder="Vendor Candidates"
                value={procForm.vendor_candidates}
                onChange={(e) => setProcForm({ ...procForm, vendor_candidates: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                placeholder="Selected Vendor"
                value={procForm.selected_vendor}
                onChange={(e) => setProcForm({ ...procForm, selected_vendor: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="date"
                value={procForm.due_date}
                onChange={(e) => setProcForm({ ...procForm, due_date: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Create RFQ
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <th className="py-3 px-4">RFQ #</th>
                    <th className="py-3 px-4">Title & Material</th>
                    <th className="py-3 px-4 text-right">Budget</th>
                    <th className="py-3 px-4">Vendor</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {procurements.map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 px-4 font-mono text-xs font-semibold">{p.rfq_number}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{p.title}</div>
                        <div className="text-xs text-slate-500">{p.material_name} · Qty {p.quantity}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">{p.estimated_budget.toFixed(2)}</td>
                      <td className="py-3 px-4 text-xs">{p.selected_vendor || p.vendor_candidates || 'Pending Bids'}</td>
                      <td className="py-3 px-4 text-xs font-semibold">{p.status}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {p.status !== 'Awarded' && (
                            <button
                              type="button"
                              onClick={async () => {
                                const updated = await api.patch<ProcurementRecord>(`/api/procurement/${p.id}`, {
                                  status: 'Awarded',
                                  selected_vendor: p.selected_vendor || 'Preferred Vendor',
                                  bid_amount: p.bid_amount || p.estimated_budget,
                                });
                                setProcurements((prev) => prev.map((x) => (x.id === p.id ? updated : x)));
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Award
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              await api.del(`/api/procurement/${p.id}`);
                              setProcurements((prev) => prev.filter((x) => x.id !== p.id));
                              onRefreshDashboard();
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
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
        </div>
      )}

      {/* 8. PURCHASING */}
      {activeTab === 'purchasing' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-[#172033] dark:text-white mb-4">Purchasing Orders (PO)</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                try {
                  const created = await api.post<PurchasingOrder>('/api/purchasing', {
                    ...poForm,
                    material_id: poForm.material_id ? Number(poForm.material_id) : null,
                    quantity: Number(poForm.quantity),
                    unit_price: Number(poForm.unit_price),
                  });
                  setOrders((prev) => [created, ...prev]);
                  setPoForm({ ...poForm, vendor_name: '', material_name: '' });
                  onRefreshDashboard();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to create purchase order');
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
            >
              <input
                type="text"
                required
                placeholder="Vendor Name"
                value={poForm.vendor_name}
                onChange={(e) => setPoForm({ ...poForm, vendor_name: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <select
                value={poForm.material_id}
                onChange={(e) => {
                  const id = e.target.value;
                  setPoForm((prev) => ({ ...prev, material_id: id }));
                  handleMaterialSelect(id, (name, _unit, cost) =>
                    setPoForm((prev) => ({ ...prev, material_id: id, material_name: name, unit_price: cost || '0' }))
                  );
                }}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="">Link catalog material</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>{m.sku} — {m.name}</option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="Material / Item"
                value={poForm.material_name}
                onChange={(e) => setPoForm({ ...poForm, material_name: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="number"
                min="1"
                placeholder="Quantity"
                value={poForm.quantity}
                onChange={(e) => setPoForm({ ...poForm, quantity: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Unit Price"
                value={poForm.unit_price}
                onChange={(e) => setPoForm({ ...poForm, unit_price: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="date"
                value={poForm.order_date}
                onChange={(e) => setPoForm({ ...poForm, order_date: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="date"
                value={poForm.expected_date}
                onChange={(e) => setPoForm({ ...poForm, expected_date: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Issue PO
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <th className="py-3 px-4">PO #</th>
                    <th className="py-3 px-4">Vendor</th>
                    <th className="py-3 px-4">Material</th>
                    <th className="py-3 px-4 text-right">Qty</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {orders.map((po) => (
                    <tr key={po.id}>
                      <td className="py-3 px-4 font-mono text-xs font-semibold">{po.po_number}</td>
                      <td className="py-3 px-4 text-xs font-medium">{po.vendor_name}</td>
                      <td className="py-3 px-4 text-xs">{po.material_name}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">{po.quantity}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums">{po.total_amount.toFixed(2)}</td>
                      <td className="py-3 px-4 text-xs font-semibold">{po.status}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {po.status !== 'Received' && (
                            <button
                              type="button"
                              onClick={async () => {
                                const updated = await api.patch<PurchasingOrder>(`/api/purchasing/${po.id}/status`, { status: 'Received' });
                                setOrders((prev) => prev.map((x) => (x.id === po.id ? updated : x)));
                                onRefreshDashboard();
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Received
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              await api.del(`/api/purchasing/${po.id}`);
                              setOrders((prev) => prev.filter((x) => x.id !== po.id));
                              onRefreshDashboard();
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
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
        </div>
      )}
    </div>
  );
};
