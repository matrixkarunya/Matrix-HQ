"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  Circle,
  ListChecks,
  Loader2,
  Plus,
  Search,
  UserPlus,
  X,
} from "lucide-react";

const MAX_SUBTASKS = 30;

const CARD = "rounded-2xl border border-white/10 bg-white/[0.04] p-4";
const INPUT =
  "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 transition focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-400/30 [color-scheme:dark]";
const CHIP_BTN =
  "!min-h-0 inline-flex items-center gap-1.5 !rounded-full border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50";
const ICON_BTN =
  "!min-h-0 flex shrink-0 items-center justify-center !rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50";

function createEmptySubtask() {
  return { id: crypto.randomUUID(), title: "", done: false };
}

function normEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function personName(person, fallback) {
  return String(person?.fullName || person?.name || fallback || person?.email || "").trim();
}

function initials(name) {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

// Local-time YYYY-MM-DD, offset by a number of days from today
function dateInDays(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function SectionHeader({ icon: Icon, title, meta, children }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-violet-500/15 text-violet-200">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="truncate text-sm font-medium text-white/90">{title}</span>
        {meta ? <span className="shrink-0 text-xs text-white/40">{meta}</span> : null}
      </div>
      {children}
    </div>
  );
}

export default function TaskModal({
  open,
  mode,
  users = [],
  initialTask = null,
  onClose,
  onSubmit,
  saving = false,
  error = "",
}) {
  const reduceMotion = useReducedMotion();
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [assignees, setAssignees] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [peopleSearch, setPeopleSearch] = useState("");
  const rowRefs = useRef({});

  useEffect(() => {
    if (!open) return;

    setTitle(initialTask?.title || "");
    setDeadline(initialTask?.deadline || "");
    setAssignees(Array.isArray(initialTask?.assignees) ? initialTask.assignees.slice() : []);
    setSubtasks(
      (initialTask?.subtasks || []).map((subtask) => ({
        id: subtask?.id || crypto.randomUUID(),
        title: subtask?.title || "",
        done: Boolean(subtask?.done),
      })),
    );
    setPickerOpen(false);
    setPeopleSearch("");
  }, [initialTask, open]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      document.getElementById("task-title-input")?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [open]);

  // Escape closes the modal
  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  const selectedSet = useMemo(() => new Set(assignees.map(normEmail)), [assignees]);

  const filteredUsers = useMemo(() => {
    const term = peopleSearch.trim().toLowerCase();
    if (!term) return users;
    return users.filter((person) =>
      [person.fullName, person.name, person.email].some((value) =>
        String(value || "").toLowerCase().includes(term),
      ),
    );
  }, [users, peopleSearch]);

  const quickDates = useMemo(
    () => [
      { label: "Today", value: dateInDays(0) },
      { label: "Tomorrow", value: dateInDays(1) },
      { label: "Next week", value: dateInDays(7) },
    ],
    // recompute each time the modal opens so "Today" is never stale
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  );

  function togglePerson(email) {
    const key = normEmail(email);
    setAssignees((current) =>
      current.some((item) => normEmail(item) === key)
        ? current.filter((item) => normEmail(item) !== key)
        : [...current, key],
    );
  }

  function nameForEmail(email) {
    const person = users.find((entry) => normEmail(entry.email) === normEmail(email));
    return personName(person, email);
  }

  function updateSubtask(id, value) {
    setSubtasks((current) =>
      current.map((subtask) => (subtask.id === id ? { ...subtask, title: value } : subtask)),
    );
  }

  function removeSubtask(id) {
    setSubtasks((current) => current.filter((subtask) => subtask.id !== id));
  }

  function addSubtaskRow() {
    if (subtasks.length >= MAX_SUBTASKS) return;
    const nextRow = createEmptySubtask();
    setSubtasks((current) => [...current, nextRow]);
    setTimeout(() => {
      rowRefs.current[nextRow.id]?.focus();
    }, 0);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedTitle = title.trim();

    if (!trimmedTitle || trimmedTitle.length < 2) {
      onSubmit({ validationError: "Enter a task title." });
      return;
    }

    if (!deadline) {
      onSubmit({ validationError: "Pick a deadline." });
      return;
    }

    const cleanedSubtasks = subtasks
      .map((subtask) => ({
        id: subtask.id || crypto.randomUUID(),
        title: String(subtask.title || "").trim(),
        done: Boolean(subtask.done),
      }))
      .filter((subtask) => subtask.title.length > 0 && subtask.title.length <= 120)
      .slice(0, MAX_SUBTASKS);

    const isUnchanged =
      initialTask &&
      trimmedTitle === String(initialTask.title || "").trim() &&
      deadline === (initialTask.deadline || "") &&
      JSON.stringify([...assignees].sort()) === JSON.stringify([...(initialTask.assignees || [])].sort()) &&
      JSON.stringify(cleanedSubtasks) === JSON.stringify(initialTask.subtasks || []);

    if (isUnchanged) {
      onClose();
      return;
    }

    onSubmit({ title: trimmedTitle, deadline, assignees, subtasks: cleanedSubtasks });
  }

  if (!open) return null;

  const isEdit = mode === "edit";
  const enter = reduceMotion
    ? { initial: false }
    : {
        initial: { opacity: 0, y: 24, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { type: "spring", stiffness: 380, damping: 32 },
      };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}
    >
      <motion.section
        {...enter}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-neutral-950/90 text-white shadow-2xl shadow-black/60 backdrop-blur-2xl sm:max-h-[88vh] sm:rounded-3xl"
      >
        {/* Soft violet glow behind the header */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full bg-violet-500/25 blur-3xl"
        />

        {/* Drag-handle look on mobile */}
        <div className="relative flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <header className="relative flex shrink-0 items-start justify-between gap-4 px-5 pb-5 pt-4 sm:px-6 sm:pt-6">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-violet-500/20 text-violet-100 shadow-lg shadow-violet-950/40">
              <ListChecks className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="task-modal-title" className="text-xl font-semibold tracking-tight">
                {isEdit ? "Edit task" : "New task"}
              </h2>
              <p className="mt-0.5 text-sm text-white/50">
                {isEdit ? "Update the details below." : "Set a deadline and who owns it."}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className={`${ICON_BTN} size-9`}>
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} noValidate className="relative flex min-h-0 flex-1 flex-col">
          {/* Body (the only part that scrolls) */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto border-t border-white/10 px-5 py-5 sm:px-6">
            {/* Title */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] transition focus-within:border-violet-300/50 focus-within:ring-2 focus-within:ring-violet-400/25">
              <label htmlFor="task-title-input" className="sr-only">
                Task title
              </label>
              <input
                id="task-title-input"
                type="text"
                value={title}
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What needs to be done?"
                className="w-full bg-transparent px-4 py-3.5 text-lg font-semibold text-white placeholder:font-normal placeholder:text-white/30 focus:outline-none"
              />
            </div>

            {/* Deadline */}
            <div className={CARD}>
              <SectionHeader icon={CalendarDays} title="Deadline" />
              <label htmlFor="task-deadline-input" className="sr-only">
                Deadline
              </label>
              <input
                id="task-deadline-input"
                type="date"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
                className={INPUT}
              />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {quickDates.map((option) => {
                  const active = deadline === option.value;
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setDeadline(option.value)}
                      aria-pressed={active}
                      className={`${CHIP_BTN} ${
                        active
                          ? "border-violet-300/40 bg-violet-500/25 text-white"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Assignees */}
            <div className={CARD}>
              <SectionHeader
                icon={UserPlus}
                title="Assign to"
                meta={assignees.length ? `${assignees.length} selected` : "Optional"}
              />

              {assignees.length > 0 ? (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {assignees.map((email) => (
                    <span
                      key={email}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-violet-300/25 bg-violet-500/15 py-1 pl-1 pr-1.5 text-xs text-white/90"
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-400/30 text-[9px] font-bold">
                        {initials(nameForEmail(email))}
                      </span>
                      <span className="truncate">{nameForEmail(email)}</span>
                      <button
                        type="button"
                        onClick={() => togglePerson(email)}
                        aria-label={`Remove ${nameForEmail(email)}`}
                        className="!min-h-0 flex size-4 shrink-0 items-center justify-center !rounded-full text-white/60 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                      >
                        <X className="size-3" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setPickerOpen((current) => !current)}
                aria-expanded={pickerOpen}
                className="!min-h-0 flex w-full items-center justify-between gap-2 !rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                <span>{pickerOpen ? "Hide people" : assignees.length ? "Change people" : "Add people"}</span>
                <ChevronDown
                  className={`size-4 text-white/50 transition ${pickerOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>

              {pickerOpen ? (
                <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                  <div className="relative border-b border-white/10">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={peopleSearch}
                      onChange={(event) => setPeopleSearch(event.target.value)}
                      placeholder="Search people"
                      aria-label="Search people"
                      className="w-full bg-transparent py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/30 focus:outline-none [color-scheme:dark] [&::-webkit-search-cancel-button]:hidden"
                    />
                  </div>

                  <ul className="max-h-48 overflow-y-auto py-1">
                    {filteredUsers.length === 0 ? (
                      <li className="px-3 py-4 text-center text-xs text-white/45">No people found.</li>
                    ) : (
                      filteredUsers.map((person) => {
                        const email = normEmail(person.email);
                        if (!email) return null;
                        const selected = selectedSet.has(email);
                        const name = personName(person);
                        return (
                          <li key={email}>
                            <button
                              type="button"
                              onClick={() => togglePerson(email)}
                              aria-pressed={selected}
                              className={`!min-h-0 flex w-full items-center gap-3 !rounded-none px-3 py-2 text-left transition hover:bg-white/[0.06] focus:bg-white/[0.06] focus:outline-none ${
                                selected ? "bg-violet-500/10" : ""
                              }`}
                            >
                              <span
                                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition ${
                                  selected ? "bg-violet-400 text-neutral-950" : "bg-white/10 text-white/70"
                                }`}
                              >
                                {selected ? (
                                  <Check className="size-4" strokeWidth={3} aria-hidden="true" />
                                ) : (
                                  initials(name)
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm text-white/90">{name}</span>
                                {name !== person.email ? (
                                  <span className="block truncate text-[11px] text-white/40">{person.email}</span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              ) : null}
            </div>

            {/* Subtasks */}
            <div className={CARD}>
              <SectionHeader
                icon={ListChecks}
                title="Subtasks"
                meta={subtasks.length > 0 ? `${subtasks.length}/${MAX_SUBTASKS}` : "Optional"}
              >
                <button
                  type="button"
                  onClick={addSubtaskRow}
                  disabled={subtasks.length >= MAX_SUBTASKS}
                  className={`${CHIP_BTN} border-white/15 bg-white/5 text-white/85 hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  Add
                </button>
              </SectionHeader>

              {subtasks.length === 0 ? (
                <button
                  type="button"
                  onClick={addSubtaskRow}
                  className="!min-h-0 flex w-full flex-col items-center gap-1.5 !rounded-xl border border-dashed border-white/15 px-3 py-5 text-center text-xs text-white/45 transition hover:border-violet-300/40 hover:bg-violet-500/5 hover:text-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Break the task into smaller steps
                </button>
              ) : (
                <div className="space-y-2">
                  {subtasks.map((subtask, index) => (
                    <div key={subtask.id} className="flex items-center gap-2">
                      <Circle className="size-4 shrink-0 text-violet-300/60" aria-hidden="true" />
                      <input
                        ref={(element) => {
                          if (element) rowRefs.current[subtask.id] = element;
                        }}
                        type="text"
                        value={subtask.title}
                        maxLength={120}
                        onChange={(event) => updateSubtask(subtask.id, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            if (subtask.title.trim()) addSubtaskRow();
                          }
                        }}
                        className={`${INPUT} flex-1`}
                        placeholder="Subtask title"
                        aria-label={`Subtask ${index + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeSubtask(subtask.id)}
                        aria-label={`Remove subtask ${index + 1}`}
                        className={`${ICON_BTN} size-9 hover:!bg-red-400/15 hover:!text-red-200`}
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error ? (
              <p
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-200" aria-hidden="true" />
                <span className="min-w-0 break-words">{error}</span>
              </p>
            ) : null}
          </div>

          {/* Footer (fixed, outside the scroll area) */}
          <footer className="flex shrink-0 justify-end gap-3 border-t border-white/10 bg-neutral-950/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="!min-h-0 !rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="!min-h-0 inline-flex items-center justify-center gap-2 !rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              {saving ? (isEdit ? "Saving…" : "Adding…") : isEdit ? "Save changes" : "Add task"}
            </button>
          </footer>
        </form>
      </motion.section>
    </div>
  );
}