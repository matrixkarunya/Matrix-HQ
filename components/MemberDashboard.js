"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  collectionGroup,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { CalendarDays, CheckCircle2, Clock3, ListTodo, Percent, ArrowUpRight, Inbox } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import SemesterBadge from "@/components/SemesterBadge";
import { useAuth } from "@/context/AuthContext";
import { useSemester } from "@/context/SemesterContext";
import { completionRequestId, completionRequestRef, requestStatusLabel } from "@/lib/completionRequests";
import { db } from "@/lib/firebase";
import useMyHours from "@/lib/useMyHours";

const GLASS =
  "rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20 backdrop-blur-xl";

// Local YYYY-MM-DD (avoids the UTC off-by-one that toISOString() can cause)
function localToday() {
  return new Date().toLocaleDateString("en-CA");
}

function displayDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function dateParts(value) {
  if (!value) return { day: "—", month: "" };
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return {
    day: String(day).padStart(2, "0"),
    month: date.toLocaleDateString("en-IN", { month: "short" }),
  };
}

function taskDone(task) {
  return Array.isArray(task.subtasks) && task.subtasks.length > 0
    ? task.subtasks.every((subtask) => subtask.done === true)
    : task.done === true;
}

function CompletionModal({ item, saving, onCancel, onSubmit }) {
  const [note, setNote] = useState("");
  const dialogRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    function handleKeyDown(event) {
      if (event.key === "Escape") onCancel();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = [...dialogRef.current.querySelectorAll("button, textarea")].filter(
        (control) => !control.disabled
      );
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onCancel()}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-request-title"
        className="w-full max-w-md rounded-t-3xl border border-white/10 bg-neutral-950/85 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white shadow-2xl shadow-black/60 backdrop-blur-2xl sm:rounded-2xl"
      >
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80">
          Request completion
        </p>
        <h2 id="dashboard-request-title" className="mt-3 text-2xl font-semibold">
          Mark {item.name} completed?
        </h2>
        <p className="mt-3 text-sm text-white/60">
          This sends a request for approval on {item.event.name}.
        </p>

        <label htmlFor="dashboard-request-note" className="mt-5 block text-sm font-medium text-white/80">
          Note (optional)
        </label>
        <textarea
          ref={inputRef}
          id="dashboard-request-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={4}
          className="mt-2 w-full resize-none rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
        />

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(note)}
            disabled={saving}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Submitting…" : "Submit request"}
          </button>
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, progress }) {
  return (
    <div className={`${GLASS} group p-5 transition duration-200 hover:bg-white/[0.09]`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[.16em] text-white/50">{label}</span>
        <span className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-violet-500/15 text-violet-200 transition group-hover:scale-110">
          <Icon className="size-[18px]" />
        </span>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight lg:text-4xl">{value}</p>
      {typeof progress === "number" ? (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-sky-300 transition-all duration-700"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      ) : (
        <div className="mt-4 h-1.5" />
      )}
    </div>
  );
}

function CardHeader({ title, subtitle, href, linkLabel }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-white/45">{subtitle}</p> : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="group flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          {linkLabel}
          <ArrowUpRight className="size-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 py-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/40">
        <Icon className="size-5" />
      </span>
      <p className="text-sm text-white/45">{text}</p>
    </div>
  );
}

