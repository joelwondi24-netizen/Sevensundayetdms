import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, FileSpreadsheet, Plus, Printer, Receipt, Trash2, Wallet } from 'lucide-react';
import { api } from '../api';
import type {
  CompanySettings,
  FinanceBudget,
  FinanceVoucher,
  JournalEntry,
  LedgerAccount,
} from '../types';
import { formatMoney } from '../utils/ethiopianCalendar';
import { RealQrCode } from './RealQrCode';
import { printWithAutoFit } from '../utils/printFit';

interface FinanceModuleProps {
  company?: CompanySettings | null;
  currency?: string;
  onRefreshDashboard: () => void;
}

export const FinanceModule: React.FC<FinanceModuleProps> = ({
  company,
  currency = 'ETB',
  onRefreshDashboard,
}) => {
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [vouchers, setVouchers] = useState<FinanceVoucher[]>([]);
  const [budgets, setBudgets] = useState<FinanceBudget[]>([]);
  const [tab, setTab] = useState<'vouchers' | 'journal' | 'statements' | 'budgets'>('vouchers');
  const [statementView, setStatementView] = useState<'trial' | 'pnl' | 'balance-sheet'>('trial');
  const [selectedVoucher, setSelectedVoucher] = useState<FinanceVoucher | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const [vchForm, setVchForm] = useState({
    voucher_type: 'Cash Payment' as FinanceVoucher['voucher_type'],
    voucher_date: today,
    party_name: '',
    payment_method: 'Cash',
    bank_reference: '',
    debit_account_id: 1,
    credit_account_id: 1,
    amount: '2500',
    description: '',
  });

  const [accForm, setAccForm] = useState({
    code: '',
    name: '',
    account_type: 'Asset' as LedgerAccount['account_type'],
  });

  const [jeForm, setJeForm] = useState({
    entry_date: today,
    reference: '',
    description: '',
    lines: [
      { account_id: 1, debit: '1000', credit: '0', memo: '' },
      { account_id: 6, debit: '0', credit: '1000', memo: '' },
    ],
  });

  const [budgetForm, setBudgetForm] = useState({
    fiscal_year: String(new Date().getFullYear()),
    department: 'Operations',
    account_id: 1,
    allocated_amount: '50000',
    notes: '',
  });

  const loadFinance = async () => {
    try {
      const [a, j, v, b] = await Promise.all([
        api.get<LedgerAccount[]>('/api/accounts'),
        api.get<JournalEntry[]>('/api/journal-entries'),
        api.get<FinanceVoucher[]>('/api/finance-vouchers').catch(() => []),
        api.get<FinanceBudget[]>('/api/finance-budgets').catch(() => []),
      ]);
      setAccounts(a);
      setEntries(j);
      setVouchers(v);
      setBudgets(b);
      if (v.length > 0 && !selectedVoucher) setSelectedVoucher(v[0]);
      if (a.length >= 2) {
        const cashAcc = a.find((x) => x.account_type === 'Asset') || a[0];
        const expAcc = a.find((x) => x.account_type === 'Expense') || a[1];
        setVchForm((prev) => ({
          ...prev,
          debit_account_id: prev.debit_account_id === 1 ? expAcc.id : prev.debit_account_id,
          credit_account_id: prev.credit_account_id === 1 ? cashAcc.id : prev.credit_account_id,
        }));
        setBudgetForm((prev) => ({ ...prev, account_id: expAcc.id }));
        setJeForm((prev) => ({
          ...prev,
          lines: prev.lines.map((l, idx) => ({ ...l, account_id: a[idx]?.id || a[0].id })),
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load finance data');
    }
  };

  useEffect(() => {
    loadFinance();
  }, []);

  const draftTotals = useMemo(() => {
    const debit = jeForm.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const credit = jeForm.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return {
      debit,
      credit,
      balanced: debit > 0 && Math.abs(debit - credit) < 0.005,
    };
  }, [jeForm.lines]);

  const trialTotals = useMemo(() => {
    return accounts.reduce(
      (acc, a) => {
        acc.debit += Number(a.debit_total) || 0;
        acc.credit += Number(a.credit_total) || 0;
        return acc;
      },
      { debit: 0, credit: 0 }
    );
  }, [accounts]);

  const statementMetrics = useMemo(() => {
    const revenueAccounts = accounts.filter((a) => a.account_type === 'Revenue');
    const expenseAccounts = accounts.filter((a) => a.account_type === 'Expense');
    const assetAccounts = accounts.filter((a) => a.account_type === 'Asset');
    const liabilityAccounts = accounts.filter((a) => a.account_type === 'Liability');
    const equityAccounts = accounts.filter((a) => a.account_type === 'Equity');

    const totalRevenue = revenueAccounts.reduce((s, a) => s + a.balance, 0);
    const totalExpenses = expenseAccounts.reduce((s, a) => s + a.balance, 0);
    const netIncome = totalRevenue - totalExpenses;

    const totalAssets = assetAccounts.reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = liabilityAccounts.reduce((s, a) => s + a.balance, 0);
    const totalEquity = equityAccounts.reduce((s, a) => s + a.balance, 0) + netIncome;

    return {
      revenueAccounts,
      expenseAccounts,
      assetAccounts,
      liabilityAccounts,
      equityAccounts,
      totalRevenue,
      totalExpenses,
      netIncome,
      totalAssets,
      totalLiabilities,
      totalEquity,
    };
  }, [accounts]);

  const logoSrc = company?.logo_data || '/assets/aistudio/Seven_Sunday_Logo_2_desktop_addf2fa7.png';

  return (
    <div className="space-y-6">
      {/* Header & Navigation */}
      <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#172033] dark:text-white">
              Finance & Double-Entry Accounting ({currency})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cash & Bank vouchers, automated double-entry journal ledger, Trial Balance, P&L, Balance Sheet, and Department Budgets ({currency}).
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
            <span>Dr {formatMoney(trialTotals.debit, currency)}</span>
            <span>·</span>
            <span>Cr {formatMoney(trialTotals.credit, currency)}</span>
            <button
              type="button"
              onClick={() => printWithAutoFit({ orientation: 'portrait' })}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#18243A] hover:bg-[#172033] rounded-lg whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-[#087CEB]" />
              Print
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          {(
            [
              ['vouchers', `Vouchers (${vouchers.length})`, <Receipt className="w-3.5 h-3.5" />],
              ['journal', `Journal Ledger (${entries.length})`, <BookOpen className="w-3.5 h-3.5" />],
              ['statements', 'Financial Statements', <FileSpreadsheet className="w-3.5 h-3.5" />],
              ['budgets', `Budgets (${budgets.length})`, <Wallet className="w-3.5 h-3.5" />],
            ] as const
          ).map(([key, label, icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap ${
                tab === key
                  ? 'bg-[#18243A] text-white'
                  : 'bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-slate-200 hover:bg-[#EAF4FF]'
              }`}
            >
              <span className={tab === key ? 'text-[#087CEB]' : 'text-[#18243A] dark:text-[#38BDF8]'}>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="no-print px-4 py-2.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      {/* TAB 1: CASH & BANK VOUCHERS */}
      {tab === 'vouchers' && (
        <div className="space-y-6">
          <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h3 className="text-base font-bold text-[#172033] dark:text-white mb-1">
              Issue Cash or Bank Voucher (Auto-Posts Balanced Double-Entry)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Every Cash/Bank Payment or Receipt automatically posts a balanced Journal Entry and creates a printable QR voucher.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                try {
                  const created = await api.post<FinanceVoucher>('/api/finance-vouchers', {
                    ...vchForm,
                    debit_account_id: Number(vchForm.debit_account_id),
                    credit_account_id: Number(vchForm.credit_account_id),
                    amount: Number(vchForm.amount),
                  });
                  setVouchers((prev) => [created, ...prev]);
                  setSelectedVoucher(created);
                  setVchForm((prev) => ({ ...prev, party_name: '', bank_reference: '', description: '' }));
                  await loadFinance();
                  onRefreshDashboard();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to post voucher');
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
            >
              <select
                value={vchForm.voucher_type}
                onChange={(e) => setVchForm({ ...vchForm, voucher_type: e.target.value as FinanceVoucher['voucher_type'] })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="Cash Payment">Cash Payment Voucher</option>
                <option value="Cash Receipt">Cash Receipt Voucher</option>
                <option value="Bank Payment">Bank Payment Voucher</option>
                <option value="Bank Receipt">Bank Receipt Voucher</option>
              </select>
              <input
                type="date"
                value={vchForm.voucher_date}
                onChange={(e) => setVchForm({ ...vchForm, voucher_date: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                required
                placeholder="Payee / Payer Name"
                value={vchForm.party_name}
                onChange={(e) => setVchForm({ ...vchForm, party_name: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="number"
                step="0.01"
                required
                placeholder={`Amount (${currency})`}
                value={vchForm.amount}
                onChange={(e) => setVchForm({ ...vchForm, amount: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <select
                value={vchForm.debit_account_id}
                onChange={(e) => setVchForm({ ...vchForm, debit_account_id: Number(e.target.value) })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>Dr: {a.code} — {a.name}</option>
                ))}
              </select>
              <select
                value={vchForm.credit_account_id}
                onChange={(e) => setVchForm({ ...vchForm, credit_account_id: Number(e.target.value) })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>Cr: {a.code} — {a.name}</option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="Purpose / Description"
                value={vchForm.description}
                onChange={(e) => setVchForm({ ...vchForm, description: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Post Voucher
              </button>
            </form>
          </div>

          <div className="print-grid-reset grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="no-print lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <th className="py-3 px-4">Voucher #</th>
                      <th className="py-3 px-4">Type & Party</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {vouchers.map((v) => (
                      <tr key={v.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono text-xs font-bold">{v.voucher_number}</td>
                        <td className="py-3 px-4 text-xs">
                          <div className="font-semibold text-[#172033] dark:text-white">{v.voucher_type} · {v.party_name}</div>
                          <div className="text-slate-500">{v.voucher_date} · {v.description}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs font-bold tabular-nums">
                          {formatMoney(v.amount, currency)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedVoucher(v)}
                              className="px-2.5 py-1 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded"
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await api.del(`/api/finance-vouchers/${v.id}`);
                                await loadFinance();
                                onRefreshDashboard();
                              }}
                              className="p-1.5 text-red-700 bg-red-50 hover:bg-red-100 rounded"
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

            {/* Printable QR Voucher */}
            <div
              data-print-active="true"
              data-print-orientation="portrait"
              className="lg:col-span-5 print-only-container bg-white border border-slate-300 rounded-xl p-6 text-[#172033]"
            >
              {selectedVoucher ? (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between pb-3 border-b-2 border-[#18243A]">
                    <div className="flex items-center gap-2.5">
                      <img src={logoSrc} alt="Seven Sunday" className="h-9 w-auto object-contain" />
                      <div>
                        <div className="font-bold text-sm text-[#18243A]">{selectedVoucher.voucher_type}</div>
                        <div className="text-[11px] text-slate-500">{company?.company_name || 'Seven Sunday Ethiopia'}</div>
                      </div>
                    </div>
                    <RealQrCode
                      value={`SS-VOUCHER|${selectedVoucher.voucher_number}|${selectedVoucher.voucher_type}|${selectedVoucher.amount}|${selectedVoucher.voucher_date}`}
                      size={66}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 bg-[#F8FAFC] p-3 rounded border border-slate-200 font-mono">
                    <div>No: <b>{selectedVoucher.voucher_number}</b></div>
                    <div>Date: <b>{selectedVoucher.voucher_date}</b></div>
                    <div className="col-span-2">Party: <b>{selectedVoucher.party_name}</b></div>
                    <div>Dr: {selectedVoucher.debit_account_name}</div>
                    <div>Cr: {selectedVoucher.credit_account_name}</div>
                  </div>
                  <div className="text-sm font-bold text-[#18243A] flex justify-between py-2 border-y border-slate-200">
                    <span>Total Amount:</span>
                    <span className="font-mono">{formatMoney(selectedVoucher.amount, currency)}</span>
                  </div>
                  <p className="text-slate-700">{selectedVoucher.description}</p>
                  <div className="pt-3 flex items-center justify-between">
                    <span>Prepared: {selectedVoucher.created_by}</span>
                    <div className="flex items-center gap-2">
                      {company?.stamp_data && <img src={company.stamp_data} alt="Stamp" className="h-9 w-9 object-contain" />}
                      {company?.signature_data && <img src={company.signature_data} alt="Signature" className="h-7 w-14 object-contain" />}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-xs text-slate-500">Select a voucher to preview & print.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: JOURNAL LEDGER & CHART OF ACCOUNTS */}
      {tab === 'journal' && (
        <div className="space-y-6">
          <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <h3 className="text-base font-bold text-[#172033] dark:text-white">Post Double-Entry Journal Entry</h3>
              <div className={`text-xs font-mono font-semibold tabular-nums ${draftTotals.balanced ? 'text-emerald-700' : 'text-red-700'}`}>
                Dr {draftTotals.debit.toFixed(2)} / Cr {draftTotals.credit.toFixed(2)} {draftTotals.balanced ? '· Balanced' : '· Out of Balance'}
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                try {
                  await api.post<JournalEntry>('/api/journal-entries', {
                    entry_date: jeForm.entry_date,
                    reference: jeForm.reference,
                    description: jeForm.description,
                    lines: jeForm.lines.map((l) => ({
                      account_id: Number(l.account_id),
                      debit: Number(l.debit) || 0,
                      credit: Number(l.credit) || 0,
                      memo: l.memo,
                    })),
                  });
                  await loadFinance();
                  setJeForm((prev) => ({ ...prev, reference: '', description: '' }));
                  onRefreshDashboard();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to post journal entry');
                }
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="date"
                  required
                  value={jeForm.entry_date}
                  onChange={(e) => setJeForm({ ...jeForm, entry_date: e.target.value })}
                  className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Reference"
                  value={jeForm.reference}
                  onChange={(e) => setJeForm({ ...jeForm, reference: e.target.value })}
                  className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
                <input
                  type="text"
                  required
                  placeholder="Journal Description"
                  value={jeForm.description}
                  onChange={(e) => setJeForm({ ...jeForm, description: e.target.value })}
                  className="sm:col-span-2 px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              {jeForm.lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <select
                    value={line.account_id}
                    onChange={(e) => {
                      const next = [...jeForm.lines];
                      next[idx].account_id = Number(e.target.value);
                      setJeForm({ ...jeForm, lines: next });
                    }}
                    className="sm:col-span-5 px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Debit"
                    value={line.debit}
                    onChange={(e) => {
                      const next = [...jeForm.lines];
                      next[idx].debit = e.target.value;
                      setJeForm({ ...jeForm, lines: next });
                    }}
                    className="sm:col-span-2 px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Credit"
                    value={line.credit}
                    onChange={(e) => {
                      const next = [...jeForm.lines];
                      next[idx].credit = e.target.value;
                      setJeForm({ ...jeForm, lines: next });
                    }}
                    className="sm:col-span-2 px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Line memo"
                    value={line.memo}
                    onChange={(e) => {
                      const next = [...jeForm.lines];
                      next[idx].memo = e.target.value;
                      setJeForm({ ...jeForm, lines: next });
                    }}
                    className="sm:col-span-2 px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <button
                    type="button"
                    disabled={jeForm.lines.length <= 2}
                    onClick={() => setJeForm({ ...jeForm, lines: jeForm.lines.filter((_, i) => i !== idx) })}
                    className="sm:col-span-1 px-2 py-2 text-xs text-red-700 bg-red-50 rounded-lg disabled:opacity-40"
                  >
                    Del
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setJeForm({
                      ...jeForm,
                      lines: [...jeForm.lines, { account_id: accounts[0]?.id || 1, debit: '0', credit: '0', memo: '' }],
                    })
                  }
                  className="px-3 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 rounded-lg"
                >
                  + Add Line
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                  Post Journal Entry
                </button>
              </div>
            </form>
          </div>

          <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h3 className="text-base font-bold text-[#172033] dark:text-white mb-3">Add Ledger Account ({accounts.length})</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await api.post('/api/accounts', accForm);
                setAccForm({ code: '', name: '', account_type: 'Asset' });
                await loadFinance();
              }}
              className="grid grid-cols-1 sm:grid-cols-4 gap-3"
            >
              <input
                type="text"
                required
                placeholder="Code (e.g. 6200)"
                value={accForm.code}
                onChange={(e) => setAccForm({ ...accForm, code: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                required
                placeholder="Account Name"
                value={accForm.name}
                onChange={(e) => setAccForm({ ...accForm, name: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <select
                value={accForm.account_type}
                onChange={(e) => setAccForm({ ...accForm, account_type: e.target.value as LedgerAccount['account_type'] })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="Asset">Asset</option>
                <option value="Liability">Liability</option>
                <option value="Equity">Equity</option>
                <option value="Revenue">Revenue</option>
                <option value="Expense">Expense</option>
              </select>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-[#18243A] rounded-lg">
                Add Account
              </button>
            </form>
          </div>

          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-[#F8FAFC] dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-[#18243A] dark:text-[#38BDF8]">{entry.entry_number}</span>
                    <span className="mx-2 text-slate-400">·</span>
                    <span className="font-mono text-xs text-slate-500">{entry.entry_date}</span>
                    <div className="text-sm font-semibold text-[#172033] dark:text-white">{entry.description}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-semibold tabular-nums">
                      Dr {entry.total_debit.toFixed(2)} / Cr {entry.total_credit.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        await api.del(`/api/journal-entries/${entry.id}`);
                        await loadFinance();
                        onRefreshDashboard();
                      }}
                      className="no-print inline-flex items-center gap-1 px-2.5 py-1 text-xs text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {entry.lines.map((line, i) => (
                      <tr key={line.id || i}>
                        <td className="py-2 px-4 font-medium"><span className="font-mono text-slate-500 mr-2">{line.account_code}</span>{line.account_name}</td>
                        <td className="py-2 px-4 text-slate-500">{line.memo}</td>
                        <td className="py-2 px-4 text-right font-mono tabular-nums">{line.debit > 0 ? line.debit.toFixed(2) : '—'}</td>
                        <td className="py-2 px-4 text-right font-mono tabular-nums">{line.credit > 0 ? line.credit.toFixed(2) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: FINANCIAL STATEMENTS (TRIAL BALANCE, P&L, BALANCE SHEET IN ETB) */}
      {tab === 'statements' && (
        <div
          data-print-active="true"
          data-print-orientation="portrait"
          className="space-y-6 print-only-container"
        >
          <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-wrap items-center gap-2">
            {(
              [
                ['trial', 'Trial Balance'],
                ['pnl', 'Profit & Loss (Income Statement)'],
                ['balance-sheet', 'Balance Sheet'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setStatementView(k)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg ${
                  statementView === k ? 'bg-[#18243A] text-white' : 'bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {statementView === 'trial' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-base font-bold text-[#172033] dark:text-white">Trial Balance ({currency})</h3>
                <span className="text-xs font-semibold text-emerald-700">
                  {Math.abs(trialTotals.debit - trialTotals.credit) < 0.01 ? 'Ledger Balanced' : 'Variance'}
                </span>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 font-semibold">
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Account</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Debit ({currency})</th>
                    <th className="py-3 px-4 text-right">Credit ({currency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {accounts.map((a) => (
                    <tr key={a.id}>
                      <td className="py-2.5 px-4 font-mono">{a.code}</td>
                      <td className="py-2.5 px-4 font-medium">{a.name}</td>
                      <td className="py-2.5 px-4 text-slate-500">{a.account_type}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">{a.debit_total.toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">{a.credit_total.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#18243A] text-white font-bold">
                    <td colSpan={3} className="py-3 px-4">Total</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{formatMoney(trialTotals.debit, currency)}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{formatMoney(trialTotals.credit, currency)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {statementView === 'pnl' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <h3 className="text-base font-bold text-[#172033] dark:text-white">
                Profit & Loss Statement ({currency})
              </h3>
              <div className="space-y-2 text-sm">
                <div className="text-xs font-bold uppercase text-slate-500">Revenue</div>
                {statementMetrics.revenueAccounts.map((a) => (
                  <div key={a.id} className="flex justify-between font-mono text-xs border-b border-slate-100 dark:border-slate-800 py-1.5">
                    <span>{a.code} — {a.name}</span>
                    <span>{formatMoney(a.balance, currency)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-xs pt-1">
                  <span>Total Revenue</span>
                  <span className="font-mono">{formatMoney(statementMetrics.totalRevenue, currency)}</span>
                </div>

                <div className="text-xs font-bold uppercase text-slate-500 pt-4">Operating Expenses</div>
                {statementMetrics.expenseAccounts.map((a) => (
                  <div key={a.id} className="flex justify-between font-mono text-xs border-b border-slate-100 dark:border-slate-800 py-1.5">
                    <span>{a.code} — {a.name}</span>
                    <span>{formatMoney(a.balance, currency)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-xs pt-1">
                  <span>Total Expenses</span>
                  <span className="font-mono">{formatMoney(statementMetrics.totalExpenses, currency)}</span>
                </div>

                <div className="mt-4 p-4 bg-[#18243A] text-white rounded-lg flex justify-between font-bold">
                  <span>Net Profit / (Loss)</span>
                  <span className="font-mono text-[#38BDF8]">{formatMoney(statementMetrics.netIncome, currency)}</span>
                </div>
              </div>
            </div>
          )}

          {statementView === 'balance-sheet' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
                <h3 className="text-base font-bold text-[#172033] dark:text-white">Assets ({currency})</h3>
                {statementMetrics.assetAccounts.map((a) => (
                  <div key={a.id} className="flex justify-between font-mono text-xs border-b border-slate-100 dark:border-slate-800 py-1.5">
                    <span>{a.code} — {a.name}</span>
                    <span>{formatMoney(a.balance, currency)}</span>
                  </div>
                ))}
                <div className="p-3 bg-[#18243A] text-white rounded-lg flex justify-between font-bold text-xs">
                  <span>Total Assets</span>
                  <span className="font-mono text-[#38BDF8]">{formatMoney(statementMetrics.totalAssets, currency)}</span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
                <h3 className="text-base font-bold text-[#172033] dark:text-white">Liabilities & Equity ({currency})</h3>
                {statementMetrics.liabilityAccounts.map((a) => (
                  <div key={a.id} className="flex justify-between font-mono text-xs border-b border-slate-100 dark:border-slate-800 py-1.5">
                    <span>{a.code} — {a.name}</span>
                    <span>{formatMoney(a.balance, currency)}</span>
                  </div>
                ))}
                {statementMetrics.equityAccounts.map((a) => (
                  <div key={a.id} className="flex justify-between font-mono text-xs border-b border-slate-100 dark:border-slate-800 py-1.5">
                    <span>{a.code} — {a.name}</span>
                    <span>{formatMoney(a.balance, currency)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-mono text-xs border-b border-slate-100 dark:border-slate-800 py-1.5">
                  <span>Current Period Retained Earnings</span>
                  <span>{formatMoney(statementMetrics.netIncome, currency)}</span>
                </div>
                <div className="p-3 bg-[#18243A] text-white rounded-lg flex justify-between font-bold text-xs">
                  <span>Total Liabilities & Equity</span>
                  <span className="font-mono text-[#38BDF8]">
                    {formatMoney(statementMetrics.totalLiabilities + statementMetrics.totalEquity, currency)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BUDGETS */}
      {tab === 'budgets' && (
        <div className="space-y-6">
          <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h3 className="text-base font-bold text-[#172033] dark:text-white mb-4">Department Budget Allocation ({currency})</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const created = await api.post<FinanceBudget>('/api/finance-budgets', {
                  ...budgetForm,
                  account_id: Number(budgetForm.account_id),
                  allocated_amount: Number(budgetForm.allocated_amount),
                });
                setBudgets((prev) => [created, ...prev]);
                setBudgetForm((prev) => ({ ...prev, notes: '' }));
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
            >
              <input
                type="text"
                required
                placeholder="Fiscal Year"
                value={budgetForm.fiscal_year}
                onChange={(e) => setBudgetForm({ ...budgetForm, fiscal_year: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                required
                placeholder="Department"
                value={budgetForm.department}
                onChange={(e) => setBudgetForm({ ...budgetForm, department: e.target.value })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <select
                value={budgetForm.account_id}
                onChange={(e) => setBudgetForm({ ...budgetForm, account_id: Number(e.target.value) })}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
              <input
                type="number"
                required
                placeholder="Allocated Amount"
                value={budgetForm.allocated_amount}
                onChange={(e) => setBudgetForm({ ...budgetForm, allocated_amount: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Save Budget
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <th className="py-3 px-4">FY / Department</th>
                  <th className="py-3 px-4">Account</th>
                  <th className="py-3 px-4 text-right">Allocated Budget</th>
                  <th className="py-3 px-4 text-right">Actual Spend</th>
                  <th className="py-3 px-4 text-right">Remaining</th>
                  <th className="py-3 px-4 text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {budgets.map((b) => {
                  const acc = accounts.find((a) => a.id === b.account_id);
                  const actual = acc ? acc.balance : 0;
                  const remaining = b.allocated_amount - actual;
                  return (
                    <tr key={b.id}>
                      <td className="py-3 px-4 text-xs">
                        <div className="font-semibold">{b.department}</div>
                        <div className="font-mono text-slate-500">FY {b.fiscal_year}</div>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono">{b.account_code} — {b.account_name}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">{formatMoney(b.allocated_amount, currency)}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">{formatMoney(actual, currency)}</td>
                      <td className={`py-3 px-4 text-right font-mono text-xs font-bold tabular-nums ${remaining < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                        {formatMoney(remaining, currency)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            await api.del(`/api/finance-budgets/${b.id}`);
                            setBudgets((prev) => prev.filter((x) => x.id !== b.id));
                          }}
                          className="no-print p-1.5 text-red-700 bg-red-50 hover:bg-red-100 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
