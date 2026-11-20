export interface StaffEvaluationRow {
  criterion: string;
  weight: number;
  rating: number;
  comments: string;
}

export interface CompanyFormFieldDef {
  key: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'select' | 'textarea';
  placeholder?: string;
  defaultValue?: string;
  options?: string[];
}

export interface CompanyFormDef {
  no: number;
  code: string;
  name: string;
  departmentKey: string;
  departmentName: string;
  fields: CompanyFormFieldDef[];
  defaultColumns: string[];
  isEvaluation?: boolean;
}

export interface DepartmentFormsGroup {
  key: string;
  name: string;
  shortName: string;
  prefix: string;
  count: number;
  forms: CompanyFormDef[];
}

export const COMPANY_FORM_DEPARTMENTS: DepartmentFormsGroup[] = [
  { key: 'hr', name: 'Human Resources & Administration', shortName: 'HR & Admin', prefix: 'SS-HR', count: 22, forms: [] },
  { key: 'finance', name: 'Finance, Accounting & Treasury', shortName: 'Finance', prefix: 'SS-FIN', count: 22, forms: [] },
  { key: 'inventory', name: 'Inventory & Warehouse Store', shortName: 'Inventory', prefix: 'SS-INV', count: 22, forms: [] },
  { key: 'procurement', name: 'Procurement & Purchasing', shortName: 'Procurement', prefix: 'SS-PRO', count: 18, forms: [] },
  { key: 'production', name: 'Factory Production & Operations', shortName: 'Production', prefix: 'SS-PRD', count: 24, forms: [] },
  { key: 'sales', name: 'Sales, CRM & Dispatch', shortName: 'Sales & CRM', prefix: 'SS-SAL', count: 18, forms: [] },
  { key: 'secretary', name: 'Corporate Secretary & Records', shortName: 'Secretary', prefix: 'SS-SEC', count: 18, forms: [] },
  { key: 'fleet', name: 'Fleet, Transport & Logistics', shortName: 'Fleet', prefix: 'SS-FLT', count: 18, forms: [] },
  { key: 'quality', name: 'Quality Assurance & Lab QC', shortName: 'Quality QA', prefix: 'SS-QA', count: 18, forms: [] },
  { key: 'hse', name: 'Health, Safety & Environment (HSE)', shortName: 'HSE Safety', prefix: 'SS-HSE', count: 18, forms: [] },
  { key: 'maintenance', name: 'Plant Engineering & Maintenance', shortName: 'Maintenance', prefix: 'SS-MNT', count: 18, forms: [] },
  { key: 'it', name: 'IT, Devices & Access Control', shortName: 'IT & Devices', prefix: 'SS-IT', count: 18, forms: [] },
  { key: 'audit', name: 'Internal Audit & Compliance', shortName: 'Internal Audit', prefix: 'SS-AUD', count: 18, forms: [] },
  { key: 'legal', name: 'Legal & Regulatory Affairs', shortName: 'Legal', prefix: 'SS-LEG', count: 16, forms: [] },
  { key: 'customer-care', name: 'Customer Care & After-Sales', shortName: 'Customer Care', prefix: 'SS-CSR', count: 17, forms: [] },
  { key: 'management', name: 'Executive Management & Strategy', shortName: 'Management', prefix: 'SS-MGT', count: 20, forms: [] },
  { key: 'attendance-shifts', name: 'Attendance, Shifts & Duty Forms', shortName: 'Attendance & Shifts', prefix: 'SS-ATT', count: 11, forms: [] },
];

export const DEFAULT_STAFF_EVALUATION_CRITERIA: StaffEvaluationRow[] = [
  { criterion: 'Job Knowledge & Technical Execution', weight: 25, rating: 4, comments: 'Consistent technical accuracy' },
  { criterion: 'Punctuality, Shift Discipline & Attendance', weight: 15, rating: 4, comments: 'Reliable attendance record' },
  { criterion: 'Quality Output & Zero-Defect Compliance', weight: 20, rating: 4, comments: 'Meets ISO & QA standards' },
  { criterion: 'Teamwork, Communication & Attitude', weight: 15, rating: 5, comments: 'Collaborative across departments' },
  { criterion: 'Safety (PPE), Asset Care & Accountability', weight: 15, rating: 4, comments: 'Follows HSE procedures' },
  { criterion: 'Initiative & Continuous Improvement', weight: 10, rating: 4, comments: 'Proactive problem solving' },
];

