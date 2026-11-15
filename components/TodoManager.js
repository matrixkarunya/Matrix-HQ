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
} from "firebase/firestore";
import TaskModal from "@/components/TaskModal";
import { useAuth } from "@/context/AuthContext";
import { ROLE_HOME } from "@/lib/config";
import { db } from "@/lib/firebase";
import useUsers from "@/lib/useUsers";

function formatDateForDisplay(dateString) {
  if (typeof dateString !== "string" || !dateString) return "—";
  const [year, month, day] = dateString.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function TodoManagerContent() {
  const { user, role, loading } = useAuth();
  const { users, error: usersError } = useUsers();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [tasks, setTasks] = useState([]);
  const [toast, setToast] = useState("");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalMode, setTaskModalMode] = useState("add");
  const [editingTask, setEditingTask] = useState(null);
  const [taskFormError, setTaskFormError] = useState("");
  const [taskSaving, setTaskSaving] = useState(false);
  const [deleteTask, setDeleteTask] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [subtaskDrafts, setSubtaskDrafts] = useState({});
  const [listenerError, setListenerError] = useState("");
  const toastTimer = useRef(null);

  useEffect(() => {
    if (!db || loading || !user || !["superadmin", "admin"].includes(role)) return undefined;

    setListenerError("");
    const eventsQuery = query(collection(db, "events"), orderBy("date"));
    const unsubscribeEvents = onSnapshot(
      eventsQuery,
      (snapshot) => {
        const nextEvents = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }));
        setEvents(nextEvents);
      },
      (error) => {
        console.error("Todo events listener:", error.code, error.message);
        setEvents([]);
        setListenerError(`Could not load events (${error.code || "unknown"}).`);
      },
    );

    return () => unsubscribeEvents();
  }, [loading, role, user]);

  useEffect(() => {
    if (!db || !selectedEventId || loading || !user || !["superadmin", "admin"].includes(role)) {
      setTasks([]);
      return undefined;
    }

    const tasksQuery = query(collection(db, "events", selectedEventId, "tasks"), orderBy("deadline"));
    const unsubscribeTasks = onSnapshot(
      tasksQuery,
      (snapshot) => {
        const nextTasks = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }));
        setTasks(nextTasks);
      },
      (error) => {
        console.error("Todo tasks listener:", error.code, error.message);
        setTasks([]);
        setListenerError(`Could not load tasks (${error.code || "unknown"}).`);
      },
    );

    return () => unsubscribeTasks();
  }, [loading, role, selectedEventId, user]);

  useEffect(() => {
    if (!selectedEventId) return;
    const hasEvent = events.some((event) => event.id === selectedEventId);
    if (!hasEvent) {
      setSelectedEventId("");
    }
  }, [events, selectedEventId]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) || null,
    [events, selectedEventId],
  );

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

  function openDeleteTaskModal(task) {
    setDeleteTask(task);
    setDeleteError("");
  }

  function closeDeleteTaskModal() {
    if (deleteSaving) return;
    setDeleteTask(null);
    setDeleteError("");
  }

  async function handleSubmitTask(payload) {
    if (payload?.validationError) {
      setTaskFormError(payload.validationError);
      return;
    }

    if (!selectedEventId) return;

    setTaskSaving(true);
    setTaskFormError("");

    try {
      const taskPayload = {
        title: String(payload.title || "").trim(),
        deadline: String(payload.deadline || ""),
        assignees: Array.isArray(payload.assignees) ? payload.assignees : [],
        subtasks: Array.isArray(payload.subtasks) ? payload.subtasks : [],
        done: false,
      };

      if (taskModalMode === "edit" && editingTask) {
        const hasChanges =
          taskPayload.title !== String(editingTask.title || "").trim() ||
          taskPayload.deadline !== String(editingTask.deadline || "") ||
          JSON.stringify([...taskPayload.assignees].sort()) !== JSON.stringify([...(editingTask.assignees || [])].sort()) ||
          JSON.stringify(taskPayload.subtasks) !== JSON.stringify(editingTask.subtasks || []);

        if (!hasChanges) {
          closeTaskModal();
          return;
        }

        await updateDoc(doc(db, "events", selectedEventId, "tasks", editingTask.id), taskPayload);
        showToast("Task updated");
      } else {
        await addDoc(collection(db, "events", selectedEventId, "tasks"), {
          ...taskPayload,
          createdBy: (user?.email || "").trim().toLowerCase(),
          createdAt: serverTimestamp(),
        });
        showToast("Task added");
      }

      closeTaskModal();
    } catch (error) {
      console.error("Task save:", error);
      setTaskFormError(taskModalMode === "edit" ? `Could not update the task (${error?.code || "unknown"}).` : `Could not add the task (${error?.code || "unknown"}).`);
    } finally {
      setTaskSaving(false);
    }
  }

  async function handleDeleteTask() {
    if (!deleteTask || !selectedEventId) return;

    setDeleteSaving(true);
    setDeleteError("");

    try {
      await deleteDoc(doc(db, "events", selectedEventId, "tasks", deleteTask.id));
      closeDeleteTaskModal();
      showToast("Task deleted");
    } catch (error) {
      console.error("Delete task:", error);
      setDeleteError(`Could not delete the task (${error?.code || "unknown"}).`);
    } finally {
      setDeleteSaving(false);
    }
  }

  async function handleAddSubtask(task, value) {
    const trimmed = value.trim();
    if (!trimmed) return;

    try {
      const nextSubtasks = [
        ...(task.subtasks || []).map((subtask) => ({
          id: subtask.id || crypto.randomUUID(),
          title: String(subtask.title || "").trim(),
          done: Boolean(subtask.done),
        })),
        { id: crypto.randomUUID(), title: trimmed, done: false },
      ].slice(0, 30);

      await updateDoc(doc(db, "events", selectedEventId, "tasks", task.id), {
        subtasks: nextSubtasks,
      });

      setSubtaskDrafts((current) => ({
        ...current,
        [task.id]: "",
      }));
      showToast("Subtask added");
    } catch (error) {
      console.error("Add subtask:", error?.code, error?.message);
      showToast(`Could not add the subtask (${error?.code || "unknown"})`);
    }
  }

  const manageEventsHref = role === "superadmin" ? "/superadmin/events" : "/admin/events";

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10">
      {listenerError || usersError ? (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{listenerError || usersError}</p>
      ) : null}
      <Link
        href={ROLE_HOME[role] || "/login"}
        className="text-sm text-neutral-600 underline underline-offset-4 hover:text-black focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
      >
        Back to dashboard
      </Link>

      <h1 className="mt-8 text-3xl font-semibold tracking-tight">Todo</h1>

      {events.length === 0 ? (
        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
          <p className="text-neutral-700">No events yet. Create one in Manage events.</p>
          <Link
            href={manageEventsHref}
            className="mt-3 inline-block text-sm font-medium text-black underline underline-offset-4 hover:text-neutral-700"
          >
            Go to Manage events
          </Link>
        </div>
      ) : (
        <div className="mt-6">
          <label htmlFor="todo-event-select" className="mb-1.5 block text-sm font-medium">
            Event
          </label>
          <select
            id="todo-event-select"
            value={selectedEventId}
            onChange={(event) => setSelectedEventId(event.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-2 focus:ring-black"
          >
            <option value="" disabled>
              Select an event
            </option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name} ({formatDateForDisplay(event.date)})
              </option>
            ))}
          </select>
        </div>
      )}

      {!selectedEventId ? (
        <div className="mt-6 text-neutral-600">
          {events.length > 0 ? "Select an event to manage its tasks." : null}
        </div>
      ) : (
        <>
          <div className="mt-8 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">{selectedEvent?.name || "Event"}</h2>
            <button
              type="button"
              onClick={openAddTaskModal}
              className="rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
            >
              Add task
            </button>
          </div>

          {tasks.length === 0 ? (
            <p className="mt-6 text-neutral-600">No tasks for this event yet.</p>
          ) : (
            <div className="mt-6 space-y-4">
              {tasks.map((task) => (
                <article key={task.id} className="rounded-lg border border-neutral-200 bg-white p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-neutral-900">{task.title}</div>
                      <div className="mt-1 text-sm text-neutral-600">{formatDateForDisplay(task.deadline)}</div>

                      {task.assignees?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {task.assignees.map((email) => {
                            const match = users.find((person) => String(person.email || "").toLowerCase() === String(email || "").toLowerCase());
                            const label = match?.fullName?.trim() || email;

                            return (
                              <span
                                key={`${task.id}-${email}`}
                                className="rounded-full border border-neutral-300 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-700"
                              >
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      ) : null}

                      {Array.isArray(task.subtasks) && task.subtasks.length > 0 ? (
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                          {task.subtasks.map((subtask) => (
                            <li key={subtask.id || `${task.id}-${subtask.title}`}>{subtask.title}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => openEditTaskModal(task)}
                        className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteTaskModal(task)}
                        className="rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-neutral-200 pt-3">
                    <button
                      type="button"
                      onClick={() =>
                        setSubtaskDrafts((current) => ({
                          ...current,
                          [task.id]: current[task.id] ?? "",
                        }))
                      }
                      className="text-sm font-medium text-neutral-700 hover:text-black focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
                    >
                      + Add subtask
                    </button>

                    {subtaskDrafts[task.id] !== undefined ? (
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          value={subtaskDrafts[task.id] || ""}
                          onChange={(event) =>
                            setSubtaskDrafts((current) => ({
                              ...current,
                              [task.id]: event.target.value,
                            }))
                          }
                          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-black focus:ring-2 focus:ring-black"
                          placeholder="Add subtask"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddSubtask(task, subtaskDrafts[task.id] || "")}
                          className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSubtaskDrafts((current) => ({
                              ...current,
                              [task.id]: undefined,
                            }))
                          }
                          className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {taskModalOpen ? (
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

      {deleteTask ? (
        <div className="fixed inset-0 z-10 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-task-title"
            className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
          >
            <h2 id="delete-task-title" className="text-xl font-semibold">
              Delete task?
            </h2>
            <p className="mt-4 text-sm text-neutral-700">
              {Array.isArray(deleteTask.subtasks) && deleteTask.subtasks.length > 0
                ? `This permanently deletes "${deleteTask.title}" and all its subtasks. This cannot be undone.`
                : `This permanently deletes "${deleteTask.title}". This cannot be undone.`}
            </p>

            {deleteError ? (
              <p role="alert" className="mt-4 text-sm text-red-700">
                {deleteError}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteTaskModal}
                disabled={deleteSaving}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTask}
                disabled={deleteSaving}
                className="rounded-md border border-red-200 bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-black px-4 py-3 text-sm text-white shadow-lg"
        >
          {toast}
        </div>
      ) : null}
    </main>
  );
}

export default function TodoManager() {
  return <TodoManagerContent />;
}
