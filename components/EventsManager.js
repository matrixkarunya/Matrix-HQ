"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { AlertTriangle, ArrowLeft, Loader2, Plus } from "lucide-react";
import EventsList from "@/components/EventsList";
import { useAuth } from "@/context/AuthContext";
import { ROLE_HOME } from "@/lib/config";
import { deleteEventAndRelatedData } from "@/lib/events";
import { db } from "@/lib/firebase";
import SemesterSelect from "@/components/SemesterSelect";
import { useSemester } from "@/context/SemesterContext";
const PRIMARY =
  "!min-h-0 inline-flex items-center justify-center gap-2 whitespace-nowrap !rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60";
const GHOST =
  "!min-h-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap !rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-60";
const DESTRUCTIVE =
  "!min-h-0 inline-flex items-center justify-center gap-2 whitespace-nowrap !rounded-full bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60";
const INPUT =
  "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-400/30 disabled:cursor-not-allowed disabled:opacity-60 [color-scheme:dark]";
const LABEL = "mb-1.5 block text-sm font-medium text-white/80";
const EYEBROW = "text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80";
const ERROR_BANNER =
  "rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100 backdrop-blur-md";
const BACK_LINK =
  "group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-white/70 backdrop-blur-md transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50";

function ModalShell({ labelledBy, onBackdrop, maxWidth = "max-w-md", children }) {
  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") onBackdrop();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onBackdrop]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onBackdrop();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-t-3xl border border-white/10 bg-neutral-950/85 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white shadow-2xl shadow-black/60 backdrop-blur-2xl sm:rounded-2xl`}
      >
        {children}
      </section>
    </div>
  );
}

function Spinner() {
  return <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />;
}

