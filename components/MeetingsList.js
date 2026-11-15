"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ClipboardCheck, Clock3, Pencil, Search, Trash2 } from "lucide-react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { meetingDateLabel, normalizeMeetingEmail } from "@/lib/meetings";

const GLASS = "rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20 backdrop-blur-xl";
const SCROLL = "[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-white/35 [&::-webkit-scrollbar-corner]:bg-transparent [@supports(not(selector(::-webkit-scrollbar)))]:[scrollbar-width:thin] [@supports(not(selector(::-webkit-scrollbar)))]:[scrollbar-color:rgba(255,255,255,0.25)_transparent]";
const INPUT = "w-full rounded-xl border border-white/15 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/30 focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-400/30 [color-scheme:dark]";
const ACTION_BASE = "!min-h-0 inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap !rounded-full border border-white/15 bg-white/5 text-xs font-semibold text-white/85 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50";
const ACTION = `${ACTION_BASE} size-10 sm:h-auto sm:w-auto sm:px-3.5 sm:py-2`;
const ACTION_DANGER = `${ACTION} !border-red-300/25 !bg-red-400/10 !text-red-200 hover:!bg-red-400/20`;
const BANNER_ERROR = "rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100 backdrop-blur-md";

function localDateString(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function getDateParts(dateString) {
  if (typeof dateString !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return null;
  const [year, month, day] = dateString.split("-").map(Number);
  return { year, month, day, date: new Date(year, month - 1, day) };
}

function getMonthLabel(key) {
  if (key === "none") return "No date";
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function ListSkeleton() {
  return (
    <div aria-busy="true" className="divide-y divide-white/10">
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="flex animate-pulse items-center gap-3 px-4 py-3 motion-reduce:animate-none">
          <div className="size-10 shrink-0 rounded-xl bg-white/10" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-2/5 rounded-full bg-white/10" />
            <div className="h-2.5 w-1/4 rounded-full bg-white/10" />
          </div>
          <div className="h-8 w-20 shrink-0 rounded-full bg-white/10" />
        </div>
      ))}
    </div>
  );
}

