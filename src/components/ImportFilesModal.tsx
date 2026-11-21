import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  Eye,
  File,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileUp,
  FolderOpen,
  Search,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { api } from '../api';
import type { CompanyDocument, CompanySettings, ImportedFileRecord, ModuleKey } from '../types';
import { SendToApproveButton } from './SendToApproveButton';
import { ShareButton } from './ShareButton';

export type ImportModalTab = 'upload' | 'csv' | 'vault';

interface StagedFile {
  id: string;
  file_name: string;
  title: string;
  mime_type: string;
  file_size: number;
  file_data: string;
  extracted_text: string;
}

interface ImportFilesModalProps {
  open: boolean;
  onClose: () => void;
  company?: CompanySettings | null;
  defaultTab?: ImportModalTab;
  defaultTargetModule?: string;
  onImported?: (info: { kind: 'files' | 'csv' | 'backup'; count: number }) => void;
  onNavigate?: (module: ModuleKey) => void;
}

const FILE_CATEGORIES = [
  'Official Document',
  'Employee Letter',
  'Employment Contract',
  'HR & Personnel File',
  'Finance Voucher / Receipt',
  'Inventory / GRN Sheet',
  'Scanned ID / Certificate',
  'Company Evaluation / Form',
  'General File',
];

const TARGET_MODULES: Array<{ value: string; label: string }> = [
  { value: 'secretary', label: 'Secretary & A4 Documents' },
  { value: 'hr', label: 'HR & Staff Records' },
  { value: 'payroll', label: 'Payroll & Tax' },
  { value: 'finance', label: 'Finance & Vouchers' },
  { value: 'materials', label: 'Materials & Warehouse' },
  { value: 'company-forms', label: 'Company Forms (305)' },
  { value: 'sales-crm', label: 'Sales & CRM' },
  { value: 'reports', label: 'Corporate Reports' },
];

type CsvTarget = 'employees' | 'materials' | 'attendance' | 'backup';

const SAMPLE_CSV: Record<Exclude<CsvTarget, 'backup'>, { filename: string; content: string }> = {
  employees: {
    filename: 'sample-employees-import.csv',
    content: [
      'employee_id,full_name,gender,phone,email,national_id,department,job_title,employment_type,start_date,basic_salary,bank_account,status',
      'SS-EMP-901,Abebe Bikila,Male,+251911223344,abebe@sevensundayethiopia.com,ET-NID-90122,Production,Line Supervisor,Permanent,2026-01-15,9500,1078100199001,Active',
      'SS-EMP-902,Selamawit Tadesse,Female,+251922334455,selam@sevensundayethiopia.com,ET-NID-90233,Finance,Cost Accountant,Permanent,2026-02-01,11200,1078100199002,Active',
    ].join('\n'),
  },
  materials: {
    filename: 'sample-materials-import.csv',
    content: [
      'sku,name,category,unit,stock_qty,reorder_level,unit_cost,location',
      'MAT-IMP-101,HDPE Resin Granules,Raw Material,kg,450,100,185.50,Main Warehouse',
      'MAT-IMP-102,Corrugated Master Carton 24pk,Packaging,pcs,1200,250,42.00,Dispatch Bay A',
    ].join('\n'),
  },
  attendance: {
    filename: 'sample-attendance-import.csv',
    content: [
      'employee_code,employee_name,department,attendance_date,shift_name,check_in,check_out,hourly_rate,regular_hours,ot_type,ot_hours,status',
      'SS-EMP-901,Abebe Bikila,Production,2026-03-01,Day Shift,08:00,19:00,54.81,8,Normal,2,Present',
      'SS-EMP-902,Selamawit Tadesse,Finance,2026-03-01,Day Shift,08:00,20:00,64.62,8,Night,3,Present',
    ].join('\n'),
  },
};

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isTextLikeFile(fileName: string, mimeType: string): boolean {
  const lower = fileName.toLowerCase();
  if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('xml') || mimeType.includes('csv')) {
    return true;
  }
  return /\.(txt|md|csv|tsv|json|html|htm|xml|log|yaml|yml)$/i.test(lower);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => resolve('');
    reader.readAsText(file);
  });
}

