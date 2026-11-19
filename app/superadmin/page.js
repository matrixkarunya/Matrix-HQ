"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarRange } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import DashboardStats from "@/components/DashboardStats";
import { useAuth } from "@/context/AuthContext";
import { useSemester } from "@/context/SemesterContext";
import { semesterLabel } from "@/lib/semesters";

const GLASS = "rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20 backdrop-blur-xl";

function SuperadminDashboard() {
  const { user, profile } = useAuth();
  const { activeSemester, loading } = useSemester();
  const name = profile?.fullName || user?.displayName || "Superadmin";
  const firstName = String(name).split(" ")[0];

  return (
    <div className="w-full text-white">
      <p className="text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80">Superadmin dashboard</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">Hi {firstName}</h1>
      <p className="mt-1.5 text-sm text-white/50">Signed in as {user?.email}</p>

      <Link
        href="/superadmin/semesters"
        className={`${GLASS} group mt-6 flex items-center justify-between gap-4 p-4 transition duration-200 hover:bg-white/[0.09] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:p-5`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-violet-500/15 text-violet-200">
            <CalendarRange className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[.14em] text-white/50">Active semester</p>
            <p className={`mt-0.5 truncate text-lg font-semibold ${!loading && !activeSemester ? "text-amber-200" : ""}`}>
              {loading ? "—" : activeSemester ? semesterLabel(activeSemester) : "None, tap to start one"}
            </p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-white/60 transition group-hover:text-white">
          Manage
          <ArrowUpRight className="size-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </Link>

      <DashboardStats role="superadmin" email={user?.email} />
    </div>
  );
}

export default function SuperadminPage() {
  return (
    <RoleGuard allow={["superadmin"]}>
      <SuperadminDashboard />
    </RoleGuard>
  );
}