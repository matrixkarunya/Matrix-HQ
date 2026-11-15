"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ArrowUpRight, Inbox, LogOut } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";

const GLASS =
  "rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20 backdrop-blur-xl";

function PendingRequestBadge() {
  const { user, role, loading } = useAuth();
  const [count, setCount] = useState(0);
  const [eventIds, setEventIds] = useState([]);

  useEffect(() => {
    if (!db || loading || !user || !["admin", "superadmin"].includes(role)) return undefined;
    if (role === "superadmin") {
      return onSnapshot(collection(db, "completionRequests"), (snapshot) => {
        setCount(snapshot.docs.filter((item) => item.data().status === "pending").length);
      }, () => setCount(0));
    }
    return onSnapshot(query(collection(db, "events"), where("createdBy", "==", String(user.email || "").toLowerCase())), (snapshot) => {
      setEventIds(snapshot.docs.map((event) => event.id));
    }, () => setEventIds([]));
  }, [loading, role, user]);

  useEffect(() => {
    if (role !== "admin" || eventIds.length === 0) {
      if (role === "admin") setCount(0);
      return undefined;
    }
    const counts = new Map();
    const unsubscribers = eventIds.map((eventId) => onSnapshot(
      query(collection(db, "completionRequests"), where("eventId", "==", eventId)),
      (snapshot) => {
        counts.set(eventId, snapshot.docs.filter((item) => item.data().status === "pending").length);
        setCount([...counts.values()].reduce((total, value) => total + value, 0));
      },
      () => counts.delete(eventId),
    ));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [eventIds, role]);

  return count > 0 ? (
    <span
      className="rounded-full border border-violet-300/30 bg-violet-500/15 px-2 py-0.5 text-xs font-semibold text-violet-100"
      aria-label={`${count} pending`}
    >
      {count}
    </span>
  ) : null;
}

export default function RolePortal({ role, label, links = [] }) {
  const { user, logout } = useAuth();

  return (
    <RoleGuard allow={[role]}>
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-8 text-white sm:px-6 sm:py-12">
        <div className={`${GLASS} flex items-start justify-between gap-4 p-5 sm:p-6`}>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80">Matrix</p>
            <h1 className="mt-2 truncate text-3xl font-bold tracking-tight lg:text-4xl">Hi {label}</h1>
            <p className="mt-2 truncate text-sm text-white/50">Signed in as {user?.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            className="!min-h-0 inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap !rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-60"
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>

        {links.length > 0 ? (
          <div className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`${GLASS} group block p-5 transition duration-200 hover:bg-white/[0.09] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60 sm:p-6`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block truncate text-lg font-semibold sm:text-xl">{link.title}</span>
                    <span className="mt-1 block text-sm text-white/60">{link.subtitle}</span>
                  </div>
                  <ArrowUpRight
                    className="size-5 shrink-0 text-white/40 transition duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white"
                    aria-hidden="true"
                  />
                </div>
                {link.href.endsWith("/requests") ? (
                  <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                    Pending <PendingRequestBadge />
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        ) : (
          <div className={`${GLASS} mt-4 flex min-h-40 flex-col items-center justify-center gap-3 p-6 text-center sm:mt-6`}>
            <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/40">
              <Inbox className="size-6" aria-hidden="true" />
            </div>
            <p className="text-sm text-white/40">Nothing to show here yet.</p>
          </div>
        )}
      </main>
    </RoleGuard>
  );
}