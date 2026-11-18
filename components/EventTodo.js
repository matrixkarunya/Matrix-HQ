"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  ListChecks,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import TaskModal from "@/components/TaskModal";
import TimeRangesModal from "@/components/TimeRangesModal";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  addSubtask,
  eventProgress,
  normalizeTask,
  taskIsDone,
  toggleSubtask,
  toggleTask,
} from "@/lib/tasks";
import useUsers from "@/lib/useUsers";

const PAGE_SIZE = 10;

const GLASS =
  "rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20 backdrop-blur-xl";

const ghostButton =
  "!min-h-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap !rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-50";

const dangerGhostButton =
  "!min-h-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap !rounded-full border border-red-300/25 bg-red-400/10 px-3.5 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300/60";

const primaryButton =
  "!min-h-0 inline-flex items-center justify-center gap-2 whitespace-nowrap !rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60";

// Round "+" on mobile, full "Add task" button from sm up
const addButton =
  "!min-h-0 inline-flex size-10 shrink-0 items-center justify-center whitespace-nowrap !rounded-full bg-white text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 sm:size-auto sm:gap-2 sm:px-4 sm:py-2";

const iconButton =
  "!min-h-0 flex size-8 shrink-0 items-center justify-center !rounded-full border border-white/15 bg-white/5 text-white/75 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50";

const iconButtonDanger =
  "!min-h-0 flex size-8 shrink-0 items-center justify-center !rounded-full border border-red-300/25 bg-red-400/10 text-red-200 transition hover:bg-red-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300/60";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "done", label: "Done" },
];

function localToday() {
  return new Date().toLocaleDateString("en-CA");
}

function formatDateForDisplay(dateString) {
  if (typeof dateString !== "string" || !dateString) return "—";
  const [year, month, day] = dateString.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function BackLink({ href }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-white/70 backdrop-blur-md transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
    >
      <ArrowLeft className="size-3.5 transition group-hover:-translate-x-0.5" aria-hidden="true" />
      Back to events
    </Link>
  );
}

function SubtaskAdder({ onAdd }) {
  const [value, setValue] = useState("");

  function submit() {
    if (!value.trim()) return;
    onAdd(value);
    setValue("");
  }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
        placeholder="Add subtask"
        aria-label="Add subtask"
        className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-400/30 [color-scheme:dark]"
      />
      <button type="button" onClick={submit} className={ghostButton}>
        <Plus className="size-3.5" aria-hidden="true" />
        Add
      </button>
    </div>
  );
}

