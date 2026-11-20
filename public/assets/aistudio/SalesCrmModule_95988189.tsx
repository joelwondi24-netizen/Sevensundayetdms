import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import type { CrmDeal, SalesOrder } from '../types';

export const SalesCrmModule: React.FC<{ onRefreshDashboard: () => void }> = ({ onRefreshDashboard }) => {
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [subTab, setSubTab] = useState<'crm' | 'orders'>('crm');
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const [dealForm, setDealForm] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    stage: 'Lead' as CrmDeal['stage'],
    deal_value: '15000',
    assigned_rep: 'Grace Okafor',
    last_contact: today,
    notes: '',
  });

  const [orderForm, setOrderForm] = useState({
    customer_name: '',
    product_service: '',
    quantity: '1',
    amount: '12000',
    order_date: today,
    payment_status: 'Pending' as SalesOrder['payment_status'],
  });

  const loadData = async () => {
    try {
      const [d, s] = await Promise.all([
        api.get<CrmDeal[]>('/api/crm'),
        api.get<SalesOrder[]>('/api/sales-orders'),
      ]);
      setDeals(d);
      setSalesOrders(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Sales & CRM');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSubTab('crm')}
          className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap ${
            subTab === 'crm' ? 'bg-[#087CEB] text-white' : 'text-[#172033] dark:text-slate-300 hover:bg-[#F8FAFC] dark:hover:bg-slate-800'
          }`}
        >
          CRM Pipeline & Leads ({deals.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('orders')}
          className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap ${
            subTab === 'orders' ? 'bg-[#087CEB] text-white' : 'text-[#172033] dark:text-slate-300 hover:bg-[#F8FAFC] dark:hover:bg-slate-800'
          }`}
        >
          Sales Orders & Invoices ({salesOrders.length})
        </button>
      </div>

      {error && (
        <div className="px-4 py-2.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg">
          {error}
        </div>
      )}

      {subTab === 'crm' ? (
        <div className="space-y-6">
          <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-[#172033] dark:text-white mb-4">Add CRM Opportunity</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                try {
                  const created = await api.post<CrmDeal>('/api/crm', {
                    ...dealForm,
                    deal_value: Number(dealForm.deal_value),
                  });
                  setDeals((prev) => [created, ...prev]);
                  setDealForm({ ...dealForm, company_name: '', contact_person: '', email: '', phone: '', notes: '' });
                  onRefreshDashboard();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to create deal');
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
            >
              <input
                type="text"
                required
                placeholder="Company Name"
                value={dealForm.company_name}
                onChange={(e) => setDealForm({ ...dealForm, company_name: e.target.value })}
                className="px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                required
                placeholder="Contact Person"
                value={dealForm.contact_person}
                onChange={(e) => setDealForm({ ...dealForm, contact_person: e.target.value })}
                className="px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="email"
                placeholder="Email"
                value={dealForm.email}
                onChange={(e) => setDealForm({ ...dealForm, email: e.target.value })}
                className="px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <select
                value={dealForm.stage}
                onChange={(e) => setDealForm({ ...dealForm, stage: e.target.value as CrmDeal['stage'] })}
                className="px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="Lead">Lead</option>
                <option value="Qualified">Qualified</option>
                <option value="Proposal">Proposal</option>
                <option value="Negotiation">Negotiation</option>
                <option value="Closed Won">Closed Won</option>
                <option value="Closed Lost">Closed Lost</option>
              </select>
              <input
                type="number"
                placeholder="Deal Value"
                value={dealForm.deal_value}
                onChange={(e) => setDealForm({ ...dealForm, deal_value: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                placeholder="Assigned Rep"
                value={dealForm.assigned_rep}
                onChange={(e) => setDealForm({ ...dealForm, assigned_rep: e.target.value })}
                className="px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                placeholder="Notes"
                value={dealForm.notes}
                onChange={(e) => setDealForm({ ...dealForm, notes: e.target.value })}
                className="px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Add Opportunity
              </button>
            </form>
          </div>

          <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#18243A] text-white text-xs font-semibold">
                    <th className="py-3 px-4">Company & Contact</th>
                    <th className="py-3 px-4">Rep</th>
                    <th className="py-3 px-4">Stage</th>
                    <th className="py-3 px-4 text-right">Deal Value</th>
                    <th className="py-3 px-4">Last Contact</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {deals.map((d) => (
                    <tr key={d.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#172033] dark:text-white">{d.company_name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {d.contact_person} · {d.email}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">{d.assigned_rep}</td>
                      <td className="py-3 px-4">
                        <select
                          value={d.stage}
                          onChange={async (e) => {
                            const updated = await api.patch<CrmDeal>(`/api/crm/${d.id}/stage`, {
                              stage: e.target.value,
                            });
                            setDeals((prev) => prev.map((x) => (x.id === d.id ? updated : x)));
                            onRefreshDashboard();
                          }}
                          className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white"
                        >
                          <option value="Lead">Lead</option>
                          <option value="Qualified">Qualified</option>
                          <option value="Proposal">Proposal</option>
                          <option value="Negotiation">Negotiation</option>
                          <option value="Closed Won">Closed Won</option>
                          <option value="Closed Lost">Closed Lost</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-[#172033] dark:text-white tabular-nums">
                        {d.deal_value.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">{d.last_contact}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            await api.del(`/api/crm/${d.id}`);
                            setDeals((prev) => prev.filter((x) => x.id !== d.id));
                            onRefreshDashboard();
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 rounded-lg whitespace-nowrap"
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
      ) : (
        <div className="space-y-6">
          <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-[#172033] dark:text-white mb-4">Create Sales Order</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                try {
                  const created = await api.post<SalesOrder>('/api/sales-orders', {
                    ...orderForm,
                    quantity: Number(orderForm.quantity),
                    amount: Number(orderForm.amount),
                  });
                  setSalesOrders((prev) => [created, ...prev]);
                  setOrderForm({ ...orderForm, customer_name: '', product_service: '' });
                  onRefreshDashboard();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to create sales order');
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
            >
              <input
                type="text"
                required
                placeholder="Customer Name"
                value={orderForm.customer_name}
                onChange={(e) => setOrderForm({ ...orderForm, customer_name: e.target.value })}
                className="px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                required
                placeholder="Product / Service"
                value={orderForm.product_service}
                onChange={(e) => setOrderForm({ ...orderForm, product_service: e.target.value })}
                className="px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="number"
                placeholder="Amount"
                value={orderForm.amount}
                onChange={(e) => setOrderForm({ ...orderForm, amount: e.target.value })}
                className="px-3 py-2 text-sm font-mono bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <select
                value={orderForm.payment_status}
                onChange={(e) =>
                  setOrderForm({ ...orderForm, payment_status: e.target.value as SalesOrder['payment_status'] })
                }
                className="px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
              </select>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Add Order
              </button>
            </form>
          </div>

          <div className="bg-[#FFFFFF] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#18243A] text-white text-xs font-semibold">
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Product / Service</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {salesOrders.map((s) => (
                    <tr key={s.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-[#172033] dark:text-white">{s.order_number}</td>
                      <td className="py-3 px-4 font-medium text-[#172033] dark:text-white">{s.customer_name}</td>
                      <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">{s.product_service}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-[#172033] dark:text-white tabular-nums">
                        {s.amount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={s.payment_status}
                          onChange={async (e) => {
                            const updated = await api.patch<SalesOrder>(`/api/sales-orders/${s.id}/status`, {
                              payment_status: e.target.value,
                            });
                            setSalesOrders((prev) => prev.map((x) => (x.id === s.id ? updated : x)));
                            onRefreshDashboard();
                          }}
                          className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-[#F8FAFC] dark:bg-slate-800 text-[#172033] dark:text-white"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Paid">Paid</option>
                          <option value="Overdue">Overdue</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            await api.del(`/api/sales-orders/${s.id}`);
                            setSalesOrders((prev) => prev.filter((x) => x.id !== s.id));
                            onRefreshDashboard();
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 rounded-lg whitespace-nowrap"
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
    </div>
  );
};
