"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { ArrowLeft, Check, Clock3, Percent, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import RoleGuard from "@/components/RoleGuard";
import useUsers from "@/lib/useUsers";
import { db } from "@/lib/firebase";
import { meetingDateLabel, meetingMemberName, normalizeMeetingEmail } from "@/lib/meetings";
import { meetingMinutes, toMinutes, formatMinutes } from "@/lib/hours";

const STAFF_ROLES = ["superadmin", "admin"];
const GLASS = "rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20 backdrop-blur-xl";
const BUTTON = "!min-h-0 inline-flex items-center justify-center gap-2 whitespace-nowrap !rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/15 disabled:opacity-60";
const PRIMARY = "!min-h-0 inline-flex items-center justify-center gap-2 whitespace-nowrap !rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 disabled:opacity-60";

function isBoardMember(user) {
  return ["superadmin", "admin", "member"].includes(user?.role) && user?.active !== false && (user?.profileCompleted === true || user?.role === "superadmin") && normalizeMeetingEmail(user?.email);
}

function Stat({ icon: Icon, label, value, caption }) {
  return <div className={`${GLASS} p-5`}><div className="flex items-center justify-between gap-3"><span className="text-xs font-medium uppercase tracking-[.16em] text-white/50">{label}</span><span className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-violet-500/15 text-violet-200"><Icon className="size-[18px]" /></span></div><p className="mt-4 text-2xl font-bold">{value}</p>{caption ? <p className="mt-2 text-xs text-white/50">{caption}</p> : null}</div>;
}

function TimeModal({ startTime, endTime, setStartTime, setEndTime, error, saving, mode, onClose, onSubmit, presentCount, totalCount }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="meeting-time-title" className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-950/95 p-6 text-white shadow-2xl"><h2 id="meeting-time-title" className="text-xl font-semibold">{mode === "time" ? "Edit meeting times" : mode === "edit" ? "Save attendance changes" : "Save attendance"}</h2><form onSubmit={onSubmit} noValidate>{mode !== "edit" ? <><label className="mt-5 block text-sm font-medium text-white/80" htmlFor="meeting-start">Meeting start time</label><input id="meeting-start" type="time" required value={startTime} onChange={(event) => setStartTime(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white [color-scheme:dark]" /><label className="mt-4 block text-sm font-medium text-white/80" htmlFor="meeting-end">Meeting end time</label><input id="meeting-end" type="time" required value={endTime} onChange={(event) => setEndTime(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white [color-scheme:dark]" /></> : null}<p className="mt-4 text-sm text-white/60">{presentCount} present, {totalCount - presentCount} absent</p>{error ? <p role="alert" className="mt-4 rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</p> : null}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} disabled={saving} className={BUTTON}>Cancel</button><button type="submit" disabled={saving} className={PRIMARY}>{saving ? "Saving…" : "Confirm"}</button></div></form></section></div>;
}

