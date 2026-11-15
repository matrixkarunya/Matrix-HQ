"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Inbox,
  ListChecks,
  RotateCcw,
} from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { useAuth } from "@/context/AuthContext";
import { completionRequestId, completionRequestRef, requestStatusLabel } from "@/lib/completionRequests";
import { db } from "@/lib/firebase";

const GLASS =
  "rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20 backdrop-blur-xl";

const violetAction =
  "!min-h-0 inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap !rounded-full border border-violet-300/40 bg-violet-500/15 px-3.5 py-2 text-xs font-semibold text-violet-100 transition hover:scale-105 hover:bg-violet-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "todo", label: "To do" },
  { id: "awaiting", label: "Awaiting" },
  { id: "done", label: "Done" },
];

function displayDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function requestKey(eventId, taskId, subtaskId = "todo") {
  return `${eventId}/${taskId}/${subtaskId}`;
}

function categorize(status) {
  if (status === "Completed") return "done";
  if (status === "Awaiting approval") return "awaiting";
  if (status === "Rejected") return "rejected";
  return "todo";
}

function matchesFilter(filter, kind) {
  if (filter === "all") return true;
  if (filter === "todo") return kind === "todo" || kind === "rejected";
  return filter === kind;
}

function StatusIcon({ kind }) {
  const base = "size-5 shrink-0";
  if (kind === "done") return <CheckCircle2 className={`${base} text-emerald-300`} />;
  if (kind === "awaiting") return <Clock3 className={`${base} text-sky-300`} />;
  if (kind === "rejected") return <AlertCircle className={`${base} text-red-300`} />;
  return <Circle className={`${base} text-white/35`} />;
}

// Safe one-off read that never throws; used by the debug helper and the pre-submit check
async function safeRead(ref) {
  try {
    const snap = await getDoc(ref);
    return snap.exists() ? { exists: true, data: snap.data() } : { exists: false, data: null };
  } catch (readError) {
    return { exists: false, data: null, readError: readError?.code || readError?.message || "unknown" };
  }
}

/**
 * Re-checks, from the client, every condition the Firestore rules make for creating
 * or updating a completionRequest, then prints a pass/fail table to the console.
 * Firestore never says WHICH rule failed, so this mirrors them.
 */
async function debugCompletionFailure({ db, email, role, event, task, subtaskId, payload, requestError }) {
  const requestId = completionRequestId(event.id, task.id, email, subtaskId);

  const [userRead, taskRead, existingRead] = await Promise.all([
    safeRead(doc(db, "users", email)),
    safeRead(doc(db, "events", event.id, "tasks", task.id)),
    safeRead(completionRequestRef(event.id, task.id, email, subtaskId)),
  ]);

  const userData = userRead.data;
  const taskData = taskRead.data;
  const existing = existingRead.data;
  const assignees = taskData?.assignees;
  const assigneesIsArray = Array.isArray(assignees);
  const assigneeExact = assigneesIsArray && assignees.includes(email);
  const assigneeLoose = assigneesIsArray && assignees.some((a) => String(a).trim().toLowerCase() === email);
  const hasExisting = existingRead.exists;

  const checks = [
    ["User doc exists at users/<email>", userRead.exists, userRead.readError ? `read error: ${userRead.readError}` : `doc id used: "${email}"`],
    ["User role is member/admin", ["member", "admin"].includes(userData?.role), `role = ${JSON.stringify(userData?.role)}`],
    ["User is active (active != false)", userData?.active !== false, `active = ${JSON.stringify(userData?.active)}`],
    ["Auth role in app matches Firestore role", role === userData?.role, `app role = ${role}, firestore role = ${userData?.role}`],
    ["payload.requestedBy == my lowercase email", payload.requestedBy === email, `"${payload.requestedBy}" vs "${email}"`],
    ["payload.status == 'pending'", payload.status === "pending", `status = ${payload.status}`],
    ["payload.eventId is string", typeof payload.eventId === "string", typeof payload.eventId],
    ["payload.todoId is string", typeof payload.todoId === "string", typeof payload.todoId],
    ["Task doc exists", taskRead.exists, taskRead.readError ? `read error: ${taskRead.readError}` : `events/${event.id}/tasks/${task.id}`],
    ["Task has assignees array", assigneesIsArray, `assignees = ${JSON.stringify(assignees)}`],
    ["assignees contains my email (exact, lowercase)", assigneeExact, assigneeLoose && !assigneeExact ? "⚠ matches only ignoring case/spaces: fix the stored email" : `my email = "${email}"`],
  ];

  if (hasExisting) {
    const okStatus = ["rejected", "approved"].includes(existing?.status);
    checks.push(
      ["Existing request found → this write is an UPDATE", true, `existing status = ${JSON.stringify(existing?.status)}`],
      ["UPDATE allowed: existing status is rejected/approved", okStatus, okStatus ? "ok" : "a pending/other doc blocks resubmission"],
      ["Existing requestedBy == my email", existing?.requestedBy === email, `"${existing?.requestedBy}"`],
      ["Existing eventId/todoId match payload", existing?.eventId === payload.eventId && existing?.todoId === payload.todoId, `${existing?.eventId}/${existing?.todoId}`],
      ["Existing subtaskId matches payload", (existing?.subtaskId || "") === (payload.subtaskId || ""), `${existing?.subtaskId || "''"} vs ${payload.subtaskId || "''"}`],
    );
  } else {
    checks.push([
      "No existing request → this write is a CREATE",
      true,
      existingRead.readError ? `(read of missing doc returned: ${existingRead.readError}, normal for a doc that doesn't exist)` : "ok",
    ]);
  }

  const rows = checks.map(([check, pass, detail]) => ({ result: pass ? "✅" : "❌", check, detail }));
  const failed = rows.filter((row) => row.result === "❌");

  console.groupCollapsed(`%cCompletion request DEBUG → ${failed.length ? `${failed.length} check(s) failed` : "all client-side checks pass"}`, "color:#f87171;font-weight:bold");
  console.log("Firebase error:", requestError?.code, "|", requestError?.message);
  console.log("Request doc ID:", requestId);
  console.log("Write type:", hasExisting ? "UPDATE (doc already exists)" : "CREATE");
  console.log("Payload sent:", payload);
  console.log("User doc:", userRead);
  console.log("Task doc:", taskRead);
  console.log("Existing request doc:", existingRead);
  console.table(rows);
  if (failed.length) {
    console.warn("❌ Most likely cause(s):\n" + failed.map((row) => `• ${row.check}: ${row.detail}`).join("\n"));
  } else {
    console.warn(
      "All client-side checks pass, so the rejection is probably from stale/unpublished rules, or from the task's parent event/user doc rules (ownsEvent, isActiveUser). " +
        "Run this exact write in Firebase Console → Firestore → Rules → Rules Playground to see the failing line.",
    );
  }
  console.groupEnd();
}

