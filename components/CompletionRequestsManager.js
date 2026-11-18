"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { ArrowLeft, CalendarDays, Check, ChevronDown, Clock3, Inbox } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import TimeRangesModal from "@/components/TimeRangesModal";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { formatMinutes, sumRanges, validateRanges } from "@/lib/hours";
import { cleanTimeEntries } from "@/lib/completionRequests";
import useUsers from "@/lib/useUsers";

const GLASS =
  "rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20 backdrop-blur-xl";
const SCROLL =
  "[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-white/35 [&::-webkit-scrollbar-corner]:bg-transparent [@supports(not(selector(::-webkit-scrollbar)))]:[scrollbar-width:thin] [@supports(not(selector(::-webkit-scrollbar)))]:[scrollbar-color:rgba(255,255,255,0.25)_transparent]";

const PRIMARY =
  "!min-h-0 inline-flex items-center justify-center gap-2 whitespace-nowrap !rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60";
const GHOST =
  "!min-h-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap !rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-60";
const GHOST_DANGER = `${GHOST} !border-red-300/25 !bg-red-400/10 !text-red-200 hover:!bg-red-400/20`;
const ROW_PRIMARY = `${PRIMARY} !px-4 !py-2 !text-xs`;
const ROW_REJECT = `${GHOST_DANGER} !px-4 !py-2`;
const DESTRUCTIVE =
  "!min-h-0 inline-flex items-center justify-center gap-2 whitespace-nowrap !rounded-full bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60";
const INPUT =
  "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-400/30 disabled:cursor-not-allowed disabled:opacity-60 [color-scheme:dark]";
const LABEL = "block text-sm font-medium text-white/80";
const EYEBROW = "text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80";
const ERROR_BANNER =
  "rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100 backdrop-blur-md";
const INFO_BANNER =
  "rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70 backdrop-blur-md";
const PILL = "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70";

