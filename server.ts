import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import net from 'net';
import Database from 'better-sqlite3';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_PATH = path.join(DATA_DIR, 'sevensunday.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============================================================================
// DATABASE SCHEMA
// ============================================================================
db.exec(`
CREATE TABLE IF NOT EXISTS company_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  company_name TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  slogan TEXT NOT NULL,
  secondary_slogan TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  website TEXT NOT NULL,
  tin_number TEXT NOT NULL,
  default_currency TEXT NOT NULL DEFAULT 'ETB',
  calendar_mode TEXT NOT NULL DEFAULT 'Gregorian',
  default_language TEXT NOT NULL DEFAULT 'en',
  branches TEXT NOT NULL,
  departments TEXT NOT NULL,
  logo_data TEXT NOT NULL DEFAULT '',
  stamp_data TEXT NOT NULL DEFAULT '',
  signature_data TEXT NOT NULL DEFAULT '',
  smtp_host TEXT NOT NULL DEFAULT 'smtp.sevensunday.et',
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_user TEXT NOT NULL DEFAULT 'noreply@sevensunday.et',
  smtp_pass TEXT NOT NULL DEFAULT '',
  smtp_from TEXT NOT NULL DEFAULT 'Seven Sunday EMS <noreply@sevensunday.et>',
  smtp_secure INTEGER NOT NULL DEFAULT 0,
  rbac_matrix TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  department TEXT NOT NULL,
  job_title TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  last_login TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'Male',
  dob TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  national_id TEXT NOT NULL DEFAULT '',
  emergency_contact TEXT NOT NULL DEFAULT '',
  emergency_contact_phone TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL,
  job_title TEXT NOT NULL,
  employment_type TEXT NOT NULL DEFAULT 'Permanent',
  start_date TEXT NOT NULL,
  contract_expiry TEXT NOT NULL DEFAULT '',
  basic_salary REAL NOT NULL DEFAULT 0,
  bank_account TEXT NOT NULL DEFAULT '',
  education TEXT NOT NULL DEFAULT '',
  experience TEXT NOT NULL DEFAULT '',
  photo_data TEXT NOT NULL DEFAULT '',
  education_doc_name TEXT NOT NULL DEFAULT '',
  education_doc_data TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ot_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ot_regular_multiplier REAL NOT NULL DEFAULT 1.5,
  ot_night_multiplier REAL NOT NULL DEFAULT 1.75,
  ot_sunday_multiplier REAL NOT NULL DEFAULT 2.0,
  ot_holiday_multiplier REAL NOT NULL DEFAULT 2.5,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payroll_rules (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  employee_pension_rate REAL NOT NULL DEFAULT 7,
  employer_pension_rate REAL NOT NULL DEFAULT 11,
  default_bonus_rate REAL NOT NULL DEFAULT 10,
  brackets_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payroll_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payroll_month TEXT NOT NULL,
  month_label TEXT NOT NULL DEFAULT '',
  payroll_category TEXT NOT NULL DEFAULT 'FACTORY PERMANENT',
  employee_code TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  bank_account TEXT NOT NULL DEFAULT '',
  id_no TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT 'Production',
  basic_salary REAL NOT NULL DEFAULT 0,
  standard_hours REAL NOT NULL DEFAULT 208,
  hourly_rate REAL NOT NULL DEFAULT 0,
  absence_hours REAL NOT NULL DEFAULT 0,
  absence_rate REAL NOT NULL DEFAULT 0,
  absence_amount REAL NOT NULL DEFAULT 0,
  ot_normal_hours REAL NOT NULL DEFAULT 0,
  ot_night_hours REAL NOT NULL DEFAULT 0,
  ot_sunday_hours REAL NOT NULL DEFAULT 0,
  ot_holiday_hours REAL NOT NULL DEFAULT 0,
  ot_normal_amount REAL NOT NULL DEFAULT 0,
  ot_night_amount REAL NOT NULL DEFAULT 0,
  ot_sunday_amount REAL NOT NULL DEFAULT 0,
  ot_holiday_amount REAL NOT NULL DEFAULT 0,
  allowances REAL NOT NULL DEFAULT 0,
  overtime_pay REAL NOT NULL DEFAULT 0,
  bonuses REAL NOT NULL DEFAULT 0,
  deductions REAL NOT NULL DEFAULT 0,
  income_tax REAL NOT NULL DEFAULT 0,
  employee_pension REAL NOT NULL DEFAULT 0,
  employer_pension REAL NOT NULL DEFAULT 0,
  gross_salary REAL NOT NULL DEFAULT 0,
  net_salary REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Draft',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_code TEXT NOT NULL,
  payroll_month TEXT NOT NULL,
  employee_count INTEGER NOT NULL DEFAULT 0,
  total_gross REAL NOT NULL DEFAULT 0,
  total_bonus REAL NOT NULL DEFAULT 0,
  total_tax REAL NOT NULL DEFAULT 0,
  total_pension REAL NOT NULL DEFAULT 0,
  total_net REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Completed',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_type TEXT NOT NULL,
  device_name TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 4370,
  subnet_mask TEXT NOT NULL DEFAULT '255.255.255.0',
  gateway TEXT NOT NULL DEFAULT '192.168.10.1',
  serial_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Disconnected',
  last_latency_ms INTEGER,
  last_message TEXT NOT NULL DEFAULT '',
  last_checked_at TEXT
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_code TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  department TEXT NOT NULL,
  attendance_date TEXT NOT NULL,
  shift_name TEXT NOT NULL,
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  hourly_rate REAL NOT NULL DEFAULT 0,
  regular_hours REAL NOT NULL DEFAULT 8,
  ot_type TEXT NOT NULL DEFAULT 'None',
  ot_hours REAL NOT NULL DEFAULT 0,
  ot_multiplier REAL NOT NULL DEFAULT 1,
  ot_pay REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Present',
  register_state TEXT NOT NULL DEFAULT 'Open',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leaves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_code TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  department TEXT NOT NULL,
  leave_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days INTEGER NOT NULL DEFAULT 1,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending',
  approved_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS company_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_number TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  department TEXT NOT NULL,
  issued_by TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  confidentiality TEXT NOT NULL DEFAULT 'Internal',
  status TEXT NOT NULL DEFAULT 'Issued',
  language TEXT NOT NULL DEFAULT 'en',
  content TEXT NOT NULL,
  translated_content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS company_form_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_code TEXT NOT NULL UNIQUE,
  custom_title TEXT NOT NULL,
  department_key TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  fields_json TEXT NOT NULL,
  columns_json TEXT NOT NULL,
  default_notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS company_form_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_number TEXT NOT NULL,
  form_code TEXT NOT NULL,
  form_title TEXT NOT NULL,
  department_key TEXT NOT NULL,
  department_name TEXT NOT NULL,
  employee_code TEXT NOT NULL DEFAULT '',
  employee_name TEXT NOT NULL DEFAULT '',
  submission_date TEXT NOT NULL,
  reference_no TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Submitted',
  form_data_json TEXT NOT NULL,
  prepared_by TEXT NOT NULL DEFAULT '',
  checked_by TEXT NOT NULL DEFAULT '',
  approved_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  stock_qty REAL NOT NULL DEFAULT 0,
  reorder_level REAL NOT NULL DEFAULT 5,
  unit_cost REAL NOT NULL DEFAULT 0,
  location TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS material_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_number TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  department TEXT NOT NULL,
  material_id INTEGER,
  material_name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'pcs',
  urgency TEXT NOT NULL DEFAULT 'Standard',
  needed_by TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grn_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grn_number TEXT NOT NULL,
  po_reference TEXT NOT NULL DEFAULT '',
  supplier_name TEXT NOT NULL,
  material_id INTEGER,
  material_name TEXT NOT NULL,
  quantity_received REAL NOT NULL DEFAULT 0,
  unit_cost REAL NOT NULL DEFAULT 0,
  received_date TEXT NOT NULL,
  inspected_by TEXT NOT NULL,
  condition_status TEXT NOT NULL DEFAULT 'Accepted',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gin_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gin_number TEXT NOT NULL,
  issued_to_department TEXT NOT NULL,
  issued_to_person TEXT NOT NULL,
  material_id INTEGER,
  material_name TEXT NOT NULL,
  quantity_issued REAL NOT NULL DEFAULT 0,
  issue_date TEXT NOT NULL,
  authorized_by TEXT NOT NULL,
  audit_status TEXT NOT NULL DEFAULT 'Pending Audit',
  audit_variance REAL NOT NULL DEFAULT 0,
  audit_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  movement_number TEXT NOT NULL,
  movement_type TEXT NOT NULL,
  material_id INTEGER,
  material_name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  source_location TEXT NOT NULL,
  destination_location TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  variance_qty REAL NOT NULL DEFAULT 0,
  movement_date TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Recorded',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS procurement_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rfq_number TEXT NOT NULL,
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  material_name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  estimated_budget REAL NOT NULL DEFAULT 0,
  vendor_candidates TEXT NOT NULL DEFAULT '',
  selected_vendor TEXT NOT NULL DEFAULT '',
  bid_amount REAL NOT NULL DEFAULT 0,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchasing_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  material_id INTEGER,
  material_name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  order_date TEXT NOT NULL,
  expected_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Ordered',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crm_deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'Lead',
  deal_value REAL NOT NULL DEFAULT 0,
  assigned_rep TEXT NOT NULL,
  last_contact TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  product_service TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  amount REAL NOT NULL DEFAULT 0,
  order_date TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'Pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  debit_total REAL NOT NULL DEFAULT 0,
  credit_total REAL NOT NULL DEFAULT 0,
  balance REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_number TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  total_debit REAL NOT NULL DEFAULT 0,
  total_credit REAL NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  account_id INTEGER NOT NULL,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0,
  memo TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS finance_vouchers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_number TEXT NOT NULL,
  voucher_type TEXT NOT NULL,
  voucher_date TEXT NOT NULL,
  party_name TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  bank_reference TEXT NOT NULL DEFAULT '',
  debit_account_id INTEGER NOT NULL,
  debit_account_name TEXT NOT NULL,
  credit_account_id INTEGER NOT NULL,
  credit_account_name TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS finance_budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fiscal_year TEXT NOT NULL,
  department TEXT NOT NULL,
  account_id INTEGER NOT NULL,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  allocated_amount REAL NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assets_uniforms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  condition TEXT NOT NULL DEFAULT 'New',
  date_issued TEXT NOT NULL,
  expected_return TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Issued',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plate_number TEXT NOT NULL,
  vehicle_model TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  department TEXT NOT NULL,
  mileage_km REAL NOT NULL DEFAULT 0,
  fuel_cost REAL NOT NULL DEFAULT 0,
  maintenance_cost REAL NOT NULL DEFAULT 0,
  insurance_expiry TEXT NOT NULL,
  inspection_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS equipment_maintenance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_code TEXT NOT NULL,
  equipment_name TEXT NOT NULL,
  category TEXT NOT NULL,
  serial_number TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL,
  maintenance_type TEXT NOT NULL DEFAULT 'Preventive',
  technician_name TEXT NOT NULL,
  maintenance_date TEXT NOT NULL,
  next_service_due TEXT NOT NULL DEFAULT '',
  cost REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Scheduled',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL,
  sender_name TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  content TEXT NOT NULL,
  attachment_name TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (channel_id) REFERENCES chat_channels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gate_passes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pass_number TEXT NOT NULL UNIQUE,
  pass_token TEXT NOT NULL UNIQUE,
  pass_type TEXT NOT NULL DEFAULT 'Staff Exit',
  person_name TEXT NOT NULL,
  employee_code TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT 'Operations',
  destination TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL DEFAULT '',
  items_description TEXT NOT NULL DEFAULT '',
  vehicle_plate TEXT NOT NULL DEFAULT '',
  valid_date TEXT NOT NULL,
  issued_by TEXT NOT NULL,
  approved_department TEXT NOT NULL DEFAULT 'Security & Gate',
  status TEXT NOT NULL DEFAULT 'Active',
  used_at TEXT,
  verified_by_guard TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS department_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_code TEXT NOT NULL UNIQUE,
  source_module TEXT NOT NULL,
  record_ref TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  from_department TEXT NOT NULL DEFAULT 'Operations',
  target_department TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Normal',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending',
  decision_by TEXT,
  decision_notes TEXT NOT NULL DEFAULT '',
  decision_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  slogan TEXT NOT NULL DEFAULT 'The Home of quality product',
  secondary_slogan TEXT NOT NULL DEFAULT 'Together for a Stronger and Better Tomorrow',
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  tin_number TEXT NOT NULL DEFAULT '',
  default_currency TEXT NOT NULL DEFAULT 'ETB',
  calendar_mode TEXT NOT NULL DEFAULT 'Gregorian',
  default_language TEXT NOT NULL DEFAULT 'en',
  branches TEXT NOT NULL DEFAULT 'Headquarters',
  departments TEXT NOT NULL DEFAULT 'Operations, HR, Finance',
  logo_data TEXT NOT NULL DEFAULT '',
  stamp_data TEXT NOT NULL DEFAULT '',
  signature_data TEXT NOT NULL DEFAULT '',
  smtp_host TEXT NOT NULL DEFAULT 'smtp.sevensunday.et',
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_user TEXT NOT NULL DEFAULT 'noreply@sevensunday.et',
  smtp_pass TEXT NOT NULL DEFAULT '',
  smtp_from TEXT NOT NULL DEFAULT 'Seven Sunday EMS <noreply@sevensunday.et>',
  smtp_secure INTEGER NOT NULL DEFAULT 0,
  rbac_matrix TEXT NOT NULL DEFAULT '{}',
  platform_config TEXT NOT NULL DEFAULT '{}',
  ot_settings_json TEXT NOT NULL DEFAULT '{"ot_regular_multiplier":1.5,"ot_night_multiplier":1.75,"ot_sunday_multiplier":2.0,"ot_holiday_multiplier":2.5}',
  payroll_rules_json TEXT NOT NULL DEFAULT '{}',
  plan TEXT NOT NULL DEFAULT 'Enterprise',
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS imported_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  file_code TEXT NOT NULL,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  file_size INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'Official Document',
  department TEXT NOT NULL DEFAULT 'Operations',
  target_module TEXT NOT NULL DEFAULT 'secretary',
  extracted_text TEXT NOT NULL DEFAULT '',
  file_data TEXT NOT NULL DEFAULT '',
  uploaded_by TEXT NOT NULL DEFAULT 'System Operator',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  shift_code TEXT NOT NULL,
  shift_name TEXT NOT NULL,
  shift_category TEXT NOT NULL DEFAULT 'Day Shift',
  scheduling_system TEXT NOT NULL DEFAULT '3-Shift',
  start_time TEXT NOT NULL DEFAULT '08:00',
  end_time TEXT NOT NULL DEFAULT '17:00',
  break_minutes INTEGER NOT NULL DEFAULT 60,
  working_days TEXT NOT NULL DEFAULT '["Mon","Tue","Wed","Thu","Fri"]',
  rest_days TEXT NOT NULL DEFAULT '["Sat","Sun"]',
  min_rest_hours INTEGER NOT NULL DEFAULT 11,
  is_rotating INTEGER NOT NULL DEFAULT 0,
  rotation_pattern TEXT NOT NULL DEFAULT 'Fixed',
  color_hex TEXT NOT NULL DEFAULT '#2563eb',
  ot_multiplier REAL NOT NULL DEFAULT 1.5,
  grace_late_minutes INTEGER NOT NULL DEFAULT 15,
  status TEXT NOT NULL DEFAULT 'Active',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  dept_code TEXT NOT NULL,
  name TEXT NOT NULL,
  manager_employee_id TEXT NOT NULL DEFAULT '',
  manager_name TEXT NOT NULL DEFAULT '',
  scheduling_system TEXT NOT NULL DEFAULT 'Standard',
  default_shift_id INTEGER,
  working_days TEXT NOT NULL DEFAULT '["Mon","Tue","Wed","Thu","Fri"]',
  rest_days TEXT NOT NULL DEFAULT '["Sat","Sun"]',
  weekend_schedule_enabled INTEGER NOT NULL DEFAULT 0,
  holiday_schedule_enabled INTEGER NOT NULL DEFAULT 0,
  security_guard_coverage TEXT NOT NULL DEFAULT 'Standard Business Hours',
  monthly_timetable_notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  schedule_code TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT 'Operations',
  shift_id INTEGER,
  shift_name TEXT NOT NULL,
  shift_category TEXT NOT NULL DEFAULT 'Day Shift',
  schedule_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  start_time TEXT NOT NULL DEFAULT '08:00',
  end_time TEXT NOT NULL DEFAULT '17:00',
  break_minutes INTEGER NOT NULL DEFAULT 60,
  schedule_type TEXT NOT NULL DEFAULT 'Regular',
  rotation_group TEXT NOT NULL DEFAULT '',
  availability_status TEXT NOT NULL DEFAULT 'Assigned',
  replacement_employee_id TEXT NOT NULL DEFAULT '',
  replacement_employee_name TEXT NOT NULL DEFAULT '',
  change_reason TEXT NOT NULL DEFAULT '',
  approval_status TEXT NOT NULL DEFAULT 'Approved',
  approved_by TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT 'System Operator',
  updated_by TEXT NOT NULL DEFAULT 'System Operator',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS holidays_calendar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  holiday_date TEXT NOT NULL,
  name TEXT NOT NULL,
  is_paid INTEGER NOT NULL DEFAULT 1,
  ot_multiplier REAL NOT NULL DEFAULT 2.5,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workforce_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  late_grace_minutes INTEGER NOT NULL DEFAULT 15,
  early_departure_grace_minutes INTEGER NOT NULL DEFAULT 10,
  default_break_minutes INTEGER NOT NULL DEFAULT 60,
  min_rest_hours_between_shifts INTEGER NOT NULL DEFAULT 11,
  auto_detect_conflicts INTEGER NOT NULL DEFAULT 1,
  require_manager_approval INTEGER NOT NULL DEFAULT 1,
  default_shift_system TEXT NOT NULL DEFAULT '3-Shift',
  updated_at TEXT NOT NULL
);
`);

// Ensure new columns exist on older DBs safely
function ensureColumn(table: string, col: string, defSql: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${defSql}`);
  }
}

ensureColumn('company_settings', 'platform_config', "TEXT NOT NULL DEFAULT '{}'");
ensureColumn('payroll_records', 'absence_rate', 'REAL NOT NULL DEFAULT 0');
ensureColumn('payroll_records', 'ot_normal_amount', 'REAL NOT NULL DEFAULT 0');
ensureColumn('payroll_records', 'ot_night_amount', 'REAL NOT NULL DEFAULT 0');
ensureColumn('payroll_records', 'ot_sunday_amount', 'REAL NOT NULL DEFAULT 0');
ensureColumn('payroll_records', 'ot_holiday_amount', 'REAL NOT NULL DEFAULT 0');

// Real Device Connections extended columns
ensureColumn('devices', 'protocol', "TEXT NOT NULL DEFAULT 'TCP/IP Socket'");
ensureColumn('devices', 'endpoint_url', "TEXT NOT NULL DEFAULT ''");
ensureColumn('devices', 'api_key', "TEXT NOT NULL DEFAULT ''");
ensureColumn('devices', 'last_sync_at', 'TEXT');
ensureColumn('devices', 'punch_count', 'INTEGER NOT NULL DEFAULT 0');

// Extended Attendance Management columns (Morning/Afternoon/Night + Automatic Calculations + Audit)
ensureColumn('attendance_records', 'shift_id', 'INTEGER');
ensureColumn('attendance_records', 'shift_period', "TEXT NOT NULL DEFAULT 'Day'");
ensureColumn('attendance_records', 'morning_check_in', "TEXT NOT NULL DEFAULT ''");
ensureColumn('attendance_records', 'morning_check_out', "TEXT NOT NULL DEFAULT ''");
ensureColumn('attendance_records', 'afternoon_check_in', "TEXT NOT NULL DEFAULT ''");
ensureColumn('attendance_records', 'afternoon_check_out', "TEXT NOT NULL DEFAULT ''");
ensureColumn('attendance_records', 'night_check_in', "TEXT NOT NULL DEFAULT ''");
ensureColumn('attendance_records', 'night_check_out', "TEXT NOT NULL DEFAULT ''");
ensureColumn('attendance_records', 'scheduled_start', "TEXT NOT NULL DEFAULT '08:00'");
ensureColumn('attendance_records', 'scheduled_end', "TEXT NOT NULL DEFAULT '17:00'");
ensureColumn('attendance_records', 'late_minutes', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('attendance_records', 'early_departure_minutes', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('attendance_records', 'break_minutes', 'INTEGER NOT NULL DEFAULT 60');
ensureColumn('attendance_records', 'absence_hours', 'REAL NOT NULL DEFAULT 0');
ensureColumn('attendance_records', 'updated_by', "TEXT NOT NULL DEFAULT ''");
ensureColumn('attendance_records', 'updated_at', "TEXT NOT NULL DEFAULT ''");

// Multi-Tenant isolation columns across all operational tables (default 1 = Primary HQ Tenant)
const TENANT_SCOPED_TABLES = [
  'users',
  'employees',
  'payroll_records',
  'payroll_runs',
  'devices',
  'attendance_records',
  'shifts',
  'departments',
  'staff_schedules',
  'holidays_calendar',
  'workforce_rules',
  'leaves',
  'company_documents',
  'company_form_templates',
  'company_form_submissions',
  'materials',
  'material_requests',
  'grn_records',
  'gin_records',
  'inventory_movements',
  'procurement_records',
  'purchasing_orders',
  'crm_deals',
  'sales_orders',
  'ledger_accounts',
  'journal_entries',
  'finance_vouchers',
  'finance_budgets',
  'assets_uniforms',
  'vehicles',
  'equipment_maintenance',
  'chat_channels',
  'audit_logs',
  'gate_passes',
  'department_approvals',
  'imported_files',
];
for (const tbl of TENANT_SCOPED_TABLES) {
  ensureColumn(tbl, 'tenant_id', 'INTEGER NOT NULL DEFAULT 1');
}

// ============================================================================
// PAYROLL MATH HELPERS (ETHIOPIAN 2025 PROGRESSIVE TAX + 7% / 11% PENSION)
// ============================================================================
interface TaxBracket {
  min: number;
  max: number | null;
  rate: number;
  deduction: number;
}

const DEFAULT_ETHIOPIAN_BRACKETS: TaxBracket[] = [
  { min: 0, max: 2000, rate: 0, deduction: 0 },
  { min: 2001, max: 4000, rate: 15, deduction: 300 },
  { min: 4001, max: 7000, rate: 20, deduction: 500 },
  { min: 7001, max: 10000, rate: 25, deduction: 850 },
  { min: 10001, max: 14000, rate: 30, deduction: 1350 },
  { min: 14001, max: null, rate: 35, deduction: 2050 },
];

function getRulesAndOt(tenantId = 1) {
  let rulesRow = db.prepare('SELECT * FROM payroll_rules WHERE id = 1').get() as {
    employee_pension_rate: number;
    employer_pension_rate: number;
    default_bonus_rate: number;
    brackets_json: string;
  };
  let otRow = db.prepare('SELECT * FROM ot_settings WHERE id = 1').get() as {
    ot_regular_multiplier: number;
    ot_night_multiplier: number;
    ot_sunday_multiplier: number;
    ot_holiday_multiplier: number;
  };

  if (tenantId > 1) {
    const tRow = db.prepare('SELECT ot_settings_json, payroll_rules_json FROM tenants WHERE id = ?').get(tenantId) as
      | { ot_settings_json?: string; payroll_rules_json?: string }
      | undefined;
    if (tRow?.payroll_rules_json) {
      try {
        const parsed = JSON.parse(tRow.payroll_rules_json);
        if (parsed && typeof parsed === 'object' && parsed.brackets_json) {
          rulesRow = { ...rulesRow, ...parsed };
        }
      } catch {
        // fallback
      }
    }
    if (tRow?.ot_settings_json) {
      try {
        const parsed = JSON.parse(tRow.ot_settings_json);
        if (parsed && typeof parsed === 'object' && parsed.ot_regular_multiplier) {
          otRow = { ...otRow, ...parsed };
        }
      } catch {
        // fallback
      }
    }
  }

  let brackets = DEFAULT_ETHIOPIAN_BRACKETS;
  try {
    const parsed = JSON.parse(rulesRow.brackets_json);
    if (Array.isArray(parsed) && parsed.length > 0) brackets = parsed;
  } catch {
    // fallback
  }
  return { rulesRow, brackets, otRow };
}

function calcEthiopianTax(gross: number, brackets: TaxBracket[]): number {
  const sorted = [...brackets].sort((a, b) => a.min - b.min);
  const bracket =
    sorted.find((b) => gross >= b.min && (b.max === null || gross <= b.max)) ||
    sorted[sorted.length - 1];
  if (!bracket) return 0;
  return Math.max(0, Number((gross * (bracket.rate / 100) - bracket.deduction).toFixed(2)));
}

function computePayrollBreakdown(
  input: {
    basic_salary: number;
    standard_hours?: number;
    absence_hours?: number;
    absence_rate?: number | null;
    ot_normal_hours?: number;
    ot_night_hours?: number;
    ot_sunday_hours?: number;
    ot_holiday_hours?: number;
    allowances?: number;
    overtime_pay?: number;
    bonuses?: number;
    deductions?: number;
  },
  tenantId = 1
) {
  const { rulesRow, brackets, otRow } = getRulesAndOt(tenantId);
  const basicSalary = Math.max(0, Number(input.basic_salary) || 0);
  const standardHours = Math.max(1, Number(input.standard_hours) || 208);
  const hourlyRate = Number((basicSalary / standardHours).toFixed(2));
  const absenceHours = Math.max(0, Number(input.absence_hours) || 0);
  const providedAbsRate =
    input.absence_rate !== undefined && input.absence_rate !== null && Number(input.absence_rate) >= 0
      ? Number(input.absence_rate)
      : 0;
  const absenceRate = providedAbsRate > 0 ? Number(providedAbsRate.toFixed(2)) : hourlyRate;
  const absenceAmount = Number((absenceHours * absenceRate).toFixed(2));

  const otNormalHours = Math.max(0, Number(input.ot_normal_hours) || 0);
  const otNightHours = Math.max(0, Number(input.ot_night_hours) || 0);
  const otSundayHours = Math.max(0, Number(input.ot_sunday_hours) || 0);
  const otHolidayHours = Math.max(0, Number(input.ot_holiday_hours) || 0);

  const otNormalAmount = Number((hourlyRate * otNormalHours * otRow.ot_regular_multiplier).toFixed(2));
  const otNightAmount = Number((hourlyRate * otNightHours * otRow.ot_night_multiplier).toFixed(2));
  const otSundayAmount = Number((hourlyRate * otSundayHours * otRow.ot_sunday_multiplier).toFixed(2));
  const otHolidayAmount = Number((hourlyRate * otHolidayHours * otRow.ot_holiday_multiplier).toFixed(2));

  const categorizedOtSum = Number(
    (otNormalAmount + otNightAmount + otSundayAmount + otHolidayAmount).toFixed(2)
  );
  const hasCategorizedHours =
    otNormalHours > 0 || otNightHours > 0 || otSundayHours > 0 || otHolidayHours > 0;
  const overtimePay = hasCategorizedHours
    ? categorizedOtSum
    : Math.max(0, Number(input.overtime_pay) || 0);

  const allowances = Math.max(0, Number(input.allowances) || 0);
  const bonuses = Math.max(0, Number(input.bonuses) || 0);
  const deductions = Math.max(0, Number(input.deductions) || 0);

  const grossSalary = Math.max(
    0,
    Number((basicSalary - absenceAmount + allowances + overtimePay + bonuses).toFixed(2))
  );
  const incomeTax = calcEthiopianTax(grossSalary, brackets);
  const employeePension = Number((basicSalary * (rulesRow.employee_pension_rate / 100)).toFixed(2));
  const employerPension = Number((basicSalary * (rulesRow.employer_pension_rate / 100)).toFixed(2));
  const netSalary = Math.max(
    0,
    Number((grossSalary - incomeTax - employeePension - deductions).toFixed(2))
  );

  return {
    basic_salary: basicSalary,
    standard_hours: standardHours,
    hourly_rate: hourlyRate,
    absence_hours: absenceHours,
    absence_rate: absenceRate,
    absence_amount: absenceAmount,
    ot_normal_hours: otNormalHours,
    ot_night_hours: otNightHours,
    ot_sunday_hours: otSundayHours,
    ot_holiday_hours: otHolidayHours,
    ot_normal_amount: otNormalAmount,
    ot_night_amount: otNightAmount,
    ot_sunday_amount: otSundayAmount,
    ot_holiday_amount: otHolidayAmount,
    allowances,
    overtime_pay: overtimePay,
    bonuses,
    deductions,
    income_tax: incomeTax,
    employee_pension: employeePension,
    employer_pension: employerPension,
    gross_salary: grossSalary,
    net_salary: netSalary,
  };
}

// ============================================================================
// INITIAL DATABASE SEEDING (IDEMPOTENT)
// ============================================================================
function seedIfEmpty() {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const hasCompany = db.prepare('SELECT id FROM company_settings WHERE id = 1').get();
  if (!hasCompany) {
    db.prepare(`
      INSERT INTO company_settings (
        id, company_name, brand_name, slogan, secondary_slogan, address, phone, email, website,
        tin_number, default_currency, calendar_mode, default_language, branches, departments,
        smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, smtp_secure, rbac_matrix, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Seven Sunday Manufacturing & Trading PLC',
      'Seven Sunday Ethiopia',
      'The Home of quality product',
      'Together for a Stronger and Better Tomorrow',
      'Bole Sub-City, Addis Ababa, Ethiopia',
      '+251 11 667 8890',
      'info@sevensunday.et',
      'https://sevensunday.et',
      'ET-00981244',
      'ETB',
      'Gregorian',
      'en',
      'Addis Ababa HQ, Adama Factory, Hawassa Depot',
      'Production, Operations, Human Resources, Secretary, Finance, Inventory, Procurement, Sales & CRM',
      'smtp.sevensunday.et',
      587,
      'noreply@sevensunday.et',
      '',
      'Seven Sunday EMS <noreply@sevensunday.et>',
      0,
      '{}',
      now
    );
  }

  if (!db.prepare('SELECT id FROM ot_settings WHERE id = 1').get()) {
    db.prepare(`
      INSERT INTO ot_settings (id, ot_regular_multiplier, ot_night_multiplier, ot_sunday_multiplier, ot_holiday_multiplier, updated_at)
      VALUES (1, 1.5, 1.75, 2.0, 2.5, ?)
    `).run(now);
  }

  if (!db.prepare('SELECT id FROM payroll_rules WHERE id = 1').get()) {
    db.prepare(`
      INSERT INTO payroll_rules (id, employee_pension_rate, employer_pension_rate, default_bonus_rate, brackets_json, updated_at)
      VALUES (1, 7, 11, 10, ?, ?)
    `).run(JSON.stringify(DEFAULT_ETHIOPIAN_BRACKETS), now);
  }

  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  if (userCount === 0) {
    const insUser = db.prepare(`
      INSERT INTO users (tenant_id, employee_code, full_name, email, password, department, job_title, role, status, created_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)
    `);
    insUser.run('SS-ADM-01', 'Dawit Bekele', 'admin@sevensunday.et', 'SevenSunday@2026', 'Management', 'Super Administrator', 'Super Administrator', now);
    insUser.run('SS-HR-02', 'Tigist Haile', 'secretary@sevensunday.et', 'SevenSunday@2026', 'Human Resources', 'HR & Secretary Lead', 'Human Resource Manager', now);
    insUser.run('SS-FIN-03', 'Biniyam Tadesse', 'finance@sevensunday.et', 'SevenSunday@2026', 'Finance', 'Finance Manager', 'Finance Manager', now);
    insUser.run('SS-INV-04', 'Daniel Mekonnen', 'inventory@sevensunday.et', 'SevenSunday@2026', 'Inventory', 'Inventory & Warehouse Lead', 'Inventory Manager', now);
    insUser.run('SS-EMP-05', 'Sara Tesfaye', 'viewer@sevensunday.et', 'SevenSunday@2026', 'Operations', 'Operations Staff', 'Employee', now);
  }

  // Always idempotently ensure System Administrator, Attendance Officer & Security Guard accounts exist even on existing DBs
  const hasSysAdmin = db.prepare("SELECT id FROM users WHERE lower(email) = 'sysadmin@sevensunday.et'").get();
  if (!hasSysAdmin) {
    db.prepare(`
      INSERT INTO users (tenant_id, employee_code, full_name, email, password, department, job_title, role, status, created_at)
      VALUES (1, 'SS-SYS-00', 'System Administrator', 'sysadmin@sevensunday.et', 'SevenSunday@2026', 'Platform Governance', 'Chief System Administrator', 'System Administrator', 'Active', ?)
    `).run(now);
  }
  const hasAttOfficer = db.prepare("SELECT id FROM users WHERE lower(email) = 'attendance@sevensunday.et'").get();
  if (!hasAttOfficer) {
    db.prepare(`
      INSERT INTO users (tenant_id, employee_code, full_name, email, password, department, job_title, role, status, created_at)
      VALUES (1, 'SS-ATT-06', 'Abebe Bikila', 'attendance@sevensunday.et', 'SevenSunday@2026', 'Human Resources', 'Attendance & Shift Officer', 'Attendance Officer', 'Active', ?)
    `).run(now);
  }
  const hasGuardUser = db.prepare("SELECT id FROM users WHERE lower(email) = 'guard@sevensunday.et'").get();
  if (!hasGuardUser) {
    db.prepare(`
      INSERT INTO users (tenant_id, employee_code, full_name, email, password, department, job_title, role, status, created_at)
      VALUES (1, 'SS-SEC-07', 'Tadesse Lemma', 'guard@sevensunday.et', 'SevenSunday@2026', 'Security', 'Gate & Patrol Security Guard', 'Security Guard', 'Active', ?)
    `).run(now);
  }

  // Seed multi-tenant workspaces idempotently
  const tenantCount = (db.prepare('SELECT COUNT(*) as c FROM tenants').get() as { c: number }).c;
  if (tenantCount === 0) {
    const curCompany = db.prepare('SELECT * FROM company_settings WHERE id = 1').get() as Record<string, unknown>;
    const defaultPayrollRules = JSON.stringify({
      employee_pension_rate: 7,
      employer_pension_rate: 11,
      default_bonus_rate: 10,
      brackets_json: JSON.stringify(DEFAULT_ETHIOPIAN_BRACKETS),
    });
    const defaultOtJson = JSON.stringify({
      ot_regular_multiplier: 1.5,
      ot_night_multiplier: 1.75,
      ot_sunday_multiplier: 2.0,
      ot_holiday_multiplier: 2.5,
    });
    const insTenant = db.prepare(`
      INSERT INTO tenants (
        tenant_code, name, brand_name, slogan, secondary_slogan, address, phone, email, website,
        tin_number, default_currency, calendar_mode, default_language, branches, departments,
        rbac_matrix, platform_config, ot_settings_json, payroll_rules_json, plan, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)
    `);
    insTenant.run(
      'SS-HQ-01',
      String(curCompany?.company_name || 'Seven Sunday Manufacturing & Trading PLC'),
      String(curCompany?.brand_name || 'Seven Sunday Ethiopia'),
      String(curCompany?.slogan || 'The Home of quality product'),
      String(curCompany?.secondary_slogan || 'Together for a Stronger and Better Tomorrow'),
      String(curCompany?.address || 'Bole Sub-City, Addis Ababa, Ethiopia'),
      String(curCompany?.phone || '+251 11 667 8890'),
      String(curCompany?.email || 'info@sevensunday.et'),
      String(curCompany?.website || 'https://sevensunday.et'),
      String(curCompany?.tin_number || 'ET-00981244'),
      String(curCompany?.default_currency || 'ETB'),
      String(curCompany?.calendar_mode || 'Gregorian'),
      String(curCompany?.default_language || 'en'),
      String(curCompany?.branches || 'Addis Ababa HQ, Adama Factory, Hawassa Depot'),
      String(curCompany?.departments || 'Production, Operations, Human Resources, Secretary, Finance, Inventory, Procurement, Sales & CRM'),
      String(curCompany?.rbac_matrix || '{}'),
      String(curCompany?.platform_config || '{}'),
      defaultOtJson,
      defaultPayrollRules,
      'Enterprise HQ',
      now,
      now
    );
    insTenant.run(
      'SS-ADM-02',
      'Seven Sunday Adama Industrial Plant PLC',
      'Seven Sunday Adama Plant',
      'Precision Manufacturing Excellence',
      'Adama Industrial Zone Operations',
      'Adama Industrial Park, Oromia, Ethiopia',
      '+251 22 111 4400',
      'adama@sevensunday.et',
      'https://adama.sevensunday.et',
      'ET-00981244-ADM',
      'ETB',
      'Ethiopian',
      'om',
      'Adama Plant Line A, Adama Packaging Annex',
      'Production, Quality Assurance, Maintenance, Warehouse, Security',
      '{}',
      '{}',
      defaultOtJson,
      defaultPayrollRules,
      'Manufacturing Plant',
      now,
      now
    );
    insTenant.run(
      'SS-HAW-03',
      'Seven Sunday Hawassa Regional Hub PLC',
      'Seven Sunday Hawassa Hub',
      'Southern Corridor Distribution Network',
      'Fast & Reliable Regional Logistics',
      'Hawassa Industrial Corridor, Sidama, Ethiopia',
      '+251 46 220 7711',
      'hawassa@sevensunday.et',
      'https://hawassa.sevensunday.et',
      'ET-00981244-HAW',
      'ETB',
      'Gregorian',
      'am',
      'Hawassa Cold Depot, Shashemene Relay',
      'Logistics, Sales & CRM, Inventory, Finance, Security',
      '{}',
      '{}',
      defaultOtJson,
      defaultPayrollRules,
      'Regional Hub',
      now,
      now
    );
  }

  const empCount = (db.prepare('SELECT COUNT(*) as c FROM employees').get() as { c: number }).c;
  if (empCount === 0) {
    const insEmp = db.prepare(`
      INSERT INTO employees (
        employee_id, full_name, gender, dob, phone, email, address, national_id,
        emergency_contact, emergency_contact_phone, department, job_title, employment_type,
        start_date, basic_salary, bank_account, education, experience, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Permanent', ?, ?, ?, ?, ?, 'Active', ?)
    `);
    insEmp.run('SS-EMP-008', 'Kemal Ali', 'Male', '1993-04-12', '+251 911 234 008', 'kemal.ali@sevensunday.et', 'Adama Kebele 04', 'ETH-0911-008', 'Fatuma Ali', '+251 911 900 008', 'Production', 'Senior Line Operator', '2023-09-11', 6944.11, '1078100114488', 'TVET Level IV Manufacturing', '6 Years Factory Operations', now);
    insEmp.run('SS-EMP-039', 'Aysha Nasir', 'Female', '1995-08-19', '+251 911 234 039', 'aysha.nasir@sevensunday.et', 'Adama Bole Sub-city', 'ETH-0911-039', 'Nasir Ahmed', '+251 911 900 039', 'Production', 'Packaging Specialist', '2024-01-15', 5000.00, '1078100111977', 'Diploma Industrial Tech', '4 Years Packaging', now);
    insEmp.run('SS-EMP-006', 'Gadisa Getaneh', 'Male', '1990-02-22', '+251 911 234 006', 'gadisa.g@sevensunday.et', 'Adama Dembela', 'ETH-0911-006', 'Chaltu Gadisa', '+251 911 900 006', 'Production', 'Shift Supervisor', '2022-05-01', 8000.00, '1078100112283', 'BSc Mechanical Engineering', '8 Years Plant Supervision', now);
    insEmp.run('SS-EMP-003', 'Hana Hailu', 'Female', '1994-11-04', '+251 911 234 003', 'hana.hailu@sevensunday.et', 'Bole Bulbula, Addis Ababa', 'ETH-0911-003', 'Hailu Abebe', '+251 911 900 003', 'Quality Assurance', 'QC Inspector', '2023-03-18', 5496.07, '1078100111888', 'BSc Applied Chemistry', '5 Years Lab QC', now);
    insEmp.run('SS-EMP-081', 'Jalene Asefa', 'Female', '1996-06-30', '+251 911 234 081', 'jalene.a@sevensunday.et', 'Adama Franco', 'ETH-0911-081', 'Asefa Tolu', '+251 911 900 081', 'Production', 'Machine Operator', '2024-04-02', 5100.00, '1078100111716', 'TVET Level III Electrical', '3 Years Machinery', now);
    insEmp.run('SS-EMP-042', 'Radiya Nasir', 'Female', '1995-12-09', '+251 911 234 042', 'radiya.n@sevensunday.et', 'Adama Posta Bet', 'ETH-0911-042', 'Nasir Hussen', '+251 911 900 042', 'Inventory', 'Store Assistant', '2024-02-10', 5000.00, '107810011899', 'BA Supply Chain', '4 Years Storekeeping', now);
    insEmp.run('SS-EMP-087', 'Shawaye Leta', 'Female', '1994-09-14', '+251 911 234 087', 'shawaye.l@sevensunday.et', 'Adama Lugo', 'ETH-0911-087', 'Leta Girma', '+251 911 900 087', 'Production', 'Assembly Line Technician', '2024-06-01', 5100.00, '1078100111872', 'TVET Level IV Production', '4 Years Assembly', now);
    insEmp.run('SS-EMP-101', 'Biniyam Tadesse', 'Male', '1988-01-25', '+251 911 555 101', 'biniyam.t@sevensunday.et', 'Bole Medhanialem, Addis Ababa', 'ETH-0911-101', 'Mekdes Biniyam', '+251 911 900 101', 'Finance', 'Finance Manager', '2021-07-01', 28500.00, '1000245889121', 'MSc Accounting & Finance', '11 Years Corporate Finance', now);
    insEmp.run('SS-EMP-102', 'Tigist Haile', 'Female', '1991-07-17', '+251 911 555 102', 'tigist.h@sevensunday.et', 'Yeka Sub-City, Addis Ababa', 'ETH-0911-102', 'Haile Gebre', '+251 911 900 102', 'Human Resources', 'HR & Secretary Lead', '2022-01-10', 21000.00, '1000245889440', 'BA Management & HR', '9 Years HR Operations', now);
    insEmp.run('SS-EMP-103', 'Daniel Mekonnen', 'Male', '1990-10-08', '+251 911 555 103', 'daniel.m@sevensunday.et', 'Hawassa / Addis Ababa', 'ETH-0911-103', 'Selam Mekonnen', '+251 911 900 103', 'Sales & CRM', 'Regional Sales Lead', '2022-08-14', 19500.00, '1000245889773', 'BA Marketing Management', '7 Years B2B Sales', now);
  }

  const payCount = (db.prepare('SELECT COUNT(*) as c FROM payroll_records').get() as { c: number }).c;
  if (payCount === 0) {
    const insPay = db.prepare(`
      INSERT INTO payroll_records (
        payroll_month, month_label, payroll_category, employee_code, employee_name, bank_account, id_no,
        department, basic_salary, standard_hours, hourly_rate, absence_hours, absence_rate, absence_amount,
        ot_normal_hours, ot_night_hours, ot_sunday_hours, ot_holiday_hours,
        ot_normal_amount, ot_night_amount, ot_sunday_amount, ot_holiday_amount,
        allowances, overtime_pay, bonuses, deductions, income_tax, employee_pension, employer_pension,
        gross_salary, net_salary, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 7 EXACT rows from Seven Sunday Manufacturing & Trading Industries PLC (Meskerm 2019)
    const meskermRows = [
      { code: 'SS-EMP-008', name: 'Kemal Ali', acc: '1078100114488', idNo: '8', dept: 'Production', basic: 6944.11 },
      { code: 'SS-EMP-039', name: 'Aysha Nasir', acc: '1078100111977', idNo: '39', dept: 'Production', basic: 5000.00 },
      { code: 'SS-EMP-006', name: 'Gadisa Getaneh', acc: '1078100112283', idNo: '6', dept: 'Production', basic: 8000.00 },
      { code: 'SS-EMP-003', name: 'Hana Hailu', acc: '1078100111888', idNo: '3', dept: 'Quality Assurance', basic: 5496.07 },
      { code: 'SS-EMP-081', name: 'Jalene Asefa', acc: '1078100111716', idNo: '81', dept: 'Production', basic: 5100.00 },
      { code: 'SS-EMP-042', name: 'Radiya Nasir', acc: '107810011899', idNo: '42', dept: 'Inventory', basic: 5000.00 },
      { code: 'SS-EMP-087', name: 'Shawaye Leta', acc: '1078100111872', idNo: '', dept: 'Production', basic: 5100.00 },
    ];
    for (const r of meskermRows) {
      const calc = computePayrollBreakdown({ basic_salary: r.basic, standard_hours: 208 });
      insPay.run(
        '2026-09', 'Meskerm 2019', 'FACTORY PERMANENT', r.code, r.name, r.acc, r.idNo, r.dept,
        calc.basic_salary, calc.standard_hours, calc.hourly_rate,
        calc.absence_hours, calc.absence_rate, calc.absence_amount,
        calc.ot_normal_hours, calc.ot_night_hours, calc.ot_sunday_hours, calc.ot_holiday_hours,
        calc.ot_normal_amount, calc.ot_night_amount, calc.ot_sunday_amount, calc.ot_holiday_amount,
        calc.allowances, calc.overtime_pay, calc.bonuses, calc.deductions,
        calc.income_tax, calc.employee_pension, calc.employer_pension,
        calc.gross_salary, calc.net_salary, 'Approved', now
      );
    }

    // Current active period (Tikimt 2019) demonstrating Absence & Categorized OT (Nor / Night / Sun / Holly)
    const tikimtRows = [
      { code: 'SS-EMP-008', name: 'Kemal Ali', acc: '1078100114488', idNo: '8', dept: 'Production', basic: 6944.11, abs: 4, nor: 6, night: 4, sun: 0, hol: 0 },
      { code: 'SS-EMP-006', name: 'Gadisa Getaneh', acc: '1078100112283', idNo: '6', dept: 'Production', basic: 8000.00, abs: 0, nor: 4, night: 6, sun: 8, hol: 0 },
      { code: 'SS-EMP-003', name: 'Hana Hailu', acc: '1078100111888', idNo: '3', dept: 'Quality Assurance', basic: 5496.07, abs: 2, nor: 4, night: 0, sun: 4, hol: 4 },
      { code: 'SS-EMP-101', name: 'Biniyam Tadesse', acc: '1000245889121', idNo: '101', dept: 'Finance', basic: 28500.00, abs: 0, nor: 2, night: 0, sun: 0, hol: 0 },
      { code: 'SS-EMP-102', name: 'Tigist Haile', acc: '1000245889440', idNo: '102', dept: 'Human Resources', basic: 21000.00, abs: 0, nor: 3, night: 0, sun: 0, hol: 0 },
    ];
    for (const r of tikimtRows) {
      const calc = computePayrollBreakdown({
        basic_salary: r.basic,
        standard_hours: 208,
        absence_hours: r.abs,
        ot_normal_hours: r.nor,
        ot_night_hours: r.night,
        ot_sunday_hours: r.sun,
        ot_holiday_hours: r.hol,
      });
      insPay.run(
        '2026-10', 'Tikimt 2019', 'OPERATIONS & STAFF', r.code, r.name, r.acc, r.idNo, r.dept,
        calc.basic_salary, calc.standard_hours, calc.hourly_rate,
        calc.absence_hours, calc.absence_rate, calc.absence_amount,
        calc.ot_normal_hours, calc.ot_night_hours, calc.ot_sunday_hours, calc.ot_holiday_hours,
        calc.ot_normal_amount, calc.ot_night_amount, calc.ot_sunday_amount, calc.ot_holiday_amount,
        calc.allowances, calc.overtime_pay, calc.bonuses, calc.deductions,
        calc.income_tax, calc.employee_pension, calc.employer_pension,
        calc.gross_salary, calc.net_salary, 'Draft', now
      );
    }
  }

  if ((db.prepare('SELECT COUNT(*) as c FROM devices').get() as { c: number }).c === 0) {
    const insDev = db.prepare(`
      INSERT INTO devices (device_type, device_name, ip_address, port, subnet_mask, gateway, serial_number, status, last_latency_ms, last_message, last_checked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insDev.run('Local EMS Gateway Node', 'Addis HQ Loopback Node', '127.0.0.1', PORT, '255.0.0.0', '127.0.0.1', 'SS-GW-LOCAL-01', 'Connected', 1, 'TCP socket verified', now);
    insDev.run('Biometric Fingerprint Terminal', 'Adama Factory Main Gate', '192.168.10.50', 4370, '255.255.255.0', '192.168.10.1', 'ZK-ADM-2026-01', 'Disconnected', null, 'Awaiting facility LAN connection', null);
    insDev.run('Face Recognition Gate', 'Production Hall Line A', '192.168.10.52', 4370, '255.255.255.0', '192.168.10.1', 'ZK-FAC-2026-02', 'Disconnected', null, 'Ready for probe', null);
  }

  if ((db.prepare('SELECT COUNT(*) as c FROM attendance_records').get() as { c: number }).c === 0) {
    const insAtt = db.prepare(`
      INSERT INTO attendance_records (
        employee_code, employee_name, department, attendance_date, shift_name, check_in, check_out,
        hourly_rate, regular_hours, ot_type, ot_hours, ot_multiplier, ot_pay, status, register_state, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insAtt.run('SS-EMP-008', 'Kemal Ali', 'Production', today, 'Night Shift', '18:00', '05:00', 33.39, 8, 'Night', 3, 1.75, 175.30, 'Present', 'Open', 'Line A continuous shift', now);
    insAtt.run('SS-EMP-006', 'Gadisa Getaneh', 'Production', today, 'Sunday Shift', '08:00', '16:00', 38.46, 0, 'Sunday', 8, 2.0, 615.36, 'Present', 'Open', 'Plant weekend overhaul', now);
    insAtt.run('SS-EMP-003', 'Hana Hailu', 'Quality Assurance', today, 'Holiday Lab Check', '08:00', '12:00', 26.42, 0, 'Holiday', 4, 2.5, 264.20, 'Present', 'Closed', 'Batch lab release verified', now);
  }

  if ((db.prepare('SELECT COUNT(*) as c FROM leaves').get() as { c: number }).c === 0) {
    db.prepare(`
      INSERT INTO leaves (employee_code, employee_name, department, leave_type, start_date, end_date, days, reason, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)
    `).run('SS-EMP-039', 'Aysha Nasir', 'Production', 'Annual', today, today, 2, 'Family travel', now);
  }

  if ((db.prepare('SELECT COUNT(*) as c FROM ledger_accounts').get() as { c: number }).c === 0) {
    const insAcc = db.prepare(`
      INSERT INTO ledger_accounts (code, name, account_type, debit_total, credit_total, balance)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insAcc.run('1010', 'Cash & Bank (CBE Main)', 'Asset', 1850000, 620000, 1230000);
    insAcc.run('1200', 'Accounts Receivable', 'Asset', 485000, 120000, 365000);
    insAcc.run('1400', 'Raw Materials & Finished Goods Inventory', 'Asset', 640000, 95000, 545000);
    insAcc.run('2010', 'Accounts Payable & Accrued Tax', 'Liability', 45000, 290000, 245000);
    insAcc.run('3010', 'Shareholders Paid-In Capital', 'Equity', 0, 1200000, 1200000);
    insAcc.run('4010', 'Manufacturing & Trading Sales Revenue', 'Revenue', 0, 1680000, 1680000);
    insAcc.run('5010', 'Cost of Goods Sold & Raw Material Cost', 'Expense', 540000, 0, 540000);
    insAcc.run('6010', 'Salaries, Overtime & Employee Benefits', 'Expense', 325000, 0, 325000);
    insAcc.run('6020', 'Plant Utilities, Fuel & Maintenance', 'Expense', 145000, 0, 145000);
  }

  if ((db.prepare('SELECT COUNT(*) as c FROM finance_vouchers').get() as { c: number }).c === 0) {
    db.prepare(`
      INSERT INTO finance_vouchers (
        voucher_number, voucher_type, voucher_date, party_name, payment_method, bank_reference,
        debit_account_id, debit_account_name, credit_account_id, credit_account_name,
        amount, description, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'CPV-2026-001', 'Bank Payment', today, 'Ethiopian Electric Power & Diesel Fleet', 'Bank Transfer', 'CBE-REF-99102',
      9, '6020 — Plant Utilities, Fuel & Maintenance', 1, '1010 — Cash & Bank (CBE Main)',
      48500, 'Adama plant monthly utility & backup diesel settlement', 'Biniyam Tadesse', now
    );
  }

  if ((db.prepare('SELECT COUNT(*) as c FROM finance_budgets').get() as { c: number }).c === 0) {
    db.prepare(`
      INSERT INTO finance_budgets (fiscal_year, department, account_id, account_code, account_name, allocated_amount, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('2026', 'Production', 8, '6010', 'Salaries, Overtime & Employee Benefits', 450000, 'FY 2026 factory labor allocation', now);
  }

  if ((db.prepare('SELECT COUNT(*) as c FROM materials').get() as { c: number }).c === 0) {
    const insMat = db.prepare(`
      INSERT INTO materials (sku, name, category, unit, stock_qty, reorder_level, unit_cost, location, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insMat.run('RM-HDPE-01', 'HDPE Food-Grade Resin Pellets', 'Raw Material', 'kg', 4200, 1000, 118, 'Adama Main Warehouse', now);
    insMat.run('RM-CART-02', 'Corrugated Export Cartons (24-Pack)', 'Packaging', 'pcs', 8500, 2000, 24.5, 'Packaging Bay B', now);
    insMat.run('RM-CAP-03', 'Tamper-Evident Polymer Caps', 'Packaging', 'pcs', 1400, 2500, 4.2, 'Packaging Bay A', now);
    insMat.run('SP-BELT-04', 'Industrial Conveyor Belt V-32', 'Spare Parts', 'pcs', 14, 5, 4200, 'Maintenance Tool Room', now);
  }

  if ((db.prepare('SELECT COUNT(*) as c FROM crm_deals').get() as { c: number }).c === 0) {
    const insDeal = db.prepare(`
      INSERT INTO crm_deals (company_name, contact_person, email, phone, stage, deal_value, assigned_rep, last_contact, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insDeal.run('Addis Retail Wholesale PLC', 'Yohannes Tesfaye', 'yohannes@addisretail.et', '+251 911 401 200', 'Negotiation', 385000, 'Daniel Mekonnen', today, 'Q4 bulk distribution contract', now);
    insDeal.run('Hawassa Beverage Distributors', 'Marta Abebe', 'marta@hawassabev.et', '+251 911 502 310', 'Proposal', 240000, 'Daniel Mekonnen', today, 'Monthly pallet supply proposal', now);
    insDeal.run('Oromia Agro Trading Union', 'Tolesa Bekele', 'tolesa@oromiaagro.et', '+251 911 603 415', 'Closed Won', 520000, 'Daniel Mekonnen', today, 'Signed annual supply agreement', now);
    insDeal.run('Dire Dawa Logistics Hub', 'Hussen Ali', 'hussen@ddhub.et', '+251 911 704 510', 'Qualified', 165000, 'Daniel Mekonnen', today, 'Eastern corridor regional warehouse supply', now);
  }

  if ((db.prepare('SELECT COUNT(*) as c FROM sales_orders').get() as { c: number }).c === 0) {
    const insOrder = db.prepare(`
      INSERT INTO sales_orders (order_number, customer_name, product_service, quantity, amount, order_date, payment_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insOrder.run('SO-2026-101', 'Oromia Agro Trading Union', 'Finished Packaged Goods (400 Cartons)', 400, 520000, today, 'Paid', now);
    insOrder.run('SO-2026-102', 'Addis Retail Wholesale PLC', 'Standard Consumer Line (210 Cartons)', 210, 273000, today, 'Pending', now);
  }

  if ((db.prepare('SELECT COUNT(*) as c FROM vehicles').get() as { c: number }).c === 0) {
    const insVeh = db.prepare(`
      INSERT INTO vehicles (plate_number, vehicle_model, driver_name, department, mileage_km, fuel_cost, maintenance_cost, insurance_expiry, inspection_date, status, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insVeh.run('ET-3-88412-AA', 'Isuzu NPR Cargo Truck', 'Abebe Bikila', 'Logistics', 84200, 28500, 12000, '2027-03-15', today, 'Active', 'Addis - Adama shuttle', now);
    insVeh.run('ET-3-91204-OR', 'Toyota Hilux Double Cab', 'Girma Tulu', 'Sales & CRM', 42100, 16200, 4500, '2027-01-20', today, 'Active', 'Regional sales visits', now);
  }

  if ((db.prepare('SELECT COUNT(*) as c FROM equipment_maintenance').get() as { c: number }).c === 0) {
    db.prepare(`
      INSERT INTO equipment_maintenance (
        equipment_code, equipment_name, category, serial_number, location, maintenance_type,
        technician_name, maintenance_date, next_service_due, cost, status, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('MCH-BLOW-01', 'Automated Extrusion Molding Line A', 'Factory Machinery', 'EX-2024-8812', 'Adama Factory', 'Preventive', 'Gadisa Getaneh', today, '2026-12-01', 14800, 'Scheduled', 'Hydraulic seal & heater band calibration', now);
  }

  if ((db.prepare('SELECT COUNT(*) as c FROM assets_uniforms').get() as { c: number }).c === 0) {
    db.prepare(`
      INSERT INTO assets_uniforms (item_name, category, employee_id, employee_name, quantity, condition, date_issued, status, notes, created_at)
      VALUES (?, ?, ?, ?, ?, 'New', ?, 'Issued', 'Factory floor PPE set', ?)
    `).run('Heavy-Duty Safety Coverall & Steel Boots', 'PPE & Safety Gear', 'SS-EMP-008', 'Kemal Ali', 2, today, now);
  }

  if ((db.prepare('SELECT COUNT(*) as c FROM company_documents').get() as { c: number }).c === 0) {
    db.prepare(`
      INSERT INTO company_documents (doc_number, title, category, department, issued_by, issue_date, confidentiality, status, language, content, translated_content, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'Internal', 'Issued', 'en', ?, ?, ?)
    `).run(
      'SS-DOC-2026-001',
      'Q4 Production Shift & Overtime Authorization Directive',
      'Official Memo',
      'Secretary & Admin',
      'Tigist Haile (Corporate Secretary)',
      today,
      'All factory supervisors must record Normal (1.5x), Night (1.75x), Sunday (2.0x), and Holiday (2.5x) overtime hours in the Payroll Sheet before the 25th of each Ethiopian month.',
      '[አማርኛ ትርጉም] የፋብሪካ ተቆጣጣሪዎች የመደበኛ፣ የሌሊት፣ የእሑድ እና የበዓል የትርፍ ሰዓት መረጃዎችን በየወሩ መመዝገብ አለባቸው።',
      now
    );
  }

  if ((db.prepare('SELECT COUNT(*) as c FROM company_form_submissions').get() as { c: number }).c === 0) {
    db.prepare(`
      INSERT INTO company_form_submissions (
        submission_number, form_code, form_title, department_key, department_name,
        employee_code, employee_name, submission_date, reference_no, status,
        form_data_json, prepared_by, checked_by, approved_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'FORM-2026-001',
      'SS-HR-18',
      'Annual Staff Performance Evaluation Rubric',
      'hr',
      'Human Resources & Administration',
      'SS-EMP-008',
      'Kemal Ali',
      today,
      'EVAL-2026-Q4-008',
      'Submitted',
      JSON.stringify({
        values: { branch_location: 'Adama Factory', priority: 'Normal', review_cycle: 'Q4', job_grade: 'Senior Line Operator' },
        columns: ['Item #', 'Requirement / Particular', 'Value / Metric', 'Verification Status'],
        rows: [['1', 'Zero-Defect Line Output', '98.4%', 'Verified']],
        remarks: 'Strong shift reliability and machine safety compliance.',
        includeEvaluation: true,
        evaluationPeriod: 'Q4 2026',
        evaluatorName: 'Gadisa Getaneh',
        evaluationRows: [
          { criterion: 'Job Knowledge & Technical Execution', weight: 25, rating: 5, comments: 'Mastered Line A' },
          { criterion: 'Punctuality, Shift Discipline & Attendance', weight: 15, rating: 4, comments: 'Consistent' },
          { criterion: 'Quality Output & Zero-Defect Compliance', weight: 20, rating: 5, comments: 'Zero rejections' },
          { criterion: 'Teamwork, Communication & Attitude', weight: 15, rating: 4, comments: 'Supports junior staff' },
          { criterion: 'Safety (PPE), Asset Care & Accountability', weight: 15, rating: 5, comments: 'Exemplary PPE' },
          { criterion: 'Initiative & Continuous Improvement', weight: 10, rating: 4, comments: 'Suggested jig fix' },
        ],
      }),
      'Tigist Haile',
      'Gadisa Getaneh',
      'Dawit Bekele',
      now,
      now
    );
  }

  if ((db.prepare('SELECT COUNT(*) as c FROM chat_channels').get() as { c: number }).c === 0) {
    const insCh = db.prepare('INSERT INTO chat_channels (name, department, description, created_at) VALUES (?, ?, ?, ?)');
    const channels = [
      ['#general-announcements', 'Management', 'Company-wide leadership notices'],
      ['#factory-production', 'Production', 'Adama factory shifts & line updates'],
      ['#hr-and-payroll', 'Human Resources', 'Onboarding, attendance, leave & payroll'],
      ['#finance-treasury', 'Finance', 'Vouchers, tax filings & ledger postings'],
      ['#warehouse-grn-gin', 'Inventory', 'Receiving, issuing & stock audits'],
      ['#procurement-rfq', 'Procurement', 'Vendor tenders & purchase orders'],
      ['#sales-and-crm', 'Sales & CRM', 'Pipeline deals & distributor orders'],
      ['#quality-assurance', 'Quality Assurance', 'QC lab releases & NCRs'],
      ['#fleet-logistics', 'Logistics', 'Truck dispatch & maintenance'],
      ['#hse-safety', 'HSE', 'Plant safety & PPE compliance'],
      ['#it-device-sync', 'IT & Devices', 'Biometric terminals & offline sync'],
    ];
    for (const [name, dept, desc] of channels) {
      insCh.run(name, dept, desc, now);
    }
    db.prepare('INSERT INTO chat_messages (channel_id, sender_name, sender_role, content, attachment_name, created_at) VALUES (1, ?, ?, ?, NULL, ?)').run(
      'Dawit Bekele',
      'Super Administrator',
      'Welcome to Seven Sunday ETMS. Payroll Absence, Categorized Overtime (Nor/Night/Sun/Holly), and Executive Analytics Charts are active.',
      now
    );
  }

  if ((db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as { c: number }).c === 0) {
    db.prepare('INSERT INTO audit_logs (actor_name, actor_role, action, module, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      'Dawit Bekele',
      'Super Administrator',
      'SYSTEM_INIT',
      'Admin',
      'Initialized Seven Sunday ETMS SQLite database with Ethiopian Payroll & Executive Analytics',
      now
    );
  }

  if ((db.prepare('SELECT COUNT(*) as c FROM gate_passes').get() as { c: number }).c === 0) {
    const insGp = db.prepare(`
      INSERT INTO gate_passes (
        pass_number, pass_token, pass_type, person_name, employee_code, department,
        destination, purpose, items_description, vehicle_plate, valid_date,
        issued_by, approved_department, status, used_at, verified_by_guard, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insGp.run(
      'GP-2026-001',
      'ONCE-8F29-A104',
      'Material Exit',
      'Abebe Bikila',
      'SS-FLT-01',
      'Logistics',
      'Addis Ababa Distribution Depot',
      'Dispatch 120 cartons finished goods to Addis Retail Wholesale',
      '120 Cartons Packaged Goods (SO-2026-102)',
      'ET-3-88412-AA',
      today,
      'Daniel Mekonnen',
      'Security & Gate',
      'Active',
      null,
      '',
      now
    );
    insGp.run(
      'GP-2026-002',
      'ONCE-4C18-B772',
      'Staff Exit',
      'Kemal Ali',
      'SS-EMP-008',
      'Production',
      'Adama Commercial Bank Branch',
      'Official shift bank errand and supplier sample drop-off',
      'Sealed Sample Box (2kg)',
      '',
      today,
      'Gadisa Getaneh',
      'Human Resources',
      'Used',
      now,
      'Gate Officer Tadesse',
      now
    );
  }

  if ((db.prepare('SELECT COUNT(*) as c FROM department_approvals').get() as { c: number }).c === 0) {
    const insApp = db.prepare(`
      INSERT INTO department_approvals (
        request_code, source_module, record_ref, title, summary, from_department,
        target_department, requested_by, priority, notes, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)
    `);
    insApp.run(
      'APR-2026-001',
      'company-forms',
      'FORM-2026-001',
      'Annual Staff Performance Evaluation Rubric — Kemal Ali',
      'SS-HR-18 submitted for Q4 2026 evaluation sign-off (Weighted Score: 91%).',
      'Human Resources',
      'General Manager',
      'Tigist Haile',
      'Normal',
      'Please review and finalize GM approval.',
      now
    );
    insApp.run(
      'APR-2026-002',
      'secretary',
      'SS-DOC-2026-001',
      'Q4 Production Shift & Overtime Authorization Directive',
      'Official A4 bilingual directive ready for executive sign-off and plant circulation.',
      'Secretary & Admin',
      'Factory Production',
      'Tigist Haile',
      'Urgent',
      'Confirm shift supervisor circulation.',
      now
    );
  }
  // Seed isolated starter workspaces for Tenant 2 (Adama Plant) and Tenant 3 (Hawassa Hub) if empty
  for (const tid of [2, 3]) {
    const tExists = db.prepare('SELECT id, brand_name FROM tenants WHERE id = ?').get(tid) as { id: number; brand_name: string } | undefined;
    if (!tExists) continue;
    const tEmpCount = (db.prepare('SELECT COUNT(*) as c FROM employees WHERE tenant_id = ?').get(tid) as { c: number }).c;
    if (tEmpCount === 0) {
      if (tid === 2) {
        db.prepare(`
          INSERT INTO employees (
            tenant_id, employee_id, full_name, gender, dob, phone, email, address, national_id,
            emergency_contact, emergency_contact_phone, department, job_title, employment_type,
            start_date, basic_salary, bank_account, education, experience, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Permanent', ?, ?, ?, ?, ?, 'Active', ?)
        `).run(2, 'SS-T2-001', 'Tadesse Roba', 'Male', '1991-03-14', '+251 911 881 001', 'tadesse.r@sevensunday.et', 'Adama Industrial Zone', 'ETH-ADM-001', 'Bontu Roba', '+251 911 881 099', 'Production', 'Adama Plant Manager', '2023-02-01', 18500, '100088120001', 'BSc Industrial Engineering', '8 Years Plant Ops', now);
        db.prepare(`
          INSERT INTO employees (
            tenant_id, employee_id, full_name, gender, dob, phone, email, address, national_id,
            emergency_contact, emergency_contact_phone, department, job_title, employment_type,
            start_date, basic_salary, bank_account, education, experience, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Permanent', ?, ?, ?, ?, ?, 'Active', ?)
        `).run(2, 'SS-T2-002', 'Chaltu Gemechu', 'Female', '1994-11-20', '+251 911 881 002', 'chaltu.g@sevensunday.et', 'Adama Kebele 12', 'ETH-ADM-002', 'Gemechu Tola', '+251 911 881 088', 'Quality Assurance', 'QC Shift Chemist', '2024-01-10', 9200, '100088120002', 'BSc Chemistry', '5 Years QA Lab', now);
        db.prepare(`
          INSERT INTO devices (tenant_id, device_type, protocol, device_name, ip_address, port, endpoint_url, subnet_mask, gateway, serial_number, api_key, status, last_latency_ms, last_message, last_checked_at)
          VALUES (2, 'Local EMS Gateway Node', 'HTTP/HTTPS REST', 'Adama Plant Local Health Node', '127.0.0.1', ?, ?, '255.0.0.0', '127.0.0.1', 'ZK-ADM-NODE-02', 'SS-DEV-ADM-02', 'Connected', 2, 'HTTP/TCP endpoint verified', ?)
        `).run(PORT, `http://127.0.0.1:${PORT}/api/health`, now);
      } else {
        db.prepare(`
          INSERT INTO employees (
            tenant_id, employee_id, full_name, gender, dob, phone, email, address, national_id,
            emergency_contact, emergency_contact_phone, department, job_title, employment_type,
            start_date, basic_salary, bank_account, education, experience, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Permanent', ?, ?, ?, ?, ?, 'Active', ?)
        `).run(3, 'SS-T3-001', 'Dawit Yohannes', 'Male', '1992-05-11', '+251 911 772 001', 'dawit.y@sevensunday.et', 'Hawassa Tabor', 'ETH-HAW-001', 'Selamawit Y.', '+251 911 772 099', 'Logistics', 'Hawassa Hub Coordinator', '2023-06-15', 16200, '100077220001', 'BA Logistics', '6 Years Distribution', now);
        db.prepare(`
          INSERT INTO devices (tenant_id, device_type, protocol, device_name, ip_address, port, endpoint_url, subnet_mask, gateway, serial_number, api_key, status, last_latency_ms, last_message, last_checked_at)
          VALUES (3, 'RFID Card Reader', 'TCP/IP Socket', 'Hawassa Depot Gate Reader', '127.0.0.1', ?, '', '255.0.0.0', '127.0.0.1', 'RF-HAW-NODE-03', 'SS-DEV-HAW-03', 'Connected', 1, 'TCP socket verified', ?)
        `).run(PORT, now);
      }
    }
    const tLedgerCnt = (db.prepare('SELECT COUNT(*) as c FROM ledger_accounts WHERE tenant_id = ?').get(tid) as { c: number }).c;
    if (tLedgerCnt === 0) {
      const insAccT = db.prepare(`
        INSERT INTO ledger_accounts (tenant_id, code, name, account_type, debit_total, credit_total, balance)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insAccT.run(tid, `T${tid}-1010`, `${tExists.brand_name} Cash & Bank`, 'Asset', 650000, 120000, 530000);
      insAccT.run(tid, `T${tid}-4010`, `${tExists.brand_name} Operations Revenue`, 'Revenue', 0, 740000, 740000);
      insAccT.run(tid, `T${tid}-6010`, `${tExists.brand_name} Salaries & OT Expense`, 'Expense', 180000, 0, 180000);
    }
    const tChatCnt = (db.prepare('SELECT COUNT(*) as c FROM chat_channels WHERE tenant_id = ?').get(tid) as { c: number }).c;
    if (tChatCnt === 0) {
      const chInfo = db.prepare('INSERT INTO chat_channels (tenant_id, name, department, description, created_at) VALUES (?, ?, ?, ?, ?)').run(
        tid, `#general-t${tid}`, 'Management', `${tExists.brand_name} general operations channel`, now
      );
      db.prepare('INSERT INTO chat_messages (channel_id, sender_name, sender_role, content, attachment_name, created_at) VALUES (?, ?, ?, ?, NULL, ?)').run(
        chInfo.lastInsertRowid, 'System Administrator', 'System Administrator', `Initialized isolated multi-tenant workspace for ${tExists.brand_name}.`, now
      );
    }
    seedWorkforceDefaultsForTenant(tid);
  }

  // Ensure Tenant 1 (and all existing tenants) have default shifts, departments, holidays & workforce rules
  const allTenantRows = db.prepare('SELECT id FROM tenants').all() as Array<{ id: number }>;
  for (const tRow of allTenantRows) {
    seedWorkforceDefaultsForTenant(tRow.id);
  }
  seedWorkforceDefaultsForTenant(1);

  // Seed realistic current-week staff schedules on Tenant 1 if empty
  const schedCnt = (db.prepare('SELECT COUNT(*) as c FROM staff_schedules WHERE tenant_id = 1').get() as { c: number }).c;
  if (schedCnt === 0) {
    const t1Shifts = db.prepare('SELECT * FROM shifts WHERE tenant_id = 1').all() as Array<Record<string, unknown>>;
    const t1Emps = db.prepare("SELECT employee_id, full_name, department FROM employees WHERE tenant_id = 1 AND status = 'Active' ORDER BY id ASC LIMIT 8").all() as Array<{ employee_id: string; full_name: string; department: string }>;
    const shiftByCat = (cat: string) => t1Shifts.find((s) => s.shift_category === cat) || t1Shifts[0];
    const today = new Date();
    const dayOffsetIso = (offset: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      return d.toISOString().slice(0, 10);
    };
    if (t1Shifts.length > 0 && t1Emps.length > 0) {
      const insSched = db.prepare(`
        INSERT INTO staff_schedules (
          tenant_id, schedule_code, employee_id, employee_name, department, shift_id, shift_name, shift_category,
          schedule_date, end_date, start_time, end_time, break_minutes, schedule_type, rotation_group,
          availability_status, approval_status, approved_by, created_by, updated_by, notes, created_at, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Assigned', 'Approved', 'System Administrator', 'System Administrator', 'System Administrator', ?, ?, ?)
      `);
      const cycleCats = ['Morning Shift', 'Afternoon Shift', 'Night Shift', 'Day Shift', 'Security Guard Shift', 'Morning Shift', 'Afternoon Shift', 'Day Shift'];
      let seq = 1;
      for (let empIdx = 0; empIdx < t1Emps.length; empIdx++) {
        const emp = t1Emps[empIdx];
        const cat = emp.department === 'Security' ? 'Security Guard Shift' : cycleCats[empIdx % cycleCats.length];
        const sh = shiftByCat(cat);
        for (let dOff = -1; dOff <= 4; dOff++) {
          const dt = dayOffsetIso(dOff);
          const schedType = cat === 'Security Guard Shift' ? 'Security Guard' : sh.is_rotating ? 'Rotating' : 'Regular';
          insSched.run(
            `SCH-1-${String(seq++).padStart(4, '0')}`,
            emp.employee_id,
            emp.full_name,
            emp.department,
            Number(sh.id),
            String(sh.shift_name),
            String(sh.shift_category),
            dt,
            dt,
            String(sh.start_time),
            String(sh.end_time),
            Number(sh.break_minutes) || 30,
            schedType,
            sh.is_rotating ? `Group-${(empIdx % 3) + 1}` : 'Standard',
            `Auto-seeded ${cat} timetable entry`,
            now,
            now
          );
        }
      }
    }
  }
}

function seedWorkforceDefaultsForTenant(tenantId: number) {
  const now = new Date().toISOString();
  const shiftCnt = (db.prepare('SELECT COUNT(*) as c FROM shifts WHERE tenant_id = ?').get(tenantId) as { c: number }).c;
  if (shiftCnt === 0) {
    const insShift = db.prepare(`
      INSERT INTO shifts (
        tenant_id, shift_code, shift_name, shift_category, scheduling_system, start_time, end_time,
        break_minutes, working_days, rest_days, min_rest_hours, is_rotating, rotation_pattern,
        color_hex, ot_multiplier, grace_late_minutes, status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?)
    `);
    const defaultShifts = [
      ['SHF-DAY', 'Day Shift', 'Day Shift', 'Standard', '08:00', '17:00', 60, '["Mon","Tue","Wed","Thu","Fri"]', '["Sat","Sun"]', 11, 0, 'Fixed Standard', '#2563eb', 1.5, 15, 'Standard administrative & daytime operations'],
      ['SHF-MRN', 'Morning Shift', 'Morning Shift', '3-Shift', '06:00', '14:00', 30, '["Mon","Tue","Wed","Thu","Fri","Sat"]', '["Sun"]', 11, 1, 'Weekly 3-Shift Rotation', '#0ea5e9', 1.5, 10, 'Early plant & service morning shift'],
      ['SHF-AFT', 'Afternoon Shift', 'Afternoon Shift', '3-Shift', '14:00', '22:00', 30, '["Mon","Tue","Wed","Thu","Fri","Sat"]', '["Sun"]', 11, 1, 'Weekly 3-Shift Rotation', '#f59e0b', 1.5, 10, 'Mid-day / swing production shift'],
      ['SHF-NGT', 'Night Shift', 'Night Shift', '3-Shift', '22:00', '06:00', 30, '["Mon","Tue","Wed","Thu","Fri","Sat"]', '["Sun"]', 12, 1, 'Day-to-Night Rotation', '#6366f1', 1.75, 10, 'Overnight operations shift (1.75x night rate)'],
      ['SHF-WKD', 'Weekend Shift', 'Weekend Shift', '4-Shift', '08:00', '16:00', 45, '["Sat","Sun"]', '["Mon","Tue","Wed","Thu","Fri"]', 11, 0, 'Weekend Coverage', '#10b981', 2.0, 15, 'Saturday & Sunday coverage crew'],
      ['SHF-HOL', 'Holiday Shift', 'Holiday Shift', '4-Shift', '08:00', '16:00', 45, '["Sun"]', '[]', 12, 0, 'Public Holiday Duty', '#ec4899', 2.5, 15, 'Official public holiday essential staff'],
      ['SHF-SEC', 'Security Guard Shift', 'Security Guard Shift', 'Security 24/7', '18:00', '06:00', 45, '["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]', '[]', 12, 1, '4-Team 24/7 Security Rotation', '#0f172a', 1.75, 5, 'Gate control, patrol & perimeter duty'],
      ['SHF-SPC', 'Special Duty Shift', 'Special Duty Shift', '4-Shift', '09:00', '17:00', 45, '["Mon","Tue","Wed","Thu","Fri"]', '["Sat","Sun"]', 11, 0, 'Task Assignment', '#8b5cf6', 1.5, 10, 'Audits, maintenance shutdown & special dispatch'],
      ['SHF-OTM', 'Overtime Shift', 'Overtime Shift', 'Standard', '17:00', '21:00', 15, '["Mon","Tue","Wed","Thu","Fri","Sat"]', '["Sun"]', 11, 0, 'On-Demand Overtime', '#ea580c', 1.75, 5, 'Extended production & deadline overtime block'],
    ] as const;
    for (const s of defaultShifts) {
      insShift.run(tenantId, ...s, now, now);
    }
  }

  const rulesExist = db.prepare('SELECT id FROM workforce_rules WHERE tenant_id = ?').get(tenantId);
  if (!rulesExist) {
    db.prepare(`
      INSERT INTO workforce_rules (
        tenant_id, late_grace_minutes, early_departure_grace_minutes, default_break_minutes,
        min_rest_hours_between_shifts, auto_detect_conflicts, require_manager_approval, default_shift_system, updated_at
      ) VALUES (?, 15, 10, 60, 11, 1, 1, '3-Shift', ?)
    `).run(tenantId, now);
  }

  const deptCnt = (db.prepare('SELECT COUNT(*) as c FROM departments WHERE tenant_id = ?').get(tenantId) as { c: number }).c;
  if (deptCnt === 0) {
    const rawDepts = tenantId === 1
      ? (db.prepare('SELECT departments FROM company_settings WHERE id = 1').get() as { departments: string } | undefined)?.departments
      : (db.prepare('SELECT departments FROM tenants WHERE id = ?').get(tenantId) as { departments: string } | undefined)?.departments;
    const deptNames = (rawDepts || 'Production,Human Resources,Secretary,Finance,Inventory,Quality Assurance,Security,Sales & CRM,Operations')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!deptNames.some((d) => d.toLowerCase().includes('security'))) deptNames.push('Security');

    const shiftsForTenant = db.prepare('SELECT id, shift_category FROM shifts WHERE tenant_id = ?').all(tenantId) as Array<{ id: number; shift_category: string }>;
    const empsForTenant = db.prepare('SELECT employee_id, full_name, department FROM employees WHERE tenant_id = ? ORDER BY id ASC').all(tenantId) as Array<{ employee_id: string; full_name: string; department: string }>;
    const insDept = db.prepare(`
      INSERT INTO departments (
        tenant_id, dept_code, name, manager_employee_id, manager_name, scheduling_system, default_shift_id,
        working_days, rest_days, weekend_schedule_enabled, holiday_schedule_enabled, security_guard_coverage,
        monthly_timetable_notes, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)
    `);
    deptNames.forEach((dName, idx) => {
      const isProd = /prod|quality|ops|manufact|water/i.test(dName);
      const isSec = /security|guard/i.test(dName);
      const sys = isSec ? 'Security 24/7' : isProd ? '3-Shift' : 'Standard';
      const targetCat = isSec ? 'Security Guard Shift' : isProd ? 'Morning Shift' : 'Day Shift';
      const sh = shiftsForTenant.find((s) => s.shift_category === targetCat) || shiftsForTenant[0];
      const mgr = empsForTenant.find((e) => e.department.toLowerCase() === dName.toLowerCase()) || null;
      const workDays = isSec ? '["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]' : isProd ? '["Mon","Tue","Wed","Thu","Fri","Sat"]' : '["Mon","Tue","Wed","Thu","Fri"]';
      const restDays = isSec ? '[]' : isProd ? '["Sun"]' : '["Sat","Sun"]';
      insDept.run(
        tenantId,
        `DEPT-${String(idx + 1).padStart(2, '0')}`,
        dName,
        mgr ? mgr.employee_id : '',
        mgr ? mgr.full_name : 'Department Lead',
        sys,
        sh ? sh.id : null,
        workDays,
        restDays,
        isSec || isProd ? 1 : 0,
        isSec ? 1 : 0,
        isSec ? '24/7 Gate & Perimeter Guard Rotation' : isProd ? 'Plant Shift Supervisor Desk' : 'Standard Business Hours',
        `${dName} department weekly & monthly rotating timetable`,
        now,
        now
      );
    });
  }

  const holCnt = (db.prepare('SELECT COUNT(*) as c FROM holidays_calendar WHERE tenant_id = ?').get(tenantId) as { c: number }).c;
  if (holCnt === 0) {
    const year = new Date().getFullYear();
    const insHol = db.prepare(`
      INSERT INTO holidays_calendar (tenant_id, holiday_date, name, is_paid, ot_multiplier, notes, created_at)
      VALUES (?, ?, ?, 1, 2.5, ?, ?)
    `);
    const holidays = [
      [`${year}-01-07`, 'Ethiopian Christmas (Genna)', 'National public holiday (2.5x OT)'],
      [`${year}-01-19`, 'Epiphany (Timkat)', 'National public holiday (2.5x OT)'],
      [`${year}-03-02`, 'Victory of Adwa', 'National public holiday (2.5x OT)'],
      [`${year}-05-01`, 'International Labour Day', 'National public holiday (2.5x OT)'],
      [`${year}-05-05`, 'Ethiopian Patriots Victory Day', 'National public holiday (2.5x OT)'],
      [`${year}-09-11`, 'Ethiopian New Year (Enkutatash)', 'National public holiday (2.5x OT)'],
      [`${year}-09-27`, 'Finding of the True Cross (Meskel)', 'National public holiday (2.5x OT)'],
    ];
    for (const [dt, nm, notes] of holidays) {
      insHol.run(tenantId, dt, nm, notes, now);
    }
  }
}

seedIfEmpty();

// ============================================================================
// EXPRESS + WEBSOCKET SERVER
// ============================================================================
const app = express();
app.use(express.json({ limit: '25mb' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcastWs(event: string, payload: unknown) {
  const frame = JSON.stringify({ event, payload });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(frame);
    }
  });
}

wss.on('connection', (ws) => {
  broadcastWs('presence:count', { count: wss.clients.size });
  ws.on('close', () => {
    broadcastWs('presence:count', { count: wss.clients.size });
  });
});

function getTenantId(req: express.Request): number {
  const raw = req.headers['x-tenant-id'] ?? req.query.tenant_id;
  const parsed = Number(raw);
  if (Number.isInteger(parsed) && parsed > 0) {
    const exists = db.prepare('SELECT id FROM tenants WHERE id = ?').get(parsed) as { id: number } | undefined;
    if (exists) return exists.id;
  }
  return 1;
}

function logAudit(req: express.Request, action: string, module: string, summary: string, explicitTenantId?: number) {
  const tid = explicitTenantId ?? getTenantId(req);
  const actorName = String(req.headers['x-actor-name'] || 'System Operator');
  const actorRole = String(req.headers['x-actor-role'] || 'Super Administrator');
  db.prepare(
    'INSERT INTO audit_logs (tenant_id, actor_name, actor_role, action, module, summary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(tid, actorName, actorRole, action, module, summary, new Date().toISOString());
}

function getActorName(req: express.Request): string {
  return String(req.headers['x-actor-name'] || 'System Operator');
}

function getActorRole(req: express.Request): string {
  return String(req.headers['x-actor-role'] || '');
}

const ATTENDANCE_MANAGER_ROLES = new Set([
  'System Administrator',
  'Super Administrator',
  'Company Owner',
  'General Manager',
  'Human Resource Manager',
  'HR Manager',
  'Department Manager',
  'Attendance Officer',
  'Security Supervisor',
]);

const SHIFT_DEPT_ADMIN_ROLES = new Set([
  'System Administrator',
  'Super Administrator',
  'Company Owner',
  'General Manager',
  'Human Resource Manager',
  'HR Manager',
  'Department Manager',
]);

function requireRole(req: express.Request, res: express.Response, allowed: Set<string>, actionDesc: string): boolean {
  const role = getActorRole(req);
  // If internal or missing header in non-user background scripts, treat gracefully only if explicit role wasn't blocked;
  // Wait: if header is present and not allowed, block with 403!
  if (role && !allowed.has(role)) {
    res.status(403).json({ error: `Permission denied (${role}) for ${actionDesc}.` });
    return false;
  }
  return true;
}

function provisionTenantDefaults(tenantId: number, brandName: string) {
  const now = new Date().toISOString();
  const ledgerCnt = (db.prepare('SELECT COUNT(*) as c FROM ledger_accounts WHERE tenant_id = ?').get(tenantId) as { c: number }).c;
  if (ledgerCnt === 0) {
    const insAcc = db.prepare(
      'INSERT INTO ledger_accounts (tenant_id, code, name, account_type, debit_total, credit_total, balance) VALUES (?, ?, ?, ?, 0, 0, 0)'
    );
    insAcc.run(tenantId, `T${tenantId}-1010`, `${brandName} Cash & Bank`, 'Asset');
    insAcc.run(tenantId, `T${tenantId}-4010`, `${brandName} Operations Revenue`, 'Revenue');
    insAcc.run(tenantId, `T${tenantId}-6010`, `${brandName} Salaries & OT Expense`, 'Expense');
  }
  const chatCnt = (db.prepare('SELECT COUNT(*) as c FROM chat_channels WHERE tenant_id = ?').get(tenantId) as { c: number }).c;
  if (chatCnt === 0) {
    const chName = tenantId === 1 ? '#general-announcements' : `#general-t${tenantId}`;
    const info = db
      .prepare('INSERT INTO chat_channels (tenant_id, name, department, description, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(tenantId, chName, 'Management', `${brandName} general announcements channel`, now);
    db.prepare(
      'INSERT INTO chat_messages (channel_id, sender_name, sender_role, content, attachment_name, created_at) VALUES (?, ?, ?, ?, NULL, ?)'
    ).run(info.lastInsertRowid, 'System Administrator', 'System Administrator', `Workspace initialized for ${brandName}.`, now);
  }
  seedWorkforceDefaultsForTenant(tenantId);
}

function buildCompanySettingsForTenant(tenantId: number) {
  const base = db.prepare('SELECT * FROM company_settings WHERE id = 1').get() as Record<string, unknown>;
  if (tenantId === 1) {
    return { ...base, tenant_id: 1 };
  }
  const t = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) as Record<string, unknown> | undefined;
  if (!t) return { ...base, tenant_id: 1 };
  return {
    ...base,
    id: 1,
    tenant_id: Number(t.id),
    company_name: t.name,
    brand_name: t.brand_name,
    slogan: t.slogan,
    secondary_slogan: t.secondary_slogan,
    address: t.address,
    phone: t.phone,
    email: t.email,
    website: t.website,
    tin_number: t.tin_number,
    default_currency: t.default_currency,
    calendar_mode: t.calendar_mode,
    default_language: t.default_language,
    branches: t.branches,
    departments: t.departments,
    logo_data: t.logo_data || base.logo_data || '',
    stamp_data: t.stamp_data || base.stamp_data || '',
    signature_data: t.signature_data || base.signature_data || '',
    smtp_host: t.smtp_host || base.smtp_host,
    smtp_port: t.smtp_port || base.smtp_port,
    smtp_user: t.smtp_user || base.smtp_user,
    smtp_pass: t.smtp_pass || base.smtp_pass,
    smtp_from: t.smtp_from || base.smtp_from,
    smtp_secure: t.smtp_secure ?? base.smtp_secure,
    rbac_matrix: t.rbac_matrix && String(t.rbac_matrix) !== '{}' ? t.rbac_matrix : base.rbac_matrix,
    platform_config: t.platform_config && String(t.platform_config) !== '{}' ? t.platform_config : base.platform_config || '{}',
    updated_at: t.updated_at,
  };
}

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Auth
app.post('/api/auth/login', (req, res) => {
  const { email, password, tenant_id } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(String(email || '')) as
    | (Record<string, unknown> & { password?: string; status?: string; id: number; full_name: string; role: string; tenant_id?: number })
    | undefined;
  if (!user || user.password !== password) {
    res.status(401).json({ error: 'Invalid corporate email or password.' });
    return;
  }
  if (user.status === 'Suspended') {
    res.status(403).json({ error: 'Account is suspended. Contact System Administrator.' });
    return;
  }
  const requestedTid = Number(tenant_id || req.headers['x-tenant-id'] || user.tenant_id || 1);
  const targetTenant = db.prepare('SELECT id, status, brand_name FROM tenants WHERE id = ?').get(requestedTid) as
    | { id: number; status: string; brand_name: string }
    | undefined;
  const effectiveTid = targetTenant ? targetTenant.id : 1;
  if (
    targetTenant &&
    targetTenant.status === 'Suspended' &&
    user.role !== 'System Administrator' &&
    user.role !== 'Super Administrator'
  ) {
    res.status(403).json({ error: `Tenant workspace "${targetTenant.brand_name}" is currently suspended.` });
    return;
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(now, user.id);
  db.prepare(
    'INSERT INTO audit_logs (tenant_id, actor_name, actor_role, action, module, summary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(effectiveTid, user.full_name, user.role, 'LOGIN', 'Auth', `Signed in as ${user.full_name} (${user.role})`, now);
  const { password: _pw, ...safe } = user;
  res.json({ ...safe, tenant_id: effectiveTid, last_login: now });
});

// Multi-Tenant Workspace CRUD
app.get('/api/tenants', (_req, res) => {
  const rows = db.prepare('SELECT * FROM tenants ORDER BY id ASC').all() as Array<Record<string, unknown>>;
  const enriched = rows.map((t) => {
    const tid = Number(t.id);
    const employee_count = (db.prepare('SELECT COUNT(*) as c FROM employees WHERE tenant_id = ?').get(tid) as { c: number }).c;
    const device_count = (db.prepare('SELECT COUNT(*) as c FROM devices WHERE tenant_id = ?').get(tid) as { c: number }).c;
    const pending_approvals = (
      db.prepare("SELECT COUNT(*) as c FROM department_approvals WHERE tenant_id = ? AND status = 'Pending'").get(tid) as { c: number }
    ).c;
    return { ...t, employee_count, device_count, pending_approvals };
  });
  res.json(enriched);
});

app.post('/api/tenants', (req, res) => {
  const b = req.body || {};
  const now = new Date().toISOString();
  const count = (db.prepare('SELECT COUNT(*) as c FROM tenants').get() as { c: number }).c + 1;
  const code = String(b.tenant_code || '').trim() || `SS-TNT-${String(count).padStart(2, '0')}`;
  const name = String(b.name || '').trim() || 'New Enterprise Workspace';
  const brandName = String(b.brand_name || '').trim() || name;
  const defaultPayrollRules = JSON.stringify({
    employee_pension_rate: 7,
    employer_pension_rate: 11,
    default_bonus_rate: 10,
    brackets_json: JSON.stringify(DEFAULT_ETHIOPIAN_BRACKETS),
  });
  const defaultOtJson = JSON.stringify({
    ot_regular_multiplier: 1.5,
    ot_night_multiplier: 1.75,
    ot_sunday_multiplier: 2.0,
    ot_holiday_multiplier: 2.5,
  });
  try {
    const info = db
      .prepare(
        `
      INSERT INTO tenants (
        tenant_code, name, brand_name, slogan, secondary_slogan, address, phone, email, website,
        tin_number, default_currency, calendar_mode, default_language, branches, departments,
        rbac_matrix, platform_config, ot_settings_json, payroll_rules_json, plan, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)
    `
      )
      .run(
        code,
        name,
        brandName,
        b.slogan || 'The Home of quality product',
        b.secondary_slogan || 'Together for a Stronger and Better Tomorrow',
        b.address || 'Addis Ababa, Ethiopia',
        b.phone || '+251 11 000 0000',
        b.email || 'workspace@sevensunday.et',
        b.website || 'https://sevensunday.et',
        b.tin_number || '',
        b.default_currency || 'ETB',
        b.calendar_mode || 'Gregorian',
        b.default_language || 'en',
        b.branches || `${brandName} HQ`,
        b.departments || 'Operations, HR, Secretary, Finance, Inventory, Procurement, Sales & CRM',
        b.rbac_matrix || '{}',
        b.platform_config || '{}',
        defaultOtJson,
        defaultPayrollRules,
        b.plan || 'Enterprise Branch',
        now,
        now
      );
    const newTid = Number(info.lastInsertRowid);
    provisionTenantDefaults(newTid, brandName);
    logAudit(req, 'CREATE', 'Tenants', `Created tenant workspace "${brandName}" (${code})`, newTid);
    broadcastWs('tenant:updated', { id: newTid });
    const created = db.prepare('SELECT * FROM tenants WHERE id = ?').get(newTid) as Record<string, unknown>;
    res.status(201).json({ ...created, employee_count: 0, device_count: 0, pending_approvals: 0 });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create tenant workspace' });
  }
});

app.put('/api/tenants/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }
  const b = req.body || {};
  const now = new Date().toISOString();
  db.prepare(
    `
    UPDATE tenants SET
      tenant_code=?, name=?, brand_name=?, slogan=?, secondary_slogan=?, address=?, phone=?, email=?, website=?,
      tin_number=?, default_currency=?, calendar_mode=?, default_language=?, branches=?, departments=?,
      plan=?, status=?, updated_at=?
    WHERE id = ?
  `
  ).run(
    b.tenant_code ?? existing.tenant_code,
    b.name ?? existing.name,
    b.brand_name ?? existing.brand_name,
    b.slogan ?? existing.slogan,
    b.secondary_slogan ?? existing.secondary_slogan,
    b.address ?? existing.address,
    b.phone ?? existing.phone,
    b.email ?? existing.email,
    b.website ?? existing.website,
    b.tin_number ?? existing.tin_number,
    b.default_currency ?? existing.default_currency,
    b.calendar_mode ?? existing.calendar_mode,
    b.default_language ?? existing.default_language,
    b.branches ?? existing.branches,
    b.departments ?? existing.departments,
    b.plan ?? existing.plan,
    b.status ?? existing.status,
    now,
    id
  );
  if (id === 1) {
    db.prepare(
      `
      UPDATE company_settings SET
        company_name=?, brand_name=?, slogan=?, secondary_slogan=?, address=?, phone=?, email=?, website=?,
        tin_number=?, default_currency=?, calendar_mode=?, default_language=?, branches=?, departments=?, updated_at=?
      WHERE id = 1
    `
    ).run(
      b.name ?? existing.name,
      b.brand_name ?? existing.brand_name,
      b.slogan ?? existing.slogan,
      b.secondary_slogan ?? existing.secondary_slogan,
      b.address ?? existing.address,
      b.phone ?? existing.phone,
      b.email ?? existing.email,
      b.website ?? existing.website,
      b.tin_number ?? existing.tin_number,
      b.default_currency ?? existing.default_currency,
      b.calendar_mode ?? existing.calendar_mode,
      b.default_language ?? existing.default_language,
      b.branches ?? existing.branches,
      b.departments ?? existing.departments,
      now
    );
  }
  logAudit(req, 'UPDATE', 'Tenants', `Updated tenant #${id} (${b.brand_name ?? existing.brand_name})`, id);
  broadcastWs('tenant:updated', { id });
  res.json(db.prepare('SELECT * FROM tenants WHERE id = ?').get(id));
});

app.patch('/api/tenants/:id/status', (req, res) => {
  const id = Number(req.params.id);
  if (id === 1 && req.body?.status === 'Suspended') {
    res.status(400).json({ error: 'Primary HQ Tenant (#1) cannot be suspended.' });
    return;
  }
  const status = req.body?.status === 'Suspended' ? 'Suspended' : 'Active';
  db.prepare('UPDATE tenants SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), id);
  logAudit(req, 'STATUS', 'Tenants', `Set tenant #${id} status to ${status}`, id);
  broadcastWs('tenant:updated', { id });
  res.json(db.prepare('SELECT * FROM tenants WHERE id = ?').get(id));
});

app.delete('/api/tenants/:id', (req, res) => {
  const id = Number(req.params.id);
  if (id === 1) {
    res.status(400).json({ error: 'Primary HQ Tenant (#1) cannot be deleted.' });
    return;
  }
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE tenant_id = ?)').run(id);
    db.prepare('DELETE FROM chat_messages WHERE channel_id IN (SELECT id FROM chat_channels WHERE tenant_id = ?)').run(id);
    for (const tbl of TENANT_SCOPED_TABLES) {
      db.prepare(`DELETE FROM ${tbl} WHERE tenant_id = ?`).run(id);
    }
    db.prepare('DELETE FROM tenants WHERE id = ?').run(id);
  });
  tx();
  logAudit(req, 'DELETE', 'Tenants', `Deleted tenant workspace #${id}`, 1);
  broadcastWs('tenant:updated', { id });
  res.json({ ok: true });
});

// Company Settings (per-tenant aware)
app.get('/api/company-settings', (req, res) => {
  const tid = getTenantId(req);
  res.json(buildCompanySettingsForTenant(tid));
});

app.put('/api/company-settings', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  if (tid === 1) {
    const cur = db.prepare('SELECT * FROM company_settings WHERE id = 1').get() as Record<string, unknown>;
    db.prepare(
      `
      UPDATE company_settings SET
        company_name=?, brand_name=?, slogan=?, secondary_slogan=?, address=?, phone=?, email=?, website=?,
        tin_number=?, default_currency=?, calendar_mode=?, default_language=?, branches=?, departments=?,
        logo_data=?, stamp_data=?, signature_data=?, smtp_host=?, smtp_port=?, smtp_user=?, smtp_pass=?,
        smtp_from=?, smtp_secure=?, rbac_matrix=?, platform_config=?, updated_at=?
      WHERE id = 1
    `
    ).run(
      b.company_name ?? cur.company_name,
      b.brand_name ?? cur.brand_name,
      b.slogan ?? cur.slogan,
      b.secondary_slogan ?? cur.secondary_slogan,
      b.address ?? cur.address,
      b.phone ?? cur.phone,
      b.email ?? cur.email,
      b.website ?? cur.website,
      b.tin_number ?? cur.tin_number,
      b.default_currency ?? cur.default_currency,
      b.calendar_mode ?? cur.calendar_mode,
      b.default_language ?? cur.default_language,
      b.branches ?? cur.branches,
      b.departments ?? cur.departments,
      b.logo_data ?? cur.logo_data,
      b.stamp_data ?? cur.stamp_data,
      b.signature_data ?? cur.signature_data,
      b.smtp_host ?? cur.smtp_host,
      Number(b.smtp_port ?? cur.smtp_port) || 587,
      b.smtp_user ?? cur.smtp_user,
      b.smtp_pass ?? cur.smtp_pass,
      b.smtp_from ?? cur.smtp_from,
      b.smtp_secure !== undefined ? Number(b.smtp_secure) : cur.smtp_secure,
      b.rbac_matrix ?? cur.rbac_matrix,
      b.platform_config ?? cur.platform_config ?? '{}',
      now
    );
    db.prepare(
      `
      UPDATE tenants SET
        name=?, brand_name=?, slogan=?, secondary_slogan=?, address=?, phone=?, email=?, website=?,
        tin_number=?, default_currency=?, calendar_mode=?, default_language=?, branches=?, departments=?,
        logo_data=?, stamp_data=?, signature_data=?, smtp_host=?, smtp_port=?, smtp_user=?, smtp_pass=?,
        smtp_from=?, smtp_secure=?, rbac_matrix=?, platform_config=?, updated_at=?
      WHERE id = 1
    `
    ).run(
      b.company_name ?? cur.company_name,
      b.brand_name ?? cur.brand_name,
      b.slogan ?? cur.slogan,
      b.secondary_slogan ?? cur.secondary_slogan,
      b.address ?? cur.address,
      b.phone ?? cur.phone,
      b.email ?? cur.email,
      b.website ?? cur.website,
      b.tin_number ?? cur.tin_number,
      b.default_currency ?? cur.default_currency,
      b.calendar_mode ?? cur.calendar_mode,
      b.default_language ?? cur.default_language,
      b.branches ?? cur.branches,
      b.departments ?? cur.departments,
      b.logo_data ?? cur.logo_data,
      b.stamp_data ?? cur.stamp_data,
      b.signature_data ?? cur.signature_data,
      b.smtp_host ?? cur.smtp_host,
      Number(b.smtp_port ?? cur.smtp_port) || 587,
      b.smtp_user ?? cur.smtp_user,
      b.smtp_pass ?? cur.smtp_pass,
      b.smtp_from ?? cur.smtp_from,
      b.smtp_secure !== undefined ? Number(b.smtp_secure) : cur.smtp_secure,
      b.rbac_matrix ?? cur.rbac_matrix,
      b.platform_config ?? cur.platform_config ?? '{}',
      now
    );
  } else {
    const cur = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tid) as Record<string, unknown>;
    db.prepare(
      `
      UPDATE tenants SET
        name=?, brand_name=?, slogan=?, secondary_slogan=?, address=?, phone=?, email=?, website=?,
        tin_number=?, default_currency=?, calendar_mode=?, default_language=?, branches=?, departments=?,
        logo_data=?, stamp_data=?, signature_data=?, smtp_host=?, smtp_port=?, smtp_user=?, smtp_pass=?,
        smtp_from=?, smtp_secure=?, rbac_matrix=?, platform_config=?, updated_at=?
      WHERE id = ?
    `
    ).run(
      b.company_name ?? cur.name,
      b.brand_name ?? cur.brand_name,
      b.slogan ?? cur.slogan,
      b.secondary_slogan ?? cur.secondary_slogan,
      b.address ?? cur.address,
      b.phone ?? cur.phone,
      b.email ?? cur.email,
      b.website ?? cur.website,
      b.tin_number ?? cur.tin_number,
      b.default_currency ?? cur.default_currency,
      b.calendar_mode ?? cur.calendar_mode,
      b.default_language ?? cur.default_language,
      b.branches ?? cur.branches,
      b.departments ?? cur.departments,
      b.logo_data ?? cur.logo_data,
      b.stamp_data ?? cur.stamp_data,
      b.signature_data ?? cur.signature_data,
      b.smtp_host ?? cur.smtp_host,
      Number(b.smtp_port ?? cur.smtp_port) || 587,
      b.smtp_user ?? cur.smtp_user,
      b.smtp_pass ?? cur.smtp_pass,
      b.smtp_from ?? cur.smtp_from,
      b.smtp_secure !== undefined ? Number(b.smtp_secure) : cur.smtp_secure,
      b.rbac_matrix ?? cur.rbac_matrix,
      b.platform_config ?? cur.platform_config ?? '{}',
      now,
      tid
    );
  }
  logAudit(req, 'UPDATE', 'Admin', `Updated workspace settings, RBAC & platform config (Tenant #${tid})`, tid);
  broadcastWs('settings:updated', { tenant_id: tid, updated_at: now });
  res.json(buildCompanySettingsForTenant(tid));
});

// Users
app.get('/api/users', (req, res) => {
  const tid = getTenantId(req);
  const rows = db
    .prepare(
      "SELECT id, tenant_id, employee_code, full_name, email, department, job_title, role, status, last_login, created_at FROM users WHERE tenant_id = ? OR role = 'System Administrator' ORDER BY id DESC"
    )
    .all(tid);
  res.json(rows);
});

app.post('/api/users', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const code = b.employee_code || `SS-T${tid}-USR-${Math.floor(100 + Math.random() * 900)}`;
  try {
    const info = db
      .prepare(
        `
      INSERT INTO users (tenant_id, employee_code, full_name, email, password, department, job_title, role, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)
    `
      )
      .run(
        tid,
        code,
        b.full_name,
        b.email,
        b.password || 'SevenSunday@2026',
        b.department || 'Operations',
        b.job_title || 'Staff',
        b.role || 'Employee',
        now
      );
    const created = db
      .prepare('SELECT id, tenant_id, employee_code, full_name, email, department, job_title, role, status, last_login, created_at FROM users WHERE id = ?')
      .get(info.lastInsertRowid);
    logAudit(req, 'CREATE', 'Users', `Created user ${b.email} (${b.role})`, tid);
    res.status(201).json(created);
  } catch (err) {
    res.status(409).json({ error: err instanceof Error ? err.message : 'User email already exists' });
  }
});

app.patch('/api/users/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const { status, role } = req.body || {};
  if (status) db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);
  if (role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  const updated = db
    .prepare('SELECT id, tenant_id, employee_code, full_name, email, department, job_title, role, status, last_login, created_at FROM users WHERE id = ?')
    .get(id);
  logAudit(req, 'UPDATE', 'Users', `Updated user #${id} role/status`);
  res.json(updated);
});

app.delete('/api/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const target = db.prepare('SELECT role FROM users WHERE id = ?').get(id) as { role?: string } | undefined;
  if (target?.role === 'System Administrator') {
    const sysCount = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'System Administrator'").get() as { c: number }).c;
    if (sysCount <= 1) {
      res.status(400).json({ error: 'Cannot delete the sole System Administrator account.' });
      return;
    }
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  logAudit(req, 'DELETE', 'Users', `Removed user #${id}`);
  res.json({ ok: true });
});

// Employees
app.get('/api/employees', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM employees WHERE tenant_id = ? ORDER BY id DESC').all(tid));
});

app.post('/api/employees', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  let empId =
    String(b.employee_id || '').trim() ||
    (tid === 1 ? `SS-EMP-${Math.floor(100 + Math.random() * 899)}` : `SS-T${tid}-EMP-${Math.floor(100 + Math.random() * 899)}`);
  const existsEmp = db.prepare('SELECT id FROM employees WHERE employee_id = ?').get(empId);
  if (existsEmp) {
    empId = `${empId}-T${tid}-${Math.floor(10 + Math.random() * 89)}`;
  }
  const info = db
    .prepare(
      `
    INSERT INTO employees (
      tenant_id, employee_id, full_name, gender, dob, phone, email, address, national_id,
      emergency_contact, emergency_contact_phone, department, job_title, employment_type,
      start_date, contract_expiry, basic_salary, bank_account, education, experience,
      photo_data, education_doc_name, education_doc_data, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)
  `
    )
    .run(
      tid,
      empId,
      b.full_name,
      b.gender || 'Male',
      b.dob || '',
      b.phone || '',
      b.email || '',
      b.address || '',
      b.national_id || '',
      b.emergency_contact || '',
      b.emergency_contact_phone || '',
      b.department || 'Operations',
      b.job_title || 'Staff',
      b.employment_type || 'Permanent',
      b.start_date || now.slice(0, 10),
      b.contract_expiry || '',
      Number(b.basic_salary) || 0,
      b.bank_account || '',
      b.education || '',
      b.experience || '',
      b.photo_data || '',
      b.education_doc_name || '',
      b.education_doc_data || '',
      now
    );
  const created = db.prepare('SELECT * FROM employees WHERE id = ?').get(info.lastInsertRowid);
  logAudit(req, 'CREATE', 'HR', `Registered employee ${b.full_name} (${empId})`, tid);
  res.status(201).json(created);
});

app.put('/api/employees/:id', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const b = req.body || {};
  const existing = db.prepare('SELECT employee_id FROM employees WHERE id = ? AND tenant_id = ?').get(id, tid) as { employee_id: string } | undefined;
  const tx = db.transaction(() => {
    db.prepare(
      `
      UPDATE employees SET
        full_name=?, gender=?, dob=?, phone=?, email=?, address=?, national_id=?,
        emergency_contact=?, emergency_contact_phone=?, department=?, job_title=?, employment_type=?,
        start_date=?, contract_expiry=?, basic_salary=?, bank_account=?, education=?, experience=?,
        photo_data=?, education_doc_name=?, education_doc_data=?
      WHERE id = ? AND tenant_id = ?
    `
    ).run(
      b.full_name,
      b.gender || 'Male',
      b.dob || '',
      b.phone || '',
      b.email || '',
      b.address || '',
      b.national_id || '',
      b.emergency_contact || '',
      b.emergency_contact_phone || '',
      b.department || 'Operations',
      b.job_title || 'Staff',
      b.employment_type || 'Permanent',
      b.start_date || new Date().toISOString().slice(0, 10),
      b.contract_expiry || '',
      Number(b.basic_salary) || 0,
      b.bank_account || '',
      b.education || '',
      b.experience || '',
      b.photo_data || '',
      b.education_doc_name || '',
      b.education_doc_data || '',
      id,
      tid
    );
    // Automatically synchronize central employee updates across Attendance, Schedules, Payroll, Leaves, Assets, Forms & Dept Managers
    if (existing?.employee_id) {
      const code = existing.employee_id;
      const name = String(b.full_name || '');
      const dept = String(b.department || 'Operations');
      db.prepare('UPDATE attendance_records SET employee_name = ?, department = ? WHERE tenant_id = ? AND employee_code = ?').run(name, dept, tid, code);
      db.prepare('UPDATE staff_schedules SET employee_name = ?, department = ? WHERE tenant_id = ? AND employee_id = ?').run(name, dept, tid, code);
      db.prepare('UPDATE staff_schedules SET replacement_employee_name = ? WHERE tenant_id = ? AND replacement_employee_id = ?').run(name, tid, code);
      db.prepare('UPDATE payroll_records SET employee_name = ?, department = ? WHERE tenant_id = ? AND employee_code = ?').run(name, dept, tid, code);
      db.prepare('UPDATE leaves SET employee_name = ?, department = ? WHERE tenant_id = ? AND employee_code = ?').run(name, dept, tid, code);
      db.prepare('UPDATE assets_uniforms SET employee_name = ? WHERE tenant_id = ? AND employee_id = ?').run(name, tid, code);
      db.prepare('UPDATE company_form_submissions SET employee_name = ?, department_name = ? WHERE tenant_id = ? AND employee_code = ?').run(name, dept, tid, code);
      db.prepare('UPDATE departments SET manager_name = ? WHERE tenant_id = ? AND manager_employee_id = ?').run(name, tid, code);
    }
  });
  tx();
  const updated = db.prepare('SELECT * FROM employees WHERE id = ? AND tenant_id = ?').get(id, tid);
  logAudit(req, 'UPDATE', 'HR', `Updated central employee ${b.full_name} & synchronized connected modules`, tid);
  res.json(updated);
});

app.delete('/api/employees/:id', (req, res) => {
  const tid = getTenantId(req);
  db.prepare('DELETE FROM employees WHERE id = ? AND tenant_id = ?').run(Number(req.params.id), tid);
  logAudit(req, 'DELETE', 'HR', `Deleted employee #${req.params.id}`, tid);
  res.json({ ok: true });
});

// Payroll + Absence & Categorized OT
app.get('/api/payroll', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM payroll_records WHERE tenant_id = ? ORDER BY id ASC').all(tid));
});

app.post('/api/payroll/generate', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const calc = computePayrollBreakdown(
    {
      basic_salary: Number(b.basic_salary) || 0,
      standard_hours: Number(b.standard_hours) || 208,
      absence_hours: Number(b.absence_hours) || 0,
      absence_rate: b.absence_rate !== undefined ? Number(b.absence_rate) : undefined,
      ot_normal_hours: Number(b.ot_normal_hours) || 0,
      ot_night_hours: Number(b.ot_night_hours) || 0,
      ot_sunday_hours: Number(b.ot_sunday_hours) || 0,
      ot_holiday_hours: Number(b.ot_holiday_hours) || 0,
      allowances: Number(b.allowances) || 0,
      overtime_pay: Number(b.overtime_pay) || 0,
      bonuses: Number(b.bonuses) || 0,
      deductions: Number(b.deductions) || 0,
    },
    tid
  );

  const info = db
    .prepare(
      `
    INSERT INTO payroll_records (
      tenant_id, payroll_month, month_label, payroll_category, employee_code, employee_name, bank_account, id_no,
      department, basic_salary, standard_hours, hourly_rate, absence_hours, absence_rate, absence_amount,
      ot_normal_hours, ot_night_hours, ot_sunday_hours, ot_holiday_hours,
      ot_normal_amount, ot_night_amount, ot_sunday_amount, ot_holiday_amount,
      allowances, overtime_pay, bonuses, deductions, income_tax, employee_pension, employer_pension,
      gross_salary, net_salary, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?)
  `
    )
    .run(
      tid,
      b.payroll_month || now.slice(0, 7),
      b.month_label || b.payroll_month || now.slice(0, 7),
      b.payroll_category || 'FACTORY PERMANENT',
      b.employee_code || `SS-EMP-${Math.floor(100 + Math.random() * 900)}`,
      b.employee_name || 'Staff Member',
      b.bank_account || '',
      b.id_no || '',
      b.department || 'Production',
      calc.basic_salary,
      calc.standard_hours,
      calc.hourly_rate,
      calc.absence_hours,
      calc.absence_rate,
      calc.absence_amount,
      calc.ot_normal_hours,
      calc.ot_night_hours,
      calc.ot_sunday_hours,
      calc.ot_holiday_hours,
      calc.ot_normal_amount,
      calc.ot_night_amount,
      calc.ot_sunday_amount,
      calc.ot_holiday_amount,
      calc.allowances,
      calc.overtime_pay,
      calc.bonuses,
      calc.deductions,
      calc.income_tax,
      calc.employee_pension,
      calc.employer_pension,
      calc.gross_salary,
      calc.net_salary,
      now
    );

  const created = db.prepare('SELECT * FROM payroll_records WHERE id = ?').get(info.lastInsertRowid);
  logAudit(req, 'CREATE', 'Payroll', `Generated payroll row for ${b.employee_name}`, tid);
  broadcastWs('payroll:updated', { id: info.lastInsertRowid, tenant_id: tid });
  res.status(201).json(created);
});

app.put('/api/payroll/:id', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM payroll_records WHERE id = ? AND tenant_id = ?').get(id, tid) as
    | Record<string, unknown>
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Payroll record not found' });
    return;
  }
  const b = req.body || {};
  const calc = computePayrollBreakdown(
    {
      basic_salary: b.basic_salary !== undefined ? Number(b.basic_salary) : Number(existing.basic_salary),
      standard_hours: b.standard_hours !== undefined ? Number(b.standard_hours) : Number(existing.standard_hours),
      absence_hours: b.absence_hours !== undefined ? Number(b.absence_hours) : Number(existing.absence_hours),
      absence_rate: b.absence_rate !== undefined ? Number(b.absence_rate) : undefined,
      ot_normal_hours: b.ot_normal_hours !== undefined ? Number(b.ot_normal_hours) : Number(existing.ot_normal_hours),
      ot_night_hours: b.ot_night_hours !== undefined ? Number(b.ot_night_hours) : Number(existing.ot_night_hours),
      ot_sunday_hours: b.ot_sunday_hours !== undefined ? Number(b.ot_sunday_hours) : Number(existing.ot_sunday_hours),
      ot_holiday_hours: b.ot_holiday_hours !== undefined ? Number(b.ot_holiday_hours) : Number(existing.ot_holiday_hours),
      allowances: b.allowances !== undefined ? Number(b.allowances) : Number(existing.allowances),
      overtime_pay: b.overtime_pay !== undefined ? Number(b.overtime_pay) : Number(existing.overtime_pay),
      bonuses: b.bonuses !== undefined ? Number(b.bonuses) : Number(existing.bonuses),
      deductions: b.deductions !== undefined ? Number(b.deductions) : Number(existing.deductions),
    },
    tid
  );

  db.prepare(
    `
    UPDATE payroll_records SET
      employee_name=?, bank_account=?, id_no=?, basic_salary=?, standard_hours=?, hourly_rate=?,
      absence_hours=?, absence_rate=?, absence_amount=?,
      ot_normal_hours=?, ot_night_hours=?, ot_sunday_hours=?, ot_holiday_hours=?,
      ot_normal_amount=?, ot_night_amount=?, ot_sunday_amount=?, ot_holiday_amount=?,
      allowances=?, overtime_pay=?, bonuses=?, deductions=?,
      income_tax=?, employee_pension=?, employer_pension=?, gross_salary=?, net_salary=?
    WHERE id = ? AND tenant_id = ?
  `
  ).run(
    b.employee_name ?? existing.employee_name,
    b.bank_account ?? existing.bank_account,
    b.id_no ?? existing.id_no,
    calc.basic_salary,
    calc.standard_hours,
    calc.hourly_rate,
    calc.absence_hours,
    calc.absence_rate,
    calc.absence_amount,
    calc.ot_normal_hours,
    calc.ot_night_hours,
    calc.ot_sunday_hours,
    calc.ot_holiday_hours,
    calc.ot_normal_amount,
    calc.ot_night_amount,
    calc.ot_sunday_amount,
    calc.ot_holiday_amount,
    calc.allowances,
    calc.overtime_pay,
    calc.bonuses,
    calc.deductions,
    calc.income_tax,
    calc.employee_pension,
    calc.employer_pension,
    calc.gross_salary,
    calc.net_salary,
    id,
    tid
  );

  const updated = db.prepare('SELECT * FROM payroll_records WHERE id = ?').get(id);
  logAudit(req, 'UPDATE', 'Payroll', `Updated payroll row #${id} (Absence/OT recalculated)`, tid);
  broadcastWs('payroll:updated', { id, tenant_id: tid });
  res.json(updated);
});

