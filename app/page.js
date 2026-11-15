"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ROLE_HOME } from "@/lib/config";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const { user, role, profileCompleted, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || !role) {
      router.replace("/login");
      return;
    }

    if (role === "superadmin") {
      router.replace(ROLE_HOME[role]);
      return;
    }

    if (profileCompleted) {
      router.replace(ROLE_HOME[role]);
      return;
    }

    if (!loading && role !== "superadmin" && !profileCompleted) {
      router.replace("/profile");
    }
  }, [loading, profileCompleted, role, router, user]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-black/85 text-white backdrop-blur-md"
    >
      <div className="relative flex size-24 items-center justify-center">
        <div
          className="absolute inset-0 rounded-full bg-violet-500/30 blur-2xl motion-safe:animate-pulse"
          aria-hidden="true"
        />

        <div
          className="absolute inset-0 rounded-full border border-white/10"
          aria-hidden="true"
        />

        <div
          className="absolute inset-0 animate-spin rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,rgba(167,139,250,0.15)_120deg,rgb(167,139,250)_300deg,rgb(125,211,252)_360deg)] [-webkit-mask:radial-gradient(farthest-side,transparent_calc(100%-4px),#000_calc(100%-4px))] [mask:radial-gradient(farthest-side,transparent_calc(100%-4px),#000_calc(100%-4px))] [animation-duration:1.1s] motion-reduce:animate-pulse"
          aria-hidden="true"
        />

        <div
          className="size-2.5 rounded-full bg-violet-400 shadow-[0_0_14px_rgba(167,139,250,0.9)] motion-safe:animate-pulse"
          aria-hidden="true"
        />
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold tracking-[0.3em] text-white">MATRIX</p>
        <p className="mt-2 text-xs uppercase tracking-[.22em] text-violet-300/80">Loading</p>
      </div>

      <span className="sr-only">Loading, please wait</span>
    </div>
  );
}