function displayTime(value) {
  if (!value) return "—";
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function requestTimestamp(request) {
  const value = request?.createdAt || request?.requestedAt;
  return typeof value?.toMillis === "function" ? value.toMillis() : 0;
}

function nameFor(users, email) {
  const normalized = String(email || "").toLowerCase();
  const user = users.find((item) => String(item.email || "").toLowerCase() === normalized);
  return user?.fullName || user?.name || email || "Unknown member";
}

function FilterSelect({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const listId = useId();
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : options[0];

  useEffect(() => {
    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function toggle() {
    setOpen((current) => {
      if (!current) setActiveIndex(selectedIndex);
      return !current;
    });
  }

  function choose(option) {
    onChange(option.value);
    setOpen(false);
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setActiveIndex(selectedIndex);
        setOpen(true);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + step + options.length) % options.length);
    } else if (event.key === "Enter" && open && activeIndex >= 0) {
      event.preventDefault();
      choose(options[activeIndex]);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        onKeyDown={handleKeyDown}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className="!min-h-0 flex w-full items-center justify-between gap-3 !rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-left text-sm text-white transition hover:bg-white/10 focus:border-violet-300/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
      >
        <span className="min-w-0 truncate">{selected?.label}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-white/50 transition duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label={label}
          className={`absolute left-0 right-0 z-20 mt-2 max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-white/10 bg-neutral-950/95 p-2 shadow-2xl shadow-black/60 backdrop-blur-2xl ${SCROLL}`}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value || "__all"}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => choose(option)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`!min-h-0 flex w-full items-center justify-between gap-3 !rounded-xl border px-3 py-2 text-left text-sm transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50 ${
                  isSelected
                    ? "border-violet-300/30 bg-violet-500/15 text-white"
                    : activeIndex === index
                      ? "border-transparent bg-white/[0.08] text-white"
                      : "border-transparent text-white/80 hover:bg-white/[0.08]"
                }`}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {isSelected ? <Check className="size-4 shrink-0 text-violet-200" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function RequestStatusBadge({ status }) {
  const styles =
    status === "approved"
      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
      : status === "rejected"
        ? "border-red-300/30 bg-red-400/10 text-red-200"
        : status === "pending"
          ? "border-amber-300/30 bg-amber-400/10 text-amber-200"
          : "border-white/15 bg-white/10 text-white/70";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${styles}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {status}
    </span>
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
        className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-t-3xl border border-white/10 bg-neutral-950/85 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white shadow-2xl shadow-black/60 backdrop-blur-2xl sm:rounded-2xl ${SCROLL}`}
      >
        {children}
      </section>
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function RequestsContent() {
  const { user, role, loading } = useAuth();
  const { users } = useUsers();
  const [requests, setRequests] = useState([]);
  const [events, setEvents] = useState([]);
  const [tasksByEvent, setTasksByEvent] = useState({});
  const [statusFilter, setStatusFilter] = useState("pending");
  const [eventFilter, setEventFilter] = useState("");
  const [memberFilter, setMemberFilter] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [approvalDialog, setApprovalDialog] = useState(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    if (!db || loading || !user || !["admin", "superadmin"].includes(role)) return undefined;
    if (role === "superadmin") {
      const unsubscribe = onSnapshot(collection(db, "completionRequests"), (snapshot) => {
        setRequests(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      }, (snapshotError) => setError(`Could not load requests (${snapshotError.code || "unknown"}).`));
      return () => unsubscribe();
    }
    return undefined;
  }, [loading, role, user]);

  useEffect(() => {
    if (!db || loading || !user || !["admin", "superadmin"].includes(role)) return undefined;
    const unsubscribe = onSnapshot(collection(db, "events"), (snapshot) => {
      setEvents(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, (snapshotError) => setError(`Could not load events (${snapshotError.code || "unknown"}).`));
    return () => unsubscribe();
  }, [loading, role, user]);

  useEffect(() => {
    if (role !== "admin" || !user || events.length === 0) return undefined;
    const ownedEvents = events.filter((event) => event.createdBy === String(user.email || "").toLowerCase());
    if (ownedEvents.length === 0) {
      setRequests([]);
      return undefined;
    }
    const byId = new Map();
    const unsubscribers = ownedEvents.map((event) => onSnapshot(
      query(collection(db, "completionRequests"), where("eventId", "==", event.id)),
      (snapshot) => {
        snapshot.docs.forEach((item) => byId.set(item.id, { id: item.id, ...item.data() }));
        setRequests([...byId.values()]);
      },
      (snapshotError) => setError(`Could not load requests (${snapshotError.code || "unknown"}).`),
    ));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [events, role, user]);

  useEffect(() => {
    if (!db || events.length === 0) return undefined;
    const visibleEvents = role === "admin"
      ? events.filter((event) => event.createdBy === String(user?.email || "").toLowerCase())
      : events;
    const unsubscribers = visibleEvents.map((event) => onSnapshot(collection(db, "events", event.id, "tasks"), (snapshot) => {
      setTasksByEvent((current) => ({
        ...current,
        [event.id]: Object.fromEntries(snapshot.docs.map((item) => [item.id, { id: item.id, ...item.data() }])),
      }));
    }, (snapshotError) => setError(`Could not load tasks (${snapshotError.code || "unknown"}).`)));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [events, role, user]);

  const eventById = useMemo(() => Object.fromEntries(events.map((event) => [event.id, event])), [events]);
  const visibleRequests = useMemo(() => requests
    .filter((request) => !statusFilter || request.status === statusFilter)
    .filter((request) => !eventFilter || request.eventId === eventFilter)
    .filter((request) => !memberFilter || request.requestedBy === memberFilter)
    .filter((request) => role === "superadmin" || eventById[request.eventId]?.createdBy === String(user?.email || "").toLowerCase())
    .sort((first, second) => requestTimestamp(second) - requestTimestamp(first)), [eventById, eventFilter, memberFilter, requests, role, statusFilter, user]);
  const pendingCount = requests.filter((request) => request.status === "pending" && (role === "superadmin" || eventById[request.eventId]?.createdBy === String(user?.email || "").toLowerCase())).length;

  const eventOptions = useMemo(
    () => [{ value: "", label: "All events" }, ...events.map((event) => ({ value: event.id, label: event.name }))],
    [events],
  );
  const memberOptions = useMemo(
    () => [
      { value: "", label: "All members" },
      ...[...new Set(requests.map((request) => request.requestedBy))].map((email) => ({
        value: email,
        label: nameFor(users, email),
      })),
    ],
    [requests, users],
  );

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  }

  async function approve(request, entries, isWorkingDay = true) {
    const event = eventById[request.eventId];
    const task = tasksByEvent[request.eventId]?.[request.todoId];
    if (!event || !task) {
      setError("Could not find this task. It may have been deleted.");
      return;
    }
    const validation = validateRanges(entries);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    setBusyId(request.id);
    setError("");
    try {
      const nextSubtasks = Array.isArray(task.subtasks) ? task.subtasks.map((subtask) => ({
        ...subtask,
        done: request.subtaskId ? subtask.id === request.subtaskId ? true : Boolean(subtask.done) : true,
      })) : [];
      const nextDone = request.subtaskId ? (nextSubtasks.length > 0 && nextSubtasks.every((subtask) => subtask.done)) : true;
      const batch = writeBatch(db);
      batch.update(doc(db, "completionRequests", request.id), {
        status: "approved",
        reviewedBy: String(user.email).toLowerCase(),
        reviewedByName: nameFor(users, user.email),
        reviewedAt: serverTimestamp(),
        timeEntries: cleanTimeEntries(entries),
        isWorkingDay: isWorkingDay !== false,
      });
      batch.update(doc(db, "events", request.eventId, "tasks", request.todoId), {
        subtasks: nextSubtasks,
        done: nextDone,
        approvalRequestId: request.id,
      });
      await batch.commit();
      setApprovalDialog(null);
      showToast("Request approved");
    } catch (approvalError) {
      setError(`Could not approve the request (${approvalError.code || "unknown"}).`);
    } finally {
      setBusyId("");
    }
  }

  async function reject(request, rejectionReason = "") {
    setBusyId(request.id);
    setError("");
    try {
      await updateDoc(doc(db, "completionRequests", request.id), {
        status: "rejected",
        reviewedBy: String(user.email).toLowerCase(),
        reviewedByName: nameFor(users, user.email),
        reviewedAt: serverTimestamp(),
        rejectionReason: rejectionReason.trim() || null,
      });
      setRejecting(null);
      setReason("");
      showToast("Request rejected");
    } catch (rejectError) {
      setError(`Could not reject the request (${rejectError.code || "unknown"}).`);
    } finally {
      setBusyId("");
    }
  }

  function reviewerName(email) {
    return nameFor(users, email);
  }

  function openApproval(request) {
    setApprovalDialog(request);
    setError("");
  }

  function isOwnAdminRequest(request) {
    return role === "admin"
      && request.requestedBy === String(user?.email || "").trim().toLowerCase();
  }

  const closeApproval = useCallback(() => {
    if (!busyId) setApprovalDialog(null);
  }, [busyId]);
  const confirmApproval = useCallback((entries, _selectedAssignees, isWorkingDay) => {
    if (approvalDialog) approve(approvalDialog, entries, isWorkingDay);
  }, [approvalDialog, eventById, tasksByEvent, user, users]);

  return (
    <div className="w-full text-white">
      <Link
        href={role === "superadmin" ? "/superadmin" : "/admin"}
        className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-white/70 backdrop-blur-md transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      >
        <ArrowLeft
          className="size-3.5 transition duration-200 group-hover:-translate-x-0.5"
          aria-hidden="true"
        />
        Back to dashboard
      </Link>

      <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className={EYEBROW}>Review</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">Completion requests</h1>
          <p className="mt-2 text-sm text-white/50">{pendingCount} pending</p>
        </div>
      </header>

      {error ? (
        <p role="alert" className={`${ERROR_BANNER} mt-4 sm:mt-6`}>
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:mt-6 md:grid-cols-3">
        <FilterSelect
          label="Filter by status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
        />
        <FilterSelect
          label="Filter by event"
          value={eventFilter}
          onChange={setEventFilter}
          options={eventOptions}
        />
        <FilterSelect
          label="Filter by member"
          value={memberFilter}
          onChange={setMemberFilter}
          options={memberOptions}
        />
      </div>

      {role === "admin" && visibleRequests.some((request) => isOwnAdminRequest(request) && request.status === "pending") ? (
        <p role="status" className={`${INFO_BANNER} mt-4`}>Waiting for superadmin</p>
      ) : null}

      <TimeRangesModal
        key={approvalDialog?.id || "closed"}
        open={Boolean(approvalDialog)}
        title="Approve request?"
        description={approvalDialog ? `Add the time spent by ${nameFor(users, approvalDialog.requestedBy)}.` : ""}
        showWorkingDayToggle
        saving={Boolean(busyId)}
        externalError={error}
        onClose={closeApproval}
        onConfirm={confirmApproval}
      />

      {visibleRequests.length === 0 ? (
        <div className={`${GLASS} mt-4 flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center sm:mt-6`}>
          <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/40">
            <Inbox className="size-6" aria-hidden="true" />
          </div>
          <p className="text-sm text-white/40">No {statusFilter || ""} requests.</p>
        </div>
      ) : (
        <section className={`${GLASS} mt-4 overflow-hidden sm:mt-6`}>
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[.16em] text-white/50">Requests</p>
            <span className="shrink-0 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              {visibleRequests.length} {visibleRequests.length === 1 ? "request" : "requests"}
            </span>
          </div>

          <ul className={`max-h-[65vh] divide-y divide-white/10 overflow-y-auto overscroll-contain ${SCROLL}`}>
            {visibleRequests.map((request) => {
              const task = tasksByEvent[request.eventId]?.[request.todoId];
              const subtask = task?.subtasks?.find((item) => item.id === request.subtaskId);
              const requestIsWorkingDay = request.isWorkingDay !== false;
              const entryTotals = sumRanges(request.timeEntries, requestIsWorkingDay);
              const canReview = request.status === "pending" && request.requestedBy !== String(user?.email || "").toLowerCase();
              const rowBusy = busyId === request.id;
              return (
                <li key={request.id} className="px-4 py-3 transition hover:bg-white/[0.06]">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <RequestStatusBadge status={request.status} />
                        <p className="min-w-0 truncate text-sm font-semibold text-white">
                          {nameFor(users, request.requestedBy)}{" "}
                          <span className="font-normal text-white/50">({request.requestedByRole || "member"})</span>
                        </p>
                      </div>

                      <p className="mt-1.5 truncate text-sm text-white/80">{subtask?.title || task?.title || "Task"}</p>

                      <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-white/50">
                        <CalendarDays className="size-3.5 shrink-0 text-violet-300" aria-hidden="true" />
                        <span className="min-w-0 truncate">
                          {eventById[request.eventId]?.name || request.eventId} · {displayTime(request.createdAt)}
                        </span>
                      </p>

                      {request.note ? <p className="mt-1.5 line-clamp-2 break-words text-xs text-white/60">Note: {request.note}</p> : null}
                      {request.reviewedBy ? (
                        <p className="mt-1.5 truncate text-xs text-white/50">
                          {request.status === "approved" ? "Approved" : "Reviewed"} by {request.reviewedByName || reviewerName(request.reviewedBy)}
                        </p>
                      ) : null}
                      {request.rejectionReason ? <p className="mt-1.5 line-clamp-2 break-words text-xs text-red-200">{request.rejectionReason}</p> : null}

                      {request.status === "approved" && Array.isArray(request.timeEntries) ? (
                        <div className="mt-2 space-y-1.5">
                          <p className="flex min-w-0 items-center gap-1.5 text-xs text-white/60">
                            <Clock3 className="size-3.5 shrink-0 text-violet-300" aria-hidden="true" />
                            <span className="min-w-0 truncate">
                              {request.timeEntries.map((entry) => `${entry.startTime}–${entry.endTime}`).join(", ") || "None"}
                            </span>
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            <span className={PILL}>{requestIsWorkingDay ? "Working day" : "Non-working day"}</span>
                            <span className={PILL}>Working <span className="font-semibold text-white">{formatMinutes(entryTotals.workingMinutes)}</span></span>
                            <span className={PILL}>Non-working <span className="font-semibold text-white">{formatMinutes(entryTotals.nonWorkingMinutes)}</span></span>
                            <span className={PILL}>Total <span className="font-semibold text-white">{formatMinutes(entryTotals.totalMinutes)}</span></span>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {canReview ? (
                      <div className="grid shrink-0 grid-cols-2 gap-2 md:flex">
                        <button
                          type="button"
                          disabled={rowBusy}
                          onClick={() => openApproval(request)}
                          className={ROW_PRIMARY}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={rowBusy}
                          onClick={() => { setRejecting(request); setReason(""); }}
                          className={ROW_REJECT}
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {rejecting ? (
        <ModalShell labelledBy="reject-request-title" onBackdrop={() => !busyId && setRejecting(null)} maxWidth="max-w-md">
          <p className={EYEBROW}>Review</p>
          <h2 id="reject-request-title" className="mt-2 text-2xl font-semibold">Reject request</h2>
          <label htmlFor="rejection-reason" className={`${LABEL} mt-5`}>Reason (optional)</label>
          <textarea
            id="rejection-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            className={`${INPUT} mt-2 resize-none`}
          />
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => setRejecting(null)} className={`${GHOST} !px-5 !py-2.5 !text-sm`}>Cancel</button>
            <button
              type="button"
              disabled={busyId === rejecting.id}
              onClick={() => reject(rejecting, reason)}
              className={DESTRUCTIVE}
            >
              Reject
            </button>
          </div>
        </ModalShell>
      ) : null}

      {toast ? (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-neutral-950/85 px-5 py-3 text-sm text-white shadow-lg shadow-black/40 backdrop-blur-xl md:bottom-6"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

export default function CompletionRequestsManager() {
  return <RoleGuard allow={["admin", "superadmin"]}><RequestsContent /></RoleGuard>;
}