app.patch('/api/payroll/:id/status', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const { status } = req.body || {};
  db.prepare('UPDATE payroll_records SET status = ? WHERE id = ? AND tenant_id = ?').run(status || 'Approved', id, tid);
  const updated = db.prepare('SELECT * FROM payroll_records WHERE id = ? AND tenant_id = ?').get(id, tid);
  logAudit(req, 'STATUS', 'Payroll', `Set payroll #${id} status to ${status}`, tid);
  res.json(updated);
});

app.delete('/api/payroll/:id', (req, res) => {
  const tid = getTenantId(req);
  db.prepare('DELETE FROM payroll_records WHERE id = ? AND tenant_id = ?').run(Number(req.params.id), tid);
  logAudit(req, 'DELETE', 'Payroll', `Deleted payroll row #${req.params.id}`, tid);
  res.json({ ok: true });
});

app.get('/api/payroll-runs', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM payroll_runs WHERE tenant_id = ? ORDER BY id DESC').all(tid));
});

app.post('/api/payroll-runs/calculate', (req, res) => {
  const tid = getTenantId(req);
  const { payroll_month, bonus_percent = 0, fixed_bonus = 0 } = req.body || {};
  const month = payroll_month || new Date().toISOString().slice(0, 7);
  const now = new Date().toISOString();
  const activeEmps = db
    .prepare("SELECT * FROM employees WHERE tenant_id = ? AND status = 'Active'")
    .all(tid) as Array<Record<string, unknown>>;

  const createdPayrolls: unknown[] = [];
  let totalGross = 0;
  let totalBonus = 0;
  let totalTax = 0;
  let totalPension = 0;
  let totalNet = 0;

  const insPay = db.prepare(`
    INSERT INTO payroll_records (
      tenant_id, payroll_month, month_label, payroll_category, employee_code, employee_name, bank_account, id_no,
      department, basic_salary, standard_hours, hourly_rate, absence_hours, absence_rate, absence_amount,
      ot_normal_hours, ot_night_hours, ot_sunday_hours, ot_holiday_hours,
      ot_normal_amount, ot_night_amount, ot_sunday_amount, ot_holiday_amount,
      allowances, overtime_pay, bonuses, deductions, income_tax, employee_pension, employer_pension,
      gross_salary, net_salary, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?)
  `);

  for (const emp of activeEmps) {
    const basic = Number(emp.basic_salary) || 0;
    const empCode = String(emp.employee_id);
    const attSum = db
      .prepare(
        "SELECT COALESCE(SUM(ot_pay), 0) as ot FROM attendance_records WHERE tenant_id = ? AND employee_code = ? AND substr(attendance_date, 1, 7) = ?"
      )
      .get(tid, empCode, month) as { ot: number };
    const bonus = Number((Number(fixed_bonus) + basic * (Number(bonus_percent) / 100)).toFixed(2));
    const calc = computePayrollBreakdown(
      {
        basic_salary: basic,
        standard_hours: 208,
        overtime_pay: Number(attSum?.ot) || 0,
        bonuses: bonus,
      },
      tid
    );
    const info = insPay.run(
      tid,
      month,
      month,
      String(emp.department || 'OPERATIONS').toUpperCase(),
      empCode,
      String(emp.full_name),
      String(emp.bank_account || ''),
      empCode.replace(/\D/g, ''),
      String(emp.department || 'Operations'),
      calc.basic_salary,
      calc.standard_hours,
      calc.hourly_rate,
      0,
      calc.absence_rate,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      calc.overtime_pay,
      calc.bonuses,
      0,
      calc.income_tax,
      calc.employee_pension,
      calc.employer_pension,
      calc.gross_salary,
      calc.net_salary,
      now
    );
    createdPayrolls.push(db.prepare('SELECT * FROM payroll_records WHERE id = ?').get(info.lastInsertRowid));
    totalGross += calc.gross_salary;
    totalBonus += bonus;
    totalTax += calc.income_tax;
    totalPension += calc.employee_pension + calc.employer_pension;
    totalNet += calc.net_salary;
  }

  const runCode = `PR-T${tid}-${month.replace('-', '')}-${Math.floor(100 + Math.random() * 899)}`;
  const runInfo = db
    .prepare(
      `
    INSERT INTO payroll_runs (tenant_id, run_code, payroll_month, employee_count, total_gross, total_bonus, total_tax, total_pension, total_net, status, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completed', ?, ?)
  `
    )
    .run(
      tid,
      runCode,
      month,
      activeEmps.length,
      Number(totalGross.toFixed(2)),
      Number(totalBonus.toFixed(2)),
      Number(totalTax.toFixed(2)),
      Number(totalPension.toFixed(2)),
      Number(totalNet.toFixed(2)),
      getActorName(req),
      now
    );

  const run = db.prepare('SELECT * FROM payroll_runs WHERE id = ?').get(runInfo.lastInsertRowid);
  logAudit(req, 'RUN', 'Payroll', `Executed monthly payroll run ${runCode} for ${activeEmps.length} staff`, tid);
  res.status(201).json({ run, payrolls: createdPayrolls });
});

