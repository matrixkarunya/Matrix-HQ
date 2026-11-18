"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Loader2,
  Pencil,
  Save,
  UserCheck,
  UserX,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import AttendanceStatBoxes from "@/components/AttendanceStatBoxes";
import AttendanceStatusBadge from "@/components/AttendanceStatusBadge";
import WorkingDayToggle from "@/components/WorkingDayToggle";
import useUsers from "@/lib/useUsers";
import { db } from "@/lib/firebase";
import { formatMinutes, splitRange, toMinutes } from "@/lib/hours";

const STAFF_ROLES = ["superadmin", "admin"];
const ALLOWED_ROLES = [...STAFF_ROLES, "member"];
const SCROLL = "[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-white/35 [&::-webkit-scrollbar-corner]:bg-transparent [@supports(not(selector(::-webkit-scrollbar)))]:[scrollbar-width:thin] [@supports(not(selector(::-webkit-scrollbar)))]:[scrollbar-color:rgba(255,255,255,0.25)_transparent]";
const GLASS = "rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20 backdrop-blur-xl";
const EYEBROW = "text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80";
const BTN_PRIMARY = "!min-h-0 inline-flex items-center justify-center gap-2 whitespace-nowrap !rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60";
const BTN_GHOST = "!min-h-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap !rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-60";
const BTN_GHOST_LG = `${BTN_GHOST} !px-5 !py-2.5 !text-sm`;
const BACK_LINK = "group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-white/70 backdrop-blur-md transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50";
const INPUT = "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-400/30 disabled:cursor-not-allowed disabled:opacity-60 [color-scheme:dark]";
const LABEL = "mb-1.5 block text-sm font-medium text-white/80";
const BANNER_ERROR = "rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100 backdrop-blur-md";
const BANNER_INFO = "rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70 backdrop-blur-md";
const ICON_CHIP = "flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-violet-500/15 text-violet-200";
const DATE_CHIP = "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 backdrop-blur-md";