function parseCsvText(raw: string): { headers: string[]; rows: Array<Record<string, string>> } {
  const clean = raw.replace(/^\uFEFF/, '');
  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(cell.trim());
      if (row.some((v) => v !== '')) matrix.push(row);
      row = [];
      cell = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(cell.trim());
      if (row.some((v) => v !== '')) matrix.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((v) => v !== '')) matrix.push(row);
  }

  if (matrix.length < 2) {
    return { headers: matrix[0] || [], rows: [] };
  }
  const headers = matrix[0].map((h, idx) => h || `column_${idx + 1}`);
  const rows = matrix.slice(1).map((cols) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? '';
    });
    return obj;
  });
  return { headers, rows };
}

function downloadBlob(filename: string, content: BlobPart, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function triggerFileRecordDownload(file: ImportedFileRecord) {
  if (file.file_data && file.file_data.startsWith('data:')) {
    const a = document.createElement('a');
    a.href = file.file_data;
    a.download = file.file_name || `${file.file_code}.bin`;
    a.click();
    return;
  }
  downloadBlob(
    file.file_name || `${file.file_code}.txt`,
    file.extracted_text || file.notes || file.title,
    file.mime_type || 'text/plain;charset=utf-8;'
  );
}

export const ImportFilesModal: React.FC<ImportFilesModalProps> = ({
  open,
  onClose,
  company,
  defaultTab = 'upload',
  defaultTargetModule = 'secretary',
  onImported,
  onNavigate,
}) => {
  const departments = useMemo(() => {
    const parsed = (company?.departments || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return parsed.length > 0
      ? parsed
      : ['Operations', 'Secretary & Admin', 'Human Resources', 'Finance', 'Supply Chain', 'Production', 'Sales & CRM'];
  }, [company?.departments]);

  const [activeTab, setActiveTab] = useState<ImportModalTab>(defaultTab);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [category, setCategory] = useState('Official Document');
  const [department, setDepartment] = useState(departments[0] || 'Operations');
  const [targetModule, setTargetModule] = useState(defaultTargetModule || 'secretary');
  const [notes, setNotes] = useState('');
  const [alsoCreateSecDoc, setAlsoCreateSecDoc] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // CSV / Backup state
  const [csvTarget, setCsvTarget] = useState<CsvTarget>('employees');
  const [csvFileName, setCsvFileName] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Array<Record<string, string>>>([]);
  const [backupPayload, setBackupPayload] = useState<Record<string, unknown> | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);

  // Vault state
  const [vaultFiles, setVaultFiles] = useState<ImportedFileRecord[]>([]);
  const [loadingVault, setLoadingVault] = useState(false);
  const [vaultSearch, setVaultSearch] = useState('');
  const [vaultCategoryFilter, setVaultCategoryFilter] = useState('All');
  const [previewFile, setPreviewFile] = useState<ImportedFileRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
      if (defaultTargetModule) setTargetModule(defaultTargetModule);
      setNotice(null);
      setError(null);
    }
  }, [open, defaultTab, defaultTargetModule]);

  const loadVault = useCallback(async () => {
    setLoadingVault(true);
    try {
      const list = await api.get<ImportedFileRecord[]>('/api/files');
      setVaultFiles(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load imported files vault');
    } finally {
      setLoadingVault(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadVault();
    }
  }, [open, loadVault]);

  const stageSelectedFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setNotice(null);
    const next: StagedFile[] = [];
    for (const file of Array.from(fileList)) {
      if (file.size > 16 * 1024 * 1024) {
        setError(`"${file.name}" exceeds the 16 MB per-file upload limit.`);
        continue;
      }
      try {
        const dataUrl = await readAsDataUrl(file);
        const extracted = isTextLikeFile(file.name, file.type) ? await readAsText(file) : '';
        next.push({
          id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
          file_name: file.name,
          title: file.name.replace(/\.[^.]+$/, ''),
          mime_type: file.type || 'application/octet-stream',
          file_size: file.size,
          file_data: dataUrl,
          extracted_text: extracted,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : `Could not read ${file.name}`);
      }
    }
    if (next.length > 0) {
      setStagedFiles((prev) => [...prev, ...next]);
    }
  };

  const handleUploadFiles = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stagedFiles.length === 0) {
      setError('Select or drop at least one file or document to import.');
      return;
    }
    setError(null);
    setNotice(null);
    setUploading(true);
    try {
      const res = await api.post<{
        importedCount: number;
        files: ImportedFileRecord[];
        createdDocs: CompanyDocument[];
      }>('/api/files', {
        category,
        department,
        target_module: targetModule,
        notes,
        also_create_secretary_doc: alsoCreateSecDoc,
        files: stagedFiles.map((sf) => ({
          title: sf.title || sf.file_name,
          file_name: sf.file_name,
          mime_type: sf.mime_type,
          file_size: sf.file_size,
          file_data: sf.file_data,
          extracted_text: sf.extracted_text,
        })),
      });
      setStagedFiles([]);
      setNotes('');
      await loadVault();
      const docMsg =
        res.createdDocs && res.createdDocs.length > 0
          ? ` and created ${res.createdDocs.length} editable A4 document(s) in Secretary`
          : '';
      setNotice(`Imported ${res.importedCount} file(s) into SQLite Vault${docMsg}.`);
      onImported?.({ kind: 'files', count: res.importedCount });
      setActiveTab('vault');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleCsvOrBackupFilePicked = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setNotice(null);
    const text = await readAsText(file);
    setCsvFileName(file.name);

    if (csvTarget === 'backup' || file.name.toLowerCase().endsWith('.json')) {
      try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        setCsvTarget('backup');
        setBackupPayload(parsed);
        setCsvHeaders([]);
        setCsvRows([]);
        const tablesObj = (parsed.tables as Record<string, unknown[]>) || parsed;
        const tableCount = Object.keys(tablesObj).filter((k) => Array.isArray(tablesObj[k])).length;
        setNotice(`Parsed JSON backup "${file.name}" (${tableCount} tables ready). Click Commit Import to restore.`);
      } catch {
        setError(`"${file.name}" is not a valid JSON backup file.`);
        setBackupPayload(null);
      }
      return;
    }

    const parsed = parseCsvText(text);
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setError(`"${file.name}" has no valid CSV header + data rows.`);
      setCsvHeaders([]);
      setCsvRows([]);
      return;
    }
    setBackupPayload(null);
    setCsvHeaders(parsed.headers);
    setCsvRows(parsed.rows);
    setNotice(`Parsed ${parsed.rows.length} row(s) from "${file.name}". Review preview below and click Commit CSV Import.`);
  };

  const handleCommitCsvOrBackup = async () => {
    setError(null);
    setNotice(null);
    setImportingCsv(true);
    try {
      if (csvTarget === 'backup') {
        if (!backupPayload) {
          setError('Choose a valid .json backup file first.');
          setImportingCsv(false);
          return;
        }
        const res = await api.post<{ ok: boolean; restoredCounts: Record<string, number> }>(
          '/api/backup/restore',
          backupPayload
        );
        const totalRows = Object.values(res.restoredCounts || {}).reduce((s, n) => s + Number(n || 0), 0);
        setBackupPayload(null);
        setCsvFileName('');
        setNotice(`Restored ${Object.keys(res.restoredCounts || {}).length} database tables (${totalRows} total rows).`);
        onImported?.({ kind: 'backup', count: totalRows });
        await loadVault();
      } else {
        if (csvRows.length === 0) {
          setError('Choose a CSV file with data rows first.');
          setImportingCsv(false);
          return;
        }
        const res = await api.post<{
          target: string;
          inserted: number;
          updated: number;
          skipped: number;
          errors: string[];
        }>('/api/import/csv', {
          target: csvTarget,
          rows: csvRows,
        });
        setCsvRows([]);
        setCsvHeaders([]);
        setCsvFileName('');
        const warn = res.errors.length > 0 ? ` (${res.errors.slice(0, 2).join('; ')})` : '';
        setNotice(
          `CSV Import complete (${res.target}): ${res.inserted} inserted, ${res.updated} updated, ${res.skipped} skipped.${warn}`
        );
        onImported?.({ kind: 'csv', count: res.inserted + res.updated });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportingCsv(false);
    }
  };

  const handleSendToSecretaryA4 = async (file: ImportedFileRecord) => {
    setError(null);
    setNotice(null);
    try {
      const content =
        file.extracted_text?.trim() ||
        `${file.title}\n\nAttached Vault Reference: ${file.file_code} (${file.file_name})\nCategory: ${file.category}\nDepartment: ${file.department}\nUploaded By: ${file.uploaded_by}\n${file.notes ? `Notes: ${file.notes}` : ''}`.trim();
      const doc = await api.post<CompanyDocument>('/api/documents', {
        title: file.title,
        category: file.category === 'Employee Letter' || file.category === 'Employment Contract' ? file.category : 'Official Memo',
        department: file.department || 'Secretary & Admin',
        issued_by: file.uploaded_by || 'Corporate Secretary',
        issue_date: new Date().toISOString().slice(0, 10),
        confidentiality: 'Internal',
        status: 'Issued',
        language: 'en',
        content,
      });
      setNotice(`Converted "${file.file_name}" into Secretary A4 Document ${doc.doc_number}.`);
      onImported?.({ kind: 'files', count: 1 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create Secretary A4 document');
    }
  };

  const handleDeleteVaultFile = async (id: number) => {
    setError(null);
    setNotice(null);
    try {
      await api.del(`/api/files/${id}`);
      setVaultFiles((prev) => prev.filter((f) => f.id !== id));
      if (previewFile?.id === id) setPreviewFile(null);
      setConfirmDeleteId(null);
      setNotice('Imported file removed from Document Vault.');
      onImported?.({ kind: 'files', count: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove file');
    }
  };

  const filteredVault = useMemo(() => {
    const q = vaultSearch.trim().toLowerCase();
    return vaultFiles.filter((f) => {
      if (vaultCategoryFilter !== 'All' && f.category !== vaultCategoryFilter) return false;
      if (!q) return true;
      return (
        f.title.toLowerCase().includes(q) ||
        f.file_name.toLowerCase().includes(q) ||
        f.file_code.toLowerCase().includes(q) ||
        f.department.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
      );
    });
  }, [vaultFiles, vaultSearch, vaultCategoryFilter]);

  if (!open) return null;

  const renderFileIcon = (mime: string, name: string) => {
    const lower = name.toLowerCase();
    if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(lower)) {
      return <FileImage className="w-4 h-4 text-[#087CEB] shrink-0" />;
    }
    if (/\.(csv|xls|xlsx)$/i.test(lower)) {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />;
    }
    if (/\.(json|xml|md)$/i.test(lower)) {
      return <FileCode2 className="w-4 h-4 text-indigo-600 shrink-0" />;
    }
    if (/\.pdf$/i.test(lower) || mime === 'application/pdf') {
      return <FileText className="w-4 h-4 text-rose-600 shrink-0" />;
    }
    return <File className="w-4 h-4 text-[#18243A] dark:text-[#38BDF8] shrink-0" />;
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 bg-[#18243A]/65 flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="p-2 rounded-xl bg-[#EAF4FF] dark:bg-slate-800 text-[#087CEB] shrink-0">
              <FileUp className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold text-[#172033] dark:text-white truncate">
                Import Files & Official Documents Center
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Upload PDF, Word, Excel, Images & Text to SQLite Vault · Batch Import CSV into HR, Inventory & Attendance
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-[#172033] dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close import modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2 bg-[#F8FAFC] dark:bg-slate-950/50">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'upload'
                ? 'border-[#087CEB] text-[#087CEB]'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-[#172033] dark:hover:text-white'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            Upload Files & Documents
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('csv')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'csv'
                ? 'border-[#087CEB] text-[#087CEB]'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-[#172033] dark:hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Import CSV Data & JSON Backup
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vault')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'vault'
                ? 'border-[#087CEB] text-[#087CEB]'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-[#172033] dark:hover:text-white'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Imported Files Vault ({vaultFiles.length})
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {notice && (
            <div className="px-4 py-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{notice}</span>
            </div>
          )}
          {error && (
            <div className="px-4 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl">
              {error}
            </div>
          )}

          {/* TAB 1: UPLOAD FILES & OFFICIAL DOCUMENTS */}
          {activeTab === 'upload' && (
            <form onSubmit={handleUploadFiles} className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  void stageSelectedFiles(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer border-2 border-dashed rounded-2xl p-7 text-center transition-colors ${
                  dragOver
                    ? 'border-[#087CEB] bg-[#EAF4FF]/70 dark:bg-sky-950/30'
                    : 'border-slate-300 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/40 hover:border-[#087CEB]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.json,.html,.xml,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={(e) => {
                    void stageSelectedFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <UploadCloud className="w-9 h-9 text-[#087CEB] mx-auto mb-2" />
                <div className="text-sm font-bold text-[#172033] dark:text-white">
                  Click to choose files or drag & drop documents here
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Supports PDF, Word (.doc/.docx), Excel (.xls/.xlsx/.csv), Text/Markdown/JSON, and Scanned Images (PNG/JPG) up to 16 MB per file.
                </p>
              </div>

              {stagedFiles.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#F8FAFC] dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-[#172033] dark:text-white">
                    <span>Queued Files Ready for Import ({stagedFiles.length})</span>
                    <button
                      type="button"
                      onClick={() => setStagedFiles([])}
                      className="text-xs font-semibold text-rose-600 hover:underline"
                    >
                      Clear Queue
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {stagedFiles.map((sf) => (
                      <div key={sf.id} className="px-4 py-2.5 flex flex-wrap items-center gap-3">
                        {renderFileIcon(sf.mime_type, sf.file_name)}
                        <input
                          type="text"
                          value={sf.title}
                          onChange={(e) =>
                            setStagedFiles((prev) =>
                              prev.map((item) => (item.id === sf.id ? { ...item, title: e.target.value } : item))
                            )
                          }
                          aria-label={`Document title for ${sf.file_name}`}
                          className="flex-1 min-w-[180px] px-2.5 py-1 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[#172033] dark:text-white"
                        />
                        <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 truncate max-w-[190px]">
                          {sf.file_name} · {formatFileSize(sf.file_size)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setStagedFiles((prev) => prev.filter((item) => item.id !== sf.id))}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          aria-label={`Remove ${sf.file_name}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Document Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    {FILE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Department Ownership
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Target Platform Module
                  </label>
                  <select
                    value={targetModule}
                    onChange={(e) => setTargetModule(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    {TARGET_MODULES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Reference Notes / Filing Description
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional reference number, contract period, vendor name, or filing remarks..."
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-[#172033] dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alsoCreateSecDoc}
                    onChange={(e) => setAlsoCreateSecDoc(e.target.checked)}
                    className="rounded border-slate-300 text-[#087CEB]"
                  />
                  Also register editable A4 document record in Secretary Module
                </label>

                <button
                  type="submit"
                  disabled={uploading || stagedFiles.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-50 rounded-xl transition-colors whitespace-nowrap"
                >
                  <FileUp className="w-3.5 h-3.5" />
                  {uploading ? 'Saving to SQLite Vault...' : `Import ${stagedFiles.length || ''} File(s) Now`}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: CSV DATA & JSON BACKUP IMPORT */}
          {activeTab === 'csv' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {(
                  [
                    { key: 'employees', title: 'Staff Roster CSV', desc: 'Inserts or updates HR employees' },
                    { key: 'materials', title: 'Materials Inventory CSV', desc: 'Inserts or updates warehouse SKUs' },
                    { key: 'attendance', title: 'Attendance & OT CSV', desc: 'Imports shift punches & OT hours' },
                    { key: 'backup', title: 'JSON Database Backup', desc: 'Full workspace backup restore' },
                  ] as Array<{ key: CsvTarget; title: string; desc: string }>
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setCsvTarget(item.key);
                      setCsvHeaders([]);
                      setCsvRows([]);
                      setBackupPayload(null);
                      setCsvFileName('');
                      setError(null);
                      setNotice(null);
                    }}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      csvTarget === item.key
                        ? 'border-[#087CEB] bg-[#EAF4FF]/70 dark:bg-sky-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/40 hover:border-[#087CEB]'
                    }`}
                  >
                    <div className="text-xs font-bold text-[#172033] dark:text-white">{item.title}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#F8FAFC] dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2.5">
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept={csvTarget === 'backup' ? '.json' : '.csv,.txt'}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      void handleCsvOrBackupFilePicked(file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => csvInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#18243A] hover:bg-[#172033] rounded-lg whitespace-nowrap"
                  >
                    <FileUp className="w-3.5 h-3.5 text-[#38BDF8]" />
                    {csvTarget === 'backup' ? 'Choose JSON Backup File' : 'Choose CSV File'}
                  </button>
                  {csvFileName && (
                    <span className="text-xs font-mono text-[#172033] dark:text-slate-200">{csvFileName}</span>
                  )}
                </div>

                {csvTarget !== 'backup' && (
                  <button
                    type="button"
                    onClick={() => {
                      const sample = SAMPLE_CSV[csvTarget];
                      downloadBlob(sample.filename, sample.content, 'text/csv;charset=utf-8;');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#087CEB] bg-white dark:bg-slate-900 border border-[#087CEB]/40 hover:border-[#087CEB] rounded-lg whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Sample CSV Template
                  </button>
                )}
              </div>

              {csvRows.length > 0 && csvTarget !== 'backup' && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#F8FAFC] dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-[#172033] dark:text-white">
                    <span>
                      Parsed CSV Preview ({csvRows.length} total rows · showing first {Math.min(12, csvRows.length)})
                    </span>
                    <button
                      type="button"
                      onClick={handleCommitCsvOrBackup}
                      disabled={importingCsv}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-50 rounded-lg whitespace-nowrap"
                    >
                      <Database className="w-3.5 h-3.5" />
                      {importingCsv ? 'Importing Rows...' : `Commit ${csvRows.length} Rows to SQLite`}
                    </button>
                  </div>
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500">
                          {csvHeaders.map((h) => (
                            <th key={h} className="py-2 px-3 font-semibold whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {csvRows.slice(0, 12).map((row, idx) => (
                          <tr key={idx} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40">
                            {csvHeaders.map((h) => (
                              <td key={h} className="py-1.5 px-3 font-mono whitespace-nowrap text-[#172033] dark:text-slate-200">
                                {row[h] || '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {backupPayload && csvTarget === 'backup' && (
                <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900">
                  <div className="text-xs text-[#172033] dark:text-slate-200">
                    <div className="font-bold">JSON Snapshot Ready to Restore</div>
                    <div className="text-slate-500 dark:text-slate-400">
                      Restoring replaces existing rows in matching SQLite tables cleanly in a single transaction.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCommitCsvOrBackup}
                    disabled={importingCsv}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] disabled:opacity-50 rounded-lg whitespace-nowrap"
                  >
                    <Database className="w-3.5 h-3.5" />
                    {importingCsv ? 'Restoring Backup...' : 'Commit JSON Restore'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: IMPORTED FILES VAULT */}
          {activeTab === 'vault' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[220px]">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search imported files by title, filename, code, dept..."
                      value={vaultSearch}
                      onChange={(e) => setVaultSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <select
                    value={vaultCategoryFilter}
                    onChange={(e) => setVaultCategoryFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="All">All Categories</option>
                    {FILE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  Upload More Files
                </button>
              </div>

              {loadingVault ? (
                <div className="py-10 text-center text-xs text-slate-500">Loading imported files...</div>
              ) : filteredVault.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl space-y-2">
                  <FolderOpen className="w-8 h-8 text-slate-400 mx-auto" />
                  <div className="text-sm font-semibold text-[#172033] dark:text-white">No imported files yet</div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Upload PDFs, contracts, scanned IDs, spreadsheets, or letters in the Upload tab to store them in SQLite.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 text-slate-500">
                          <th className="py-2.5 px-3 font-semibold">Ref & File</th>
                          <th className="py-2.5 px-3 font-semibold">Category · Dept</th>
                          <th className="py-2.5 px-3 font-semibold">Size</th>
                          <th className="py-2.5 px-3 font-semibold">Uploaded</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredVault.map((file) => (
                          <tr key={file.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/30">
                            <td className="py-2.5 px-3">
                              <div className="flex items-start gap-2.5">
                                <span className="mt-0.5">{renderFileIcon(file.mime_type, file.file_name)}</span>
                                <div className="min-w-0">
                                  <div className="font-bold text-[#172033] dark:text-white truncate max-w-[240px]">
                                    {file.title}
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
                                    {file.file_code} · {file.file_name}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                              <div className="font-medium">{file.category}</div>
                              <div className="text-[11px] text-slate-400">
                                {file.department} · {file.target_module}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {formatFileSize(file.file_size)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              <div>{file.created_at.slice(0, 10)}</div>
                              <div className="text-[11px] truncate max-w-[120px]">{file.uploaded_by}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => setPreviewFile(file)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-[#EAF4FF] hover:bg-[#DBEAFE] text-[#18243A] rounded-lg whitespace-nowrap"
                                >
                                  <Eye className="w-3 h-3 text-[#087CEB]" />
                                  Preview
                                </button>
                                <button
                                  type="button"
                                  onClick={() => triggerFileRecordDownload(file)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[#172033] dark:text-slate-200 rounded-lg whitespace-nowrap"
                                >
                                  <Download className="w-3 h-3" />
                                  Download
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSendToSecretaryA4(file)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-[#EAF4FF] text-[#172033] dark:text-slate-200 rounded-lg whitespace-nowrap"
                                  title="Create editable A4 document in Secretary Module"
                                >
                                  <FileText className="w-3 h-3 text-[#087CEB]" />
                                  To A4
                                </button>
                                <ShareButton
                                  compact
                                  title={file.title}
                                  reference={file.file_code}
                                  moduleName={`Imported File (${file.category})`}
                                  summary={`File: ${file.file_name} (${formatFileSize(file.file_size)})\nDepartment: ${file.department}\n${file.extracted_text ? file.extracted_text.slice(0, 400) : file.notes || ''}`}
                                />
                                <SendToApproveButton
                                  compact
                                  sourceModule="secretary"
                                  recordRef={file.file_code}
                                  title={file.title}
                                  fromDepartment={file.department}
                                  summary={`Imported File: ${file.file_name} · Category: ${file.category}`}
                                />
                                {confirmDeleteId === file.id ? (
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteVaultFile(file.id)}
                                      className="px-2 py-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="px-2 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 rounded-lg"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(file.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                                    aria-label={`Delete ${file.file_name}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Inline File Preview Panel */}
              {previewFile && (
                <div className="border border-[#087CEB]/40 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                  <div className="px-4 py-2.5 bg-[#EAF4FF]/60 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-[#172033] dark:text-white truncate">
                      Preview: {previewFile.title} ({previewFile.file_name})
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onNavigate('secretary');
                          }}
                          className="text-[11px] font-semibold text-[#087CEB] hover:underline"
                        >
                          Open Secretary A4
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPreviewFile(null)}
                        className="p-1 text-slate-500 hover:text-[#172033] dark:hover:text-white rounded"
                        aria-label="Close file preview"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="p-4">
                    {previewFile.mime_type.startsWith('image/') && previewFile.file_data ? (
                      <img
                        src={previewFile.file_data}
                        alt={previewFile.title}
                        className="max-h-96 mx-auto rounded-lg border border-slate-200 dark:border-slate-700 object-contain"
                      />
                    ) : previewFile.mime_type === 'application/pdf' && previewFile.file_data ? (
                      <iframe
                        src={previewFile.file_data}
                        title={previewFile.title}
                        className="w-full h-96 rounded-lg border border-slate-200 dark:border-slate-700 bg-white"
                      />
                    ) : previewFile.extracted_text ? (
                      <pre className="p-3 text-xs font-mono bg-[#F8FAFC] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg max-h-80 overflow-auto whitespace-pre-wrap text-[#172033] dark:text-slate-200">
                        {previewFile.extracted_text}
                      </pre>
                    ) : (
                      <div className="p-5 text-center space-y-2">
                        <div className="text-xs font-semibold text-[#172033] dark:text-white">
                          Binary document stored securely in SQLite ({previewFile.mime_type || 'document'})
                        </div>
                        <p className="text-xs text-slate-500">
                          Click Download below to open the original {previewFile.file_name} in Word, Excel, or your system viewer.
                        </p>
                        <button
                          type="button"
                          onClick={() => triggerFileRecordDownload(previewFile)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download {previewFile.file_name}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface ImportFilesButtonProps {
  company?: CompanySettings | null;
  label?: string;
  defaultTab?: ImportModalTab;
  defaultTargetModule?: string;
  compact?: boolean;
  onImported?: (info: { kind: 'files' | 'csv' | 'backup'; count: number }) => void;
  onNavigate?: (module: ModuleKey) => void;
}

export const ImportFilesButton: React.FC<ImportFilesButtonProps> = ({
  company,
  label = 'Import Files & Docs',
  defaultTab = 'upload',
  defaultTargetModule = 'secretary',
  compact = false,
  onImported,
  onNavigate,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 font-semibold border transition-colors whitespace-nowrap shrink-0 ${
          compact
            ? 'px-2.5 py-1.5 text-xs text-[#18243A] dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-lg'
            : 'px-3.5 py-2 text-xs text-[#172033] dark:text-slate-100 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-[#087CEB] rounded-xl'
        }`}
        title="Import Files, PDFs, Office Documents, or CSV Spreadsheets"
      >
        <FileUp className="w-3.5 h-3.5 text-[#087CEB]" />
        <span>{label}</span>
      </button>

      <ImportFilesModal
        open={open}
        onClose={() => setOpen(false)}
        company={company}
        defaultTab={defaultTab}
        defaultTargetModule={defaultTargetModule}
        onImported={onImported}
        onNavigate={onNavigate}
      />
    </>
  );
};
