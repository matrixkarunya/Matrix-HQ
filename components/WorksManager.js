"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { AlertTriangle, ArrowLeft, Briefcase, Clock3, Loader2, Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";
import SemesterSelect from "@/components/SemesterSelect";
import WorkModal from "@/components/WorkModal";
import { useAuth } from "@/context/AuthContext";
import { useSemester } from "@/context/SemesterContext";
import { ROLE_HOME } from "@/lib/config";
import { db } from "@/lib/firebase";
import { formatMinutes, splitRange } from "@/lib/hours";
import useUsers from "@/lib/useUsers";
import { deleteWork, isWorkParticipant, normalizeWorkEmail, workDateLabel } from "@/lib/works";

const GLASS = "rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20 backdrop-blur-xl";
const EYEBROW = "text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80";
const PRIMARY =
  "!min-h-0 inline-flex items-center justify-center gap-2 whitespace-nowrap !rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60";
const GHOST =
  "!min-h-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap !rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-60";
const DESTRUCTIVE =
  "!min-h-0 inline-flex items-center justify-center gap-2 whitespace-nowrap !rounded-full bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60";
const ACTION =
  "!min-h-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap !rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50";
const ACTION_DANGER = `${ACTION} !border-red-300/25 !bg-red-400/10 !text-red-200 hover:!bg-red-400/20`;
const BACK_LINK =
  "group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-white/70 backdrop-blur-md transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50";
const ERROR_BANNER = "rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100 backdrop-blur-md";
const CHIP = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70";

function dayParts(value) {
  if (!value) return { day: "—", month: "" };
  const [year, month, day] = String(value).split("-").map(Number);
  return {
    day: String(day).padStart(2, "0"),
    month: new Date(year, month - 1, day).toLocaleDateString("en-IN", { month: "short" }),
  };
}

