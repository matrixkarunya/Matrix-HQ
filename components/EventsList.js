"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { CalendarX2, ClipboardCheck, ListTodo, MapPin, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";

const GLASS =
  "rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20 backdrop-blur-xl";

// One shared style for every action button on an event card.
const actionButtonClass =
  "!min-h-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap !rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50";

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

function EmptyState({ text }) {
  return (
    <div className={`${GLASS} flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center`}>
      <span className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/40">
        <CalendarX2 className="size-5" />
      </span>
      <p className="text-sm text-white/50">{text}</p>
    </div>
  );
}

export default function EventsList({ role, onEdit, onDelete }) {
  const { user, role: authRole, loading } = useAuth();
  const activeRole = role || authRole;
  const signedInEmail = String(user?.email || "").trim().toLowerCase();
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("active");

  useEffect(() => {
    if (!db || loading || !user || !["superadmin", "admin", "member", "guest"].includes(activeRole)) {
      setEvents([]);
      setError("");
      return undefined;
    }

    setError("");
    const eventsQuery = query(collection(db, "events"), orderBy("date"));
    const unsubscribe = onSnapshot(
      eventsQuery,
      (snapshot) => {
        setEvents(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
      },
      (snapshotError) => {
        console.error("Events listener:", snapshotError.code, snapshotError.message);
        setEvents([]);
        setError(`Could not load events (${snapshotError.code || "unknown"}).`);
      },
    );

    return () => unsubscribe();
  }, [activeRole, loading, user]);

  const active = useMemo(
    () =>
      events
        .filter((event) => event?.completed !== true)
        .sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [events],
  );
  const completed = useMemo(
    () =>
      events
        .filter((event) => event?.completed === true)
        .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [events],
  );

  const visible = tab === "active" ? active : completed;
  const showAttendance = ["superadmin", "admin", "member"].includes(activeRole);
  const showTodo = ["member", "admin", "superadmin"].includes(activeRole);

  const renderCard = (event, isCompleted) => {
    const { day, month } = dateParts(event.date);
    const canDelete =
      onDelete &&
      (activeRole === "superadmin" || String(event.createdBy || "").trim().toLowerCase() === signedInEmail);
    const hasActions = showTodo || showAttendance || onEdit || canDelete;

    return (
      <article
        key={event.id}
        className={`${GLASS} flex flex-col p-5 transition duration-200 hover:bg-white/[0.09] ${
          isCompleted ? "opacity-70" : ""
        }`}
      >
        <div className="flex items-start gap-4">
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
                <MapPin className="size-3 shrink-0" />
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
                <ListTodo className="size-3.5" />
                Todo
              </Link>
            ) : null}
            {showAttendance ? (
              <Link href={`/${activeRole}/events/${event.id}/attendance`} className={actionButtonClass}>
                <ClipboardCheck className="size-3.5" />
                Attendance
              </Link>
            ) : null}
            {onEdit ? (
              <button type="button" onClick={() => onEdit(event)} className={actionButtonClass}>
                <Pencil className="size-3.5" />
                Edit
              </button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                onClick={() => onDelete(event)}
                className={`${actionButtonClass} !border-red-300/25 !bg-red-400/10 !text-red-200 hover:!bg-red-400/20`}
              >
                <Trash2 className="size-3.5" />
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

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Event status"
        className="flex w-fit items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-md"
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
              className={`!min-h-0 flex items-center gap-2 !rounded-full px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
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

      {/* Grid */}
      {visible.length === 0 ? (
        <EmptyState text={tab === "active" ? "No active events." : "No completed events yet."} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((event) => renderCard(event, tab === "completed"))}
        </div>
      )}
    </div>
  );
}