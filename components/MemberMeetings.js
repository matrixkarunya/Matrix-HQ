"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, Flame, Inbox, Users } from "lucide-react";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import RoleGuard from "@/components/RoleGuard";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { formatMinutes, meetingMinutes } from "@/lib/hours";
import { meetingDateLabel, normalizeMeetingEmail } from "@/lib/meetings";

const GLASS =
  "rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20 backdrop-blur-xl";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "present", label: "Present" },
  { id: "absent", label: "Absent" },
  { id: "pending", label: "Pending" },
];

const STATUS_STYLES = {
  present: "border-emerald-300/30 bg-emerald-400/10 text-emerald-200",
  absent: "border-red-300/30 bg-red-400/10 text-red-200",
  pending: "border-white/15 bg-white/10 text-white/60",
};

const STATUS_LABEL = {
  present: "Present",
  absent: "Absent",
  pending: "Not recorded",
};

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateParts(value) {
  const date = toDate(value);
  if (!date) return { day: "—", month: "" };
  return {
    day: String(date.getDate()).padStart(2, "0"),
    month: date.toLocaleDateString("en-IN", { month: "short" }),
  };
}

function monthGroup(value) {
  const date = toDate(value);
  if (!date) return { key: "undated", label: "Undated" };
  return {
    key: `${date.getFullYear()}-${date.getMonth()}`,
    label: date.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
  };
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

function AttendanceRing({ percentage }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const value = percentage === null ? 0 : Math.max(0, Math.min(100, percentage));
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative size-32 shrink-0 sm:size-36">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="attendance-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#7dd3fc" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="url(#attendance-ring)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tracking-tight sm:text-3xl">
          {percentage === null ? "—" : `${percentage.toFixed(0)}%`}
        </span>
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[.16em] text-white/50">
          Attendance
        </span>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4">
      <div className="flex items-center gap-1.5 text-white/50">
        <Icon className="size-3.5 text-violet-300" aria-hidden="true" />
        <span className="truncate text-[11px] font-medium uppercase tracking-[.12em]">{label}</span>
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">{value}</p>
      {hint ? <p className="mt-0.5 truncate text-[11px] text-white/40">{hint}</p> : null}
    </div>
  );
}