function MeetingAttendanceContent() {
  const params = useParams();
  const { user, role, loading: authLoading } = useAuth();
  const { users, error: usersError, loading: usersLoading } = useUsers();
  const meetingId = typeof params?.meetingId === "string" ? params.meetingId : "";
  const staffEmail = normalizeMeetingEmail(user?.email);
  const [meeting, setMeeting] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [presentByEmail, setPresentByEmail] = useState({});
  const [savedPresentByEmail, setSavedPresentByEmail] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listenerError, setListenerError] = useState("");
  const [modalMode, setModalMode] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const boardMembers = useMemo(() => users.filter(isBoardMember).sort((a, b) => meetingMemberName(a).localeCompare(meetingMemberName(b))), [users]);
  const summary = meeting?.attendanceSummary || null;
  const hasSaved = Boolean(summary);
  const presentCount = boardMembers.filter((member) => presentByEmail[normalizeMeetingEmail(member.email)] === true).length;
  const totalCount = boardMembers.length;
  const duration = summary ? meetingMinutes(summary.startTime, summary.endTime) : 0;

  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    if (!db || !meetingId || authLoading || !user || !STAFF_ROLES.includes(role)) { setMeeting(null); setLoading(false); return undefined; }
    setLoading(true); setListenerError("");
    const unsubscribe = onSnapshot(doc(db, "meetings", meetingId), (snapshot) => { setMeeting(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null); setLoading(false); }, (error) => { console.error("Meeting listener:", error.code, error.message); setMeeting(null); setLoading(false); setListenerError(`Could not load the meeting (${error.code || "unknown"}).`); });
    return () => unsubscribe();
  }, [authLoading, meetingId, role, user]);
  useEffect(() => {
    if (!db || !meetingId || authLoading || !user || !STAFF_ROLES.includes(role)) { setAttendance([]); setLoading(false); return undefined; }
    const unsubscribe = onSnapshot(collection(db, "meetings", meetingId, "attendance"), (snapshot) => { setAttendance(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))); setLoading(false); }, (error) => { console.error("Meeting attendance listener:", error.code, error.message); setAttendance([]); setLoading(false); setListenerError(`Could not load attendance (${error.code || "unknown"}).`); });
    return () => unsubscribe();
  }, [authLoading, meetingId, role, user]);
  useEffect(() => {
    if (editMode) return;
    const next = Object.fromEntries(attendance.map((record) => [normalizeMeetingEmail(record.email || record.id), record.present === true]));
    setSavedPresentByEmail(next); setPresentByEmail(next); setStartTime(summary?.startTime || ""); setEndTime(summary?.endTime || "");
  }, [attendance, editMode, summary]);

  function showToast(message) { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 2500); }
  function openInitialModal() { setModalMode("initial"); setStartTime(summary?.startTime || ""); setEndTime(summary?.endTime || ""); setFormError(""); }
  function openTimeModal() { setModalMode("time"); setStartTime(summary?.startTime || ""); setEndTime(summary?.endTime || ""); setFormError(""); }
  function toggle(email) { const normalized = normalizeMeetingEmail(email); setPresentByEmail((current) => ({ ...current, [normalized]: current[normalized] !== true })); }
  function startEditing() { setPresentByEmail({ ...savedPresentByEmail }); setEditMode(true); setFormError(""); }
  function cancelEditing() { setPresentByEmail({ ...savedPresentByEmail }); setEditMode(false); setFormError(""); }
  function validateTimes() { if (toMinutes(startTime) === null || toMinutes(endTime) === null) return "Enter both meeting times."; if (toMinutes(endTime) <= toMinutes(startTime)) return "Meeting end time must be after the start time."; return ""; }

  async function handleSubmit(event) {
    event.preventDefault();
    const timeError = modalMode === "time" || !hasSaved ? validateTimes() : "";
    if (timeError) { setFormError(timeError); return; }
    setSaving(true); setFormError("");
    const recordsByEmail = Object.fromEntries(attendance.map((record) => [normalizeMeetingEmail(record.email || record.id), record]));
    try {
      if (modalMode === "time") {
        for (let index = 0; index < Math.max(attendance.length, 1); index += 400) {
          const batch = writeBatch(db);
          attendance.slice(index, index + 400).forEach((record) => batch.update(doc(db, "meetings", meetingId, "attendance", record.id), { startTime, endTime, durationMinutes: meetingMinutes(startTime, endTime), markedBy: staffEmail, markedAt: serverTimestamp() }));
          if (index + 400 >= attendance.length) batch.update(doc(db, "meetings", meetingId), { attendanceSummary: { ...summary, startTime, endTime, durationMinutes: meetingMinutes(startTime, endTime), lastEditedBy: staffEmail, lastEditedAt: serverTimestamp() } });
          await batch.commit();
        }
        setModalMode(""); showToast("Meeting times updated"); return;
      }
      const changedMembers = modalMode === "initial" ? boardMembers : boardMembers.filter((member) => { const email = normalizeMeetingEmail(member.email); return !recordsByEmail[email] || recordsByEmail[email].present !== (presentByEmail[email] === true); });
      if (!changedMembers.length) { setEditMode(false); setModalMode(""); showToast("No changes to save"); return; }
      const nextSummary = modalMode === "initial" ? { presentCount, totalCount, startTime, endTime, durationMinutes: meetingMinutes(startTime, endTime), savedBy: staffEmail, savedAt: serverTimestamp() } : { ...summary, presentCount, totalCount, lastEditedBy: staffEmail, lastEditedAt: serverTimestamp() };
      for (let index = 0; index < changedMembers.length; index += 400) {
        const batch = writeBatch(db);
        changedMembers.slice(index, index + 400).forEach((member) => { const email = normalizeMeetingEmail(member.email); batch.set(doc(db, "meetings", meetingId, "attendance", email), { email, name: meetingMemberName(member), present: presentByEmail[email] === true, meetingId, startTime: modalMode === "initial" ? startTime : summary.startTime, endTime: modalMode === "initial" ? endTime : summary.endTime, durationMinutes: modalMode === "initial" ? meetingMinutes(startTime, endTime) : summary.durationMinutes, markedBy: staffEmail, markedAt: serverTimestamp() }, { merge: true }); });
        if (index + 400 >= changedMembers.length) batch.update(doc(db, "meetings", meetingId), { attendanceSummary: nextSummary });
        await batch.commit();
      }
      setEditMode(false); setModalMode(""); showToast(modalMode === "initial" ? "Attendance saved" : "Attendance updated");
    } catch (error) { console.error("Meeting attendance save:", error?.code, error?.message); setFormError(`Could not save attendance (${error?.code || "unknown"}).`); }
    finally { setSaving(false); }
  }

  const backHref = role === "superadmin" ? "/superadmin/meetings" : "/admin/meetings";
  return <div className="w-full text-white"><Link href={backHref} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white/70 hover:text-white"><ArrowLeft className="size-3.5" />Back to meetings</Link><div className="mt-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80">Meeting attendance</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{meeting?.title || "Meeting attendance"}</h1><p className="mt-2 text-sm text-white/50">{meetingDateLabel(meeting?.date)}</p></div><div className="flex flex-wrap gap-2">{hasSaved ? (editMode ? <><button type="button" onClick={() => { setModalMode("edit"); setFormError(""); }} disabled={saving} className={PRIMARY}><Check className="size-4" />Save</button><button type="button" onClick={cancelEditing} disabled={saving} className={BUTTON}>Cancel</button></> : <button type="button" onClick={startEditing} disabled={loading || saving} className={BUTTON}>Edit</button>) : <button type="button" onClick={openInitialModal} disabled={loading || usersLoading || saving} className={PRIMARY}>Save</button>}{hasSaved ? <button type="button" onClick={openTimeModal} disabled={loading || saving} className={BUTTON}>Edit time</button> : null}</div></div><div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"><Stat icon={Clock3} label="Meeting Hours" value={hasSaved ? formatMinutes(duration) : "—"} caption={hasSaved ? `${summary.startTime} to ${summary.endTime}` : "Attendance not saved yet"} /><Stat icon={Users} label="Present" value={hasSaved ? summary.presentCount : "—"} /><Stat icon={Users} label="Total Members" value={hasSaved ? summary.totalCount : "—"} /><Stat icon={Percent} label="Attendance %" value={hasSaved && summary.totalCount ? `${((summary.presentCount / summary.totalCount) * 100).toFixed(1)}%` : "—"} /></div>{usersError ? <p role="alert" className="mt-4 rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{usersError}</p> : null}{listenerError ? <p role="alert" className="mt-4 rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{listenerError}</p> : null}<div className={`${GLASS} mt-6 overflow-x-auto`}><table className="min-w-full text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase tracking-[.14em] text-white/45"><tr><th className="px-5 py-3.5">Name</th><th className="px-5 py-3.5">Designation</th><th className="px-5 py-3.5">Status</th></tr></thead><tbody className="divide-y divide-white/10">{boardMembers.map((member) => { const email = normalizeMeetingEmail(member.email); return <tr key={email}><td className="px-5 py-3.5">{meetingMemberName(member)}</td><td className="px-5 py-3.5 text-white/60">{member.designation || "—"}</td><td className="px-5 py-3.5">{editMode || !hasSaved ? <input type="checkbox" checked={presentByEmail[email] === true} disabled={saving} onChange={() => toggle(email)} className="size-4 accent-violet-400" /> : <span className={presentByEmail[email] ? "text-emerald-300" : "text-white/50"}>{presentByEmail[email] ? "Present" : "Absent"}</span>}</td></tr>; })}</tbody></table></div>{toast ? <div role="status" className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-neutral-950/90 px-5 py-3 text-sm md:bottom-6">{toast}</div> : null}{modalMode ? <TimeModal startTime={startTime} endTime={endTime} setStartTime={setStartTime} setEndTime={setEndTime} error={formError} saving={saving} mode={modalMode} onClose={() => setModalMode("")} onSubmit={handleSubmit} presentCount={presentCount} totalCount={totalCount} /> : null}</div>;
}

export default function MeetingAttendance() { return <RoleGuard allow={STAFF_ROLES}><MeetingAttendanceContent /></RoleGuard>; }