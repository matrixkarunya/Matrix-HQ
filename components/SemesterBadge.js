"use client";

import { CalendarRange } from "lucide-react";
import { useSemester } from "@/context/SemesterContext";
import { semesterLabel } from "@/lib/semesters";

export default function SemesterBadge() {
  const { activeSemester, loading } = useSemester();
  if (loading) return null;

  return (
    <span
      className={`inline-flex w-fit items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium backdrop-blur-md ${
        activeSemester
          ? "border-white/10 bg-white/5 text-white/70"
          : "border-amber-300/30 bg-amber-400/10 text-amber-200"
      }`}
    >
      <CalendarRange className="size-3.5 text-violet-300" aria-hidden="true" />
      {activeSemester ? `Semester: ${semesterLabel(activeSemester)}` : "No active semester"}
    </span>
  );
}