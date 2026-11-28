"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { AlertTriangle, Check, Loader2, Upload, Users, X } from "lucide-react";
import { ASSIGNABLE_ROLES } from "@/lib/config";
import { db } from "@/lib/firebase";

// Each user = 2 writes (user doc + audit log); Firestore allows 500 writes per batch.
const CHUNK_SIZE = 200;

const PRIMARY =
  "!min-h-0 inline-flex items-center justify-center gap-2 whitespace-nowrap !rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60";
const GHOST =
  "!min-h-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap !rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-60";
const INPUT =
  "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-400/30 disabled:cursor-not-allowed disabled:opacity-60 [color-scheme:dark]";
const LABEL = "mb-1.5 block text-sm font-medium text-white/80";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

// Accepts rows pasted from a spreadsheet (tab separated) or CSV text.
// Columns: email, role (optional), designation (optional).
function parseRows(text, { defaultRole, roles, existing, selfEmail }) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const seen = new Set();
  const rows = [];

  lines.forEach((line, index) => {
    const cells = (line.includes("\t") ? line.split("\t") : line.split(","))
      .map((cell) => cell.trim().replace(/^"+|"+$/g, "").trim());
    const [rawEmail = "", rawRole = "", ...rest] = cells;

    // Skip a header row like "Email  Role  Designation"
    if (index === 0 && /^e-?mail/i.test(rawEmail)) return;

    const email = normalizeEmail(rawEmail);
    const roleText = rawRole.trim().toLowerCase();
    const role = roleText || defaultRole;
    const designation = rest.filter(Boolean).join(", ").trim();

    let status = "ready";
    let note = "";

    if (!EMAIL_PATTERN.test(email)) {
      status = "invalid";
      note = "Invalid email";
    } else if (email === selfEmail) {
      status = "skip";
      note = "Your account";
    } else if (existing.has(email)) {
      status = "skip";
      note = "Already added";
    } else if (seen.has(email)) {
      status = "skip";
      note = "Duplicate in list";
    } else if (!roles.includes(role)) {
      status = "invalid";
      note = `Unknown role "${rawRole}"`;
    }

    if (EMAIL_PATTERN.test(email)) seen.add(email);
    rows.push({ key: `${index}-${email}`, email: email || rawEmail, role, designation, status, note });
  });

  return rows;
}