export default function MeetingsList({ role, onEdit, onDelete, action }) {
  const { user, role: authRole, loading } = useAuth();
  const activeRole = role || authRole;
  const [meetings, setMeetings] = useState([]);
  const [error, setError] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [tab, setTab] = useState("upcoming");
  const [search, setSearch] = useState("");
  const signedInEmail = normalizeMeetingEmail(user?.email);

  useEffect(() => {
    if (!db || loading || !user || !["superadmin", "admin", "member"].includes(activeRole)) {
      setMeetings([]);
      setError("");
      setListLoading(loading);
      return undefined;
    }
    setListLoading(true);
    const meetingsQuery = query(collection(db, "meetings"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(meetingsQuery, (snapshot) => {
      setMeetings(snapshot.docs.map((meeting) => ({ id: meeting.id, ...meeting.data() })));
      setListLoading(false);
    }, (listenerError) => {
      console.error("Meetings listener:", listenerError.code, listenerError.message);
      setMeetings([]);
      setListLoading(false);
      setError(`Could not load meetings (${listenerError.code || "unknown"}).`);
    });
    return () => unsubscribe();
  }, [activeRole, loading, user]);

  const sortedMeetings = useMemo(() => [...meetings].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))), [meetings]);
  const isStaff = ["superadmin", "admin"].includes(activeRole);

  const today = useMemo(() => localDateString(new Date()), []);
  const isUpcoming = (meeting) => String(meeting.date || "") >= today;
  const upcomingCount = sortedMeetings.filter(isUpcoming).length;
  const pastCount = sortedMeetings.length - upcomingCount;

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = sortedMeetings.filter((meeting) => (tab === "upcoming" ? String(meeting.date || "") >= today : String(meeting.date || "") < today));
    if (term) {
      list = list.filter((meeting) => `${meeting.title || ""} ${meeting.note || ""}`.toLowerCase().includes(term));
    }
    if (tab === "upcoming") list = [...list].reverse();

    const result = [];
    list.forEach((meeting) => {
      const key = getDateParts(meeting.date) ? String(meeting.date).slice(0, 7) : "none";
      const last = result[result.length - 1];
      if (last && last.key === key) {
        last.items.push(meeting);
      } else {
        result.push({ key, items: [meeting] });
      }
    });
    return result;
  }, [sortedMeetings, search, tab, today]);

  const visibleCount = groups.reduce((total, group) => total + group.items.length, 0);

  const tabs = [
    { id: "upcoming", label: "Upcoming", count: upcomingCount },
    { id: "past", label: "Past", count: pastCount },
  ];

  return (
    <div className="space-y-4">
      {error ? <p role="alert" className={BANNER_ERROR}>{error}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-2">
          <div role="tablist" aria-label="Meeting filter" className="inline-flex min-w-0 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-md">
            {tabs.map((item) => {
              const selected = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setTab(item.id)}
                  className={`!min-h-0 inline-flex items-center gap-1.5 whitespace-nowrap !rounded-full px-3 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:gap-2 sm:px-4 ${
                    selected ? "bg-white/15 text-white" : "text-white/60 hover:text-white"
                  }`}
                >
                  {item.label}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${selected ? "bg-white/15 text-white" : "bg-white/10 text-white/60"}`}>{item.count}</span>
                </button>
              );
            })}
          </div>
          {action}
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search meetings"
            aria-label="Search meetings"
            className={INPUT}
          />
        </div>
      </div>

      <section className={`${GLASS} overflow-hidden`} aria-busy={listLoading ? "true" : undefined}>
        {listLoading ? (
          <ListSkeleton />
        ) : visibleCount === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/40">
              <CalendarDays className="size-6" aria-hidden="true" />
            </span>
            <p className="text-sm text-white/40">
              {sortedMeetings.length === 0
                ? "No meetings yet."
                : search.trim()
                  ? "No meetings match your search."
                  : tab === "upcoming"
                    ? "No upcoming meetings."
                    : "No past meetings."}
            </p>
          </div>
        ) : (
          <div className={`max-h-[60vh] overflow-y-auto overscroll-contain ${SCROLL}`}>
            {groups.map((group) => (
              <div key={group.key}>
                <h2 className="sticky top-0 z-10 border-b border-white/10 bg-neutral-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-[.16em] text-white/50 backdrop-blur-xl">
                  {getMonthLabel(group.key)}
                </h2>
                <ul className="divide-y divide-white/10">
                  {group.items.map((meeting) => {
                    const summary = meeting.attendanceSummary;
                    const canDelete = isStaff && onDelete && (activeRole === "superadmin" || normalizeMeetingEmail(meeting.createdBy) === signedInEmail);
                    const parts = getDateParts(meeting.date);
                    return (
                      <li key={meeting.id} className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.06]">
                        <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-violet-500/15 leading-none">
                          {parts ? (
                            <>
                              <span className="text-sm font-bold">{parts.day}</span>
                              <span className="mt-0.5 text-[9px] uppercase text-violet-200/80">
                                {parts.date.toLocaleDateString("en-IN", { month: "short" })}
                              </span>
                            </>
                          ) : (
                            <CalendarDays className="size-4 text-violet-200" aria-hidden="true" />
                          )}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">{meeting.title}</p>
                          <p className="mt-0.5 truncate text-xs text-white/50">
                            {meetingDateLabel(meeting.date, true)}
                            {meeting.note ? <span className="text-white/40"> · {meeting.note}</span> : null}
                          </p>
                        </div>

                        {isStaff ? (
                          <p className="hidden max-w-[11rem] shrink-0 truncate text-xs text-white/40 lg:block">
                            {meeting.createdByName || meeting.createdBy || "—"}
                          </p>
                        ) : null}
                        {!isStaff && summary ? (
                          <span className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 sm:inline-flex">
                            <Clock3 className="size-3.5 text-violet-300" aria-hidden="true" />
                            {summary.startTime || "—"} to {summary.endTime || "—"}
                          </span>
                        ) : null}

                        <div className="flex shrink-0 items-center gap-1.5">
                          {isStaff ? (
                            <Link href={`/${activeRole}/meetings/${meeting.id}/attendance`} aria-label={`Attendance for ${meeting.title}`} className={ACTION}>
                              <ClipboardCheck className="size-4 sm:size-3.5" aria-hidden="true" />
                              <span className="hidden sm:inline">Attendance</span>
                            </Link>
                          ) : null}
                          {onEdit ? (
                            <button type="button" onClick={() => onEdit(meeting)} aria-label={`Edit ${meeting.title}`} className={ACTION}>
                              <Pencil className="size-4 sm:size-3.5" aria-hidden="true" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>
                          ) : null}
                          {canDelete ? (
                            <button type="button" onClick={() => onDelete(meeting)} aria-label={`Delete ${meeting.title}`} className={ACTION_DANGER}>
                              <Trash2 className="size-4 sm:size-3.5" aria-hidden="true" />
                              <span className="hidden sm:inline">Delete</span>
                            </button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}