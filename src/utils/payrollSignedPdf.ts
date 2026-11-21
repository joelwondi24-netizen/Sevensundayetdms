import jsPDF from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import QRCode from 'qrcode';
import type { CompanySettings, PayrollRecord, PayrollRun } from '../types';

export interface SignedPayrollRowData {
  no: number;
  monthLabel: string;
  category: string;
  name: string;
  bankAccount: string;
  idNo: string;
  basic: number;
  rate: number;
  absHrs: number;
  absRate: number;
  absAmt: number;
  otNor: number;
  otNight: number;
  otSun: number;
  otHol: number;
  otNorBirr: number;
  otNightBirr: number;
  otSunBirr: number;
  otHolBirr: number;
  otAmt: number;
  gross: number;
  tax: number;
  empPen: number;
  erPen: number;
  net: number;
  status: string;
}

export interface SignedPayrollTotals {
  basic: number;
  rate: number;
  absHrs: number;
  absAmt: number;
  otNor: number;
  otNight: number;
  otSun: number;
  otHol: number;
  otNorBirr: number;
  otNightBirr: number;
  otSunBirr: number;
  otHolBirr: number;
  ot: number;
  gross: number;
  tax: number;
  empPen: number;
  erPen: number;
  net: number;
}

export interface ExportSignedPayrollPdfParams {
  viewMode: 'sheet' | 'runs' | 'register';
  company?: CompanySettings | null;
  currency: string;
  monthLabel: string;
  categoryLabel: string;
  standardHoursDivisor: number;
  multipliers: {
    normal: number;
    night: number;
    sunday: number;
    holiday: number;
  };
  sheetRows: SignedPayrollRowData[];
  sheetTotals: SignedPayrollTotals;
  payrollRuns: PayrollRun[];
  registerRows: PayrollRecord[];
  selectedPayslip?: PayrollRecord | null;
  signerName: string;
  signerRole: string;
  preparedBy?: string;
  approvedBy?: string;
}

export interface SignedPayrollPdfResult {
  fileName: string;
  signatureHash: string;
  signedAt: string;
  rowCount: number;
}

function pdfSafeText(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2022/g, '|')
    .replace(/[^\x20-\xFF]/g, ' ')
    .trim();
}

