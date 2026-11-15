import { doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function completionRequestId(eventId, todoId, memberEmail, subtaskId = "todo") {
  const clean = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return `${clean(eventId)}_${clean(todoId)}_${clean(subtaskId)}_${clean(memberEmail)}`;
}

export function completionRequestRef(eventId, todoId, memberEmail, subtaskId = "todo") {
  return doc(db, "completionRequests", completionRequestId(eventId, todoId, memberEmail, subtaskId));
}

export function cleanTimeEntries(entries) {
  return (Array.isArray(entries) ? entries : []).map(({ startTime, endTime }) => ({
    startTime: String(startTime || "").trim(),
    endTime: String(endTime || "").trim(),
  }));
}

export function requestStatusLabel(request, task, subtaskId = "todo") {
  if (request?.status === "approved") return "Completed";
  if (request?.status === "pending") return "Awaiting approval";
  if (request?.status === "rejected") return "Rejected";
  if (subtaskId === "todo" && task?.done) return "Completed";
  return "Pending";
}
