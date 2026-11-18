"use client";

import { useId } from "react";

const OPTIONS = [
  { value: true, label: "Working day" },
  { value: false, label: "Non-working day" },
];

export default function WorkingDayToggle({ value, onChange, disabled = false }) {
  const labelId = useId();
  const isWorkingDay = value !== false;

  return (
    <div>
      <span id={labelId} className="mb-1.5 block text-sm font-medium text-white/80">
        Day type
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-white/5 p-1"
      >
        {OPTIONS.map((option) => {
          const selected = isWorkingDay === option.value;
          return (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={`!min-h-0 !rounded-full px-3 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm ${
                selected ? "bg-white/15 text-white" : "text-white/55 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-white/45">
        {isWorkingDay
          ? "9:00 AM to 4:00 PM counts as working hours. Anything outside that is non-working."
          : "Every hour on this day counts as non-working."}
      </p>
    </div>
  );
}