function formatDate(dateString) {
  if (typeof dateString !== "string" || !dateString) return "—";
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getMemberName(user) {
  return String(user?.fullName || user?.name || user?.email || "").trim() || "Unknown member";
}

function getInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function isBoardMember(user) {
  return ["superadmin", "admin", "member"].includes(user?.role)
    && user?.active !== false
    && (user?.profileCompleted === true || user?.role === "superadmin")
    && normalizeEmail(user?.email);
}

function timeIsValid(value) {
  return toMinutes(value) !== null;
}

function BackLink({ href }) {
  return (
    <Link href={href} className={BACK_LINK}>
      <ArrowLeft className="size-3.5 transition group-hover:-translate-x-0.5" aria-hidden="true" />
      Back to events
    </Link>
  );
}

function RosterSkeleton() {
  return (
    <div aria-busy="true" className="space-y-3 p-5 sm:p-6">
      {[0, 1, 2, 3, 4].map((item) => (
        <div key={item} className="flex animate-pulse items-center gap-3 motion-reduce:animate-none">
          <div className="size-10 shrink-0 rounded-full bg-white/10" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded-full bg-white/10" />
            <div className="h-2.5 w-1/5 rounded-full bg-white/10" />
          </div>
          <div className="h-8 w-20 shrink-0 rounded-full bg-white/10" />
        </div>
      ))}
    </div>
  );
}

export default function EventAttendance() {
  const params = useParams();
  const { user, role, loading: authLoading } = useAuth();
  const isStaff = STAFF_ROLES.includes(role);
  const eventId = typeof params?.eventId === "string" ? params.eventId : "";
  const { users, error: usersError, loading: usersLoading } = useUsers();
  const [event, setEvent] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [presentByEmail, setPresentByEmail] = useState({});
  const [savedPresentByEmail, setSavedPresentByEmail] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [eventLoading, setEventLoading] = useState(true);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [listenerError, setListenerError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("initial");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isWorkingDay, setIsWorkingDay] = useState(true);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  const boardMembers = useMemo(() => users
    .filter(isBoardMember)
    .sort((first, second) => getMemberName(first).localeCompare(getMemberName(second))), [users]);

  const memberEmail = normalizeEmail(user?.email);
  const staffReady = isStaff && !eventLoading && !usersLoading && !attendanceLoading;
  const presentCount = boardMembers.filter((member) => presentByEmail[normalizeEmail(member.email)] === true).length;
  const hasSavedAttendance = Boolean(event?.attendanceSummary);
  const savedSummary = event?.attendanceSummary;
  const savedIsWorkingDay = savedSummary?.isWorkingDay !== false;
  const savedTimeTotals = savedSummary
    ? splitRange(savedSummary.startTime, savedSummary.endTime, savedIsWorkingDay)
    : null;

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    if (!db || !eventId || authLoading || !user || !ALLOWED_ROLES.includes(role)) {
      setEvent(null);
      setEventLoading(false);
      return undefined;
    }

    setEventLoading(true);
    setListenerError("");
    const unsubscribe = onSnapshot(doc(db, "events", eventId), (snapshot) => {
      setEvent(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
      setEventLoading(false);
    }, (error) => {
      console.error("Attendance event listener:", error.code, error.message);
      setEvent(null);
      setEventLoading(false);
      setListenerError(`Could not load the event (${error.code || "unknown"}).`);
    });

    return () => unsubscribe();
  }, [authLoading, eventId, role, user]);

  useEffect(() => {
    if (!db || !eventId || authLoading || !user || !ALLOWED_ROLES.includes(role)) {
      setAttendance([]);
      setAttendanceLoading(false);
      return undefined;
    }

    setAttendanceLoading(true);
    setListenerError("");
    const attendanceRef = isStaff
      ? collection(db, "events", eventId, "attendance")
      : doc(db, "events", eventId, "attendance", memberEmail);
    const unsubscribe = onSnapshot(attendanceRef, (snapshot) => {
      setAttendance(isStaff
        ? snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))
        : (snapshot.exists() ? [{ id: snapshot.id, ...snapshot.data() }] : []));
      setAttendanceLoading(false);
    }, (error) => {
      console.error("Attendance listener:", error.code, error.message);
      setAttendance([]);
      setAttendanceLoading(false);
      setListenerError(`Could not load attendance (${error.code || "unknown"}).`);
    });

    return () => unsubscribe();
  }, [authLoading, eventId, isStaff, memberEmail, role, user]);

  useEffect(() => {
    if (!isStaff || !staffReady || editMode) return;

    const savedByEmail = Object.fromEntries(attendance.map((record) => [normalizeEmail(record.email || record.id), record.present === true]));
    setSavedPresentByEmail(savedByEmail);
    setPresentByEmail(savedByEmail);
    setStartTime(event?.attendanceSummary?.startTime || "");
    setEndTime(event?.attendanceSummary?.endTime || "");
    setIsWorkingDay(event?.attendanceSummary?.isWorkingDay !== false);
  }, [attendance, editMode, event, isStaff, staffReady]);

  useEffect(() => {
    if (!isStaff) return;
    setEditMode(false);
    setSavedPresentByEmail({});
    setPresentByEmail({});
  }, [eventId, isStaff]);

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  }

  function openSaveModal() {
    setModalMode("initial");
    setStartTime(event?.attendanceSummary?.startTime || startTime || "");
    setEndTime(event?.attendanceSummary?.endTime || endTime || "");
    setIsWorkingDay(event?.attendanceSummary ? event.attendanceSummary.isWorkingDay !== false : isWorkingDay);
    setFormError("");
    setModalOpen(true);
  }

  function openTimeModal() {
    setModalMode("time");
    setStartTime(event?.attendanceSummary?.startTime || "");
    setEndTime(event?.attendanceSummary?.endTime || "");
    setIsWorkingDay(event?.attendanceSummary?.isWorkingDay !== false);
    setFormError("");
    setModalOpen(true);
  }

  function closeSaveModal() {
    if (saving) return;
    setModalOpen(false);
    setFormError("");
  }

  function toggleMember(email) {
    const normalizedEmail = normalizeEmail(email);
    setPresentByEmail((current) => ({ ...current, [normalizedEmail]: current[normalizedEmail] !== true }));
  }

  function startEditing() {
    if (saving) return;
    setPresentByEmail({ ...savedPresentByEmail });
    setEditMode(true);
    setFormError("");
  }

  function cancelEditing() {
    if (saving) return;
    setPresentByEmail({ ...savedPresentByEmail });
    setEditMode(false);
    setFormError("");
  }

  function getSummaryUpdate(changes) {
    return {
      ...(event?.attendanceSummary || {}),
      ...changes,
      lastEditedBy: memberEmail,
      lastEditedAt: serverTimestamp(),
    };
  }

  async function handleTickSave() {
    const recordsByEmail = Object.fromEntries(attendance.map((record) => [normalizeEmail(record.email || record.id), record]));
    const changedMembers = boardMembers.filter((member) => {
      const email = normalizeEmail(member.email);
      return !recordsByEmail[email] || recordsByEmail[email].present !== (presentByEmail[email] === true);
    });

    if (changedMembers.length === 0) {
      showToast("No changes to save");
      setEditMode(false);
      return;
    }

    const summary = event?.attendanceSummary || {};
    const nextPresentCount = boardMembers.filter((member) => presentByEmail[normalizeEmail(member.email)] === true).length;
    const savedBy = memberEmail;
    setSaving(true);
    setFormError("");

    try {
      for (let index = 0; index < changedMembers.length; index += 399) {
        const batch = writeBatch(db);
        changedMembers.slice(index, index + 399).forEach((member) => {
          const email = normalizeEmail(member.email);
          const attendanceRef = doc(db, "events", eventId, "attendance", email);
          const attendancePayload = {
            email,
            name: getMemberName(member),
            ...(member.designation ? { designation: String(member.designation).trim() } : {}),
            present: presentByEmail[email] === true,
            eventId,
            ...(summary.startTime ? { startTime: summary.startTime } : {}),
            ...(summary.endTime ? { endTime: summary.endTime } : {}),
            isWorkingDay: summary.isWorkingDay !== false,
            markedBy: savedBy,
            markedAt: serverTimestamp(),
          };
          if (recordsByEmail[email]) {
            batch.update(attendanceRef, attendancePayload);
          } else {
            batch.set(attendanceRef, attendancePayload);
          }
        });
        if (index + 399 >= changedMembers.length) {
          batch.update(doc(db, "events", eventId), {
            attendanceSummary: getSummaryUpdate({
              presentCount: nextPresentCount,
              totalCount: boardMembers.length,
            }),
          });
        }
        await batch.commit();
      }
      setEditMode(false);
      showToast("Attendance updated");
    } catch (error) {
      console.error("Attendance update:", error?.code, error?.message);
      setFormError(`Could not update attendance (${error?.code || "unknown"}).`);
    } finally {
      setSaving(false);
    }
  }

  async function handleTimeUpdate() {
    if (!timeIsValid(startTime) || !timeIsValid(endTime)) {
      setFormError("Enter both event times.");
      return;
    }
    if (toMinutes(endTime) <= toMinutes(startTime)) {
      setFormError("Event end time must be after the start time.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      for (let index = 0; index < Math.max(attendance.length, 1); index += 399) {
        const batch = writeBatch(db);
        attendance.slice(index, index + 399).forEach((record) => {
          batch.update(doc(db, "events", eventId, "attendance", record.id), {
            startTime,
            endTime,
            isWorkingDay,
            markedBy: memberEmail,
            markedAt: serverTimestamp(),
          });
        });
        if (index + 399 >= attendance.length) {
          batch.update(doc(db, "events", eventId), {
            attendanceSummary: getSummaryUpdate({ startTime, endTime, isWorkingDay }),
          });
        }
        await batch.commit();
      }
      setModalOpen(false);
      showToast("Times updated");
    } catch (error) {
      console.error("Attendance time update:", error?.code, error?.message);
      setFormError(`Could not update attendance times (${error?.code || "unknown"}).`);
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(eventObject) {
    eventObject.preventDefault();
    if (!timeIsValid(startTime) || !timeIsValid(endTime)) {
      setFormError("Enter both event times.");
      return;
    }
    if (toMinutes(endTime) <= toMinutes(startTime)) {
      setFormError("Event end time must be after the start time.");
      return;
    }

    const savedBy = memberEmail;
    if (modalMode === "time") {
      await handleTimeUpdate();
      return;
    }
    setSaving(true);
    setFormError("");

    try {
      const attendanceSummary = {
        presentCount,
        totalCount: boardMembers.length,
        startTime,
        endTime,
        isWorkingDay,
        savedBy,
        savedAt: serverTimestamp(),
      };

      for (let index = 0; index < Math.max(boardMembers.length, 1); index += 399) {
        const batch = writeBatch(db);
        boardMembers.slice(index, index + 399).forEach((member) => {
          const email = normalizeEmail(member.email);
          batch.set(doc(db, "events", eventId, "attendance", email), {
            email,
            name: getMemberName(member),
            ...(member.designation ? { designation: String(member.designation).trim() } : {}),
            present: presentByEmail[email] === true,
            eventId,
            startTime,
            endTime,
            isWorkingDay,
            markedBy: savedBy,
            markedAt: serverTimestamp(),
          });
        });
        if (index + 399 >= boardMembers.length) {
          batch.update(doc(db, "events", eventId), { attendanceSummary });
        }
        await batch.commit();
      }
      setModalOpen(false);
      showToast("Attendance saved");
    } catch (error) {
      console.error("Attendance save:", error?.code, error?.message);
      setFormError(`Could not save attendance (${error?.code || "unknown"}).`);
    } finally {
      setSaving(false);
    }
  }

  const backHref = role === "member" ? "/member/events" : role === "admin" ? "/admin/events" : "/superadmin/events";
  const myAttendance = attendance.find((record) => normalizeEmail(record.email || record.id) === memberEmail);
  const eventNotFound = !eventLoading && !event && !listenerError;

  if (role === "member") {
    const myStatus = !myAttendance ? "Not recorded" : myAttendance.present ? "Present" : "Absent";
    const myTotals = myAttendance
      ? splitRange(
          myAttendance.startTime,
          myAttendance.endTime,
          (myAttendance.isWorkingDay ?? event?.attendanceSummary?.isWorkingDay) !== false,
        )
      : null;

    return (
      <div className="w-full text-white">
        <BackLink href={backHref} />

        <header className="mt-6">
          <p className={EYEBROW}>Event attendance</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">{event?.name || "Event attendance"}</h1>
          <div className="mt-3">
            <span className={DATE_CHIP}>
              <CalendarDays className="size-3.5 text-violet-300" aria-hidden="true" />
              {formatDate(event?.date)}
            </span>
          </div>
        </header>

        {eventLoading || attendanceLoading ? (
          <div aria-busy="true" className={`${GLASS} mt-4 animate-pulse p-5 motion-reduce:animate-none sm:mt-6 sm:p-6`}>
            <div className="h-3 w-28 rounded-full bg-white/10" />
            <div className="mt-5 h-8 w-24 rounded-full bg-white/10" />
            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="h-16 rounded-xl bg-white/10" />
              <div className="h-16 rounded-xl bg-white/10" />
              <div className="h-16 rounded-xl bg-white/10" />
            </div>
          </div>
        ) : null}

        {listenerError ? <p role="alert" className={`${BANNER_ERROR} mt-4 sm:mt-6`}>{listenerError}</p> : null}

        {eventNotFound ? <p className={`${BANNER_INFO} mt-4 sm:mt-6`}>This event could not be found.</p> : null}

        {!eventLoading && !attendanceLoading && !listenerError ? (
          <section className={`${GLASS} mt-4 p-5 sm:mt-6 sm:p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className={ICON_CHIP}><UserCheck className="size-[18px]" aria-hidden="true" /></span>
                <h2 className="min-w-0 truncate text-lg font-semibold sm:text-xl">My attendance</h2>
              </div>
              <AttendanceStatusBadge status={myStatus} />
            </div>

            {myAttendance ? (
              <>
                <p className="mt-5 flex items-center gap-2 text-sm text-white/60">
                  <Clock className="size-4 shrink-0 text-violet-300" aria-hidden="true" />
                  <span className="min-w-0 truncate">
                    {myAttendance.startTime} to {myAttendance.endTime}
                    {" · "}
                    {(myAttendance.isWorkingDay ?? event?.attendanceSummary?.isWorkingDay) === false ? "Non-working day" : "Working day"}
                  </span>
                </p>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-[.14em] text-white/50">Working</p>
                    <p className="mt-1.5 text-base font-semibold sm:text-lg">{formatMinutes(myTotals.workingMinutes)}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-[.14em] text-white/50">Non-working</p>
                    <p className="mt-1.5 text-base font-semibold sm:text-lg">{formatMinutes(myTotals.nonWorkingMinutes)}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-[.14em] text-white/50">Total</p>
                    <p className="mt-1.5 text-base font-semibold sm:text-lg">{formatMinutes(myTotals.totalMinutes)}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-5 flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-8 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/40">
                  <Users className="size-6" aria-hidden="true" />
                </span>
                <p className="text-sm text-white/40">Your attendance has not been recorded for this event yet.</p>
              </div>
            )}
          </section>
        ) : null}
      </div>
    );
  }

  const staffLoading = eventLoading || usersLoading || attendanceLoading;
  const rosterInteractive = editMode || !hasSavedAttendance;
  const modeLabel = editMode ? "Editing" : hasSavedAttendance ? "Saved" : "Not saved yet";
  const modeTone = editMode
    ? "border-violet-300/30 bg-violet-500/15 text-violet-100"
    : hasSavedAttendance
      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
      : "border-amber-300/30 bg-amber-400/10 text-amber-200";
  const modeHint = editMode
    ? "Changes are written when you press Save."
    : hasSavedAttendance
      ? "Press Edit to change who attended."
      : "Tick the members who attended, then press Save.";

  function renderStatus(member) {
    const email = normalizeEmail(member.email);
    const checked = presentByEmail[email] === true;

    if (rosterInteractive) {
      const disabled = hasSavedAttendance && !editMode || saving;
      return (
        <label
          className={`flex min-h-10 shrink-0 select-none items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-semibold transition focus-within:ring-2 focus-within:ring-violet-300/60 ${
            checked
              ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
              : "border-white/15 bg-white/5 text-white/60"
          } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-white/10"}`}
        >
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={() => toggleMember(email)}
            aria-label={`Mark ${getMemberName(member)} as present`}
            className="size-4 cursor-pointer rounded accent-violet-400 disabled:cursor-not-allowed"
          />
          {checked ? "Present" : "Absent"}
        </label>
      );
    }

    return <AttendanceStatusBadge status={checked ? "Present" : "Absent"} />;
  }

  return (
    <div className="w-full text-white">
      <BackLink href={backHref} />

      <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className={EYEBROW}>Event attendance</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">{event?.name || "Event attendance"}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={DATE_CHIP}>
              <CalendarDays className="size-3.5 text-violet-300" aria-hidden="true" />
              {formatDate(event?.date)}
            </span>
            {savedSummary?.startTime && savedSummary?.endTime ? (
              <span className={DATE_CHIP}>
                <Clock className="size-3.5 text-violet-300" aria-hidden="true" />
                {savedSummary.startTime} to {savedSummary.endTime}
              </span>
            ) : null}
            {savedSummary ? (
              <span className={DATE_CHIP}>
                <span
                  className={`size-1.5 rounded-full ${savedIsWorkingDay ? "bg-emerald-300" : "bg-amber-300"}`}
                  aria-hidden="true"
                />
                {savedIsWorkingDay ? "Working day" : "Non-working day"}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {hasSavedAttendance ? (
            <>
              {editMode ? (
                <>
                  <button type="button" onClick={handleTickSave} disabled={!staffReady || saving} className={BTN_PRIMARY}>
                    {saving ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button type="button" onClick={cancelEditing} disabled={saving} className={BTN_GHOST_LG}>
                    <X className="size-4" aria-hidden="true" />
                    Cancel
                  </button>
                </>
              ) : (
                <button type="button" onClick={startEditing} disabled={!staffReady || saving} className={BTN_GHOST_LG}>
                  <Pencil className="size-4" aria-hidden="true" />
                  Edit
                </button>
              )}
              <button type="button" onClick={openTimeModal} disabled={!staffReady || saving} className={BTN_GHOST_LG}>
                <Clock className="size-4" aria-hidden="true" />
                Edit time
              </button>
            </>
          ) : (
            <button type="button" onClick={openSaveModal} disabled={!staffReady || Boolean(usersError) || saving} className={BTN_PRIMARY}>
              <Save className="size-4" aria-hidden="true" />
              Save
            </button>
          )}
        </div>
      </header>

      {usersError ? <p role="alert" className={`${BANNER_ERROR} mt-4 sm:mt-6`}>{usersError}</p> : null}
      {listenerError ? <p role="alert" className={`${BANNER_ERROR} mt-4 sm:mt-6`}>{listenerError}</p> : null}
      {eventNotFound ? <p className={`${BANNER_INFO} mt-4 sm:mt-6`}>This event could not be found.</p> : null}

      <div className="mt-4 sm:mt-6">
        <AttendanceStatBoxes
          workingMinutes={savedTimeTotals?.workingMinutes}
          nonWorkingMinutes={savedTimeTotals?.nonWorkingMinutes}
          totalMinutes={savedTimeTotals?.totalMinutes}
          attendancePercent={savedSummary && savedSummary.totalCount > 0 ? (savedSummary.presentCount / savedSummary.totalCount) * 100 : null}
          attendanceCaption={savedSummary ? `${savedSummary.presentCount} of ${savedSummary.totalCount} present` : ""}
          emptyNote={!savedSummary ? "Attendance not saved yet" : ""}
        />
      </div>

      <section className={`${GLASS} mt-4 overflow-hidden sm:mt-6`} aria-busy={staffLoading ? "true" : undefined}>
        <div className="flex flex-col gap-3 p-5 pb-4 sm:flex-row sm:items-center sm:justify-between sm:p-6 sm:pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className={ICON_CHIP}><Users className="size-[18px]" aria-hidden="true" /></span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold sm:text-xl">Roster</h2>
              {staffLoading ? null : <p className="truncate text-xs text-white/50">{modeHint}</p>}
            </div>
          </div>
          {staffLoading ? null : (
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium ${modeTone}`}>
                <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                {modeLabel}
              </span>
              <span className="shrink-0 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                {boardMembers.length} {boardMembers.length === 1 ? "member" : "members"}
              </span>
            </div>
          )}
        </div>

        {staffLoading ? (
          <div className="border-t border-white/10"><RosterSkeleton /></div>
        ) : boardMembers.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 border-t border-white/10 px-6 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/40">
              <Users className="size-6" aria-hidden="true" />
            </span>
            <p className="text-sm text-white/40">No active board members to mark yet.</p>
          </div>
        ) : (
          <>
            <div className={`hidden max-h-[60vh] overflow-auto overscroll-contain border-t border-white/10 md:block ${SCROLL}`}>
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-[.14em] text-white/45">
                    <th scope="col" className="sticky top-0 z-10 bg-neutral-950/80 px-6 py-3 font-medium shadow-[inset_0_-1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl">Name</th>
                    <th scope="col" className="sticky top-0 z-10 bg-neutral-950/80 px-6 py-3 font-medium shadow-[inset_0_-1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl">Designation</th>
                    <th scope="col" className="sticky top-0 z-10 bg-neutral-950/80 px-6 py-3 text-right font-medium shadow-[inset_0_-1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {boardMembers.map((member) => {
                    const email = normalizeEmail(member.email);
                    const name = getMemberName(member);
                    return (
                      <tr key={email} className="transition hover:bg-white/[0.06]">
                        <td className="px-6 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-violet-500/15 text-xs font-semibold text-violet-100">
                              {getInitials(name)}
                            </span>
                            <span className="min-w-0 truncate font-medium text-white">{name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-white/60">{member.designation || "—"}</td>
                        <td className="px-6 py-3">
                          <div className="flex justify-end">{renderStatus(member)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className={`max-h-[65vh] space-y-3 overflow-y-auto border-t border-white/10 p-3 sm:p-4 md:hidden ${SCROLL}`}>
              {boardMembers.map((member) => {
                const email = normalizeEmail(member.email);
                const name = getMemberName(member);
                return (
                  <li key={email} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-violet-500/15 text-xs font-semibold text-violet-100">
                      {getInitials(name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{name}</p>
                      <p className="truncate text-xs text-white/50">{member.designation || "—"}</p>
                    </div>
                    {renderStatus(member)}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {toast ? (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-neutral-950/85 px-5 py-3 text-sm text-white shadow-lg shadow-black/40 backdrop-blur-xl md:bottom-6"
        >
          {toast}
        </div>
      ) : null}

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.target === mouseEvent.currentTarget && !saving) closeSaveModal();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="attendance-save-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-neutral-950/85 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white shadow-2xl shadow-black/60 backdrop-blur-2xl sm:rounded-2xl"
          >
            <p className={EYEBROW}>Attendance</p>
            <h2 id="attendance-save-title" className="mt-2 text-2xl font-semibold">{modalMode === "time" ? "Edit attendance times" : "Save attendance"}</h2>
            <p className="mt-2 text-sm text-white/60">
              {modalMode === "time"
                ? "Update the day type and the event start and end time for every attendance record."
                : "Confirm the day type and event time to save attendance for all members."}
            </p>

            <form onSubmit={handleSave} noValidate>
              <div className="mt-5">
                <WorkingDayToggle value={isWorkingDay} onChange={setIsWorkingDay} disabled={saving} />
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="attendance-start" className={LABEL}>Event start time</label>
                  <input id="attendance-start" type="time" required value={startTime} onChange={(inputEvent) => setStartTime(inputEvent.target.value)} className={INPUT} />
                </div>
                <div>
                  <label htmlFor="attendance-end" className={LABEL}>Event end time</label>
                  <input id="attendance-end" type="time" required value={endTime} onChange={(inputEvent) => setEndTime(inputEvent.target.value)} className={INPUT} />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-medium uppercase tracking-[.14em] text-white/50">Present</p>
                    <UserCheck className="size-4 text-emerald-300" aria-hidden="true" />
                  </div>
                  <p className="mt-1.5 text-xl font-semibold">{presentCount}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-medium uppercase tracking-[.14em] text-white/50">Absent</p>
                    <UserX className="size-4 text-red-300" aria-hidden="true" />
                  </div>
                  <p className="mt-1.5 text-xl font-semibold">{boardMembers.length - presentCount}</p>
                </div>
              </div>

              {formError ? <p role="alert" className={`${BANNER_ERROR} mt-4`}>{formError}</p> : null}

              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={closeSaveModal} disabled={saving} className={BTN_GHOST_LG}>Cancel</button>
                <button type="submit" disabled={saving} className={BTN_PRIMARY}>
                  {saving ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
                  {saving ? "Saving…" : "Confirm"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}