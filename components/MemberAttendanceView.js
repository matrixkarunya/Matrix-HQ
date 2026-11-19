"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, ClipboardCheck } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import AttendanceStatBoxes from "@/components/AttendanceStatBoxes";
import AttendanceStatusBadge from "@/components/AttendanceStatusBadge";
import SemesterSelect from "@/components/SemesterSelect";
import { useAuth } from "@/context/AuthContext";
import { formatMinutes } from "@/lib/hours";
import useMyHours from "@/lib/useMyHours";

const GLASS =
  "rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20 backdrop-blur-xl";

function displayDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function timeRange(row) {
  return row.startTime || row.endTime ? `${row.startTime || "—"} to ${row.endTime || "—"}` : "—";
}

function rowKey(row) {
  return row.meetingId ? `meeting-${row.meetingId}` : `event-${row.eventId}`;
}

function AttendanceContent() {
  const { role } = useAuth();
  const {
    loading,
    error,
    totals,
    meetingTotalMinutes,
    combinedTotals,
    rows,
    combinedAttendancePercentage,
    combinedAttendanceCount,
    combinedAttendanceRecordedCount,
  } = useMyHours();
  const backHref = role === "admin" ? "/admin" : "/member";

  return (
    <div className="w-full text-white">
      <Link
        href={backHref}
        className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-white/70 backdrop-blur-md transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      >
        <ArrowLeft className="size-3.5 transition group-hover:-translate-x-0.5" />
        Back to dashboard
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80">Attendance</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">My attendance</h1>
        </div>
        <SemesterSelect />
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100 backdrop-blur-md"
        >
          {error}
        </p>
      ) : null}

      <AttendanceStatBoxes
        workingMinutes={totals.workingMinutes}
        nonWorkingMinutes={totals.nonWorkingMinutes}
        meetingMinutes={meetingTotalMinutes}
        totalMinutes={combinedTotals.totalMinutes}
        attendancePercent={combinedAttendancePercentage}
        attendanceCaption={combinedAttendancePercentage === null ? "" : `${combinedAttendanceCount} of ${combinedAttendanceRecordedCount} sessions`}
      />
      <p className="mt-2 text-xs text-white/40">
        Hours include the sessions you attended, your approved task hours and meetings you attended, for the selected
        semester. Attendance percentage is based on your records.
      </p>

      {loading ? (
        <div className="mt-6 space-y-3" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={`${GLASS} h-16 animate-pulse motion-reduce:animate-none`} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className={`${GLASS} mt-6 flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center`}>
          <span className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/40">
            <ClipboardCheck className="size-5" />
          </span>
          <p className="text-sm text-white/50">No attendance recorded in this semester yet</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className={`${GLASS} mt-6 hidden overflow-x-auto md:block`}>
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-[.14em] text-white/45">
                <tr>
                  <th className="px-5 py-3.5 font-medium">Type</th>
                  <th className="px-5 py-3.5 font-medium">Name</th>
                  <th className="px-5 py-3.5 font-medium">Date</th>
                  <th className="px-5 py-3.5 font-medium">Status</th>
                  <th className="px-5 py-3.5 font-medium">Time</th>
                  <th className="px-5 py-3.5 font-medium">Working</th>
                  <th className="px-5 py-3.5 font-medium">Non-working</th>
                  <th className="px-5 py-3.5 font-medium">Meeting hours</th>
                  <th className="px-5 py-3.5 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rows.map((row) => (
                  <tr key={rowKey(row)} className="transition hover:bg-white/[0.06]">
                    <td className="px-5 py-3.5 text-white/60">{row.type}</td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium">{row.name}</div>
                      {row.type === "Event" && row.taskTotals.totalMinutes > 0 ? (
                        <div className="mt-1 text-xs text-white/50">incl. tasks {formatMinutes(row.taskTotals.totalMinutes)}</div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-white/70">{displayDate(row.date)}</td>
                    <td className="px-5 py-3.5">{row.status ? <AttendanceStatusBadge status={row.status} /> : "—"}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-white/70">{timeRange(row)}</td>
                    <td className="px-5 py-3.5 text-white/70">{row.type === "Meeting" ? "—" : formatMinutes(row.workingMinutes)}</td>
                    <td className="px-5 py-3.5 text-white/70">{row.type === "Meeting" ? "—" : formatMinutes(row.nonWorkingMinutes)}</td>
                    <td className="px-5 py-3.5 text-white/70">{row.type === "Event" ? "—" : formatMinutes(row.meetingMinutes)}</td>
                    <td className="px-5 py-3.5 font-semibold">{row.totalMinutes === null ? "—" : formatMinutes(row.totalMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mt-6 space-y-3 md:hidden">
            {rows.map((row) => (
              <article key={rowKey(row)} className={`${GLASS} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{row.name}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-white/50">
                      <CalendarDays className="size-3" />
                      {displayDate(row.date)}
                    </p>
                  </div>
                  {row.status ? <AttendanceStatusBadge status={row.status} /> : null}
                </div>
                <p className="mt-3 text-xs text-white/50">{timeRange(row)}</p>
                <p className="mt-2 text-xs text-white/50">{row.type}</p>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {[
                    { label: "Working", value: row.type === "Meeting" ? null : row.workingMinutes },
                    { label: "Non-working", value: row.type === "Meeting" ? null : row.nonWorkingMinutes },
                    { label: "Meeting", value: row.type === "Event" ? null : row.meetingMinutes },
                    { label: "Total", value: row.totalMinutes },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-white/10 bg-violet-500/10 px-2 py-2 text-center">
                      <p className="text-[10px] uppercase tracking-[.1em] text-white/50">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold">{item.value === null ? "—" : formatMinutes(item.value)}</p>
                    </div>
                  ))}
                </div>
                {row.type === "Event" && row.taskTotals.totalMinutes > 0 ? (
                  <p className="mt-3 text-xs text-white/50">incl. tasks {formatMinutes(row.taskTotals.totalMinutes)}</p>
                ) : null}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function MemberAttendanceView({ allowedRoles = ["member"] }) {
  return (
    <RoleGuard allow={allowedRoles}>
      <AttendanceContent />
    </RoleGuard>
  );
}