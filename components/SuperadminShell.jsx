"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  Briefcase,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  Clock3,
  Inbox,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const NAV_ITEMS = [
  { href: "/superadmin", label: "Dashboard", short: "Home", icon: LayoutDashboard, exact: true },
  { href: "/superadmin/events", label: "Events", icon: CalendarDays },
  { href: "/superadmin/meetings", label: "Meetings", icon: Clock3 },
  { href: "/superadmin/requests", label: "Requests", icon: Inbox },
  { href: "/superadmin/works", label: "Works", icon: Briefcase },
  { href: "/superadmin/users", label: "Users", icon: Users },
  { href: "/superadmin/semesters", label: "Semesters", icon: CalendarRange },
];

// Mobile bottom bar shows the first 4 items plus "More"; the rest live in the sheet.
const MOBILE_PRIMARY_COUNT = 4;
const MOBILE_PRIMARY = NAV_ITEMS.slice(0, MOBILE_PRIMARY_COUNT);
const MOBILE_OVERFLOW = NAV_ITEMS.slice(MOBILE_PRIMARY_COUNT);

function isCurrent(pathname, item) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function SuperadminShell({ children }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const reduceMotion = useReducedMotion();
  const [moreOpen, setMoreOpen] = useState(false);

  const activeHref = NAV_ITEMS.find((item) => isCurrent(pathname, item))?.href ?? null;
  const overflowActive = MOBILE_OVERFLOW.some((item) => item.href === activeHref);
  const spring = reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 32 };

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return undefined;
    function handleEscape(event) {
      if (event.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [moreOpen]);

  return (
    <div className="min-h-screen text-white">
      {/* Top bar (floating glass) */}
      <header className="sticky top-0 z-30 px-3 pt-3 md:px-6 md:pt-4">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 shadow-lg shadow-black/30 backdrop-blur-xl">
          <Link
            href="/superadmin"
            className="justify-self-start rounded-sm text-sm font-semibold tracking-[0.3em] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            MATRIX
          </Link>

          <nav aria-label="Superadmin navigation" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = item.href === activeHref;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className="group relative flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                      {active ? (
                        <motion.span
                          layoutId="desktop-nav-active"
                          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
                          className="absolute inset-0 rounded-full bg-white/15"
                        />
                      ) : null}
                      <span
                        className={`relative inline-block transition duration-200 group-hover:scale-105 ${
                          active ? "text-white" : "text-white/60 group-hover:text-white"
                        }`}
                      >
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <span className="md:hidden" aria-hidden="true" />

          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            className="!min-h-0 inline-flex items-center justify-center gap-2 justify-self-end whitespace-nowrap !rounded-full px-3.5 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-60 max-md:size-10 max-md:px-0"
          >
            <LogOut className="size-4" aria-hidden="true" />
            <span className="hidden md:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 md:px-6 md:pb-12">{children}</main>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Superadmin mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-black/60 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden"
      >
        <ul className="grid grid-cols-5">
          {MOBILE_PRIMARY.map((item) => {
            const active = item.href === activeHref;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[10px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/50 ${
                    active ? "text-white" : "text-white/50 active:text-white"
                  }`}
                >
                  <span className="relative flex h-8 w-14 items-center justify-center">
                    {active ? (
                      <motion.span layoutId="superadmin-tab-active" transition={spring} className="absolute inset-0 rounded-full bg-white/15" />
                    ) : null}
                    <Icon className="relative size-5" strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />
                  </span>
                  <span>{item.short ?? item.label}</span>
                </Link>
              </li>
            );
          })}

          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={`!min-h-0 flex w-full flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[10px] font-medium transition-colors focus:outline-none focus-visible:bg-white/10 ${
                overflowActive ? "text-white" : "text-white/50 active:text-white"
              }`}
            >
              <span className="relative flex h-8 w-14 items-center justify-center">
                {overflowActive ? (
                  <motion.span layoutId="superadmin-tab-active" transition={spring} className="absolute inset-0 rounded-full bg-white/15" />
                ) : null}
                <MoreHorizontal className="relative size-5" strokeWidth={overflowActive ? 2.4 : 1.8} aria-hidden="true" />
              </span>
              <span>More</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* More sheet (mobile only) */}
      {moreOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm md:hidden"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMoreOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="superadmin-more-title"
            className="w-full rounded-t-3xl border border-white/10 bg-neutral-950/85 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white shadow-2xl shadow-black/60 backdrop-blur-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80">Menu</p>
                <h2 id="superadmin-more-title" className="mt-2 text-2xl font-semibold">More</h2>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close menu"
                autoFocus
                className="!min-h-0 flex size-10 shrink-0 items-center justify-center !rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <ul className="mt-5 space-y-2">
              {MOBILE_OVERFLOW.map((item) => {
                const active = item.href === activeHref;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60 ${
                        active
                          ? "border-violet-300/30 bg-violet-500/15 text-white"
                          : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-violet-500/15 text-violet-200">
                        <Icon className="size-[18px]" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
                      <ChevronRight className="size-4 shrink-0 text-white/40" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}