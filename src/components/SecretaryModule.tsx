import React, { useEffect, useState } from 'react';
import { Columns2, Eye, FileText, Languages, Pencil, Printer, Rows2, Save, Trash2, X } from 'lucide-react';
import { api } from '../api';
import type { CompanyDocument, CompanySettings } from '../types';
import {
  DOCUMENT_TEMPLATES,
  LANGUAGE_OPTIONS,
  toEthiopianDateString,
  translatePhraseDictionary,
  type AppLang,
} from '../utils/ethiopianCalendar';
import { ImportFilesButton } from './ImportFilesModal';
import { RealQrCode } from './RealQrCode';
import { SendToApproveButton } from './SendToApproveButton';
import { ShareButton } from './ShareButton';

const CATEGORIES = [
  'Official Memo',
  'Board Resolution',
  'Employee Letter',
  'Employment Contract',
  'Salary Certificate',
  'Warning Letter',
  'Material Issue Voucher',
  'Goods Receiving Note',
  'Stock Transfer Form',
  'Maintenance Form',
  'Time Tracking Attendance Form',
  'Sales Invoice',
  'Payment Receipt',
  'Purchase Order',
  'Delivery Note',
  'Quotation Document',
  'Payment Voucher',
  'Receipt Voucher',
  'Audit Report',
];

interface SecretaryModuleProps {
  company?: CompanySettings | null;
  onRefreshDashboard: () => void;
}

