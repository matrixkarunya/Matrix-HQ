"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  LayoutDashboard,
  ListTodo,
  LogOut,
  MoreHorizontal,
  User,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import SlideNav from "@/components/ui/slide-nav";

const NAV_ITEMS = [
  { href: "/member", label: "Dashboard", icon: LayoutDashboard },
  { href: "/member/events", label: "Events", icon: CalendarDays },
  { href: "/member/meetings", label: "Meetings", icon: Clock3 },
  { href: "/member/todo", label: "My todo", short: "Todo", icon: ListTodo },
  { href: "/member/attendance", label: "Attendance", short: "Attend", icon: ClipboardCheck },
  { href: "/member/my-profile", label: "Profile", icon: User },
];

// Mobile bottom bar: 3 primary tabs + a "More" button. Everything else lives in the sheet.
// Change this list to choose which tabs stay in the bar.
const MOBILE_PRIMARY_HREFS = ["/member", "/member/events", "/member/todo"];
const MOBILE_PRIMARY = NAV_ITEMS.filter((item) => MOBILE_PRIMARY_HREFS.includes(item.href));
const MOBILE_OVERFLOW = NAV_ITEMS.filter((item) => !MOBILE_PRIMARY_HREFS.includes(item.href));

function isCurrent(pathname, href) {
  if (href === "/member") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MemberShell({ children }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const activeHref =
    NAV_ITEMS.find((item) => isCurrent(pathname, item.href))?.href ?? null;
  const overflowActive = MOBILE_OVERFLOW.some((item) => item.href === activeHref);

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
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 shadow-lg shadow-black/30 backdrop-blur-xl">
          <Link
            href="/member"
            className="justify-self-start text-sm font-semibold tracking-[0.3em] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            MATRIX
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:block">
            <SlideNav
              items={NAV_ITEMS}
              activeHref={activeHref}
              label="Member navigation"
            />
          </div>
          <span className="md:hidden" />

          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            className="!min-h-0 flex items-center gap-2 justify-self-end !rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <LogOut className="size-4" aria-hidden="true" />
            <span className="hidden md:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Page content (extra bottom padding on mobile for the tab bar) */}
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:px-6 md:pb-12">
        {children}
      </main>

      {/* Mobile bottom nav (docked to the screen edge) */}
      <nav
        aria-label="Member navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-black/60 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden"
      >
        <ul className="grid grid-cols-4">
          {MOBILE_PRIMARY.map((item) => {
            const active = item.href === activeHref;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[10px] font-medium transition-colors focus:outline-none focus-visible:bg-white/10 ${
                    active ? "text-white" : "text-white/50 active:text-white"
                  }`}
                >
                  <span className="relative flex h-8 w-14 items-center justify-center">
                    {active && (
                      <motion.span
                        layoutId="member-tab-active"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        className="absolute inset-0 rounded-full bg-white/15"
                      />
                    )}
                    <Icon
                      className="relative size-5"
                      strokeWidth={active ? 2.4 : 1.8}
                      aria-hidden="true"
                    />
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
                {overflowActive && (
                  <motion.span
                    layoutId="member-tab-active"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="absolute inset-0 rounded-full bg-white/15"
                  />
                )}
                <MoreHorizontal
                  className="relative size-5"
                  strokeWidth={overflowActive ? 2.4 : 1.8}
                  aria-hidden="true"
                />
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
            aria-labelledby="member-more-title"
            className="w-full rounded-t-3xl border border-white/10 bg-neutral-950/85 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white shadow-2xl shadow-black/60 backdrop-blur-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80">Menu</p>
                <h2 id="member-more-title" className="mt-2 text-2xl font-semibold">More</h2>
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