"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import WorkingDayToggle from "@/components/WorkingDayToggle";
import { formatMinutes, splitRange, toMinutes } from "@/lib/hours";
import { normalizeWorkEmail } from "@/lib/works";

const INPUT =
  "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-400/30 disabled:cursor-not-allowed disabled:opacity-60 [color-scheme:dark]";
const LABEL = "mb-1.5 block text-sm font-medium text-white/80";

function personName(person) {
  return String(person?.fullName || person?.name || person?.email || "").trim();
}

export default function WorkModal({ open, mode, users = [], initialWork = null, onClose, onSubmit, saving = false, error = "" }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isWorkingDay, setIsWorkingDay] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [peopleSearch, setPeopleSearch] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(initialWork?.title || "");
    setDescription(initialWork?.description || "");
    setDate(initialWork?.date || "");
    setStartTime(initialWork?.startTime || "");
    setEndTime(initialWork?.endTime || "");
    setIsWorkingDay(initialWork?.isWorkingDay !== false);
    setParticipants(Array.isArray(initialWork?.participants) ? initialWork.participants.map(normalizeWorkEmail) : []);
    setPeopleSearch("");
    setLocalError("");
  }, [initialWork, open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  const selected = useMemo(() => new Set(participants), [participants]);
  const filtered = useMemo(() => {
    const term = peopleSearch.trim().toLowerCase();
    if (!term) return users;
    return users.filter((person) => `${personName(person)} ${person.email || ""}`.toLowerCase().includes(term));
  }, [peopleSearch, users]);
  const preview = useMemo(() => splitRange(startTime, endTime, isWorkingDay), [startTime, endTime, isWorkingDay]);

  function toggle(email) {
    const key = normalizeWorkEmail(email);
    setParticipants((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
    setLocalError("");
  }

  function selectVisible() {
    const emails = filtered.map((person) => normalizeWorkEmail(person.email)).filter(Boolean);
    setParticipants((current) => [...new Set([...current, ...emails])]);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 2) return setLocalError("Enter a work title.");
    if (!date) return setLocalError("Pick a date.");
    if (toMinutes(startTime) === null || toMinutes(endTime) === null) return setLocalError("Enter both start and end times.");
    if (toMinutes(endTime) <= toMinutes(startTime)) return setLocalError("End time must be after the start time.");
    if (participants.length === 0) return setLocalError("Select at least one participant.");
    setLocalError("");
    onSubmit({
      title: trimmedTitle,
      description: description.trim(),
      date,
      startTime,
      endTime,
      isWorkingDay,
      participants,
    });
  }

  if (!open) return null;
  const shownError = localError || error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-modal-title"
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-neutral-950/90 text-white shadow-2xl shadow-black/60 backdrop-blur-2xl sm:max-h-[88vh] sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80">{mode === "edit" ? "Edit" : "New"}</p>
            <h2 id="work-modal-title" className="mt-1.5 text-2xl font-semibold">{mode === "edit" ? "Edit work" : "Add work"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="!min-h-0 flex size-9 shrink-0 items-center justify-center !rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto border-t border-white/10 px-5 py-5 sm:px-6">
            <div>
              <label htmlFor="work-title" className={LABEL}>Title</label>
              <input id="work-title" autoFocus value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className={INPUT} />
            </div>

            <div>
              <label htmlFor="work-description" className={LABEL}>Description <span className="text-white/40">(optional)</span></label>
              <textarea id="work-description" rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} className={`${INPUT} resize-none`} />
            </div>

            <div>
              <label htmlFor="work-date" className={LABEL}>Date</label>
              <input id="work-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
            </div>

            <WorkingDayToggle value={isWorkingDay} onChange={setIsWorkingDay} disabled={saving} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="work-start" className={LABEL}>Start time</label>
                <input id="work-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label htmlFor="work-end" className={LABEL}>End time</label>
                <input id="work-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={INPUT} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Working", value: preview.workingMinutes },
                { label: "Non-working", value: preview.nonWorkingMinutes },
                { label: "Total", value: preview.totalMinutes },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/10 bg-violet-500/10 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-[.14em] text-white/50">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold">{formatMinutes(item.value)}</p>
                </div>
              ))}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-white/80">Participants</span>
                <span className="text-xs text-white/40">{participants.length} selected</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black/25">
                <div className="relative border-b border-white/10">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" aria-hidden="true" />
                  <input
                    type="search"
                    value={peopleSearch}
                    onChange={(e) => setPeopleSearch(e.target.value)}
                    placeholder="Search people"
                    aria-label="Search people"
                    className="w-full bg-transparent py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/30 focus:outline-none [color-scheme:dark] [&::-webkit-search-cancel-button]:hidden"
                  />
                </div>
                <div className="flex gap-2 border-b border-white/10 px-3 py-2 text-xs">
                  <button type="button" onClick={selectVisible} className="!min-h-0 font-semibold text-violet-200 hover:text-white">Select shown</button>
                  <span className="text-white/20">|</span>
                  <button type="button" onClick={() => setParticipants([])} className="!min-h-0 font-semibold text-white/60 hover:text-white">Clear</button>
                </div>
                <ul className="max-h-52 overflow-y-auto py-1">
                  {filtered.length === 0 ? (
                    <li className="px-3 py-4 text-center text-xs text-white/45">No people found.</li>
                  ) : (
                    filtered.map((person) => {
                      const email = normalizeWorkEmail(person.email);
                      const isOn = selected.has(email);
                      return (
                        <li key={email}>
                          <button
                            type="button"
                            onClick={() => toggle(email)}
                            aria-pressed={isOn}
                            className="!min-h-0 flex w-full items-center gap-3 !rounded-none px-3 py-2 text-left transition hover:bg-white/[0.06] focus:bg-white/[0.06] focus:outline-none"
                          >
                            <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${isOn ? "border-violet-300 bg-violet-400 text-neutral-950" : "border-white/25 bg-white/5"}`}>
                              {isOn ? <Check className="size-3" strokeWidth={3} aria-hidden="true" /> : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-white/90">{personName(person)}</span>
                              <span className="block truncate text-[11px] text-white/40">{person.role}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </div>

            {shownError ? (
              <p role="alert" className="rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{shownError}</p>
            ) : null}
          </div>

          <footer className="flex shrink-0 justify-end gap-3 border-t border-white/10 bg-neutral-950 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="!min-h-0 !rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="!min-h-0 !rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Add work"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}