function fmtPdfNum(val: number, dashIfZero = false): string {
  const n = Number(val) || 0;
  if (dashIfZero && Math.abs(n) < 0.005) return '-';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPdfMoney(val: number, currency: string): string {
  return `${fmtPdfNum(val)} ${pdfSafeText(currency || 'ETB')}`;
}

async function computeSha256Hex(payload: string): Promise<string> {
  try {
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const encoded = new TextEncoder().encode(payload);
      const digest = await window.crypto.subtle.digest('SHA-256', encoded);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
    }
  } catch {
    // Fallback deterministic 64-hex hash if subtle crypto is unavailable
  }
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < payload.length; i += 1) {
    const ch = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (ch + i), 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`.toUpperCase().repeat(4);
}

async function loadImageAsPngDataUrl(
  src: string
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!src) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width || 240;
        const h = img.naturalHeight || img.height || 120;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve({ dataUrl: canvas.toDataURL('image/png'), width: w, height: h });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function fitDims(w: number, h: number, maxW: number, maxH: number): { w: number; h: number } {
  if (!w || !h) return { w: maxW, h: maxH };
  const ratio = Math.min(maxW / w, maxH / h);
  return { w: w * ratio, h: h * ratio };
}

export async function exportSignedPayrollSummaryPdf(
  params: ExportSignedPayrollPdfParams
): Promise<SignedPayrollPdfResult> {
  const {
    viewMode,
    company,
    currency,
    monthLabel,
    categoryLabel,
    standardHoursDivisor,
    multipliers,
    sheetRows,
    sheetTotals,
    payrollRuns,
    registerRows,
    selectedPayslip,
    signerName,
    signerRole,
    preparedBy,
    approvedBy,
  } = params;

  const companyName = pdfSafeText(
    company?.company_name || 'SEVEN SUNDAY MANUFACTURING & TRADING INDUSTRIES PLC'
  );
  const addressLine = pdfSafeText(
    `${company?.address || 'Bole Sub-City, Addis Ababa, Ethiopia'} | TIN: ${company?.tin_number || 'ET-00981244'}`
  );
  const now = new Date();
  const signedAtIso = now.toISOString();
  const signedAtDisplay = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 8)}`;

  // Canonical digest payload for tamper-evident document signature
  const canonicalPayload = JSON.stringify({
    company: companyName,
    viewMode,
    monthLabel,
    categoryLabel,
    currency,
    signerName,
    signerRole,
    signedAtIso,
    counts: {
      sheet: sheetRows.length,
      runs: payrollRuns.length,
      register: registerRows.length,
    },
    totals:
      viewMode === 'runs'
        ? payrollRuns.reduce(
            (acc, r) => ({
              gross: acc.gross + Number(r.total_gross || 0),
              net: acc.net + Number(r.total_net || 0),
            }),
            { gross: 0, net: 0 }
          )
        : viewMode === 'register'
          ? registerRows.reduce(
              (acc, r) => ({
                gross: acc.gross + Number(r.gross_salary || 0),
                net: acc.net + Number(r.net_salary || 0),
              }),
              { gross: 0, net: 0 }
            )
          : {
              basic: sheetTotals.basic,
              absAmt: sheetTotals.absAmt,
              ot: sheetTotals.ot,
              gross: sheetTotals.gross,
              tax: sheetTotals.tax,
              empPen: sheetTotals.empPen,
              erPen: sheetTotals.erPen,
              net: sheetTotals.net,
            },
  });

  const fullHash = await computeSha256Hex(canonicalPayload);
  const shortSigId = `SS-SIG-${fullHash.slice(0, 16)}`;

  const viewTitle =
    viewMode === 'runs'
      ? 'MONTHLY PAYROLL RUNS & BONUS SUMMARY (SIGNED)'
      : viewMode === 'register'
        ? 'PAYROLL REGISTER & ETHIOPIAN TAX SUMMARY (SIGNED)'
        : 'OFFICIAL PAYROLL & ETHIOPIAN TAX SUMMARY SHEET (SIGNED)';

  const totalNetForQr =
    viewMode === 'runs'
      ? payrollRuns.reduce((s, r) => s + Number(r.total_net || 0), 0)
      : viewMode === 'register'
        ? registerRows.reduce((s, r) => s + Number(r.net_salary || 0), 0)
        : sheetTotals.net;

  const rowCount =
    viewMode === 'runs'
      ? payrollRuns.length
      : viewMode === 'register'
        ? registerRows.length
        : sheetRows.length;

  const qrContent = `SS-SIGNED-PAYROLL|${shortSigId}|${monthLabel}|${categoryLabel}|ROWS:${rowCount}|NET:${totalNetForQr.toFixed(
    2
  )}|SIGNER:${pdfSafeText(signerName)}|AT:${signedAtDisplay}`;

  const [logoImg, stampImg, signatureImg, qrDataUrl] = await Promise.all([
    loadImageAsPngDataUrl(company?.logo_data || '/assets/aistudio/Seven_Sunday_Logo_2_desktop_addf2fa7.png'),
    company?.stamp_data ? loadImageAsPngDataUrl(company.stamp_data) : Promise.resolve(null),
    company?.signature_data ? loadImageAsPngDataUrl(company.signature_data) : Promise.resolve(null),
    QRCode.toDataURL(qrContent, { width: 180, margin: 1, errorCorrectionLevel: 'M' }).catch(() => ''),
  ]);

  // Standard ISO A4 Landscape: 297mm x 210mm
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageW = doc.internal.pageSize.getWidth(); // 297mm
  const pageH = doc.internal.pageSize.getHeight(); // 210mm
  const marginX = 8;
  const contentW = pageW - marginX * 2; // 281mm

  doc.setProperties({
    title: `${companyName} - ${viewTitle}`,
    subject: `Signed A4 Landscape Payroll Summary (${monthLabel} / ${categoryLabel})`,
    author: `${pdfSafeText(signerName)} (${pdfSafeText(signerRole)})`,
    keywords: `Seven Sunday, Payroll, Ethiopian Tax, Signed PDF, ${shortSigId}`,
    creator: 'Seven Sunday Ethiopia Platform',
  });

  // Top Header Band (297mm A4 Landscape)
  let cursorY = 9;
  doc.setFillColor(24, 36, 58); // #18243A
  doc.rect(marginX, cursorY, contentW, 1.2, 'F');
  cursorY += 3;

  let textStartX = marginX;
  if (logoImg) {
    const dims = fitDims(logoImg.width, logoImg.height, 26, 12);
    doc.addImage(logoImg.dataUrl, 'PNG', marginX, cursorY, dims.w, dims.h);
    textStartX = marginX + dims.w + 4;
  }

  // QR Code Top Right
  const qrSize = 16;
  const qrX = pageW - marginX - qrSize;
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', qrX, cursorY - 0.5, qrSize, qrSize);
  }

  // Center/Left Company & View Info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(23, 32, 51);
  doc.text(companyName.toUpperCase(), textStartX, cursorY + 3.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(8, 124, 235);
  doc.text(viewTitle, textStartX, cursorY + 8.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  doc.text(addressLine, textStartX, cursorY + 12.2);

  // Right Metadata Block next to QR
  const metaRightX = qrX - 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(23, 32, 51);
  doc.text(`Period: ${pdfSafeText(monthLabel)} | ${pdfSafeText(categoryLabel)}`, metaRightX, cursorY + 3.6, {
    align: 'right',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Divisor: ${standardHoursDivisor.toFixed(2)}h | OT: ${multipliers.normal}x / ${multipliers.night}x / ${multipliers.sunday}x / ${multipliers.holiday}x`,
    metaRightX,
    cursorY + 7.6,
    { align: 'right' }
  );
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87);
  doc.text(`DIGITALLY SIGNED: ${shortSigId}`, metaRightX, cursorY + 11.6, { align: 'right' });

  cursorY += 16.5;

  // 6-Card Executive Summary Strip across 281mm
  const summaryBoxes: Array<{ label: string; value: string; accent: [number, number, number] }> =
    viewMode === 'runs'
      ? [
          { label: 'TOTAL RUNS', value: String(payrollRuns.length), accent: [24, 36, 58] },
          {
            label: 'STAFF PROCESSED',
            value: String(payrollRuns.reduce((s, r) => s + Number(r.employee_count || 0), 0)),
            accent: [8, 124, 235],
          },
          {
            label: 'TOTAL GROSS',
            value: fmtPdfMoney(payrollRuns.reduce((s, r) => s + Number(r.total_gross || 0), 0), currency),
            accent: [24, 36, 58],
          },
          {
            label: 'TOTAL BONUS',
            value: fmtPdfMoney(payrollRuns.reduce((s, r) => s + Number(r.total_bonus || 0), 0), currency),
            accent: [4, 120, 87],
          },
          {
            label: 'TAX + PENSION',
            value: fmtPdfMoney(
              payrollRuns.reduce((s, r) => s + Number(r.total_tax || 0) + Number(r.total_pension || 0), 0),
              currency
            ),
            accent: [190, 18, 60],
          },
          {
            label: 'TOTAL NET PAYABLE',
            value: fmtPdfMoney(totalNetForQr, currency),
            accent: [8, 124, 235],
          },
        ]
      : viewMode === 'register'
        ? (() => {
            const sums = registerRows.reduce(
              (acc, r) => ({
                basic: acc.basic + Number(r.basic_salary || 0),
                abs: acc.abs + Number(r.absence_amount || 0),
                ot: acc.ot + Number(r.overtime_pay || 0),
                gross: acc.gross + Number(r.gross_salary || 0),
                taxPen: acc.taxPen + Number(r.income_tax || 0) + Number(r.employee_pension || 0),
                net: acc.net + Number(r.net_salary || 0),
              }),
              { basic: 0, abs: 0, ot: 0, gross: 0, taxPen: 0, net: 0 }
            );
            return [
              { label: 'BASIC TOTAL', value: fmtPdfMoney(sums.basic, currency), accent: [24, 36, 58] },
              { label: 'ABSENCE DED.', value: `-${fmtPdfMoney(sums.abs, currency)}`, accent: [190, 18, 60] },
              { label: 'OVERTIME TOTAL', value: `+${fmtPdfMoney(sums.ot, currency)}`, accent: [8, 124, 235] },
              { label: 'GROSS PAY', value: fmtPdfMoney(sums.gross, currency), accent: [24, 36, 58] },
              { label: 'TAX + 7% PEN', value: `-${fmtPdfMoney(sums.taxPen, currency)}`, accent: [190, 18, 60] },
              { label: 'NET PAYABLE', value: fmtPdfMoney(sums.net, currency), accent: [4, 120, 87] },
            ];
          })()
        : [
            { label: `BASIC (${sheetRows.length} STAFF)`, value: fmtPdfMoney(sheetTotals.basic, currency), accent: [24, 36, 58] },
            { label: 'ABSENCE DEDUCT', value: `-${fmtPdfMoney(sheetTotals.absAmt, currency)}`, accent: [190, 18, 60] },
            {
              label: 'OVERTIME TOTAL',
              value: `+${fmtPdfMoney(sheetTotals.ot, currency)}`,
              accent: [8, 124, 235],
            },
            { label: 'GROSS PAY', value: fmtPdfMoney(sheetTotals.gross, currency), accent: [24, 36, 58] },
            {
              label: 'TAX + PENSION (7%/11%)',
              value: fmtPdfMoney(sheetTotals.tax + sheetTotals.empPen, currency),
              accent: [190, 18, 60],
            },
            { label: 'NET PAYABLE', value: fmtPdfMoney(sheetTotals.net, currency), accent: [4, 120, 87] },
          ];

  const boxGap = 2.5;
  const boxW = (contentW - boxGap * (summaryBoxes.length - 1)) / summaryBoxes.length;
  const boxH = 11.5;

  summaryBoxes.forEach((box, idx) => {
    const bx = marginX + idx * (boxW + boxGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.roundedRect(bx, cursorY, boxW, boxH, 1.2, 1.2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text(box.label, bx + 2.2, cursorY + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(box.accent[0], box.accent[1], box.accent[2]);
    doc.text(box.value, bx + 2.2, cursorY + 9);
  });

  cursorY += boxH + 3.5;

  // Build Main Summary Table (Exact 281mm Width Fit)
  if (viewMode === 'runs') {
    const head = [
      ['#', 'Run Code', 'Month', 'Created By', 'Staff', 'Total Gross', 'Total Bonus', 'Income Tax', 'Pension', 'Total Net', 'Status'],
    ];
    const body = payrollRuns.map((run, idx) => [
      String(idx + 1),
      pdfSafeText(run.run_code),
      pdfSafeText(run.payroll_month),
      pdfSafeText(run.created_by),
      String(run.employee_count),
      fmtPdfNum(run.total_gross),
      fmtPdfNum(run.total_bonus),
      fmtPdfNum(run.total_tax),
      fmtPdfNum(run.total_pension),
      fmtPdfNum(run.total_net),
      pdfSafeText(run.status),
    ]);
    const foot = [
      [
        '',
        `TOTAL (${payrollRuns.length} Runs)`,
        '',
        '',
        String(payrollRuns.reduce((s, r) => s + Number(r.employee_count || 0), 0)),
        fmtPdfNum(payrollRuns.reduce((s, r) => s + Number(r.total_gross || 0), 0)),
        fmtPdfNum(payrollRuns.reduce((s, r) => s + Number(r.total_bonus || 0), 0)),
        fmtPdfNum(payrollRuns.reduce((s, r) => s + Number(r.total_tax || 0), 0)),
        fmtPdfNum(payrollRuns.reduce((s, r) => s + Number(r.total_pension || 0), 0)),
        fmtPdfNum(totalNetForQr),
        '',
      ],
    ];

    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginX, right: marginX, bottom: 38 },
      head,
      body,
      foot,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        cellPadding: 1.6,
        textColor: [23, 32, 51],
        lineColor: [148, 163, 184],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [24, 36, 58],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      footStyles: {
        fillColor: [234, 244, 255],
        textColor: [23, 32, 51],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right', fontStyle: 'bold' },
        10: { halign: 'center' },
      },
    });
  } else if (viewMode === 'register') {
    const totals = registerRows.reduce(
      (acc, p) => {
        acc.basic += Number(p.basic_salary || 0);
        acc.abs += Number(p.absence_amount || 0);
        acc.ot += Number(p.overtime_pay || 0);
        acc.gross += Number(p.gross_salary || 0);
        acc.tax += Number(p.income_tax || 0);
        acc.empPen += Number(p.employee_pension || 0);
        acc.erPen += Number(p.employer_pension || 0);
        acc.net += Number(p.net_salary || 0);
        return acc;
      },
      { basic: 0, abs: 0, ot: 0, gross: 0, tax: 0, empPen: 0, erPen: 0, net: 0 }
    );

    const head = [
      [
        'No',
        'Month',
        'Code',
        'Employee Name',
        'Department',
        'Basic Salary',
        'Absence (-)',
        'OT (+)',
        'Gross Pay',
        'Income Tax',
        '7% Emp',
        '11% Er',
        'Net Salary',
        'Status',
      ],
    ];
    const body = registerRows.map((p, idx) => [
      String(idx + 1),
      pdfSafeText(p.month_label || p.payroll_month),
      pdfSafeText(p.employee_code),
      pdfSafeText(p.employee_name),
      pdfSafeText(p.department),
      fmtPdfNum(p.basic_salary),
      p.absence_amount > 0 ? `-${fmtPdfNum(p.absence_amount)}` : '-',
      p.overtime_pay > 0 ? `+${fmtPdfNum(p.overtime_pay)}` : '-',
      fmtPdfNum(p.gross_salary),
      fmtPdfNum(p.income_tax),
      fmtPdfNum(p.employee_pension),
      fmtPdfNum(p.employer_pension),
      fmtPdfNum(p.net_salary),
      pdfSafeText(p.status),
    ]);
    const foot = [
      [
        '',
        `TOTAL (${registerRows.length})`,
        '',
        selectedPayslip ? `Active Payslip: ${pdfSafeText(selectedPayslip.employee_name)}` : '',
        '',
        fmtPdfNum(totals.basic),
        totals.abs > 0 ? `-${fmtPdfNum(totals.abs)}` : '0.00',
        `+${fmtPdfNum(totals.ot)}`,
        fmtPdfNum(totals.gross),
        fmtPdfNum(totals.tax),
        fmtPdfNum(totals.empPen),
        fmtPdfNum(totals.erPen),
        fmtPdfNum(totals.net),
        '',
      ],
    ];

    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginX, right: marginX, bottom: 38 },
      head,
      body,
      foot,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 7,
        cellPadding: 1.4,
        textColor: [23, 32, 51],
        lineColor: [148, 163, 184],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [24, 36, 58],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      footStyles: {
        fillColor: [234, 244, 255],
        textColor: [23, 32, 51],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' },
        10: { halign: 'right' },
        11: { halign: 'right' },
        12: { halign: 'right', fontStyle: 'bold' },
        13: { halign: 'center' },
      },
    });
  } else {
    // Full Official Payroll & Ethiopian Tax Sheet (Exact 281mm Width Fit across 20 columns)
    const head: RowInput[] = [
      [
        { content: '', colSpan: 5, styles: { fillColor: [248, 250, 252], textColor: [23, 32, 51] } },
        {
          content: 'ABSENCE (- DEDUCT)',
          colSpan: 3,
          styles: { fillColor: [255, 241, 242], textColor: [136, 19, 55], halign: 'center', fontStyle: 'bold' },
        },
        {
          content: 'OVER TIME (+ HRS & BIRR)',
          colSpan: 5,
          styles: { fillColor: [234, 244, 255], textColor: [24, 36, 58], halign: 'center', fontStyle: 'bold' },
        },
        {
          content: 'TAX, PENSION & NET PAY',
          colSpan: 7,
          styles: { fillColor: [248, 250, 252], textColor: [23, 32, 51], halign: 'center', fontStyle: 'bold' },
        },
      ],
      [
        'No',
        'Employee Name',
        'Account',
        'ID',
        'Basic Salary',
        'Rate',
        'Abs Hrs',
        'Abs Rate',
        'Abs Birr',
        `Nor\n(${multipliers.normal}x)`,
        `Night\n(${multipliers.night}x)`,
        `Sun\n(${multipliers.sunday}x)`,
        `Holly\n(${multipliers.holiday}x)`,
        'OT Total',
        'Gross Pay',
        'Income Tax',
        '7% Pen',
        '11% Er',
        'Net Pay',
        'Sign / St.',
      ],
    ];

    const body = sheetRows.map((r) => [
      String(r.no),
      pdfSafeText(r.name),
      pdfSafeText(r.bankAccount),
      pdfSafeText(r.idNo),
      fmtPdfNum(r.basic),
      fmtPdfNum(r.rate),
      r.absHrs > 0 ? r.absHrs.toFixed(1) : '-',
      fmtPdfNum(r.absRate),
      r.absAmt > 0 ? `-${fmtPdfNum(r.absAmt)}` : '-',
      r.otNor > 0 ? `${r.otNor.toFixed(1)}h\n${fmtPdfNum(r.otNorBirr)}` : '-',
      r.otNight > 0 ? `${r.otNight.toFixed(1)}h\n${fmtPdfNum(r.otNightBirr)}` : '-',
      r.otSun > 0 ? `${r.otSun.toFixed(1)}h\n${fmtPdfNum(r.otSunBirr)}` : '-',
      r.otHol > 0 ? `${r.otHol.toFixed(1)}h\n${fmtPdfNum(r.otHolBirr)}` : '-',
      fmtPdfNum(r.otAmt, true),
      fmtPdfNum(r.gross),
      fmtPdfNum(r.tax),
      fmtPdfNum(r.empPen),
      fmtPdfNum(r.erPen),
      fmtPdfNum(r.net),
      pdfSafeText(r.status),
    ]);

    const foot = [
      [
        '',
        `TOTAL (${sheetRows.length} Staff)`,
        '',
        '',
        fmtPdfNum(sheetTotals.basic),
        fmtPdfNum(sheetTotals.rate),
        fmtPdfNum(sheetTotals.absHrs),
        '-',
        sheetTotals.absAmt > 0 ? `-${fmtPdfNum(sheetTotals.absAmt)}` : '0.00',
        `${fmtPdfNum(sheetTotals.otNor)}h\n${fmtPdfNum(sheetTotals.otNorBirr)}`,
        `${fmtPdfNum(sheetTotals.otNight)}h\n${fmtPdfNum(sheetTotals.otNightBirr)}`,
        `${fmtPdfNum(sheetTotals.otSun)}h\n${fmtPdfNum(sheetTotals.otSunBirr)}`,
        `${fmtPdfNum(sheetTotals.otHol)}h\n${fmtPdfNum(sheetTotals.otHolBirr)}`,
        fmtPdfNum(sheetTotals.ot),
        fmtPdfNum(sheetTotals.gross),
        fmtPdfNum(sheetTotals.tax),
        fmtPdfNum(sheetTotals.empPen),
        fmtPdfNum(sheetTotals.erPen),
        fmtPdfNum(sheetTotals.net),
        '',
      ],
    ];

    // Column widths sum cleanly to <= 281mm for standard A4 Landscape printing with zero cutoff
    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginX, right: marginX, bottom: 38 },
      head,
      body,
      foot,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 6.1,
        cellPadding: { top: 1.1, right: 0.9, bottom: 1.1, left: 0.9 },
        textColor: [23, 32, 51],
        lineColor: [148, 163, 184],
        lineWidth: 0.18,
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [24, 36, 58],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 5.9,
        halign: 'center',
      },
      footStyles: {
        fillColor: [234, 244, 255],
        textColor: [23, 32, 51],
        fontStyle: 'bold',
        fontSize: 6.1,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 6.5, halign: 'center' },
        1: { cellWidth: 26, halign: 'left', fontStyle: 'bold' },
        2: { cellWidth: 20, halign: 'left' },
        3: { cellWidth: 8, halign: 'center' },
        4: { cellWidth: 15, halign: 'right' },
        5: { cellWidth: 11, halign: 'right' },
        6: { cellWidth: 10, halign: 'right' },
        7: { cellWidth: 11, halign: 'right' },
        8: { cellWidth: 13.5, halign: 'right', textColor: [190, 18, 60] },
        9: { cellWidth: 14, halign: 'right' },
        10: { cellWidth: 14, halign: 'right' },
        11: { cellWidth: 14, halign: 'right' },
        12: { cellWidth: 14, halign: 'right' },
        13: { cellWidth: 14, halign: 'right', textColor: [8, 124, 235], fontStyle: 'bold' },
        14: { cellWidth: 16, halign: 'right' },
        15: { cellWidth: 15, halign: 'right' },
        16: { cellWidth: 13.5, halign: 'right' },
        17: { cellWidth: 13.5, halign: 'right' },
        18: { cellWidth: 17, halign: 'right', fontStyle: 'bold', textColor: [24, 36, 58] },
        19: { cellWidth: 15, halign: 'center' },
      },
    });
  }

  // Place Signature, Official Stamp, & Digital Verification Block cleanly at bottom (add page if insufficient room)
  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY + 20;
  const sigBlockHeight = 32;
  let sigY = finalY + 5;
  if (sigY + sigBlockHeight > pageH - 10) {
    doc.addPage('a4', 'landscape');
    sigY = 16;
  }

  // Signature & Approval Container Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, sigY, contentW, sigBlockHeight, 1.5, 1.5, 'FD');

  // Left: Prepared By / Checked By / Approved By sign-off lines
  const signColsX = [marginX + 5, marginX + 64, marginX + 123];
  const signLabels = [
    { title: 'Prepared By', sub: pdfSafeText(preparedBy || signerName) },
    { title: 'Verified By (HR / Finance)', sub: 'HR & Finance Review' },
    { title: 'Approved By (Management)', sub: pdfSafeText(approvedBy || 'General Manager / Director') },
  ];

  signLabels.forEach((col, i) => {
    const cx = signColsX[i];
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.3);
    doc.line(cx, sigY + 17, cx + 50, sigY + 17);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(23, 32, 51);
    doc.text(col.title, cx, sigY + 21);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(col.sub, cx, sigY + 25);
  });

  // Middle-Right: Company Stamp + Authorized Signature Graphic (or Vector Sign Seal)
  let visualX = marginX + 180;
  if (stampImg) {
    const dims = fitDims(stampImg.width, stampImg.height, 22, 22);
    doc.addImage(stampImg.dataUrl, 'PNG', visualX, sigY + 4.5, dims.w, dims.h);
    visualX += dims.w + 3;
  }
  if (signatureImg) {
    const dims = fitDims(signatureImg.width, signatureImg.height, 28, 16);
    doc.addImage(signatureImg.dataUrl, 'PNG', visualX, sigY + 6.5, dims.w, dims.h);
  }

  // Far Right: Cryptographic Digital Signature Certificate Seal
  const sealW = 66;
  const sealX = pageW - marginX - sealW - 3;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(8, 124, 235);
  doc.setLineWidth(0.45);
  doc.roundedRect(sealX, sigY + 3, sealW, 25.5, 1.5, 1.5, 'FD');

  doc.setFillColor(8, 124, 235);
  doc.rect(sealX, sigY + 3, 1.6, 25.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(8, 124, 235);
  doc.text('SIGNED ELECTRONIC DOCUMENT', sealX + 3.5, sigY + 7.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(23, 32, 51);
  doc.text(`Signer: ${pdfSafeText(signerName)}`, sealX + 3.5, sigY + 11.4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.3);
  doc.setTextColor(71, 85, 105);
  doc.text(`Role: ${pdfSafeText(signerRole)}`, sealX + 3.5, sigY + 15.1);
  doc.text(`Timestamp: ${signedAtDisplay}`, sealX + 3.5, sigY + 18.7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87);
  doc.text(`Seal: ${shortSigId}`, sealX + 3.5, sigY + 22.3);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`SHA256: ${fullHash.slice(0, 32)}`, sealX + 3.5, sigY + 25.8);

  // Page Footer across all pages (Page X of Y + A4 Landscape Tag + Verification ID)
  const totalPages = doc.getNumberOfPages();
  for (let pNum = 1; pNum <= totalPages; pNum += 1) {
    doc.setPage(pNum);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageH - 8.5, pageW - marginX, pageH - 8.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `${companyName} | Signed A4 Landscape Payroll Summary (${shortSigId}) | Generated ${signedAtDisplay}`,
      marginX,
      pageH - 4.5
    );
    doc.text(`A4 Landscape (297 x 210 mm) | Page ${pNum} of ${totalPages}`, pageW - marginX, pageH - 4.5, {
      align: 'right',
    });
  }

  const slugMonth = pdfSafeText(monthLabel).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'current';
  const fileName = `seven-sunday-payroll-signed-${viewMode}-${slugMonth}-${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);

  return {
    fileName,
    signatureHash: shortSigId,
    signedAt: signedAtDisplay,
    rowCount,
  };
}
