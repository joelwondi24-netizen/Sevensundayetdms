export type AppLang = 'en' | 'am' | 'om' | 'ti' | 'ar' | 'zh';

export interface LanguageOption {
  code: AppLang;
  label: string;
  shortLabel: string;
  dir?: 'ltr' | 'rtl';
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', label: 'English', shortLabel: 'EN', dir: 'ltr' },
  { code: 'am', label: 'አማርኛ (Amharic)', shortLabel: 'አማ', dir: 'ltr' },
  { code: 'om', label: 'Afaan Oromoo', shortLabel: 'OM', dir: 'ltr' },
  { code: 'ti', label: 'ትግርኛ (Tigrigna)', shortLabel: 'ትግ', dir: 'ltr' },
  { code: 'ar', label: 'العربية (Arabic)', shortLabel: 'AR', dir: 'rtl' },
  { code: 'zh', label: '中文 (Chinese)', shortLabel: '中文', dir: 'ltr' },
];

export const UI_LABELS: Record<AppLang, Record<string, string>> = {
  en: {
    group_command: 'Command & Overview',
    group_hr_admin: 'HR, Attendance & Admin',
    group_inventory: 'Inventory & Supply Chain',
    group_commercial: 'Commercial, Finance & Fleet',
    group_collab: 'Collaboration & System',
    dashboard: 'Dashboard',
    approvals: 'Approvals & Alerts',
    reports: 'Corporate Reports & Exports',
    admin: 'System & Company Admin',
    hr: 'HR & Staff ID Cards',
    devices: 'Device Connections',
    attendance: 'Attendance Register & OT',
    scheduling: 'Staff Scheduling & Shifts',
    leave: 'Leave Management',
    salary: 'Salary Management',
    payroll: 'Payroll & Ethiopian Tax',
    secretary: 'Secretary & A4 Documents',
    'company-forms': 'Company Forms & Evaluations',
    'gate-pass': 'Single-Use Gate Pass',
    materials: 'Materials',
    'material-requests': 'Materials Request',
    grn: 'Goods Receiving (GRN)',
    gin: 'Issuing (GIN) & Audit',
    procurement: 'Procurement',
    purchasing: 'Purchasing',
    'sales-crm': 'Sales & CRM',
    finance: 'Finance & Accounting',
    assets: 'Uniforms & Assets',
    vehicles: 'Vehicles & Maintenance',
    chat: 'Corporate Chat',
    audit: 'Immutable Audit Trail',
    sync: 'Synchronization Center',
    search_placeholder: 'Search modules, 305 forms, records...',
    search_short: 'Search',
    corporate_chat: 'Corporate Chat',
    sign_out: 'Sign Out',
    tenant_workspace: 'Tenant Workspace',
    language: 'Language',
    send_to_approve: 'Send to Approve Dept',
    import_files: 'Import Files & Docs',
  },
  am: {
    group_command: 'ዋና ዕይታ እና ሪፖርቶች',
    group_hr_admin: 'የሰው ኃይል፣ መገኘት እና አስተዳደር',
    group_inventory: 'ዕቃዎች እና አቅርቦት ሰንሰለት',
    group_commercial: 'ሽያጭ፣ ፋይናንስ እና ተሽከርካሪዎች',
    group_collab: 'ትብብር እና ሲስተም',
    dashboard: 'ዋና ዳሽቦርድ',
    approvals: 'ማጽደቂያ እና ማሳወቂያዎች',
    reports: 'የድርጅት ሪፖርቶች እና ወጪ',
    admin: 'የሲስተም እና ድርጅት አስተዳደር',
    hr: 'የሰው ኃይል እና መታወቂያ',
    devices: 'የመሳሪያ ግንኙነቶች',
    attendance: 'የመገኘት እና የትርፍ ሰዓት መዝገብ',
    scheduling: 'የሠራተኞች መርሃ ግብር እና ፈረቃ',
    leave: 'የፍቃድ አስተዳደር',
    salary: 'የደመወዝ አስተዳደር (Salary)',
    payroll: 'ደመወዝ እና የኢትዮጵያ ግብር',
    secretary: 'ጸሐፊ እና A4 ሰነዶች',
    'company-forms': 'የኩባንያ ቅጾች እና ግምገማ',
    'gate-pass': 'አንድ ጊዜ መውጫ ፈቃድ (Gate Pass)',
    materials: 'ዕቃዎች እና ክምችት',
    'material-requests': 'የዕቃ መጠየቂያ',
    grn: 'የዕቃ ገቢ (GRN)',
    gin: 'የዕቃ ወጪ (GIN) እና ኦዲት',
    procurement: 'ግዥ እና ጨረታ',
    purchasing: 'የግዥ ትዕዛዞች',
    'sales-crm': 'ሽያጭ እና ደንበኞች (CRM)',
    finance: 'ፋይናንስ እና ሒሳብ',
    assets: 'ዩኒፎርም እና ንብረቶች',
    vehicles: 'ተሽከርካሪዎች እና ጥገና',
    chat: 'የውስጥ ድርጅት ውይይት',
    audit: 'የኦዲት መዝገብ',
    sync: 'ከመስመር ውጭ እና ምትኬ',
    search_placeholder: 'ሞጁሎችን፣ 305 ቅጾችን፣ መረጃዎችን ይፈልጉ...',
    search_short: 'ፈልግ',
    corporate_chat: 'የውስጥ ውይይት',
    sign_out: 'ውጣ',
    tenant_workspace: 'የድርጅት ቅርንጫፍ (Tenant)',
    language: 'ቋንቋ',
    send_to_approve: 'ለማጽደቂያ ክፍል ላክ',
    import_files: 'ፋይሎች እና ሰነዶችን አስመጣ',
  },
  om: {
    group_command: 'Ajajaa fi Gabaasa',
    group_hr_admin: 'Humna Namaa fi Bulchiinsa',
    group_inventory: 'Meeshaalee fi Dhiyeessii',
    group_commercial: 'Gurgurtaa, Faayinaansii fi Konkolaataa',
    group_collab: 'Walqunnamtii fi Sirna',
    dashboard: 'Daashboordii Hojii',
    approvals: 'Mirkaneessaa fi Beeksisa',
    reports: 'Gabaasa Dhaabbataa',
    admin: 'Bulchiinsa Sirnaa fi Dhaabbataa',
    hr: 'Humna Namaa fi Eenyummeessaa',
    devices: 'Walqunnamtii Meeshaalee',
    attendance: 'Galmee Argamuu fi OT',
    scheduling: 'Sagantaa Hojii fi Shiftoo',
    leave: 'Bulchiinsa Hayyamaa',
    salary: 'Bulchiinsa Mindaa (Salary)',
    payroll: 'Mindaa fi Gibira Itoophiyaa',
    secretary: 'Barreessaa fi Sanadoota A4',
    'company-forms': 'Unkaalee fi Madaallii Hojjetaa',
    'gate-pass': 'Hayyama Karra Al-Tokkoo',
    materials: 'Meeshaalee fi Kuusaa',
    'material-requests': 'Gaaffii Meeshaa',
    grn: 'Galii Meeshaa (GRN)',
    gin: 'Baasii Meeshaa (GIN)',
    procurement: 'Bittaa fi Caalbaasii',
    purchasing: 'Ajaja Bittaa',
    'sales-crm': 'Gurgurtaa fi CRM',
    finance: 'Faayinaansii fi Herrega',
    assets: 'Qabeenyaa fi Uffata Hojii',
    vehicles: 'Konkolaataa fi Suphaa',
    chat: 'Marii Keessoo Dhaabbataa',
    audit: 'Galmee Odiitii',
    sync: 'Wal-simsiisaa fi Kuusaa',
    search_placeholder: 'Kutaa, unkaalee 305, galmee barbaadi...',
    search_short: 'Barbaadi',
    corporate_chat: 'Marii Keessoo',
    sign_out: 'Bahi',
    tenant_workspace: 'Damee Dhaabbataa (Tenant)',
    language: 'Afaan',
    send_to_approve: 'Kutaa Mirkaneessuuf Ergi',
    import_files: 'Faayiloota fi Sanadoota Galchi',
  },
  ti: {
    group_command: 'መምርሒን ጸብጻብን',
    group_hr_admin: 'ሓይሊ ሰብን ምምሕዳርን',
    group_inventory: 'ንብረትን ቀረብን',
    group_commercial: 'መሸጣ፣ ፋይናንስን መኻይንን',
    group_collab: 'ርክብን ሲስተምን',
    dashboard: 'ዋና ዳሽቦርድ',
    approvals: 'ፍቓድን መፍለጢታትን',
    reports: 'ጸብጻባት ትካል',
    admin: 'ምምሕዳር ሲስተምን ትካልን',
    hr: 'ሓይሊ ሰብን መንነትን',
    devices: 'ምትእስሳር መሳርሒታት',
    attendance: 'መዝገብ ምርካብን ትርፊ ሰዓትን',
    scheduling: 'መደብ ስራሕን ፈረቓን',
    leave: 'ምምሕዳር ዕረፍቲ',
    salary: 'ምምሕዳር ደሞዝ (Salary)',
    payroll: 'ደሞዝን ግብሪ ኢትዮጵያን',
    secretary: 'ጸሓፊን ሰነዳት A4ን',
    'company-forms': 'ቅጥዕታት ትካልን ገምጋምን',
    'gate-pass': 'ናይ ሓደ ግዜ መውጽኢ ፍቓድ',
    materials: 'ኣቑሑትን መኽዘንን',
    'material-requests': 'ሕቶ ኣቑሑት',
    grn: 'መእተዊ ኣቑሑት (GRN)',
    gin: 'መውጽኢ ኣቑሑት (GIN)',
    procurement: 'ዕድጊን ጨረታን',
    purchasing: 'ትእዛዝ ዕድጊ',
    'sales-crm': 'መሸጣን ዓማዊልን (CRM)',
    finance: 'ፋይናንስን ሕሳብን',
    assets: 'ዩኒፎርምን ንብረትን',
    vehicles: 'መኻይንን ጽገናን',
    chat: 'ውሽጣዊ ዝርርብ ትካል',
    audit: 'መዝገብ ኦዲት',
    sync: 'ካብ መስመር ወጻኢን ምትሕልላፍን',
    search_placeholder: 'ሞጁላት፣ 305 ቅጥዕታት፣ መዛግብቲ ድለዩ...',
    search_short: 'ድለይ',
    corporate_chat: 'ውሽጣዊ ዝርርብ',
    sign_out: 'ውጻእ',
    tenant_workspace: 'ጨንፈር ትካል (Tenant)',
    language: 'ቋንቋ',
    send_to_approve: 'ናብ ዘጽድቕ ክፍሊ ስደድ',
    import_files: 'ፋይላትን ሰነዳትን ኣእቱ',
  },
  ar: {
    group_command: 'القيادة والتقارير',
    group_hr_admin: 'الموارد البشرية والإدارة',
    group_inventory: 'المخزون وسلسلة الإمداد',
    group_commercial: 'المبيعات والمالية والأسطول',
    group_collab: 'التعاون والنظام',
    dashboard: 'لوحة التحكم التنفيذية',
    approvals: 'الموافقات والتنبيهات',
    reports: 'التقارير والتصدير',
    admin: 'إدارة النظام والشركة',
    hr: 'الموارد البشرية وبطاقات الهوية',
    devices: 'اتصالات الأجهزة',
    attendance: 'سجل الحضور والعمل الإضافي',
    scheduling: 'جداول الموظفين والورديات',
    leave: 'إدارة الإجازات',
    salary: 'إدارة الرواتب والبدلات',
    payroll: 'الرواتب وضرائب إثيوبيا',
    secretary: 'السكرتارية ووثائق A4',
    'company-forms': 'نماذج الشركة والتقييم',
    'gate-pass': 'تصريح خروج لمرة واحدة',
    materials: 'المواد والمخزون',
    'material-requests': 'طلبات المواد',
    grn: 'استلام البضائع (GRN)',
    gin: 'صرف المواد والتدقيق (GIN)',
    procurement: 'المشتريات والمناقصات',
    purchasing: 'أوامر الشراء',
    'sales-crm': 'المبيعات وإدارة العملاء',
    finance: 'المالية والمحاسبة',
    assets: 'الزي الرسمي والأصول',
    vehicles: 'المركبات والصيانة',
    chat: 'المحادثة الداخلية',
    audit: 'سجل التدقيق الثابت',
    sync: 'المزامنة والنسخ الاحتياطي',
    search_placeholder: 'ابحث في الوحدات، 305 نموذج، السجلات...',
    search_short: 'بحث',
    corporate_chat: 'المحادثة',
    sign_out: 'تسجيل الخروج',
    tenant_workspace: 'بيئة المؤسسة (Tenant)',
    language: 'اللغة',
    send_to_approve: 'إرسال لقسم الاعتماد',
    import_files: 'استيراد الملفات والمستندات',
  },
  zh: {
    group_command: '指挥与概览',
    group_hr_admin: '人事、考勤与行政',
    group_inventory: '库存与供应链',
    group_commercial: '销售、财务与车队',
    group_collab: '协作与系统',
    dashboard: '运营仪表板',
    approvals: '审批与通知中心',
    reports: '企业报表与导出',
    admin: '系统与公司管理',
    hr: '人力资源与员工证',
    devices: '设备连接管理',
    attendance: '考勤登记与加班管理',
    scheduling: '员工排班与班次管理',
    leave: '休假管理',
    salary: '员工薪资与津贴管理',
    payroll: '薪资与埃塞税务规则',
    secretary: '秘书处与A4公文',
    'company-forms': '公司表单与绩效评估',
    'gate-pass': '一次性门禁放行单',
    materials: '物料主数据',
    'material-requests': '领料申请',
    grn: '入库验收单 (GRN)',
    gin: '出库领料与审计 (GIN)',
    procurement: '采购招标 (RFQ)',
    purchasing: '采购订单 (PO)',
    'sales-crm': '销售与客户管理',
    finance: '财务与复式记账',
    assets: '工服与公司资产',
    vehicles: '车辆与设备维护',
    chat: '企业内部即时通讯',
    audit: '不可篡改审计日志',
    sync: '离线同步与备份',
    search_placeholder: '搜索模块、305份表单、员工与单据...',
    search_short: '搜索',
    corporate_chat: '企业聊天',
    sign_out: '退出登录',
    tenant_workspace: '租户工作区 (Tenant)',
    language: '语言',
    send_to_approve: '发送至审批部门',
    import_files: '导入文件与文档',
  },
};

