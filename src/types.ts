import type { AppLang } from './utils/ethiopianCalendar';

export type UserRole =
  | 'System Administrator'
  | 'Super Administrator'
  | 'Company Owner'
  | 'General Manager'
  | 'Department Manager'
  | 'Human Resource Manager'
  | 'Finance Manager'
  | 'Accountant'
  | 'Inventory Manager'
  | 'Warehouse Manager'
  | 'Procurement Officer'
  | 'Sales Manager'
  | 'Security Supervisor'
  | 'Attendance Officer'
  | 'Security Guard'
  | 'Employee'
  | 'Auditor'
  | 'Viewer';

export type ModuleKey =
  | 'dashboard'
  | 'approvals'
  | 'admin'
  | 'hr'
  | 'devices'
  | 'attendance'
  | 'scheduling'
  | 'leave'
  | 'salary'
  | 'payroll'
  | 'secretary'
  | 'company-forms'
  | 'gate-pass'
  | 'materials'
  | 'material-requests'
  | 'grn'
  | 'gin'
  | 'procurement'
  | 'purchasing'
  | 'sales-crm'
  | 'finance'
  | 'assets'
  | 'vehicles'
  | 'reports'
  | 'chat'
  | 'audit'
  | 'sync';

export interface PlatformConfig {
  platform_title: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  login_notice: string;
  standard_monthly_hours: number;
  enable_multi_language: boolean;
  enable_multi_tenant: boolean;
  enable_gate_pass_qr: boolean;
  disabled_modules: ModuleKey[];
  custom_module_labels: Partial<Record<ModuleKey, string>>;
  custom_module_titles: Partial<Record<ModuleKey, string>>;
  custom_approving_departments: string[];
  share_channels: string[];
}

export interface TenantRecord {
  id: number;
  tenant_code: string;
  name: string;
  brand_name: string;
  slogan: string;
  secondary_slogan: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  tin_number: string;
  default_currency: 'ETB' | 'USD' | 'EUR' | 'CNY';
  calendar_mode: 'Gregorian' | 'Ethiopian';
  default_language: AppLang;
  branches: string;
  departments: string;
  plan: string;
  status: 'Active' | 'Suspended';
  platform_config?: string;
  created_at: string;
  updated_at: string;
  employee_count?: number;
  device_count?: number;
  pending_approvals?: number;
}

export interface UserAccount {
  id: number;
  tenant_id?: number;
  employee_code: string;
  full_name: string;
  email: string;
  password?: string;
  department: string;
  job_title: string;
  role: UserRole;
  status: 'Active' | 'Suspended';
  mfa_enabled?: number | boolean;
  preferred_language?: string;
  failed_login_attempts?: number;
  locked_until?: string | null;
  last_login: string | null;
  last_login_at?: string | null;
  created_at: string;
}

export interface CompanySettings {
  id: number;
  tenant_id?: number;
  company_name: string;
  brand_name: string;
  slogan: string;
  secondary_slogan: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  tin_number: string;
  default_currency: 'ETB' | 'USD' | 'EUR' | 'CNY';
  calendar_mode: 'Gregorian' | 'Ethiopian';
  default_language: AppLang;
  branches: string;
  departments: string;
  logo_data: string;
  stamp_data: string;
  signature_data: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
  smtp_secure: number;
  rbac_matrix: string;
  platform_config?: string;
  updated_at: string;
}

export interface GlobalSearchResult {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  module: ModuleKey;
}

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'critical';
  module: ModuleKey;
  created_at: string;
}

export interface AuditLogRecord {
  id: number;
  actor_name: string;
  actor_role: string;
  action: string;
  module: string;
  summary: string;
  created_at: string;
}

export interface EmployeeProfile {
  id: number;
  employee_id: string;
  full_name: string;
  gender: string;
  dob: string;
  phone: string;
  email: string;
  address: string;
  national_id: string;
  emergency_contact: string;
  emergency_contact_phone: string;
  department: string;
  job_title: string;
  employment_type: 'Permanent' | 'Contract' | 'Temporary' | 'Intern';
  start_date: string;
  contract_expiry: string;
  basic_salary: number;
  bank_account: string;
  education: string;
  experience: string;
  photo_data: string;
  education_doc_name: string;
  education_doc_data: string;
  status: 'Active' | 'On Leave' | 'Suspended' | 'Terminated';
  created_at: string;
}