const FORM_TITLES_BY_DEPT: Record<string, string[]> = {
  hr: [
    'Staff Onboarding Registration Form',
    'Employment Contract Agreement Sheet',
    'New Hire Orientation Checklist',
    'Probation Period Appraisal Form',
    'Annual Leave Request & Clearance',
    'Sick & Medical Leave Authorization',
    'Overtime Authorization Request (OT)',
    'Shift Change & Roster Assignment',
    'Staff Disciplinary Warning Form',
    'Employee Transfer & Promotion Form',
    'Staff Clearance & Exit Checklist',
    'Emergency Contact & Beneficiary Update',
    'Salary Advance & Loan Request',
    'Payroll Adjustment & Deduction Slip',
    'Training & Capacity Building Nomination',
    'Uniform & PPE Issuance Receipt',
    'Biometric Enrollment Request',
    'Annual Staff Performance Evaluation Rubric',
    'Intern & Apprentice Engagement Form',
    'Grievance & Workplace Feedback Form',
    'Medical Reimbursement Claim Form',
    'Staff Identity Card Reissue Form',
  ],
  finance: [
    'Cash Payment Voucher (CPV)',
    'Cash Receipt Voucher (CRV)',
    'Bank Payment Authorization Form',
    'Bank Reconciliation Statement Sheet',
    'Petty Cash Replenishment Claim',
    'Travel & Per Diem Expense Claim',
    'Supplier Invoice Verification Slip',
    'Tax Withholding Certificate (2%)',
    'Monthly VAT & ERCA Filing Summary',
    'Fixed Asset Capitalization Form',
    'Asset Disposal & Write-Off Approval',
    'Departmental Budget Revision Request',
    'Customer Credit Limit Application',
    'Payroll Bank Transfer Schedule',
    'Cheque Issue & Acknowledgement Register',
    'Inter-Branch Fund Transfer Request',
    'Journal Entry Adjustment Voucher',
    'Year-End Inventory Valuation Sign-Off',
    'Audit Query Response Sheet',
    'Customer Refund & Credit Note Form',
    'Commission & Sales Bonus Payout Sheet',
    'Statutory Pension Contribution Remittance',
  ],
  inventory: [
    'Goods Receiving Note (GRN)',
    'Goods Issue Note (GIN)',
    'Material Requisition Slip (MRF)',
    'Inter-Warehouse Stock Transfer Form',
    'Material Return Note (MRN)',
    'Damaged & Expired Stock Report',
    'Monthly Physical Stock Count Sheet',
    'Cycle Count Variance Investigation',
    'Minimum Reorder Level Alert Form',
    'Bin Card Update & Audit Log',
    'Raw Material Batch Traceability Log',
    'Finished Goods Warehouse Receipt',
    'Packaging Material Issue Voucher',
    'Scrap & By-Product Dispatch Form',
    'Cold/Dry Storage Temperature Log',
    'Supplier Rejection & Quarantine Note',
    'Tool Room Borrow & Return Log',
    'Spare Parts Critical Stock Check',
    'Warehouse Gate Pass Authorization',
    'Sample Material Dispatch Slip',
    'Annual Dead-Stock Review Sheet',
    'Store Keeper Handover Certificate',
  ],
  procurement: [
    'Purchase Requisition Form (PRF)',
    'Request for Quotation (RFQ)',
    'Vendor Pre-Qualification Questionnaire',
    'Bid Comparison & Evaluation Matrix',
    'Local Purchase Order (LPO)',
    'Import Proforma Invoice Checklist',
    'LC & Forex Allocation Request',
    'Supplier Performance Appraisal',
    'Contract Renewal & SLA Review',
    'Emergency Single-Source Justification',
    'Vendor Master Data Registration',
    'Advance Payment Guarantee Tracking',
    'Clearing & Forwarding Instruction',
    'Customs Declaration Checklist',
    'Supplier Non-Conformance Notice',
    'Purchase Order Amendment Request',
    'Annual Procurement Plan Sheet',
    'Tender Opening Attendance Minutes',
  ],
  production: [
    'Daily Production Schedule Order',
    'Shift Production Output Log',
    'Raw Material Consumption Sheet',
    'Machine Startup & Line Clearance',
    'Production Downtime & Root Cause Log',
    'Hourly Line Efficiency Tracker',
    'Work-In-Progress (WIP) Transfer Slip',
    'Shift Handover Operational Report',
    'Batch Manufacturing Record (BMR)',
    'Rework & Rectification Order',
    'Utility & Power Consumption Log',
    'Line Changeover & Cleaning Log',
    'Packaging Line Output Reconciliation',
    'Factory Floor Overtime Roster',
    'Production Loss & Scrap Report',
    'Operator Skill Matrix Assessment',
    'New Product Trial Run Sheet',
    'Boiler & Compressor Pressure Log',
    'Generator Fuel & Runtime Sheet',
    'Water Treatment Daily Check',
    'Label & Coding Verification Sheet',
    'Finished Pallet Wrapping Inspection',
    'Weekly Capacity Utilization Summary',
    'Monthly Plant OEE Report',
  ],
  sales: [
    'Customer Account Opening Form',
    'Sales Quotation & Proforma Offer',
    'Confirmed Sales Order Form',
    'Customer Delivery & Dispatch Note',
    'Sales Return & Credit Authorization',
    'Daily Field Sales Visit Report',
    'Distributor Territory Allocation Form',
    'Price Discount Approval Request',
    'Customer Complaint & Claim Sheet',
    'Trade Promotion & Rebate Agreement',
    'Monthly Sales Target vs Actual Sheet',
    'Cash Collection Receipt Log',
    'Overdue Receivable Follow-Up Sheet',
    'Exhibition & Event Lead Capture',
    'Key Account Quarterly Business Review',
    'Sample Product Evaluation Request',
    'Lost Deal Win/Loss Analysis Form',
    'Vehicle Loading & Invoice Checklist',
  ],
  secretary: [
    'Official Outgoing Letter Register',
    'Incoming Correspondence Log Sheet',
    'Internal Corporate Memorandum',
    'Board of Directors Meeting Minutes',
    'Executive Management Committee Minutes',
    'Document Stamp & Seal Authorization',
    'Company Archive Box Index Sheet',
    'Courier & Postal Dispatch Register',
    'Visitor Gate Pass & Reception Log',
    'Travel Booking & Hotel Requisition',
    'Meeting Room Reservation & Agenda',
    'Official Certificate Request Form',
    'Translation & Amharic Certification Log',
    'Office Stationery Requisition Sheet',
    'Press & Public Announcement Approval',
    'Policy Circular Distribution Receipt',
    'Confidential Document Destruction Log',
    'Annual License & Permit Tracker',
  ],
  fleet: [
    'Vehicle Trip & Dispatch Authorization',
    'Daily Driver Pre-Trip Inspection',
    'Fuel Coupon & Mileage Log Sheet',
    'Vehicle Preventive Service Order',
    'Accident & Road Incident Report',
    'Tyre Replacement & Rotation Log',
    'Annual Vehicle Insurance & Inspection',
    'Driver License & Medical Check Log',
    'Route Delivery Proof & POD Sheet',
    'External Truck Hire Contract Sheet',
    'Vehicle Spare Parts Issue Request',
    'Speed & GPS Violation Review Log',
    'Forklift Daily Operational Checklist',
    'Cold Chain / Cargo Seal Verification',
    'Toll, Scale & Border Expense Claim',
    'Vehicle Handover Condition Report',
    'Fleet Monthly Utilization Report',
    'Garage Workshop Job Card',
  ],
  quality: [
    'Incoming Raw Material QC Inspection',
    'In-Process Quality Control Check',
    'Finished Goods Final Release Form',
    'Certificate of Analysis (COA)',
    'Non-Conformance Report (NCR)',
    'Corrective & Preventive Action (CAPA)',
    'Lab Instrument Calibration Record',
    'Customer Quality Complaint Lab Test',
    'Retention Sample Storage Register',
    'Supplier Quality Audit Checklist',
    'Microbiology / Physical Lab Test Log',
    'Weight & Volume Control Chart',
    'Packaging Integrity & Seal Test',
    'Product Recall Readiness Drill Form',
    'ISO 9001 Internal Audit Finding',
    'Standard Operating Procedure Change',
    'Water & Air Hygiene Test Sheet',
    'Monthly Defect Pareto Analysis',
  ],
  hse: [
    'Workplace Hazard Identification (HIRA)',
    'Daily Factory Safety Walk Checklist',
    'Incident & Near-Miss Report Form',
    'First Aid Treatment & Clinic Log',
    'Fire Extinguisher Monthly Inspection',
    'Hot Work & Confined Space Permit',
    'PPE Compliance Inspection Sheet',
    'Chemical Handling & MSDS Register',
    'Emergency Evacuation Drill Log',
    'Safety Committee Meeting Minutes',
    'Contractor Safety Induction Form',
    'Waste Segregation & Disposal Log',
    'Noise & Dust Exposure Monitoring',
    'Electrical Panel Safety Audit',
    'Forklift & Crane Safety Clearance',
    'Employee Safety Violation Warning',
    'Occupational Health Check Register',
    'Environmental Compliance Summary',
  ],
  maintenance: [
    'Preventive Maintenance Work Order',
    'Breakdown Emergency Repair Request',
    'Equipment Installation & Commissioning',
    'Spare Parts Requisition for Maintenance',
    'Electrical Motor & Transformer Log',
    'HVAC & Chiller Service Checklist',
    'Welding & Fabrication Job Sheet',
    'Lockout / Tagout (LOTO) Safety Permit',
    'Weekly Lubrication & Greasing Log',
    'Machinery Calibration & Alignment',
    'Subcontractor Repair Sign-Off',
    'Building & Civil Repair Work Order',
    'Tooling & Die Maintenance Record',
    'Conveyor Belt Tension & Tracking Log',
    'Annual Plant Shutdown Overhaul Plan',
    'Equipment History & Lifecycle Card',
    'Standby Generator Load Test Sheet',
    'Scrap Metal & Obsolete Part Disposal',
  ],
  it: [
    'IT User Account & Email Request',
    'RBAC Role Permission Change Form',
    'Biometric Device Enrollment & Sync',
    'Laptop & Hardware Asset Handover',
    'IT Helpdesk Incident Ticket Sheet',
    'Network & CCTV Uptime Inspection',
    'Database Backup Verification Log',
    'Software License & Subscription Log',
    'Server Room Access Authorization',
    'Password Reset & MFA Recovery Form',
    'ERP Feature Change Request',
    'Printer & Barcode Scanner Service Log',
    'Cybersecurity Phishing / Incident Log',
    'UPS & Data Center Battery Check',
    'Offline Sync Conflict Resolution Log',
    'Staff Exit IT Access Revocation',
    'VPN & Remote Access Request',
    'Quarterly IT Asset Audit Sheet',
  ],
  audit: [
    'Internal Audit Engagement Charter',
    'Cash Count Verification Certificate',
    'Inventory Spot-Check Audit Sheet',
    'Payroll Compliance Verification Form',
    'Procurement Three-Quote Audit Check',
    'GIN vs Production Issue Reconciliation',
    'Sales Invoice & Receipt Audit Trail',
    'Fixed Asset Physical Verification',
    'Fuel & Fleet Expense Audit Sheet',
    'Leave Balance & OT Abuse Audit Form',
    'Bank Statement Audit Confirmation',
    'Internal Control Gap Assessment',
    'Audit Recommendation Follow-Up Log',
    'Fraud Risk Assessment Worksheet',
    'Statutory Tax & Pension Audit Check',
    'Vendor Conflict-of-Interest Check',
    'Quarterly Audit Executive Memo',
    'Audit Working Paper Sign-Off',
  ],
  legal: [
    'Commercial Contract Review Checklist',
    'NDA & Confidentiality Agreement',
    'Vendor Master Service Agreement',
    'Employment Dispute Case Brief',
    'Government License Renewal File',
    'Power of Attorney Authorization',
    'Trademark & IP Registration Log',
    'Lease & Tenancy Contract Review',
    'Regulatory Inspection Compliance Log',
    'Insurance Claim Legal Notice',
    'Board Resolution Legal Attestation',
    'Debt Collection Demand Notice',
    'Distributor Exclusivity Addendum',
    'Data Privacy & Record Retention Form',
    'Shareholder Register Update Form',
    'Legal Opinion & Advisory Memo',
  ],
  'customer-care': [
    'Customer Inquiry & Support Log',
    'Warranty Replacement Claim Form',
    'Delivery Delay Escalation Sheet',
    'Customer Satisfaction Survey (CSAT)',
    'Product Defect Feedback Intake',
    'Dealer Support & Training Request',
    'Order Cancellation Verification',
    'After-Sales Service Dispatch Note',
    'VIP Account Escalation Tracker',
    'Call Center Daily Summary Sheet',
    'Distributor Packaging Feedback Form',
    'Invoice Dispute Resolution Slip',
    'Returned Goods Inspection Feedback',
    'Client Onboarding Welcome Checklist',
    'Quarterly Net Promoter Score Log',
    'Trade Show Customer Follow-Up',
    'Service SLA Breach Report',
  ],
  management: [
    'Annual Corporate Strategic Plan',
    'Quarterly OKR & KPI Scorecard',
    'Capital Expenditure (CAPEX) Proposal',
    'Executive Committee Action Tracker',
    'Departmental Budget Approval Memo',
    'New Branch Expansion Feasibility',
    'Senior Leadership Weekly Brief',
    'Crisis & Business Continuity Plan',
    'Corporate Risk Register Update',
    'Strategic Partnership Term Sheet',
    'Organizational Chart Change Form',
    'Salary Scale & Grade Revision Memo',
    'Annual Bonus Pool Authorization',
    'Plant Capacity Investment Brief',
    'ISO Management Review Minutes',
    'Sustainability & ESG Report Sheet',
    'Board Briefing Executive Deck Log',
    'Key Talent Succession Plan',
    'Monthly P&L Executive Sign-Off',
    'Executive Leadership & Manager Evaluation Rubric',
  ],
  'attendance-shifts': [
    'Daily Attendance Sheet',
    'Weekly Attendance Summary',
    'Monthly Attendance Register',
    'Morning, Afternoon & Night Shifts Roster',
    'Employee Lateness Record',
    'Absence Records Register',
    'Overtime Hours Authorization & Log',
    'Department Attendance Summary',
    'Security Guard Duty Schedules',
    'Weekend and Holiday Attendance Log',
    'Shift Performance Evaluation Form',
  ],
};

