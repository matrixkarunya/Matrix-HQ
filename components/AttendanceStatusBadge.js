const STYLES = {
  Present: "bg-emerald-400/15 text-emerald-200 border-emerald-300/30",
  Absent: "bg-red-400/15 text-red-200 border-red-300/30",
  "Not recorded": "bg-amber-400/15 text-amber-200 border-amber-300/30",
};

const FALLBACK = "bg-white/10 text-white/70 border-white/15";

export default function AttendanceStatusBadge({ status }) {
  const label = status === "Not recorded yet" ? "Not recorded" : status;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${
        STYLES[label] || FALLBACK
      }`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}