function StatusChip({ status, note }) {
  const styles =
    status === "ready"
      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
      : status === "skip"
        ? "border-white/15 bg-white/10 text-white/60"
        : "border-red-300/30 bg-red-400/10 text-red-200";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${styles}`}>
      {status === "ready" ? <Check className="size-3" strokeWidth={3} aria-hidden="true" /> : null}
      {status === "ready" ? "Ready" : note}
    </span>
  );
}

export default function BulkAddUsersModal({ open, onClose, existingEmails, currentUserEmail, onDone }) {
  const [text, setText] = useState("");
  const [defaultRole, setDefaultRole] = useState("member");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setText("");
    setDefaultRole(ASSIGNABLE_ROLES.includes("member") ? "member" : ASSIGNABLE_ROLES[0]);
    setSaving(false);
    setProgress(0);
    setError("");
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  const rows = useMemo(
    () =>
      parseRows(text, {
        defaultRole,
        roles: ASSIGNABLE_ROLES,
        existing: existingEmails,
        selfEmail: currentUserEmail,
      }),
    [text, defaultRole, existingEmails, currentUserEmail],
  );

  const ready = useMemo(() => rows.filter((row) => row.status === "ready"), [rows]);
  const skipped = rows.filter((row) => row.status === "skip").length;
  const invalid = rows.filter((row) => row.status === "invalid").length;

  function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ""));
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsText(file);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (ready.length === 0 || saving) return;

    setSaving(true);
    setError("");
    setProgress(0);
    let added = 0;

    try {
      for (let start = 0; start < ready.length; start += CHUNK_SIZE) {
        const chunk = ready.slice(start, start + CHUNK_SIZE);
        const batch = writeBatch(db);

        chunk.forEach((row) => {
          batch.set(
            doc(db, "users", row.email),
            {
              email: row.email,
              role: row.role,
              active: true,
              addedAt: serverTimestamp(),
              ...(row.designation ? { designation: row.designation } : {}),
            },
            { merge: true },
          );
          batch.set(doc(collection(db, "auditLogs")), {
            action: "user_added",
            targetEmail: row.email,
            targetName: "",
            actorEmail: currentUserEmail,
            changes: {
              role: { from: "", to: row.role },
              designation: { from: "", to: row.designation },
              active: { from: "", to: true },
            },
            timestamp: serverTimestamp(),
          });
        });

        await batch.commit();
        added += chunk.length;
        setProgress(added);
      }
      onDone?.(added);
      onClose();
    } catch (saveError) {
      console.error("Bulk add users:", saveError?.code, saveError?.message);
      setError(
        `${added > 0 ? `${added} added, then it stopped. ` : ""}Could not add the users (${saveError?.code || "unknown"}). ${
          added > 0 ? "Paste the list again: users already added are skipped." : ""
        }`.trim(),
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-users-title"
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-neutral-950/90 text-white shadow-2xl shadow-black/60 backdrop-blur-2xl sm:max-h-[88vh] sm:rounded-3xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-violet-500/20 text-violet-100">
              <Users className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="bulk-users-title" className="text-xl font-semibold tracking-tight">Add users in bulk</h2>
              <p className="mt-0.5 text-sm text-white/50">Paste rows from a sheet: email, role, designation.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="!min-h-0 flex size-9 shrink-0 items-center justify-center !rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto border-t border-white/10 px-5 py-5 sm:px-6">
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label htmlFor="bulk-users-text" className="text-sm font-medium text-white/80">Users</label>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={saving}
                  className="!min-h-0 inline-flex items-center gap-1.5 !rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50"
                >
                  <Upload className="size-3.5" aria-hidden="true" />
                  Upload CSV
                </button>
                <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" onChange={handleFile} className="hidden" />
              </div>
              <textarea
                id="bulk-users-text"
                rows={6}
                autoFocus
                value={text}
                onChange={(event) => setText(event.target.value)}
                disabled={saving}
                placeholder={"name@karunya.edu.in\tmember\tEvent Team\nname2@karunya.edu.in\tmember\tMedia Team"}
                className={`${INPUT} resize-y font-mono text-xs leading-relaxed`}
                spellCheck={false}
              />
              <p className="mt-1.5 text-xs text-white/40">
                Copy the rows straight from Excel or Google Sheets, or use comma separated text. A header row is ignored.
              </p>
            </div>

            <div className="max-w-[12rem]">
              <label htmlFor="bulk-users-role" className={LABEL}>Role when a row has none</label>
              <select
                id="bulk-users-role"
                value={defaultRole}
                onChange={(event) => setDefaultRole(event.target.value)}
                disabled={saving}
                className={`${INPUT} capitalize`}
              >
                {ASSIGNABLE_ROLES.map((item) => (
                  <option key={item} value={item} className="bg-neutral-900 capitalize text-white">{item}</option>
                ))}
              </select>
            </div>

            {rows.length > 0 ? (
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <span className="font-semibold text-emerald-200">{ready.length} ready</span>
                  {skipped > 0 ? <span className="text-white/55">{skipped} skipped</span> : null}
                  {invalid > 0 ? <span className="text-red-200">{invalid} need fixing</span> : null}
                </div>
                <ul className="max-h-64 divide-y divide-white/10 overflow-y-auto rounded-xl border border-white/10 bg-black/25">
                  {rows.map((row) => (
                    <li key={row.key} className="flex items-center gap-3 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-white/90">{row.email}</p>
                        <p className="truncate text-[11px] capitalize text-white/40">
                          {row.role}{row.designation ? ` · ${row.designation}` : ""}
                        </p>
                      </div>
                      <StatusChip status={row.status} note={row.note} />
                    </li>
                  ))}
                </ul>
                {skipped > 0 ? (
                  <p className="mt-2 text-xs text-white/40">Skipped rows are left untouched, so existing users keep their current role.</p>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-200" aria-hidden="true" />
                <span className="min-w-0 break-words">{error}</span>
              </p>
            ) : null}
          </div>

          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 bg-neutral-950/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-5">
            <p className="text-xs text-white/50" aria-live="polite">
              {saving ? `Adding ${progress} of ${ready.length}…` : ""}
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} disabled={saving} className={GHOST}>Cancel</button>
              <button type="submit" disabled={saving || ready.length === 0} className={PRIMARY}>
                {saving ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
                {saving ? "Adding…" : ready.length > 0 ? `Add ${ready.length} ${ready.length === 1 ? "user" : "users"}` : "Add users"}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}