"use client";

import { CalendarRange, ChevronDown } from "lucide-react";
import { useSemester } from "@/context/SemesterContext";
import { semesterLabel } from "@/lib/semesters";

export default function SemesterSelect({ className = "" }) {
  const { semesters, selectedSemesterId, activeSemesterId, setSelectedSemesterId, loading } = useSemester();
  if (loading || semesters.length === 0) return null;

  return (
    <label className={`relative inline-flex w-fit items-center ${className}`}>
      <span className="sr-only">Semester</span>
      <CalendarRange className="pointer-events-none absolute left-3.5 size-4 text-violet-300" aria-hidden="true" />
      <select
        value={selectedSemesterId}
        onChange={(event) => setSelectedSemesterId(event.target.value)}
        className="!min-h-0 appearance-none !rounded-full border border-white/15 bg-white/5 py-2 pl-10 pr-9 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 [color-scheme:dark]"
      >
        {semesters.map((semester) => (
          <option key={semester.id} value={semester.id} className="bg-neutral-900 text-white">
            {semesterLabel(semester)}
            {semester.id === activeSemesterId ? " (active)" : ""}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 size-4 text-white/50" aria-hidden="true" />
    </label>
  );
}