"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ROLE_HOME } from "@/lib/config";
import { useAuth } from "@/context/AuthContext";

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
    return <p className="p-6 text-sm text-neutral-600">Loading…</p>;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4 py-8">
      <div className="w-full rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-neutral-500">Welcome</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-neutral-900">
          Hi {profile?.fullName || "there"} 👋
        </h1>
        <p className="mt-3 text-lg text-neutral-700">
          {profile?.designation || "Member"}
        </p>

        <button
          type="button"
          onClick={() => router.push(ROLE_HOME[role])}
          className="mt-8 inline-flex w-full items-center justify-center rounded-md bg-black px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
        >
          Continue to dashboard
        </button>
      </div>
    </main>
  );
}
