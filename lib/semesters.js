import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const SEMESTER_TYPES = [
  { value: "odd", label: "Odd" },
  { value: "even", label: "Even" },
];

export function normalizeAcademicYear(value) {
  return String(value || "").trim();
}

// "23-24", "24-25": two digits, a dash, then the next year.
export function isValidAcademicYear(value) {
  const match = /^(\d{2})-(\d{2})$/.exec(normalizeAcademicYear(value));
  if (!match) return false;
  return (Number(match[1]) + 1) % 100 === Number(match[2]);
}

export function buildSemesterId(type, academicYear) {
  return `${normalizeAcademicYear(academicYear)}-${type}`;
}

export function semesterLabel(semester) {
  if (!semester) return "No semester";
  const type = semester.type === "even" ? "Even" : "Odd";
  return `${type} ${semester.academicYear}`;
}

export async function startSemester({ type, academicYear, activeSemester, email }) {
  const year = normalizeAcademicYear(academicYear);
  if (!SEMESTER_TYPES.some((item) => item.value === type)) throw new Error("Choose odd or even.");
  if (!isValidAcademicYear(year)) throw new Error("Use the year format 24-25 (the second year must follow the first).");

  const id = buildSemesterId(type, year);
  const ref = doc(db, "semesters", id);
  if ((await getDoc(ref)).exists()) {
    throw new Error("This semester already exists. Reactivate it from the history instead.");
  }

  const batch = writeBatch(db);
  if (activeSemester?.id) {
    batch.update(doc(db, "semesters", activeSemester.id), {
      status: "closed",
      closedAt: serverTimestamp(),
      closedBy: email,
    });
  }
  batch.set(ref, {
    type,
    academicYear: year,
    status: "active",
    startedAt: serverTimestamp(),
    startedBy: email,
  });
  batch.set(doc(db, "settings", "semester"), {
    activeSemesterId: id,
    updatedAt: serverTimestamp(),
    updatedBy: email,
  });
  await batch.commit();
  return id;
}

export async function reactivateSemester({ target, activeSemester, email }) {
  if (!target?.id) throw new Error("Semester not found.");
  const batch = writeBatch(db);
  if (activeSemester?.id && activeSemester.id !== target.id) {
    batch.update(doc(db, "semesters", activeSemester.id), {
      status: "closed",
      closedAt: serverTimestamp(),
      closedBy: email,
    });
  }
  batch.update(doc(db, "semesters", target.id), {
    status: "active",
    reactivatedAt: serverTimestamp(),
    reactivatedBy: email,
  });
  batch.set(doc(db, "settings", "semester"), {
    activeSemesterId: target.id,
    updatedAt: serverTimestamp(),
    updatedBy: email,
  });
  await batch.commit();
}