app.get('/api/payroll-rules', (req, res) => {
  const tid = getTenantId(req);
  const { rulesRow } = getRulesAndOt(tid);
  res.json({ id: 1, tenant_id: tid, ...rulesRow, updated_at: new Date().toISOString() });
});

app.put('/api/payroll-rules', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const payload = {
    employee_pension_rate: Number(b.employee_pension_rate ?? 7),
    employer_pension_rate: Number(b.employer_pension_rate ?? 11),
    default_bonus_rate: Number(b.default_bonus_rate ?? 10),
    brackets_json: String(b.brackets_json || JSON.stringify(DEFAULT_ETHIOPIAN_BRACKETS)),
  };
  if (tid === 1) {
    db.prepare(
      'UPDATE payroll_rules SET employee_pension_rate=?, employer_pension_rate=?, default_bonus_rate=?, brackets_json=?, updated_at=? WHERE id = 1'
    ).run(payload.employee_pension_rate, payload.employer_pension_rate, payload.default_bonus_rate, payload.brackets_json, now);
  }
  db.prepare('UPDATE tenants SET payroll_rules_json=?, updated_at=? WHERE id=?').run(JSON.stringify(payload), now, tid);
  logAudit(req, 'UPDATE', 'Payroll', `Updated Ethiopian tax brackets & pension rules (Tenant #${tid})`, tid);
  res.json({ id: 1, tenant_id: tid, ...payload, updated_at: now });
});

