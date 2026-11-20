import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Printer, CheckCircle2 } from 'lucide-react';
import { printWithAutoFit, type PaperOrientation } from '../utils/printFit';

interface PrintableSheetFrameProps {
  orientation: PaperOrientation;
  children: React.ReactNode;
  /** Label shown in the compact fit-bar */
  documentLabel?: string;
  /** Optional callback to switch orientation from inside the frame */
  onOrientationChange?: (next: PaperOrientation) => void;
  /** Optional extra className on outer wrapper */
  className?: string;
  /** Optional custom selector for print measurement */
  targetSelector?: string;
  /** Hide the top toolbar if the parent module already renders full print controls */
  hideToolbar?: boolean;
}

const MM_TO_PX = 96 / 25.4;

export const PrintableSheetFrame: React.FC<PrintableSheetFrameProps> = ({
  orientation,
  children,
  documentLabel = 'Document Sheet',
  onOrientationChange,
  className = '',
  targetSelector,
  hideToolbar = false,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const [fitMode, setFitMode] = useState<'fit' | 'actual'>('fit');
  const [stageWidth, setStageWidth] = useState<number>(1000);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({
    w: Math.round((orientation === 'landscape' ? 297 : 210) * MM_TO_PX),
    h: Math.round((orientation === 'landscape' ? 210 : 297) * MM_TO_PX),
  });

  const naturalPaperWidthPx = Math.round((orientation === 'landscape' ? 297 : 210) * MM_TO_PX);

  useEffect(() => {
    const stageEl = stageRef.current;
    const contentEl = contentRef.current;
    if (!stageEl || !contentEl) return;

    const updateMetrics = () => {
      const available = Math.max(260, stageEl.clientWidth - 16);
      setStageWidth(available);

      const childSheet =
        contentEl.querySelector<HTMLElement>('.a4-landscape-sheet, .a4-sheet') || contentEl;
      const measuredW = Math.max(naturalPaperWidthPx, childSheet.scrollWidth || naturalPaperWidthPx);
      const measuredH = Math.max(childSheet.scrollHeight || 400, 320);
      setNaturalSize({ w: measuredW, h: measuredH });
    };

    updateMetrics();
    const ro = new ResizeObserver(() => updateMetrics());
    ro.observe(stageEl);
    ro.observe(contentEl);
    window.addEventListener('resize', updateMetrics);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateMetrics);
    };
  }, [orientation, naturalPaperWidthPx, children]);

  const rawScale = stageWidth / Math.max(1, naturalSize.w);
  const activeScale = fitMode === 'fit' ? Math.min(1, Math.max(0.28, rawScale)) : 1;
  const isScaledDown = fitMode === 'fit' && activeScale < 0.995;

  const printableLimitPx = Math.round(((orientation === 'landscape' ? 285 : 194) * 96) / 25.4);
  const printAutoRatio =
    naturalSize.w > printableLimitPx
      ? Math.max(45, Math.round((printableLimitPx / naturalSize.w) * 98))
      : 100;

  return (
    <div className={`space-y-2.5 ${className}`}>
      {!hideToolbar && (
        <div className="no-print flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Print-Ready: {documentLabel}
            </span>
            <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
              {orientation === 'landscape' ? 'A4 Landscape (297×210mm)' : 'A4 Portrait (210×297mm)'}
              {printAutoRatio < 100 ? ` · Auto-Fit ${printAutoRatio}%` : ' · 100% Fit (0 Cutoff)'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {onOrientationChange && (
              <div className="flex items-center gap-0.5 p-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                <button
                  type="button"
                  onClick={() => onOrientationChange('portrait')}
                  className={`px-2 py-1 text-[11px] font-semibold rounded ${
                    orientation === 'portrait'
                      ? 'bg-[#18243A] text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Portrait
                </button>
                <button
                  type="button"
                  onClick={() => onOrientationChange('landscape')}
                  className={`px-2 py-1 text-[11px] font-semibold rounded ${
                    orientation === 'landscape'
                      ? 'bg-[#18243A] text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Landscape
                </button>
              </div>
            )}

            <div className="flex items-center gap-0.5 p-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
              <button
                type="button"
                onClick={() => setFitMode('fit')}
                className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded whitespace-nowrap ${
                  fitMode === 'fit'
                    ? 'bg-[#087CEB] text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
                title="Automatically fit sheet width to your device screen"
              >
                <Minimize2 className="w-3 h-3" />
                Fit Screen ({Math.round(activeScale * 100)}%)
              </button>
              <button
                type="button"
                onClick={() => setFitMode('actual')}
                className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded whitespace-nowrap ${
                  fitMode === 'actual'
                    ? 'bg-[#087CEB] text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
                title="View 100% actual paper size with safe horizontal scroll"
              >
                <Maximize2 className="w-3 h-3" />
                100% Edit
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                printWithAutoFit({
                  orientation,
                  targetSelector: targetSelector || '.print-only-container[data-print-active="true"]',
                  expectedWidthPx: naturalSize.w,
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold text-white bg-[#18243A] hover:bg-[#172033] rounded-lg whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-[#38BDF8]" />
              Fit &amp; Print
            </button>
          </div>
        </div>
      )}

      {/* Responsive Screen Stage — never clips left side on narrow phones/tablets */}
      <div ref={stageRef} className="sheet-scroll-stage pb-3">
        <div
          className="ss-screen-scale-box mx-auto"
          style={
            isScaledDown
              ? {
                  width: `${Math.round(naturalSize.w * activeScale)}px`,
                  height: `${Math.round(naturalSize.h * activeScale)}px`,
                  overflow: 'hidden',
                }
              : {
                  width: 'fit-content',
                }
          }
        >
          <div
            ref={contentRef}
            className="ss-screen-scale-inner"
            style={
              isScaledDown
                ? {
                    width: `${naturalSize.w}px`,
                    transform: `scale(${activeScale})`,
                    transformOrigin: 'top left',
                  }
                : undefined
            }
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
