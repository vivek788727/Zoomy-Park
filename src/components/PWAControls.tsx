import React, { useState } from 'react';
import { Download, WifiOff } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="h-12 px-4 rounded-2xl bg-[#FFFDF7] hover:bg-amber-50 text-slate-900 border-2 border-slate-900 shadow-md flex items-center gap-2 font-display font-bold text-sm hover:scale-105 active:scale-95 transition-transform cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
      >
        <Download className="w-4 h-4 stroke-[2.5]" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="h-12 px-4 rounded-2xl bg-[#FFFDF7] hover:bg-amber-50 text-slate-900 border-2 border-slate-900 shadow-md flex items-center gap-2 font-display font-bold text-sm cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
        >
          <Download className="w-4 h-4 stroke-[2.5]" />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          >
            <div className="w-full max-w-sm rounded-3xl bg-[#FFFDF7] border-3 border-slate-900 p-6 shadow-[0_8px_0_#0F172A]">
              <h3 className="font-display font-bold text-xl text-slate-900">
                Install Zoomy Park
              </h3>
              <p className="mt-2 text-sm font-medium text-slate-700 leading-relaxed">
                1. Tap the <strong>Share</strong> button in Safari.<br />
                2. Tap <strong>Add to Home Screen</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full py-2.5 rounded-2xl bg-amber-400 text-slate-950 font-display font-bold border-2 border-slate-900 cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-2xl bg-amber-400 border-2 border-slate-900 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-md pointer-events-none"
    >
      <WifiOff className="w-4 h-4" />
      <span>Offline Mode · Game Still Works</span>
    </div>
  );
};