function ViewTodoContent() {
  const { user, role, loading } = useAuth();
  const email = String(user?.email || "").trim().toLowerCase();
  const [events, setEvents] = useState([]);
  const [tasksByEvent, setTasksByEvent] = useState({});
  const [requests, setRequests] = useState({});
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [toast, setToast] = useState("");
  const [modalItem, setModalItem] = useState(null);
  const [filter, setFilter] = useState("all");
  const toastTimer = useRef(null);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    if (!db || loading || !user || !["member", "admin", "superadmin"].includes(role)) return undefined;
    return onSnapshot(collection(db, "events"), (snapshot) => {
      setEvents(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, (snapshotError) => setError(`Could not load events (${snapshotError.code || "unknown"}).`));
  }, [loading, role, user]);

  useEffect(() => {
    if (!db || loading || !user || events.length === 0) {
      setTasksByEvent({});
      return undefined;
    }
    const unsubscribers = events.map((event) => {
      const tasksQuery = role === "member"
        ? query(collection(db, "events", event.id, "tasks"), where("assignees", "array-contains", email))
        : query(collection(db, "events", event.id, "tasks"));
      return onSnapshot(tasksQuery, (snapshot) => {
        setTasksByEvent((current) => ({
          ...current,
          [event.id]: snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .filter((task) => role !== "admin" || task.assignees?.includes(email)),
        }));
      }, (snapshotError) => setError(`Could not load tasks (${snapshotError.code || "unknown"}).`));
    });
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [email, events, loading, role, user]);

  useEffect(() => {
    if (!db || loading || !user || !email) return undefined;

    const myRequestsQuery = query(collection(db, "completionRequests"), where("requestedBy", "==", email));
    const onError = (snapshotError) => setError(`Could not load requests (${snapshotError.code || "unknown"}).`);

    if (role === "member") {
      return onSnapshot(myRequestsQuery, (snapshot) => {
        setRequests(Object.fromEntries(snapshot.docs.map((item) => [item.id, { id: item.id, ...item.data() }])));
      }, onError);
    }
    if (role !== "admin") return undefined;

    // Admin: merge (a) requests the admin submitted themselves with
    // (b) requests for events the admin owns. Each source keeps its own
    // snapshot so deleted docs disappear instead of lingering.
    const sources = new Map();
    const publish = () => {
      const merged = {};
      sources.forEach((docs) => Object.assign(merged, docs));
      setRequests(merged);
    };
    const listen = (sourceKey, sourceQuery) => onSnapshot(sourceQuery, (snapshot) => {
      sources.set(sourceKey, Object.fromEntries(snapshot.docs.map((item) => [item.id, { id: item.id, ...item.data() }])));
      publish();
    }, onError);

    const unsubscribers = [listen("mine", myRequestsQuery)];
    events
      .filter((event) => event.createdBy === email)
      .forEach((event) => {
        unsubscribers.push(listen(
          `event:${event.id}`,
          query(collection(db, "completionRequests"), where("eventId", "==", event.id)),
        ));
      });

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [email, events, loading, role, user]);

  const visibleEvents = useMemo(() => events
    .map((event) => ({ ...event, tasks: tasksByEvent[event.id] || [] }))
    .filter((event) => event.tasks.length > 0)
    .sort((first, second) => String(first.date || "").localeCompare(String(second.date || ""))), [events, tasksByEvent]);

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  }

  function getRequest(event, task, subtaskId = "todo") {
    return requests[completionRequestId(event.id, task.id, email, subtaskId)];
  }

  function taskKind(event, task) {
    return categorize(requestStatusLabel(getRequest(event, task), task, "todo"));
  }

  async function submitRequest(note) {
    const { event, task, subtaskId } = modalItem;
    const key = requestKey(event.id, task.id, subtaskId);
    setSavingKey(key);
    setError("");

    try {
      // Pre-check: if a request is already pending/approved, don't write again.
      // A failed read (e.g. doc doesn't exist yet) is ignored and we continue.
      const existingRead = await safeRead(completionRequestRef(event.id, task.id, email, subtaskId));
      const existingStatus = existingRead.data?.status;
      if (existingRead.exists && (existingStatus === "pending" || existingStatus === "approved")) {
        setModalItem(null);
        showToast(existingStatus === "pending" ? "Already submitted: awaiting approval" : "Already approved");
        return;
      }

      // Built outside the setDoc call so the exact same object can be logged on failure
      const payload = {
        eventId: event.id,
        todoId: task.id,
        ...(subtaskId !== "todo" ? { subtaskId } : {}),
        requestedBy: email,
        requestedByRole: role,
        note: note.trim() || null,
        reviewedBy: null,
        status: "pending",
        rejectionReason: null,
        createdAt: serverTimestamp(),
        reviewedAt: null,
      };

      try {
        await setDoc(completionRequestRef(event.id, task.id, email, subtaskId), payload, { merge: true });
        setModalItem(null);
        showToast("Completion request submitted");
      } catch (requestError) {
        console.error("Completion request failed:", requestError?.code, requestError?.message);
        setError(`Could not submit the request (${requestError.code || "unknown"}). Check the console for details.`);
        if (requestError?.code === "permission-denied") {
          // Don't let the debug helper itself break the UI
          debugCompletionFailure({ db, email, role, event, task, subtaskId, payload, requestError })
            .catch((debugError) => console.warn("Debug helper failed:", debugError));
        }
      }
    } finally {
      setSavingKey("");
    }
  }

  async function completeDirectly(event, task, subtaskId = "todo") {
    const nextSubtasks = (task.subtasks || []).map((subtask) => ({ ...subtask, done: subtask.id === subtaskId ? true : Boolean(subtask.done) }));
    await updateDoc(doc(db, "events", event.id, "tasks", task.id), { subtasks: nextSubtasks, done: nextSubtasks.length ? nextSubtasks.every((subtask) => subtask.done) : true });
    showToast("Task completed");
  }

  function openCompletion(event, task, subtaskId = "todo", name = task.title) {
    const request = getRequest(event, task, subtaskId);
    const status = requestStatusLabel(request, task, subtaskId);
    if (status === "Awaiting approval" || status === "Completed") return;
    if (role === "superadmin") {
      completeDirectly(event, task, subtaskId).catch((completionError) => setError(`Could not complete the task (${completionError.code || "unknown"}).`));
      return;
    }
    setModalItem({ event, task, subtaskId, name });
  }

  // Counts for the progress panel and the filter tabs
  const counts = { todo: 0, awaiting: 0, rejected: 0, done: 0 };
  visibleEvents.forEach((event) => event.tasks.forEach((task) => { counts[taskKind(event, task)] += 1; }));
  const total = counts.todo + counts.awaiting + counts.rejected + counts.done;
  const percent = total === 0 ? 0 : Math.round((counts.done / total) * 100);
  const tabCounts = { all: total, todo: counts.todo + counts.rejected, awaiting: counts.awaiting, done: counts.done };

  const filteredEvents = visibleEvents
    .map((event) => ({ ...event, tasks: event.tasks.filter((task) => matchesFilter(filter, taskKind(event, task))) }))
    .filter((event) => event.tasks.length > 0);

  const overviewTiles = [
    { label: "To do", value: counts.todo, dot: "bg-white/40" },
    { label: "Awaiting", value: counts.awaiting, dot: "bg-sky-300" },
    { label: "Rejected", value: counts.rejected, dot: "bg-red-300" },
    { label: "Done", value: counts.done, dot: "bg-emerald-300" },
  ];

  return (
    // The shell already renders <main>, so this is a div to avoid nested <main> tags
    <div className="w-full text-white">
      <p className="text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80">Todo</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">View todo</h1>
      <p className="mt-1.5 text-sm text-white/50">
        {total} {total === 1 ? "task" : "tasks"} across {visibleEvents.length} {visibleEvents.length === 1 ? "event" : "events"}
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100 backdrop-blur-md"
        >
          {error}
        </p>
      ) : null}

      {visibleEvents.length === 0 ? (
        <div className={`${GLASS} mt-6 flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center`}>
          <span className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/40">
            <Inbox className="size-5" />
          </span>
          <p className="text-sm text-white/50">No todos assigned.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4 sm:space-y-5">
          {/* Summary strip: progress on the left, counts on the right */}
          <section className={`${GLASS} p-5 sm:p-6`}>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-10">
              <div>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[.16em] text-white/50">Progress</p>
                    <p className="mt-1 text-4xl font-bold tracking-tight">{percent}%</p>
                  </div>
                  <p className="pb-1 text-sm text-white/60">{counts.done}/{total} done</p>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-400 to-sky-300 transition-all duration-700"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[28rem]">
                {overviewTiles.map((tile) => (
                  <div key={tile.label} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                    <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.12em] text-white/50">
                      <span className={`size-1.5 rounded-full ${tile.dot}`} />
                      {tile.label}
                    </div>
                    <p className="mt-1 text-xl font-semibold">{tile.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Filter tabs */}
          <div
            role="tablist"
            aria-label="Filter tasks"
            className="flex w-full items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-md sm:w-fit"
          >
            {FILTERS.map((item) => {
              const selected = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setFilter(item.id)}
                  className={`!min-h-0 flex flex-1 items-center justify-center gap-2 whitespace-nowrap !rounded-full px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:flex-none ${
                    selected ? "bg-white/15 text-white" : "text-white/55 hover:text-white"
                  }`}
                >
                  {item.label}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${selected ? "bg-white/20 text-white" : "bg-white/10 text-white/60"}`}>
                    {tabCounts[item.id]}
                  </span>
                </button>
              );
            })}
          </div>

          {filteredEvents.length === 0 ? (
            <div className={`${GLASS} flex min-h-40 flex-col items-center justify-center gap-3 p-8 text-center`}>
              <span className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/40">
                <Inbox className="size-5" />
              </span>
              <p className="text-sm text-white/50">Nothing in this view.</p>
            </div>
          ) : null}

          {/* Events: full width, same edges as the summary strip */}
          {filteredEvents.map((event) => {
            const doneInEvent = event.tasks.filter((task) => taskKind(event, task) === "done").length;
            return (
              <section key={event.id} className={`${GLASS} overflow-hidden`}>
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-violet-500/15 text-violet-200">
                      <CalendarDays className="size-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold sm:text-lg">{event.name}</h2>
                      <p className="text-xs text-white/50">{displayDate(event.date)}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                    {doneInEvent}/{event.tasks.length} done
                  </span>
                </header>

                <div className="divide-y divide-white/10">
                  {event.tasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      event={event}
                      task={task}
                      getRequest={getRequest}
                      savingKey={savingKey}
                      onComplete={openCompletion}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {toast ? (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-neutral-950/85 px-5 py-3 text-sm text-white shadow-lg shadow-black/40 backdrop-blur-xl md:bottom-6"
        >
          {toast}
        </div>
      ) : null}
      {modalItem ? (
        <CompletionModal
          item={modalItem}
          saving={savingKey === requestKey(modalItem.event.id, modalItem.task.id, modalItem.subtaskId)}
          onCancel={() => !savingKey && setModalItem(null)}
          onSubmit={submitRequest}
        />
      ) : null}
    </div>
  );
}

function TaskItem({ event, task, getRequest, savingKey, onComplete }) {
  const [open, setOpen] = useState(false);
  const subtasks = task.subtasks || [];
  const subDone = subtasks.filter(
    (subtask) => requestStatusLabel(getRequest(event, task, subtask.id), task, subtask.id) === "Completed",
  ).length;

  return (
    <article>
      <TodoRow
        task={task}
        request={getRequest(event, task)}
        saving={savingKey === requestKey(event.id, task.id)}
        onComplete={() => onComplete(event, task)}
        due={task.deadline}
        subtaskToggle={
          subtasks.length ? (
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 rounded-full text-xs text-white/60 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <ListChecks className="size-3" />
              {subDone}/{subtasks.length} subtasks
              <ChevronDown className={`size-3 transition ${open ? "rotate-180" : ""}`} />
            </button>
          ) : null
        }
      />

      {open && subtasks.length ? (
        <ul className="divide-y divide-white/5 bg-black/15">
          {subtasks.map((subtask) => (
            <li key={subtask.id}>
              <TodoRow
                task={task}
                subtask={subtask}
                request={getRequest(event, task, subtask.id)}
                saving={savingKey === requestKey(event.id, task.id, subtask.id)}
                onComplete={() => onComplete(event, task, subtask.id, subtask.title)}
                nested
              />
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function TodoRow({ task, subtask, request, saving, onComplete, due, subtaskToggle, nested = false }) {
  const status = requestStatusLabel(request, task, subtask?.id || "todo");
  const kind = categorize(status);
  const awaiting = kind === "awaiting";

  return (
    <div className={`flex items-center gap-3 py-3.5 pr-4 transition hover:bg-white/[0.04] sm:pr-5 ${nested ? "pl-10 sm:pl-12" : "pl-4 sm:pl-5"}`}>
      <StatusIcon kind={kind} />

      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${kind === "done" ? "text-white/50 line-through" : "text-white"}`}>
          {subtask?.title || task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50">
          {due ? (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3" />
              Due {displayDate(due)}
            </span>
          ) : null}
          {subtaskToggle}
          {kind === "rejected" ? (
            <span className="text-red-300">
              Rejected{request?.rejectionReason ? `: ${request.rejectionReason}` : ""}
            </span>
          ) : null}
        </div>
      </div>

      {kind === "done" ? (
        <span className="shrink-0 text-right text-xs font-medium text-emerald-300">
          Completed
          {request?.reviewedBy ? (
            <span className="hidden text-emerald-200/70 md:block">
              Approved by {request.reviewedByName || request.reviewedBy}
            </span>
          ) : null}
        </span>
      ) : awaiting ? (
        <span className="shrink-0 rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1.5 text-[11px] uppercase tracking-[.12em] text-sky-200">
          Awaiting
        </span>
      ) : (
        <button type="button" onClick={onComplete} disabled={saving} className={violetAction}>
          {kind === "rejected" ? <RotateCcw className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
          {saving ? "Saving…" : kind === "rejected" ? "Request again" : "Complete"}
        </button>
      )}
    </div>
  );
}

function CompletionModal({ item, saving, onCancel, onSubmit }) {
  const [note, setNote] = useState("");
  const dialogRef = useRef(null);
  const firstControlRef = useRef(null);

  useEffect(() => {
    firstControlRef.current?.focus();
    function handleKeyDown(event) {
      if (event.key === "Escape") onCancel();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = [...dialogRef.current.querySelectorAll("button, textarea")].filter((control) => !control.disabled);
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
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
        aria-labelledby="submit-request-title"
        className="w-full max-w-md rounded-t-3xl border border-white/10 bg-neutral-950/85 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white shadow-2xl shadow-black/60 backdrop-blur-2xl sm:rounded-2xl"
      >
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80">Request completion</p>
        <h2 id="submit-request-title" className="mt-3 text-2xl font-semibold">Submit completion request?</h2>
        <p className="mt-3 text-sm text-white/80">
          <strong className="font-semibold text-white">{item.name}</strong> for{" "}
          <strong className="font-semibold text-white">{item.event.name}</strong>.
        </p>
        <p className="mt-2 text-sm text-white/60">
          This will be sent to {item.event.createdByName || item.event.createdBy || "the event creator"} and the superadmin for approval.
        </p>

        <label htmlFor="completion-note" className="mt-5 block text-sm font-medium text-white/80">Note (optional)</label>
        <textarea
          ref={firstControlRef}
          id="completion-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={4}
          className="mt-2 w-full resize-none rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-400/30 [color-scheme:dark]"
        />

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="!min-h-0 !rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(note)}
            disabled={saving}
            className="!min-h-0 !rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Submitting…" : "Submit request"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function MemberTodoView({ allowedRoles = ["member"] }) {
  return (
    <RoleGuard allow={allowedRoles}>
      <ViewTodoContent />
    </RoleGuard>
  );
}