export function translateUi(
  lang: AppLang,
  key: string,
  fallback: string,
  customOverrides?: Record<string, string | undefined>
): string {
  const custom = customOverrides?.[key];
  if (custom && custom.trim()) return custom.trim();
  return UI_LABELS[lang]?.[key] || UI_LABELS.en[key] || fallback;
}

const ETH_MONTHS = [
  'Meskerem',
  'Tikimt',
  'Hidar',
  'Tahsas',
  'Tir',
  'Yekatit',
  'Megabit',
  'Miazia',
  'Ginbot',
  'Sene',
  'Hamle',
  'Nehase',
  'Pagume',
];

export function toEthiopianDateString(isoDate: string): string {
  if (!isoDate) return '';
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;

  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();

  const isNextEthLeap = (year + 1) % 4 === 0;
  const newYearDay = isNextEthLeap ? 12 : 11;
  const newYearUtc = Date.UTC(year, 8, newYearDay);
  const currentUtc = Date.UTC(year, month - 1, day);

  let ethYear: number;
  let diffDays: number;
  if (currentUtc >= newYearUtc) {
    ethYear = year - 7;
    diffDays = Math.floor((currentUtc - newYearUtc) / 86400000);
  } else {
    ethYear = year - 8;
    const prevLeap = year % 4 === 0;
    const prevNewYear = Date.UTC(year - 1, 8, prevLeap ? 12 : 11);
    diffDays = Math.floor((currentUtc - prevNewYear) / 86400000);
  }

  const mIdx = Math.min(12, Math.max(0, Math.floor(diffDays / 30)));
  const ethDay = (diffDays % 30) + 1;
  return `${ETH_MONTHS[mIdx]} ${ethDay}, ${ethYear} E.C.`;
}