export interface PayrollRecord {
  id: number;
  payroll_month: string;
  month_label?: string;
  payroll_category?: string;
  employee_code: string;
  employee_name: string;
  bank_account?: string;
  id_no?: string;
  department: string;
  basic_salary: number;
  standard_hours: number;
  hourly_rate: number;
  absence_hours: number;
  absence_rate: number;
  absence_amount: number;
  ot_normal_hours: number;
  ot_night_hours: number;
  ot_sunday_hours: number;
  ot_holiday_hours: number;
  ot_normal_amount: number;
  ot_night_amount: number;
  ot_sunday_amount: number;
  ot_holiday_amount: number;
  allowances: number;
  overtime_pay: number;
  bonuses: number;
  deductions: number;
  income_tax: number;
  employee_pension: number;
  employer_pension: number;
  gross_salary: number;
  net_salary: number;
  status: 'Draft' | 'Approved' | 'Paid';
  created_at: string;
}

export interface PayrollRun {
  id: number;
  run_code: string;
  payroll_month: string;
  employee_count: number;
  total_gross: number;
  total_bonus: number;
  total_tax: number;
  total_pension: number;
  total_net: number;
  status: 'Completed' | 'Approved' | 'Paid';
  created_by: string;
  created_at: string;
}

export interface TaxBracket {
  min: number;
  max: number | null;
  rate: number;
  deduction: number;
}

export interface PayrollRules {
  id: number;
  employee_pension_rate: number;
  employer_pension_rate: number;
  default_bonus_rate: number;
  brackets_json: string;
  updated_at: string;
}

export interface OtSettings {
  id: number;
  ot_regular_multiplier: number;
  ot_night_multiplier: number;
  ot_sunday_multiplier: number;
  ot_holiday_multiplier: number;
  updated_at: string;
}

export interface DeviceRecord {
  id: number;
  tenant_id?: number;
  device_type: string;
  model?: string;
  protocol?: string;
  device_name: string;
  ip_address: string;
  port: number;
  endpoint_url?: string;
  subnet_mask: string;
  gateway: string;
  serial_number: string;
  api_key?: string;
  comm_password?: string;
  has_comm_password?: boolean;
  sync_interval_sec?: number;
  auto_sync_enabled?: number | boolean;
  read_only_mode?: number | boolean;
  latency_threshold_ms?: number;
  timezone?: string;
  status: 'Disconnected' | 'Connected' | 'Unreachable';
  last_latency_ms: number | null;
  last_message: string;
  last_error?: string;
  last_checked_at: string | null;
  last_sync_at?: string | null;
  punch_count?: number;
  total_imported_count?: number;
  failed_sync_count?: number;
  k40_user_count?: number | null;
  k40_fp_count?: number | null;
  k40_attlog_count?: number | null;
  k40_device_time?: string | null;
}

export interface DeviceTelemetryDailyPoint {
  date: string;
  label: string;
  checks_count: number;
  online_count: number;
  downtime_count: number;
  avg_latency_ms: number | null;
  max_latency_ms: number | null;
  min_latency_ms: number | null;
  uptime_pct: number | null;
  exceeded_count: number;
  exceeds_threshold: boolean;
}

export interface DeviceTelemetryCheck {
  id: number;
  device_id: number;
  status: 'Online' | 'Offline';
  latency_ms: number;
  threshold_ms: number;
  exceeded_threshold: boolean;
  source: string;
  error_message: string;
  checked_at: string;
}

export interface DeviceTelemetryExceededPeriod {
  date: string;
  label: string;
  peak_latency_ms: number;
  avg_latency_ms: number | null;
  exceeded_count: number;
  downtime_count: number;
  threshold_ms: number;
  over_by_ms: number;
}

