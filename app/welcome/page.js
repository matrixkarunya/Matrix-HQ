"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ROLE_HOME } from "@/lib/config";
import { useAuth } from "@/context/AuthContext";

const GLASS =
  "rounded-2xl border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/30 backdrop-blur-2xl";

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "M";
  return ((parts[0][0] || "") + (parts.length > 1 ? parts[1][0] : "")).toUpperCase();
}

export default function WelcomePage() {
  const { user, role, profile, profileCompleted, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (role === "superadmin") {
      router.replace(ROLE_HOME[role]);
      return;
    }

    if (!profileCompleted) {
      router.replace("/profile");
    }
  }, [loading, profileCompleted, role, router, user]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-8 text-white">
        <div className={`${GLASS} h-72 w-full max-w-md animate-pulse`} aria-busy="true">
          <span className="sr-only">Loading</span>
        </div>
      </main>
    );
  }

  const name = profile?.fullName || "there";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 text-white">
      <section className={`${GLASS} w-full max-w-md p-8 text-center sm:p-10`}>
        <div className="mx-auto flex size-20 items-center justify-center rounded-full border border-white/15 bg-violet-500/20 text-2xl font-semibold text-violet-100 shadow-lg shadow-black/30">
          {initials(profile?.fullName)}
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80">Welcome</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Hi {name}</h1>
        <span className="mt-4 inline-flex rounded-full border border-violet-300/30 bg-violet-500/15 px-3 py-1 text-xs font-medium text-violet-100">
          {profile?.designation || "Member"}
        </span>

        <button
          type="button"
          onClick={() => router.push(ROLE_HOME[role])}
          className="group mt-8 !min-h-0 inline-flex w-full items-center justify-center gap-2 whitespace-nowrap !rounded-full bg-white px-5 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
        >
          Continue to dashboard
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
        </button>
      </section>
    </main>
  );
}