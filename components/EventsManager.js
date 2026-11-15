"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import {
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ListTodo,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";

const PAGE_SIZE = 12;

const GLASS =
  "rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20 backdrop-blur-xl";

const actionButtonClass =
  "!min-h-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap !rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-50";

const searchInputClass =
  "w-full rounded-full border border-white/15 bg-white/5 py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-white/30 focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-400/30 [color-scheme:dark]";

// Create-event styles (from the old code)
const PRIMARY =
  "!min-h-0 inline-flex items-center justify-center gap-2 whitespace-nowrap !rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60";
const GHOST =
  "!min-h-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap !rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-60";
const INPUT =
  "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-400/30 disabled:cursor-not-allowed disabled:opacity-60 [color-scheme:dark]";
const LABEL = "mb-1.5 block text-sm font-medium text-white/80";
const EYEBROW = "text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80";
const ERROR_BANNER =
  "rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100";

function formatEventDate(dateString) {
  if (typeof dateString !== "string" || !dateString) return "—";
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function dateParts(dateString) {
  if (typeof dateString !== "string" || !dateString) return { day: "—", month: "" };
  const [year, month, day] = dateString.split("-").map(Number);
  return {
    day: String(day).padStart(2, "0"),
    month: new Date(year, month - 1, day).toLocaleDateString("en-IN", { month: "short" }),
  };
}

function EmptyState({ text, onClear }) {
  return (
    <div className={`${GLASS} flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center`}>
      <span className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/40">
        <CalendarX2 className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm text-white/50">{text}</p>
      {onClear ? (
        <button type="button" onClick={onClear} className={actionButtonClass}>
          Clear search
        </button>
      ) : null}
    </div>
  );
}

function ModalShell({ labelledBy, onBackdrop, maxWidth = "max-w-md", children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onBackdrop();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-t-3xl border border-white/10 bg-neutral-950/85 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white shadow-2xl shadow-black/60 backdrop-blur-2xl sm:rounded-2xl`}
      >
        {children}
      </section>
    </div>
  );
}

export default function EventsList({ role, onEdit, onDelete }) {
  const { user, profile, role: authRole, loading } = useAuth();
  const activeRole = role || authRole;
  const signedInEmail = String(user?.email || "").trim().toLowerCase();
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("active");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const listTopRef = useRef(null);

  // Create event state
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    if (!db || loading || !user || !["superadmin", "admin", "member", "guest"].includes(activeRole)) {
      setEvents([]);
      setEventsLoading(false);
      setError("");
      return undefined;
    }

    setError("");
    setEventsLoading(true);
    const eventsQuery = query(collection(db, "events"), orderBy("date"));
    const unsubscribe = onSnapshot(
      eventsQuery,
      (snapshot) => {
        setEvents(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
        setEventsLoading(false);
      },
      (snapshotError) => {
        console.error("Events listener:", snapshotError.code, snapshotError.message);
        setEvents([]);
        setEventsLoading(false);
        setError(`Could not load events (${snapshotError.code || "unknown"}).`);
      },
    );

    return () => unsubscribe();
  }, [activeRole, loading, user]);

  // Back to page 1 whenever the view changes
  useEffect(() => {
    setPage(1);
  }, [tab, search]);

  // Search first, then split, so the tab counts reflect the search
  const searched = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return events;
    return events.filter((event) =>
      [event.name, event.venue, event.type, event.date, formatEventDate(event.date)]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(term)),
    );
  }, [events, search]);

  const active = useMemo(
    () =>
      searched
        .filter((event) => event?.completed !== true)
        .sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [searched],
  );
  const completed = useMemo(
    () =>
      searched
        .filter((event) => event?.completed === true)
        .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [searched],
  );

  const visible = tab === "active" ? active : completed;
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedEvents = visible.slice(pageStart, pageStart + PAGE_SIZE);
  const rangeEnd = Math.min(pageStart + PAGE_SIZE, visible.length);

  const showAttendance = ["superadmin", "admin", "member"].includes(activeRole);
  const showTodo = ["member", "admin", "superadmin"].includes(activeRole);
  const canCreate = ["superadmin", "admin", "member"].includes(activeRole);

  function goToPage(next) {
    setPage(next);
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openModal() {
    setName("");
    setDate("");
    setFormError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setName("");
    setDate("");
    setFormError("");
  }

  async function handleCreate(event) {
    event.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setFormError("Enter an event name.");
      return;
    }

    if (!date) {
      setFormError("Pick a date.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      await addDoc(collection(db, "events"), {
        name: trimmedName,
        date,
        completed: false,
        completedAt: null,
        createdBy: (user?.email || "").trim().toLowerCase(),
        createdByName: String(profile?.fullName || profile?.name || user?.displayName || user?.email || "").trim(),
        createdAt: serverTimestamp(),
      });

      setModalOpen(false);
      setName("");
      setDate("");
      setFormError("");
      setToast("Event created");
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(""), 2500);
    } catch (createError) {
      console.error("Create event:", createError);
      setFormError(`Could not create the event (${createError?.code || "unknown"}).`);
    } finally {
      setSaving(false);
    }
  }

  const renderCard = (event, isCompleted) => {
    const { day, month } = dateParts(event.date);
    const canDelete =
      onDelete &&
      (activeRole === "superadmin" || String(event.createdBy || "").trim().toLowerCase() === signedInEmail);
    const hasActions = showTodo || showAttendance || onEdit || canDelete;

    return (
      <article
        key={event.id}
        className={`${GLASS} flex h-full flex-col p-5 transition duration-200 hover:bg-white/[0.09] ${
          isCompleted ? "opacity-70" : ""
        }`}
      >
        <div className="flex flex-1 items-start gap-4">
          <div
            className={`flex size-14 shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 leading-none ${
              isCompleted ? "bg-white/5" : "bg-violet-500/15"
            }`}
          >
            <span className="text-lg font-bold">{day}</span>
            <span className="mt-1 text-[10px] uppercase tracking-wider text-violet-200/80">{month}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold leading-snug">{event.name}</h3>
              {isCompleted ? (
                <span className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-white/60">
                  Done
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-white/50">{formatEventDate(event.date)}</p>
            {event.venue ? (
              <p className="mt-1 flex items-center gap-1 truncate text-xs text-white/50">
                <MapPin className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{event.venue}</span>
              </p>
            ) : null}
            {event.type ? (
              <span className="mt-2 inline-block rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[.14em] text-white/60">
                {event.type}
              </span>
            ) : null}
          </div>
        </div>

        {hasActions ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
            {showTodo ? (
              <Link href={`/${activeRole}/events/${event.id}`} className={actionButtonClass}>
                <ListTodo className="size-3.5" aria-hidden="true" />
                Todo
              </Link>
            ) : null}
            {showAttendance ? (
              <Link href={`/${activeRole}/events/${event.id}/attendance`} className={actionButtonClass}>
                <ClipboardCheck className="size-3.5" aria-hidden="true" />
                Attendance
              </Link>
            ) : null}
            {onEdit ? (
              <button type="button" onClick={() => onEdit(event)} className={actionButtonClass}>
                <Pencil className="size-3.5" aria-hidden="true" />
                Edit
              </button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                onClick={() => onDelete(event)}
                className={`${actionButtonClass} !border-red-300/25 !bg-red-400/10 !text-red-200 hover:!bg-red-400/20`}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Delete
              </button>
            ) : null}
          </div>
        ) : null}
      </article>
    );
  };

  const tabs = [
    { id: "active", label: "Active", count: active.length },
    { id: "completed", label: "Completed", count: completed.length },
  ];

  return (
    <div className="space-y-6">
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100 backdrop-blur-md"
        >
          {error}
        </p>
      ) : null}

      {/* Tabs + create button + search: stacked on mobile, one row from sm */}
            {/* Mobile: toggle + create on one row, search below.
          Desktop (sm+): toggle left, search centered, create right. */}
      <div className="flex flex-wrap items-center gap-3 sm:grid sm:grid-cols-[1fr_auto_1fr]">
        <div
          role="tablist"
          aria-label="Event status"
          className="order-1 flex min-w-0 flex-1 items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-md sm:w-fit sm:flex-none sm:justify-self-start"
        >
          {tabs.map((item) => {
            const selected = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(item.id)}
                className={`!min-h-0 flex flex-1 items-center justify-center gap-2 !rounded-full px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:flex-none ${
                  selected ? "bg-white/15 text-white" : "text-white/55 hover:text-white"
                }`}
              >
                {item.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    selected ? "bg-white/20 text-white" : "bg-white/10 text-white/60"
                  }`}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative order-3 w-full basis-full sm:order-2 sm:w-72 sm:basis-auto sm:justify-self-center">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/40"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, venue or date"
            aria-label="Search events"
            className={`${searchInputClass} [&::-webkit-search-cancel-button]:hidden`}
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="!min-h-0 absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center !rounded-full text-white/50 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {canCreate ? (
          <button
            type="button"
            onClick={openModal}
            className={`${PRIMARY} order-2 shrink-0 sm:order-3 sm:justify-self-end`}
          >
            <Plus className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Create event</span>
            <span className="sm:hidden">Create</span>
          </button>
        ) : null}
      </div>

      <div ref={listTopRef} className="scroll-mt-24" />

      {eventsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className={`${GLASS} h-40 animate-pulse`} />
          ))}
          <span className="sr-only">Loading events</span>
        </div>
      ) : visible.length === 0 ? (
        search.trim() ? (
          <EmptyState text={`No ${tab} events match "${search.trim()}".`} onClear={() => setSearch("")} />
        ) : (
          <EmptyState text={tab === "active" ? "No active events." : "No completed events yet."} />
        )
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pagedEvents.map((event) => renderCard(event, tab === "completed"))}
          </div>

          {/* Pagination: only when there is more than one page */}
          {totalPages > 1 ? (
            <nav
              aria-label="Events pagination"
              className="flex items-center justify-between gap-3 pt-2"
            >
              <p className="text-xs text-white/45">
                {pageStart + 1}–{rangeEnd} of {visible.length}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => goToPage(safePage - 1)}
                  disabled={safePage <= 1}
                  aria-label="Previous page"
                  className="!min-h-0 flex size-9 items-center justify-center !rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                <span className="min-w-14 text-center text-xs text-white/60">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(safePage + 1)}
                  disabled={safePage >= totalPages}
                  aria-label="Next page"
                  className="!min-h-0 flex size-9 items-center justify-center !rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </div>
            </nav>
          ) : null}
        </>
      )}

      {toast ? (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-neutral-950/85 px-5 py-3 text-sm text-white shadow-lg shadow-black/40 backdrop-blur-xl md:bottom-6"
        >
          {toast}
        </div>
      ) : null}

      {modalOpen ? (
        <ModalShell labelledBy="create-event-title" onBackdrop={closeModal}>
          <p className={EYEBROW}>Events</p>
          <h2 id="create-event-title" className="mt-2 text-2xl font-semibold">
            Create event
          </h2>
          <form onSubmit={handleCreate} noValidate>
            <div className="mt-5">
              <label htmlFor="event-name" className={LABEL}>
                Event name
              </label>
              <input
                id="event-name"
                type="text"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={INPUT}
              />
            </div>

            <div className="mt-4">
              <label htmlFor="event-date" className={LABEL}>
                Date
              </label>
              <input
                id="event-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className={INPUT}
              />
            </div>

            {formError ? (
              <p role="alert" className={`${ERROR_BANNER} mt-4`}>
                {formError}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeModal} disabled={saving} className={GHOST}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className={PRIMARY}>
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}
    </div>
  );
}