function MemberDashboardContent() {
  const { user, profile, loading } = useAuth();
  const { activeSemesterId } = useSemester();
  const email = String(user?.email || "").trim().toLowerCase();
  const { attendancePercentage } = useMyHours();
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [modalItem, setModalItem] = useState(null);
  const [savingKey, setSavingKey] = useState("");

  // Upcoming events of the active semester only, fetched once.
  useEffect(() => {
    if (!db || loading || !user) return undefined;
    let cancelled = false;

    getDocs(
      query(collection(db, "events"), where("date", ">=", localToday()), orderBy("date"), limit(20))
    )
      .then((snapshot) => {
        if (cancelled) return;
        setEvents(
          snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .filter((event) => event.semesterId && event.semesterId === activeSemesterId),
        );
      })
      .catch((snapshotError) => {
        if (!cancelled) setError(`Could not load dashboard events (${snapshotError.code || "unknown"}).`);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSemesterId, loading, user]);

  // One query for all of my tasks across events, fetched once.
  useEffect(() => {
    if (!db || loading || !user || !email) {
      setTasks([]);
      return undefined;
    }
    let cancelled = false;

    getDocs(query(collectionGroup(db, "tasks"), where("assignees", "array-contains", email), limit(50)))
      .then((snapshot) => {
        if (cancelled) return;
        setTasks(
          snapshot.docs.map((item) => ({
            ...item.data(),
            id: item.id,
            eventId: item.ref.parent.parent.id,
          }))
        );
      })
      .catch((snapshotError) => {
        if (!cancelled) setError(`Could not load dashboard tasks (${snapshotError.code || "unknown"}).`);
      });

    return () => {
      cancelled = true;
    };
  }, [email, loading, user]);

  // Kept live: powers the "Pending" stat and the Pending chip on each todo.
  useEffect(() => {
    if (!db || loading || !user || !email) {
      setRequests([]);
      return undefined;
    }
    const unsubscribe = onSnapshot(
      query(collection(db, "completionRequests"), where("requestedBy", "==", email), limit(50)),
      (snapshot) => {
        setRequests(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      },
      (snapshotError) => setError(`Could not load dashboard requests (${snapshotError.code || "unknown"}).`)
    );
    return () => unsubscribe();
  }, [email, loading, user]);

  const pendingRequests = useMemo(() => requests.filter((request) => request.status === "pending"), [requests]);
  const requestMap = useMemo(() => Object.fromEntries(requests.map((request) => [request.id, request])), [requests]);
  const eventsById = useMemo(() => Object.fromEntries(events.map((event) => [event.id, event])), [events]);

  const openItems = useMemo(
    () =>
      tasks.flatMap((task) => {
        const event = eventsById[task.eventId];
        if (!event) return []; // task belongs to a past, other-semester or unloaded event
        const items = taskDone(task) ? [] : [{ event, task, subtaskId: "todo", name: task.title }];
        if (task.subtasks?.length)
          items.push(
            ...task.subtasks
              .filter((subtask) => subtask.done !== true)
              .map((subtask) => ({ event, task, subtaskId: subtask.id, name: subtask.title }))
          );
        return items;
      }),
    [tasks, eventsById]
  );

  const pendingForItem = (item) =>
    requestMap[completionRequestId(item.event.id, item.task.id, email, item.subtaskId)];

  const upcoming = useMemo(() => {
    const today = localToday();
    return events
      .filter((event) => event.completed !== true && String(event.date || "") >= today)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [events]);

  async function submitRequest(note) {
    if (!modalItem) return;
    const key = `${modalItem.event.id}/${modalItem.task.id}/${modalItem.subtaskId}`;
    setSavingKey(key);
    try {
      await setDoc(
        completionRequestRef(modalItem.event.id, modalItem.task.id, email, modalItem.subtaskId),
        {
          eventId: modalItem.event.id,
          todoId: modalItem.task.id,
          ...(modalItem.subtaskId !== "todo" ? { subtaskId: modalItem.subtaskId } : {}),
          requestedBy: email,
          requestedByRole: "member",
          note: note.trim() || null,
          reviewedBy: null,
          status: "pending",
          rejectionReason: null,
          createdAt: serverTimestamp(),
          reviewedAt: null,
        },
        { merge: true }
      );
      setModalItem(null);
    } catch (requestError) {
      setError(`Could not submit the request (${requestError.code || "unknown"}).`);
    } finally {
      setSavingKey("");
    }
  }

  const openCount = openItems.filter(
    (item) =>
      !pendingForItem(item) &&
      requestStatusLabel(pendingForItem(item), item.task, item.subtaskId) !== "Completed"
  ).length;

  const name = profile?.fullName || user?.displayName || "Member";
  const firstName = String(name).split(" ")[0];
  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    // MemberShell already renders <main>, so this is a div to avoid nested <main> tags
    <div className="w-full text-white">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80">
            Member dashboard
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">Hi {firstName}</h1>
          <p className="mt-1.5 text-sm text-white/50">Signed in as {user?.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SemesterBadge />
          <div className="flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 backdrop-blur-md">
            <CalendarDays className="size-4 text-violet-300" />
            {todayLabel}
          </div>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100 backdrop-blur-md"
        >
          {error}
        </p>
      ) : null}

      {/* Stats */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:mt-8 lg:grid-cols-4">
        <StatCard
          icon={Percent}
          label="Attendance"
          value={attendancePercentage === null ? "—" : `${attendancePercentage.toFixed(1)}%`}
          progress={attendancePercentage === null ? 0 : attendancePercentage}
        />
        <StatCard icon={ListTodo} label="Open todos" value={openCount} />
        <StatCard icon={CalendarDays} label="Upcoming" value={upcoming.length} />
        <StatCard icon={Clock3} label="Pending" value={pendingRequests.length} />
      </section>

      <Link href="/member/meetings" className={`${GLASS} mt-4 flex items-center justify-between gap-4 p-5 transition hover:bg-white/[0.09] sm:mt-6`}>
        <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-violet-500/15 text-violet-200"><Clock3 className="size-5" /></span><div><h2 className="text-base font-semibold">Meetings</h2><p className="mt-1 text-xs text-white/50">View your meeting attendance and hours</p></div></div><ArrowUpRight className="size-4 text-white/50" />
      </Link>

      {/* Main grid: both cards stretch to the same height */}
      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-12 lg:items-stretch">
        {/* My todo */}
        <section className={`${GLASS} flex flex-col p-5 sm:p-6 lg:col-span-7`}>
          <CardHeader
            title="My todo"
            subtitle={`${openItems.length} open ${openItems.length === 1 ? "item" : "items"}`}
            href="/member/todo"
            linkLabel="View all"
          />

          <div className="mt-4 flex-1">
            {openItems.slice(0, 5).map((item) => {
              const request = pendingForItem(item);
              const subtasks = item.task.subtasks || [];
              return (
                <div
                  key={`${item.event.id}-${item.task.id}-${item.subtaskId}`}
                  className="-mx-3 flex items-center justify-between gap-4 rounded-xl px-3 py-3 transition hover:bg-white/[0.06]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/50">
                      <ListTodo className="size-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="mt-0.5 truncate text-xs text-white/50">
                        {item.event.name}
                        {subtasks.length
                          ? ` · Subtasks ${subtasks.filter((subtask) => subtask.done).length}/${subtasks.length}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  {request ? (
                    <span className="shrink-0 rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1.5 text-[11px] uppercase tracking-[.12em] text-sky-200">
                      Pending
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setModalItem(item)}
                      className="flex shrink-0 items-center gap-1.5 rounded-full border border-violet-300/40 bg-violet-500/15 px-4 py-2 text-xs font-semibold text-violet-100 transition hover:scale-105 hover:bg-violet-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60"
                    >
                      <CheckCircle2 className="size-3.5" />
                      Completed
                    </button>
                  )}
                </div>
              );
            })}
            {openItems.length === 0 ? <EmptyState icon={Inbox} text="No open todos. You're all caught up." /> : null}
          </div>

          {openItems.length > 5 ? (
            <Link
              href="/member/todo"
              className="mt-3 block rounded-xl border border-white/10 bg-white/5 py-2.5 text-center text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              +{openItems.length - 5} more
            </Link>
          ) : null}
        </section>

        {/* Upcoming events */}
        <section className={`${GLASS} flex flex-col p-5 sm:p-6 lg:col-span-5`}>
          <CardHeader
            title="Upcoming events"
            subtitle={`${upcoming.length} scheduled`}
            href="/member/events"
            linkLabel="View events"
          />

          <div className="mt-4 flex-1">
            {upcoming.slice(0, 5).map((event) => {
              const { day, month } = dateParts(event.date);
              return (
                <div
                  key={event.id}
                  className="-mx-3 flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-white/[0.06]"
                >
                  <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-violet-500/15 leading-none">
                    <span className="text-base font-bold">{day}</span>
                    <span className="mt-1 text-[10px] uppercase tracking-wider text-violet-200/80">{month}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{event.name}</p>
                    <p className="mt-0.5 truncate text-xs text-white/50">
                      {event.venue || displayDate(event.date)}
                    </p>
                  </div>
                  {event.type ? (
                    <span className="hidden shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.14em] text-white/60 xl:block">
                      {event.type}
                    </span>
                  ) : null}
                </div>
              );
            })}
            {upcoming.length === 0 ? <EmptyState icon={CalendarDays} text="No upcoming events" /> : null}
          </div>

          {upcoming.length > 5 ? (
            <Link
              href="/member/events"
              className="mt-3 block rounded-xl border border-white/10 bg-white/5 py-2.5 text-center text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              +{upcoming.length - 5} more
            </Link>
          ) : null}
        </section>
      </div>

      {modalItem ? (
        <CompletionModal
          item={modalItem}
          saving={Boolean(savingKey)}
          onCancel={() => !savingKey && setModalItem(null)}
          onSubmit={submitRequest}
        />
      ) : null}
    </div>
  );
}

export default function MemberDashboard() {
  return (
    <RoleGuard allow={["member"]}>
      <MemberDashboardContent />
    </RoleGuard>
  );
}