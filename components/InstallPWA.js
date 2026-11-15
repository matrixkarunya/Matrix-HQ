"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

export default function InstallPWA() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
      setShowPopup(true);
    }

    function handleAppInstalled() {
      setShowPopup(false);
      setInstallPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;

    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch (error) {
      console.error("PWA install error:", error);
    } finally {
      setInstallPrompt(null);
      setShowPopup(false);
    }
  }

  if (!showPopup || !installPrompt) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setShowPopup(false);
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-pwa-title"
        className="relative w-full max-w-md rounded-t-3xl border border-white/10 bg-neutral-950/90 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white shadow-2xl shadow-black/60 backdrop-blur-2xl sm:rounded-2xl"
      >
        <button
          type="button"
          onClick={() => setShowPopup(false)}
          aria-label="Close"
          className="!min-h-0 absolute right-4 top-4 flex size-8 items-center justify-center !rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        <span className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-violet-500/15 text-violet-200">
          <Download className="size-5" aria-hidden="true" />
        </span>

        <p className="mt-4 text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80">App</p>
        <h2 id="install-pwa-title" className="mt-1.5 text-2xl font-semibold">
          Install MATRIX HQ
        </h2>
        <p className="mt-2 text-sm text-white/60">
          Add MATRIX HQ to your device for quick access to your dashboard, events and tasks.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setShowPopup(false)}
            className="!min-h-0 !rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            Maybe later
          </button>
          <button
            type="button"
            onClick={handleInstall}
            className="!min-h-0 !rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          >
            Install
          </button>
        </div>
      </section>
    </div>
  );
}