export const ETHIOPIAN_SHIFT_WINDOWS = {
  morning: {
    inStart: '07:45',
    inEnd: '08:00',
    outStart: '11:58',
    outEnd: '12:30',
    scheduledStart: '08:00',
    scheduledEnd: '12:00',
    ethLabel: 'In 1:45–2:00 · Out 5:58–6:30 (Morning/Noon ET)',
  },
  afternoon: {
    inStart: '12:50',
    inEnd: '13:00',
    outStart: '16:58',
    outEnd: '17:00',
    otStart: '17:10',
    otEnd: '19:00',
    scheduledStart: '13:00',
    scheduledEnd: '17:00',
    ethLabel: 'In 6:50–7:00 · Out 10:58–11:00 · OT 11:10–1:00 PM (ET)',
  },
  night: {
    inStart: '18:50',
    inEnd: '19:00',
    outStart: '01:58',
    outEnd: '02:10',
    otStart: '02:10',
    otEnd: '07:00',
    scheduledStart: '19:00',
    scheduledEnd: '02:00',
    ethLabel: 'In 12:50–1:00 PM · Out 7:58–8:10 PM · OT 8:10–1:00 AM (ET)',
  },
} as const;

export function formatEthiopianLocalTime(hhmm: string): string {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return hhmm || '--:--';
  const h24 = Number(m[1]) % 24;
  const mins = m[2];
  const ethHour = ((h24 + 18) % 12) || 12;
  let period = 'Day';
  if (h24 >= 6 && h24 < 12) period = 'Morning';
  else if (h24 >= 12 && h24 < 18) period = 'Afternoon';
  else if (h24 >= 18 && h24 < 24) period = 'Evening';
  else period = 'Night';
  return `${ethHour}:${mins} ${period} ET`;
}

