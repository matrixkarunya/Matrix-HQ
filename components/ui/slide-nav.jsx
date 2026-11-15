"use client";

import Link from "next/link";
import { motion } from "framer-motion";

/**
 * Desktop pill nav.
 * - The highlight stays on the current page (slides between pages on navigation).
 * - Hover only enlarges and brightens the label.
 */
export default function SlideNav({ items, activeHref, label = "Navigation" }) {
  return (
    <nav
      aria-label={label}
      className="relative flex items-center rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-md"
    >
      {items.map((item) => {
        const active = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="group relative rounded-full px-4 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {active && (
              <motion.span
                layoutId="desktop-nav-active"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="absolute inset-0 rounded-full border border-white/20 bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
              />
            )}
            <span
              className={`relative inline-block origin-center transition-all duration-200 ease-out group-hover:scale-110 ${
                active
                  ? "text-white"
                  : "text-white/60 group-hover:text-white"
              }`}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}