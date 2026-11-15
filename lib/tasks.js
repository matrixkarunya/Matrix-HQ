import { serverTimestamp } from "firebase/firestore";

function makeId(prefix = "id") {
  if (typeof globalThis !== "undefined" && globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeSubtask(subtask = {}) {
  const title = String(subtask?.title ?? "").trim();

  return {
    id: String(subtask?.id ?? "") || makeId("subtask"),
    title,
    done: Boolean(subtask?.done),
  };
}

export function normalizeTask(task = {}) {
  return {
    ...task,
    id: task?.id || makeId("task"),
    title: String(task?.title ?? "").trim(),
    deadline: task?.deadline || "",
    assignees: Array.isArray(task?.assignees)
      ? task.assignees.map((person) => String(person ?? "").trim()).filter(Boolean)
      : [],
    done: Boolean(task?.done),
    subtasks: Array.isArray(task?.subtasks)
      ? task.subtasks.map((subtask) => normalizeSubtask(subtask)).filter((subtask) => subtask.title.length > 0)
      : [],
  };
}

export function taskIsDone(task) {
  const normalized = normalizeTask(task);

  if (normalized.subtasks.length > 0) {
    return normalized.subtasks.every((subtask) => Boolean(subtask.done));
  }

  return Boolean(normalized.done);
}

export function buildTaskUpdate(task, nextSubtasks = null, explicitDone = null) {
  const normalized = normalizeTask(task);
  const subtasks = (Array.isArray(nextSubtasks) ? nextSubtasks : normalized.subtasks)
    .map((subtask) => normalizeSubtask(subtask))
    .filter((subtask) => subtask.title.length > 0)
    .slice(0, 30);

  const finalDone = typeof explicitDone === "boolean"
    ? explicitDone
    : subtasks.length > 0
      ? subtasks.every((subtask) => Boolean(subtask.done))
      : Boolean(normalized.done);

  const payload = {
    subtasks,
    done: Boolean(finalDone),
  };

  return payload;
}

export function toggleTask(task) {
  const normalized = normalizeTask(task);
  const nextDoneState = !taskIsDone(normalized);
  const nextSubtasks = normalized.subtasks.map((subtask) => ({
    ...normalizeSubtask(subtask),
    done: nextDoneState,
  }));

  const payload = buildTaskUpdate({ ...normalized, done: nextDoneState, subtasks: nextSubtasks }, nextSubtasks, nextDoneState);
  console.log("Task toggle payload:", payload);
  return payload;
}

export function toggleSubtask(task, subtaskId) {
  const normalized = normalizeTask(task);
  const nextSubtasks = normalized.subtasks.map((subtask) =>
    subtask.id === subtaskId ? { ...normalizeSubtask(subtask), done: !Boolean(subtask.done) } : normalizeSubtask(subtask),
  );

  const nextDoneState = nextSubtasks.length > 0 ? nextSubtasks.every((subtask) => Boolean(subtask.done)) : Boolean(normalized.done);
  const payload = buildTaskUpdate({ ...normalized, subtasks: nextSubtasks, done: nextDoneState }, nextSubtasks, nextDoneState);
  console.log("Subtask toggle payload:", payload);
  return payload;
}

export function addSubtask(task, newTitle) {
  const normalized = normalizeTask(task);
  const trimmedTitle = String(newTitle ?? "").trim();

  if (!trimmedTitle) {
    const payload = buildTaskUpdate(normalized, normalized.subtasks, Boolean(normalized.done));
    console.log("Add subtask no-op payload:", payload);
    return payload;
  }

  const nextSubtasks = [...normalized.subtasks, normalizeSubtask({ id: makeId("subtask"), title: trimmedTitle, done: false })].slice(0, 30);
  const nextDoneState = nextSubtasks.length > 0 ? nextSubtasks.every((subtask) => Boolean(subtask.done)) : Boolean(normalized.done);
  const payload = buildTaskUpdate({ ...normalized, subtasks: nextSubtasks, done: nextDoneState }, nextSubtasks, nextDoneState);
  console.log("Add subtask payload:", payload);
  return payload;
}

export function eventProgress(tasks = []) {
  const normalizedTasks = tasks.map((task) => normalizeTask(task));
  const total = normalizedTasks.length;
  const completed = normalizedTasks.filter((task) => taskIsDone(task)).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return { total, completed, percent };
}

export function completeEvent(event = {}) {
  return {
    completed: true,
    completedAt: serverTimestamp(),
  };
}

export function reopenEvent(event = {}) {
  return {
    completed: false,
    completedAt: null,
  };
}