export interface DeviceTelemetryResponse {
  device: DeviceRecord;
  days: number;
  threshold_ms: number;
  summary: {
    total_checks: number;
    online_checks: number;
    downtime_events: number;
    avg_latency_ms: number | null;
    peak_latency_ms: number | null;
    min_latency_ms: number | null;
    uptime_pct: number | null;
    threshold_breach_count: number;
    exceeded_days_count: number;
  };
  daily: DeviceTelemetryDailyPoint[];
  recent_checks: DeviceTelemetryCheck[];
  exceeded_periods: DeviceTelemetryExceededPeriod[];
}

export interface DeviceSyncLogRecord {
  id: number;
  tenant_id: number;
  device_id: number;
  device_name: string;
  sync_source: string;
  triggered_by: string;
  status: 'Success' | 'Failed' | 'No New Logs';
  total_fetched: number;
  imported_count: number;
  skipped_duplicates: number;
  unmatched_count: number;
  k40_fp_count?: number | null;
  latency_ms: number;
  error_message: string;
  started_at: string;
  finished_at: string;
}

export interface UnmatchedDeviceUserRecord {
  id: number;
  tenant_id: number;
  device_id: number;
  device_name: string;
  device_serial: string;
  device_user_id: string;
  device_user_name: string;
  first_seen_at: string;
  last_seen_at: string;
  sample_punch_at: string;
  punch_count: number;
  status: 'Pending' | 'Mapped' | 'Ignored';
  mapped_employee_id: string;
  mapped_by: string;
  mapped_at: string | null;
}

export interface DeviceScanResult {
  ip_address: string;
  port: number;
  latencyMs: number;
  suggested_type: string;
  message: string;
}

export interface BiometricAuthLogRecord {
  id: number;
  tenant_id: number;
  device_id: number | null;
  device_identifier: string;
  device_name: string;
  auth_source: string;
  auth_method: string;
  employee_code: string;
  employee_name: string;
  department: string;
  punch_type: 'Check-In' | 'Check-Out' | string;
  status: 'Success' | 'Failure';
  failure_reason: string;
  attendance_record_id: number | null;
  attendance_marked: number | boolean;
  verified_at: string;
  created_at: string;
}

export interface AttendanceRecord {
  id: number;
  tenant_id?: number;
  employee_code: string;
  employee_name: string;
  department: string;
  attendance_date: string;
  shift_id?: number | null;
  shift_name: string;
  shift_period?: 'Morning' | 'Afternoon' | 'Night' | 'Day' | 'Weekend' | 'Holiday' | 'Security' | 'Special' | 'Overtime';
  check_in: string;
  check_out: string;
  morning_check_in?: string;
  morning_check_out?: string;
  afternoon_check_in?: string;
  afternoon_check_out?: string;
  night_check_in?: string;
  night_check_out?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  hourly_rate: number;
  regular_hours: number;
  late_minutes?: number;
  early_departure_minutes?: number;
  break_minutes?: number;
  absence_hours?: number;
  ot_type: 'None' | 'Regular' | 'Night' | 'Sunday' | 'Holiday';
  ot_hours: number;
  ot_multiplier: number;
  ot_pay: number;
  ot_approval_status?: 'Pending' | 'Approved' | 'Rejected';
  ot_approved_by?: string;
  ot_approved_at?: string;
  ot_adjustment_reason?: string;
  device_id?: number | null;
  device_tx_id?: string;
  machine_timestamp?: string;
  received_timestamp?: string;
  verification_method?: string;
  sync_status?: string;
  status: 'Present' | 'Late' | 'Early Exit' | 'Late & Early' | 'Half-Day' | 'Absent' | 'On Leave';
  register_state: 'Open' | 'Closed';
  notes: string;
  updated_by?: string;
  updated_at?: string;
  created_at: string;
}

export interface AttendanceAuditLogRecord {
  id: number;
  tenant_id: number;
  attendance_record_id: number;
  action: string;
  actor_name: string;
  actor_role: string;
  previous_ot_hours: number;
  new_ot_hours: number;
  previous_status: string;
  new_status: string;
  reason: string;
  created_at: string;
}

