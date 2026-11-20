import React, { useState } from 'react';
import { Download, Share, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;
  if (!isInstallable && !isIOS) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => (isIOS ? setShowIOSGuide(true) : install())}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#18243A] hover:bg-[#243656] rounded-lg transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5 text-[#38BDF8]" />
        Install App
      </button>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 bg-[#18243A]/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-sm w-full p-5 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src="/assets/aistudio/Seven_Sunday_app_icon_e967a609.png"
                  alt="Seven Sunday"
                  className="w-7 h-7 rounded-md object-contain bg-white border border-slate-200 p-0.5"
                />
                <h3 className="text-sm font-bold text-[#172033] dark:text-white">Install Seven Sunday EMS</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg"
                aria-label="Close install guide"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              On Safari for iOS/iPadOS, tap the{' '}
              <span className="inline-flex items-center gap-1 font-semibold text-[#172033] dark:text-white">
                <Share className="w-3.5 h-3.5" /> Share
              </span>{' '}
              button in the toolbar, then choose <strong>Add to Home Screen</strong> to install Seven Sunday EMS for offline access.
            </p>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC<{ pendingCount: number }> = ({ pendingCount }) => {
  const isOnline = useOnlineStatus();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`no-print px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 border-b ${
        !isOnline
          ? 'bg-[#EAF4FF] dark:bg-amber-950/60 text-[#18243A] dark:text-amber-200 border-[#087CEB]'
          : 'bg-[#18243A] text-[#38BDF8] border-[#087CEB]/35'
      }`}
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      {!isOnline ? (
        <span>
          Offline Mode Active — Reading cached records from IndexedDB. New changes will queue ({pendingCount} pending) and sync automatically when online.
        </span>
      ) : (
        <span>Reconnected — Syncing {pendingCount} queued offline change(s) to Seven Sunday SQLite server...</span>
      )}
    </div>
  );
};
