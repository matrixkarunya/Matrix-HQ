"use client";

import { useEffect, useState } from "react";

export default function AppSplash() {
  const [show, setShow] = useState(true);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    // Only show inside the installed app, not in a normal browser tab
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone;

    if (!standalone) {
      setShow(false);
      return;
    }

    const t1 = setTimeout(() => setFade(true), 900);
    const t2 = setTimeout(() => setShow(false), 1400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[100000] flex items-center justify-center bg-[#05070F] transition-opacity duration-500 ${
        fade ? "opacity-0" : "opacity-100"
      }`}
    >
        <img src="/icons/icon-512.png" alt="" className="w-44 sm:w-56" />
    </div>
  );
}