export interface LiveAttendanceDashboardData {
  date: string;
  timezone: string;
  total_employees: number;
  present_today: number;
  absent_today: number;
  late_today: number;
  checked_in_count: number;
  checked_out_count: number;
  pending_ot_approvals: number;
  first_check_in: string;
  last_check_out: string;
  total_records_today: number;
  k40_devices: Array<Partial<DeviceRecord>>;
  k40_connected_count: number;
  k40_total_count: number;
  k40_status: 'Online' | 'Offline' | 'Not Configured';
  last_sync_at: string;
  pending_unmatched_count: number;
  recent_records: AttendanceRecord[];
}

export interface LeaveRecord {
  id: number;
  employee_code: string;
  employee_name: string;
  department: string;
  leave_type: 'Annual' | 'Sick' | 'Maternity' | 'Paternity' | 'Emergency' | 'Unpaid';
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approved_by: string | null;
  created_at: string;
}

export interface CompanyDocument {
  id: number;
  doc_number: string;
  title: string;
  category: string;
  department: string;
  issued_by: string;
  issue_date: string;
  confidentiality: 'Public' | 'Internal' | 'Confidential';
  status: 'Draft' | 'Issued' | 'Archived';
  language: AppLang;
  content: string;
  translated_content: string;
  created_at: string;
}

export interface CompanyFormTemplateOverride {
  id: number;
  form_code: string;
  custom_title: string;
  department_key: string;
  subtitle: string;
  fields_json: string;
  columns_json: string;
  default_notes: string;
  updated_at: string;
}

export interface CompanyFormSubmission {
  id: number;
  submission_number: string;
  form_code: string;
  form_title: string;
  department_key: string;
  department_name: string;
  employee_code: string;
  employee_name: string;
  submission_date: string;
  reference_no: string;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Archived';
  form_data_json: string;
  prepared_by: string;
  checked_by: string;
  approved_by: string;
  created_at: string;
  updated_at: string;
}

export interface MaterialItem {
  id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  stock_qty: number;
  reorder_level: number;
  unit_cost: number;
  location: string;
  updated_at: string;
}

export interface MaterialRequestItem {
  id: number;
  request_number: string;
  requested_by: string;
  department: string;
  material_id: number | null;
  material_name: string;
  quantity: number;
  unit: string;
  urgency: 'Low' | 'Standard' | 'Urgent';
  needed_by: string;
  notes: string;
  status: 'Pending' | 'Approved' | 'Issued' | 'Rejected';
  created_at: string;
}

export interface GrnRecord {
  id: number;
  grn_number: string;
  po_reference: string;
  supplier_name: string;
  material_id: number | null;
  material_name: string;
  quantity_received: number;
  unit_cost: number;
  received_date: string;
  inspected_by: string;
  condition_status: 'Accepted' | 'Partial' | 'Damaged';
  warehouse?: string;
  notes: string;
  created_at: string;
}

export interface GinAuditRecord {
  id: number;
  gin_number: string;
  issued_to_department: string;
  issued_to_person: string;
  material_id: number | null;
  material_name: string;
  quantity_issued: number;
  issue_date: string;
  authorized_by: string;
  audit_status: 'Pending Audit' | 'Verified' | 'Variance Flagged';
  audit_variance: number;
  audit_notes: string;
  created_at: string;
}

export interface InventoryMovementRecord {
  id: number;
  movement_number: string;
  movement_type: 'Transfer' | 'Return' | 'Damage' | 'Audit' | 'Adjustment';
  material_id: number | null;
  material_name: string;
  quantity: number;
  source_location: string;
  destination_location: string;
  reason: string;
  variance_qty: number;
  movement_date: string;
  recorded_by: string;
  status: string;
  created_at: string;
}

export interface ProcurementRecord {
  id: number;
  rfq_number: string;
  title: string;
  department: string;
  material_name: string;
  quantity: number;
  estimated_budget: number;
  vendor_candidates: string;
  selected_vendor: string;
  bid_amount: number;
  due_date: string;
  status: 'Open' | 'Evaluating' | 'Awarded' | 'Closed';
  created_at: string;
}