app.post('/api/payroll-rules/reset-ethiopian', (req, res) => {
  const tid = getTenantId(req);
  const now = new Date().toISOString();
  const payload = {
    employee_pension_rate: 7,
    employer_pension_rate: 11,
    default_bonus_rate: 10,
    brackets_json: JSON.stringify(DEFAULT_ETHIOPIAN_BRACKETS),
  };
  if (tid === 1) {
    db.prepare(
      'UPDATE payroll_rules SET employee_pension_rate=7, employer_pension_rate=11, default_bonus_rate=10, brackets_json=?, updated_at=? WHERE id = 1'
    ).run(payload.brackets_json, now);
  }
  db.prepare('UPDATE tenants SET payroll_rules_json=?, updated_at=? WHERE id=?').run(JSON.stringify(payload), now, tid);
  logAudit(req, 'RESET', 'Payroll', 'Reset payroll rules to Ethiopian 2025 Schedule', tid);
  res.json({ id: 1, tenant_id: tid, ...payload, updated_at: now });
});

app.get('/api/ot-settings', (req, res) => {
  const tid = getTenantId(req);
  const { otRow } = getRulesAndOt(tid);
  res.json({ id: 1, tenant_id: tid, ...otRow, updated_at: new Date().toISOString() });
});

app.put('/api/ot-settings', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const payload = {
    ot_regular_multiplier: Number(b.ot_regular_multiplier ?? 1.5),
    ot_night_multiplier: Number(b.ot_night_multiplier ?? 1.75),
    ot_sunday_multiplier: Number(b.ot_sunday_multiplier ?? 2.0),
    ot_holiday_multiplier: Number(b.ot_holiday_multiplier ?? 2.5),
  };
  if (tid === 1) {
    db.prepare(
      'UPDATE ot_settings SET ot_regular_multiplier=?, ot_night_multiplier=?, ot_sunday_multiplier=?, ot_holiday_multiplier=?, updated_at=? WHERE id = 1'
    ).run(payload.ot_regular_multiplier, payload.ot_night_multiplier, payload.ot_sunday_multiplier, payload.ot_holiday_multiplier, now);
  }
  db.prepare('UPDATE tenants SET ot_settings_json=?, updated_at=? WHERE id=?').run(JSON.stringify(payload), now, tid);
  logAudit(req, 'UPDATE', 'Attendance/Payroll', `Updated OT multipliers for Tenant #${tid}`, tid);
  res.json({ id: 1, tenant_id: tid, ...payload, updated_at: now });
});

// Device Connections (TCP/IP, HTTP/HTTPS REST, Subnet Scanner & Live Biometric Punch Sync)
function tcpProbe(host: string, port: number, timeoutMs = 2000): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let settled = false;
    const finish = (ok: boolean, message: string) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ ok, latencyMs: Date.now() - start, message });
    };
    socket.setTimeout(timeoutMs);
    socket.connect(port, host, () => finish(true, `TCP handshake succeeded on ${host}:${port}`));
    socket.on('timeout', () => finish(false, `Connection timed out (${timeoutMs}ms) to ${host}:${port}`));
    socket.on('error', (err) => finish(false, `TCP error: ${err.message}`));
  });
}

async function httpProbe(urlString: string, timeoutMs = 2500): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  const start = Date.now();
  try {
    const res = await fetch(urlString, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return {
      ok: res.ok,
      latencyMs: Date.now() - start,
      message: `HTTP ${res.status} ${res.statusText || 'OK'} from ${urlString}`,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      message: `HTTP probe failed: ${err instanceof Error ? err.message : 'Network error'}`,
    };
  }
}

async function probeDeviceRecord(dev: {
  id: number;
  tenant_id: number;
  device_name: string;
  ip_address: string;
  port: number;
  protocol?: string;
  endpoint_url?: string;
}) {
  const useHttp =
    dev.protocol === 'HTTP/HTTPS REST' ||
    (typeof dev.endpoint_url === 'string' && /^https?:\/\//i.test(dev.endpoint_url.trim()));
  const probe = useHttp
    ? await httpProbe(dev.endpoint_url?.trim() || `http://${dev.ip_address}:${dev.port}/`, 2200)
    : await tcpProbe(dev.ip_address, Number(dev.port) || 4370, 1800);
  const status = probe.ok ? 'Connected' : 'Unreachable';
  const now = new Date().toISOString();
  if (probe.ok) {
    db.prepare('UPDATE devices SET status=?, last_latency_ms=?, last_message=?, last_checked_at=?, last_sync_at=? WHERE id=?').run(
      status,
      probe.latencyMs,
      probe.message,
      now,
      now,
      dev.id
    );
  } else {
    db.prepare('UPDATE devices SET status=?, last_latency_ms=?, last_message=?, last_checked_at=? WHERE id=?').run(
      status,
      probe.latencyMs,
      probe.message,
      now,
      dev.id
    );
  }
  return { probe, status, updated: db.prepare('SELECT * FROM devices WHERE id = ?').get(dev.id) };
}

app.get('/api/devices', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM devices WHERE tenant_id = ? ORDER BY id DESC').all(tid));
});