function buildAttendanceShiftFields(code: string, title: string): CompanyFormFieldDef[] {
  const base: CompanyFormFieldDef[] = [
    { key: 'branch_location', label: 'Branch / Facility', type: 'select', options: ['Addis Ababa HQ', 'Adama Factory', 'Hawassa Depot'], defaultValue: 'Addis Ababa HQ' },
    { key: 'department', label: 'Department / Unit', type: 'text', placeholder: 'All Departments or Production / Security' },
    { key: 'supervisor', label: 'Shift Supervisor / Attendance Officer', type: 'text', placeholder: 'Officer full name' },
  ];

  switch (code) {
    case 'SS-ATT-01':
      return [
        ...base,
        { key: 'attendance_date', label: 'Attendance Date', type: 'date' },
        { key: 'shift_filter', label: 'Shift Coverage', type: 'select', options: ['All Shifts', 'Morning Shift', 'Afternoon Shift', 'Night Shift', 'Day Shift'], defaultValue: 'All Shifts' },
        { key: 'present_count', label: 'Present Staff Count', type: 'number', placeholder: '0' },
        { key: 'absent_late_summary', label: 'Daily Roll Call Notes', type: 'textarea', placeholder: 'Daily headcount verification, late arrivals, and handover remarks...' },
      ];
    case 'SS-ATT-02':
      return [
        ...base,
        { key: 'week_start', label: 'Week Start Date', type: 'date' },
        { key: 'week_end', label: 'Week End Date', type: 'date' },
        { key: 'total_hours', label: 'Total Worked Hours', type: 'number', placeholder: '0' },
        { key: 'weekly_summary', label: 'Weekly Attendance & Compliance Notes', type: 'textarea', placeholder: 'Summary of weekly attendance rate, absences, and shift coverage...' },
      ];
    case 'SS-ATT-03':
      return [
        ...base,
        { key: 'month_period', label: 'Attendance Month (YYYY-MM)', type: 'text', placeholder: '2026-11' },
        { key: 'working_days', label: 'Standard Working Days', type: 'number', defaultValue: '26' },
        { key: 'payroll_cutoff', label: 'Payroll Lock Status', type: 'select', options: ['Open Register', 'Pending HR Verification', 'Closed & Locked for Payroll'], defaultValue: 'Open Register' },
        { key: 'monthly_notes', label: 'Monthly Reconciliation Notes', type: 'textarea', placeholder: 'Monthly attendance reconciliation before payroll run...' },
      ];
    case 'SS-ATT-04':
      return [
        ...base,
        { key: 'effective_date', label: 'Roster Date / Period', type: 'date' },
        { key: 'rotation_system', label: 'Shift System', type: 'select', options: ['3-Shift (Morning / Afternoon / Night)', '4-Shift Continuous (A/B/C/D)', 'Day + Overtime'], defaultValue: '3-Shift (Morning / Afternoon / Night)' },
        { key: 'handover_protocol', label: 'Shift Handover & Rest Notes', type: 'textarea', placeholder: 'Morning (06:00-14:00), Afternoon (14:00-22:00), Night (22:00-06:00) rotation details...' },
      ];
    case 'SS-ATT-05':
      return [
        ...base,
        { key: 'period_date', label: 'Reporting Date / Period', type: 'date' },
        { key: 'grace_minutes', label: 'Grace Threshold (Minutes)', type: 'number', defaultValue: '10' },
        { key: 'total_late_minutes', label: 'Total Late Minutes Recorded', type: 'number', placeholder: '0' },
        { key: 'disciplinary_notes', label: 'Lateness Follow-Up & Counseling', type: 'textarea', placeholder: 'Root causes, warning notices, and supervisor review...' },
      ];
    case 'SS-ATT-06':
      return [
        ...base,
        { key: 'period_date', label: 'Absence Reporting Date', type: 'date' },
        { key: 'absence_category', label: 'Absence Classification', type: 'select', options: ['All Absences', 'Unexcused Absence', 'Approved Leave', 'Medical / Emergency'], defaultValue: 'All Absences' },
        { key: 'total_absence_hours', label: 'Total Absence Hours', type: 'number', placeholder: '0' },
        { key: 'absence_notes', label: 'Absence Verification & Payroll Deduction Notes', type: 'textarea', placeholder: 'HR verification against approved leaves and payroll deduction rules...' },
      ];
    case 'SS-ATT-07':
      return [
        ...base,
        { key: 'ot_date', label: 'Overtime Date / Period', type: 'date' },
        { key: 'ot_category', label: 'Overtime Multiplier Category', type: 'select', options: ['All Categories', 'Normal OT (1.5x)', 'Night OT (1.75x)', 'Sunday OT (2.0x)', 'Holiday OT (2.5x)'], defaultValue: 'All Categories' },
        { key: 'total_ot_hours', label: 'Total Approved OT Hours', type: 'number', placeholder: '0' },
        { key: 'ot_justification', label: 'Operational Justification for Overtime', type: 'textarea', placeholder: 'Production urgency, rush dispatch, maintenance, or guard coverage justification...' },
      ];
    case 'SS-ATT-08':
      return [
        ...base,
        { key: 'report_date', label: 'Reporting Date', type: 'date' },
        { key: 'dept_manager', label: 'Department Manager', type: 'text', placeholder: 'Manager full name' },
        { key: 'attendance_rate_pct', label: 'Department Attendance Rate (%)', type: 'number', placeholder: '95' },
        { key: 'dept_remarks', label: 'Departmental Workforce Coverage Notes', type: 'textarea', placeholder: 'Headcount vs scheduled vs present breakdown across teams...' },
      ];
    case 'SS-ATT-09':
      return [
        ...base,
        { key: 'duty_date', label: 'Guard Roster Date', type: 'date' },
        { key: 'gate_post', label: 'Gate / Security Post', type: 'select', options: ['All Posts', 'Main Entrance Gate', 'Warehouse Perimeter', 'Factory Floor Gate', 'Control Room / CCTV'], defaultValue: 'All Posts' },
        { key: 'shift_coverage', label: '24/7 Coverage Verification', type: 'select', options: ['24-Hour Continuous (3x8h)', '4-Crew Rotating (A/B/C/D)', 'Special Event Security'], defaultValue: '24-Hour Continuous (3x8h)' },
        { key: 'guard_briefing', label: 'Security Handover & Incident Brief', type: 'textarea', placeholder: 'Key custody, gate pass log verification, patrol schedule, and radio check...' },
      ];
    case 'SS-ATT-10':
      return [
        ...base,
        { key: 'holiday_date', label: 'Weekend / Public Holiday Date', type: 'date' },
        { key: 'day_classification', label: 'Day Classification & Rate', type: 'select', options: ['Sunday / Weekly Rest (2.0x)', 'Ethiopian Public Holiday (2.5x)', 'Saturday Half/Full Shift'], defaultValue: 'Sunday / Weekly Rest (2.0x)' },
        { key: 'holiday_name', label: 'Holiday / Weekend Title', type: 'text', placeholder: 'e.g. Sunday Shift / Enkutatash / Meskel' },
        { key: 'holiday_approval_notes', label: 'Authorization & Compensation Notes', type: 'textarea', placeholder: 'Pre-approval reference and payroll multiplier verification...' },
      ];
    case 'SS-ATT-11':
    default:
      return [
        ...base,
        { key: 'eval_period', label: 'Shift Evaluation Period', type: 'text', placeholder: 'e.g. November 2026 / Week 46' },
        { key: 'shift_evaluated', label: 'Evaluated Shift', type: 'select', options: ['All Shifts', 'Morning Shift', 'Afternoon Shift', 'Night Shift', 'Security Guard Shift'], defaultValue: 'All Shifts' },
        { key: 'punctuality_score', label: 'Overall Punctuality & Adherence (%)', type: 'number', placeholder: '94' },
        { key: 'performance_notes', label: 'Shift Productivity & Handover Evaluation', type: 'textarea', placeholder: `Performance review notes for ${title}...` },
      ];
  }
}

