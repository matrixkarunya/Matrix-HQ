"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarDays, Clock3, Inbox, LayoutDashboard, LogOut, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const NAV_ITEMS = [
  { href: "/superadmin", label: "Dashboard", short: "Home", icon: LayoutDashboard, exact: true },
  { href: "/superadmin/users", label: "Users", icon: Users },
  { href: "/superadmin/events", label: "Events", icon: CalendarDays },
  { href: "/superadmin/meetings", label: "Meetings", icon: Clock3 },
  { href: "/superadmin/requests", label: "Requests", icon: Inbox },
];

function isCurrent(pathname, item) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function SuperadminShell({ children }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const reduceMotion = useReducedMotion();

  const activeHref = NAV_ITEMS.find((item) => isCurrent(pathname, item))?.href ?? null;

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

          {/* Desktop nav: no container, the bar itself is the frame */}
          <nav aria-label="Superadmin navigation" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = item.href === activeHref;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className="group relative flex items-center rounded-full px-4 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                      {active ? (
                        <motion.span
                          layoutId="desktop-nav-active"
                          transition={
                            reduceMotion
                              ? { duration: 0 }
                              : { type: "spring", stiffness: 380, damping: 32 }
                          }
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

          {/* Sign out: borderless, soft hover fill */}
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

      {/* Mobile bottom nav (docked to the screen edge) */}
      <nav
        aria-label="Superadmin mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-black/60 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden"
      >
        <ul className="grid grid-cols-5">
          {NAV_ITEMS.map((item) => {
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
                      <motion.span
                        layoutId="superadmin-tab-active"
                        transition={
                          reduceMotion
                            ? { duration: 0 }
                            : { type: "spring", stiffness: 400, damping: 32 }
                        }
                        className="absolute inset-0 rounded-full bg-white/15"
                      />
                    ) : null}
                    <Icon className="relative size-5" strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />
                  </span>
                  <span>{item.short ?? item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}