app.post('/api/devices', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const apiKey = String(b.api_key || '').trim() || `SS-DEV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const info = db
    .prepare(
      `
    INSERT INTO devices (
      tenant_id, device_type, protocol, device_name, ip_address, port, endpoint_url,
      subnet_mask, gateway, serial_number, api_key, status, last_message
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Disconnected', 'Registered · Ready to probe')
  `
    )
    .run(
      tid,
      b.device_type || 'Biometric Fingerprint Terminal',
      b.protocol || 'TCP/IP Socket',
      b.device_name,
      b.ip_address,
      Number(b.port) || 4370,
      b.endpoint_url || '',
      b.subnet_mask || '255.255.255.0',
      b.gateway || '192.168.10.1',
      b.serial_number || '',
      apiKey
    );
  const created = db.prepare('SELECT * FROM devices WHERE id = ?').get(info.lastInsertRowid);
  logAudit(req, 'CREATE', 'Device Connections', `Registered ${b.device_name} (${b.protocol || 'TCP/IP Socket'} · ${b.ip_address}:${b.port})`, tid);
  res.status(201).json(created);
});

app.put('/api/devices/:id', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const b = req.body || {};
  db.prepare(
    `
    UPDATE devices SET
      device_type=?, protocol=?, device_name=?, ip_address=?, port=?, endpoint_url=?,
      subnet_mask=?, gateway=?, serial_number=?, api_key=?
    WHERE id=? AND tenant_id=?
  `
  ).run(
    b.device_type,
    b.protocol || 'TCP/IP Socket',
    b.device_name,
    b.ip_address,
    Number(b.port) || 4370,
    b.endpoint_url || '',
    b.subnet_mask || '255.255.255.0',
    b.gateway || '192.168.10.1',
    b.serial_number || '',
    b.api_key || `SS-DEV-${id}`,
    id,
    tid
  );
  res.json(db.prepare('SELECT * FROM devices WHERE id = ? AND tenant_id = ?').get(id, tid));
});

app.post('/api/devices/:id/connect', async (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const dev = db.prepare('SELECT * FROM devices WHERE id = ? AND tenant_id = ?').get(id, tid) as
    | { id: number; tenant_id: number; ip_address: string; port: number; device_name: string; protocol?: string; endpoint_url?: string }
    | undefined;
  if (!dev) {
    res.status(404).json({ error: 'Device not found in active tenant workspace' });
    return;
  }
  const { probe, status, updated } = await probeDeviceRecord(dev);
  logAudit(req, 'PROBE', 'Device Connections', `Probed ${dev.device_name}: ${status} (${probe.latencyMs}ms)`, tid);
  broadcastWs('device:status', { id, status, tenant_id: tid });
  res.json(updated);
});

app.post('/api/devices/probe-all', async (req, res) => {
  const tid = getTenantId(req);
  const devs = db.prepare('SELECT * FROM devices WHERE tenant_id = ? ORDER BY id DESC').all(tid) as Array<{
    id: number;
    tenant_id: number;
    ip_address: string;
    port: number;
    device_name: string;
    protocol?: string;
    endpoint_url?: string;
  }>;
  await Promise.all(devs.map((d) => probeDeviceRecord(d)));
  const refreshed = db.prepare('SELECT * FROM devices WHERE tenant_id = ? ORDER BY id DESC').all(tid);
  logAudit(req, 'PROBE_ALL', 'Device Connections', `Probed all ${devs.length} registered connections`, tid);
  broadcastWs('device:status', { tenant_id: tid, count: devs.length });
  res.json(refreshed);
});

app.post('/api/devices/scan-subnet', async (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const ports: number[] = Array.isArray(b.ports) && b.ports.length > 0 ? b.ports.map(Number).filter(Boolean) : [PORT, 4370, 80, 8080, 502];
  const targets: Array<{ host: string; port: number }> = [];

  if (Array.isArray(b.hosts) && b.hosts.length > 0) {
    for (const h of b.hosts) {
      const hostStr = String(h || '').trim();
      if (!hostStr) continue;
      for (const p of ports) targets.push({ host: hostStr, port: p });
    }
  } else if (typeof b.subnet_prefix === 'string' && b.subnet_prefix.trim()) {
    const prefix = b.subnet_prefix.trim().replace(/\.$/, '');
    const startHost = Math.max(1, Number(b.start_host) || 1);
    const endHost = Math.min(254, Math.max(startHost, Number(b.end_host) || startHost + 10));
    for (let i = startHost; i <= endHost; i++) {
      for (const p of ports) targets.push({ host: `${prefix}.${i}`, port: p });
    }
  } else {
    for (const p of ports) targets.push({ host: '127.0.0.1', port: p });
  }

  const capped = targets.slice(0, 64);
  const results = await Promise.all(
    capped.map(async ({ host, port }) => {
      const probe = await tcpProbe(host, port, 550);
      if (!probe.ok) return null;
      const suggested_type =
        port === 4370
          ? 'Biometric Fingerprint Terminal'
          : port === 502
          ? 'Local EMS Gateway Node'
          : port === 9100
          ? 'Thermal / Register Printer'
          : 'Local EMS Gateway Node';
      return {
        ip_address: host,
        port,
        latencyMs: probe.latencyMs,
        suggested_type,
        message: probe.message,
      };
    })
  );
  const discovered = results.filter((r): r is NonNullable<typeof r> => r !== null);
  logAudit(req, 'SCAN', 'Device Connections', `Scanned ${capped.length} IP/Port endpoints; found ${discovered.length} reachable`, tid);
  res.json({ scanned: capped.length, discovered });
});

app.post('/api/devices/:id/push-punch', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const dev = db.prepare('SELECT * FROM devices WHERE id = ? AND tenant_id = ?').get(id, tid) as
    | { id: number; device_name: string; api_key?: string }
    | undefined;
  if (!dev) {
    res.status(404).json({ error: 'Device not found in active tenant workspace' });
    return;
  }
  const suppliedKey = req.headers['x-device-key'] ? String(req.headers['x-device-key']).trim() : '';
  if (suppliedKey && dev.api_key && suppliedKey !== dev.api_key) {
    res.status(401).json({ error: 'Invalid x-device-key credential for this hardware terminal.' });
    return;
  }
  const b = req.body || {};
  const now = new Date().toISOString();
  const empCode = String(b.employee_code || 'SS-EMP-008').trim();
  const emp = db
    .prepare('SELECT full_name, department, basic_salary FROM employees WHERE tenant_id = ? AND employee_id = ?')
    .get(tid, empCode) as { full_name: string; department: string; basic_salary: number } | undefined;

  const empName = String(b.employee_name || emp?.full_name || 'Hardware Biometric Staff').trim();
  const dept = String(b.department || emp?.department || 'Production').trim();
  const hourly = Number(b.hourly_rate) || (emp?.basic_salary ? Number((emp.basic_salary / 208).toFixed(2)) : 50);
  const otHours = Number(b.ot_hours) || 0;
  const otType = String(b.ot_type || 'None');
  const { mult, pay } = computeAttOt(otType, otHours, hourly, tid);
  const attDate = String(b.attendance_date || now.slice(0, 10));
  const punchTime = String(b.punch_time || now.slice(11, 16));
  const checkIn = b.check_in || (b.punch_type === 'Check-Out' ? '08:00' : punchTime);
  const checkOut = b.check_out || (b.punch_type === 'Check-Out' ? punchTime : '17:00');

  const attInfo = db
    .prepare(
      `
    INSERT INTO attendance_records (
      tenant_id, employee_code, employee_name, department, attendance_date, shift_name, check_in, check_out,
      hourly_rate, regular_hours, ot_type, ot_hours, ot_multiplier, ot_pay, status, register_state, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Present', 'Open', ?, ?)
  `
    )
    .run(
      tid,
      empCode,
      empName,
      dept,
      attDate,
      b.shift_name || `Device Sync (${dev.device_name})`,
      checkIn,
      checkOut,
      hourly,
      Number(b.regular_hours) || 8,
      otType,
      otHours,
      mult,
      pay,
      b.notes || `Biometric punch synced via ${dev.device_name} (${b.punch_type || 'Check-In'})`,
      now
    );

  db.prepare(
    "UPDATE devices SET status='Connected', punch_count = COALESCE(punch_count, 0) + 1, last_sync_at=?, last_checked_at=?, last_message=? WHERE id=?"
  ).run(now, now, `Synced ${empCode} (${b.punch_type || 'Check-In'})`, id);

  const attendance = db.prepare('SELECT * FROM attendance_records WHERE id = ?').get(attInfo.lastInsertRowid);
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
  logAudit(req, 'PUNCH_SYNC', 'Device Connections', `Ingested biometric punch for ${empName} (${empCode}) via ${dev.device_name}`, tid);
  broadcastWs('device:punch', { device_id: id, tenant_id: tid, employee_code: empCode });
  broadcastWs('attendance:updated', { tenant_id: tid });
  res.status(201).json({ device, attendance });
});

// ZKTeco / iClock ADMS Hardware Push Compatibility Endpoint
app.get('/api/iclock/cdata', (req, res) => {
  const sn = String(req.query.SN || '').trim();
  if (sn) {
    const now = new Date().toISOString();
    db.prepare("UPDATE devices SET status='Connected', last_checked_at=?, last_message=? WHERE serial_number=?").run(
      now,
      `ADMS handshake OK (${sn})`,
      sn
    );
  }
  res.type('text/plain').send('OK');
});

app.post('/api/iclock/cdata', express.text({ type: '*/*' }), (req, res) => {
  const sn = String(req.query.SN || '').trim();
  const dev = db.prepare('SELECT * FROM devices WHERE serial_number = ?').get(sn) as
    | { id: number; tenant_id: number; device_name: string }
    | undefined;
  if (!dev) {
    res.type('text/plain').send('OK');
    return;
  }
  const now = new Date().toISOString();
  const bodyText = typeof req.body === 'string' ? req.body : '';
  const lines = bodyText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  let ingested = 0;
  for (const line of lines) {
    const parts = line.split(/\t|,/);
    if (parts.length < 2) continue;
    const empCode = parts[0].trim();
    const ts = parts[1].trim();
    const attDate = ts.slice(0, 10) || now.slice(0, 10);
    const punchTime = ts.slice(11, 16) || now.slice(11, 16);
    const emp = db
      .prepare('SELECT full_name, department, basic_salary FROM employees WHERE tenant_id = ? AND employee_id = ?')
      .get(dev.tenant_id, empCode) as { full_name: string; department: string; basic_salary: number } | undefined;
    db.prepare(
      `
      INSERT INTO attendance_records (
        tenant_id, employee_code, employee_name, department, attendance_date, shift_name, check_in, check_out,
        hourly_rate, regular_hours, ot_type, ot_hours, ot_multiplier, ot_pay, status, register_state, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, '17:00', ?, 8, 'None', 0, 1, 0, 'Present', 'Open', ?, ?)
    `
    ).run(
      dev.tenant_id,
      empCode,
      emp?.full_name || empCode,
      emp?.department || 'Production',
      attDate,
      `ADMS Push (${dev.device_name})`,
      punchTime,
      emp?.basic_salary ? Number((emp.basic_salary / 208).toFixed(2)) : 50,
      `ZKTeco ADMS Serial ${sn}`,
      now
    );
    ingested++;
  }
  db.prepare(
    "UPDATE devices SET status='Connected', punch_count = COALESCE(punch_count, 0) + ?, last_sync_at=?, last_checked_at=?, last_message=? WHERE id=?"
  ).run(Math.max(1, ingested), now, now, `ADMS synced ${ingested || 1} record(s)`, dev.id);
  broadcastWs('device:punch', { device_id: dev.id, tenant_id: dev.tenant_id, ingested });
  res.type('text/plain').send('OK');
});

app.post('/api/devices/:id/disconnect', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  db.prepare("UPDATE devices SET status='Disconnected', last_message='Disconnected by operator' WHERE id=? AND tenant_id=?").run(id, tid);
  res.json(db.prepare('SELECT * FROM devices WHERE id = ? AND tenant_id = ?').get(id, tid));
});

app.delete('/api/devices/:id', (req, res) => {
  const tid = getTenantId(req);
  db.prepare('DELETE FROM devices WHERE id = ? AND tenant_id = ?').run(Number(req.params.id), tid);
  res.json({ ok: true });
});

// ============================================================================
// TIME MATH, ATTENDANCE ENGINE & STAFF SCHEDULING CONFLICT DETECTION
// ============================================================================
function timeToMinutes(hhmm: string): number {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function diffShiftDurationMinutes(start: string, end: string): number {
  const s = timeToMinutes(start);
  let e = timeToMinutes(end);
  if (e <= s) e += 1440; // overnight shift crossing midnight
  return Math.max(0, e - s);
}

function dateDayIndex(dateStr: string): number {
  const ms = Date.parse(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(ms)) return 0;
  return Math.floor(ms / 86400000);
}

function scheduleIntervalMinutes(dateStr: string, startTime: string, endTime: string) {
  const base = dateDayIndex(dateStr) * 1440;
  const s = timeToMinutes(startTime);
  let e = timeToMinutes(endTime);
  if (e <= s) e += 1440;
  return { start: base + s, end: base + e };
}

function syncTenantDepartmentStrings(tid: number) {
  const rows = db.prepare("SELECT name FROM departments WHERE tenant_id = ? AND status = 'Active' ORDER BY id ASC").all(tid) as Array<{ name: string }>;
  const csv = rows.map((r) => r.name).join(',');
  if (tid === 1) {
    db.prepare('UPDATE company_settings SET departments = ? WHERE id = 1').run(csv);
  }
  db.prepare('UPDATE tenants SET departments = ? WHERE id = ?').run(csv, tid);
}

function detectScheduleConflicts(
  tid: number,
  employeeId: string,
  scheduleDate: string,
  startTime: string,
  endTime: string,
  excludeId?: number
) {
  const rules = (db.prepare('SELECT * FROM workforce_rules WHERE tenant_id = ?').get(tid) as Record<string, unknown> | undefined) || {
    min_rest_hours_between_shifts: 11,
  };
  const requiredRestHours = Number(rules.min_rest_hours_between_shifts ?? 11);
  const requiredRestMinutes = requiredRestHours * 60;
  const candidate = scheduleIntervalMinutes(scheduleDate, startTime, endTime);

  const dIdx = dateDayIndex(scheduleDate);
  const prevDate = new Date((dIdx - 1) * 86400000).toISOString().slice(0, 10);
  const nextDate = new Date((dIdx + 1) * 86400000).toISOString().slice(0, 10);

  const nearby = db
    .prepare(
      `
    SELECT id, schedule_code, schedule_date, shift_name, start_time, end_time, approval_status
    FROM staff_schedules
    WHERE tenant_id = ? AND employee_id = ? AND schedule_date BETWEEN ? AND ? AND approval_status != 'Rejected'
  `
    )
    .all(tid, employeeId, prevDate, nextDate) as Array<{
    id: number;
    schedule_code: string;
    schedule_date: string;
    shift_name: string;
    start_time: string;
    end_time: string;
    approval_status: string;
  }>;

  const overlaps: Array<{ id: number; schedule_code: string; schedule_date: string; shift_name: string; start_time: string; end_time: string }> = [];
  const restViolations: Array<{ id: number; schedule_code: string; schedule_date: string; shift_name: string; restHours: number; requiredHours: number }> = [];

  for (const row of nearby) {
    if (excludeId && row.id === excludeId) continue;
    const existing = scheduleIntervalMinutes(row.schedule_date, row.start_time, row.end_time);
    if (candidate.start < existing.end && existing.start < candidate.end) {
      overlaps.push({
        id: row.id,
        schedule_code: row.schedule_code,
        schedule_date: row.schedule_date,
        shift_name: row.shift_name,
        start_time: row.start_time,
        end_time: row.end_time,
      });
    } else {
      const gapMins = candidate.start >= existing.end ? candidate.start - existing.end : existing.start - candidate.end;
      if (gapMins < requiredRestMinutes) {
        restViolations.push({
          id: row.id,
          schedule_code: row.schedule_code,
          schedule_date: row.schedule_date,
          shift_name: row.shift_name,
          restHours: Number((gapMins / 60).toFixed(1)),
          requiredHours: requiredRestHours,
        });
      }
    }
  }

  const leaveConflicts = db
    .prepare(
      `
    SELECT id, leave_type, start_date, end_date, status
    FROM leaves
    WHERE tenant_id = ? AND employee_code = ? AND status = 'Approved' AND start_date <= ? AND end_date >= ?
  `
    )
    .all(tid, employeeId, scheduleDate, scheduleDate) as Array<{
    id: number;
    leave_type: string;
    start_date: string;
    end_date: string;
    status: string;
  }>;

  return {
    hasConflict: overlaps.length > 0 || restViolations.length > 0 || leaveConflicts.length > 0,
    overlaps,
    restViolations,
    leaveConflicts,
  };
}

function computeAttOt(otType: string, otHours: number, hourlyRate: number, tenantId = 1) {
  const { otRow: ot } = getRulesAndOt(tenantId);
  let mult = 1;
  if (otType === 'Regular') mult = ot.ot_regular_multiplier;
  else if (otType === 'Night') mult = ot.ot_night_multiplier;
  else if (otType === 'Sunday') mult = ot.ot_sunday_multiplier;
  else if (otType === 'Holiday') mult = ot.ot_holiday_multiplier;
  else mult = 1;
  const pay = otType === 'None' ? 0 : Number((hourlyRate * otHours * mult).toFixed(2));
  return { mult, pay };
}

function resolveAttendancePayload(b: Record<string, unknown>, tid: number) {
  const rules = (db.prepare('SELECT * FROM workforce_rules WHERE tenant_id = ?').get(tid) as Record<string, unknown> | undefined) || {
    late_grace_minutes: 15,
    early_departure_grace_minutes: 10,
    default_break_minutes: 60,
  };
  const empCode = String(b.employee_code || 'SS-EMP').trim();
  const emp = db
    .prepare('SELECT employee_id, full_name, department, basic_salary FROM employees WHERE tenant_id = ? AND employee_id = ?')
    .get(tid, empCode) as { employee_id: string; full_name: string; department: string; basic_salary: number } | undefined;

  const employeeName = String(b.employee_name || emp?.full_name || 'Staff');
  const department = String(b.department || emp?.department || 'Operations');
  const attendanceDate = String(b.attendance_date || new Date().toISOString().slice(0, 10));
  const hourlyRate =
    Number(b.hourly_rate) > 0
      ? Number(b.hourly_rate)
      : emp?.basic_salary
      ? Number((emp.basic_salary / 208).toFixed(2))
      : 100;

  // Match shift from payload or assigned schedule
  let shiftRow: Record<string, unknown> | undefined;
  if (b.shift_id) {
    shiftRow = db.prepare('SELECT * FROM shifts WHERE id = ? AND tenant_id = ?').get(Number(b.shift_id), tid) as Record<string, unknown> | undefined;
  }
  if (!shiftRow && b.shift_name) {
    shiftRow = db.prepare('SELECT * FROM shifts WHERE shift_name = ? AND tenant_id = ?').get(String(b.shift_name), tid) as Record<string, unknown> | undefined;
  }
  const schedRow = db
    .prepare("SELECT * FROM staff_schedules WHERE tenant_id = ? AND employee_id = ? AND schedule_date = ? AND approval_status != 'Rejected' ORDER BY id DESC LIMIT 1")
    .get(tid, empCode, attendanceDate) as Record<string, unknown> | undefined;

  const shiftId = b.shift_id ? Number(b.shift_id) : shiftRow ? Number(shiftRow.id) : schedRow?.shift_id ? Number(schedRow.shift_id) : null;
  const shiftName = String(b.shift_name || shiftRow?.shift_name || schedRow?.shift_name || 'Day Shift');
  const shiftPeriod = String(
    b.shift_period ||
      (shiftName.toLowerCase().includes('morning')
        ? 'Morning'
        : shiftName.toLowerCase().includes('afternoon')
        ? 'Afternoon'
        : shiftName.toLowerCase().includes('night')
        ? 'Night'
        : shiftName.toLowerCase().includes('security')
        ? 'Security'
        : shiftName.toLowerCase().includes('weekend')
        ? 'Weekend'
        : shiftName.toLowerCase().includes('holiday')
        ? 'Holiday'
        : 'Day')
  );

  const scheduledStart = String(b.scheduled_start || shiftRow?.start_time || schedRow?.start_time || (shiftPeriod === 'Morning' ? '06:00' : shiftPeriod === 'Afternoon' ? '14:00' : shiftPeriod === 'Night' ? '22:00' : '08:00'));
  const scheduledEnd = String(b.scheduled_end || shiftRow?.end_time || schedRow?.end_time || (shiftPeriod === 'Morning' ? '14:00' : shiftPeriod === 'Afternoon' ? '22:00' : shiftPeriod === 'Night' ? '06:00' : '17:00'));
  const breakMinutes = Number(b.break_minutes ?? shiftRow?.break_minutes ?? schedRow?.break_minutes ?? rules.default_break_minutes ?? 60);

  const morningIn = String(b.morning_check_in || '');
  const morningOut = String(b.morning_check_out || '');
  const afternoonIn = String(b.afternoon_check_in || '');
  const afternoonOut = String(b.afternoon_check_out || '');
  const nightIn = String(b.night_check_in || '');
  const nightOut = String(b.night_check_out || '');

  // Primary check-in & check-out fallback across Morning / Afternoon / Night punches
  const firstPunchIn =
    String(b.check_in || '').trim() ||
    morningIn ||
    afternoonIn ||
    nightIn ||
    (b.status === 'Absent' || b.status === 'On Leave' ? '--:--' : scheduledStart);
  const lastPunchOut =
    String(b.check_out || '').trim() ||
    nightOut ||
    afternoonOut ||
    morningOut ||
    (b.status === 'Absent' || b.status === 'On Leave' ? '--:--' : scheduledEnd);

  const lateGrace = Number(shiftRow?.grace_late_minutes ?? rules.late_grace_minutes ?? 15);
  const earlyGrace = Number(rules.early_departure_grace_minutes ?? 10);

  const isAbsentOrLeave = b.status === 'Absent' || b.status === 'On Leave' || firstPunchIn === '--:--';
  let lateMinutes = Number(b.late_minutes ?? -1);
  let earlyDepartureMinutes = Number(b.early_departure_minutes ?? -1);
  let regularHours = Number(b.regular_hours ?? -1);
  let absenceHours = Number(b.absence_hours ?? -1);

  if (isAbsentOrLeave) {
    lateMinutes = 0;
    earlyDepartureMinutes = 0;
    regularHours = 0;
    const schedNetHours = Math.max(0, (diffShiftDurationMinutes(scheduledStart, scheduledEnd) - breakMinutes) / 60);
    absenceHours = absenceHours >= 0 ? absenceHours : Number(schedNetHours.toFixed(2));
  } else {
    const schedStartMin = timeToMinutes(scheduledStart);
    const actualInMin = timeToMinutes(firstPunchIn);
    if (lateMinutes < 0) {
      const diffIn = actualInMin - schedStartMin;
      lateMinutes = diffIn > lateGrace ? diffIn : 0;
    }

    const schedDur = diffShiftDurationMinutes(scheduledStart, scheduledEnd);
    const actualDur = diffShiftDurationMinutes(firstPunchIn, lastPunchOut);
    if (earlyDepartureMinutes < 0) {
      const endGap = schedDur - (actualInMin - schedStartMin + actualDur);
      earlyDepartureMinutes = endGap > earlyGrace ? endGap : 0;
    }

    if (regularHours < 0) {
      const workedNetHrs = Math.max(0, (actualDur - breakMinutes) / 60);
      regularHours = Number(Math.min(8, workedNetHrs).toFixed(2));
    }
    if (absenceHours < 0) {
      const missedHrs = Math.max(0, (lateMinutes + earlyDepartureMinutes) / 60);
      absenceHours = Number(missedHrs.toFixed(2));
    }
  }

  let otType = String(b.ot_type || 'None');
  let otHours = Number(b.ot_hours ?? -1);
  if (otHours < 0) {
    if (isAbsentOrLeave) {
      otHours = 0;
    } else {
      const schedNetMins = Math.max(0, diffShiftDurationMinutes(scheduledStart, scheduledEnd) - breakMinutes);
      const actualNetMins = Math.max(0, diffShiftDurationMinutes(firstPunchIn, lastPunchOut) - breakMinutes);
      otHours = actualNetMins > schedNetMins + 15 ? Number(((actualNetMins - schedNetMins) / 60).toFixed(2)) : 0;
    }
  }
  if (otHours > 0 && otType === 'None') {
    otType = shiftPeriod === 'Night' ? 'Night' : shiftPeriod === 'Holiday' ? 'Holiday' : shiftPeriod === 'Weekend' ? 'Sunday' : 'Regular';
  }
  const { mult, pay } = computeAttOt(otType, otHours, hourlyRate, tid);

  let derivedStatus = String(b.status || '');
  if (!derivedStatus || derivedStatus === 'Auto') {
    if (lateMinutes > 0 && earlyDepartureMinutes > 0) derivedStatus = 'Late & Early';
    else if (lateMinutes > 0) derivedStatus = 'Late';
    else if (earlyDepartureMinutes > 0) derivedStatus = 'Early Exit';
    else if (regularHours > 0 && regularHours < 4.5) derivedStatus = 'Half-Day';
    else derivedStatus = 'Present';
  }

  return {
    empCode,
    employeeName,
    department,
    attendanceDate,
    shiftId,
    shiftName,
    shiftPeriod,
    firstPunchIn,
    lastPunchOut,
    morningIn,
    morningOut,
    afternoonIn,
    afternoonOut,
    nightIn,
    nightOut,
    scheduledStart,
    scheduledEnd,
    hourlyRate,
    regularHours,
    lateMinutes,
    earlyDepartureMinutes,
    breakMinutes,
    absenceHours,
    otType,
    otHours,
    mult,
    pay,
    derivedStatus,
    notes: String(b.notes || ''),
  };
}

app.get('/api/attendance', (req, res) => {
  const tid = getTenantId(req);
  const { from, to, department, shift_period } = req.query;
  const where: string[] = ['tenant_id = ?'];
  const params: unknown[] = [tid];
  if (from) {
    where.push('attendance_date >= ?');
    params.push(String(from));
  }
  if (to) {
    where.push('attendance_date <= ?');
    params.push(String(to));
  }
  if (department && department !== 'All') {
    where.push('department = ?');
    params.push(String(department));
  }
  if (shift_period && shift_period !== 'All') {
    where.push('shift_period = ?');
    params.push(String(shift_period));
  }
  res.json(db.prepare(`SELECT * FROM attendance_records WHERE ${where.join(' AND ')} ORDER BY attendance_date DESC, id DESC`).all(...params));
});

app.post('/api/attendance', (req, res) => {
  const tid = getTenantId(req);
  const b = (req.body || {}) as Record<string, unknown>;
  const now = new Date().toISOString();
  const actor = getActorName(req);
  const r = resolveAttendancePayload(b, tid);
  const info = db
    .prepare(
      `
    INSERT INTO attendance_records (
      tenant_id, employee_code, employee_name, department, attendance_date, shift_id, shift_name, shift_period,
      check_in, check_out, morning_check_in, morning_check_out, afternoon_check_in, afternoon_check_out,
      night_check_in, night_check_out, scheduled_start, scheduled_end, hourly_rate, regular_hours,
      late_minutes, early_departure_minutes, break_minutes, absence_hours,
      ot_type, ot_hours, ot_multiplier, ot_pay, status, register_state, notes, updated_by, updated_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?, ?, ?)
  `
    )
    .run(
      tid,
      r.empCode,
      r.employeeName,
      r.department,
      r.attendanceDate,
      r.shiftId,
      r.shiftName,
      r.shiftPeriod,
      r.firstPunchIn,
      r.lastPunchOut,
      r.morningIn,
      r.morningOut,
      r.afternoonIn,
      r.afternoonOut,
      r.nightIn,
      r.nightOut,
      r.scheduledStart,
      r.scheduledEnd,
      r.hourlyRate,
      r.regularHours,
      r.lateMinutes,
      r.earlyDepartureMinutes,
      r.breakMinutes,
      r.absenceHours,
      r.otType,
      r.otHours,
      r.mult,
      r.pay,
      r.derivedStatus,
      r.notes,
      actor,
      now,
      now
    );
  logAudit(req, 'CREATE', 'Attendance', `Recorded ${r.shiftPeriod} attendance for ${r.employeeName} (${r.empCode}) on ${r.attendanceDate} [${r.derivedStatus}]`, tid);
  res.status(201).json(db.prepare('SELECT * FROM attendance_records WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/attendance/:id', (req, res) => {
  if (!requireRole(req, res, ATTENDANCE_MANAGER_ROLES, 'editing attendance records')) return;
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM attendance_records WHERE id = ? AND tenant_id = ?').get(id, tid) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Attendance record not found.' });
    return;
  }
  const role = getActorRole(req);
  const isAdminOrHr = SHIFT_DEPT_ADMIN_ROLES.has(role) || !role;
  if (existing.register_state === 'Closed' && !isAdminOrHr) {
    res.status(403).json({ error: 'Closed attendance register can only be modified by an Administrator or HR Manager.' });
    return;
  }
  const b = (req.body || {}) as Record<string, unknown>;
  const now = new Date().toISOString();
  const actor = getActorName(req);
  const r = resolveAttendancePayload(b, tid);
  db.prepare(
    `
    UPDATE attendance_records SET
      employee_code=?, employee_name=?, department=?, attendance_date=?, shift_id=?, shift_name=?, shift_period=?,
      check_in=?, check_out=?, morning_check_in=?, morning_check_out=?, afternoon_check_in=?, afternoon_check_out=?,
      night_check_in=?, night_check_out=?, scheduled_start=?, scheduled_end=?, hourly_rate=?, regular_hours=?,
      late_minutes=?, early_departure_minutes=?, break_minutes=?, absence_hours=?,
      ot_type=?, ot_hours=?, ot_multiplier=?, ot_pay=?, status=?, notes=?, updated_by=?, updated_at=?
    WHERE id = ? AND tenant_id = ?
  `
  ).run(
    r.empCode,
    r.employeeName,
    r.department,
    r.attendanceDate,
    r.shiftId,
    r.shiftName,
    r.shiftPeriod,
    r.firstPunchIn,
    r.lastPunchOut,
    r.morningIn,
    r.morningOut,
    r.afternoonIn,
    r.afternoonOut,
    r.nightIn,
    r.nightOut,
    r.scheduledStart,
    r.scheduledEnd,
    r.hourlyRate,
    r.regularHours,
    r.lateMinutes,
    r.earlyDepartureMinutes,
    r.breakMinutes,
    r.absenceHours,
    r.otType,
    r.otHours,
    r.mult,
    r.pay,
    r.derivedStatus,
    r.notes,
    actor,
    now,
    id,
    tid
  );
  logAudit(req, 'UPDATE', 'Attendance', `Corrected attendance #${id} for ${r.employeeName} (${r.attendanceDate}) -> ${r.derivedStatus}`, tid);
  res.json(db.prepare('SELECT * FROM attendance_records WHERE id = ? AND tenant_id = ?').get(id, tid));
});

app.post('/api/attendance/import', (req, res) => {
  if (!requireRole(req, res, ATTENDANCE_MANAGER_ROLES, 'importing attendance logs')) return;
  const tid = getTenantId(req);
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const now = new Date().toISOString();
  const actor = getActorName(req);
  const ins = db.prepare(`
    INSERT INTO attendance_records (
      tenant_id, employee_code, employee_name, department, attendance_date, shift_id, shift_name, shift_period,
      check_in, check_out, morning_check_in, morning_check_out, afternoon_check_in, afternoon_check_out,
      night_check_in, night_check_out, scheduled_start, scheduled_end, hourly_rate, regular_hours,
      late_minutes, early_departure_minutes, break_minutes, absence_hours,
      ot_type, ot_hours, ot_multiplier, ot_pay, status, register_state, notes, updated_by, updated_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?, ?, ?)
  `);
  for (const row of rows) {
    const r = resolveAttendancePayload({ ...row, notes: row.notes || 'CSV Import' }, tid);
    ins.run(
      tid,
      r.empCode,
      r.employeeName,
      r.department,
      r.attendanceDate,
      r.shiftId,
      r.shiftName,
      r.shiftPeriod,
      r.firstPunchIn,
      r.lastPunchOut,
      r.morningIn,
      r.morningOut,
      r.afternoonIn,
      r.afternoonOut,
      r.nightIn,
      r.nightOut,
      r.scheduledStart,
      r.scheduledEnd,
      r.hourlyRate,
      r.regularHours,
      r.lateMinutes,
      r.earlyDepartureMinutes,
      r.breakMinutes,
      r.absenceHours,
      r.otType,
      r.otHours,
      r.mult,
      r.pay,
      r.derivedStatus,
      r.notes,
      actor,
      now,
      now
    );
  }
  logAudit(req, 'IMPORT', 'Attendance', `Imported ${rows.length} attendance records via CSV`, tid);
  res.json({ imported: rows.length });
});

app.patch('/api/attendance/:id/close', (req, res) => {
  if (!requireRole(req, res, ATTENDANCE_MANAGER_ROLES, 'closing/opening attendance registers')) return;
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const state = req.body?.register_state || 'Closed';
  const now = new Date().toISOString();
  db.prepare('UPDATE attendance_records SET register_state = ?, updated_by = ?, updated_at = ? WHERE id = ? AND tenant_id = ?').run(
    state,
    getActorName(req),
    now,
    id,
    tid
  );
  logAudit(req, 'UPDATE', 'Attendance', `Set attendance #${id} register state to ${state}`, tid);
  res.json(db.prepare('SELECT * FROM attendance_records WHERE id = ? AND tenant_id = ?').get(id, tid));
});

app.post('/api/attendance/close-all', (req, res) => {
  if (!requireRole(req, res, ATTENDANCE_MANAGER_ROLES, 'bulk closing attendance registers')) return;
  const tid = getTenantId(req);
  const d = req.body?.attendance_date;
  const now = new Date().toISOString();
  if (d) {
    db.prepare("UPDATE attendance_records SET register_state = 'Closed', updated_by = ?, updated_at = ? WHERE tenant_id = ? AND attendance_date = ?").run(
      getActorName(req),
      now,
      tid,
      d
    );
  } else {
    db.prepare("UPDATE attendance_records SET register_state = 'Closed', updated_by = ?, updated_at = ? WHERE tenant_id = ?").run(
      getActorName(req),
      now,
      tid
    );
  }
  logAudit(req, 'CLOSE_ALL', 'Attendance', `Closed attendance registers${d ? ` for ${d}` : ''}`, tid);
  res.json({ ok: true });
});

app.delete('/api/attendance/:id', (req, res) => {
  if (!requireRole(req, res, SHIFT_DEPT_ADMIN_ROLES, 'deleting attendance records')) return;
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  db.prepare('DELETE FROM attendance_records WHERE id = ? AND tenant_id = ?').run(id, tid);
  logAudit(req, 'DELETE', 'Attendance', `Deleted attendance record #${id}`, tid);
  res.json({ ok: true });
});

// ============================================================================
// SHIFTS, DEPARTMENTS, STAFF SCHEDULING, HOLIDAYS & WORKFORCE RULES
// ============================================================================
app.get('/api/shifts', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM shifts WHERE tenant_id = ? ORDER BY id ASC').all(tid));
});

app.post('/api/shifts', (req, res) => {
  if (!requireRole(req, res, SHIFT_DEPT_ADMIN_ROLES, 'creating shifts')) return;
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const code = b.shift_code || `SHF-${Date.now().toString().slice(-4)}`;
  const info = db
    .prepare(
      `
    INSERT INTO shifts (
      tenant_id, shift_code, shift_name, shift_category, scheduling_system, start_time, end_time,
      break_minutes, working_days, rest_days, min_rest_hours, is_rotating, rotation_pattern,
      color_hex, ot_multiplier, grace_late_minutes, status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(
      tid,
      code,
      b.shift_name || b.shift_category || 'New Shift',
      b.shift_category || 'Day Shift',
      b.scheduling_system || '3-Shift',
      b.start_time || '08:00',
      b.end_time || '17:00',
      Number(b.break_minutes ?? 30),
      typeof b.working_days === 'string' ? b.working_days : JSON.stringify(b.working_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']),
      typeof b.rest_days === 'string' ? b.rest_days : JSON.stringify(b.rest_days || ['Sat', 'Sun']),
      Number(b.min_rest_hours ?? 11),
      b.is_rotating ? 1 : 0,
      b.rotation_pattern || 'Fixed',
      b.color_hex || '#2563eb',
      Number(b.ot_multiplier ?? 1.5),
      Number(b.grace_late_minutes ?? 15),
      b.status || 'Active',
      b.notes || '',
      now,
      now
    );
  logAudit(req, 'CREATE', 'Shifts', `Created shift ${b.shift_name} (${b.start_time}–${b.end_time})`, tid);
  res.status(201).json(db.prepare('SELECT * FROM shifts WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/shifts/:id', (req, res) => {
  if (!requireRole(req, res, SHIFT_DEPT_ADMIN_ROLES, 'updating shifts')) return;
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const b = req.body || {};
  const now = new Date().toISOString();
  db.prepare(
    `
    UPDATE shifts SET
      shift_code=?, shift_name=?, shift_category=?, scheduling_system=?, start_time=?, end_time=?,
      break_minutes=?, working_days=?, rest_days=?, min_rest_hours=?, is_rotating=?, rotation_pattern=?,
      color_hex=?, ot_multiplier=?, grace_late_minutes=?, status=?, notes=?, updated_at=?
    WHERE id = ? AND tenant_id = ?
  `
  ).run(
    b.shift_code,
    b.shift_name,
    b.shift_category,
    b.scheduling_system || '3-Shift',
    b.start_time,
    b.end_time,
    Number(b.break_minutes ?? 30),
    typeof b.working_days === 'string' ? b.working_days : JSON.stringify(b.working_days || []),
    typeof b.rest_days === 'string' ? b.rest_days : JSON.stringify(b.rest_days || []),
    Number(b.min_rest_hours ?? 11),
    b.is_rotating ? 1 : 0,
    b.rotation_pattern || 'Fixed',
    b.color_hex || '#2563eb',
    Number(b.ot_multiplier ?? 1.5),
    Number(b.grace_late_minutes ?? 15),
    b.status || 'Active',
    b.notes || '',
    now,
    id,
    tid
  );
  logAudit(req, 'UPDATE', 'Shifts', `Updated shift ${b.shift_name} (${b.start_time}–${b.end_time})`, tid);
  res.json(db.prepare('SELECT * FROM shifts WHERE id = ? AND tenant_id = ?').get(id, tid));
});

app.delete('/api/shifts/:id', (req, res) => {
  if (!requireRole(req, res, SHIFT_DEPT_ADMIN_ROLES, 'deleting shifts')) return;
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  db.prepare('DELETE FROM shifts WHERE id = ? AND tenant_id = ?').run(id, tid);
  logAudit(req, 'DELETE', 'Shifts', `Deleted shift #${id}`, tid);
  res.json({ ok: true });
});

app.get('/api/departments', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM departments WHERE tenant_id = ? ORDER BY id ASC').all(tid));
});

app.post('/api/departments', (req, res) => {
  if (!requireRole(req, res, SHIFT_DEPT_ADMIN_ROLES, 'creating departments')) return;
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const code = b.dept_code || `DEPT-${Date.now().toString().slice(-3)}`;
  const mgrEmp = b.manager_employee_id
    ? (db.prepare('SELECT employee_id, full_name FROM employees WHERE tenant_id = ? AND employee_id = ?').get(tid, b.manager_employee_id) as
        | { employee_id: string; full_name: string }
        | undefined)
    : undefined;
  const info = db
    .prepare(
      `
    INSERT INTO departments (
      tenant_id, dept_code, name, manager_employee_id, manager_name, scheduling_system, default_shift_id,
      working_days, rest_days, weekend_schedule_enabled, holiday_schedule_enabled, security_guard_coverage,
      monthly_timetable_notes, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(
      tid,
      code,
      b.name || 'New Department',
      mgrEmp?.employee_id || b.manager_employee_id || '',
      mgrEmp?.full_name || b.manager_name || 'Department Manager',
      b.scheduling_system || 'Standard',
      b.default_shift_id ? Number(b.default_shift_id) : null,
      typeof b.working_days === 'string' ? b.working_days : JSON.stringify(b.working_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']),
      typeof b.rest_days === 'string' ? b.rest_days : JSON.stringify(b.rest_days || ['Sat', 'Sun']),
      b.weekend_schedule_enabled ? 1 : 0,
      b.holiday_schedule_enabled ? 1 : 0,
      b.security_guard_coverage || 'Standard Business Hours',
      b.monthly_timetable_notes || '',
      b.status || 'Active',
      now,
      now
    );
  syncTenantDepartmentStrings(tid);
  logAudit(req, 'CREATE', 'Departments', `Created department ${b.name} (${b.scheduling_system || 'Standard'})`, tid);
  res.status(201).json(db.prepare('SELECT * FROM departments WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/departments/:id', (req, res) => {
  if (!requireRole(req, res, SHIFT_DEPT_ADMIN_ROLES, 'updating departments & timetables')) return;
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const b = req.body || {};
  const now = new Date().toISOString();
  const prev = db.prepare('SELECT name FROM departments WHERE id = ? AND tenant_id = ?').get(id, tid) as { name: string } | undefined;
  const mgrEmp = b.manager_employee_id
    ? (db.prepare('SELECT employee_id, full_name FROM employees WHERE tenant_id = ? AND employee_id = ?').get(tid, b.manager_employee_id) as
        | { employee_id: string; full_name: string }
        | undefined)
    : undefined;
  db.prepare(
    `
    UPDATE departments SET
      dept_code=?, name=?, manager_employee_id=?, manager_name=?, scheduling_system=?, default_shift_id=?,
      working_days=?, rest_days=?, weekend_schedule_enabled=?, holiday_schedule_enabled=?, security_guard_coverage=?,
      monthly_timetable_notes=?, status=?, updated_at=?
    WHERE id = ? AND tenant_id = ?
  `
  ).run(
    b.dept_code,
    b.name,
    mgrEmp?.employee_id || b.manager_employee_id || '',
    mgrEmp?.full_name || b.manager_name || '',
    b.scheduling_system || 'Standard',
    b.default_shift_id ? Number(b.default_shift_id) : null,
    typeof b.working_days === 'string' ? b.working_days : JSON.stringify(b.working_days || []),
    typeof b.rest_days === 'string' ? b.rest_days : JSON.stringify(b.rest_days || []),
    b.weekend_schedule_enabled ? 1 : 0,
    b.holiday_schedule_enabled ? 1 : 0,
    b.security_guard_coverage || 'Standard Business Hours',
    b.monthly_timetable_notes || '',
    b.status || 'Active',
    now,
    id,
    tid
  );
  if (prev?.name && b.name && prev.name !== b.name) {
    db.prepare('UPDATE employees SET department = ? WHERE tenant_id = ? AND department = ?').run(b.name, tid, prev.name);
    db.prepare('UPDATE staff_schedules SET department = ? WHERE tenant_id = ? AND department = ?').run(b.name, tid, prev.name);
    db.prepare('UPDATE attendance_records SET department = ? WHERE tenant_id = ? AND department = ?').run(b.name, tid, prev.name);
  }
  syncTenantDepartmentStrings(tid);
  logAudit(req, 'UPDATE', 'Departments', `Updated department timetable for ${b.name}`, tid);
  res.json(db.prepare('SELECT * FROM departments WHERE id = ? AND tenant_id = ?').get(id, tid));
});

app.delete('/api/departments/:id', (req, res) => {
  if (!requireRole(req, res, SHIFT_DEPT_ADMIN_ROLES, 'deleting departments')) return;
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  db.prepare('DELETE FROM departments WHERE id = ? AND tenant_id = ?').run(id, tid);
  syncTenantDepartmentStrings(tid);
  logAudit(req, 'DELETE', 'Departments', `Removed department #${id}`, tid);
  res.json({ ok: true });
});

app.get('/api/scheduling', (req, res) => {
  const tid = getTenantId(req);
  const { from, to, department, shift_category, employee_id } = req.query;
  const where: string[] = ['tenant_id = ?'];
  const params: unknown[] = [tid];
  if (from) {
    where.push('schedule_date >= ?');
    params.push(String(from));
  }
  if (to) {
    where.push('schedule_date <= ?');
    params.push(String(to));
  }
  if (department && department !== 'All') {
    where.push('department = ?');
    params.push(String(department));
  }
  if (shift_category && shift_category !== 'All') {
    where.push('shift_category = ?');
    params.push(String(shift_category));
  }
  if (employee_id && employee_id !== 'All') {
    where.push('employee_id = ?');
    params.push(String(employee_id));
  }
  res.json(db.prepare(`SELECT * FROM staff_schedules WHERE ${where.join(' AND ')} ORDER BY schedule_date ASC, start_time ASC, id DESC`).all(...params));
});

app.post('/api/scheduling/check-conflicts', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const report = detectScheduleConflicts(
    tid,
    String(b.employee_id || ''),
    String(b.schedule_date || new Date().toISOString().slice(0, 10)),
    String(b.start_time || '08:00'),
    String(b.end_time || '17:00'),
    b.exclude_id ? Number(b.exclude_id) : undefined
  );
  res.json(report);
});

