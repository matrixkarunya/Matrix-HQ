"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  CalendarDays,
  ClipboardCheck,
  Clock3,
  LayoutDashboard,
  ListTodo,
  LogOut,
  User,
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

function isCurrent(pathname, href) {
  if (href === "/member") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MemberShell({ children }) {
  const pathname = usePathname();
  const { logout } = useAuth();

  const activeHref =
    NAV_ITEMS.find((item) => isCurrent(pathname, item.href))?.href ?? null;

  return (
    <div className="min-h-screen text-white">
      {/* Top bar (floating glass) */}
      <header className="sticky top-0 z-30 px-3 pt-3 md:px-6 md:pt-4">
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 shadow-lg shadow-black/30 backdrop-blur-xl">
          <Link
            href="/member"
            className="justify-self-start text-sm font-semibold tracking-[0.3em] text-white"
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
            className="flex items-center gap-2 justify-self-end rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <LogOut className="size-4" />
            <span className="hidden md:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Page content (extra bottom padding on mobile for the tab bar) */}
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:px-6 md:pb-12">
        {children}
      </main>

            {/* Mobile bottom nav (docked to the screen edge, WhatsApp style) */}
      <nav
        aria-label="Member navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-black/60 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden"
      >
        <ul className="grid grid-cols-6">
          {NAV_ITEMS.map((item) => {
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
                    />
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