function ConfirmDelete({ work, busy, error, onCancel, onConfirm }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-work-title"
        className="w-full max-w-md rounded-t-3xl border border-white/10 bg-neutral-950/85 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white shadow-2xl shadow-black/60 backdrop-blur-2xl sm:rounded-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-red-300/25 bg-red-400/10 text-red-200">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className={EYEBROW}>Confirm</p>
            <h2 id="delete-work-title" className="mt-1.5 text-2xl font-semibold">Delete work?</h2>
          </div>
        </div>
        <p className="mt-4 break-words text-sm text-white/60">
          This permanently deletes &quot;{work.title}&quot; and removes these hours from every participant. This cannot be undone.
        </p>
        {error ? <p role="alert" className={`${ERROR_BANNER} mt-4`}>{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={busy} className={GHOST}>Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy} className={DESTRUCTIVE}>
            {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function WorksManager() {
  const { user, profile, role, loading: authLoading } = useAuth();
  const { activeSemesterId, selectedSemesterId, loading: semesterLoading } = useSemester();
  const { users, error: usersError } = useUsers();
  const me = normalizeWorkEmail(user?.email);
  const noSemester = !semesterLoading && !activeSemesterId;
  const createDisabled = noSemester || semesterLoading;

  const [works, setWorks] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // { mode: "create" | "edit", work }
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    if (!db || authLoading || !user || !["superadmin", "admin"].includes(role)) {
      setWorks([]);
      setListLoading(false);
      return undefined;
    }
    setListLoading(true);
    const unsubscribe = onSnapshot(
      query(collection(db, "works"), orderBy("date", "desc")),
      (snapshot) => {
        setWorks(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setListLoading(false);
      },
      (snapshotError) => {
        console.error("Works listener:", snapshotError.code, snapshotError.message);
        setWorks([]);
        setListLoading(false);
        setError(`Could not load works (${snapshotError.code || "unknown"}).`);
      },
    );
    return () => unsubscribe();
  }, [authLoading, role, user]);

  const people = useMemo(
    () => users.filter(isWorkParticipant).sort((a, b) => String(a.fullName || a.name || a.email).localeCompare(String(b.fullName || b.name || b.email))),
    [users],
  );

  function nameFor(email) {
    const person = users.find((item) => normalizeWorkEmail(item.email) === normalizeWorkEmail(email));
    return String(person?.fullName || person?.name || email).trim();
  }

  const visible = useMemo(() => {
    const inSemester = works.filter((work) => work.semesterId && work.semesterId === selectedSemesterId);
    const term = search.trim().toLowerCase();
    const list = term
      ? inSemester.filter((work) =>
          `${work.title || ""} ${work.description || ""} ${work.date || ""} ${(work.participants || []).map(nameFor).join(" ")}`
            .toLowerCase()
            .includes(term),
        )
      : inSemester;
    return [...list].sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [works, search, selectedSemesterId, users]);

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  }

  function canManage(work) {
    return role === "superadmin" || normalizeWorkEmail(work.createdBy) === me;
  }

  function openCreate() {
    if (createDisabled) return;
    setFormError("");
    setModal({ mode: "create", work: null });
  }

  function closeModal() {
    if (saving) return;
    setModal(null);
    setFormError("");
  }

  async function handleSubmit(values) {
    if (modal?.mode !== "edit" && !activeSemesterId) {
      setFormError("There is no active semester. Ask the superadmin to start one.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const fields = {
        title: values.title,
        description: values.description,
        date: values.date,
        startTime: values.startTime,
        endTime: values.endTime,
        isWorkingDay: values.isWorkingDay,
        participants: values.participants,
      };
      if (modal.mode === "edit") {
        // semesterId and createdBy are never touched on edit
        await updateDoc(doc(db, "works", modal.work.id), fields);
        showToast("Work updated");
      } else {
        await addDoc(collection(db, "works"), {
          ...fields,
          semesterId: activeSemesterId,
          createdBy: me,
          createdByName: String(profile?.fullName || profile?.name || user?.displayName || user?.email || "").trim(),
          createdAt: serverTimestamp(),
        });
        showToast("Work added");
      }
      setSaving(false);
      setModal(null);
    } catch (saveError) {
      console.error("Work save:", saveError?.code, saveError?.message);
      setFormError(`Could not save the work (${saveError?.code || "unknown"}).`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteWork(deleteTarget.id);
      setDeleting(false);
      setDeleteTarget(null);
      showToast("Work deleted");
    } catch (deleteFailure) {
      console.error("Work delete:", deleteFailure?.code, deleteFailure?.message);
      setDeleteError(`Could not delete the work (${deleteFailure?.code || "unknown"}).`);
    } finally {
      setDeleting(false);
    }
  }

  const loading = listLoading || semesterLoading;

  return (
    <div className="w-full text-white">
      <Link href={ROLE_HOME[role] || "/login"} className={BACK_LINK}>
        <ArrowLeft className="size-3.5 transition group-hover:-translate-x-0.5" aria-hidden="true" />
        Back to dashboard
      </Link>

      <header className="mb-4 mt-6 sm:mb-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className={EYEBROW}>Works</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">Manage works</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SemesterSelect />
            <button type="button" onClick={openCreate} disabled={createDisabled} className={`${PRIMARY} hidden sm:inline-flex`}>
              <Plus className="size-4" aria-hidden="true" />
              Add work
            </button>
          </div>
        </div>
        <p className="mt-2 text-sm text-white/50">Record hours for work outside events. They count in each participant&apos;s attendance.</p>
        {noSemester ? (
          <p role="alert" className="mt-4 rounded-xl border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            There is no active semester, so works can&apos;t be added yet.{" "}
            {role === "superadmin" ? (
              <Link href="/superadmin/semesters" className="underline underline-offset-4">Start one</Link>
            ) : (
              "Ask the superadmin to start one."
            )}
          </p>
        ) : null}
      </header>

      {error || usersError ? <p role="alert" className={`${ERROR_BANNER} mb-4`}>{error || usersError}</p> : null}

      <div className="mb-4 flex items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/40" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title or person"
            aria-label="Search works"
            className="w-full rounded-full border border-white/15 bg-white/5 py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-white/30 focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-400/30 [color-scheme:dark] [&::-webkit-search-cancel-button]:hidden"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="!min-h-0 absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center !rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <button type="button" onClick={openCreate} disabled={createDisabled} aria-label="Add work" className={`${PRIMARY} shrink-0 !px-4 sm:hidden`}>
          <Plus className="size-4" aria-hidden="true" />
          Add
        </button>
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((item) => (
            <div key={item} className={`${GLASS} h-28 animate-pulse motion-reduce:animate-none`} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className={`${GLASS} flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center`}>
          <span className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/40">
            <Briefcase className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm text-white/50">
            {search.trim() ? "No works match your search." : selectedSemesterId ? "No works in this semester yet." : "No active semester yet."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((work) => {
            const split = splitRange(work.startTime, work.endTime, work.isWorkingDay !== false);
            const { day, month } = dayParts(work.date);
            const names = (work.participants || []).map(nameFor);
            return (
              <li key={work.id} className={`${GLASS} p-4 sm:p-5`}>
                <div className="flex items-start gap-4">
                  <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-violet-500/15 leading-none">
                    <span className="text-lg font-bold">{day}</span>
                    <span className="mt-1 text-[10px] uppercase tracking-wider text-violet-200/80">{month}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-base font-semibold leading-snug">{work.title}</h3>
                    <p className="mt-0.5 text-xs text-white/50">{workDateLabel(work.date, true)}</p>
                    {work.description ? <p className="mt-2 line-clamp-2 break-words text-sm text-white/60">{work.description}</p> : null}

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className={CHIP}><Clock3 className="size-3 text-violet-300" aria-hidden="true" />{work.startTime} to {work.endTime}</span>
                      <span className={CHIP}>
                        <span className={`size-1.5 rounded-full ${work.isWorkingDay === false ? "bg-amber-300" : "bg-emerald-300"}`} aria-hidden="true" />
                        {work.isWorkingDay === false ? "Non-working day" : "Working day"}
                      </span>
                      <span className={CHIP}>Working <span className="font-semibold text-white">{formatMinutes(split.workingMinutes)}</span></span>
                      <span className={CHIP}>Non-working <span className="font-semibold text-white">{formatMinutes(split.nonWorkingMinutes)}</span></span>
                    </div>

                    <p className="mt-3 flex items-start gap-1.5 text-xs text-white/55">
                      <Users className="mt-0.5 size-3.5 shrink-0 text-violet-300" aria-hidden="true" />
                      <span className="min-w-0 break-words">
                        {names.slice(0, 3).join(", ")}
                        {names.length > 3 ? ` +${names.length - 3} more` : ""}
                      </span>
                    </p>
                  </div>
                </div>

                {canManage(work) ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                    <button type="button" onClick={() => { setFormError(""); setModal({ mode: "edit", work }); }} className={ACTION}>
                      <Pencil className="size-3.5" aria-hidden="true" />
                      Edit
                    </button>
                    <button type="button" onClick={() => { setDeleteError(""); setDeleteTarget(work); }} className={ACTION_DANGER}>
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Delete
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <WorkModal
        open={Boolean(modal)}
        mode={modal?.mode || "create"}
        users={people}
        initialWork={modal?.work || null}
        onClose={closeModal}
        onSubmit={handleSubmit}
        saving={saving}
        error={formError}
      />

      {deleteTarget ? (
        <ConfirmDelete
          work={deleteTarget}
          busy={deleting}
          error={deleteError}
          onCancel={() => !deleting && setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      ) : null}

      {toast ? (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-neutral-950/85 px-5 py-3 text-sm text-white shadow-lg shadow-black/40 backdrop-blur-xl md:bottom-6"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}