export interface PurchasingOrder {
  id: number;
  po_number: string;
  vendor_name: string;
  material_id: number | null;
  material_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  order_date: string;
  expected_date: string;
  status: 'Ordered' | 'Partially Received' | 'Received' | 'Cancelled';
  notes: string;
  created_at: string;
}

export interface CrmDeal {
  id: number;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  stage: 'Lead' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Closed Won' | 'Closed Lost';
  deal_value: number;
  assigned_rep: string;
  last_contact: string;
  notes: string;
  created_at: string;
}

export interface SalesOrder {
  id: number;
  order_number: string;
  customer_name: string;
  product_service: string;
  quantity: number;
  amount: number;
  order_date: string;
  payment_status: 'Pending' | 'Paid' | 'Overdue';
  created_at: string;
}

export interface LedgerAccount {
  id: number;
  code: string;
  name: string;
  account_type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  debit_total: number;
  credit_total: number;
  balance: number;
}

export interface JournalLine {
  id?: number;
  entry_id?: number;
  account_id: number;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  memo: string;
}

export interface JournalEntry {
  id: number;
  entry_number: string;
  entry_date: string;
  reference: string;
  description: string;
  total_debit: number;
  total_credit: number;
  created_by: string;
  lines: JournalLine[];
  created_at: string;
}

export interface FinanceVoucher {
  id: number;
  voucher_number: string;
  voucher_type: 'Cash Payment' | 'Cash Receipt' | 'Bank Payment' | 'Bank Receipt';
  voucher_date: string;
  party_name: string;
  payment_method: string;
  bank_reference: string;
  debit_account_id: number;
  debit_account_name: string;
  credit_account_id: number;
  credit_account_name: string;
  amount: number;
  description: string;
  created_by: string;
  created_at: string;
}

export interface FinanceBudget {
  id: number;
  fiscal_year: string;
  department: string;
  account_id: number;
  account_code: string;
  account_name: string;
  allocated_amount: number;
  notes: string;
  created_at: string;
}

export interface AssetUniformRecord {
  id: number;
  item_code?: string;
  item_name: string;
  category: string;
  employee_id: string;
  employee_name: string;
  quantity: number;
  condition: 'New' | 'Good' | 'Fair' | 'Worn' | 'Damaged';
  date_issued: string;
  expected_return: string;
  status: 'Issued' | 'Returned' | 'Damaged' | 'Lost';
  notes: string;
  created_at: string;
}

export interface VehicleRecord {
  id: number;
  plate_number: string;
  vehicle_model: string;
  driver_name: string;
  department: string;
  mileage_km: number;
  fuel_cost: number;
  maintenance_cost: number;
  insurance_expiry: string;
  inspection_date: string;
  status: 'Active' | 'In Maintenance' | 'Grounded';
  notes: string;
  created_at: string;
}

export interface EquipmentMaintenanceRecord {
  id: number;
  equipment_code: string;
  equipment_name: string;
  category: string;
  serial_number: string;
  location: string;
  maintenance_type: 'Preventive' | 'Corrective' | 'Calibration' | 'Emergency';
  technician_name: string;
  maintenance_date: string;
  next_service_due: string;
  cost: number;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Out of Service';
  notes: string;
  created_at: string;
}

export interface ChatChannel {
  id: number;
  name: string;
  department: string;
  description: string;
  is_default?: number | boolean;
  message_count?: number;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  channel_id: number;
  sender_name: string;
  sender_role: string;
  content: string;
  attachment_name: string | null;
  created_at: string;
}

export interface DashboardMonthlyPoint {
  label: string;
  revenue: number;
  expenses: number;
  payrollGross: number;
}

export interface DashboardOtCategoryPoint {
  category: 'Normal' | 'Night' | 'Sunday' | 'Holiday';
  shortLabel: string;
  multiplier: number;
  hours: number;
  amountBirr: number;
}

export interface DashboardSalesStagePoint {
  stage: string;
  count: number;
  value: number;
}

