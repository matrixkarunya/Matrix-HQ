"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, CalendarRange, Loader2, RotateCcw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSemester } from "@/context/SemesterContext";
import {
  SEMESTER_TYPES,
  isValidAcademicYear,
  normalizeAcademicYear,
  reactivateSemester,
  semesterLabel,
  startSemester,
} from "@/lib/semesters";

const GLASS = "rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20 backdrop-blur-xl";
const EYEBROW = "text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80";
const PRIMARY =
  "!min-h-0 inline-flex items-center justify-center gap-2 whitespace-nowrap !rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60";
const GHOST =
  "!min-h-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap !rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-60";
const INPUT =
  "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-400/30 disabled:cursor-not-allowed disabled:opacity-60 [color-scheme:dark]";
const LABEL = "mb-1.5 block text-sm font-medium text-white/80";
const ERROR_BANNER = "rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100 backdrop-blur-md";
const BACK_LINK =
  "group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-white/70 backdrop-blur-md transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50";

function formatStamp(value) {
  const date = typeof value?.toDate === "function" ? value.toDate() : null;
  return date ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

function ConfirmModal({ title, children, confirmLabel, busy, error, onCancel, onConfirm }) {
  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="semester-confirm-title"
        className="w-full max-w-md rounded-t-3xl border border-white/10 bg-neutral-950/85 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white shadow-2xl shadow-black/60 backdrop-blur-2xl sm:rounded-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-400/10 text-amber-200">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className={EYEBROW}>Confirm</p>
            <h2 id="semester-confirm-title" className="mt-1.5 text-2xl font-semibold">{title}</h2>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm text-white/60">{children}</div>
        {error ? <p role="alert" className={`${ERROR_BANNER} mt-4`}>{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={busy} className={`${GHOST} !px-5 !py-2.5 !text-sm`}>Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy} className={PRIMARY}>
            {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function SemesterManager() {
  const { user } = useAuth();
  const { semesters, activeSemester, loading, error: loadError } = useSemester();
  const email = String(user?.email || "").trim().toLowerCase();
  const [type, setType] = useState("odd");
  const [year, setYear] = useState("");
  const [formError, setFormError] = useState("");
  const [confirm, setConfirm] = useState(null); // { kind: "start" } | { kind: "reactivate", target }
  const [busy, setBusy] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  }

  function requestStart(event) {
    event.preventDefault();
    const cleaned = normalizeAcademicYear(year);
    if (!isValidAcademicYear(cleaned)) {
      setFormError("Use the format 24-25 (the second year must follow the first).");
      return;
    }
    if (semesters.some((item) => item.id === `${cleaned}-${type}`)) {
      setFormError("This semester already exists. Reactivate it from the history below.");
      return;
    }
    setFormError("");
    setConfirmError("");
    setConfirm({ kind: "start" });
  }

  async function runConfirm() {
    if (!confirm) return;
    setBusy(true);
    setConfirmError("");
    try {
      if (confirm.kind === "start") {
        await startSemester({ type, academicYear: year, activeSemester, email });
        setYear("");
        showToast("New semester started");
      } else {
        await reactivateSemester({ target: confirm.target, activeSemester, email });
        showToast("Semester reactivated");
      }
      setConfirm(null);
    } catch (error) {
      console.error("Semester change:", error);
      setConfirmError(error?.code ? `Could not save (${error.code}).` : error?.message || "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const nextLabel = `${type === "even" ? "Even" : "Odd"} ${normalizeAcademicYear(year)}`;

  return (
    <div className="w-full text-white">
      <Link href="/superadmin" className={BACK_LINK}>
        <ArrowLeft className="size-3.5 transition group-hover:-translate-x-0.5" aria-hidden="true" />
        Back to dashboard
      </Link>

      <header className="mb-6 mt-6">
        <p className={EYEBROW}>Settings</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">Semesters</h1>
        <p className="mt-2 text-sm text-white/50">
          Hours are counted per semester. Starting a new semester closes the current one and everything starts from 0.
          Nothing is deleted.
        </p>
      </header>

      {loadError ? <p role="alert" className={`${ERROR_BANNER} mb-4`}>{loadError}</p> : null}

      <section className={`${GLASS} p-5 sm:p-6`} aria-busy={loading ? "true" : undefined}>
        <p className="text-xs font-medium uppercase tracking-[.16em] text-white/50">Active semester</p>
        {loading ? (
          <div className="mt-3 h-9 w-40 animate-pulse rounded-full bg-white/10 motion-reduce:animate-none" />
        ) : activeSemester ? (
          <>
            <p className="mt-2 text-3xl font-bold tracking-tight">{semesterLabel(activeSemester)}</p>
            <p className="mt-1 text-xs text-white/50">Started {formatStamp(activeSemester.startedAt)}</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-amber-200">
            No active semester. Events, meetings and works can't be created until you start one.
          </p>
        )}
      </section>

      <section className={`${GLASS} mt-4 p-5 sm:mt-6 sm:p-6`}>
        <h2 className="text-lg font-semibold sm:text-xl">Start a new semester</h2>
        <form onSubmit={requestStart} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <span className={LABEL}>Semester</span>
            <div role="radiogroup" aria-label="Semester type" className="grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-white/5 p-1">
              {SEMESTER_TYPES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="radio"
                  aria-checked={type === item.value}
                  onClick={() => setType(item.value)}
                  className={`!min-h-0 !rounded-full px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
                    type === item.value ? "bg-white/15 text-white" : "text-white/55 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="semester-year" className={LABEL}>Academic year</label>
            <input
              id="semester-year"
              value={year}
              maxLength={5}
              inputMode="numeric"
              placeholder="24-25"
              onChange={(event) => setYear(event.target.value)}
              className={INPUT}
            />
          </div>
          {formError ? <p role="alert" className={`${ERROR_BANNER} sm:col-span-2`}>{formError}</p> : null}
          <div className="sm:col-span-2 sm:flex sm:justify-end">
            <button type="submit" disabled={loading} className={`${PRIMARY} w-full sm:w-auto`}>
              <CalendarRange className="size-4" aria-hidden="true" />
              Start new semester
            </button>
          </div>
        </form>
      </section>

      <section className={`${GLASS} mt-4 overflow-hidden sm:mt-6`}>
        <div className="border-b border-white/10 px-5 py-3.5 sm:px-6">
          <h2 className="text-lg font-semibold sm:text-xl">History</h2>
        </div>
        {semesters.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-white/45 sm:px-6">No semesters yet.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {semesters.map((semester) => {
              const isActive = semester.id === activeSemester?.id;
              return (
                <li key={semester.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{semesterLabel(semester)}</p>
                    <p className="mt-0.5 truncate text-xs text-white/50">
                      Started {formatStamp(semester.startedAt)}
                      {semester.closedAt && !isActive ? ` · Closed ${formatStamp(semester.closedAt)}` : ""}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                      isActive
                        ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
                        : "border-white/15 bg-white/10 text-white/60"
                    }`}
                  >
                    <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                    {isActive ? "Active" : "Closed"}
                  </span>
                  {!isActive ? (
                    <button
                      type="button"
                      onClick={() => { setConfirmError(""); setConfirm({ kind: "reactivate", target: semester }); }}
                      className={GHOST}
                    >
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">Reactivate</span>
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {confirm?.kind === "start" ? (
        <ConfirmModal
          title={`Start ${nextLabel}?`}
          confirmLabel="Start semester"
          busy={busy}
          error={confirmError}
          onCancel={() => !busy && setConfirm(null)}
          onConfirm={runConfirm}
        >
          {activeSemester ? <p>{semesterLabel(activeSemester)} will be closed.</p> : null}
          <p>Hours and attendance for new records start from 0. Old semesters stay available to view.</p>
        </ConfirmModal>
      ) : null}

      {confirm?.kind === "reactivate" ? (
        <ConfirmModal
          title={`Reactivate ${semesterLabel(confirm.target)}?`}
          confirmLabel="Reactivate"
          busy={busy}
          error={confirmError}
          onCancel={() => !busy && setConfirm(null)}
          onConfirm={runConfirm}
        >
          {activeSemester ? <p>{semesterLabel(activeSemester)} will be closed.</p> : null}
          <p>New events, meetings and works will be counted in this semester again.</p>
        </ConfirmModal>
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