export type PaperOrientation = 'portrait' | 'landscape';

export interface PrintAutoFitOptions {
  orientation?: PaperOrientation;
  /** Optional CSS selector targeting the element to measure (defaults to primary .print-only-container) */
  targetSelector?: string;
  /** Printable margin in mm (kept compact for wide tables so nothing cuts off) */
  marginMm?: number;
  /** Optional natural width in px to assume if DOM hasn't expanded */
  expectedWidthPx?: number;
  /** Whether to auto-scale content down if wider than printable paper width */
  autoScale?: boolean;
}

const DYNAMIC_PRINT_STYLE_ID = 'ss-dynamic-print-style';

/** Safe printable pixel widths at 96dpi (with 6-8mm page margins subtracted + printer safety buffer) */
function getPrintableWidthPx(orientation: PaperOrientation, marginMm: number): number {
  const pageMm = orientation === 'landscape' ? 297 : 210;
  const usableMm = Math.max(120, pageMm - marginMm * 2 - 4);
  return Math.floor((usableMm * 96) / 25.4);
}

function measureContentWidth(target: HTMLElement): number {
  // Temporarily inspect tables and sheets inside target to find the widest unscaled content width
  let widest = target.scrollWidth || target.getBoundingClientRect().width;
  const candidates = target.querySelectorAll<HTMLElement>(
    '.a4-landscape-sheet, .a4-sheet, table, .ss-print-measure'
  );
  candidates.forEach((el) => {
    const style = window.getComputedStyle(el);
    if (style.display === 'none') return;
    const w = Math.max(el.scrollWidth, el.offsetWidth);
    if (w > widest) widest = w;
  });
  return widest;
}

export function clearDynamicPrintFit(): void {
  const existing = document.getElementById(DYNAMIC_PRINT_STYLE_ID);
  if (existing) existing.remove();
  document.documentElement.removeAttribute('data-print-orientation');
}

export function applyDynamicPrintFit(options: PrintAutoFitOptions = {}): number {
  if (typeof document === 'undefined') return 1;

  const orientation: PaperOrientation = options.orientation || 'portrait';
  const marginMm = options.marginMm ?? (orientation === 'landscape' ? 6 : 8);
  const autoScale = options.autoScale !== false;

  const targetEl =
    (options.targetSelector
      ? document.querySelector<HTMLElement>(options.targetSelector)
      : null) ||
    document.querySelector<HTMLElement>('.print-only-container[data-print-active="true"]') ||
    document.querySelector<HTMLElement>('.print-only-container') ||
    document.querySelector<HTMLElement>('main');

  const printablePx = getPrintableWidthPx(orientation, marginMm);
  let measuredPx = options.expectedWidthPx || printablePx;
  if (targetEl) {
    measuredPx = Math.max(measureContentWidth(targetEl), options.expectedWidthPx || 0);
  }

  let zoomRatio = 1;
  if (autoScale && measuredPx > printablePx && measuredPx > 0) {
    // Fit comfortably inside printable bounds with a 2% safety cushion
    zoomRatio = Math.max(0.45, Math.min(1, Number(((printablePx / measuredPx) * 0.98).toFixed(3))));
  }

  clearDynamicPrintFit();
  document.documentElement.setAttribute('data-print-orientation', orientation);

  const zoomSelector =
    targetEl && !targetEl.classList.contains('print-only-container') && !targetEl.closest('.print-only-container')
      ? '.app-main-shell'
      : '.print-only-container';

  const style = document.createElement('style');
  style.id = DYNAMIC_PRINT_STYLE_ID;
  style.media = 'print';
  style.textContent = `
    @page {
      size: A4 ${orientation};
      margin: ${marginMm}mm;
    }
    @media print {
      ${zoomSelector} {
        ${zoomRatio < 0.995 ? `zoom: ${zoomRatio};` : ''}
      }
      @supports not (zoom: 1) {
        ${zoomSelector} {
          ${
            zoomRatio < 0.995
              ? `transform: scale(${zoomRatio}); transform-origin: top left; width: ${(100 / zoomRatio).toFixed(2)}% !important;`
              : ''
          }
        }
      }
    }
  `;
  document.head.appendChild(style);
  return zoomRatio;
}

/**
 * Measures printable content, ensures @page orientation + fit-to-paper zoom are applied BEFORE printing,
 * invokes window.print(), and cleans up dynamic print styles cleanly afterwards.
 */
export function printWithAutoFit(options: PrintAutoFitOptions = {}): void {
  applyDynamicPrintFit(options);

  const cleanup = () => {
    clearDynamicPrintFit();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup, { once: true });

  // Allow style tag paint flush before opening print dialog
  window.requestAnimationFrame(() => {
    window.print();
    // Fallback cleanup for browsers where afterprint can be delayed
    window.setTimeout(cleanup, 1500);
  });
}

/**
 * Installs a global beforeprint/afterprint listener so even Ctrl+P / Cmd+P or browser menu Print
 * automatically detects the visible sheet's orientation (landscape vs portrait) and fits everything cleanly to paper.
 */
export function installGlobalBeforePrintFit(): () => void {
  const onBeforePrint = () => {
    // Only apply if printWithAutoFit hasn't already injected a dynamic print style
    if (document.getElementById(DYNAMIC_PRINT_STYLE_ID)) return;

    const hasLandscapeSheet = Boolean(
      document.querySelector('.print-only-container .a4-landscape-sheet, .print-only-container[data-print-orientation="landscape"]')
    );
    const activeContainer = document.querySelector<HTMLElement>('.print-only-container');
    const widestTable = activeContainer?.querySelector<HTMLElement>('table');
    const wideContent = widestTable ? widestTable.scrollWidth > 860 : false;

    const orientation: PaperOrientation = hasLandscapeSheet || wideContent ? 'landscape' : 'portrait';
    applyDynamicPrintFit({ orientation });
  };

  const onAfterPrint = () => {
    clearDynamicPrintFit();
  };

  window.addEventListener('beforeprint', onBeforePrint);
  window.addEventListener('afterprint', onAfterPrint);
  return () => {
    window.removeEventListener('beforeprint', onBeforePrint);
    window.removeEventListener('afterprint', onAfterPrint);
    clearDynamicPrintFit();
  };
}
