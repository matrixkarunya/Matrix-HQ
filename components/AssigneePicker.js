"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

const INPUT =
  "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-400/30 disabled:cursor-not-allowed disabled:opacity-60 [color-scheme:dark]";

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export default function AssigneePicker({ users, value = [], onChange, label = "Select people" }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const selectedSet = useMemo(
    () => new Set((value || []).map((email) => normalizeEmail(email))),
    [value],
  );

  useEffect(() => {
    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((person) => {
      const email = normalizeEmail(person?.email);
      const fullName = String(person?.fullName || "").trim().toLowerCase();
      if (!query) return true;
      return fullName.includes(query) || email.includes(query);
    });
  }, [search, users]);

  function togglePerson(person) {
    const email = normalizeEmail(person?.email);
    if (!email) return;

    const nextValue = selectedSet.has(email)
      ? (value || []).filter((currentEmail) => normalizeEmail(currentEmail) !== email)
      : [...(value || []), email];

    onChange(nextValue);
  }

  function removePerson(email) {
    onChange((value || []).filter((currentEmail) => normalizeEmail(currentEmail) !== normalizeEmail(email)));
  }

  const selectedPeople = (value || []).map((email) => {
    const normalized = normalizeEmail(email);
    const match = users.find((person) => normalizeEmail(person?.email) === normalized);
    return {
      email: normalized,
      label: match?.fullName?.trim() || match?.email || normalized,
    };
  });

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="true"
        aria-expanded={open}
        className="!min-h-0 flex w-full items-center justify-between gap-3 !rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-left text-sm text-white transition hover:bg-white/10 focus:border-violet-300/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
      >
        <span className={`min-w-0 truncate ${value && value.length > 0 ? "text-white" : "text-white/50"}`}>
          {value && value.length > 0 ? `${value.length} selected` : label}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-white/50 transition duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {selectedPeople.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedPeople.map((person) => (
            <span
              key={person.email}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-violet-300/30 bg-violet-500/15 py-1 pl-3 pr-1.5 text-xs text-violet-100"
            >
              <span className="min-w-0 truncate">{person.label}</span>
              <button
                type="button"
                onClick={() => removePerson(person.email)}
                className="!min-h-0 flex size-5 shrink-0 items-center justify-center !rounded-full text-violet-200/70 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                aria-label={`Remove ${person.label}`}
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {open ? (
        <div className="absolute left-0 right-0 z-20 mt-2 rounded-2xl border border-white/10 bg-neutral-950/95 p-3 shadow-2xl shadow-black/60 backdrop-blur-2xl">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email"
              aria-label="Search people by name or email"
              autoFocus
              className={`${INPUT} !py-2 !pl-9 !pr-3`}
            />
          </div>

          <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {users.length === 0 ? (
              <div className="space-y-1.5" aria-busy="true">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-12 animate-pulse rounded-xl border border-white/10 bg-white/[0.06]" />
                ))}
                <span className="sr-only">Loading people</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="px-1 py-2 text-sm text-white/50">No matches.</p>
            ) : (
              filteredUsers.map((person) => {
                const email = normalizeEmail(person?.email);
                const isChecked = selectedSet.has(email);
                const displayName = String(person?.fullName || "").trim() || person?.email || email;

                return (
                  <label
                    key={person.id || email}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition duration-200 focus-within:ring-2 focus-within:ring-violet-300/50 ${
                      isChecked
                        ? "border-violet-300/30 bg-violet-500/15"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.08]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => togglePerson(person)}
                      className="size-4 shrink-0 cursor-pointer rounded accent-violet-400"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{displayName}</span>
                      <span className="block truncate text-[11px] text-white/50">
                        {person?.email || email} · {person?.role || "user"}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}