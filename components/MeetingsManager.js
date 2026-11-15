"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import MeetingsList from "@/components/MeetingsList";
import { useAuth } from "@/context/AuthContext";
import { ROLE_HOME } from "@/lib/config";
import { db } from "@/lib/firebase";
import { deleteMeetingAndAttendance } from "@/lib/meetings";

const EYEBROW = "text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80";
const PRIMARY = "!min-h-0 inline-flex items-center justify-center gap-2 whitespace-nowrap !rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60";
const GHOST = "!min-h-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap !rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-60";
const DANGER = `${PRIMARY} !bg-red-500 !text-white hover:!bg-red-400 focus-visible:!ring-red-300`;
const BACK_LINK = "group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-white/70 backdrop-blur-md transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50";
const INPUT = "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-400/30 disabled:cursor-not-allowed disabled:opacity-60 [color-scheme:dark]";
const LABEL = "mb-1.5 block text-sm font-medium text-white/80";
const ERROR = "rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100 backdrop-blur-md";

function Modal({ eyebrow, title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-modal-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-neutral-950/85 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white shadow-2xl shadow-black/60 backdrop-blur-2xl sm:rounded-2xl"
      >
        <p className={EYEBROW}>{eyebrow}</p>
        <h2 id="meeting-modal-title" className="mt-2 text-2xl font-semibold">{title}</h2>
        {children}
      </section>
    </div>
  );
}

export default function MeetingsManager() {
  const { user, profile, role } = useAuth();
  const [modal, setModal] = useState(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  }

  function openCreate() { setModal({ type: "create" }); setTitle(""); setDate(""); setNote(""); setError(""); }
  function openEdit(meeting) { setModal({ type: "edit", meeting }); setTitle(meeting.title || ""); setDate(meeting.date || ""); setNote(meeting.note || ""); setError(""); }
  function openDelete(meeting) { setModal({ type: "delete", meeting }); setError(""); }
  function closeModal() { if (!saving) { setModal(null); setError(""); } }

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 2) { setError("Enter a meeting title."); return; }
    if (!date) { setError("Pick a date."); return; }
    setSaving(true); setError("");
    try {
      const payload = { title: trimmedTitle, date, ...(note.trim() ? { note: note.trim() } : {}) };
      if (modal.type === "edit") {
        await updateDoc(doc(db, "meetings", modal.meeting.id), payload);
        showToast("Meeting updated");
      } else {
        await addDoc(collection(db, "meetings"), { ...payload, createdBy: String(user?.email || "").trim().toLowerCase(), createdByName: String(profile?.fullName || profile?.name || user?.displayName || user?.email || "").trim(), createdAt: serverTimestamp() });
        showToast("Meeting created");
      }
      closeModal();
    } catch (saveError) {
      console.error("Meeting save:", saveError?.code, saveError?.message);
      setError(`Could not save the meeting (${saveError?.code || "unknown"}).`);
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!modal?.meeting) return;
    setSaving(true); setError("");
    try { await deleteMeetingAndAttendance(modal.meeting.id); closeModal(); showToast("Meeting deleted"); }
    catch (deleteError) { console.error("Meeting delete:", deleteError?.code, deleteError?.message); setError(`Could not delete the meeting (${deleteError?.code || "unknown"}).`); }
    finally { setSaving(false); }
  }

  return (
    <div className="w-full text-white">
      <Link href={ROLE_HOME[role] || "/login"} className={BACK_LINK}>
        <ArrowLeft className="size-3.5 transition group-hover:-translate-x-0.5" aria-hidden="true" />
        Back to dashboard
      </Link>

      <header className="mb-4 mt-6 flex items-end justify-between gap-4 sm:mb-6">
        <div className="min-w-0">
          <p className={EYEBROW}>Meetings</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">Manage meetings</h1>
          <p className="mt-2 text-sm text-white/50">Create, edit and remove meetings and their attendance.</p>
        </div>
        <button type="button" onClick={openCreate} className={`${PRIMARY} hidden shrink-0 sm:inline-flex`}>
          <Plus className="size-4" aria-hidden="true" />
          Add meeting
        </button>
      </header>

      <MeetingsList
        role={role}
        onEdit={openEdit}
        onDelete={openDelete}
        action={(
          <button
            type="button"
            onClick={openCreate}
            aria-label="Add meeting"
            className={`${PRIMARY} shrink-0 !px-4 sm:hidden`}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add
          </button>
        )}
      />

      {toast ? (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-neutral-950/85 px-5 py-3 text-sm text-white shadow-lg shadow-black/40 backdrop-blur-xl md:bottom-6"
        >
          {toast}
        </div>
      ) : null}

      {modal?.type === "delete" ? (
        <Modal eyebrow="Confirm" title="Delete meeting?" onClose={closeModal}>
          <p className="mt-3 break-words text-sm text-white/60">
            This permanently deletes &quot;{modal.meeting.title}&quot; and its attendance.
          </p>
          {error ? <p role="alert" className={`${ERROR} mt-4`}>{error}</p> : null}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={closeModal} disabled={saving} className={GHOST}>Cancel</button>
            <button type="button" onClick={handleDelete} disabled={saving} className={DANGER}>
              {saving ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              {saving ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      ) : null}

      {modal && modal.type !== "delete" ? (
        <Modal
          eyebrow="Meeting"
          title={modal.type === "edit" ? "Edit meeting" : "Add meeting"}
          onClose={closeModal}
        >
          <form onSubmit={handleSubmit} noValidate>
            <div className="mt-5">
              <label htmlFor="meeting-title" className={LABEL}>Title</label>
              <input id="meeting-title" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} className={INPUT} />
            </div>
            <div className="mt-4">
              <label htmlFor="meeting-date" className={LABEL}>Date</label>
              <input id="meeting-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className={INPUT} />
            </div>
            <div className="mt-4">
              <label htmlFor="meeting-note" className={LABEL}>Note <span className="text-white/40">(optional)</span></label>
              <textarea id="meeting-note" rows="3" value={note} onChange={(event) => setNote(event.target.value)} className={`${INPUT} resize-none`} />
            </div>
            {error ? <p role="alert" className={`${ERROR} mt-4`}>{error}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeModal} disabled={saving} className={GHOST}>Cancel</button>
              <button type="submit" disabled={saving} className={PRIMARY}>
                {saving ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
                {saving ? "Saving…" : modal.type === "edit" ? "Save changes" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}