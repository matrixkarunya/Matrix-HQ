import { collection, deleteDoc, doc, getDocs, query, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function normalizeMeetingEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function meetingMemberName(user) {
  return String(user?.fullName || user?.name || user?.email || "").trim() || "Unknown member";
}

export function meetingDateLabel(value, includeWeekday = false) {
  if (!value) return "—";
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    ...(includeWeekday ? { weekday: "short" } : {}),
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export async function deleteMeetingAndAttendance(meetingId) {
  const attendanceSnapshot = await getDocs(query(collection(db, "meetings", meetingId, "attendance")));
  for (let index = 0; index < attendanceSnapshot.docs.length; index += 400) {
    const batch = writeBatch(db);
    attendanceSnapshot.docs.slice(index, index + 400).forEach((attendanceDoc) => {
      batch.delete(attendanceDoc.ref);
    });
    await batch.commit();
  }
  await deleteDoc(doc(db, "meetings", meetingId));
}