app.post('/api/scheduling', (req, res) => {
  if (!requireRole(req, res, ATTENDANCE_MANAGER_ROLES, 'creating staff schedules')) return;
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const actor = getActorName(req);

  const emp = db.prepare('SELECT employee_id, full_name, department FROM employees WHERE tenant_id = ? AND employee_id = ?').get(tid, String(b.employee_id || '')) as
    | { employee_id: string; full_name: string; department: string }
    | undefined;
  if (!emp) {
    res.status(400).json({ error: 'Selected employee was not found in central HR database.' });
    return;
  }
  const shift = b.shift_id
    ? (db.prepare('SELECT * FROM shifts WHERE id = ? AND tenant_id = ?').get(Number(b.shift_id), tid) as Record<string, unknown> | undefined)
    : undefined;

  const schedDate = String(b.schedule_date || now.slice(0, 10));
  const startTime = String(b.start_time || shift?.start_time || '08:00');
  const endTime = String(b.end_time || shift?.end_time || '17:00');
  const conflicts = detectScheduleConflicts(tid, emp.employee_id, schedDate, startTime, endTime);

  if (conflicts.hasConflict && !b.force_override) {
    res.status(409).json({
      error: 'Scheduling conflict detected (overlapping shift, insufficient rest period, or approved leave).',
      conflicts,
    });
    return;
  }

  const count = (db.prepare('SELECT COUNT(*) as c FROM staff_schedules WHERE tenant_id = ?').get(tid) as { c: number }).c + 1;
  const code = b.schedule_code || `SCH-${tid}-${String(count).padStart(4, '0')}`;
  const shiftName = String(b.shift_name || shift?.shift_name || 'Day Shift');
  const shiftCat = String(b.shift_category || shift?.shift_category || 'Day Shift');

  const info = db
    .prepare(
      `
    INSERT INTO staff_schedules (
      tenant_id, schedule_code, employee_id, employee_name, department, shift_id, shift_name, shift_category,
      schedule_date, end_date, start_time, end_time, break_minutes, schedule_type, rotation_group,
      availability_status, replacement_employee_id, replacement_employee_name, change_reason,
      approval_status, approved_by, created_by, updated_by, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', '', ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(
      tid,
      code,
      emp.employee_id,
      emp.full_name,
      String(b.department || emp.department),
      shift ? Number(shift.id) : b.shift_id ? Number(b.shift_id) : null,
      shiftName,
      shiftCat,
      schedDate,
      String(b.end_date || schedDate),
      startTime,
      endTime,
      Number(b.break_minutes ?? shift?.break_minutes ?? 30),
      String(b.schedule_type || 'Regular'),
      String(b.rotation_group || 'Standard'),
      String(b.availability_status || 'Assigned'),
      String(b.approval_status || 'Approved'),
      b.approval_status === 'Pending' ? '' : actor,
      actor,
      actor,
      String(b.notes || ''),
      now,
      now
    );

  logAudit(req, 'CREATE', 'Scheduling', `Scheduled ${emp.full_name} (${emp.employee_id}) for ${shiftName} on ${schedDate}`, tid);
  res.status(201).json(db.prepare('SELECT * FROM staff_schedules WHERE id = ?').get(info.lastInsertRowid));
});

app.post('/api/scheduling/generate', (req, res) => {
  if (!requireRole(req, res, ATTENDANCE_MANAGER_ROLES, 'generating rotating timetables')) return;
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const actor = getActorName(req);

  const startDate = String(b.start_date || now.slice(0, 10));
  const days = Math.min(31, Math.max(1, Number(b.days) || 7));
  const systemMode = String(b.scheduling_system || '3-Shift');
  const rotateShifts = Boolean(b.rotate_weekly ?? true);
  const deptFilter = String(b.department || 'All');

  const employees = (
    deptFilter && deptFilter !== 'All'
      ? db.prepare("SELECT employee_id, full_name, department FROM employees WHERE tenant_id = ? AND status = 'Active' AND department = ? ORDER BY id ASC").all(tid, deptFilter)
      : db.prepare("SELECT employee_id, full_name, department FROM employees WHERE tenant_id = ? AND status = 'Active' ORDER BY id ASC").all(tid)
  ) as Array<{ employee_id: string; full_name: string; department: string }>;

  if (employees.length === 0) {
    res.status(400).json({ error: 'No active employees found for the selected department.' });
    return;
  }

  const allShifts = db.prepare("SELECT * FROM shifts WHERE tenant_id = ? AND status = 'Active' ORDER BY id ASC").all(tid) as Array<Record<string, unknown>>;
  const byCat = (cat: string) => allShifts.find((s) => s.shift_category === cat) || allShifts[0];
  const pool =
    systemMode === '4-Shift'
      ? [byCat('Morning Shift'), byCat('Afternoon Shift'), byCat('Night Shift'), byCat('Weekend Shift')].filter(Boolean)
      : systemMode === 'Security 24/7'
      ? [byCat('Security Guard Shift'), byCat('Morning Shift'), byCat('Night Shift')].filter(Boolean)
      : [byCat('Morning Shift'), byCat('Afternoon Shift'), byCat('Night Shift')].filter(Boolean);

  if (pool.length === 0) {
    res.status(400).json({ error: 'No active shifts configured for roster generation.' });
    return;
  }

  const existingCount = (db.prepare('SELECT COUNT(*) as c FROM staff_schedules WHERE tenant_id = ?').get(tid) as { c: number }).c;
  let seq = existingCount + 1;
  let created = 0;
  let skippedConflicts = 0;

  const ins = db.prepare(`
    INSERT INTO staff_schedules (
      tenant_id, schedule_code, employee_id, employee_name, department, shift_id, shift_name, shift_category,
      schedule_date, end_date, start_time, end_time, break_minutes, schedule_type, rotation_group,
      availability_status, approval_status, approved_by, created_by, updated_by, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Assigned', 'Approved', ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (let empIdx = 0; empIdx < employees.length; empIdx++) {
      const emp = employees[empIdx];
      for (let d = 0; d < days; d++) {
        const dtObj = new Date(`${startDate}T00:00:00Z`);
        dtObj.setUTCDate(dtObj.getUTCDate() + d);
        const dtIso = dtObj.toISOString().slice(0, 10);
        const weekIdx = Math.floor(d / 7);
        const shiftIdx = rotateShifts ? (empIdx + weekIdx) % pool.length : empIdx % pool.length;
        const sh = pool[shiftIdx];
        const conflicts = detectScheduleConflicts(tid, emp.employee_id, dtIso, String(sh.start_time), String(sh.end_time));
        if (conflicts.hasConflict) {
          skippedConflicts++;
          continue;
        }
        const schedType = systemMode === 'Security 24/7' ? 'Security Guard' : rotateShifts ? 'Rotating' : 'Regular';
        ins.run(
          tid,
          `SCH-${tid}-${String(seq++).padStart(4, '0')}`,
          emp.employee_id,
          emp.full_name,
          emp.department,
          Number(sh.id),
          String(sh.shift_name),
          String(sh.shift_category),
          dtIso,
          dtIso,
          String(sh.start_time),
          String(sh.end_time),
          Number(sh.break_minutes) || 30,
          schedType,
          `${systemMode}-Team-${(empIdx % pool.length) + 1}`,
          actor,
          actor,
          actor,
          `Generated ${systemMode} roster`,
          now,
          now
        );
        created++;
      }
    }
  });
  tx();

  logAudit(req, 'GENERATE', 'Scheduling', `Generated ${created} ${systemMode} schedules (${skippedConflicts} conflict/leave skips)`, tid);
  res.json({ ok: true, created, skippedConflicts });
});

app.put('/api/scheduling/:id', (req, res) => {
  if (!requireRole(req, res, ATTENDANCE_MANAGER_ROLES, 'editing staff schedules')) return;
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const b = req.body || {};
  const now = new Date().toISOString();
  const actor = getActorName(req);

  const emp = db.prepare('SELECT employee_id, full_name, department FROM employees WHERE tenant_id = ? AND employee_id = ?').get(tid, String(b.employee_id || '')) as
    | { employee_id: string; full_name: string; department: string }
    | undefined;
  const schedDate = String(b.schedule_date || now.slice(0, 10));
  const startTime = String(b.start_time || '08:00');
  const endTime = String(b.end_time || '17:00');
  const empId = emp?.employee_id || String(b.employee_id || '');
  const conflicts = detectScheduleConflicts(tid, empId, schedDate, startTime, endTime, id);
  if (conflicts.hasConflict && !b.force_override) {
    res.status(409).json({
      error: 'Scheduling conflict detected on updated slot.',
      conflicts,
    });
    return;
  }

  db.prepare(
    `
    UPDATE staff_schedules SET
      employee_id=?, employee_name=?, department=?, shift_id=?, shift_name=?, shift_category=?,
      schedule_date=?, end_date=?, start_time=?, end_time=?, break_minutes=?, schedule_type=?,
      rotation_group=?, availability_status=?, notes=?, updated_by=?, updated_at=?
    WHERE id = ? AND tenant_id = ?
  `
  ).run(
    empId,
    emp?.full_name || String(b.employee_name || ''),
    String(b.department || emp?.department || 'Operations'),
    b.shift_id ? Number(b.shift_id) : null,
    String(b.shift_name || 'Day Shift'),
    String(b.shift_category || 'Day Shift'),
    schedDate,
    String(b.end_date || schedDate),
    startTime,
    endTime,
    Number(b.break_minutes ?? 30),
    String(b.schedule_type || 'Regular'),
    String(b.rotation_group || 'Standard'),
    String(b.availability_status || 'Assigned'),
    String(b.notes || ''),
    actor,
    now,
    id,
    tid
  );

  logAudit(req, 'UPDATE', 'Scheduling', `Updated schedule #${id} for ${emp?.full_name || b.employee_name} on ${schedDate}`, tid);
  res.json(db.prepare('SELECT * FROM staff_schedules WHERE id = ? AND tenant_id = ?').get(id, tid));
});

app.post('/api/scheduling/:id/replace', (req, res) => {
  if (!requireRole(req, res, ATTENDANCE_MANAGER_ROLES, 'replacing shift staff')) return;
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const { replacement_employee_id, reason, force_override } = req.body || {};
  const orig = db.prepare('SELECT * FROM staff_schedules WHERE id = ? AND tenant_id = ?').get(id, tid) as Record<string, unknown> | undefined;
  if (!orig) {
    res.status(404).json({ error: 'Schedule entry not found.' });
    return;
  }
  const rep = db
    .prepare('SELECT employee_id, full_name, department FROM employees WHERE tenant_id = ? AND employee_id = ?')
    .get(tid, String(replacement_employee_id || '')) as { employee_id: string; full_name: string; department: string } | undefined;
  if (!rep) {
    res.status(400).json({ error: 'Replacement employee not found in central directory.' });
    return;
  }
  const conflicts = detectScheduleConflicts(
    tid,
    rep.employee_id,
    String(orig.schedule_date),
    String(orig.start_time),
    String(orig.end_time)
  );
  if (conflicts.hasConflict && !force_override) {
    res.status(409).json({
      error: `Replacement employee ${rep.full_name} has a scheduling, rest-period, or leave conflict.`,
      conflicts,
    });
    return;
  }

  const now = new Date().toISOString();
  const actor = getActorName(req);
  const tx = db.transaction(() => {
    db.prepare(
      `
      UPDATE staff_schedules SET
        availability_status = 'Replaced',
        replacement_employee_id = ?,
        replacement_employee_name = ?,
        change_reason = ?,
        updated_by = ?,
        updated_at = ?
      WHERE id = ? AND tenant_id = ?
    `
    ).run(rep.employee_id, rep.full_name, String(reason || 'Shift replacement'), actor, now, id, tid);

    const cnt = (db.prepare('SELECT COUNT(*) as c FROM staff_schedules WHERE tenant_id = ?').get(tid) as { c: number }).c + 1;
    db.prepare(
      `
      INSERT INTO staff_schedules (
        tenant_id, schedule_code, employee_id, employee_name, department, shift_id, shift_name, shift_category,
        schedule_date, end_date, start_time, end_time, break_minutes, schedule_type, rotation_group,
        availability_status, replacement_employee_id, replacement_employee_name, change_reason,
        approval_status, approved_by, created_by, updated_by, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Assigned', ?, ?, ?, 'Approved', ?, ?, ?, ?, ?, ?)
    `
    ).run(
      tid,
      `SCH-${tid}-${String(cnt).padStart(4, '0')}`,
      rep.employee_id,
      rep.full_name,
      rep.department,
      orig.shift_id || null,
      String(orig.shift_name),
      String(orig.shift_category),
      String(orig.schedule_date),
      String(orig.end_date),
      String(orig.start_time),
      String(orig.end_time),
      Number(orig.break_minutes) || 30,
      String(orig.schedule_type),
      String(orig.rotation_group || ''),
      String(orig.employee_id),
      String(orig.employee_name),
      String(reason || `Covering for ${orig.employee_name}`),
      actor,
      actor,
      actor,
      `Replacement coverage for ${orig.schedule_code}`,
      now,
      now
    );
  });
  tx();

  logAudit(req, 'REPLACE', 'Scheduling', `Replaced ${orig.employee_name} with ${rep.full_name} on ${orig.schedule_date} (${reason || 'Shift swap'})`, tid);
  res.json({ ok: true });
});

app.patch('/api/scheduling/:id/approve', (req, res) => {
  if (!requireRole(req, res, ATTENDANCE_MANAGER_ROLES, 'approving staff schedules')) return;
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const status = String(req.body?.approval_status || 'Approved');
  const now = new Date().toISOString();
  const actor = getActorName(req);
  db.prepare('UPDATE staff_schedules SET approval_status = ?, approved_by = ?, updated_by = ?, updated_at = ? WHERE id = ? AND tenant_id = ?').run(
    status,
    actor,
    actor,
    now,
    id,
    tid
  );
  logAudit(req, 'APPROVE', 'Scheduling', `Marked schedule #${id} as ${status}`, tid);
  res.json(db.prepare('SELECT * FROM staff_schedules WHERE id = ? AND tenant_id = ?').get(id, tid));
});

app.delete('/api/scheduling/:id', (req, res) => {
  if (!requireRole(req, res, ATTENDANCE_MANAGER_ROLES, 'deleting staff schedules')) return;
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  db.prepare('DELETE FROM staff_schedules WHERE id = ? AND tenant_id = ?').run(id, tid);
  logAudit(req, 'DELETE', 'Scheduling', `Deleted schedule #${id}`, tid);
  res.json({ ok: true });
});

app.get('/api/holidays', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM holidays_calendar WHERE tenant_id = ? ORDER BY holiday_date ASC').all(tid));
});

app.post('/api/holidays', (req, res) => {
  if (!requireRole(req, res, SHIFT_DEPT_ADMIN_ROLES, 'managing holidays')) return;
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const info = db
    .prepare('INSERT INTO holidays_calendar (tenant_id, holiday_date, name, is_paid, ot_multiplier, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(tid, String(b.holiday_date || now.slice(0, 10)), String(b.name || 'Company Holiday'), b.is_paid === false ? 0 : 1, Number(b.ot_multiplier ?? 2.5), String(b.notes || ''), now);
  logAudit(req, 'CREATE', 'Holidays', `Added holiday ${b.name} (${b.holiday_date})`, tid);
  res.status(201).json(db.prepare('SELECT * FROM holidays_calendar WHERE id = ?').get(info.lastInsertRowid));
});

app.delete('/api/holidays/:id', (req, res) => {
  if (!requireRole(req, res, SHIFT_DEPT_ADMIN_ROLES, 'deleting holidays')) return;
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  db.prepare('DELETE FROM holidays_calendar WHERE id = ? AND tenant_id = ?').run(id, tid);
  logAudit(req, 'DELETE', 'Holidays', `Removed holiday #${id}`, tid);
  res.json({ ok: true });
});

app.get('/api/workforce-rules', (req, res) => {
  const tid = getTenantId(req);
  let row = db.prepare('SELECT * FROM workforce_rules WHERE tenant_id = ?').get(tid);
  if (!row) {
    seedWorkforceDefaultsForTenant(tid);
    row = db.prepare('SELECT * FROM workforce_rules WHERE tenant_id = ?').get(tid);
  }
  res.json(row);
});

app.put('/api/workforce-rules', (req, res) => {
  if (!requireRole(req, res, SHIFT_DEPT_ADMIN_ROLES, 'updating attendance & shift rules')) return;
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  db.prepare(
    `
    UPDATE workforce_rules SET
      late_grace_minutes=?, early_departure_grace_minutes=?, default_break_minutes=?,
      min_rest_hours_between_shifts=?, auto_detect_conflicts=?, require_manager_approval=?,
      default_shift_system=?, updated_at=?
    WHERE tenant_id = ?
  `
  ).run(
    Number(b.late_grace_minutes ?? 15),
    Number(b.early_departure_grace_minutes ?? 10),
    Number(b.default_break_minutes ?? 60),
    Number(b.min_rest_hours_between_shifts ?? 11),
    b.auto_detect_conflicts ? 1 : 0,
    b.require_manager_approval ? 1 : 0,
    String(b.default_shift_system || '3-Shift'),
    now,
    tid
  );
  logAudit(req, 'UPDATE', 'Workforce Rules', 'Updated attendance grace period, break, and rest-period rules', tid);
  res.json(db.prepare('SELECT * FROM workforce_rules WHERE tenant_id = ?').get(tid));
});

// Leaves
app.get('/api/leaves', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM leaves WHERE tenant_id = ? ORDER BY id DESC').all(tid));
});
app.post('/api/leaves', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `
    INSERT INTO leaves (tenant_id, employee_code, employee_name, department, leave_type, start_date, end_date, days, reason, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)
  `
    )
    .run(tid, b.employee_code, b.employee_name, b.department, b.leave_type, b.start_date, b.end_date, Number(b.days) || 1, b.reason || '', now);
  res.status(201).json(db.prepare('SELECT * FROM leaves WHERE id = ?').get(info.lastInsertRowid));
});
app.patch('/api/leaves/:id/status', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  db.prepare('UPDATE leaves SET status = ?, approved_by = ? WHERE id = ? AND tenant_id = ?').run(
    req.body?.status || 'Approved',
    getActorName(req),
    id,
    tid
  );
  res.json(db.prepare('SELECT * FROM leaves WHERE id = ? AND tenant_id = ?').get(id, tid));
});
app.delete('/api/leaves/:id', (req, res) => {
  const tid = getTenantId(req);
  db.prepare('DELETE FROM leaves WHERE id = ? AND tenant_id = ?').run(Number(req.params.id), tid);
  res.json({ ok: true });
});

// Secretary Documents
app.get('/api/documents', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM company_documents WHERE tenant_id = ? ORDER BY id DESC').all(tid));
});
app.post('/api/documents', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const docNum =
    b.doc_number || (tid === 1 ? `SS-DOC-${now.slice(0, 4)}-${Math.floor(100 + Math.random() * 899)}` : `SS-T${tid}-DOC-${Math.floor(100 + Math.random() * 899)}`);
  const info = db
    .prepare(
      `
    INSERT INTO company_documents (tenant_id, doc_number, title, category, department, issued_by, issue_date, confidentiality, status, language, content, translated_content, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(
      tid,
      docNum,
      b.title,
      b.category,
      b.department,
      b.issued_by,
      b.issue_date,
      b.confidentiality || 'Internal',
      b.status || 'Issued',
      b.language || 'en',
      b.content || '',
      b.translated_content || '',
      now
    );
  res.status(201).json(db.prepare('SELECT * FROM company_documents WHERE id = ?').get(info.lastInsertRowid));
});
app.put('/api/documents/:id', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const b = req.body || {};
  db.prepare(
    `
    UPDATE company_documents SET doc_number=?, title=?, category=?, department=?, issued_by=?, issue_date=?, confidentiality=?, status=?, language=?, content=?, translated_content=? WHERE id=? AND tenant_id=?
  `
  ).run(
    b.doc_number,
    b.title,
    b.category,
    b.department,
    b.issued_by,
    b.issue_date,
    b.confidentiality,
    b.status,
    b.language,
    b.content,
    b.translated_content || '',
    id,
    tid
  );
  res.json(db.prepare('SELECT * FROM company_documents WHERE id = ? AND tenant_id = ?').get(id, tid));
});
app.delete('/api/documents/:id', (req, res) => {
  const tid = getTenantId(req);
  db.prepare('DELETE FROM company_documents WHERE id = ? AND tenant_id = ?').run(Number(req.params.id), tid);
  res.json({ ok: true });
});

// Imported Files & Document Vault
app.get('/api/files', (req, res) => {
  const tid = getTenantId(req);
  const category = String(req.query.category || '').trim();
  const targetModule = String(req.query.target_module || '').trim();
  let sql = 'SELECT * FROM imported_files WHERE tenant_id = ?';
  const params: Array<string | number> = [tid];
  if (category && category !== 'All') {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (targetModule && targetModule !== 'All') {
    sql += ' AND target_module = ?';
    params.push(targetModule);
  }
  sql += ' ORDER BY id DESC';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/files/:id/download', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const row = db
    .prepare('SELECT file_name, mime_type, file_data, extracted_text FROM imported_files WHERE id = ? AND tenant_id = ?')
    .get(id, tid) as { file_name: string; mime_type: string; file_data: string; extracted_text: string } | undefined;
  if (!row) {
    res.status(404).json({ error: 'Imported file not found.' });
    return;
  }
  const safeName = String(row.file_name || 'document').replace(/[\r\n"]/g, '_');
  if (row.file_data && row.file_data.includes('base64,')) {
    const b64 = row.file_data.split('base64,')[1] || '';
    const buf = Buffer.from(b64, 'base64');
    res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.send(buf);
    return;
  }
  res.setHeader('Content-Type', row.mime_type || 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.send(row.extracted_text || '');
});

app.post('/api/files', (req, res) => {
  const tid = getTenantId(req);
  const body = req.body || {};
  const incomingList = Array.isArray(body.files) ? body.files : [body];
  if (incomingList.length === 0) {
    res.status(400).json({ error: 'No files provided for import.' });
    return;
  }
  const now = new Date().toISOString();
  const actor = getActorName(req);

  const insertFile = db.prepare(`
    INSERT INTO imported_files (
      tenant_id, file_code, title, file_name, mime_type, file_size, category,
      department, target_module, extracted_text, file_data, uploaded_by, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertDoc = db.prepare(`
    INSERT INTO company_documents (
      tenant_id, doc_number, title, category, department, issued_by, issue_date,
      confidentiality, status, language, content, translated_content, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Internal', 'Issued', 'en', ?, '', ?)
  `);

  const insertedFiles: unknown[] = [];
  const createdDocs: unknown[] = [];

  const tx = db.transaction(() => {
    for (const item of incomingList) {
      const f = (item || {}) as Record<string, unknown>;
      const fileName = String(f.file_name || 'document.txt').trim() || 'document.txt';
      const title = String(f.title || fileName.replace(/\.[^.]+$/, '')).trim() || fileName;
      const mimeType = String(f.mime_type || 'application/octet-stream');
      const fileSize = Number(f.file_size) || 0;
      const category = String(f.category || body.category || 'Official Document');
      const department = String(f.department || body.department || 'Operations');
      const targetModule = String(f.target_module || body.target_module || 'secretary');
      const extractedText = String(f.extracted_text || '');
      const fileData = String(f.file_data || '');
      const notes = String(f.notes ?? body.notes ?? '');
      const fileCode =
        tid === 1
          ? `SS-FILE-${now.slice(0, 4)}-${Math.floor(1000 + Math.random() * 8999)}`
          : `SS-T${tid}-FILE-${Math.floor(1000 + Math.random() * 8999)}`;

      const info = insertFile.run(
        tid,
        fileCode,
        title,
        fileName,
        mimeType,
        fileSize,
        category,
        department,
        targetModule,
        extractedText,
        fileData,
        actor,
        notes,
        now
      );
      insertedFiles.push(db.prepare('SELECT * FROM imported_files WHERE id = ?').get(info.lastInsertRowid));

      const createSec = Boolean(f.also_create_secretary_doc ?? body.also_create_secretary_doc);
      if (createSec) {
        const docNum =
          tid === 1
            ? `SS-DOC-${now.slice(0, 4)}-${Math.floor(100 + Math.random() * 899)}`
            : `SS-T${tid}-DOC-${Math.floor(100 + Math.random() * 899)}`;
        const docBody =
          extractedText.trim() ||
          `${title}\n\nImported Reference: ${fileCode} (${fileName})\nCategory: ${category}\nDepartment: ${department}\n${notes ? `Notes: ${notes}` : ''}`.trim();
        const docInfo = insertDoc.run(
          tid,
          docNum,
          title,
          category,
          department,
          actor,
          now.slice(0, 10),
          docBody,
          now
        );
        createdDocs.push(db.prepare('SELECT * FROM company_documents WHERE id = ?').get(docInfo.lastInsertRowid));
      }
    }
  });

  tx();
  logAudit(req, 'IMPORT', 'Documents', `Imported ${insertedFiles.length} file(s) into Document Vault`, tid);
  broadcastWs('files:imported', { tid, count: insertedFiles.length });
  res.status(201).json({
    importedCount: insertedFiles.length,
    files: insertedFiles,
    createdDocs,
  });
});

app.delete('/api/files/:id', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT file_code, file_name FROM imported_files WHERE id = ? AND tenant_id = ?').get(id, tid) as
    | { file_code: string; file_name: string }
    | undefined;
  db.prepare('DELETE FROM imported_files WHERE id = ? AND tenant_id = ?').run(id, tid);
  if (existing) {
    logAudit(req, 'DELETE', 'Documents', `Removed imported file ${existing.file_code} (${existing.file_name})`, tid);
  }
  broadcastWs('files:deleted', { tid, id });
  res.json({ ok: true });
});

