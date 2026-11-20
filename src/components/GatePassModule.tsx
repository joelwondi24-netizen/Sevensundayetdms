import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  Lock,
  Plus,
  Printer,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { api } from '../api';
import type { CompanySettings, EmployeeProfile, GatePassRecord } from '../types';
import { toEthiopianDateString } from '../utils/ethiopianCalendar';
import { RealQrCode } from './RealQrCode';
import { SendToApproveButton } from './SendToApproveButton';
import { ShareButton } from './ShareButton';

interface GatePassModuleProps {
  company?: CompanySettings | null;
  onRefreshDashboard: () => void;
}

const PASS_TYPES: GatePassRecord['pass_type'][] = [
  'Staff Exit',
  'Visitor',
  'Material Exit',
  'Vehicle Gate Pass',
];

export const GatePassModule: React.FC<GatePassModuleProps> = ({
  company,
  onRefreshDashboard,
}) => {
  const [passes, setPasses] = useState<GatePassRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [selectedPass, setSelectedPass] = useState<GatePassRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Active' | 'Used' | 'Cancelled'>('ALL');
  const [search, setSearch] = useState('');
  const [guardName, setGuardName] = useState('Main Gate Security');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    pass_type: 'Staff Exit' as GatePassRecord['pass_type'],
    person_name: '',
    employee_code: '',
    department: 'Production',
    destination: '',
    purpose: '',
    items_description: '',
    vehicle_plate: '',
    valid_date: new Date().toISOString().slice(0, 10),
    issued_by: 'Department Supervisor',
    approved_department: 'Security & Gate',
  });

  const loadData = async () => {
    try {
      const [gpList, empList] = await Promise.all([
        api.get<GatePassRecord[]>('/api/gate-passes'),
        api.get<EmployeeProfile[]>('/api/employees'),
      ]);
      setPasses(gpList);
      setEmployees(empList);
      if (gpList.length > 0 && !selectedPass) {
        setSelectedPass(gpList[0]);
      }
      if (empList.length > 0 && !form.person_name) {
        setForm((prev) => ({
          ...prev,
          employee_code: empList[0].employee_id,
          person_name: empList[0].full_name,
          department: empList[0].department,
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gate passes');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const created = await api.post<GatePassRecord>('/api/gate-passes', form);
      setPasses((prev) => [created, ...prev]);
      setSelectedPass(created);
      setNotice(`Issued single-use Gate Pass ${created.pass_number} (Token: ${created.pass_token}).`);
      setForm((prev) => ({
        ...prev,
        destination: '',
        purpose: '',
        items_description: '',
        vehicle_plate: '',
      }));
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to issue gate pass');
    }
  };

  const handleConsumePass = async (pass: GatePassRecord) => {
    setError(null);
    setNotice(null);
    try {
      const updated = await api.post<GatePassRecord>(`/api/gate-passes/${pass.id}/consume`, {
        verified_by_guard: guardName.trim() || 'Gate Security',
      });
      setPasses((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setSelectedPass(updated);
      setNotice(`Gate Pass ${updated.pass_number} verified and permanently locked after single use.`);
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pass already used or cannot be consumed');
    }
  };

  const handleDeletePass = async (id: number) => {
    setError(null);
    try {
      await api.del(`/api/gate-passes/${id}`);
      const next = passes.filter((p) => p.id !== id);
      setPasses(next);
      if (selectedPass?.id === id) setSelectedPass(next[0] || null);
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete gate pass');
    }
  };

  const filteredPasses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return passes.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.pass_number.toLowerCase().includes(q) ||
        p.pass_token.toLowerCase().includes(q) ||
        p.person_name.toLowerCase().includes(q) ||
        p.destination.toLowerCase().includes(q) ||
        p.vehicle_plate.toLowerCase().includes(q)
      );
    });
  }, [passes, statusFilter, search]);

  const logoSrc =
    company?.logo_data && company.logo_data.startsWith('data:')
      ? company.logo_data
      : '/assets/aistudio/Seven_Sunday_Logo_2_desktop_addf2fa7.png';

  const activeCount = passes.filter((p) => p.status === 'Active').length;
  const usedCount = passes.filter((p) => p.status === 'Used').length;

  return (
    <div className="space-y-6">
      {/* Issuance Form Card */}
      <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#172033] dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#087CEB]" />
              Single-Use Gate Pass Form (1-Time Security Authorization)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Each Gate Pass carries a one-time QR token. Once scanned or verified at the gate, it is permanently marked Used & Locked and cannot be reused.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">{activeCount} Active</span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-rose-600 dark:text-rose-400 font-bold">{usedCount} Used (Locked)</span>
          </div>
        </div>

        {notice && (
          <div className="px-4 py-2.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
            {notice}
          </div>
        )}
        {error && (
          <div className="px-4 py-2.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleCreatePass} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Pass Type *</label>
            <select
              value={form.pass_type}
              onChange={(e) => setForm({ ...form, pass_type: e.target.value as GatePassRecord['pass_type'] })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              {PASS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Select Staff (Optional)</label>
            <select
              value={form.employee_code}
              onChange={(e) => {
                const emp = employees.find((x) => x.employee_id === e.target.value);
                if (emp) {
                  setForm({
                    ...form,
                    employee_code: emp.employee_id,
                    person_name: emp.full_name,
                    department: emp.department,
                  });
                } else {
                  setForm({ ...form, employee_code: '' });
                }
              }}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              <option value="">External Visitor / Custom Holder</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.employee_id}>
                  {emp.employee_id} — {emp.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Bearer Full Name *</label>
            <input
              type="text"
              required
              placeholder="Staff, Driver, or Visitor Name"
              value={form.person_name}
              onChange={(e) => setForm({ ...form, person_name: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Department</label>
            <input
              type="text"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Destination *</label>
            <input
              type="text"
              required
              placeholder="e.g. Addis Ababa / Supplier Site"
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Valid Date (Single-Use)</label>
            <input
              type="date"
              required
              value={form.valid_date}
              onChange={(e) => setForm({ ...form, valid_date: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Vehicle Plate (If Applicable)</label>
            <input
              type="text"
              placeholder="e.g. ET-3-88412-AA"
              value={form.vehicle_plate}
              onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Authorized / Issued By</label>
            <input
              type="text"
              value={form.issued_by}
              onChange={(e) => setForm({ ...form, issued_by: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Purpose / Reason for Gate Exit *</label>
            <input
              type="text"
              required
              placeholder="Official business reason..."
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div className="sm:col-span-2 flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Items / Materials Carried Out</label>
              <input
                type="text"
                placeholder="Quantity, carton count, or 'None'"
                value={form.items_description}
                onChange={(e) => setForm({ ...form, items_description: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Issue Single-Use Pass
            </button>
          </div>
        </form>
      </div>

      {/* Gate Pass Register + Printable Single-Use Pass Card */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="no-print xl:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 p-1 bg-[#F8FAFC] dark:bg-slate-800 rounded-lg text-xs">
              {(['ALL', 'Active', 'Used', 'Cancelled'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 font-semibold rounded ${
                    statusFilter === st ? 'bg-[#18243A] text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {st === 'Used' ? 'Used (Locked)' : st}
                </button>
              ))}
            </div>
            <input
              type="search"
              placeholder="Search GP #, holder, token..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg w-44"
            />
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[600px] overflow-y-auto">
            {filteredPasses.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No gate passes match this filter.</div>
            ) : (
              filteredPasses.map((gp) => {
                const isSelected = selectedPass?.id === gp.id;
                const isUsed = gp.status === 'Used';
                return (
                  <div
                    key={gp.id}
                    className={`p-4 flex items-start justify-between gap-3 transition-colors ${
                      isSelected ? 'bg-[#EAF4FF] dark:bg-slate-800/80' : 'hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <button type="button" onClick={() => setSelectedPass(gp)} className="text-left flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                        <span className="font-bold text-[#18243A] dark:text-[#38BDF8]">{gp.pass_number}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600 dark:text-slate-300">{gp.pass_type}</span>
                        <span className="text-slate-400">·</span>
                        <span
                          className={`font-bold ${
                            isUsed
                              ? 'text-rose-600 dark:text-rose-400'
                              : gp.status === 'Active'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {isUsed ? 'USED ONCE (LOCKED)' : gp.status}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-[#172033] dark:text-white mt-0.5 truncate">
                        {gp.person_name} {gp.employee_code ? `(${gp.employee_code})` : ''}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        Dest: {gp.destination} · Token: <span className="font-mono">{gp.pass_token}</span>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedPass(gp)}
                        className="p-1.5 text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded-lg"
                        title="View Gate Pass"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {gp.status === 'Active' && (
                        <button
                          type="button"
                          onClick={() => handleConsumePass(gp)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg whitespace-nowrap"
                          title="Verify at Gate & Lock Single-Use Pass"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Verify 1x
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeletePass(gp.id)}
                        className="p-1.5 text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
                        title="Delete Pass"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Printable Single-Use Gate Pass Voucher & Guard Verification */}
        <div className="xl:col-span-6 print-only-container space-y-4">
          {selectedPass ? (
            <>
              <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                  <input
                    type="text"
                    value={guardName}
                    onChange={(e) => setGuardName(e.target.value)}
                    placeholder="Gate Guard / Security Officer"
                    className="px-2.5 py-1.5 text-xs bg-[#F8FAFC] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg w-44"
                  />
                  {selectedPass.status === 'Active' ? (
                    <button
                      type="button"
                      onClick={() => handleConsumePass(selectedPass)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verify & Consume (1-Time Only)
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg whitespace-nowrap">
                      <Lock className="w-3.5 h-3.5" />
                      Locked After Single Use
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <ShareButton
                    compact
                    moduleName="Single-Use Gate Pass"
                    reference={selectedPass.pass_number}
                    title={`${selectedPass.pass_type} — ${selectedPass.person_name}`}
                    summary={`Token: ${selectedPass.pass_token}\nStatus: ${selectedPass.status}\nDestination: ${selectedPass.destination}\nPurpose: ${selectedPass.purpose}\nItems: ${selectedPass.items_description || 'None'}\nValid Date: ${selectedPass.valid_date}`}
                  />
                  <SendToApproveButton
                    compact
                    sourceModule="gate-pass"
                    recordRef={selectedPass.pass_number}
                    title={`Gate Pass: ${selectedPass.pass_type} (${selectedPass.person_name})`}
                    summary={`Single-use Gate Pass ${selectedPass.pass_number} (${selectedPass.pass_token}) for ${selectedPass.person_name} to ${selectedPass.destination}.`}
                    fromDepartment={selectedPass.department}
                    defaultTargetDepartment="Security & Gate"
                    onDispatched={() => onRefreshDashboard()}
                  />
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Pass
                  </button>
                </div>
              </div>

              {/* Official Gate Pass Slip */}
              <div className="bg-white border-2 border-[#18243A] rounded-xl p-6 text-[#172033] space-y-4 shadow-sm">
                <div className="flex items-start justify-between pb-3 border-b-2 border-[#18243A]">
                  <div className="flex items-center gap-3">
                    <img src={logoSrc} alt="Seven Sunday" className="h-10 w-auto object-contain" />
                    <div>
                      <div className="text-sm font-bold text-[#18243A]">
                        {company?.company_name || 'Seven Sunday Manufacturing & Trading PLC'}
                      </div>
                      <div className="text-[11px] font-bold text-[#087CEB]">
                        OFFICIAL SINGLE-USE GATE PASS · {selectedPass.pass_type.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-mono text-[11px]">
                    <div className="font-bold text-[#18243A]">{selectedPass.pass_number}</div>
                    <div className="text-[10px] text-slate-500">Token: {selectedPass.pass_token}</div>
                    <div className="text-[10px] text-slate-500">
                      {selectedPass.valid_date} ({toEthiopianDateString(selectedPass.valid_date)})
                    </div>
                  </div>
                </div>

                {/* Single-Use Status Banner */}
                <div
                  className={`px-3.5 py-2 rounded-lg border text-xs font-bold flex items-center justify-between ${
                    selectedPass.status === 'Used'
                      ? 'bg-rose-50 border-rose-300 text-rose-800'
                      : selectedPass.status === 'Active'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-slate-100 border-slate-300 text-slate-700'
                  }`}
                >
                  <span>
                    {selectedPass.status === 'Used'
                      ? 'CONSUMED ONCE — EXPIRED & PERMANENTLY LOCKED (NO RE-ENTRY / REUSE)'
                      : selectedPass.status === 'Active'
                      ? 'ACTIVE SINGLE-USE PASS — VALID FOR ONE EXIT/ENTRY ONLY'
                      : 'CANCELLED PASS'}
                  </span>
                  <span className="font-mono text-[11px]">{selectedPass.pass_token}</span>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Bearer Name</span>
                      <span className="font-bold text-[#172033]">{selectedPass.person_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Staff ID / Department</span>
                      <span className="font-mono font-semibold">
                        {selectedPass.employee_code || 'Visitor'} · {selectedPass.department}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Destination</span>
                      <span className="font-semibold">{selectedPass.destination}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Vehicle Plate</span>
                      <span className="font-mono font-semibold">{selectedPass.vehicle_plate || 'On Foot / N/A'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 block text-[10px]">Authorized Purpose</span>
                      <span className="font-medium">{selectedPass.purpose}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 block text-[10px]">Materials / Items Carried</span>
                      <span className="font-medium">{selectedPass.items_description || 'No company materials declared'}</span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <RealQrCode
                      value={`SS-GATE-1X|${selectedPass.pass_number}|${selectedPass.pass_token}|${selectedPass.status}|${selectedPass.person_name}`}
                      size={88}
                      label={selectedPass.pass_token}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-300 flex items-end justify-between gap-4 text-[10px] text-slate-600">
                  <div>
                    <div className="font-bold text-[#172033]">Issued By: {selectedPass.issued_by}</div>
                    {selectedPass.status === 'Used' ? (
                      <div className="text-rose-700 font-mono mt-0.5">
                        Gate Verified By: {selectedPass.verified_by_guard} @ {selectedPass.used_at?.slice(0, 19).replace('T', ' ')}
                      </div>
                    ) : (
                      <div>Must be surrendered/scanned at Security Gate (Single Use Only)</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {company?.stamp_data && <img src={company.stamp_data} alt="Stamp" className="h-11 w-11 object-contain" />}
                    {company?.signature_data && <img src={company.signature_data} alt="Sign" className="h-9 w-16 object-contain" />}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-xs text-slate-500">
              Select or issue a single-use gate pass to preview and verify at the security gate.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
