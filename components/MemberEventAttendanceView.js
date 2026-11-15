"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock3, Users } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import AttendanceStatBoxes from "@/components/AttendanceStatBoxes";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { splitRange } from "@/lib/hours";

const GLASS =
  "rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20 backdrop-blur-xl";

function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function initials(value) {
  const parts = String(value || "?").split(/[\s@.]+/).filter(Boolean);
  return (parts[0]?.[0] || "?").toUpperCase() + (parts[1]?.[0] || "").toUpperCase();
}

function BackLink({ href }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-white/70 backdrop-blur-md transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
    >
      <ArrowLeft className="size-3.5 transition group-hover:-translate-x-0.5" />
      Back to events
    </Link>
  );
}

function MemberEventAttendanceContent() {
  const params = useParams();
  const { user, role, loading } = useAuth();
  const eventId = typeof params?.eventId === "string" ? params.eventId : "";
  const [event, setEvent] = useState(null);
  const [presentMembers, setPresentMembers] = useState([]);
  const [eventLoading, setEventLoading] = useState(true);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!db || loading || !user || role !== "member" || !eventId) {
      setEventLoading(false);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      doc(db, "events", eventId),
      (snapshot) => {
        setEvent(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
        setEventLoading(false);
      },
      (snapshotError) => {
        console.error("Member event attendance event listener:", snapshotError.code, snapshotError.message);
        setError(`Could not load the event (${snapshotError.code || "unknown"}).`);
        setEventLoading(false);
      },
    );
    return () => unsubscribe();
  }, [eventId, loading, role, user]);

  useEffect(() => {
    if (!db || loading || !user || role !== "member" || !eventId) {
      setAttendanceLoading(false);
      return undefined;
    }

    const attendanceQuery = query(collection(db, "events", eventId, "attendance"), where("present", "==", true));
    const unsubscribe = onSnapshot(
      attendanceQuery,
      (snapshot) => {
        setPresentMembers(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
        setAttendanceLoading(false);
      },
      (snapshotError) => {
        console.error("Member event attendance listener:", snapshotError.code, snapshotError.message);
        setError(`Could not load attendance (${snapshotError.code || "unknown"}).`);
        setAttendanceLoading(false);
      },
    );
    return () => unsubscribe();
  }, [eventId, loading, role, user]);

  if (eventLoading || attendanceLoading) {
    return (
      <div className="w-full text-white" aria-busy="true">
        <div className={`${GLASS} h-24 animate-pulse`} />
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={`${GLASS} h-28 animate-pulse`} />
          ))}
        </div>
      </div>
    );
  }

  const summary = event?.attendanceSummary;
  const timeTotals = summary ? splitRange(summary.startTime, summary.endTime) : null;

  return (
    // The shell already renders <main>, so this is a div to avoid nested <main> tags
    <div className="w-full text-white">
      <BackLink href="/member/events" />

      {/* Header */}
      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80">Event attendance</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">{event?.name || "Event attendance"}</h1>
        <div className="mt-3 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-sm text-white/70 backdrop-blur-md">
          <CalendarDays className="size-4 text-violet-300" />
          {formatDate(event?.date)}
        </div>
      </div>

      <div className="mt-6">
        <AttendanceStatBoxes
          workingMinutes={timeTotals?.workingMinutes}
          nonWorkingMinutes={timeTotals?.nonWorkingMinutes}
          totalMinutes={timeTotals?.totalMinutes}
          attendancePercent={summary && summary.totalCount > 0 ? (summary.presentCount / summary.totalCount) * 100 : null}
          attendanceCaption={summary ? `${summary.presentCount} of ${summary.totalCount} present` : ""}
          emptyNote={!summary ? "Attendance not saved yet" : ""}
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100 backdrop-blur-md"
        >
          {error}
        </p>
      ) : null}

      {!error && !event ? (
        <div className={`${GLASS} mt-6 flex min-h-48 items-center justify-center p-8 text-sm text-white/60`}>
          This event could not be found.
        </div>
      ) : null}

      {event && !error ? (
        <section className={`${GLASS} mt-6 p-5 sm:p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold sm:text-xl">Present</h2>
              <p className="mt-0.5 text-xs text-white/45">
                {summary
                  ? `${presentMembers.length} of ${summary.totalCount || presentMembers.length} members`
                  : "Attendance not taken yet"}
              </p>
            </div>
            {summary ? (
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-white/70">
                <Clock3 className="size-3.5 text-violet-300" />
                {summary.startTime || "—"} to {summary.endTime || "—"}
              </div>
            ) : null}
          </div>

          {presentMembers.length > 0 ? (
            <ul className="mt-4 divide-y divide-white/10">
              {presentMembers.map((member) => {
                const name = member.name || member.email || member.id;
                const time =
                  member.startTime || member.endTime
                    ? `${member.startTime || "—"} to ${member.endTime || "—"}`
                    : "—";
                return (
                  <li
                    key={member.id || normalizeEmail(member.email)}
                    className="-mx-3 flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-white/[0.06]"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-violet-500/15 text-xs font-semibold text-violet-100">
                      {initials(name)}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">{name}</p>
                    <span className="shrink-0 text-xs text-white/50">{time}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex min-h-40 flex-col items-center justify-center gap-3 py-8 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/40">
                <Users className="size-5" />
              </span>
              <p className="text-sm text-white/45">
                {summary ? "No one was marked present." : "Attendance hasn't been taken yet."}
              </p>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

export default function MemberEventAttendanceView() {
  return (
    <RoleGuard allow={["member"]}>
      <MemberEventAttendanceContent />
    </RoleGuard>
  );
}