export const SecretaryModule: React.FC<SecretaryModuleProps> = ({ company, onRefreshDashboard }) => {
  const [docs, setDocs] = useState<CompanyDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<CompanyDocument | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [targetLang, setTargetLang] = useState<AppLang>('am');
  const [bilingualLayout, setBilingualLayout] = useState<'side-by-side' | 'stacked'>('side-by-side');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emptyForm = {
    doc_number: '',
    title: '',
    category: 'Employee Letter',
    department: 'Secretary & Admin',
    issued_by: 'Tigist Haile (Corporate Secretary)',
    issue_date: new Date().toISOString().slice(0, 10),
    confidentiality: 'Internal' as CompanyDocument['confidentiality'],
    status: 'Issued' as CompanyDocument['status'],
    language: 'en' as AppLang,
    content: '',
    translated_content: '',
  };

  const [form, setForm] = useState(emptyForm);

  const loadDocs = async () => {
    try {
      const data = await api.get<CompanyDocument[]>('/api/documents');
      setDocs(data);
      if (data.length > 0 && !selectedDoc) {
        setSelectedDoc(data[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load company documents');
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleLoadTemplate = (templateKey: string) => {
    const tpl = DOCUMENT_TEMPLATES.find((t) => t.key === templateKey);
    if (!tpl) return;
    setForm((prev) => ({
      ...prev,
      category: tpl.category,
      title: tpl[prev.language].title,
      content: tpl[prev.language].body,
      translated_content: tpl[targetLang].body,
    }));
  };

  const handleTranslateDraft = (lang: AppLang) => {
    setTargetLang(lang);
    const translated = translatePhraseDictionary(form.content || form.title, lang);
    setForm((prev) => ({ ...prev, translated_content: translated }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      if (editingId !== null) {
        const updated = await api.put<CompanyDocument>(`/api/documents/${editingId}`, form);
        setDocs((prev) => prev.map((d) => (d.id === editingId ? updated : d)));
        setSelectedDoc(updated);
        setEditingId(null);
        setForm(emptyForm);
        setNotice(`Saved changes to ${updated.doc_number}.`);
      } else {
        const created = await api.post<CompanyDocument>('/api/documents', form);
        setDocs((prev) => [created, ...prev]);
        setSelectedDoc(created);
        setForm(emptyForm);
        setNotice(`Saved and issued document ${created.doc_number}.`);
      }
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save document');
    }
  };

  const handleStartEdit = (doc: CompanyDocument) => {
    setSelectedDoc(doc);
    setEditingId(doc.id);
    setForm({
      doc_number: doc.doc_number,
      title: doc.title,
      category: doc.category,
      department: doc.department,
      issued_by: doc.issued_by,
      issue_date: doc.issue_date,
      confidentiality: doc.confidentiality,
      status: doc.status,
      language: doc.language,
      content: doc.content,
      translated_content: doc.translated_content || '',
    });
    setNotice(null);
  };

  const handleDelete = async (id: number) => {
    setError(null);
    setNotice(null);
    try {
      await api.del(`/api/documents/${id}`);
      const remaining = docs.filter((d) => d.id !== id);
      setDocs(remaining);
      if (selectedDoc?.id === id) {
        setSelectedDoc(null);
      }
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      setNotice('Document removed.');
      onRefreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  const handlePrintDoc = (doc: CompanyDocument) => {
    setSelectedDoc(doc);
    setTimeout(() => window.print(), 80);
  };

  const filteredDocs = docs.filter(
    (d) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.doc_number.toLowerCase().includes(search.toLowerCase()) ||
      d.category.toLowerCase().includes(search.toLowerCase())
  );

  const logoSrc = company?.logo_data || '/assets/aistudio/Seven_Sunday_Logo_2_desktop_addf2fa7.png';

  return (
    <div className="space-y-6">
      <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#172033] dark:text-white">
              Secretary Department & Official Company Documents (A4 Standard)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Official A4 (210 × 297 mm) letters, contracts, salary certificates, and operational forms with Logo, Stamp, Signature, Real QR Verification, and Multilingual translation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ImportFilesButton
              compact
              company={company}
              label="Import File / Letter"
              defaultTab="upload"
              defaultTargetModule="secretary"
              onImported={() => {
                void loadDocs();
                onRefreshDashboard();
              }}
            />
            <span className="text-xs font-medium text-slate-500">Quick Template:</span>
            {DOCUMENT_TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => handleLoadTemplate(t.key)}
                className="px-2.5 py-1 text-xs font-semibold bg-[#F8FAFC] dark:bg-slate-800 hover:bg-[#EAF4FF] text-[#172033] dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap"
              >
                {t.category}
              </button>
            ))}
          </div>
        </div>

        {notice && (
          <div className="mb-4 px-4 py-2.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
            {notice}
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-2.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Document Ref #</label>
            <input
              type="text"
              placeholder="Auto-generated"
              value={form.doc_number}
              onChange={(e) => setForm({ ...form, doc_number: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Document Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Employment Contract / Official Company Letter"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Official Form / Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
            <input
              type="text"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Issued By</label>
            <input
              type="text"
              value={form.issued_by}
              onChange={(e) => setForm({ ...form, issued_by: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Issue Date</label>
            <input
              type="date"
              value={form.issue_date}
              onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Source Language</label>
            <select
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value as AppLang })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Primary Document Content (A4 Body)
            </label>
            <textarea
              required
              rows={4}
              placeholder="Enter official A4 letter, contract, or form content..."
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div className="md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Languages className="w-3.5 h-3.5 text-[#087CEB]" />
                Translated Copy
              </label>
              <div className="flex flex-wrap items-center gap-1">
                {LANGUAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => handleTranslateDraft(opt.code)}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                      targetLang === opt.code ? 'bg-[#18243A] text-[#38BDF8]' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {opt.shortLabel}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              rows={4}
              placeholder="Click a language button above to translate or enter custom bilingual text..."
              value={form.translated_content}
              onChange={(e) => setForm({ ...form, translated_content: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div className="md:col-span-4 flex items-center justify-end gap-2">
            {editingId !== null && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-[#172033] bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap"
              >
                <X className="w-4 h-4" />
                Cancel Edit
              </button>
            )}
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
            >
              <Save className="w-4 h-4" />
              {editingId !== null ? 'Save Document Changes' : 'Save & Issue A4 Document'}
            </button>
          </div>
        </form>
      </div>

      {/* Repository + True A4 Paper Letterhead Sheet */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="no-print xl:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#172033] dark:text-white">Documents Register ({filteredDocs.length})</h3>
            <input
              type="search"
              placeholder="Search ref # or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg w-40"
            />
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[820px] overflow-y-auto">
            {filteredDocs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No documents found.</div>
            ) : (
              filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className={`p-4 flex items-start justify-between gap-2 transition-colors ${
                    selectedDoc?.id === doc.id
                      ? 'bg-[#EAF4FF] dark:bg-slate-800/80'
                      : 'hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40'
                  }`}
                >
                  <button type="button" onClick={() => setSelectedDoc(doc)} className="text-left flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                      <span className="font-bold text-[#18243A] dark:text-[#38BDF8]">{doc.doc_number}</span>
                      <span>·</span>
                      <span className="truncate">{doc.category}</span>
                    </div>
                    <div className="text-sm font-semibold text-[#172033] dark:text-white mt-1 truncate">
                      {doc.title}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      {doc.issue_date} · {doc.issued_by}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedDoc(doc)}
                      className="p-1.5 text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded-lg"
                      title="View A4"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrintDoc(doc)}
                      className="p-1.5 text-white bg-[#18243A] hover:bg-[#243656] rounded-lg"
                      title="Print View"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#38BDF8]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(doc)}
                      className="p-1.5 text-[#172033] bg-slate-100 hover:bg-slate-200 rounded-lg"
                      title="Edit Document"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(doc.id)}
                      className="p-1.5 text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
                      title="Remove Document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* True A4 Size Sheet Preview (210mm x 297mm) */}
        <div className="xl:col-span-8 print-only-container flex flex-col items-center">
          <div className="no-print w-full flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 mb-4">
            <div className="text-xs text-slate-600 dark:text-slate-300">
              <span className="font-bold text-[#172033] dark:text-white">A4 Print Sheet Preview (210mm × 297mm)</span>
              <span className="ml-2 font-mono text-[11px] text-slate-500">
                {selectedDoc ? `${selectedDoc.doc_number} · ISO 216 Portrait` : 'Preview Closed'}
              </span>
            </div>
            {selectedDoc && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-0.5 bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setBilingualLayout('side-by-side')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap ${
                      bilingualLayout === 'side-by-side'
                        ? 'bg-[#18243A] text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                    title="Primary Left & Translated Right on A4"
                  >
                    <Columns2 className="w-3.5 h-3.5" />
                    Side-by-Side (L → R)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBilingualLayout('stacked')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap ${
                      bilingualLayout === 'stacked'
                        ? 'bg-[#18243A] text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                    title="Stacked Top & Bottom"
                  >
                    <Rows2 className="w-3.5 h-3.5" />
                    Stacked
                  </button>
                </div>
                <ShareButton
                  compact
                  moduleName="Secretary Official A4 Document"
                  reference={selectedDoc.doc_number}
                  title={selectedDoc.title}
                  summary={`Category: ${selectedDoc.category}\nIssued By: ${selectedDoc.issued_by}\nDate: ${selectedDoc.issue_date}\n\n${selectedDoc.content}${
                    selectedDoc.translated_content ? `\n\n--- Translated Text ---\n${selectedDoc.translated_content}` : ''
                  }`}
                />
                <SendToApproveButton
                  compact
                  sourceModule="secretary"
                  recordRef={selectedDoc.doc_number}
                  title={selectedDoc.title}
                  summary={`${selectedDoc.category} issued by ${selectedDoc.issued_by} on ${selectedDoc.issue_date}.`}
                  fromDepartment={selectedDoc.department}
                  defaultTargetDepartment="General Manager"
                  onDispatched={() => {
                    setNotice(`Sent ${selectedDoc.doc_number} for department approval.`);
                    onRefreshDashboard();
                  }}
                />
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print View
                </button>
                <button
                  type="button"
                  onClick={() => handleStartEdit(selectedDoc)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#18243A] bg-[#DBEAFE] hover:bg-[#BFDBFE] border border-[#087CEB]/30 rounded-lg whitespace-nowrap"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit & Save
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDoc(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#172033] dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg whitespace-nowrap"
                >
                  <X className="w-3.5 h-3.5" />
                  Close View
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(selectedDoc.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              </div>
            )}
          </div>

          <div className="w-full overflow-x-auto pb-4 flex justify-center">
            {selectedDoc ? (
              <div className="a4-sheet border border-slate-300 shadow-sm flex flex-col justify-between">
                {/* Top A4 Letterhead */}
                <div>
                  <div className="flex items-start justify-between pb-4 border-b-2 border-[#18243A]">
                    <div className="flex items-center gap-3">
                      <img src={logoSrc} alt="Seven Sunday Ethiopia" className="h-12 w-auto object-contain" />
                      <div>
                        <div className="text-sm font-bold text-[#18243A]">
                          {company?.company_name || 'Seven Sunday Manufacturing & Trading PLC'}
                        </div>
                        <div className="text-[11px] text-[#087CEB] font-semibold">
                          {company?.slogan || 'The Home of quality product'} · {company?.secondary_slogan || 'Together for a Stronger and Better Tomorrow'}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {company?.address || 'Bole Sub-City, Addis Ababa, Ethiopia'} · Tel: {company?.phone || '+251 11 000 0000'}
                          {company?.tin_number ? ` · TIN: ${company.tin_number}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono text-[11px] text-[#172033]">
                      <div className="font-bold text-[#18243A]">A4 OFFICIAL DOC</div>
                      <div>Ref: {selectedDoc.doc_number}</div>
                      <div>G.C.: {selectedDoc.issue_date}</div>
                      <div>E.C.: {toEthiopianDateString(selectedDoc.issue_date)}</div>
                    </div>
                  </div>

                  {/* Metadata Strip */}
                  <div className="mt-4 grid grid-cols-4 gap-2 text-[11px] bg-[#F8FAFC] p-3 rounded border border-slate-200">
                    <div>
                      <span className="text-slate-500 block">Category</span>
                      <span className="font-semibold text-[#172033]">{selectedDoc.category}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Department</span>
                      <span className="font-semibold text-[#172033]">{selectedDoc.department}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Classification</span>
                      <span className="font-semibold text-[#172033]">{selectedDoc.confidentiality}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Status</span>
                      <span className="font-semibold text-[#18243A]">{selectedDoc.status}</span>
                    </div>
                  </div>

                  {/* Letter Subject & Body (Side-by-Side Left-to-Right OR Stacked on A4 Paper) */}
                  <div className="mt-7 space-y-4">
                    <h4 className="text-lg font-bold text-[#18243A] border-b border-slate-200 pb-2">
                      Subject: {selectedDoc.title}
                    </h4>
                    {bilingualLayout === 'side-by-side' && selectedDoc.translated_content ? (
                      <div className="grid grid-cols-2 gap-6 items-start">
                        <div className="pr-4 border-r border-slate-200">
                          <div className="text-[10px] font-bold text-[#18243A] uppercase tracking-wider mb-2 pb-1 border-b border-slate-200">
                            Original Text ({selectedDoc.language.toUpperCase()})
                          </div>
                          <div className="text-[13px] text-[#172033] leading-7 whitespace-pre-wrap">
                            {selectedDoc.content}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-[#087CEB] uppercase tracking-wider mb-2 pb-1 border-b border-slate-200">
                            Translated Text
                          </div>
                          <div className="text-[13px] text-[#172033] leading-7 whitespace-pre-wrap">
                            {selectedDoc.translated_content}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-[13.5px] text-[#172033] leading-7 whitespace-pre-wrap">
                          {selectedDoc.content}
                        </div>
                        {selectedDoc.translated_content && (
                          <div className="mt-6 pt-5 border-t border-slate-200">
                            <div className="text-xs font-bold text-[#18243A] uppercase tracking-wider mb-2">
                              Official Translation Copy
                            </div>
                            <div className="text-[13.5px] text-[#172033] leading-7 whitespace-pre-wrap">
                              {selectedDoc.translated_content}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Bottom A4 Stamp, Signature & Real QR Footer */}
                <div className="mt-10 pt-5 border-t-2 border-[#18243A] flex items-end justify-between gap-4 print-break-avoid">
                  <div className="space-y-1 text-xs text-slate-600">
                    <div className="font-bold text-sm text-[#172033]">{selectedDoc.issued_by}</div>
                    <div>{selectedDoc.department} · Official Corporate Authorization</div>
                    <div className="text-[10px] font-mono text-slate-500">
                      {company?.email || 'info@sevensunday.et'} · {company?.website || 'https://sevensunday.et'}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      {company?.stamp_data ? (
                        <img src={company.stamp_data} alt="Official Stamp" className="h-16 w-16 object-contain mx-auto" />
                      ) : (
                        <div className="w-16 h-16 rounded-full border-2 border-[#18243A] flex flex-col items-center justify-center text-[8px] font-bold text-[#18243A] text-center leading-tight">
                          <span>SEVEN SUNDAY</span>
                          <span className="text-[#087CEB]">OFFICIAL</span>
                          <span>SEAL</span>
                        </div>
                      )}
                      <span className="text-[10px] text-slate-500 block mt-1">Company Stamp</span>
                    </div>

                    <div className="text-center">
                      {company?.signature_data ? (
                        <img src={company.signature_data} alt="Authorized Signature" className="h-12 w-24 object-contain mx-auto" />
                      ) : (
                        <div className="w-24 h-12 border-b border-slate-400 flex items-end justify-center text-[10px] italic text-slate-400 pb-1">
                          Authorized Sign
                        </div>
                      )}
                      <span className="text-[10px] text-slate-500 block mt-1">Signature</span>
                    </div>

                    <RealQrCode
                      value={`SS-DOC|${selectedDoc.doc_number}|${selectedDoc.title}|${selectedDoc.issue_date}|${company?.tin_number || 'SEVEN-SUNDAY'}`}
                      size={78}
                      label={selectedDoc.doc_number}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 px-6 text-center text-xs text-slate-500 flex flex-col items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full">
                <FileText className="w-7 h-7 text-[#087CEB]" />
                <span>Document preview closed. Select an official document from the register to view or print in A4 format.</span>
                {docs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedDoc(docs[0])}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Re-open Latest Document
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
