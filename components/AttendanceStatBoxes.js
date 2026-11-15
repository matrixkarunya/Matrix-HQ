"use client";

import { Clock3, Percent, Timer, TimerOff } from "lucide-react";
import { formatMinutes } from "@/lib/hours";

const GLASS =
  "rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20 backdrop-blur-xl";

function formatValue(value) {
  return value === null || value === undefined ? "—" : formatMinutes(value);
}

function Stat({ icon: Icon, label, value, caption, progress }) {
  return (
    <div className={`${GLASS} group p-5 transition duration-200 hover:bg-white/[0.09]`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-[.16em] text-white/50">{label}</span>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-violet-500/15 text-violet-200 transition group-hover:scale-110">
          <Icon className="size-[18px]" />
        </span>
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight lg:text-3xl">{value}</p>
      {typeof progress === "number" ? (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-sky-300 transition-all duration-700"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      ) : null}
      {caption ? <p className="mt-2 text-xs text-white/50">{caption}</p> : null}
    </div>
  );
}

export default function AttendanceStatBoxes({
  workingMinutes,
  nonWorkingMinutes,
  meetingMinutes,
  totalMinutes,
  attendancePercent,
  attendanceCaption = "",
  emptyNote = "",
}) {
  const hasSavedAttendance = attendancePercent !== null && attendancePercent !== undefined;
  const note = emptyNote || attendanceCaption;
  const mergedMode = meetingMinutes !== undefined;

  if (mergedMode) {
    return (
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
        <Stat icon={Timer} label="Working Hours" value={formatValue(workingMinutes)} />
        <Stat icon={TimerOff} label="Non Working Hours" value={formatValue(nonWorkingMinutes)} />
        <Stat icon={Clock3} label="Meeting Hours" value={formatValue(meetingMinutes)} />
        <Stat icon={Clock3} label="Total Hours" value={formatValue(totalMinutes)} />
        <Stat
          icon={Percent}
          label="Attendance %"
          value={hasSavedAttendance ? `${attendancePercent.toFixed(1)}%` : "—"}
          progress={hasSavedAttendance ? attendancePercent : undefined}
          caption={note}
        />
      </div>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <Stat icon={Timer} label="Working" value={formatValue(workingMinutes)} />
      <Stat icon={TimerOff} label="Non working" value={formatValue(nonWorkingMinutes)} />
      <Stat icon={Clock3} label="Total" value={formatValue(totalMinutes)} />
      <Stat
        icon={Percent}
        label="Attendance"
        value={hasSavedAttendance ? `${attendancePercent.toFixed(1)}%` : "—"}
        progress={hasSavedAttendance ? attendancePercent : undefined}
        caption={note}
      />
    </div>
  );
}