export function formatMoney(amount: number, currency = 'ETB'): string {
  const num = Number(amount) || 0;
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${formatted}`;
}

export function translatePhraseDictionary(text: string, lang: AppLang): string {
  if (!text) return '';
  if (lang === 'en') return text;

  const amDict: Array<[RegExp, string]> = [
    [/official memo/gi, 'ይፋዊ ማስታወሻ'],
    [/employee letter/gi, 'የሰራተኛ ደብዳቤ'],
    [/salary certificate/gi, 'የደመወዝ ማረጋገጫ'],
    [/board resolution/gi, 'የቦርድ ውሳኔ'],
    [/please be informed/gi, 'እንዲታወቅዎ'],
    [/approved/gi, 'ጸድቋል'],
    [/seven sunday/gi, 'ሰቨን ሰንደይ'],
    [/general manager/gi, 'ዋና ሥራ አስኪያጅ'],
  ];

  const omDict: Array<[RegExp, string]> = [
    [/official memo/gi, 'Yaadannoo Idilee'],
    [/employee letter/gi, 'Xalayaa Hojjetaa'],
    [/salary certificate/gi, 'Waraqaa Ragaa Mindaa'],
    [/board resolution/gi, 'Murtoo Boordii'],
    [/please be informed/gi, 'Akka beektan'],
    [/approved/gi, 'Mirkaneeffameera'],
    [/seven sunday/gi, 'Seven Sunday'],
    [/general manager/gi, 'Hojii Gaggeessaa Olaanaa'],
  ];

  const tiDict: Array<[RegExp, string]> = [
    [/official memo/gi, 'ወግዓዊ መፍለጢ'],
    [/employee letter/gi, 'ደብዳበ ሰራሕተኛ'],
    [/salary certificate/gi, 'መረጋገጺ ደሞዝ'],
    [/board resolution/gi, 'ውሳነ ቦርድ'],
    [/please be informed/gi, 'ክትፈልጡ ንሓትት'],
    [/approved/gi, 'ጸዲቑ'],
    [/seven sunday/gi, 'ሰቨን ሰንደይ'],
    [/general manager/gi, 'ዋና ኣካያዲ ስራሕ'],
  ];

  const arDict: Array<[RegExp, string]> = [
    [/official memo/gi, 'مذكرة رسمية'],
    [/employee letter/gi, 'خطاب موظف'],
    [/salary certificate/gi, 'شهادة راتب'],
    [/board resolution/gi, 'قرار مجلس الإدارة'],
    [/please be informed/gi, 'نحيطكم علماً'],
    [/approved/gi, 'معتمد'],
    [/seven sunday/gi, 'سفن صنداي'],
    [/general manager/gi, 'المدير العام'],
  ];

  const zhDict: Array<[RegExp, string]> = [
    [/official memo/gi, '正式备忘录'],
    [/employee letter/gi, '员工函件'],
    [/salary certificate/gi, '薪资证明'],
    [/board resolution/gi, '董事会决议'],
    [/please be informed/gi, '特此通知'],
    [/approved/gi, '已批准'],
    [/seven sunday/gi, '七日实业 (Seven Sunday)'],
    [/general manager/gi, '总经理'],
  ];

  const dictMap: Record<Exclude<AppLang, 'en'>, Array<[RegExp, string]>> = {
    am: amDict,
    om: omDict,
    ti: tiDict,
    ar: arDict,
    zh: zhDict,
  };

  let out = text;
  for (const [rx, rep] of dictMap[lang]) {
    out = out.replace(rx, rep);
  }
  const prefixMap: Record<Exclude<AppLang, 'en'>, string> = {
    am: '[አማርኛ ትርጉም] ',
    om: '[Hiika Afaan Oromoo] ',
    ti: '[ትግርኛ ትርጉም] ',
    ar: '[الترجمة العربية] ',
    zh: '[中文译文] ',
  };
  const prefix = prefixMap[lang];
  return out.startsWith(prefix) ? out : `${prefix}${out}`;
}

export interface DocumentTemplateDef {
  key: string;
  category: string;
  label: string;
  en: { title: string; body: string };
  am: { title: string; body: string };
  om: { title: string; body: string };
  ti: { title: string; body: string };
  ar: { title: string; body: string };
  zh: { title: string; body: string };
}

export const DOCUMENT_TEMPLATES: DocumentTemplateDef[] = [
  {
    key: 'salary_cert',
    category: 'Salary Certificate',
    label: 'Salary Confirmation Letter',
    en: {
      title: 'Official Salary & Employment Confirmation Certificate',
      body: 'To Whom It May Concern,\n\nThis is to certify that the named employee is a permanent full-time staff member of Seven Sunday Manufacturing & Trading PLC in good standing. This official letter is issued upon request for banking and administrative verification.',
    },
    am: {
      title: 'ይፋዊ የደመወዝ እና የሥራ ማረጋገጫ ደብዳቤ',
      body: 'ለሚመለከተው ሁሉ፣\n\nከላይ የተጠቀሱት ሰራተኛ በሰቨን ሰንደይ ማኑፋክቸሪንግ እና ትሬዲንግ ኃ/የተ/የግ/ማህበር ውስጥ በቋሚነት በማገልገል ላይ የሚገኙ መሆናቸውን እናረጋግጣለን።',
    },
    om: {
      title: 'Waraqaa Ragaa Mindaa fi Hojii',
      body: 'Qaama dhimmi ilaallatuuf,\n\nHojjetaan maqaan isaanii armaan olitti eerame dhaabbata Seven Sunday Manufacturing & Trading PLC keessatti hojjetaa dhaabbii ta’uu isaanii ni mirkaneessina.',
    },
    ti: {
      title: 'ወግዓዊ መረጋገጺ ደሞዝን ስራሕን',
      body: 'ንዝምልከቶ ኩሉ፣\n\nኣብ ላዕሊ ዝተጠቕሱ ሰራሕተኛ ኣብ ሰቨን ሰንደይ ማኑፋክቸሪንግን ትሬዲንግን ቀዋሚ ሰራሕተኛ ምዃኖም ነረጋግጽ።',
    },
    ar: {
      title: 'شهادة رسمية لتأكيد الراتب والعمل',
      body: 'إلى من يهمه الأمر،\n\nنشهد بأن الموظف المذكور يعمل بصفة دائمة بدوام كامل لدى شركة سفن صنداي للتصنيع والتجارة.',
    },
    zh: {
      title: '正式在职及薪资证明',
      body: '敬启者：\n\n兹证明上述员工系 Seven Sunday Manufacturing & Trading PLC 正式全职在职员工，表现良好。特此出具本证明。',
    },
  },
  {
    key: 'official_memo',
    category: 'Official Memo',
    label: 'Internal Executive Directive Memo',
    en: {
      title: 'Internal Executive Directive & Operational Notice',
      body: 'TO: All Department Heads & Factory Supervisors\nFROM: Corporate Secretary & General Management\n\nAll departments are instructed to synchronize daily attendance logs, material requisitions (GIN/GRN), and equipment maintenance checks before 17:00 EAT each working day.',
    },
    am: {
      title: 'የውስጥ አስፈጻሚ መመሪያ እና የሥራ ማስታወሻ',
      body: 'ለሁሉም የሥራ ክፍል ኃላፊዎች፣\nየዕለት ተዕለት የመገኘት መዝገብ፣ የዕቃ ወጪ/ገቢ (GIN/GRN) እና የማሽን ጥገና መረጃዎች በየቀኑ እንዲመዘገቡ እናሳስባለን።',
    },
    om: {
      title: 'Yaadannoo Qajeelfama Hojii Keessoo',
      body: 'Itti gaafatamtoota kutaa hojii hundaa tiif,\nGalmeen argamuu guyyaa guyyaa fi sochiin meeshaalee (GIN/GRN) yeroo isaa eeggatee akka galmaa’u ni beeksifna.',
    },
    ti: {
      title: 'ውሽጣዊ መምርሒ ስራሕን መፍለጢን',
      body: 'ንኹሎም ሓለፍቲ ክፍልታት፣\nዕለታዊ መዝገብ ምርካብን ምንቅስቓስ ኣቑሑትን (GIN/GRN) ቅድሚ ሰዓት 11፡00 ክምዝገብ ነተሓሳስብ።',
    },
    ar: {
      title: 'توجيه تنفيذي داخلي وإشعار تشغيلي',
      body: 'إلى جميع رؤساء الأقسام والمشرفين،\nيرجى مزامنة سجلات الحضور اليومية وطلبات المواد (GIN/GRN) وفحوصات الصيانة قبل الساعة 17:00.',
    },
    zh: {
      title: '内部执行指令与运营通知',
      body: '致各部门主管：\n请每日17:00前完成考勤记录、物料进出库（GIN/GRN）及设备点检同步。',
    },
  },
  {
    key: 'warning_letter',
    category: 'Warning Letter',
    label: 'Formal HR Warning Notice',
    en: {
      title: 'Formal Attendance & Policy Compliance Warning',
      body: 'Dear Employee,\n\nFollowing a review of factory shift attendance and operational safety compliance logs, this formal notice is recorded in your HR file. Please adhere strictly to scheduled shift hours and safety PPE requirements.',
    },
    am: {
      title: 'ይፋዊ የሥነ-ሥርዓት እና የሰዓት አጠባበቅ ማስጠንቀቂያ',
      body: 'ውድ ሰራተኛ፣\nየሥራ ሰዓት አጠባበቅ እና የደህንነት መመሪያዎችን በጥብቅ እንዲያከብሩ በይፋ እናሳስባለን።',
    },
    om: {
      title: 'Akeekkachiisa Idilee Hojii fi Naamusa',
      body: 'Kabajamaa Hojjetaa,\nSa’aatii hojii fi qajeelfama nageenyaa hojii irratti akka eeggattan isin akeekkachiifna.',
    },
    ti: {
      title: 'ወግዓዊ መጠንቀቕታ ሰዓትን ስነ-ስርዓትን',
      body: 'ዝኸበርኩም ሰራሕተኛ፣\nሰዓት ስራሕን መምርሒታት ድሕንነትን ብጥብቂ ክትሕልዉ ብወግዒ ነተሓሳስብ።',
    },
    ar: {
      title: 'إنذار رسمي بالالتزام بالحضور والسياسات',
      body: 'عزيزي الموظف،\nيرجى الالتزام الصارم بساعات العمل المجدولة ومتطلبات السلامة المهنية.',
    },
    zh: {
      title: '正式考勤与合规警告通知',
      body: '员工您好：\n经核查班次考勤及安全规范记录，现出具正式书面提醒，请严格遵守出勤时间与劳保规范。',
    },
  },
];
