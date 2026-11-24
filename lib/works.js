import { deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function normalizeWorkEmail(value) {
  return String(value || "").trim().toLowerCase();
}

// Same rule as the attendance roster: active board members with a finished profile.
export function isWorkParticipant(user) {
  return ["superadmin", "admin", "member"].includes(user?.role)
    && user?.active !== false
    && (user?.profileCompleted === true || user?.role === "superadmin")
    && Boolean(normalizeWorkEmail(user?.email));
}

export function workDateLabel(value, includeWeekday = false) {
  if (!value) return "—";
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    ...(includeWeekday ? { weekday: "short" } : {}),
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export async function deleteWork(workId) {
  if (!workId || !db) throw new Error("Invalid work id");
  await deleteDoc(doc(db, "works", workId));
}