export default function EventTodo({ readOnly: forcedReadOnly = false }) {
  const params = useParams();
  const { user, role, loading } = useAuth();
  const { users, error: usersError } = useUsers();
  const eventId = typeof params?.eventId === "string" ? params.eventId : "";
  const [event, setEvent] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalMode, setTaskModalMode] = useState("add");
  const [editingTask, setEditingTask] = useState(null);
  const [taskFormError, setTaskFormError] = useState("");
  const [taskSaving, setTaskSaving] = useState(false);
  const [deleteTaskId, setDeleteTaskId] = useState("");
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [hoursTask, setHoursTask] = useState(null);
  const [hoursSaving, setHoursSaving] = useState(false);
  const [listenerError, setListenerError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openIds, setOpenIds] = useState({});
  const toastTimer = useRef(null);
  const listTopRef = useRef(null);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    if (!db || !eventId || loading || !user || !["superadmin", "admin", "member", "guest"].includes(role)) {
      setEvent(null);
      return undefined;
    }

    setListenerError("");
    const eventRef = doc(db, "events", eventId);
    const unsubscribeEvent = onSnapshot(eventRef, (snapshot) => {
      setEvent(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
    }, (error) => {
      console.error("Event listener:", error.code, error.message);
      setEvent(null);
      setListenerError(`Could not load the event (${error.code || "unknown"}).`);
    });

    return () => unsubscribeEvent();
  }, [eventId, loading, role, user]);

  useEffect(() => {
    if (!db || !eventId || loading || !user || !["superadmin", "admin", "member", "guest"].includes(role)) {
      setTasks([]);
      return undefined;
    }

    setListenerError("");
    const tasksQuery = query(collection(db, "events", eventId, "tasks"), orderBy("deadline"));
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      setTasks(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
    }, (error) => {
      console.error("Tasks listener:", error.code, error.message);
      setTasks([]);
      setListenerError(`Could not load tasks (${error.code || "unknown"}).`);
    });

    return () => unsubscribeTasks();
  }, [eventId, loading, role, user]);

  // Back to page 1 whenever the view changes
  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  const progress = useMemo(() => eventProgress(tasks), [tasks]);
  const readOnly = forcedReadOnly || Boolean(event?.completed) || !["superadmin", "admin"].includes(role);
  const backHref = role === "superadmin" ? "/superadmin/events" : role === "member" ? "/member/events" : "/admin/events";

  function nameFor(email) {
    const person = users.find((entry) => String(entry.email || "").toLowerCase() === String(email || "").toLowerCase());
    return person?.fullName?.trim() || email;
  }

  // Search first, then split, so the filter counts reflect the search
  const searched = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tasks;
    return tasks.filter((task) => {
      const haystack = [
        task.title,
        task.deadline,
        ...(task.assignees || []),
        ...(task.assignees || []).map((email) => {
          const person = users.find((entry) => String(entry.email || "").toLowerCase() === String(email || "").toLowerCase());
          return person?.fullName || "";
        }),
        ...(task.subtasks || []).map((subtask) => subtask.title),
      ];
      return haystack.some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [search, tasks, users]);

  const counts = useMemo(() => {
    const done = searched.filter((task) => taskIsDone(normalizeTask(task))).length;
    return { all: searched.length, open: searched.length - done, done };
  }, [searched]);

  const visible = useMemo(
    () =>
      searched.filter((task) => {
        if (filter === "all") return true;
        const isDone = taskIsDone(normalizeTask(task));
        return filter === "done" ? isDone : !isDone;
      }),
    [filter, searched],
  );

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedTasks = visible.slice(pageStart, pageStart + PAGE_SIZE);
  const rangeEnd = Math.min(pageStart + PAGE_SIZE, visible.length);

  function goToPage(next) {
    setPage(next);
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleOpen(taskId) {
    setOpenIds((current) => ({ ...current, [taskId]: !current[taskId] }));
  }

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  }

  function openAddTaskModal() {
    setTaskModalMode("add");
    setEditingTask(null);
    setTaskFormError("");
    setTaskModalOpen(true);
  }

  function openEditTaskModal(task) {
    if (readOnly) return;
    setTaskModalMode("edit");
    setEditingTask(task);
    setTaskFormError("");
    setTaskModalOpen(true);
  }

  function closeTaskModal() {
    if (taskSaving) return;
    setTaskModalOpen(false);
    setEditingTask(null);
    setTaskFormError("");
  }

  async function handleSubmitTask(payload) {
    if (payload?.validationError) {
      setTaskFormError(payload.validationError);
      return;
    }

    if (!eventId) return;

    setTaskSaving(true);
    setTaskFormError("");

    try {
      const taskPayload = {
        title: String(payload.title || "").trim(),
        deadline: payload.deadline || "",
        assignees: Array.isArray(payload.assignees) ? payload.assignees : [],
        subtasks: Array.isArray(payload.subtasks) ? payload.subtasks : [],
        done: false,
      };

      if (taskModalMode === "edit" && editingTask) {
        const isUnchanged =
          String(editingTask.title || "").trim() === taskPayload.title &&
          String(editingTask.deadline || "") === String(taskPayload.deadline || "") &&
          JSON.stringify([...(editingTask.assignees || [])].sort()) === JSON.stringify([...(taskPayload.assignees || [])].sort()) &&
          JSON.stringify(editingTask.subtasks || []) === JSON.stringify(taskPayload.subtasks || []);

        if (isUnchanged) {
          closeTaskModal();
          return;
        }

        await updateDoc(doc(db, "events", eventId, "tasks", editingTask.id), taskPayload);
        showToast("Task updated");
      } else {
        await addDoc(collection(db, "events", eventId, "tasks"), {
          ...taskPayload,
          createdBy: (user?.email || "").trim().toLowerCase(),
          createdAt: serverTimestamp(),
        });
        showToast("Task added");
      }

      closeTaskModal();
    } catch (error) {
      console.error("Task save error:", error?.code, error?.message);
      setTaskFormError(taskModalMode === "edit" ? `Could not update the task (${error?.code || "unknown"}).` : `Could not add the task (${error?.code || "unknown"}).`);
    } finally {
      setTaskSaving(false);
    }
  }

  async function handleDeleteTask() {
    if (!deleteTaskId || !eventId || readOnly) return;

    setDeleteSaving(true);

    try {
      await deleteDoc(doc(db, "events", eventId, "tasks", deleteTaskId));
      setDeleteTaskId("");
      showToast("Task deleted");
    } catch (error) {
      console.error("Delete task error:", error?.code, error?.message);
      showToast(`Could not delete the task (${error?.code || "unknown"})`);
    } finally {
      setDeleteSaving(false);
    }
  }

  async function handleToggleTask(task) {
    if (readOnly || !task?.id) return;

    try {
      const nextTask = toggleTask(task);
      if (nextTask.done && task.assignees?.length > 0) {
        setHoursTask({ task, nextTask });
        return;
      }
      const taskUpdate = {
        subtasks: Array.isArray(nextTask.subtasks) ? nextTask.subtasks.map((subtask) => ({
          id: String(subtask.id ?? "").trim() || crypto.randomUUID(),
          title: String(subtask.title ?? "").trim(),
          done: Boolean(subtask.done),
        })) : [],
        done: Boolean(nextTask.done),
      };
      await updateDoc(doc(db, "events", eventId, "tasks", task.id), taskUpdate);
    } catch (error) {
      console.error("Toggle task error:", error?.code, error?.message);
      showToast(`Couldn't update the task (${error?.code || "unknown"})`);
    }
  }

  async function handleToggleSubtask(task, subtaskId) {
    if (readOnly || !task?.id) return;

    try {
      const nextTask = toggleSubtask(task, subtaskId);
      if (nextTask.done && task.assignees?.length > 0) {
        setHoursTask({ task, nextTask });
        return;
      }
      const taskUpdate = {
        subtasks: Array.isArray(nextTask.subtasks) ? nextTask.subtasks.map((subtask) => ({
          id: String(subtask.id ?? "").trim() || crypto.randomUUID(),
          title: String(subtask.title ?? "").trim(),
          done: Boolean(subtask.done),
        })) : [],
        done: Boolean(nextTask.done),
      };
      await updateDoc(doc(db, "events", eventId, "tasks", task.id), taskUpdate);
    } catch (error) {
      console.error("Toggle subtask error:", error?.code, error?.message);
      showToast(`Couldn't update the subtask (${error?.code || "unknown"})`);
    }
  }

  async function handleStaffHoursConfirm(timeEntries, selectedAssignees, isWorkingDay = true) {
    if (!hoursTask || !eventId || !user?.email) return;
    setHoursSaving(true);
    try {
      const batch = writeBatch(db);
      const task = hoursTask.task;
      const taskUpdate = {
        subtasks: Array.isArray(hoursTask.nextTask.subtasks)
          ? hoursTask.nextTask.subtasks.map((subtask) => ({
              id: String(subtask.id ?? "").trim() || crypto.randomUUID(),
              title: String(subtask.title ?? "").trim(),
              done: true,
            }))
          : [],
        done: true,
      };
      batch.update(doc(db, "events", eventId, "tasks", task.id), taskUpdate);
      selectedAssignees.forEach((memberEmail) => {
        const normalizedEmail = String(memberEmail || "").trim().toLowerCase();
        const person = users.find((item) => String(item.email || "").trim().toLowerCase() === normalizedEmail);
        batch.set(doc(collection(db, "workLogs")), {
          eventId: String(eventId),
          eventName: String(event.name || eventId),
          taskId: String(task.id),
          taskTitle: String(task.title || ""),
          memberEmail: normalizedEmail,
          memberName: String(person?.fullName || person?.name || normalizedEmail),
          timeEntries: timeEntries.map(({ startTime, endTime }) => ({ startTime: String(startTime || ""), endTime: String(endTime || "") })),
          isWorkingDay: isWorkingDay !== false,
          source: "staff-tick",
          loggedBy: String(user.email).trim().toLowerCase(),
          loggedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      setHoursTask(null);
      showToast("Task completed and hours logged");
    } catch (error) {
      console.error("Staff task completion error:", error?.code, error?.message);
      showToast(`Could not complete the task (${error?.code || "unknown"})`);
    } finally {
      setHoursSaving(false);
    }
  }

  async function handleAddSubtask(task, value) {
    const trimmedValue = String(value || "").trim();
    if (!trimmedValue || readOnly) return;

    try {
      const nextTask = addSubtask(task, trimmedValue);
      const taskUpdate = {
        subtasks: Array.isArray(nextTask.subtasks) ? nextTask.subtasks.map((subtask) => ({
          id: String(subtask.id ?? "").trim() || crypto.randomUUID(),
          title: String(subtask.title ?? "").trim(),
          done: Boolean(subtask.done),
        })) : [],
        done: Boolean(nextTask.done),
      };
      await updateDoc(doc(db, "events", eventId, "tasks", task.id), taskUpdate);
      showToast("Subtask added");
    } catch (error) {
      console.error("Add subtask error:", error?.code, error?.message);
      showToast(`Couldn't add the subtask (${error?.code || "unknown"})`);
    }
  }

  async function handleEventCompletion() {
    if (!eventId || !db || readOnly) return;

    try {
      const eventPatch = { completed: true, completedAt: serverTimestamp() };
      await updateDoc(doc(db, "events", eventId), eventPatch);

      for (const task of tasks) {
        const safeSubtasks = Array.isArray(task.subtasks)
          ? task.subtasks.map((subtask) => ({
              id: String(subtask?.id ?? "").trim() || crypto.randomUUID(),
              title: String(subtask?.title ?? "").trim(),
              done: Boolean(subtask?.done),
            }))
          : [];
        await updateDoc(doc(db, "events", eventId, "tasks", task.id), { subtasks: safeSubtasks, done: true });
      }

      showToast("Event marked complete");
    } catch (error) {
      console.error("Complete event error:", error?.code, error?.message);
      showToast(`Could not mark the event complete (${error?.code || "unknown"})`);
    }
  }

  async function handleEventReopen() {
    if (!eventId || !db || !readOnly) return;

    try {
      const eventPatch = { completed: false, completedAt: null };
      await updateDoc(doc(db, "events", eventId), eventPatch);

      for (const task of tasks) {
        const safeSubtasks = Array.isArray(task.subtasks)
          ? task.subtasks.map((subtask) => ({
              id: String(subtask?.id ?? "").trim() || crypto.randomUUID(),
              title: String(subtask?.title ?? "").trim(),
              done: Boolean(subtask?.done),
            }))
          : [];
        await updateDoc(doc(db, "events", eventId, "tasks", task.id), { subtasks: safeSubtasks, done: false });
      }

      showToast("Event reopened");
    } catch (error) {
      console.error("Reopen event error:", error?.code, error?.message);
      showToast(`Could not reopen the event (${error?.code || "unknown"})`);
    }
  }

  if (!eventId) {
    return <p className="p-6 text-sm text-white/60">Loading…</p>;
  }

  const errorBanner =
    listenerError || usersError ? (
      <p
        role="alert"
        className="rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100 backdrop-blur-md"
      >
        {listenerError || usersError}
      </p>
    ) : null;

  if (!event) {
    return (
      <div className="w-full space-y-4 text-white">
        <BackLink href={backHref} />
        {errorBanner}
        {!listenerError && !usersError ? (
          <div className={`${GLASS} flex min-h-48 items-center justify-center p-8 text-sm text-white/60`}>
            This event could not be found.
          </div>
        ) : null}
      </div>
    );
  }

  const today = localToday();

  // One button, rendered in two spots: top-right on desktop, under the progress bar on mobile
  const completionButton =
    readOnly && !forcedReadOnly ? (
      <button type="button" onClick={handleEventReopen} className={`${primaryButton} w-full sm:w-auto`}>
        <RotateCcw className="size-4" aria-hidden="true" />
        Reopen event
      </button>
    ) : !readOnly ? (
      <button type="button" onClick={handleEventCompletion} className={`${primaryButton} w-full sm:w-auto`}>
        <CheckCircle2 className="size-4" aria-hidden="true" />
        Mark event complete
      </button>
    ) : null;

  return (
    // The shell already renders <main>, so this is a div to avoid nested <main> tags
    <div className="w-full space-y-4 text-white">
      <BackLink href={backHref} />

      {errorBanner}

      {/* Header + progress in one card */}
      <section className={`${GLASS} p-4 sm:p-5`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80">Event todo</p>
            <h1 className="mt-1.5 break-words text-xl font-bold tracking-tight sm:text-3xl">{event.name}</h1>
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-white/60">
              <CalendarDays className="size-4 text-violet-300" aria-hidden="true" />
              {formatDateForDisplay(event.date)}
            </p>
          </div>

          <div className="hidden shrink-0 sm:block">{completionButton}</div>
        </div>

        <div className="mt-4 flex items-center gap-3 sm:mt-5 sm:gap-4">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-400 to-sky-300 transition-all duration-700"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="shrink-0 text-sm text-white/70">
            <span className="font-semibold text-white">{progress.percent}%</span>
            <span className="text-white/50">
              {" "}
              · {progress.completed}/{progress.total}
              <span className="hidden sm:inline"> done</span>
            </span>
          </p>
        </div>

        {completionButton ? <div className="mt-4 sm:hidden">{completionButton}</div> : null}

        {readOnly && !forcedReadOnly ? (
          <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white/65">
            This event is complete and read-only until it is reopened.
          </p>
        ) : null}
      </section>

      {/* Toolbar.
          Mobile: [ search ][ + ] on row 1, filters full width on row 2.
          Desktop: filters left, search centered, add right. */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div className="relative order-1 min-w-0 sm:order-2 sm:w-72 sm:justify-self-center">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/40" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search task, person or subtask"
            aria-label="Search tasks"
            className="w-full rounded-full border border-white/15 bg-white/5 py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-white/30 focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-400/30 [color-scheme:dark] [&::-webkit-search-cancel-button]:hidden"
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

        {!readOnly ? (
          <button
            type="button"
            onClick={openAddTaskModal}
            aria-label="Add task"
            className={`${addButton} order-2 sm:order-3 sm:justify-self-end`}
          >
            <Plus className="size-5 sm:size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Add task</span>
          </button>
        ) : null}

        <div
          role="tablist"
          aria-label="Filter tasks"
          className="order-3 col-span-2 flex w-full items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-md sm:order-1 sm:col-span-1 sm:w-fit sm:justify-self-start"
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
                className={`!min-h-0 flex flex-1 items-center justify-center gap-2 !rounded-full px-3.5 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:flex-none ${
                  selected ? "bg-white/15 text-white" : "text-white/55 hover:text-white"
                }`}
              >
                {item.label}
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${selected ? "bg-white/20 text-white" : "bg-white/10 text-white/60"}`}>
                  {counts[item.id]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div ref={listTopRef} className="scroll-mt-24" />

      {tasks.length === 0 ? (
        <div className={`${GLASS} flex min-h-40 flex-col items-center justify-center gap-3 p-8 text-center`}>
          <span className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/40">
            <ListTodo className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm text-white/50">No tasks for this event yet.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className={`${GLASS} flex min-h-40 flex-col items-center justify-center gap-3 p-8 text-center`}>
          <span className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/40">
            <ListTodo className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm text-white/50">
            {search.trim() ? `No tasks match "${search.trim()}".` : "Nothing in this view."}
          </p>
        </div>
      ) : (
        <ul className={`${GLASS} divide-y divide-white/10 overflow-hidden`}>
          {pagedTasks.map((task) => {
            const normalized = normalizeTask(task);
            const taskDone = taskIsDone(normalized);
            const subtasks = normalized.subtasks || [];
            const subDone = subtasks.filter((subtask) => subtask.done).length;
            const assignees = normalized.assignees || [];
            const overdue = !taskDone && normalized.deadline && normalized.deadline < today;
            const open = Boolean(openIds[task.id]);
            const canExpand = subtasks.length > 0 || !readOnly;
            const chip =
              "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[11px] font-medium";

            return (
              <li key={task.id}>
                <div className="flex items-start gap-3 px-4 py-3.5 transition hover:bg-white/[0.04] sm:px-5">
                  <input
                    type="checkbox"
                    checked={taskDone}
                    onChange={() => handleToggleTask(task)}
                    disabled={readOnly}
                    aria-label={`Mark ${normalized.title} as done`}
                    className="mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-violet-400 disabled:cursor-not-allowed"
                  />

                  <div className="min-w-0 flex-1">
                    {/* Title */}
                    <p
                      className={`break-words text-[15px] font-semibold leading-snug ${
                        taskDone ? "text-white/45 line-through" : "text-white"
                      }`}
                    >
                      {normalized.title}
                    </p>

                    {/* Meta chips: all the same height and shape */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <span
                        className={`${chip} ${
                          overdue
                            ? "border-amber-300/25 bg-amber-400/10 text-amber-300"
                            : "border-white/10 bg-white/5 text-white/60"
                        }`}
                      >
                        <CalendarDays className="size-3" aria-hidden="true" />
                        {formatDateForDisplay(normalized.deadline)}
                        {overdue ? " · Overdue" : ""}
                      </span>

                      {/* Mobile shows one assignee, desktop shows two */}
                      {assignees.slice(0, 2).map((email, index) => (
                        <span
                          key={`${task.id}-${email}`}
                          className={`${chip} max-w-[9rem] border-white/10 bg-white/5 text-white/75 ${
                            index > 0 ? "hidden sm:inline-flex" : ""
                          }`}
                        >
                          <span className="truncate">{nameFor(email)}</span>
                        </span>
                      ))}
                      {assignees.length > 1 ? (
                        <span
                          title={assignees.slice(1).map(nameFor).join(", ")}
                          className={`${chip} border-white/10 bg-white/5 text-white/60 sm:hidden`}
                        >
                          +{assignees.length - 1}
                        </span>
                      ) : null}
                      {assignees.length > 2 ? (
                        <span
                          title={assignees.slice(2).map(nameFor).join(", ")}
                          className={`${chip} hidden border-white/10 bg-white/5 text-white/60 sm:inline-flex`}
                        >
                          +{assignees.length - 2}
                        </span>
                      ) : null}

                      {/* Subtask chip: same size as the others */}
                      {canExpand ? (
                        <button
                          type="button"
                          onClick={() => toggleOpen(task.id)}
                          aria-expanded={open}
                          className={`!min-h-0 ${chip} transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
                            subtasks.length
                              ? open
                                ? "border-violet-300/40 bg-violet-500/20 text-white"
                                : "border-violet-300/25 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20"
                              : "border-dashed border-white/20 bg-transparent text-white/55 hover:border-white/35 hover:text-white"
                          }`}
                        >
                          {subtasks.length ? (
                            <>
                              <ListChecks className="size-3" aria-hidden="true" />
                              {subDone}/{subtasks.length}
                            </>
                          ) : (
                            <>
                              <Plus className="size-3" aria-hidden="true" />
                              Subtask
                            </>
                          )}
                          <ChevronDown
                            className={`size-3 opacity-70 transition ${open ? "rotate-180" : ""}`}
                            aria-hidden="true"
                          />
                        </button>
                      ) : null}
                    </div>

                    {/* Thin progress line when the task has subtasks */}
                    {subtasks.length > 0 ? (
                      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-400 to-sky-300 transition-all duration-500"
                          style={{ width: `${Math.round((subDone / subtasks.length) * 100)}%` }}
                        />
                      </div>
                    ) : null}
                  </div>

                  {/* Desktop: icons in the row. Mobile: they live in the expanded panel. */}
                  {!readOnly ? (
                    <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                      <button
                        type="button"
                        onClick={() => openEditTaskModal(task)}
                        aria-label={`Edit ${normalized.title}`}
                        title="Edit"
                        className={iconButton}
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTaskId(task.id)}
                        aria-label={`Delete ${normalized.title}`}
                        title="Delete"
                        className={iconButtonDanger}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ) : null}
                </div>

                {open && canExpand ? (
                  <div className="space-y-3 border-t border-white/5 bg-black/15 px-4 py-3.5 sm:px-5">
                    {subtasks.length ? (
                      <ul className="grid gap-x-8 gap-y-2 md:grid-cols-2">
                        {subtasks.map((subtask) => (
                          <li key={subtask.id}>
                            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1 transition hover:bg-white/[0.04]">
                              <input
                                type="checkbox"
                                checked={Boolean(subtask.done)}
                                onChange={() => handleToggleSubtask(task, subtask.id)}
                                disabled={readOnly}
                                className="size-4 shrink-0 cursor-pointer rounded accent-violet-400 disabled:cursor-not-allowed"
                              />
                              <span className={`text-sm ${subtask.done ? "text-white/45 line-through" : "text-white/85"}`}>
                                {subtask.title}
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-white/45">No subtasks yet.</p>
                    )}
                    {!readOnly ? <SubtaskAdder onAdd={(value) => handleAddSubtask(task, value)} /> : null}

                    {!readOnly ? (
                      <div className="flex items-center gap-2 border-t border-white/5 pt-3 sm:hidden">
                        <button type="button" onClick={() => openEditTaskModal(task)} className={ghostButton}>
                          <Pencil className="size-3.5" aria-hidden="true" />
                          Edit task
                        </button>
                        <button type="button" onClick={() => setDeleteTaskId(task.id)} className={dangerGhostButton}>
                          <Trash2 className="size-3.5" aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination: only when there is more than one page */}
      {totalPages > 1 ? (
        <nav aria-label="Tasks pagination" className="flex items-center justify-between gap-3">
          <p className="text-xs text-white/45">
            {pageStart + 1}–{rangeEnd} of {visible.length}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage <= 1}
              aria-label="Previous page"
              className={`${iconButton} disabled:cursor-not-allowed disabled:opacity-40`}
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
              className={`${iconButton} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </nav>
      ) : null}

      {taskModalOpen && !forcedReadOnly ? (
        <TaskModal
          open={taskModalOpen}
          mode={taskModalMode}
          users={users}
          initialTask={editingTask}
          onClose={closeTaskModal}
          onSubmit={handleSubmitTask}
          saving={taskSaving}
          error={taskFormError}
        />
      ) : null}

      {hoursTask ? (
        <TimeRangesModal
          open
          title="Log task hours"
          description={`Add time spent on ${hoursTask.task.title || "this task"}.`}
          assignees={hoursTask.task.assignees.map((email) => {
            const person = users.find((item) => String(item.email || "").toLowerCase() === String(email).toLowerCase());
            return { email: String(email).trim().toLowerCase(), name: person?.fullName || person?.name || email };
          })}
          selectedAssignees={hoursTask.task.assignees.map((email) => String(email).trim().toLowerCase())}
          showAssignees
          showWorkingDayToggle
          saving={hoursSaving}
          onClose={() => !hoursSaving && setHoursTask(null)}
          onConfirm={handleStaffHoursConfirm}
        />
      ) : null}

      {deleteTaskId && !forcedReadOnly ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(e) => e.target === e.currentTarget && !deleteSaving && setDeleteTaskId("")}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-task-title"
            className="w-full max-w-sm rounded-t-3xl border border-white/10 bg-neutral-950/85 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white shadow-2xl shadow-black/60 backdrop-blur-2xl sm:rounded-2xl"
          >
            <h2 id="delete-task-title" className="text-xl font-semibold">Delete task?</h2>
            <p className="mt-3 text-sm text-white/60">This permanently deletes the task. This cannot be undone.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTaskId("")}
                disabled={deleteSaving}
                className="!min-h-0 !rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTask}
                disabled={deleteSaving}
                className="!min-h-0 !rounded-full bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteSaving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </section>
        </div>
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