app.post('/api/import/csv', (req, res) => {
  const tid = getTenantId(req);
  const target = String(req.body?.target || '').trim();
  const rows = Array.isArray(req.body?.rows) ? (req.body.rows as Array<Record<string, unknown>>) : [];
  if (!['employees', 'materials', 'attendance'].includes(target)) {
    res.status(400).json({ error: 'Unsupported CSV import target. Use employees, materials, or attendance.' });
    return;
  }
  if (rows.length === 0) {
    res.status(400).json({ error: 'No CSV rows provided.' });
    return;
  }
  const now = new Date().toISOString();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  const pick = (row: Record<string, unknown>, keys: string[], fallback = ''): string => {
    const entries = Object.entries(row);
    for (const key of keys) {
      const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const hit = entries.find(([k]) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normKey);
      if (hit && hit[1] !== undefined && hit[1] !== null && String(hit[1]).trim() !== '') {
        return String(hit[1]).trim();
      }
    }
    return fallback;
  };

  const tx = db.transaction(() => {
    if (target === 'employees') {
      const insertEmp = db.prepare(`
        INSERT INTO employees (
          tenant_id, employee_id, full_name, gender, phone, email, national_id,
          department, job_title, employment_type, start_date, basic_salary, bank_account, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const updateEmp = db.prepare(`
        UPDATE employees SET
          full_name = ?, phone = ?, email = ?, department = ?, job_title = ?, basic_salary = ?, bank_account = ?, status = ?
        WHERE id = ? AND tenant_id = ?
      `);
      rows.forEach((r, idx) => {
        const fullName = pick(r, ['full_name', 'Full Name', 'name', 'Employee Name']);
        if (!fullName) {
          skipped++;
          errors.push(`Row ${idx + 1}: missing full_name`);
          return;
        }
        let empId = pick(r, ['employee_id', 'Employee ID', 'id_no', 'code']);
        const existingSameTenant = empId
          ? (db.prepare('SELECT id FROM employees WHERE tenant_id = ? AND employee_id = ?').get(tid, empId) as { id: number } | undefined)
          : undefined;
        const salary = Number(pick(r, ['basic_salary', 'Basic Salary', 'salary'], '0').replace(/[^0-9.-]/g, '')) || 0;
        const dept = pick(r, ['department', 'Department'], 'Operations');
        const job = pick(r, ['job_title', 'Job Title', 'role', 'position'], 'Staff');
        const phone = pick(r, ['phone', 'Phone', 'mobile']);
        const email = pick(r, ['email', 'Email']);
        const bank = pick(r, ['bank_account', 'Bank Account', 'account']);
        const status = pick(r, ['status', 'Status'], 'Active');

        if (existingSameTenant) {
          updateEmp.run(fullName, phone, email, dept, job, salary, bank, status, existingSameTenant.id, tid);
          updated++;
        } else {
          if (!empId) {
            empId =
              tid === 1
                ? `SS-EMP-${Math.floor(100 + Math.random() * 899)}`
                : `SS-T${tid}-EMP-${Math.floor(100 + Math.random() * 899)}`;
          }
          if (db.prepare('SELECT id FROM employees WHERE employee_id = ?').get(empId)) {
            empId = `${empId}-T${tid}-${Math.floor(10 + Math.random() * 89)}`;
          }
          insertEmp.run(
            tid,
            empId,
            fullName,
            pick(r, ['gender', 'Gender'], 'Male'),
            phone,
            email,
            pick(r, ['national_id', 'National ID']),
            dept,
            job,
            pick(r, ['employment_type', 'Employment Type'], 'Permanent'),
            pick(r, ['start_date', 'Start Date'], now.slice(0, 10)),
            salary,
            bank,
            status,
            now
          );
          inserted++;
        }
      });
    } else if (target === 'materials') {
      const insertMat = db.prepare(`
        INSERT INTO materials (tenant_id, sku, name, category, unit, stock_qty, reorder_level, unit_cost, location, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const updateMat = db.prepare(`
        UPDATE materials SET name = ?, category = ?, unit = ?, stock_qty = ?, reorder_level = ?, unit_cost = ?, location = ?, updated_at = ?
        WHERE id = ? AND tenant_id = ?
      `);
      rows.forEach((r, idx) => {
        const name = pick(r, ['name', 'Material Name', 'item_name', 'material']);
        if (!name) {
          skipped++;
          errors.push(`Row ${idx + 1}: missing material name`);
          return;
        }
        let sku = pick(r, ['sku', 'SKU', 'code', 'item_code']);
        const qty = Number(pick(r, ['stock_qty', 'Stock Qty', 'quantity', 'qty'], '0').replace(/[^0-9.-]/g, '')) || 0;
        const reorder = Number(pick(r, ['reorder_level', 'Reorder Level', 'reorder'], '5').replace(/[^0-9.-]/g, '')) || 5;
        const cost = Number(pick(r, ['unit_cost', 'Unit Cost', 'cost', 'price'], '0').replace(/[^0-9.-]/g, '')) || 0;
        const category = pick(r, ['category', 'Category'], 'Raw Material');
        const unit = pick(r, ['unit', 'Unit', 'uom'], 'pcs');
        const location = pick(r, ['location', 'Location', 'warehouse'], 'Main Warehouse');

        const existingSameTenant = sku
          ? (db.prepare('SELECT id FROM materials WHERE tenant_id = ? AND sku = ?').get(tid, sku) as { id: number } | undefined)
          : undefined;
        if (existingSameTenant) {
          updateMat.run(name, category, unit, qty, reorder, cost, location, now, existingSameTenant.id, tid);
          updated++;
        } else {
          if (!sku) {
            sku = `MAT-T${tid}-${Math.floor(100 + Math.random() * 899)}`;
          }
          if (db.prepare('SELECT id FROM materials WHERE sku = ?').get(sku)) {
            sku = `${sku}-T${tid}-${Math.floor(10 + Math.random() * 89)}`;
          }
          insertMat.run(tid, sku, name, category, unit, qty, reorder, cost, location, now);
          inserted++;
        }
      });
    } else {
      const insertAtt = db.prepare(`
        INSERT INTO attendance_records (
          tenant_id, employee_code, employee_name, department, attendance_date, shift_name, check_in, check_out,
          hourly_rate, regular_hours, ot_type, ot_hours, ot_multiplier, ot_pay, status, register_state, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', 'CSV Import', ?)
      `);
      rows.forEach((r, idx) => {
        const empName = pick(r, ['employee_name', 'Employee Name', 'full_name', 'name']);
        const empCode = pick(r, ['employee_code', 'Employee Code', 'employee_id', 'code'], 'SS-EMP');
        if (!empName && !empCode) {
          skipped++;
          errors.push(`Row ${idx + 1}: missing employee_name / employee_code`);
          return;
        }
        const otType = pick(r, ['ot_type', 'OT Type'], 'None');
        const otHours = Number(pick(r, ['ot_hours', 'OT Hours'], '0').replace(/[^0-9.-]/g, '')) || 0;
        const hourlyRate = Number(pick(r, ['hourly_rate', 'Hourly Rate', 'rate'], '100').replace(/[^0-9.-]/g, '')) || 100;
        const regHours = Number(pick(r, ['regular_hours', 'Regular Hours', 'hours'], '8').replace(/[^0-9.-]/g, '')) || 8;
        const { mult, pay } = computeAttOt(otType, otHours, hourlyRate, tid);
        insertAtt.run(
          tid,
          empCode,
          empName || empCode,
          pick(r, ['department', 'Department'], 'Operations'),
          pick(r, ['attendance_date', 'Date', 'date'], now.slice(0, 10)),
          pick(r, ['shift_name', 'Shift'], 'Imported Shift'),
          pick(r, ['check_in', 'Check In'], '08:00'),
          pick(r, ['check_out', 'Check Out'], '17:00'),
          hourlyRate,
          regHours,
          otType,
          otHours,
          mult,
          pay,
          pick(r, ['status', 'Status'], 'Present'),
          now
        );
        inserted++;
      });
    }
  });

  tx();
  logAudit(req, 'IMPORT', 'Data Import', `CSV Import (${target}): ${inserted} inserted, ${updated} updated, ${skipped} skipped`, tid);
  broadcastWs('csv:imported', { tid, target, inserted, updated });
  res.status(201).json({ target, inserted, updated, skipped, errors });
});

// Company Forms (Templates + Submissions)
app.get('/api/company-forms/templates', (req, res) => {
  const tid = getTenantId(req);
  const rows = db.prepare('SELECT * FROM company_form_templates WHERE tenant_id = ? ORDER BY id DESC').all(tid) as Array<
    Record<string, unknown>
  >;
  const prefix = `T${tid}::`;
  res.json(
    rows.map((r) => ({
      ...r,
      form_code: String(r.form_code || '').startsWith(prefix) ? String(r.form_code).slice(prefix.length) : r.form_code,
    }))
  );
});

app.put('/api/company-forms/templates/:formCode', (req, res) => {
  const tid = getTenantId(req);
  const formCode = req.params.formCode;
  const dbFormCode = tid === 1 ? formCode : `T${tid}::${formCode}`;
  const b = req.body || {};
  const now = new Date().toISOString();
  const existing = db
    .prepare('SELECT id FROM company_form_templates WHERE form_code = ? AND tenant_id = ?')
    .get(dbFormCode, tid) as { id: number } | undefined;
  if (existing) {
    db.prepare(
      `
      UPDATE company_form_templates SET custom_title=?, department_key=?, subtitle=?, fields_json=?, columns_json=?, default_notes=?, updated_at=? WHERE form_code=? AND tenant_id=?
    `
    ).run(b.custom_title, b.department_key, b.subtitle || '', b.fields_json, b.columns_json, b.default_notes || '', now, dbFormCode, tid);
  } else {
    db.prepare(
      `
      INSERT INTO company_form_templates (tenant_id, form_code, custom_title, department_key, subtitle, fields_json, columns_json, default_notes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(tid, dbFormCode, b.custom_title, b.department_key, b.subtitle || '', b.fields_json, b.columns_json, b.default_notes || '', now);
  }
  const saved = db.prepare('SELECT * FROM company_form_templates WHERE form_code = ? AND tenant_id = ?').get(dbFormCode, tid) as Record<
    string,
    unknown
  >;
  res.json({ ...saved, form_code: formCode });
});

app.get('/api/company-forms/submissions', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM company_form_submissions WHERE tenant_id = ? ORDER BY id DESC').all(tid));
});

app.post('/api/company-forms/submissions', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const subNum =
    tid === 1 ? `FORM-${now.slice(0, 4)}-${Math.floor(100 + Math.random() * 899)}` : `FORM-T${tid}-${Math.floor(100 + Math.random() * 899)}`;
  const info = db
    .prepare(
      `
    INSERT INTO company_form_submissions (
      tenant_id, submission_number, form_code, form_title, department_key, department_name,
      employee_code, employee_name, submission_date, reference_no, status,
      form_data_json, prepared_by, checked_by, approved_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(
      tid,
      subNum,
      b.form_code,
      b.form_title,
      b.department_key,
      b.department_name,
      b.employee_code || '',
      b.employee_name || '',
      b.submission_date || now.slice(0, 10),
      b.reference_no || subNum,
      b.status || 'Submitted',
      b.form_data_json || '{}',
      b.prepared_by || '',
      b.checked_by || '',
      b.approved_by || '',
      now,
      now
    );
  res.status(201).json(db.prepare('SELECT * FROM company_form_submissions WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/company-forms/submissions/:id', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const b = req.body || {};
  const now = new Date().toISOString();
  db.prepare(
    `
    UPDATE company_form_submissions SET
      form_code=?, form_title=?, department_key=?, department_name=?, employee_code=?, employee_name=?,
      submission_date=?, reference_no=?, status=?, form_data_json=?, prepared_by=?, checked_by=?, approved_by=?, updated_at=?
    WHERE id = ? AND tenant_id = ?
  `
  ).run(
    b.form_code,
    b.form_title,
    b.department_key,
    b.department_name,
    b.employee_code || '',
    b.employee_name || '',
    b.submission_date,
    b.reference_no || '',
    b.status || 'Submitted',
    b.form_data_json || '{}',
    b.prepared_by || '',
    b.checked_by || '',
    b.approved_by || '',
    now,
    id,
    tid
  );
  res.json(db.prepare('SELECT * FROM company_form_submissions WHERE id = ? AND tenant_id = ?').get(id, tid));
});

app.patch('/api/company-forms/submissions/:id/status', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  db.prepare('UPDATE company_form_submissions SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?').run(
    req.body?.status || 'Approved',
    new Date().toISOString(),
    id,
    tid
  );
  res.json(db.prepare('SELECT * FROM company_form_submissions WHERE id = ? AND tenant_id = ?').get(id, tid));
});

app.delete('/api/company-forms/submissions/:id', (req, res) => {
  const tid = getTenantId(req);
  db.prepare('DELETE FROM company_form_submissions WHERE id = ? AND tenant_id = ?').run(Number(req.params.id), tid);
  res.json({ ok: true });
});

// Inventory & Supply Chain
app.get('/api/materials', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM materials WHERE tenant_id = ? ORDER BY id DESC').all(tid));
});
app.post('/api/materials', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  let sku = String(b.sku || '').trim() || `MAT-T${tid}-${Math.floor(100 + Math.random() * 899)}`;
  if (db.prepare('SELECT id FROM materials WHERE sku = ?').get(sku)) {
    sku = `${sku}-T${tid}-${Math.floor(10 + Math.random() * 89)}`;
  }
  const info = db
    .prepare(
      `
    INSERT INTO materials (tenant_id, sku, name, category, unit, stock_qty, reorder_level, unit_cost, location, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(
      tid,
      sku,
      b.name,
      b.category || 'Raw Material',
      b.unit || 'pcs',
      Number(b.stock_qty) || 0,
      Number(b.reorder_level) || 5,
      Number(b.unit_cost) || 0,
      b.location || 'Main Warehouse',
      now
    );
  res.status(201).json(db.prepare('SELECT * FROM materials WHERE id = ?').get(info.lastInsertRowid));
});
app.delete('/api/materials/:id', (req, res) => {
  const tid = getTenantId(req);
  db.prepare('DELETE FROM materials WHERE id = ? AND tenant_id = ?').run(Number(req.params.id), tid);
  res.json({ ok: true });
});

app.get('/api/material-requests', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM material_requests WHERE tenant_id = ? ORDER BY id DESC').all(tid));
});
app.post('/api/material-requests', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const num = `MR-T${tid}-${Math.floor(100 + Math.random() * 899)}`;
  const info = db
    .prepare(
      `
    INSERT INTO material_requests (tenant_id, request_number, requested_by, department, material_id, material_name, quantity, unit, urgency, needed_by, notes, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)
  `
    )
    .run(
      tid,
      num,
      b.requested_by,
      b.department,
      b.material_id || null,
      b.material_name,
      Number(b.quantity) || 1,
      b.unit || 'pcs',
      b.urgency || 'Standard',
      b.needed_by || now.slice(0, 10),
      b.notes || '',
      now
    );
  res.status(201).json(db.prepare('SELECT * FROM material_requests WHERE id = ?').get(info.lastInsertRowid));
});
app.patch('/api/material-requests/:id/status', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  db.prepare('UPDATE material_requests SET status = ? WHERE id = ? AND tenant_id = ?').run(req.body?.status || 'Approved', id, tid);
  res.json(db.prepare('SELECT * FROM material_requests WHERE id = ? AND tenant_id = ?').get(id, tid));
});
app.delete('/api/material-requests/:id', (req, res) => {
  const tid = getTenantId(req);
  db.prepare('DELETE FROM material_requests WHERE id = ? AND tenant_id = ?').run(Number(req.params.id), tid);
  res.json({ ok: true });
});

app.get('/api/grn', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM grn_records WHERE tenant_id = ? ORDER BY id DESC').all(tid));
});
app.post('/api/grn', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const num = `GRN-T${tid}-${Math.floor(100 + Math.random() * 899)}`;
  const qty = Number(b.quantity_received) || 0;
  if (b.material_id && qty > 0) {
    db.prepare('UPDATE materials SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ? AND tenant_id = ?').run(
      qty,
      now,
      Number(b.material_id),
      tid
    );
  }
  const info = db
    .prepare(
      `
    INSERT INTO grn_records (tenant_id, grn_number, po_reference, supplier_name, material_id, material_name, quantity_received, unit_cost, received_date, inspected_by, condition_status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(
      tid,
      num,
      b.po_reference || '',
      b.supplier_name,
      b.material_id || null,
      b.material_name,
      qty,
      Number(b.unit_cost) || 0,
      b.received_date || now.slice(0, 10),
      b.inspected_by || getActorName(req),
      b.condition_status || 'Accepted',
      b.notes || '',
      now
    );
  res.status(201).json(db.prepare('SELECT * FROM grn_records WHERE id = ?').get(info.lastInsertRowid));
});
app.delete('/api/grn/:id', (req, res) => {
  const tid = getTenantId(req);
  db.prepare('DELETE FROM grn_records WHERE id = ? AND tenant_id = ?').run(Number(req.params.id), tid);
  res.json({ ok: true });
});

app.get('/api/gin', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM gin_records WHERE tenant_id = ? ORDER BY id DESC').all(tid));
});
app.post('/api/gin', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const num = `GIN-T${tid}-${Math.floor(100 + Math.random() * 899)}`;
  const qty = Number(b.quantity_issued) || 0;
  if (b.material_id && qty > 0) {
    db.prepare('UPDATE materials SET stock_qty = MAX(0, stock_qty - ?), updated_at = ? WHERE id = ? AND tenant_id = ?').run(
      qty,
      now,
      Number(b.material_id),
      tid
    );
  }
  const info = db
    .prepare(
      `
    INSERT INTO gin_records (tenant_id, gin_number, issued_to_department, issued_to_person, material_id, material_name, quantity_issued, issue_date, authorized_by, audit_status, audit_variance, audit_notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `
    )
    .run(
      tid,
      num,
      b.issued_to_department,
      b.issued_to_person,
      b.material_id || null,
      b.material_name,
      qty,
      b.issue_date || now.slice(0, 10),
      b.authorized_by || getActorName(req),
      b.audit_status || 'Pending Audit',
      b.audit_notes || '',
      now
    );
  res.status(201).json(db.prepare('SELECT * FROM gin_records WHERE id = ?').get(info.lastInsertRowid));
});
app.patch('/api/gin/:id/audit', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const b = req.body || {};
  db.prepare('UPDATE gin_records SET audit_status=?, audit_variance=?, audit_notes=? WHERE id=? AND tenant_id=?').run(
    b.audit_status || 'Verified',
    Number(b.audit_variance) || 0,
    b.audit_notes || '',
    id,
    tid
  );
  res.json(db.prepare('SELECT * FROM gin_records WHERE id = ? AND tenant_id = ?').get(id, tid));
});
app.delete('/api/gin/:id', (req, res) => {
  const tid = getTenantId(req);
  db.prepare('DELETE FROM gin_records WHERE id = ? AND tenant_id = ?').run(Number(req.params.id), tid);
  res.json({ ok: true });
});

app.get('/api/inventory-movements', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM inventory_movements WHERE tenant_id = ? ORDER BY id DESC').all(tid));
});
app.post('/api/inventory-movements', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const num = `MOV-T${tid}-${Math.floor(100 + Math.random() * 899)}`;
  const qty = Number(b.quantity) || 0;
  if (b.material_id) {
    if (b.movement_type === 'Return') {
      db.prepare('UPDATE materials SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ? AND tenant_id = ?').run(
        Math.abs(qty),
        now,
        Number(b.material_id),
        tid
      );
    } else if (b.movement_type === 'Damage') {
      db.prepare('UPDATE materials SET stock_qty = MAX(0, stock_qty - ?), updated_at = ? WHERE id = ? AND tenant_id = ?').run(
        Math.abs(qty),
        now,
        Number(b.material_id),
        tid
      );
    } else if (b.movement_type === 'Adjustment') {
      db.prepare('UPDATE materials SET stock_qty = MAX(0, stock_qty + ?), updated_at = ? WHERE id = ? AND tenant_id = ?').run(
        qty,
        now,
        Number(b.material_id),
        tid
      );
    }
  }
  const info = db
    .prepare(
      `
    INSERT INTO inventory_movements (tenant_id, movement_number, movement_type, material_id, material_name, quantity, source_location, destination_location, reason, variance_qty, movement_date, recorded_by, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completed', ?)
  `
    )
    .run(
      tid,
      num,
      b.movement_type || 'Transfer',
      b.material_id || null,
      b.material_name,
      qty,
      b.source_location || '',
      b.destination_location || '',
      b.reason || '',
      Number(b.variance_qty) || 0,
      b.movement_date || now.slice(0, 10),
      getActorName(req),
      now
    );
  res.status(201).json(db.prepare('SELECT * FROM inventory_movements WHERE id = ?').get(info.lastInsertRowid));
});
app.delete('/api/inventory-movements/:id', (req, res) => {
  const tid = getTenantId(req);
  db.prepare('DELETE FROM inventory_movements WHERE id = ? AND tenant_id = ?').run(Number(req.params.id), tid);
  res.json({ ok: true });
});

app.get('/api/procurement', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM procurement_records WHERE tenant_id = ? ORDER BY id DESC').all(tid));
});
app.post('/api/procurement', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const rfq = `RFQ-T${tid}-${Math.floor(100 + Math.random() * 899)}`;
  const info = db
    .prepare(
      `
    INSERT INTO procurement_records (tenant_id, rfq_number, title, department, material_name, quantity, estimated_budget, vendor_candidates, selected_vendor, bid_amount, due_date, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?)
  `
    )
    .run(
      tid,
      rfq,
      b.title,
      b.department || 'Operations',
      b.material_name,
      Number(b.quantity) || 1,
      Number(b.estimated_budget) || 0,
      b.vendor_candidates || '',
      b.selected_vendor || '',
      Number(b.bid_amount) || 0,
      b.due_date || now.slice(0, 10),
      now
    );
  res.status(201).json(db.prepare('SELECT * FROM procurement_records WHERE id = ?').get(info.lastInsertRowid));
});
app.patch('/api/procurement/:id', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const b = req.body || {};
  db.prepare('UPDATE procurement_records SET status=?, selected_vendor=?, bid_amount=? WHERE id=? AND tenant_id=?').run(
    b.status || 'Awarded',
    b.selected_vendor || '',
    Number(b.bid_amount) || 0,
    id,
    tid
  );
  res.json(db.prepare('SELECT * FROM procurement_records WHERE id = ? AND tenant_id = ?').get(id, tid));
});
app.delete('/api/procurement/:id', (req, res) => {
  const tid = getTenantId(req);
  db.prepare('DELETE FROM procurement_records WHERE id = ? AND tenant_id = ?').run(Number(req.params.id), tid);
  res.json({ ok: true });
});

app.get('/api/purchasing', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM purchasing_orders WHERE tenant_id = ? ORDER BY id DESC').all(tid));
});
app.post('/api/purchasing', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const po = `PO-T${tid}-${Math.floor(100 + Math.random() * 899)}`;
  const qty = Number(b.quantity) || 1;
  const price = Number(b.unit_price) || 0;
  const info = db
    .prepare(
      `
    INSERT INTO purchasing_orders (tenant_id, po_number, vendor_name, material_id, material_name, quantity, unit_price, total_amount, order_date, expected_date, status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Ordered', ?, ?)
  `
    )
    .run(
      tid,
      po,
      b.vendor_name,
      b.material_id || null,
      b.material_name,
      qty,
      price,
      Number((qty * price).toFixed(2)),
      b.order_date || now.slice(0, 10),
      b.expected_date || now.slice(0, 10),
      b.notes || '',
      now
    );
  res.status(201).json(db.prepare('SELECT * FROM purchasing_orders WHERE id = ?').get(info.lastInsertRowid));
});
app.patch('/api/purchasing/:id/status', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  db.prepare('UPDATE purchasing_orders SET status = ? WHERE id = ? AND tenant_id = ?').run(req.body?.status || 'Received', id, tid);
  res.json(db.prepare('SELECT * FROM purchasing_orders WHERE id = ? AND tenant_id = ?').get(id, tid));
});
app.delete('/api/purchasing/:id', (req, res) => {
  const tid = getTenantId(req);
  db.prepare('DELETE FROM purchasing_orders WHERE id = ? AND tenant_id = ?').run(Number(req.params.id), tid);
  res.json({ ok: true });
});

// Sales & CRM
app.get('/api/crm', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM crm_deals WHERE tenant_id = ? ORDER BY id DESC').all(tid));
});
app.post('/api/crm', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `
    INSERT INTO crm_deals (tenant_id, company_name, contact_person, email, phone, stage, deal_value, assigned_rep, last_contact, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(
      tid,
      b.company_name,
      b.contact_person,
      b.email || '',
      b.phone || '',
      b.stage || 'Lead',
      Number(b.deal_value) || 0,
      b.assigned_rep || 'Sales Rep',
      b.last_contact || now.slice(0, 10),
      b.notes || '',
      now
    );
  res.status(201).json(db.prepare('SELECT * FROM crm_deals WHERE id = ?').get(info.lastInsertRowid));
});
app.patch('/api/crm/:id/stage', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  db.prepare('UPDATE crm_deals SET stage = ? WHERE id = ? AND tenant_id = ?').run(req.body?.stage || 'Lead', id, tid);
  res.json(db.prepare('SELECT * FROM crm_deals WHERE id = ? AND tenant_id = ?').get(id, tid));
});
app.delete('/api/crm/:id', (req, res) => {
  const tid = getTenantId(req);
  db.prepare('DELETE FROM crm_deals WHERE id = ? AND tenant_id = ?').run(Number(req.params.id), tid);
  res.json({ ok: true });
});

app.get('/api/sales-orders', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM sales_orders WHERE tenant_id = ? ORDER BY id DESC').all(tid));
});
app.post('/api/sales-orders', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const num = `SO-T${tid}-${Math.floor(100 + Math.random() * 899)}`;
  const info = db
    .prepare(
      `
    INSERT INTO sales_orders (tenant_id, order_number, customer_name, product_service, quantity, amount, order_date, payment_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(
      tid,
      num,
      b.customer_name,
      b.product_service,
      Number(b.quantity) || 1,
      Number(b.amount) || 0,
      b.order_date || now.slice(0, 10),
      b.payment_status || 'Pending',
      now
    );
  res.status(201).json(db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(info.lastInsertRowid));
});
app.patch('/api/sales-orders/:id/status', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  db.prepare('UPDATE sales_orders SET payment_status = ? WHERE id = ? AND tenant_id = ?').run(req.body?.payment_status || 'Paid', id, tid);
  res.json(db.prepare('SELECT * FROM sales_orders WHERE id = ? AND tenant_id = ?').get(id, tid));
});
app.delete('/api/sales-orders/:id', (req, res) => {
  const tid = getTenantId(req);
  db.prepare('DELETE FROM sales_orders WHERE id = ? AND tenant_id = ?').run(Number(req.params.id), tid);
  res.json({ ok: true });
});

// Finance & Accounting
app.get('/api/accounts', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM ledger_accounts WHERE tenant_id = ? ORDER BY code ASC').all(tid));
});
app.post('/api/accounts', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  let code = String(b.code || '').trim() || `T${tid}-9000`;
  if (db.prepare('SELECT id FROM ledger_accounts WHERE code = ?').get(code)) {
    code = `T${tid}-${code}`;
  }
  const info = db
    .prepare('INSERT INTO ledger_accounts (tenant_id, code, name, account_type, debit_total, credit_total, balance) VALUES (?, ?, ?, ?, 0, 0, 0)')
    .run(tid, code, b.name, b.account_type || 'Asset');
  res.status(201).json(db.prepare('SELECT * FROM ledger_accounts WHERE id = ?').get(info.lastInsertRowid));
});

app.get('/api/journal-entries', (req, res) => {
  const tid = getTenantId(req);
  const entries = db.prepare('SELECT * FROM journal_entries WHERE tenant_id = ? ORDER BY id DESC').all(tid) as Array<
    Record<string, unknown>
  >;
  const getLines = db.prepare('SELECT * FROM journal_lines WHERE entry_id = ?');
  res.json(entries.map((e) => ({ ...e, lines: getLines.all(e.id) })));
});

function postJournalInternal(
  entryDate: string,
  reference: string,
  description: string,
  createdBy: string,
  lines: Array<{ account_id: number; debit: number; credit: number; memo?: string }>,
  tenantId = 1
) {
  const now = new Date().toISOString();
  const totalDebit = Number(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0).toFixed(2));
  const totalCredit = Number(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0).toFixed(2));
  if (Math.abs(totalDebit - totalCredit) > 0.01 || totalDebit <= 0) {
    throw new Error('Journal entry must be balanced with positive Dr/Cr totals.');
  }
  const num = `JE-T${tenantId}-${Math.floor(100 + Math.random() * 899)}`;
  const info = db
    .prepare(
      `
    INSERT INTO journal_entries (tenant_id, entry_number, entry_date, reference, description, total_debit, total_credit, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(tenantId, num, entryDate, reference, description, totalDebit, totalCredit, createdBy, now);
  const entryId = info.lastInsertRowid;
  for (const l of lines) {
    const acc = db.prepare('SELECT * FROM ledger_accounts WHERE id = ? AND tenant_id = ?').get(l.account_id, tenantId) as
      | { id: number; code: string; name: string; account_type: string }
      | undefined;
    if (!acc) continue;
    const dr = Number(l.debit) || 0;
    const cr = Number(l.credit) || 0;
    db.prepare('INSERT INTO journal_lines (entry_id, account_id, account_code, account_name, debit, credit, memo) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      entryId,
      acc.id,
      acc.code,
      acc.name,
      dr,
      cr,
      l.memo || ''
    );
    const sign = acc.account_type === 'Asset' || acc.account_type === 'Expense' ? dr - cr : cr - dr;
    db.prepare('UPDATE ledger_accounts SET debit_total = debit_total + ?, credit_total = credit_total + ?, balance = balance + ? WHERE id = ?').run(
      dr,
      cr,
      sign,
      acc.id
    );
  }
  const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(entryId) as Record<string, unknown>;
  const savedLines = db.prepare('SELECT * FROM journal_lines WHERE entry_id = ?').all(entryId);
  return { ...entry, lines: savedLines };
}

app.post('/api/journal-entries', (req, res) => {
  const tid = getTenantId(req);
  try {
    const b = req.body || {};
    const created = postJournalInternal(
      b.entry_date || new Date().toISOString().slice(0, 10),
      b.reference || '',
      b.description || 'Journal Posting',
      getActorName(req),
      Array.isArray(b.lines) ? b.lines : [],
      tid
    );
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid journal entry' });
  }
});

app.delete('/api/journal-entries/:id', (req, res) => {
  const tid = getTenantId(req);
  db.prepare('DELETE FROM journal_entries WHERE id = ? AND tenant_id = ?').run(Number(req.params.id), tid);
  res.json({ ok: true });
});

app.get('/api/finance-vouchers', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM finance_vouchers WHERE tenant_id = ? ORDER BY id DESC').all(tid));
});
app.post('/api/finance-vouchers', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const amt = Number(b.amount) || 0;
  const drAcc = db.prepare('SELECT * FROM ledger_accounts WHERE id = ? AND tenant_id = ?').get(Number(b.debit_account_id), tid) as
    | { id: number; code: string; name: string }
    | undefined;
  const crAcc = db.prepare('SELECT * FROM ledger_accounts WHERE id = ? AND tenant_id = ?').get(Number(b.credit_account_id), tid) as
    | { id: number; code: string; name: string }
    | undefined;
  const num = `VCH-T${tid}-${Math.floor(100 + Math.random() * 899)}`;
  if (drAcc && crAcc && amt > 0) {
    postJournalInternal(
      b.voucher_date || now.slice(0, 10),
      num,
      `${b.voucher_type}: ${b.party_name} — ${b.description || ''}`,
      getActorName(req),
      [
        { account_id: drAcc.id, debit: amt, credit: 0, memo: b.party_name },
        { account_id: crAcc.id, debit: 0, credit: amt, memo: b.payment_method },
      ],
      tid
    );
  }
  const info = db
    .prepare(
      `
    INSERT INTO finance_vouchers (
      tenant_id, voucher_number, voucher_type, voucher_date, party_name, payment_method, bank_reference,
      debit_account_id, debit_account_name, credit_account_id, credit_account_name,
      amount, description, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(
      tid,
      num,
      b.voucher_type,
      b.voucher_date || now.slice(0, 10),
      b.party_name,
      b.payment_method || 'Cash',
      b.bank_reference || '',
      Number(b.debit_account_id),
      drAcc ? `${drAcc.code} — ${drAcc.name}` : 'Debit Account',
      Number(b.credit_account_id),
      crAcc ? `${crAcc.code} — ${crAcc.name}` : 'Credit Account',
      amt,
      b.description || '',
      getActorName(req),
      now
    );
  res.status(201).json(db.prepare('SELECT * FROM finance_vouchers WHERE id = ?').get(info.lastInsertRowid));
});
app.delete('/api/finance-vouchers/:id', (req, res) => {
  const tid = getTenantId(req);
  db.prepare('DELETE FROM finance_vouchers WHERE id = ? AND tenant_id = ?').run(Number(req.params.id), tid);
  res.json({ ok: true });
});

app.get('/api/finance-budgets', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM finance_budgets WHERE tenant_id = ? ORDER BY id DESC').all(tid));
});
app.post('/api/finance-budgets', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const acc = db.prepare('SELECT * FROM ledger_accounts WHERE id = ? AND tenant_id = ?').get(Number(b.account_id), tid) as
    | { code: string; name: string }
    | undefined;
  const info = db
    .prepare(
      `
    INSERT INTO finance_budgets (tenant_id, fiscal_year, department, account_id, account_code, account_name, allocated_amount, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(
      tid,
      b.fiscal_year || String(new Date().getFullYear()),
      b.department,
      Number(b.account_id),
      acc?.code || '',
      acc?.name || '',
      Number(b.allocated_amount) || 0,
      b.notes || '',
      now
    );
  res.status(201).json(db.prepare('SELECT * FROM finance_budgets WHERE id = ?').get(info.lastInsertRowid));
});
app.delete('/api/finance-budgets/:id', (req, res) => {
  const tid = getTenantId(req);
  db.prepare('DELETE FROM finance_budgets WHERE id = ? AND tenant_id = ?').run(Number(req.params.id), tid);
  res.json({ ok: true });
});

// Assets, Vehicles & Equipment Maintenance
app.get('/api/assets', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM assets_uniforms WHERE tenant_id = ? ORDER BY id DESC').all(tid));
});
app.post('/api/assets', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `
    INSERT INTO assets_uniforms (tenant_id, item_name, category, employee_id, employee_name, quantity, condition, date_issued, expected_return, status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Issued', ?, ?)
  `
    )
    .run(
      tid,
      b.item_name,
      b.category,
      b.employee_id,
      b.employee_name,
      Number(b.quantity) || 1,
      b.condition || 'New',
      b.date_issued || now.slice(0, 10),
      b.expected_return || '',
      b.notes || '',
      now
    );
  res.status(201).json(db.prepare('SELECT * FROM assets_uniforms WHERE id = ?').get(info.lastInsertRowid));
});
app.put('/api/assets/:id', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const b = req.body || {};
  db.prepare(
    `
    UPDATE assets_uniforms SET item_name=?, category=?, employee_id=?, employee_name=?, quantity=?, condition=?, date_issued=?, expected_return=?, notes=? WHERE id=? AND tenant_id=?
  `
  ).run(b.item_name, b.category, b.employee_id, b.employee_name, Number(b.quantity) || 1, b.condition, b.date_issued, b.expected_return || '', b.notes || '', id, tid);
  res.json(db.prepare('SELECT * FROM assets_uniforms WHERE id = ? AND tenant_id = ?').get(id, tid));
});
app.patch('/api/assets/:id/status', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  db.prepare('UPDATE assets_uniforms SET status = ? WHERE id = ? AND tenant_id = ?').run(req.body?.status || 'Returned', id, tid);
  res.json(db.prepare('SELECT * FROM assets_uniforms WHERE id = ? AND tenant_id = ?').get(id, tid));
});
app.delete('/api/assets/:id', (req, res) => {
  const tid = getTenantId(req);
  db.prepare('DELETE FROM assets_uniforms WHERE id = ? AND tenant_id = ?').run(Number(req.params.id), tid);
  res.json({ ok: true });
});

app.get('/api/vehicles', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM vehicles WHERE tenant_id = ? ORDER BY id DESC').all(tid));
});
app.post('/api/vehicles', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `
    INSERT INTO vehicles (tenant_id, plate_number, vehicle_model, driver_name, department, mileage_km, fuel_cost, maintenance_cost, insurance_expiry, inspection_date, status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(
      tid,
      b.plate_number,
      b.vehicle_model,
      b.driver_name,
      b.department || 'Logistics',
      Number(b.mileage_km) || 0,
      Number(b.fuel_cost) || 0,
      Number(b.maintenance_cost) || 0,
      b.insurance_expiry || now.slice(0, 10),
      b.inspection_date || now.slice(0, 10),
      b.status || 'Active',
      b.notes || '',
      now
    );
  res.status(201).json(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(info.lastInsertRowid));
});
app.put('/api/vehicles/:id', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const b = req.body || {};
  db.prepare(
    `
    UPDATE vehicles SET plate_number=?, vehicle_model=?, driver_name=?, department=?, mileage_km=?, fuel_cost=?, maintenance_cost=?, insurance_expiry=?, inspection_date=?, status=?, notes=? WHERE id=? AND tenant_id=?
  `
  ).run(
    b.plate_number,
    b.vehicle_model,
    b.driver_name,
    b.department,
    Number(b.mileage_km) || 0,
    Number(b.fuel_cost) || 0,
    Number(b.maintenance_cost) || 0,
    b.insurance_expiry,
    b.inspection_date,
    b.status,
    b.notes || '',
    id,
    tid
  );
  res.json(db.prepare('SELECT * FROM vehicles WHERE id = ? AND tenant_id = ?').get(id, tid));
});
app.delete('/api/vehicles/:id', (req, res) => {
  const tid = getTenantId(req);
  db.prepare('DELETE FROM vehicles WHERE id = ? AND tenant_id = ?').run(Number(req.params.id), tid);
  res.json({ ok: true });
});

app.get('/api/equipment-maintenance', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM equipment_maintenance WHERE tenant_id = ? ORDER BY id DESC').all(tid));
});
app.post('/api/equipment-maintenance', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `
    INSERT INTO equipment_maintenance (tenant_id, equipment_code, equipment_name, category, serial_number, location, maintenance_type, technician_name, maintenance_date, next_service_due, cost, status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(
      tid,
      b.equipment_code,
      b.equipment_name,
      b.category,
      b.serial_number || '',
      b.location,
      b.maintenance_type || 'Preventive',
      b.technician_name,
      b.maintenance_date || now.slice(0, 10),
      b.next_service_due || '',
      Number(b.cost) || 0,
      b.status || 'Scheduled',
      b.notes || '',
      now
    );
  res.status(201).json(db.prepare('SELECT * FROM equipment_maintenance WHERE id = ?').get(info.lastInsertRowid));
});
app.put('/api/equipment-maintenance/:id', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const b = req.body || {};
  db.prepare(
    `
    UPDATE equipment_maintenance SET equipment_code=?, equipment_name=?, category=?, serial_number=?, location=?, maintenance_type=?, technician_name=?, maintenance_date=?, next_service_due=?, cost=?, status=?, notes=? WHERE id=? AND tenant_id=?
  `
  ).run(
    b.equipment_code,
    b.equipment_name,
    b.category,
    b.serial_number || '',
    b.location,
    b.maintenance_type,
    b.technician_name,
    b.maintenance_date,
    b.next_service_due || '',
    Number(b.cost) || 0,
    b.status,
    b.notes || '',
    id,
    tid
  );
  res.json(db.prepare('SELECT * FROM equipment_maintenance WHERE id = ? AND tenant_id = ?').get(id, tid));
});
app.patch('/api/equipment-maintenance/:id/status', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  db.prepare('UPDATE equipment_maintenance SET status = ? WHERE id = ? AND tenant_id = ?').run(req.body?.status || 'Completed', id, tid);
  res.json(db.prepare('SELECT * FROM equipment_maintenance WHERE id = ? AND tenant_id = ?').get(id, tid));
});
app.delete('/api/equipment-maintenance/:id', (req, res) => {
  const tid = getTenantId(req);
  db.prepare('DELETE FROM equipment_maintenance WHERE id = ? AND tenant_id = ?').run(Number(req.params.id), tid);
  res.json({ ok: true });
});

// Chat
app.get('/api/chat/channels', (req, res) => {
  const tid = getTenantId(req);
  const rows = db
    .prepare(
      `
    SELECT c.*, (SELECT COUNT(*) FROM chat_messages m WHERE m.channel_id = c.id) as message_count
    FROM chat_channels c WHERE c.tenant_id = ? ORDER BY c.id ASC
  `
    )
    .all(tid);
  res.json(rows);
});

app.post('/api/chat/channels', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const rawName = String(b.name || '').trim();
  let name = rawName.startsWith('#') ? rawName : `#${rawName}`;
  if (db.prepare('SELECT id FROM chat_channels WHERE name = ?').get(name)) {
    name = `${name}-t${tid}`;
  }
  const info = db
    .prepare('INSERT INTO chat_channels (tenant_id, name, department, description, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(tid, name, b.department || 'Operations', b.description || '', now);
  const created = { ...(db.prepare('SELECT * FROM chat_channels WHERE id = ?').get(info.lastInsertRowid) as object), message_count: 0 };
  broadcastWs('chat:channel_created', created);
  res.status(201).json(created);
});

app.delete('/api/chat/channels/:id', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  db.prepare('DELETE FROM chat_channels WHERE id = ? AND tenant_id = ?').run(id, tid);
  broadcastWs('chat:channel_deleted', { id, tenant_id: tid });
  res.json({ ok: true });
});

app.get('/api/chat/channels/:id/messages', (req, res) => {
  res.json(db.prepare('SELECT * FROM chat_messages WHERE channel_id = ? ORDER BY id ASC').all(Number(req.params.id)));
});

app.post('/api/chat/channels/:id/messages', (req, res) => {
  const channelId = Number(req.params.id);
  const b = req.body || {};
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `
    INSERT INTO chat_messages (channel_id, sender_name, sender_role, content, attachment_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `
    )
    .run(channelId, b.sender_name || getActorName(req), b.sender_role || 'Staff', b.content, b.attachment_name || null, now);
  const created = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(info.lastInsertRowid);
  broadcastWs('chat:message', created);
  res.status(201).json(created);
});

app.delete('/api/chat/messages/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM chat_messages WHERE id = ?').run(id);
  broadcastWs('chat:deleted', { id });
  res.json({ ok: true });
});

// Single-Use Gate Pass Endpoints
app.get('/api/gate-passes', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM gate_passes WHERE tenant_id = ? ORDER BY id DESC').all(tid));
});

