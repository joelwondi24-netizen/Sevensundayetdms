import React, { useState } from 'react';
import { CheckCircle2, Send, X } from 'lucide-react';
import { api } from '../api';
import type { DepartmentApprovalRecord, ModuleKey } from '../types';
import { getCustomApprovingDepartments } from '../utils/platformConfig';

interface SendToApproveButtonProps {
  sourceModule: ModuleKey;
  recordRef: string;
  title: string;
  summary: string;
  fromDepartment?: string;
  defaultTargetDepartment?: string;
  customDepartments?: string[];
  compact?: boolean;
  onDispatched?: (record: DepartmentApprovalRecord) => void;
}

export const SendToApproveButton: React.FC<SendToApproveButtonProps> = ({
  sourceModule,
  recordRef,
  title,
  summary,
  fromDepartment = 'Operations',
  defaultTargetDepartment = 'General Manager',
  customDepartments,
  compact = false,
  onDispatched,
}) => {
  const departments =
    customDepartments && customDepartments.length > 0
      ? customDepartments
      : getCustomApprovingDepartments();

  const [open, setOpen] = useState(false);
  const [targetDept, setTargetDept] = useState(
    departments.includes(defaultTargetDepartment) ? defaultTargetDepartment : departments[0]
  );
  const [priority, setPriority] = useState<'Normal' | 'Urgent'>('Normal');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sentRecord, setSentRecord] = useState<DepartmentApprovalRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.post<DepartmentApprovalRecord>('/api/approvals', {
        source_module: sourceModule,
        record_ref: recordRef,
        title,
        summary,
        from_department: fromDepartment,
        target_department: targetDept,
        priority,
        notes,
      });
      setSentRecord(created);
      onDispatched?.(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send for department approval');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSentRecord(null);
          setError(null);
          const list = getCustomApprovingDepartments();
          if (!list.includes(targetDept) && list.length > 0) {
            setTargetDept(list[0]);
          }
          setOpen(true);
        }}
        className={`inline-flex items-center gap-1.5 font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
          compact
            ? 'px-2.5 py-1.5 text-xs text-white bg-[#18243A] hover:bg-[#172033] border-[#18243A]'
            : 'px-3 py-2 text-xs text-white bg-[#18243A] hover:bg-[#172033] border-[#18243A]'
        }`}
        title="Send to Approving Department"
      >
        <Send className="w-3.5 h-3.5 text-[#38BDF8]" />
        <span>Send to Approve Dept</span>
      </button>

      {open && (
        <div className="no-print fixed inset-0 z-50 bg-[#18243A]/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#172033] dark:text-white truncate">
                  Send to Approving Department
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {recordRef} · {title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 text-slate-500 hover:text-[#172033] dark:hover:text-white rounded-lg"
                aria-label="Close approval modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {sentRecord ? (
              <div className="p-6 space-y-4 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <div>
                  <div className="text-sm font-bold text-[#172033] dark:text-white">
                    Dispatched to {sentRecord.target_department}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Tracking Code:{' '}
                    <span className="font-mono font-bold text-[#087CEB]">{sentRecord.request_code}</span> · Status:{' '}
                    {sentRecord.status}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {error && (
                  <div className="px-3 py-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Target Approving Department
                  </label>
                  <select
                    value={targetDept}
                    onChange={(e) => setTargetDept(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Approval Priority
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Normal', 'Urgent'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`py-2 text-xs font-semibold rounded-lg border transition-colors ${
                          priority === p
                            ? p === 'Urgent'
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-[#18243A] text-white border-[#18243A]'
                            : 'bg-[#F8FAFC] dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Approval Notes / Instructions
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add review instructions or deadline for the approving department..."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submitting ? 'Dispatching...' : 'Send for Approval'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};
