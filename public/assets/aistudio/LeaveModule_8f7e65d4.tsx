import React, { useEffect, useState } from 'react';
import { Check, Save, Trash2, X } from 'lucide-react';
import { api } from '../api';
import type { LeaveRecord } from '../types';

export const LeaveModule: React.FC<{ onRefreshDashboard: () => void }> = ({ onRefreshDashboard }) => {
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    employee_code: 'EMP-1030',
    employee_name: '',
    department: 'Operations',
    leave_type: 'Annual' as LeaveRecord['leave_type'],
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    days: '1',
    reason: '',
  });

  const loadLeaves = async () => {
    try {
      const data = await api.get<LeaveRecord[]>('/api/leaves');
      setLeaves(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaves');
    }
  };

  useEffect(() => {
    loadLeaves();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const created = await api.post<LeaveRecord>('/api/leaves', {
        ...form,
        days: Number(form.days) || 1,
      });
      setLeaves((prev) => [created, ...prev]);
      setForm((prev) => ({ ...prev, employee_name: '', reason: '' }));
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit leave request');
    }
  };

  const handleUpdateStatus = async (id: number, status: LeaveRecord['status']) => {
    setError(null);
    try {
      const updated = await api.patch<LeaveRecord>(`/api/leaves/${id}/status`, { status });
      setLeaves((prev) => prev.map((l) => (l.id === id ? updated : l)));
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update leave status');
    }
  };

  const handleDelete = async (id: number) => {
    setError(null);
    try {
      await api.del(`/api/leaves/${id}`);
      setLeaves((prev) => prev.filter((l) => l.id !== id));
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete leave record');
    }
  };

  const visibleLeaves = leaves.filter((l) => filterStatus === 'All' || l.status === filterStatus);

  return (
    <div className="space-y-6">
      <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-bold text-[#172033] dark:text-white mb-1">Leave Management</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Submit, approve, reject, or delete employee leave records across all departments.
        </p>
        {error && (
          <div className="mb-4 px-4 py-2.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Employee Code</label>
            <input
              type="text"
              value={form.employee_code}
              onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Employee Name</label>
            <input
              type="text"
              required
              placeholder="Employee full name"
              value={form.employee_name}
              onChange={(e) => setForm({ ...form, employee_name: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Department</label>
            <input
              type="text"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Leave Type</label>
            <select
              value={form.leave_type}
              onChange={(e) => setForm({ ...form, leave_type: e.target.value as LeaveRecord['leave_type'] })}
              className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              <option value="Annual">Annual</option>
              <option value="Sick">Sick</option>
              <option value="Emergency">Emergency</option>
              <option value="Maternity/Paternity">Maternity/Paternity</option>
              <option value="Unpaid">Unpaid</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Start Date</label>
            <input
              type="date"
              required
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">End Date</label>
            <input
              type="date"
              required
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Total Days</label>
            <input
              type="number"
              min="1"
              value={form.days}
              onChange={(e) => setForm({ ...form, days: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#172033] dark:text-slate-300 mb-1">Reason</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Leave reason"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap shrink-0"
              >
                <Save className="w-4 h-4" />
                Save & Submit
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-[#172033] dark:text-white">Leave Requests Register</h3>
          <div className="flex items-center gap-1 p-1 bg-[#F8FAFC] dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            {(['All', 'Pending', 'Approved', 'Rejected'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  filterStatus === status ? 'bg-[#18243A] text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#18243A] text-white text-xs font-semibold">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Leave Type</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4 text-right">Days</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {visibleLeaves.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    No leave records found.
                  </td>
                </tr>
              ) : (
                visibleLeaves.map((leave) => (
                  <tr key={leave.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#172033] dark:text-white">{leave.employee_name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {leave.employee_code} · {leave.department}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-[#172033] dark:text-slate-200">{leave.leave_type}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums">
                      {leave.start_date} → {leave.end_date}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-[#172033] dark:text-white tabular-nums">
                      {leave.days}d
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 max-w-[240px] truncate">{leave.reason}</td>
                    <td className="py-3 px-4 text-xs font-semibold">
                      <span
                        className={
                          leave.status === 'Approved'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : leave.status === 'Rejected'
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-[#087CEB]'
                        }
                      >
                        {leave.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        {leave.status !== 'Approved' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(leave.id, 'Approved')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 rounded-lg whitespace-nowrap shrink-0"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve
                          </button>
                        )}
                        {leave.status !== 'Rejected' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(leave.id, 'Rejected')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] border border-[#087CEB]/30 hover:bg-[#BFDBFE] rounded-lg whitespace-nowrap shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(leave.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 rounded-lg whitespace-nowrap shrink-0"
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
    </div>
  );
};