function buildAttendanceShiftColumns(code: string): string[] {
  switch (code) {
    case 'SS-ATT-01':
      return ['Staff ID', 'Full Name', 'Department', 'Shift', 'Check-In', 'Check-Out', 'Status'];
    case 'SS-ATT-02':
      return ['Staff ID', 'Full Name', 'Department', 'Days Present', 'Late (Min)', 'OT Hours', 'Weekly Status'];
    case 'SS-ATT-03':
      return ['Staff ID', 'Full Name', 'Department', 'Reg Hrs', 'Absence Hrs', 'OT Hrs', 'OT Pay (ETB)'];
    case 'SS-ATT-04':
      return ['Staff ID', 'Full Name', 'Department', 'Morning (In-Out)', 'Afternoon (In-Out)', 'Night (In-Out)', 'Status'];
    case 'SS-ATT-05':
      return ['Staff ID', 'Full Name', 'Department', 'Date', 'Scheduled Start', 'Actual Check-In', 'Late (Min)'];
    case 'SS-ATT-06':
      return ['Staff ID', 'Full Name', 'Department', 'Date', 'Absence Hours', 'Reason / Leave Ref', 'Status'];
    case 'SS-ATT-07':
      return ['Staff ID', 'Full Name', 'Date', 'OT Category', 'Multiplier', 'OT Hours', 'OT Amount (ETB)'];
    case 'SS-ATT-08':
      return ['Department', 'Manager', 'Assigned Staff', 'Present', 'Late', 'Absent', 'Attendance %'];
    case 'SS-ATT-09':
      return ['Date', 'Guard ID & Name', 'Security Post', 'Shift & Time', 'Check-In / Out', 'Status'];
    case 'SS-ATT-10':
      return ['Date', 'Staff ID & Name', 'Day / Holiday Type', 'Shift Time', 'Hours Worked', 'Multiplier & Pay'];
    case 'SS-ATT-11':
      return ['Shift Name', 'Assigned Logs', 'On-Time Count', 'Late Count', 'Absence Hrs', 'OT Hrs', 'Score %'];
    default:
      return ['Staff ID', 'Full Name', 'Department', 'Shift', 'Hours', 'Status'];
  }
}