export interface DashboardSummary {
  totalEmployees: number;
  activeEmployees: number;
  connectedDevices: number;
  totalDevices: number;
  totalAttendanceToday: number;
  openRegisters: number;
  closedRegisters: number;
  totalOtPay: number;
  pendingLeaves: number;
  monthlyPayrollTotal: number;
  payrollStaffCount: number;
  payrollTotalBasic: number;
  payrollTotalGross: number;
  payrollTotalTax: number;
  payrollTotalEmpPension: number;
  payrollTotalErPension: number;
  payrollAbsenceTotal: number;
  payrollOtNormalTotal: number;
  payrollOtNightTotal: number;
  payrollOtSundayTotal: number;
  payrollOtHolidayTotal: number;
  totalDocuments: number;
  totalFormSubmissions: number;
  pendingFormApprovals: number;
  totalInventoryValue: number;
  lowStockMaterials: number;
  pendingMaterialRequests: number;
  openPurchaseOrders: number;
  pipelineValue: number;
  paidSalesTotal: number;
  totalRevenue: number;
  totalExpenses: number;
  totalDebits: number;
  activeVehicles: number;
  totalAssetsIssued: number;
  pendingMaintenanceCount: number;
  pendingDepartmentApprovals?: number;
  activeGatePasses?: number;
  chatChannels: number;
  chatMessages: number;
  departmentBreakdown: Array<{ department: string; headcount: number; monthlyBasic: number }>;
  monthlyTrend: DashboardMonthlyPoint[];
  otCategoryBreakdown: DashboardOtCategoryPoint[];
  salesStageBreakdown: DashboardSalesStagePoint[];
  recentAuditLogs: AuditLogRecord[];
  totalImportedFiles?: number;
  scheduledShiftsToday?: number;
  lateArrivalsCount?: number;
}

export interface GatePassRecord {
  id: number;
  pass_number: string;
  pass_token: string;
  pass_type: 'Staff Exit' | 'Visitor' | 'Material Exit' | 'Vehicle Gate Pass';
  person_name: string;
  employee_code: string;
  department: string;
  destination: string;
  purpose: string;
  items_description: string;
  vehicle_plate: string;
  valid_date: string;
  issued_by: string;
  approved_department: string;
  status: 'Active' | 'Used' | 'Cancelled';
  used_at: string | null;
  verified_by_guard: string;
  created_at: string;
}

export interface DepartmentApprovalRecord {
  id: number;
  request_code: string;
  source_module: ModuleKey;
  record_ref: string;
  title: string;
  summary: string;
  from_department: string;
  target_department: string;
  requested_by: string;
  priority: 'Normal' | 'Urgent';
  notes: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  decision_by: string | null;
  decision_notes: string;
  decision_at: string | null;
  created_at: string;
}

export interface ImportedFileRecord {
  id: number;
  tenant_id?: number;
  file_code: string;
  title: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  category: string;
  department: string;
  target_module: string;
  extracted_text: string;
  file_data: string;
  uploaded_by: string;
  notes: string;
  created_at: string;
}

export type ShiftCategory =
  | 'Day Shift'
  | 'Morning Shift'
  | 'Afternoon Shift'
  | 'Night Shift'
  | 'Weekend Shift'
  | 'Holiday Shift'
  | 'Security Guard Shift'
  | 'Special Duty Shift'
  | 'Overtime Shift';