function MemberMeetingsContent() {
  const { user, role, loading: authLoading } = useAuth();
  const email = normalizeMeetingEmail(user?.email);
  const [meetings, setMeetings] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!db || authLoading || !user || role !== "member") {
      setMeetings([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setError("");
    const unsubscribe = onSnapshot(
      query(collection(db, "meetings"), orderBy("date", "desc")),
      (snapshot) => {
        setMeetings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setLoading(false);
      },
      (listenerError) => {
        console.error("Member meetings listener:", listenerError.code, listenerError.message);
        setMeetings([]);
        setLoading(false);
        setError(`Could not load meetings (${listenerError.code || "unknown"}).`);
      },
    );
    return () => unsubscribe();
  }, [authLoading, email, role, user]);

  useEffect(() => {
    if (!db || authLoading || !user || role !== "member" || !email || !meetings.length) {
      setAttendance({});
      return undefined;
    }
    const unsubscribers = meetings.map((meeting) =>
      onSnapshot(
        doc(db, "meetings", meeting.id, "attendance", email),
        (snapshot) => {
          setAttendance((current) => ({
            ...current,
            [meeting.id]: snapshot.exists() ? snapshot.data() : null,
          }));
        },
        (listenerError) => {
          console.error("Member meeting attendance listener:", listenerError.code, listenerError.message);
          setError(`Could not load your meeting attendance (${listenerError.code || "unknown"}).`);
        },
      ),
    );
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [authLoading, email, meetings, role, user]);

  const savedMeetings = useMemo(() => meetings.filter((meeting) => meeting.attendanceSummary), [meetings]);
  const attended = savedMeetings.filter((meeting) => attendance[meeting.id]?.present === true);
  const totalMinutes = attended.reduce(
    (total, meeting) =>
      total +
      Number(
        attendance[meeting.id]?.durationMinutes ||
          meetingMinutes(meeting.attendanceSummary?.startTime, meeting.attendanceSummary?.endTime),
      ),
    0,
  );
  const percentage = savedMeetings.length ? (attended.length / savedMeetings.length) * 100 : null;

  // Current streak: consecutive present meetings, newest first, among recorded ones
  const streak = useMemo(() => {
    let count = 0;
    for (const meeting of savedMeetings) {
      if (attendance[meeting.id]?.present === true) count += 1;
      else break;
    }
    return count;
  }, [savedMeetings, attendance]);

  function statusOf(meeting) {
    const record = attendance[meeting.id];
    if (!meeting.attendanceSummary || !record) return "pending";
    return record.present ? "present" : "absent";
  }

  const counts = useMemo(() => {
    const result = { all: meetings.length, present: 0, absent: 0, pending: 0 };
    meetings.forEach((meeting) => {
      const record = attendance[meeting.id];
      const status = !meeting.attendanceSummary || !record ? "pending" : record.present ? "present" : "absent";
      result[status] += 1;
    });
    return result;
  }, [meetings, attendance]);

  const visible = useMemo(
    () => (filter === "all" ? meetings : meetings.filter((meeting) => statusOf(meeting) === filter)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filter, meetings, attendance],
  );

  const groups = useMemo(() => {
    const map = new Map();
    visible.forEach((meeting) => {
      const group = monthGroup(meeting.date);
      if (!map.has(group.key)) map.set(group.key, { ...group, items: [] });
      map.get(group.key).items.push(meeting);
    });
    return [...map.values()];
  }, [visible]);

  return (
    <div className="w-full space-y-5 text-white">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80">Member meetings</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">Meetings</h1>
        <p className="mt-1.5 text-sm text-white/50">Your meeting attendance and hours.</p>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      {/* Overview */}
      {loading ? (
        <div className={`${GLASS} h-48 animate-pulse`} />
      ) : (
        <section className={`${GLASS} p-4 sm:p-6`}>
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
            <AttendanceRing percentage={percentage} />

            <div className="w-full min-w-0 flex-1">
              <p className="text-center text-sm text-white/60 sm:text-left">
                {savedMeetings.length
                  ? `You were present in ${attended.length} of ${savedMeetings.length} recorded ${
                      savedMeetings.length === 1 ? "meeting" : "meetings"
                    }.`
                  : "Attendance will show up here once meetings are recorded."}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
                <MiniStat
                  icon={Clock3}
                  label="Hours"
                  value={savedMeetings.length ? formatMinutes(totalMinutes) : "—"}
                />
                <MiniStat
                  icon={Users}
                  label="Attended"
                  value={savedMeetings.length ? attended.length : "—"}
                  hint={savedMeetings.length ? `of ${savedMeetings.length}` : ""}
                />
                <MiniStat
                  icon={Flame}
                  label="Streak"
                  value={savedMeetings.length ? streak : "—"}
                  hint={savedMeetings.length ? (streak === 1 ? "meeting" : "meetings") : ""}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Filters */}
      {!loading && meetings.length > 0 ? (
        <div
          role="tablist"
          aria-label="Filter meetings"
          className="flex w-full items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-md sm:w-fit"
        >
          {FILTERS.map((item) => {
            const selected = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setFilter(item.id)}
                className={`!min-h-0 flex flex-1 items-center justify-center gap-2 whitespace-nowrap !rounded-full px-3.5 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:flex-none sm:px-4 ${
                  selected ? "bg-white/15 text-white" : "text-white/55 hover:text-white"
                }`}
              >
                {item.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    selected ? "bg-white/20 text-white" : "bg-white/10 text-white/60"
                  }`}
                >
                  {counts[item.id]}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* List */}
      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className={`${GLASS} h-20 animate-pulse`} />
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <div className={`${GLASS} flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center`}>
          <span className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/40">
            <Inbox className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm text-white/50">No meetings yet.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className={`${GLASS} flex min-h-40 flex-col items-center justify-center gap-3 p-8 text-center`}>
          <span className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/40">
            <CalendarDays className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm text-white/50">No {filter} meetings.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key}>
              <div className="mb-2.5 flex items-center gap-3 px-1">
                <h2 className="text-xs font-semibold uppercase tracking-[.16em] text-white/50">{group.label}</h2>
                <span className="h-px flex-1 bg-white/10" aria-hidden="true" />
                <span className="text-xs text-white/40">{group.items.length}</span>
              </div>

              <ul className={`${GLASS} divide-y divide-white/10 overflow-hidden`}>
                {group.items.map((meeting) => {
                  const record = attendance[meeting.id];
                  const summary = meeting.attendanceSummary;
                  const status = statusOf(meeting);
                  const { day, month } = dateParts(meeting.date);
                  const duration =
                    summary && record?.present
                      ? formatMinutes(Number(record.durationMinutes || summary.durationMinutes || 0))
                      : "";

                  return (
                    <li key={meeting.id} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-white/[0.04] sm:gap-4 sm:px-5">
                      <div
                        className={`flex size-14 shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 leading-none ${
                          status === "present"
                            ? "bg-emerald-500/10"
                            : status === "absent"
                              ? "bg-red-500/10"
                              : "bg-white/5"
                        }`}
                      >
                        <span className="text-lg font-bold">{day}</span>
                        <span className="mt-1 text-[10px] uppercase tracking-wider text-violet-200/80">{month}</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[15px] font-semibold leading-snug">{meeting.title}</h3>
                        <p className="mt-0.5 truncate text-xs text-white/50">{meetingDateLabel(meeting.date)}</p>
                        {summary ? (
                          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-white/55">
                            <Clock3 className="size-3 shrink-0 text-violet-300" aria-hidden="true" />
                            <span className="truncate">
                              {summary.startTime} to {summary.endTime}
                              {duration ? ` · ${duration}` : ""}
                            </span>
                          </p>
                        ) : null}
                      </div>

                      <StatusBadge status={status} />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MemberMeetings() {
  return (
    <RoleGuard allow={["member"]}>
      <MemberMeetingsContent />
    </RoleGuard>
  );
}