function buildDepartmentFields(deptKey: string, title: string, isEvaluation: boolean, code: string): CompanyFormFieldDef[] {
  if (deptKey === 'attendance-shifts') {
    return buildAttendanceShiftFields(code, title);
  }
  const common: CompanyFormFieldDef[] = [
    { key: 'branch_location', label: 'Branch / Facility', type: 'select', options: ['Addis Ababa HQ', 'Adama Factory', 'Hawassa Depot'], defaultValue: 'Addis Ababa HQ' },
    { key: 'priority', label: 'Priority Level', type: 'select', options: ['Normal', 'Urgent', 'Critical'], defaultValue: 'Normal' },
  ];

  if (isEvaluation) {
    return [
      ...common,
      { key: 'review_cycle', label: 'Evaluation Cycle', type: 'select', options: ['Q1', 'Q2', 'Q3', 'Q4', 'Annual', 'Probation'], defaultValue: 'Q4' },
      { key: 'job_grade', label: 'Job Grade / Position', type: 'text', placeholder: 'e.g. Senior Operator / Supervisor' },
      { key: 'key_strengths', label: 'Key Strengths Observed', type: 'textarea', placeholder: 'Highlight core strengths and milestones...' },
      { key: 'development_plan', label: 'Training & Development Plan', type: 'textarea', placeholder: 'Recommended coaching or technical training...' },
    ];
  }

  switch (deptKey) {
    case 'finance':
      return [
        ...common,
        { key: 'cost_center', label: 'Cost Center', type: 'text', placeholder: 'CC-100 / Production' },
        { key: 'amount_etb', label: 'Amount (ETB)', type: 'number', placeholder: '0.00' },
        { key: 'payment_mode', label: 'Payment Mode', type: 'select', options: ['Bank Transfer', 'Cheque', 'Cash', 'Credit Note'], defaultValue: 'Bank Transfer' },
        { key: 'justification', label: 'Accounting Justification', type: 'textarea', placeholder: `Purpose & ledger notes for ${title}` },
      ];
    case 'inventory':
    case 'procurement':
      return [
        ...common,
        { key: 'warehouse_bin', label: 'Warehouse / Store', type: 'text', placeholder: 'Main Store / Raw Material Bay' },
        { key: 'supplier_party', label: 'Supplier / Requesting Dept', type: 'text', placeholder: 'Party name' },
        { key: 'po_ref', label: 'PO / Req Reference', type: 'text', placeholder: 'PO-2026-...' },
        { key: 'handling_notes', label: 'Inspection & Handling Notes', type: 'textarea', placeholder: 'Condition, batch, and count verification' },
      ];
    case 'fleet':
    case 'maintenance':
      return [
        ...common,
        { key: 'asset_plate_code', label: 'Vehicle Plate / Machine Code', type: 'text', placeholder: 'ET-3-88412 / MCH-01' },
        { key: 'meter_reading', label: 'Odometer / Runtime Hours', type: 'number', placeholder: '0' },
        { key: 'technician', label: 'Assigned Technician / Driver', type: 'text', placeholder: 'Full name' },
        { key: 'work_summary', label: 'Inspection & Action Summary', type: 'textarea', placeholder: 'Detailed technical findings' },
      ];
    default:
      return [
        ...common,
        { key: 'subject_ref', label: 'Subject / Case Reference', type: 'text', defaultValue: title },
        { key: 'counterparty', label: 'Contact / Counterparty', type: 'text', placeholder: 'Internal dept or external party' },
        { key: 'effective_date', label: 'Effective Date', type: 'date' },
        { key: 'details', label: 'Operational Details', type: 'textarea', placeholder: `Enter official notes for ${title}...` },
      ];
  }
}

