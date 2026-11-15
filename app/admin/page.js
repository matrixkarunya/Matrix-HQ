"use client";

import RoleGuard from "@/components/RoleGuard";
import DashboardStats from "@/components/DashboardStats";
import { useAuth } from "@/context/AuthContext";

function AdminHome() {
  const { user, profile } = useAuth();
  const name = profile?.fullName || user?.displayName || "Admin";
  const firstName = String(name).split(" ")[0];

  return (
    <div className="w-full text-white">
      <p className="text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80">Admin dashboard</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">Hi {firstName}</h1>
      <p className="mt-1.5 text-sm text-white/50">Signed in as {user?.email}</p>

      <DashboardStats role="admin" email={user?.email} />
    </div>
  );
}

export default function AdminPage() {
  return (
    <RoleGuard allow={["admin"]}>
      <AdminHome />
    </RoleGuard>
  );
}