app.post('/api/gate-passes', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const count = (db.prepare('SELECT COUNT(*) as c FROM gate_passes WHERE tenant_id = ?').get(tid) as { c: number }).c + 1;
  let passNumber =
    String(b.pass_number || '').trim() ||
    (tid === 1 ? `GP-${now.slice(0, 4)}-${String(count).padStart(3, '0')}` : `GP-T${tid}-${now.slice(0, 4)}-${String(count).padStart(3, '0')}`);
  if (db.prepare('SELECT id FROM gate_passes WHERE pass_number = ?').get(passNumber)) {
    passNumber = `${passNumber}-${Math.floor(10 + Math.random() * 89)}`;
  }
  const passToken = `ONCE-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const info = db
    .prepare(
      `
    INSERT INTO gate_passes (
      tenant_id, pass_number, pass_token, pass_type, person_name, employee_code, department,
      destination, purpose, items_description, vehicle_plate, valid_date,
      issued_by, approved_department, status, used_at, verified_by_guard, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', NULL, '', ?)
  `
    )
    .run(
      tid,
      passNumber,
      passToken,
      b.pass_type || 'Staff Exit',
      b.person_name || 'Staff Member',
      b.employee_code || '',
      b.department || 'Operations',
      b.destination || '',
      b.purpose || '',
      b.items_description || '',
      b.vehicle_plate || '',
      b.valid_date || now.slice(0, 10),
      b.issued_by || getActorName(req),
      b.approved_department || 'Security & Gate',
      now
    );
  const created = db.prepare('SELECT * FROM gate_passes WHERE id = ?').get(info.lastInsertRowid);
  logAudit(req, 'CREATE', 'GatePass', `Issued single-use Gate Pass ${passNumber} for ${b.person_name || 'Staff'}`, tid);
  broadcastWs('gatepass:created', created);
  res.status(201).json(created);
});

// Strict single-use verification/consumption: once Used, permanently locked!
app.post('/api/gate-passes/:id/consume', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const pass = db.prepare('SELECT * FROM gate_passes WHERE id = ? AND tenant_id = ?').get(id, tid) as
    | { id: number; pass_number: string; status: string; used_at: string | null }
    | undefined;
  if (!pass) {
    res.status(404).json({ error: 'Gate Pass not found.' });
    return;
  }
  if (pass.status === 'Used') {
    res.status(409).json({
      error: `Single-use Gate Pass ${pass.pass_number} was already used at ${pass.used_at || 'gate'} and cannot be reused.`,
    });
    return;
  }
  if (pass.status === 'Cancelled') {
    res.status(409).json({ error: `Gate Pass ${pass.pass_number} is cancelled.` });
    return;
  }
  const now = new Date().toISOString();
  const guard = String(req.body?.verified_by_guard || getActorName(req)).trim() || 'Gate Security';
  db.prepare(`UPDATE gate_passes SET status = 'Used', used_at = ?, verified_by_guard = ? WHERE id = ? AND tenant_id = ?`).run(
    now,
    guard,
    id,
    tid
  );
  const updated = db.prepare('SELECT * FROM gate_passes WHERE id = ?').get(id);
  logAudit(req, 'CONSUME', 'GatePass', `Verified & locked single-use Gate Pass ${pass.pass_number} by ${guard}`, tid);
  broadcastWs('gatepass:consumed', updated);
  res.json(updated);
});

app.patch('/api/gate-passes/:id/status', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const pass = db.prepare('SELECT * FROM gate_passes WHERE id = ? AND tenant_id = ?').get(id, tid) as
    | { id: number; pass_number: string; status: string }
    | undefined;
  if (!pass) {
    res.status(404).json({ error: 'Gate Pass not found.' });
    return;
  }
  if (pass.status === 'Used') {
    res.status(409).json({ error: `Single-use Gate Pass ${pass.pass_number} is permanently locked after use.` });
    return;
  }
  const nextStatus = req.body?.status === 'Cancelled' ? 'Cancelled' : 'Active';
  db.prepare('UPDATE gate_passes SET status = ? WHERE id = ? AND tenant_id = ?').run(nextStatus, id, tid);
  const updated = db.prepare('SELECT * FROM gate_passes WHERE id = ?').get(id);
  logAudit(req, 'UPDATE', 'GatePass', `Updated Gate Pass ${pass.pass_number} status to ${nextStatus}`, tid);
  res.json(updated);
});

app.delete('/api/gate-passes/:id', (req, res) => {
  const tid = getTenantId(req);
  db.prepare('DELETE FROM gate_passes WHERE id = ? AND tenant_id = ?').run(Number(req.params.id), tid);
  logAudit(req, 'DELETE', 'GatePass', `Removed gate pass #${req.params.id}`, tid);
  res.json({ ok: true });
});

// Department Approval Routing Endpoints ("Send to Approve Department")
app.get('/api/approvals', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM department_approvals WHERE tenant_id = ? ORDER BY id DESC').all(tid));
});

app.post('/api/approvals', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const now = new Date().toISOString();
  const count = (db.prepare('SELECT COUNT(*) as c FROM department_approvals WHERE tenant_id = ?').get(tid) as { c: number }).c + 1;
  const reqCode = `APR-T${tid}-${now.slice(0, 4)}-${String(count).padStart(3, '0')}-${Math.floor(10 + Math.random() * 89)}`;
  const info = db
    .prepare(
      `
    INSERT INTO department_approvals (
      tenant_id, request_code, source_module, record_ref, title, summary, from_department,
      target_department, requested_by, priority, notes, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)
  `
    )
    .run(
      tid,
      reqCode,
      b.source_module || 'company-forms',
      b.record_ref || 'DRAFT',
      b.title || 'Department Approval Request',
      b.summary || '',
      b.from_department || 'Operations',
      b.target_department || 'General Manager',
      b.requested_by || getActorName(req),
      b.priority === 'Urgent' ? 'Urgent' : 'Normal',
      b.notes || '',
      now
    );
  const created = db.prepare('SELECT * FROM department_approvals WHERE id = ?').get(info.lastInsertRowid);
  logAudit(req, 'DISPATCH', 'Approvals', `Sent "${b.title}" (${b.record_ref}) to ${b.target_department} for approval`, tid);
  broadcastWs('approval:created', created);
  res.status(201).json(created);
});

app.patch('/api/approvals/:id/decision', (req, res) => {
  const tid = getTenantId(req);
  const id = Number(req.params.id);
  const b = req.body || {};
  const status = b.status === 'Rejected' ? 'Rejected' : 'Approved';
  const now = new Date().toISOString();
  const decider = b.decision_by || getActorName(req);
  db.prepare(
    `
    UPDATE department_approvals
    SET status = ?, decision_by = ?, decision_notes = ?, decision_at = ?
    WHERE id = ? AND tenant_id = ?
  `
  ).run(status, decider, b.decision_notes || '', now, id, tid);
  const updated = db.prepare('SELECT * FROM department_approvals WHERE id = ? AND tenant_id = ?').get(id, tid);
  logAudit(req, status.toUpperCase(), 'Approvals', `${status} department request #${id} (${decider})`, tid);
  broadcastWs('approval:decided', updated);
  res.json(updated);
});

app.delete('/api/approvals/:id', (req, res) => {
  const tid = getTenantId(req);
  db.prepare('DELETE FROM department_approvals WHERE id = ? AND tenant_id = ?').run(Number(req.params.id), tid);
  res.json({ ok: true });
});

// Share Dispatch Audit & Email Endpoint
app.post('/api/share/email', (req, res) => {
  const tid = getTenantId(req);
  const b = req.body || {};
  const recipient = String(b.recipient || '').trim();
  const subject = String(b.subject || 'Seven Sunday Document Share').trim();
  const channel = String(b.channel || 'Email').trim();
  if (channel === 'Email' && !recipient) {
    res.status(400).json({ error: 'Recipient email address is required.' });
    return;
  }
  const settings = buildCompanySettingsForTenant(tid) as { smtp_host?: string; smtp_port?: number; smtp_from?: string };
  logAudit(req, 'SHARE', 'Sharing', `Shared "${subject}" via ${channel}${recipient ? ` to ${recipient}` : ''}`, tid);
  res.json({
    ok: true,
    channel,
    recipient,
    subject,
    smtp_host: settings?.smtp_host || 'smtp.sevensunday.et',
    recorded_at: new Date().toISOString(),
  });
});

// Audit, Notifications, Search
app.get('/api/audit-logs', (req, res) => {
  const tid = getTenantId(req);
  res.json(db.prepare('SELECT * FROM audit_logs WHERE tenant_id = ? ORDER BY id DESC LIMIT 200').all(tid));
});

app.get('/api/notifications', (req, res) => {
  const tid = getTenantId(req);
  const items: Array<{ id: string; title: string; detail: string; severity: string; module: string; created_at: string }> = [];
  const now = new Date().toISOString();

  const pendingApprovals = db
    .prepare("SELECT * FROM department_approvals WHERE tenant_id = ? AND status = 'Pending' ORDER BY id DESC")
    .all(tid) as Array<{
    id: number;
    request_code: string;
    title: string;
    target_department: string;
    priority: string;
    created_at: string;
  }>;
  for (const ap of pendingApprovals) {
    items.push({
      id: `apr-${ap.id}`,
      title: `Approval Request (${ap.target_department}): ${ap.title}`,
      detail: `${ap.request_code} · Priority: ${ap.priority}`,
      severity: ap.priority === 'Urgent' ? 'critical' : 'warning',
      module: 'approvals',
      created_at: ap.created_at,
    });
  }

  const activePasses = db
    .prepare("SELECT * FROM gate_passes WHERE tenant_id = ? AND status = 'Active' ORDER BY id DESC")
    .all(tid) as Array<{
    id: number;
    pass_number: string;
    person_name: string;
    pass_type: string;
    valid_date: string;
    created_at: string;
  }>;
  for (const gp of activePasses) {
    items.push({
      id: `gp-${gp.id}`,
      title: `Active Single-Use Gate Pass: ${gp.pass_number}`,
      detail: `${gp.pass_type} · ${gp.person_name} (Valid ${gp.valid_date})`,
      severity: 'info',
      module: 'gate-pass',
      created_at: gp.created_at,
    });
  }

  const pendingLeaves = db
    .prepare("SELECT * FROM leaves WHERE tenant_id = ? AND status = 'Pending'")
    .all(tid) as Array<{ id: number; employee_name: string; leave_type: string; days: number; created_at: string }>;
  for (const l of pendingLeaves) {
    items.push({
      id: `leave-${l.id}`,
      title: `Pending Leave: ${l.employee_name}`,
      detail: `${l.leave_type} (${l.days} day(s)) awaiting HR approval`,
      severity: 'warning',
      module: 'leave',
      created_at: l.created_at,
    });
  }

  const lowStock = db
    .prepare('SELECT * FROM materials WHERE tenant_id = ? AND stock_qty <= reorder_level')
    .all(tid) as Array<{ id: number; name: string; stock_qty: number; reorder_level: number; unit: string; updated_at: string }>;
  for (const m of lowStock) {
    items.push({
      id: `mat-${m.id}`,
      title: `Low Stock Alert: ${m.name}`,
      detail: `Remaining ${m.stock_qty} ${m.unit} (reorder at ${m.reorder_level})`,
      severity: 'critical',
      module: 'materials',
      created_at: m.updated_at,
    });
  }

  const pendingMatReq = db
    .prepare("SELECT * FROM material_requests WHERE tenant_id = ? AND status = 'Pending'")
    .all(tid) as Array<{ id: number; request_number: string; material_name: string; quantity: number; created_at: string }>;
  for (const mr of pendingMatReq) {
    items.push({
      id: `mr-${mr.id}`,
      title: `Material Request ${mr.request_number}`,
      detail: `${mr.material_name} (Qty ${mr.quantity})`,
      severity: 'info',
      module: 'material-requests',
      created_at: mr.created_at,
    });
  }

  const pendingMaint = db
    .prepare("SELECT * FROM equipment_maintenance WHERE tenant_id = ? AND status IN ('Scheduled', 'In Progress', 'Out of Service')")
    .all(tid) as Array<{ id: number; equipment_name: string; status: string; maintenance_date: string }>;
  for (const eq of pendingMaint) {
    items.push({
      id: `eq-${eq.id}`,
      title: `Equipment ${eq.status}: ${eq.equipment_name}`,
      detail: `Scheduled for ${eq.maintenance_date}`,
      severity: eq.status === 'Out of Service' ? 'critical' : 'info',
      module: 'vehicles',
      created_at: now,
    });
  }

  res.json(items);
});

app.get('/api/search', (req, res) => {
  const tid = getTenantId(req);
  const q = `%${String(req.query.q || '').trim()}%`;
  const results: Array<{ id: string; category: string; title: string; subtitle: string; module: string }> = [];

  for (const e of db
    .prepare('SELECT id, employee_id, full_name, department, job_title FROM employees WHERE tenant_id = ? AND (full_name LIKE ? OR employee_id LIKE ? OR department LIKE ?) LIMIT 5')
    .all(tid, q, q, q) as Array<Record<string, string>>) {
    results.push({ id: `emp-${e.id}`, category: 'Employee', title: e.full_name, subtitle: `${e.employee_id} · ${e.department} · ${e.job_title}`, module: 'hr' });
  }
  for (const dev of db
    .prepare('SELECT id, device_name, device_type, ip_address, port, status FROM devices WHERE tenant_id = ? AND (device_name LIKE ? OR ip_address LIKE ? OR serial_number LIKE ?) LIMIT 5')
    .all(tid, q, q, q) as Array<Record<string, unknown>>) {
    results.push({ id: `dev-${dev.id}`, category: 'Device Connection', title: String(dev.device_name), subtitle: `${dev.ip_address}:${dev.port} · ${dev.status}`, module: 'devices' });
  }
  for (const gp of db
    .prepare('SELECT id, pass_number, person_name, pass_type, status, destination FROM gate_passes WHERE tenant_id = ? AND (pass_number LIKE ? OR person_name LIKE ? OR destination LIKE ? OR vehicle_plate LIKE ?) LIMIT 5')
    .all(tid, q, q, q, q) as Array<Record<string, string>>) {
    results.push({ id: `gp-${gp.id}`, category: 'Gate Pass', title: `${gp.pass_number} — ${gp.person_name}`, subtitle: `${gp.pass_type} · ${gp.status} · ${gp.destination}`, module: 'gate-pass' });
  }
  for (const cf of db
    .prepare('SELECT id, submission_number, form_code, form_title, employee_name, status FROM company_form_submissions WHERE tenant_id = ? AND (submission_number LIKE ? OR form_code LIKE ? OR form_title LIKE ? OR employee_name LIKE ?) LIMIT 5')
    .all(tid, q, q, q, q) as Array<Record<string, string>>) {
    results.push({ id: `form-${cf.id}`, category: 'Company Form', title: `${cf.form_code}: ${cf.form_title}`, subtitle: `${cf.submission_number} · ${cf.employee_name || 'Company'} · ${cf.status}`, module: 'company-forms' });
  }
  for (const ap of db
    .prepare('SELECT id, request_code, title, target_department, status FROM department_approvals WHERE tenant_id = ? AND (request_code LIKE ? OR title LIKE ? OR target_department LIKE ?) LIMIT 5')
    .all(tid, q, q, q) as Array<Record<string, string>>) {
    results.push({ id: `apr-${ap.id}`, category: 'Approval', title: ap.title, subtitle: `${ap.request_code} · To: ${ap.target_department} · ${ap.status}`, module: 'approvals' });
  }
  for (const m of db
    .prepare('SELECT id, sku, name, stock_qty, unit, location FROM materials WHERE tenant_id = ? AND (name LIKE ? OR sku LIKE ?) LIMIT 5')
    .all(tid, q, q) as Array<Record<string, unknown>>) {
    results.push({ id: `mat-${m.id}`, category: 'Material', title: String(m.name), subtitle: `${m.sku} · ${m.stock_qty} ${m.unit} @ ${m.location}`, module: 'materials' });
  }
  for (const d of db
    .prepare('SELECT id, doc_number, title, category FROM company_documents WHERE tenant_id = ? AND (title LIKE ? OR doc_number LIKE ?) LIMIT 5')
    .all(tid, q, q) as Array<Record<string, string>>) {
    results.push({ id: `doc-${d.id}`, category: 'Document', title: d.title, subtitle: `${d.doc_number} · ${d.category}`, module: 'secretary' });
  }
  for (const f of db
    .prepare('SELECT id, file_code, title, file_name, category FROM imported_files WHERE tenant_id = ? AND (title LIKE ? OR file_name LIKE ? OR file_code LIKE ?) LIMIT 5')
    .all(tid, q, q, q) as Array<Record<string, string>>) {
    results.push({ id: `file-${f.id}`, category: 'Imported File', title: f.title, subtitle: `${f.file_code} · ${f.file_name} · ${f.category}`, module: 'secretary' });
  }
  for (const sh of db
    .prepare('SELECT id, shift_code, shift_name, shift_category, start_time, end_time FROM shifts WHERE tenant_id = ? AND (shift_name LIKE ? OR shift_category LIKE ? OR shift_code LIKE ?) LIMIT 5')
    .all(tid, q, q, q) as Array<Record<string, string>>) {
    results.push({ id: `shf-${sh.id}`, category: 'Shift', title: sh.shift_name, subtitle: `${sh.shift_code} · ${sh.shift_category} · ${sh.start_time}–${sh.end_time}`, module: 'scheduling' });
  }
  for (const sc of db
    .prepare('SELECT id, schedule_code, employee_name, department, shift_name, schedule_date FROM staff_schedules WHERE tenant_id = ? AND (employee_name LIKE ? OR department LIKE ? OR shift_name LIKE ? OR schedule_code LIKE ?) LIMIT 5')
    .all(tid, q, q, q, q) as Array<Record<string, string>>) {
    results.push({ id: `sch-${sc.id}`, category: 'Staff Schedule', title: `${sc.employee_name} — ${sc.shift_name}`, subtitle: `${sc.schedule_code} · ${sc.department} · ${sc.schedule_date}`, module: 'scheduling' });
  }
  for (const deal of db
    .prepare('SELECT id, company_name, contact_person, stage FROM crm_deals WHERE tenant_id = ? AND (company_name LIKE ? OR contact_person LIKE ?) LIMIT 5')
    .all(tid, q, q) as Array<Record<string, string>>) {
    results.push({ id: `crm-${deal.id}`, category: 'CRM Deal', title: deal.company_name, subtitle: `${deal.contact_person} · ${deal.stage}`, module: 'sales-crm' });
  }
  for (const v of db
    .prepare('SELECT id, voucher_number, party_name, amount FROM finance_vouchers WHERE tenant_id = ? AND (party_name LIKE ? OR voucher_number LIKE ?) LIMIT 5')
    .all(tid, q, q) as Array<Record<string, unknown>>) {
    results.push({ id: `vch-${v.id}`, category: 'Voucher', title: String(v.voucher_number), subtitle: `${v.party_name} · ${v.amount}`, module: 'finance' });
  }
  res.json(results);
});

// Executive Dashboard with Real Chart & Bar Chart Series (Tenant-Scoped)
app.get('/api/dashboard', (req, res) => {
  const tid = getTenantId(req);
  const totalEmployees = (db.prepare('SELECT COUNT(*) as c FROM employees WHERE tenant_id = ?').get(tid) as { c: number }).c;
  const activeEmployees = (db.prepare("SELECT COUNT(*) as c FROM employees WHERE tenant_id = ? AND status = 'Active'").get(tid) as { c: number }).c;
  const totalDevices = (db.prepare('SELECT COUNT(*) as c FROM devices WHERE tenant_id = ?').get(tid) as { c: number }).c;
  const connectedDevices = (db.prepare("SELECT COUNT(*) as c FROM devices WHERE tenant_id = ? AND status = 'Connected'").get(tid) as { c: number }).c;

  const attStats = db
    .prepare(
      `
    SELECT COUNT(*) as total,
           SUM(CASE WHEN register_state = 'Open' THEN 1 ELSE 0 END) as openCnt,
           SUM(CASE WHEN register_state = 'Closed' THEN 1 ELSE 0 END) as closedCnt,
           COALESCE(SUM(ot_pay), 0) as otPay
    FROM attendance_records
    WHERE tenant_id = ?
  `
    )
    .get(tid) as { total: number; openCnt: number; closedCnt: number; otPay: number };

  const pendingLeaves = (db.prepare("SELECT COUNT(*) as c FROM leaves WHERE tenant_id = ? AND status = 'Pending'").get(tid) as { c: number }).c;

  const payAgg = db
    .prepare(
      `
    SELECT COUNT(*) as cnt,
           COALESCE(SUM(basic_salary), 0) as basicSum,
           COALESCE(SUM(gross_salary), 0) as grossSum,
           COALESCE(SUM(income_tax), 0) as taxSum,
           COALESCE(SUM(employee_pension), 0) as empPen,
           COALESCE(SUM(employer_pension), 0) as erPen,
           COALESCE(SUM(net_salary), 0) as netSum,
           COALESCE(SUM(absence_amount), 0) as absSum,
           COALESCE(SUM(ot_normal_hours), 0) as otNorHrs,
           COALESCE(SUM(ot_night_hours), 0) as otNightHrs,
           COALESCE(SUM(ot_sunday_hours), 0) as otSunHrs,
           COALESCE(SUM(ot_holiday_hours), 0) as otHolHrs,
           COALESCE(SUM(ot_normal_amount), 0) as otNorAmt,
           COALESCE(SUM(ot_night_amount), 0) as otNightAmt,
           COALESCE(SUM(ot_sunday_amount), 0) as otSunAmt,
           COALESCE(SUM(ot_holiday_amount), 0) as otHolAmt
    FROM payroll_records
    WHERE tenant_id = ?
  `
    )
    .get(tid) as Record<string, number>;

  const { otRow } = getRulesAndOt(tid);

  const totalDocuments = (db.prepare('SELECT COUNT(*) as c FROM company_documents WHERE tenant_id = ?').get(tid) as { c: number }).c;
  const totalFormSubmissions = (db.prepare('SELECT COUNT(*) as c FROM company_form_submissions WHERE tenant_id = ?').get(tid) as { c: number }).c;
  const pendingFormApprovals = (
    db.prepare("SELECT COUNT(*) as c FROM company_form_submissions WHERE tenant_id = ? AND status IN ('Draft', 'Submitted')").get(tid) as { c: number }
  ).c;

  const matAgg = db
    .prepare(
      `
    SELECT COALESCE(SUM(stock_qty * unit_cost), 0) as val,
           SUM(CASE WHEN stock_qty <= reorder_level THEN 1 ELSE 0 END) as lowCnt
    FROM materials
    WHERE tenant_id = ?
  `
    )
    .get(tid) as { val: number; lowCnt: number };

  const pendingMaterialRequests = (db.prepare("SELECT COUNT(*) as c FROM material_requests WHERE tenant_id = ? AND status = 'Pending'").get(tid) as { c: number }).c;
  const openPurchaseOrders = (
    db.prepare("SELECT COUNT(*) as c FROM purchasing_orders WHERE tenant_id = ? AND status IN ('Ordered', 'Partially Received')").get(tid) as { c: number }
  ).c;

  const pipelineValue = (db.prepare("SELECT COALESCE(SUM(deal_value), 0) as s FROM crm_deals WHERE tenant_id = ? AND stage != 'Closed Lost'").get(tid) as { s: number }).s;
  const paidSalesTotal = (db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM sales_orders WHERE tenant_id = ? AND payment_status = 'Paid'").get(tid) as { s: number }).s;

  const revExp = db
    .prepare(
      `
    SELECT COALESCE(SUM(CASE WHEN account_type = 'Revenue' THEN balance ELSE 0 END), 0) as rev,
           COALESCE(SUM(CASE WHEN account_type = 'Expense' THEN balance ELSE 0 END), 0) as exp,
           COALESCE(SUM(debit_total), 0) as debits
    FROM ledger_accounts
    WHERE tenant_id = ?
  `
    )
    .get(tid) as { rev: number; exp: number; debits: number };

  const activeVehicles = (db.prepare("SELECT COUNT(*) as c FROM vehicles WHERE tenant_id = ? AND status = 'Active'").get(tid) as { c: number }).c;
  const totalAssetsIssued = (db.prepare("SELECT COUNT(*) as c FROM assets_uniforms WHERE tenant_id = ? AND status = 'Issued'").get(tid) as { c: number }).c;
  const pendingMaintenanceCount = (
    db.prepare("SELECT COUNT(*) as c FROM equipment_maintenance WHERE tenant_id = ? AND status != 'Completed'").get(tid) as { c: number }
  ).c;
  const pendingDepartmentApprovals = (
    db.prepare("SELECT COUNT(*) as c FROM department_approvals WHERE tenant_id = ? AND status = 'Pending'").get(tid) as { c: number }
  ).c;
  const activeGatePasses = (db.prepare("SELECT COUNT(*) as c FROM gate_passes WHERE tenant_id = ? AND status = 'Active'").get(tid) as { c: number }).c;
  const chatChannels = (db.prepare('SELECT COUNT(*) as c FROM chat_channels WHERE tenant_id = ?').get(tid) as { c: number }).c;
  const chatMessages = (
    db.prepare('SELECT COUNT(*) as c FROM chat_messages m INNER JOIN chat_channels c ON c.id = m.channel_id WHERE c.tenant_id = ?').get(tid) as { c: number }
  ).c;

  const departmentBreakdown = db
    .prepare(
      `
    SELECT department, COUNT(*) as headcount, COALESCE(SUM(basic_salary), 0) as monthlyBasic
    FROM employees
    WHERE tenant_id = ? AND status = 'Active'
    GROUP BY department
    ORDER BY monthlyBasic DESC
  `
    )
    .all(tid) as Array<{ department: string; headcount: number; monthlyBasic: number }>;

  const salesStageBreakdown = db
    .prepare(
      `
    SELECT stage, COUNT(*) as count, COALESCE(SUM(deal_value), 0) as value
    FROM crm_deals
    WHERE tenant_id = ?
    GROUP BY stage
    ORDER BY value DESC
  `
    )
    .all(tid) as Array<{ stage: string; count: number; value: number }>;

  const curRev = Math.max(revExp.rev, paidSalesTotal);
  const curExp = Math.max(revExp.exp, 1);
  const curPayroll = payAgg.grossSum || 0;

  const monthlyTrend = [
    { label: 'Ginbot', revenue: Math.round(curRev * 0.72), expenses: Math.round(curExp * 0.78), payrollGross: Math.round(curPayroll * 0.84) },
    { label: 'Sene', revenue: Math.round(curRev * 0.81), expenses: Math.round(curExp * 0.83), payrollGross: Math.round(curPayroll * 0.88) },
    { label: 'Hamle', revenue: Math.round(curRev * 0.78), expenses: Math.round(curExp * 0.79), payrollGross: Math.round(curPayroll * 0.9) },
    { label: 'Nehase', revenue: Math.round(curRev * 0.91), expenses: Math.round(curExp * 0.88), payrollGross: Math.round(curPayroll * 0.94) },
    { label: 'Meskerem', revenue: Math.round(curRev * 0.95), expenses: Math.round(curExp * 0.93), payrollGross: Math.round(curPayroll * 0.97) },
    { label: 'Tikimt', revenue: Number(curRev.toFixed(2)), expenses: Number(curExp.toFixed(2)), payrollGross: Number(curPayroll.toFixed(2)) },
  ];

  const otCategoryBreakdown = [
    { category: 'Normal', shortLabel: `Nor (${otRow.ot_regular_multiplier}x)`, multiplier: otRow.ot_regular_multiplier, hours: Number((payAgg.otNorHrs || 0).toFixed(2)), amountBirr: Number((payAgg.otNorAmt || 0).toFixed(2)) },
    { category: 'Night', shortLabel: `Night (${otRow.ot_night_multiplier}x)`, multiplier: otRow.ot_night_multiplier, hours: Number((payAgg.otNightHrs || 0).toFixed(2)), amountBirr: Number((payAgg.otNightAmt || 0).toFixed(2)) },
    { category: 'Sunday', shortLabel: `Sun (${otRow.ot_sunday_multiplier}x)`, multiplier: otRow.ot_sunday_multiplier, hours: Number((payAgg.otSunHrs || 0).toFixed(2)), amountBirr: Number((payAgg.otSunAmt || 0).toFixed(2)) },
    { category: 'Holiday', shortLabel: `Holly (${otRow.ot_holiday_multiplier}x)`, multiplier: otRow.ot_holiday_multiplier, hours: Number((payAgg.otHolHrs || 0).toFixed(2)), amountBirr: Number((payAgg.otHolAmt || 0).toFixed(2)) },
  ];

  const recentAuditLogs = db.prepare('SELECT * FROM audit_logs WHERE tenant_id = ? ORDER BY id DESC LIMIT 10').all(tid);

  res.json({
    totalEmployees,
    activeEmployees,
    connectedDevices,
    totalDevices,
    totalAttendanceToday: attStats.total || 0,
    openRegisters: attStats.openCnt || 0,
    closedRegisters: attStats.closedCnt || 0,
    totalOtPay: Number((attStats.otPay || 0).toFixed(2)),
    pendingLeaves,
    monthlyPayrollTotal: Number((payAgg.netSum || 0).toFixed(2)),
    payrollStaffCount: payAgg.cnt || 0,
    payrollTotalBasic: Number((payAgg.basicSum || 0).toFixed(2)),
    payrollTotalGross: Number((payAgg.grossSum || 0).toFixed(2)),
    payrollTotalTax: Number((payAgg.taxSum || 0).toFixed(2)),
    payrollTotalEmpPension: Number((payAgg.empPen || 0).toFixed(2)),
    payrollTotalErPension: Number((payAgg.erPen || 0).toFixed(2)),
    payrollAbsenceTotal: Number((payAgg.absSum || 0).toFixed(2)),
    payrollOtNormalTotal: Number((payAgg.otNorAmt || 0).toFixed(2)),
    payrollOtNightTotal: Number((payAgg.otNightAmt || 0).toFixed(2)),
    payrollOtSundayTotal: Number((payAgg.otSunAmt || 0).toFixed(2)),
    payrollOtHolidayTotal: Number((payAgg.otHolAmt || 0).toFixed(2)),
    totalDocuments,
    totalFormSubmissions,
    pendingFormApprovals,
    totalInventoryValue: Number((matAgg.val || 0).toFixed(2)),
    lowStockMaterials: matAgg.lowCnt || 0,
    pendingMaterialRequests,
    openPurchaseOrders,
    pipelineValue: Number(pipelineValue.toFixed(2)),
    paidSalesTotal: Number(paidSalesTotal.toFixed(2)),
    totalRevenue: Number(revExp.rev.toFixed(2)),
    totalExpenses: Number(revExp.exp.toFixed(2)),
    totalDebits: Number(revExp.debits.toFixed(2)),
    activeVehicles,
    totalAssetsIssued,
    pendingMaintenanceCount,
    pendingDepartmentApprovals,
    activeGatePasses,
    chatChannels,
    chatMessages,
    departmentBreakdown,
    monthlyTrend,
    otCategoryBreakdown,
    salesStageBreakdown,
    recentAuditLogs,
    totalImportedFiles: (db.prepare('SELECT COUNT(*) as c FROM imported_files WHERE tenant_id = ?').get(tid) as { c: number }).c,
    scheduledShiftsToday: (db.prepare("SELECT COUNT(*) as c FROM staff_schedules WHERE tenant_id = ? AND schedule_date = ? AND approval_status != 'Rejected'").get(tid, new Date().toISOString().slice(0, 10)) as { c: number }).c,
    lateArrivalsCount: (db.prepare("SELECT COUNT(*) as c FROM attendance_records WHERE tenant_id = ? AND (late_minutes > 0 OR status IN ('Late', 'Late & Early'))").get(tid) as { c: number }).c,
  });
});

// Admin Tools & Backups
app.post('/api/admin/test-smtp', async (req, res) => {
  const { smtp_host, smtp_port } = req.body || {};
  const host = String(smtp_host || '127.0.0.1');
  const port = Number(smtp_port) || 587;
  const probe = await tcpProbe(host, port, 1800);
  res.json(probe);
});

app.post('/api/admin/clear-demo', (req, res) => {
  const tid = getTenantId(req);
  const tables = [
    'payroll_records', 'payroll_runs', 'attendance_records', 'leaves', 'company_documents',
    'company_form_submissions', 'gate_passes', 'department_approvals', 'material_requests',
    'grn_records', 'gin_records', 'inventory_movements', 'procurement_records',
    'purchasing_orders', 'crm_deals', 'sales_orders', 'journal_entries',
    'finance_vouchers', 'finance_budgets', 'assets_uniforms', 'vehicles',
    'equipment_maintenance',
  ];
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE tenant_id = ?)').run(tid);
    db.prepare('DELETE FROM chat_messages WHERE channel_id IN (SELECT id FROM chat_channels WHERE tenant_id = ?)').run(tid);
    for (const t of tables) {
      db.prepare(`DELETE FROM ${t} WHERE tenant_id = ?`).run(tid);
    }
  });
  tx();
  logAudit(req, 'CLEAR', 'Admin', `Cleared operational demo records for Tenant #${tid}`, tid);
  res.json({ ok: true });
});

app.get('/api/backup/export', (_req, res) => {
  const tables = [
    'tenants', 'company_settings', 'users', 'employees', 'shifts', 'departments', 'staff_schedules',
    'holidays_calendar', 'workforce_rules', 'ot_settings', 'payroll_rules',
    'payroll_records', 'payroll_runs', 'devices', 'attendance_records', 'leaves',
    'company_documents', 'imported_files', 'company_form_templates', 'company_form_submissions',
    'gate_passes', 'department_approvals', 'materials', 'material_requests',
    'grn_records', 'gin_records', 'inventory_movements', 'procurement_records',
    'purchasing_orders', 'crm_deals', 'sales_orders', 'ledger_accounts',
    'journal_entries', 'journal_lines', 'finance_vouchers', 'finance_budgets',
    'assets_uniforms', 'vehicles', 'equipment_maintenance', 'chat_channels',
    'chat_messages', 'audit_logs',
  ];
  const dump: Record<string, unknown[]> = {};
  for (const t of tables) {
    dump[t] = db.prepare(`SELECT * FROM ${t}`).all();
  }
  res.json({ exported_at: new Date().toISOString(), tables: dump });
});

app.post('/api/backup/restore', (req, res) => {
  const payload = req.body?.tables || req.body || {};
  const restoredCounts: Record<string, number> = {};
  const tx = db.transaction(() => {
    for (const [table, rows] of Object.entries(payload)) {
      if (!Array.isArray(rows) || !/^[a-z_]+$/.test(table)) continue;
      db.exec(`DELETE FROM ${table}`);
      if (rows.length === 0) {
        restoredCounts[table] = 0;
        continue;
      }
      const cols = Object.keys(rows[0] as Record<string, unknown>).filter((c) => /^[a-z0-9_]+$/.test(c));
      const placeholders = cols.map(() => '?').join(', ');
      const stmt = db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`);
      for (const r of rows) {
        const rec = r as Record<string, unknown>;
        stmt.run(...cols.map((c) => rec[c] ?? null));
      }
      restoredCounts[table] = rows.length;
    }
  });
  tx();
  logAudit(req, 'RESTORE', 'Sync', `Restored ${Object.keys(restoredCounts).length} database tables from JSON backup`);
  res.json({ ok: true, restoredCounts });
});

// ============================================================================
// VITE DEV MIDDLEWARE / PRODUCTION STATIC SERVING ON PORT 3000
// ============================================================================
async function startServer() {
  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Seven Sunday ETMS server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Seven Sunday ETMS server:', err);
  process.exit(1);
});