export interface ShiftDefinition {
  id: number;
  tenant_id?: number;
  shift_code: string;
  shift_name: string;
  shift_category: ShiftCategory;
  scheduling_system: '3-Shift' | '4-Shift' | 'Standard' | 'Security 24/7';
  start_time: string;
  end_time: string;
  in_earliest?: string;
  in_latest?: string;
  out_earliest?: string;
  out_latest?: string;
  ot_start_time?: string;
  ot_end_time?: string;
  require_ot_approval?: number | boolean;
  assigned_department?: string;
  is_enabled?: number | boolean;
  break_minutes: number;
  working_days: string; // JSON array string e.g. ["Mon","Tue","Wed","Thu","Fri"]
  rest_days: string; // JSON array string
  min_rest_hours: number;
  is_rotating: number | boolean;
  rotation_pattern: string;
  color_hex: string;
  ot_multiplier: number;
  grace_late_minutes: number;
  status: 'Active' | 'Inactive';
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface DepartmentRecord {
  id: number;
  tenant_id?: number;
  dept_code: string;
  name: string;
  manager_employee_id: string;
  manager_name: string;
  scheduling_system: '3-Shift' | '4-Shift' | 'Standard' | 'Security 24/7';
  default_shift_id: number | null;
  working_days: string; // JSON array string
  rest_days: string; // JSON array string
  weekend_schedule_enabled: number | boolean;
  holiday_schedule_enabled: number | boolean;
  security_guard_coverage: string;
  monthly_timetable_notes: string;
  status: 'Active' | 'Inactive';
  created_at: string;
  updated_at: string;
}

export interface StaffScheduleRecord {
  id: number;
  tenant_id?: number;
  schedule_code: string;
  employee_id: string;
  employee_name: string;
  department: string;
  shift_id: number | null;
  shift_name: string;
  shift_category: ShiftCategory | string;
  schedule_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  schedule_type: 'Regular' | 'Weekend' | 'Holiday' | 'Security Guard' | 'Special Duty' | 'Overtime' | 'Rotating';
  rotation_group: string;
  availability_status: 'Available' | 'Assigned' | 'On Leave' | 'Rest Day' | 'Replaced';
  replacement_employee_id: string;
  replacement_employee_name: string;
  change_reason: string;
  approval_status: 'Draft' | 'Pending' | 'Approved' | 'Rejected';
  approved_by: string;
  created_by: string;
  updated_by: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface HolidayRecord {
  id: number;
  tenant_id?: number;
  holiday_date: string;
  name: string;
  is_paid: number | boolean;
  ot_multiplier: number;
  notes: string;
  created_at: string;
}

export interface WorkforceRules {
  id?: number;
  tenant_id?: number;
  late_grace_minutes: number;
  early_departure_grace_minutes: number;
  default_break_minutes: number;
  min_rest_hours_between_shifts: number;
  auto_detect_conflicts: number | boolean;
  require_manager_approval: number | boolean;
  default_shift_system: '3-Shift' | '4-Shift';
  updated_at?: string;
}

export interface ScheduleConflictReport {
  hasConflict: boolean;
  overlaps: Array<{ id: number; schedule_code: string; schedule_date: string; shift_name: string; start_time: string; end_time: string }>;
  restViolations: Array<{ id: number; schedule_code: string; schedule_date: string; shift_name: string; restHours: number; requiredHours: number }>;
  leaveConflicts: Array<{ id: number; leave_type: string; start_date: string; end_date: string; status: string }>;
}

export interface SalaryRecord {
  id: number;
  tenant_id?: number;
  salary_code: string;
  employee_id: string;
  employee_name: string;
  department: string;
  job_title: string;
  salary_grade: string;
  previous_salary: number;
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  position_allowance: number;
  other_allowance: number;
  gross_salary: number;
  income_tax: number;
  employee_pension: number;
  employer_pension: number;
  net_salary: number;
  bank_account: string;
  effective_date: string;
  adjustment_type: 'Initial Salary' | 'Annual Increment' | 'Promotion' | 'Contract Adjustment' | 'Allowance Update';
  status: 'Pending' | 'Approved' | 'Applied';
  approved_by: string | null;
  notes: string;
  created_by: string;
  created_at: string;
}

export interface BiometricCredential {
  id: number;
  user_id: number;
  email: string;
  credential_id: string;
  device_label: string;
  auth_type: 'Fingerprint / Face ID' | 'Platform Passkey' | 'Hardware Key';
  created_at: string;
  last_used_at: string | null;
}

export interface AuthSessionResponse {
  user?: UserAccount;
  token?: string;
  auth_method?: 'password' | 'register' | 'google' | 'biometric' | 'mfa';
  encrypted_sync_key?: string;
  mfa_required?: boolean;
  mfa_challenge_token?: string;
  email?: string;
}

export interface ActiveSessionRecord {
  id: number;
  user_id: number;
  tenant_id: number;
  auth_method: string;
  user_agent: string;
  ip_address: string;
  last_active_at: string;
  expires_at: string;
  created_at: string;
  is_current?: boolean;
  user_name?: string;
  user_email?: string;
  user_role?: string;
}

export interface NotificationLogRecord {
  id: number;
  tenant_id: number;
  event_type: string;
  channel: 'In-App' | 'Email' | 'Telegram' | 'Webhook' | string;
  recipient: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  module: string;
  status: 'Delivered' | 'Failed' | 'Pending' | 'Logged (Client Action)';
  error_message: string;
  retry_count: number;
  created_at: string;
  delivered_at: string | null;
}

export interface NotificationChannelConfig {
  tenant_id: number;
  email_enabled: number | boolean;
  telegram_enabled: number | boolean;
  telegram_bot_token: string;
  telegram_chat_id: string;
  whatsapp_webhook_url: string;
  webhook_enabled: number | boolean;
  notify_on_events_json: string;
  updated_at: string;
}

export interface BackupSnapshotFile {
  filename: string;
  size_bytes: number;
  created_at: string;
  kind: 'auto' | 'manual';
}

export interface RbacActionPermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  export: boolean;
  manage: boolean;
}

export interface StaffFingerprintRecord {
  id: number;
  tenant_id: number;
  employee_id: string;
  employee_name: string;
  department: string;
  zk_user_pin: string;
  finger_index: number;
  finger_label: string;
  template_hash: string;
  template_size: number;
  device_id: number | null;
  device_serial: string;
  auth_source?: string;
  credential_id?: string;
  enrolled_by: string;
  status: 'Active' | 'Revoked';
  last_scanned_at: string | null;
  created_at: string;
}

export interface ZkEnrollJobRecord {
  id: number;
  tenant_id: number;
  device_id: number | null;
  device_serial: string;
  employee_id: string;
  employee_name: string;
  zk_user_pin: string;
  finger_index: number;
  finger_label: string;
  channel: 'TCP4370' | 'ADMS' | 'BRIDGE' | string;
  adms_cmd_id: string;
  status: 'Pending' | 'WaitingFinger' | 'Enrolled' | 'Failed' | 'Cancelled';
  status_message: string;
  created_at: string;
  completed_at: string | null;
}

export interface ZkRealtimeListenerStatus {
  device_id: number;
  device_name: string;
  ip_address: string;
  port: number;
  serial_number: string;
  running: boolean;
  started_at: string;
  last_event_at: string | null;
  events_count: number;
}

export interface CompanyDeviceSecurityStatus {
  policy_enabled: boolean;
  has_users?: boolean;
  requires_first_admin_setup?: boolean;
  policy_configured?: boolean;
  device_uid: string;
  device_registered: boolean;
  device_verified: boolean;
  device_status: 'Active' | 'Suspended' | 'Unregistered';
  device_name: string;
  company_code_hint: string;
  configured_by: string;
  configured_at: string | null;
  total_registered_devices: number;
}

export interface AuthorizedCompanyDeviceRecord {
  id: number;
  tenant_id: number;
  device_uid: string;
  device_name: string;
  device_os: string;
  assigned_branch: string;
  assigned_to_email: string;
  status: 'Active' | 'Suspended';
  verified_at: string | null;
  registered_by: string;
  last_seen_at: string | null;
  created_at: string;
}

export interface I18nTranslationEntry {
  id: number;
  lang_code: string;
  translation_key: string;
  value_text: string;
  is_approved: number | boolean;
  source: string;
  updated_by: string;
  updated_at: string;
}

export interface I18nConfigResponse {
  default_language: string;
  enabled_languages: string[];
  rtl_auto: boolean;
  user_preferred_language: string;
  requested_language: string;
  translations: Record<string, string>;
  coverage_counts: Array<{ lang_code: string; count: number }>;
}

