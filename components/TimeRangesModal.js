"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import WorkingDayToggle from "@/components/WorkingDayToggle";
import { formatMinutes, sumRanges, validateRanges } from "@/lib/hours";

const EMPTY_RANGE = { startTime: "", endTime: "" };

function createRangeId(counter) {
  counter.current += 1;
  return `time-range-${counter.current}`;
}

function withIds(entries, counter) {
  const source = Array.isArray(entries) && entries.length > 0 ? entries : [EMPTY_RANGE];
  return source.map((entry) => ({
    id: createRangeId(counter),
    startTime: String(entry?.startTime || ""),
    endTime: String(entry?.endTime || ""),
  }));
}

const inputClass =
  "mt-1.5 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-400/30 [color-scheme:dark]";

export default function TimeRangesModal({
  open,
  title = "Add time spent",
  description = "Enter the time ranges.",
  initialTimeEntries = [EMPTY_RANGE],
  initialIsWorkingDay = true,
  assignees = [],
  selectedAssignees = [],
  onClose,
  onConfirm,
  saving = false,
  showAssignees = false,
  showWorkingDayToggle = false,
  externalError = "",
}) {
  const idCounter = useRef(0);
  const [timeEntries, setTimeEntries] = useState(() => withIds(initialTimeEntries, idCounter));
  const [selected, setSelected] = useState(() => [...selectedAssignees]);
  const [isWorkingDay, setIsWorkingDay] = useState(initialIsWorkingDay !== false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTimeEntries(withIds(initialTimeEntries, idCounter));
    setSelected([...selectedAssignees]);
    setIsWorkingDay(initialIsWorkingDay !== false);
    setError("");
  }, [open]);

  const totals = useMemo(() => sumRanges(timeEntries, isWorkingDay), [timeEntries, isWorkingDay]);
  const validation = useMemo(() => validateRanges(timeEntries), [timeEntries]);

  function updateEntry(id, field, value) {
    setTimeEntries((current) => current.map((entry) => entry.id === id ? { ...entry, [field]: value } : entry));
    setError("");
  }

  function toggleAssignee(email) {
    setSelected((current) => current.includes(email) ? current.filter((value) => value !== email) : [...current, email]);
    setError("");
  }

  function confirm() {
    if (!validation.valid) {
      return;
    }
    if (showAssignees && selected.length === 0) {
      setError("Select at least one assignee.");
      return;
    }
    onConfirm(
      timeEntries.map(({ startTime, endTime }) => ({ startTime, endTime })),
      selected,
      isWorkingDay,
    );
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="time-ranges-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-neutral-950/85 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white shadow-2xl shadow-black/60 backdrop-blur-2xl sm:rounded-2xl"
      >
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80">Time log</p>
        <h2 id="time-ranges-title" className="mt-2 text-2xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-white/60">{description}</p>

        {showWorkingDayToggle ? (
          <div className="mt-5">
            <WorkingDayToggle value={isWorkingDay} onChange={setIsWorkingDay} disabled={saving} />
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {timeEntries.map((entry) => {
            const rowTotals = sumRanges([entry], isWorkingDay);
            return (
              <div
                key={entry.id}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <label className="text-sm font-medium text-white/80">
                    Start time
                    <input
                      type="time"
                      value={entry.startTime}
                      onChange={(event) => updateEntry(entry.id, "startTime", event.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="text-sm font-medium text-white/80">
                    End time
                    <input
                      type="time"
                      value={entry.endTime}
                      onChange={(event) => updateEntry(entry.id, "endTime", event.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={timeEntries.length === 1 || saving}
                    onClick={() => setTimeEntries((current) => current.filter((item) => item.id !== entry.id))}
                    aria-label="Remove time range"
                    className="!min-h-0 flex size-10 items-center justify-center gap-1.5 self-end !rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:bg-red-400/15 hover:text-red-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/5 disabled:hover:text-white/70"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <p className="mt-3 text-xs text-white/50">
                  Working {formatMinutes(rowTotals.workingMinutes)} · Non-working {formatMinutes(rowTotals.nonWorkingMinutes)}
                </p>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          disabled={timeEntries.length >= 10 || saving}
          onClick={() => setTimeEntries((current) => [...current, { ...EMPTY_RANGE, id: createRangeId(idCounter) }])}
          className="!min-h-0 mt-3 inline-flex items-center gap-1.5 !rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-3.5" />
          Add another time
        </button>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { label: "Working", value: totals.workingMinutes },
            { label: "Non-working", value: totals.nonWorkingMinutes },
            { label: "Total", value: totals.totalMinutes },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/10 bg-violet-500/10 px-3 py-2.5 text-center">
              <p className="text-[10px] font-medium uppercase tracking-[.14em] text-white/50">{item.label}</p>
              <p className="mt-1 text-sm font-semibold">{formatMinutes(item.value)}</p>
            </div>
          ))}
        </div>

        {showAssignees ? (
          <fieldset className="mt-5">
            <legend className="text-sm font-medium text-white/80">Credit hours to:</legend>
            <div className="mt-2 space-y-2">
              {assignees.map((assignee) => (
                <label
                  key={assignee.email}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/85 transition hover:bg-white/[0.08]"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(assignee.email)}
                    onChange={() => toggleAssignee(assignee.email)}
                    disabled={saving}
                    className="size-4 shrink-0 cursor-pointer rounded accent-violet-400 disabled:cursor-not-allowed"
                  />
                  {assignee.name || assignee.email}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {error || (!validation.valid && validation.error) || externalError ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100"
          >
            {error || (!validation.valid && validation.error) || externalError}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="!min-h-0 !rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={saving}
            className="!min-h-0 !rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Confirm"}
          </button>
        </div>
      </section>
    </div>
  );
}