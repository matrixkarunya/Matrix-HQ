"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarDays, Clock3, Inbox, ShieldCheck, Users } from "lucide-react";
import { formatMinutes } from "@/lib/hours";
import useDashboardStats from "@/lib/useDashboardStats";
import SemesterSelect from "@/components/SemesterSelect";
const GLASS = "rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20 backdrop-blur-xl";

const ICONS = {
  events: CalendarDays,
  meetings: Clock3,
  members: Users,
  admins: ShieldCheck,
};

function StatTile({ type, label, value, caption, className = "" }) {
  const Icon = ICONS[type];
  return (
    <div className={`${GLASS} group p-4 transition duration-200 hover:bg-white/[0.09] sm:p-5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium uppercase tracking-[.14em] text-white/50">{label}</span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-violet-500/15 text-violet-200 transition group-hover:scale-110">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight lg:text-3xl">{value}</p>
      {caption ? <p className="mt-1 truncate text-xs text-white/45">{caption}</p> : null}
    </div>
  );
}

function PendingCard({ value, href, className = "" }) {
  const hasPending = typeof value === "number" && value > 0;
  const body = (
    <div
      className={`group flex h-full items-center gap-4 rounded-2xl border p-4 shadow-lg shadow-black/20 backdrop-blur-xl transition duration-200 sm:p-5 lg:flex-col lg:items-start lg:justify-between ${
        hasPending
          ? "border-violet-300/30 bg-violet-500/15 hover:bg-violet-500/25"
          : "border-white/10 bg-white/[0.06] hover:bg-white/[0.09]"
      }`}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-violet-100 transition group-hover:scale-110">
        <Inbox className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 lg:flex-none">
        <p className="text-[11px] font-medium uppercase tracking-[.14em] text-white/60">Pending requests</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
        <p className="mt-0.5 text-xs text-white/50">
          {typeof value !== "number" ? "\u00A0" : hasPending ? "Waiting for your review" : "You're all caught up"}
        </p>
      </div>
      {href ? (
        <ArrowUpRight className="size-5 shrink-0 text-white/50 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" aria-hidden="true" />
      ) : null}
    </div>
  );
  return (
    <div className={className}>
      {href ? (
        <Link href={href} className="block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}

// Tonal violet scale (light -> deep) so the split stays inside the theme
const TONES = [
  { hex: "#ddd6fe", bar: "bg-violet-200" },
  { hex: "#a78bfa", bar: "bg-violet-400" },
  { hex: "#7c3aed", bar: "bg-violet-600" },
];

function HoursCard({ stats, failed, className = "" }) {
  const raw = [
    { label: "Working", minutes: stats.workingMinutes },
    { label: "Non working", minutes: stats.nonWorkingMinutes },
    { label: "Meetings", minutes: stats.meetingMinutes },
  ];
  const sum = failed ? 0 : raw.reduce((total, item) => total + (item.minutes || 0), 0);
  const items = raw.map((item, index) => {
    const minutes = failed ? 0 : item.minutes || 0;
    return { ...item, minutes, share: sum > 0 ? (minutes / sum) * 100 : 0, tone: TONES[index] };
  });
  const dash = failed || stats.loading;

  return (
    <section className={`${GLASS} p-5 sm:p-6 ${className}`} aria-label="Hours">
      <div className="mb-3 flex justify-end">
  <SemesterSelect />
</div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[.16em] text-white/50">Total hours</p>
          <p className="mt-2 text-4xl font-bold tracking-tight lg:text-5xl">{dash ? "—" : formatMinutes(sum)}</p>
        </div>
        <span className="mt-0.5 shrink-0 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
          events + meetings
        </span>
      </div>

      {/* One continuous bar */}
      <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-white/10" role="img" aria-label="Hours split">
        {items.map((item, index) =>
          item.share > 0 ? (
            <div
              key={item.label}
              className="transition-all duration-700"
              style={{
                flexGrow: item.share,
                flexBasis: 0,
                background: `linear-gradient(to right, ${TONES[index].hex}, ${(TONES[index + 1] || TONES[index]).hex})`,
              }}
            />
          ) : null
        )}
      </div>

      {/* Breakdown: rows on mobile, three columns from sm */}
      <ul className="mt-5 divide-y divide-white/10 sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 sm:block sm:px-5 sm:py-0 sm:first:pl-0 sm:last:pr-0"
          >
            <div className="flex min-w-0 items-center gap-2 text-sm text-white/70">
              <span className={`size-2.5 shrink-0 rounded-full ${item.tone.bar}`} aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </div>
            <div className="flex shrink-0 items-baseline gap-2 sm:mt-2">
              <span className="text-lg font-semibold sm:text-xl">{dash ? "—" : formatMinutes(item.minutes)}</span>
              <span className="text-xs text-white/45">{dash ? "" : `${Math.round(item.share)}%`}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function DashboardStats({ role, email }) {
  const stats = useDashboardStats(role, email);
  const isSuper = role === "superadmin";
  const showPending = !isSuper;

  const hasSourceError = (type) => {
    if (type === "events") return Boolean(stats.sourceErrors.events);
    if (type === "meetings" || type === "meetingHours") return Boolean(stats.sourceErrors.meetings);
    if (type === "pending") return Object.keys(stats.sourceErrors).some((source) => source.startsWith("pending requests"));
    if (["working", "nonWorking"].includes(type)) return Boolean(stats.sourceErrors.events);
    if (type === "total") return Boolean(stats.sourceErrors.events || stats.sourceErrors.meetings);
    return false;
  };
  const show = (type, value) =>
    stats.loading || hasSourceError(type) || ((type === "members" || type === "admins") && stats.sourceErrors.users) ? "—" : value;

  const tiles = [
    ["events", "Events", show("events", stats.totalEvents)],
    ["members", "Members", show("members", stats.totalMembers), "admins + members"],
    ...(isSuper ? [["admins", "Admins", show("admins", stats.totalAdmins)]] : []),
    ["meetings", "Meetings", show("meetings", stats.totalMeetings)],
  ];
  const odd = tiles.length % 2 === 1;
  const hoursFailed = hasSourceError("total");

  return (
    <section aria-label="Organisation statistics" aria-busy={stats.loading ? "true" : undefined} className="mt-6 lg:mt-8">
      {stats.error ? (
        <p role="alert" className="mb-3 rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-xs text-red-100 backdrop-blur-md">
          {stats.error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-12">
        {showPending ? (
          <PendingCard
            value={show("pending", stats.pendingRequests)}
            href="/admin/requests"
            className="lg:order-3 lg:col-span-4"
          />
        ) : null}

        <div
          className={`grid grid-cols-2 gap-3 sm:gap-4 lg:order-1 lg:col-span-12 ${
            isSuper ? "lg:grid-cols-4" : "lg:grid-cols-3"
          }`}
        >
          {tiles.map(([type, label, value, caption], index) => (
            <StatTile
              key={type}
              type={type}
              label={label}
              value={value}
              caption={caption}
              className={odd && index === tiles.length - 1 ? "col-span-2 lg:col-span-1" : ""}
            />
          ))}
        </div>

        <HoursCard
          stats={stats}
          failed={hoursFailed}
          className={`lg:order-2 ${showPending ? "lg:col-span-8" : "lg:col-span-12"}`}
        />
      </div>
    </section>
  );
}