function buildDepartmentColumns(deptKey: string, code: string): string[] {
  if (deptKey === 'attendance-shifts') {
    return buildAttendanceShiftColumns(code);
  }
  switch (deptKey) {
    case 'finance':
      return ['Account Code', 'Description / Particulars', 'Debit (ETB)', 'Credit (ETB)'];
    case 'inventory':
    case 'procurement':
      return ['SKU / Code', 'Material Specification', 'Qty & Unit', 'Condition / Status'];
    case 'production':
    case 'quality':
      return ['Batch / Line', 'Parameter / Check', 'Target vs Actual', 'Pass / Fail'];
    case 'fleet':
    case 'maintenance':
      return ['Component / Checkpoint', 'Condition Finding', 'Part / Cost (ETB)', 'Sign-Off'];
    default:
      return ['Item #', 'Requirement / Particular', 'Value / Metric', 'Verification Status'];
  }
}

const forms: CompanyFormDef[] = [];
let globalSeq = 1;

for (const dept of COMPANY_FORM_DEPARTMENTS) {
  const titles = FORM_TITLES_BY_DEPT[dept.key] || [];
  for (let i = 1; i <= dept.count; i += 1) {
    const code = `${dept.prefix}-${String(i).padStart(2, '0')}`;
    const name = titles[i - 1] || `${dept.name} Standard Form #${i}`;
    const isEvaluation = code === 'SS-HR-18' || code === 'SS-MGT-20' || code === 'SS-ATT-11';
    const formDef: CompanyFormDef = {
      no: globalSeq++,
      code,
      name,
      departmentKey: dept.key,
      departmentName: dept.name,
      fields: buildDepartmentFields(dept.key, name, isEvaluation && code !== 'SS-ATT-11', code),
      defaultColumns: buildDepartmentColumns(dept.key, code),
      isEvaluation,
    };
    forms.push(formDef);
    dept.forms.push(formDef);
  }
}

export const ALL_COMPANY_FORMS: CompanyFormDef[] = forms;