export default function EventsManager() {
  const { user, profile, role } = useAuth();
  const { activeSemesterId, loading: semesterLoading } = useSemester();
const noSemester = !semesterLoading && !activeSemesterId;
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [editEvent, setEditEvent] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deleteEvent, setDeleteEvent] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSaving, setDeleteSaving] = useState(false);
  const toastTimer = useRef(null);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  }

  function openModal() {
    setName("");
    setDate("");
    setFormError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setName("");
    setDate("");
    setFormError("");
  }

  function openEditModal(event) {
    setEditEvent(event);
    setEditName(event?.name || "");
    setEditDate(event?.date || "");
    setEditError("");
  }

  function closeEditModal() {
    if (editSaving) return;
    setEditEvent(null);
    setEditName("");
    setEditDate("");
    setEditError("");
  }

  function openDeleteModal(event) {
    setDeleteEvent(event);
    setDeleteError("");
  }

  function closeDeleteModal() {
    if (deleteSaving) return;
    setDeleteEvent(null);
    setDeleteError("");
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!activeSemesterId) {
  setFormError("There is no active semester. Ask the superadmin to start one.");
  return;
}
    const trimmedName = name.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setFormError("Enter an event name.");
      return;
    }

    if (!date) {
      setFormError("Pick a date.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      await addDoc(collection(db, "events"), {
        name: trimmedName,
        date,
        semesterId: activeSemesterId,
        completed: false,
        completedAt: null,
        createdBy: (user?.email || "").trim().toLowerCase(),
        createdByName: String(profile?.fullName || profile?.name || user?.displayName || user?.email || "").trim(),
        createdAt: serverTimestamp(),
      });

      setModalOpen(false);
      setName("");
      setDate("");
      setFormError("");
      showToast("Event created");
    } catch (error) {
      console.error("Create event:", error);
      setFormError(`Could not create the event (${error?.code || "unknown"}).`);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(event) {
    event.preventDefault();
    if (!editEvent) return;

    const trimmedName = editName.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setEditError("Enter an event name.");
      return;
    }

    if (!editDate) {
      setEditError("Pick a date.");
      return;
    }

    if (trimmedName === (editEvent.name || "").trim() && editDate === editEvent.date) {
      closeEditModal();
      return;
    }

    setEditSaving(true);
    setEditError("");

    try {
      // Only name and date change; any other field (including a semester) stays as it was.
      await updateDoc(doc(db, "events", editEvent.id), {
        name: trimmedName,
        date: editDate,
      });

      setEditSaving(false);
      closeEditModal();
      showToast("Event updated");
    } catch (error) {
      console.error("Update event:", error);
      setEditError(`Could not update the event (${error?.code || "unknown"}).`);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteEvent) return;

    setDeleteSaving(true);
    setDeleteError("");

    try {
      await deleteEventAndRelatedData(deleteEvent.id);
      setDeleteSaving(false);
      closeDeleteModal();
      showToast("Event deleted");
    } catch (error) {
      console.error("Delete event:", error);
      setDeleteError(`Could not delete the event (${error?.code || "unknown"}).`);
    } finally {
      setDeleteSaving(false);
    }
  }

  const createButton = (
    <button type="button" onClick={openModal} disabled={noSemester || semesterLoading} className={`${PRIMARY} shrink-0`}>
      <Plus className="size-4" aria-hidden="true" />
      <span className="hidden sm:inline">Create event</span>
      <span className="sm:hidden">Create</span>
    </button>
  );

  return (
    <div className="w-full text-white">
      <Link href={ROLE_HOME[role] || "/login"} className={BACK_LINK}>
        <ArrowLeft
          className="size-3.5 transition duration-200 group-hover:-translate-x-0.5"
          aria-hidden="true"
        />
        Back to dashboard
      </Link>

      <header className="mb-6 mt-6 sm:mb-8">
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div className="min-w-0">
      <p className={EYEBROW}>Events</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">Manage events</h1>
    </div>
    <SemesterSelect />
  </div>
  <p className="mt-2 text-sm text-white/50">Create, edit and remove events, and open their todo and attendance.</p>
  {noSemester ? (
    <p role="alert" className="mt-4 rounded-xl border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
      There is no active semester, so events can't be created yet.{" "}
      {role === "superadmin" ? (
        <Link href="/superadmin/semesters" className="underline underline-offset-4">Start one</Link>
      ) : (
        "Ask the superadmin to start one."
      )}
    </p>
  ) : null}
</header>

      <EventsList role={role} onEdit={openEditModal} onDelete={openDeleteModal} action={createButton} />

      {toast ? (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-neutral-950/85 px-5 py-3 text-sm text-white shadow-lg shadow-black/40 backdrop-blur-xl md:bottom-6"
        >
          {toast}
        </div>
      ) : null}

      {modalOpen ? (
        <ModalShell labelledBy="create-event-title" onBackdrop={closeModal}>
          <p className={EYEBROW}>Events</p>
          <h2 id="create-event-title" className="mt-2 text-2xl font-semibold">
            Create event
          </h2>
          <form onSubmit={handleCreate} noValidate>
            <div className="mt-5">
              <label htmlFor="event-name" className={LABEL}>
                Event name
              </label>
              <input
                id="event-name"
                type="text"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={INPUT}
              />
            </div>

            <div className="mt-4">
              <label htmlFor="event-date" className={LABEL}>
                Date
              </label>
              <input
                id="event-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className={INPUT}
              />
            </div>

            {formError ? (
              <p role="alert" className={`${ERROR_BANNER} mt-4`}>
                {formError}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeModal} disabled={saving} className={GHOST}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className={PRIMARY}>
                {saving ? <Spinner /> : null}
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {editEvent ? (
        <ModalShell labelledBy="edit-event-title" onBackdrop={closeEditModal}>
          <p className={EYEBROW}>Events</p>
          <h2 id="edit-event-title" className="mt-2 text-2xl font-semibold">
            Edit event
          </h2>
          <form onSubmit={handleUpdate} noValidate>
            <div className="mt-5">
              <label htmlFor="edit-event-name" className={LABEL}>
                Event name
              </label>
              <input
                id="edit-event-name"
                type="text"
                autoFocus
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className={INPUT}
              />
            </div>

            <div className="mt-4">
              <label htmlFor="edit-event-date" className={LABEL}>
                Date
              </label>
              <input
                id="edit-event-date"
                type="date"
                value={editDate}
                onChange={(event) => setEditDate(event.target.value)}
                className={INPUT}
              />
            </div>

            {editError ? (
              <p role="alert" className={`${ERROR_BANNER} mt-4`}>
                {editError}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeEditModal} disabled={editSaving} className={GHOST}>
                Cancel
              </button>
              <button type="submit" disabled={editSaving} className={PRIMARY}>
                {editSaving ? <Spinner /> : null}
                {editSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {deleteEvent ? (
        <ModalShell labelledBy="delete-event-title" onBackdrop={closeDeleteModal}>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-red-300/25 bg-red-400/10 text-red-200">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className={EYEBROW}>Confirm</p>
              <h2 id="delete-event-title" className="mt-1.5 text-2xl font-semibold">
                Delete event?
              </h2>
            </div>
          </div>
          <p className="mt-4 break-words text-sm text-white/60">
            This permanently deletes &quot;{deleteEvent.name}&quot; and all data related to it: tasks, attendance,
            completion requests and logged hours. This cannot be undone.
          </p>

          {deleteError ? (
            <p role="alert" className={`${ERROR_BANNER} mt-4`}>
              {deleteError}
            </p>
          ) : null}

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={closeDeleteModal} disabled={deleteSaving} className={GHOST}>
              Cancel
            </button>
            <button type="button" onClick={handleDelete} disabled={deleteSaving} className={DESTRUCTIVE}>
              {deleteSaving ? <Spinner /> : null}
              {deleteSaving ? "Deleting…" : "Delete"}
            </button>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}