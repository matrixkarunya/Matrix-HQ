"use client";

import { CalendarDays } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import EventsList from "@/components/EventsList";

export default function MemberEventsPage() {
  return (
    <RoleGuard allow={["member"]}>
      <div className="w-full text-white">
        {/* Header */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80">
              Member events
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">Events</h1>
            <p className="mt-1.5 text-sm text-white/50">
              See what's coming up and what you've been part of.
            </p>
          </div>
          <span className="hidden size-12 items-center justify-center rounded-2xl border border-white/10 bg-violet-500/15 text-violet-200 backdrop-blur-md sm:flex">
            <CalendarDays className="size-5" />
          </span>
        </div>

        {/* Divider */}
        <div className="my-6 h-px bg-gradient-to-r from-violet-300/30 via-white/10 to-transparent lg:my-8" />

        <EventsList />
      </div>
    </RoleGuard>
  );
}