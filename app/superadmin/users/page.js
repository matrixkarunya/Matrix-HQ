"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Pencil,
  Plus,
  Search,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { useAuth } from "@/context/AuthContext";
import { ASSIGNABLE_ROLES } from "@/lib/config";
import { db } from "@/lib/firebase";

const PAGE_SIZE = 15;

const GLASS =
  "rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20 backdrop-blur-xl";

const PRIMARY =
  "!min-h-0 inline-flex items-center justify-center gap-2 whitespace-nowrap !rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60";
const GHOST =
  "!min-h-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap !rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-60";
const DESTRUCTIVE =
  "!min-h-0 inline-flex items-center justify-center gap-2 whitespace-nowrap !rounded-full bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60";
const ICON_BTN =
  "!min-h-0 flex size-9 shrink-0 items-center justify-center !rounded-full border border-white/15 bg-white/5 text-white/75 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50";
const ICON_BTN_DANGER =
  "!min-h-0 flex size-9 shrink-0 items-center justify-center !rounded-full border border-red-300/25 bg-red-400/10 text-red-200 transition hover:bg-red-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300/60";
const INPUT =
  "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-400/30 disabled:cursor-not-allowed disabled:opacity-60 [color-scheme:dark]";
const LABEL = "mb-1.5 block text-sm font-medium text-white/80";
const EYEBROW = "text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80";
const ERROR_BANNER =
  "rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100";

// Shared column template so the header and rows line up on desktop
const COLS = "md:grid md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.4fr)_7rem_6rem] md:items-center md:gap-4";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "pending", label: "Pending" },
  { id: "inactive", label: "Inactive" },
];

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getStatus(user) {
  if (user?.active === false) return "inactive";
  if (user?.role === "superadmin" || user?.profileCompleted === true) return "active";
  return "pending";
}

function initials(user) {
  const source = (user?.fullName || "").trim() || (user?.email || "").trim();
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts.length > 1 ? parts[1][0] : "")).toUpperCase();
}

function StatusBadge({ status }) {
  const styles =
    status === "active"
      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
      : status === "pending"
        ? "border-amber-300/30 bg-amber-400/10 text-amber-200"
        : "border-white/15 bg-white/10 text-white/70";
  const text = status === "inactive" ? "Inactive" : status === "active" ? "Active" : "Pending";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${styles}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {text}
    </span>
  );
}

function RoleChip({ role }) {
  const elevated = role === "admin" || role === "superadmin";
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
        elevated
          ? "border-violet-300/30 bg-violet-500/15 text-violet-100"
          : "border-white/10 bg-white/5 text-white/70"
      }`}
    >
      {role}
    </span>
  );
}

function ModalShell({ labelledBy, onBackdrop, maxWidth = "max-w-md", children }) {
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

function ManageUsers() {
  const { user, role: currentRole, loading } = useAuth();
  const currentUserEmail = normalizeEmail(user?.email);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [designation, setDesignation] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [editUser, setEditUser] = useState(null);
  const [editRole, setEditRole] = useState("member");
  const [editDesignation, setEditDesignation] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [inactiveUser, setInactiveUser] = useState(null);
  const [inactiveReason, setInactiveReason] = useState("");
  const [inactiveError, setInactiveError] = useState("");
  const [inactiveSaving, setInactiveSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const toastTimer = useRef(null);

  useEffect(() => {
    if (loading || !user || currentRole !== "superadmin") {
      setUsers([]);
      setUsersLoading(false);
      setUsersError("");
      return undefined;
    }

    setUsersError("");
    const unsubscribe = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const nextUsers = snapshot.docs
          .map((userDocument) => userDocument.data())
          .sort((first, second) => first.email.localeCompare(second.email));
        setUsers(nextUsers);
        setUsersLoading(false);
      },
      (error) => {
        console.error("Manage users listener:", error.code, error.message);
        setUsers([]);
        setUsersLoading(false);
        setUsersError(`Could not load users (${error.code || "unknown"}).`);
      },
    );

    return () => unsubscribe();
  }, [currentRole, loading, user]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Back to the first page whenever the view changes
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, roleFilter]);

  const roleOptions = useMemo(
    () => ["all", ...new Set(["superadmin", ...ASSIGNABLE_ROLES])],
    [],
  );

  const counts = useMemo(() => {
    const result = { all: users.length, active: 0, pending: 0, inactive: 0 };
    users.forEach((listedUser) => {
      result[getStatus(listedUser)] += 1;
    });
    return result;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((listedUser) => {
      if (statusFilter !== "all" && getStatus(listedUser) !== statusFilter) return false;
      if (roleFilter !== "all" && listedUser.role !== roleFilter) return false;
      if (!query) return true;
      return [listedUser.fullName, listedUser.email, listedUser.designation, listedUser.role]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(query));
    });
  }, [roleFilter, search, statusFilter, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedUsers = filteredUsers.slice(pageStart, pageStart + PAGE_SIZE);

  function openModal() {
    setEmail("");
    setRole("member");
    setDesignation("");
    setFormError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setFormError("");
  }

  function openEditModal(listedUser) {
    setEditUser(listedUser);
    setEditRole(listedUser.role === "superadmin" ? "member" : listedUser.role);
    setEditDesignation(listedUser.designation?.trim() || "");
    setEditReason("");
    setEditError("");
  }

  function closeEditModal() {
    if (editSaving) return;
    setEditUser(null);
    setEditRole("member");
    setEditDesignation("");
    setEditReason("");
    setEditError("");
  }

  function openInactiveModal(listedUser) {
    setInactiveUser(listedUser);
    setInactiveReason("");
    setInactiveError("");
  }

  function closeInactiveModal() {
    if (inactiveSaving) return;
    setInactiveUser(null);
    setInactiveReason("");
    setInactiveError("");
  }

  async function handleAddUser(event) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedDesignation = designation.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setFormError("Enter a valid email address.");
      return;
    }

    if (normalizedEmail === currentUserEmail) {
      setFormError("This is the superadmin account.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const batch = writeBatch(db);
      const userDocRef = doc(db, "users", normalizedEmail);

      batch.set(
        userDocRef,
        {
          email: normalizedEmail,
          role,
          active: true,
          addedAt: serverTimestamp(),
          ...(normalizedDesignation ? { designation: normalizedDesignation } : {}),
        },
        { merge: true },
      );

      batch.set(doc(collection(db, "auditLogs")), {
        action: "user_added",
        targetEmail: normalizedEmail,
        targetName: "",
        actorEmail: currentUserEmail,
        changes: {
          role: { from: "", to: role },
          designation: { from: "", to: normalizedDesignation },
          active: { from: "", to: true },
        },
        timestamp: serverTimestamp(),
      });

      await batch.commit();
      setModalOpen(false);
      setEmail("");
      setRole("member");
      setDesignation("");
      setToast("User added");
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(""), 2500);
    } catch (error) {
      console.error("Add user:", error?.code, error?.message);
      setFormError(`Could not add the user (${error?.code || "unknown"}).`);
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave(event) {
    event.preventDefault();
    if (!editUser) return;

    const targetEmail = normalizeEmail(editUser.email);
    const nextRole = editRole.trim();
    const nextDesignation = editDesignation.trim();
    const originalRole = editUser.role || "member";
    const originalDesignation = (editUser.designation || "").trim();
    const designationEditable = editUser.active !== false;
    const reason = editReason.trim();

    const hasRoleChange = originalRole !== nextRole;
    const hasDesignationChange = designationEditable && originalDesignation !== nextDesignation;
    if (!hasRoleChange && !hasDesignationChange) {
      setEditError("No changes to save.");
      return;
    }

    setEditSaving(true);
    setEditError("");

    try {
      const batch = writeBatch(db);
      const userDocRef = doc(db, "users", targetEmail);
      const userUpdate = {};

      if (hasRoleChange) {
        userUpdate.role = nextRole;
      }
      if (hasDesignationChange) {
        userUpdate.designation = nextDesignation;
      }

      if (Object.keys(userUpdate).length > 0) {
        batch.update(userDocRef, userUpdate);
      }

      if (hasRoleChange) {
        batch.set(doc(collection(db, "auditLogs")), {
          action: "role_changed",
          targetEmail,
          targetName: editUser.fullName || "",
          actorEmail: currentUserEmail,
          changes: {
            role: { from: originalRole, to: nextRole },
          },
          ...(reason ? { reason } : {}),
          timestamp: serverTimestamp(),
        });
      }

      if (hasDesignationChange) {
        batch.set(doc(collection(db, "auditLogs")), {
          action: "designation_changed",
          targetEmail,
          targetName: editUser.fullName || "",
          actorEmail: currentUserEmail,
          changes: {
            designation: { from: originalDesignation, to: nextDesignation },
          },
          ...(reason ? { reason } : {}),
          timestamp: serverTimestamp(),
        });
      }

      await batch.commit();
      setToast("User updated");
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(""), 2500);
      closeEditModal();
    } catch (error) {
      console.error(error);
      setEditError(`Could not save changes (${error?.code || "unknown"}).`);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleInactiveToggle() {
    if (!inactiveUser) return;

    const targetEmail = normalizeEmail(inactiveUser.email);
    const isInactive = inactiveUser.active === false;
    const reason = inactiveReason.trim();

    setInactiveSaving(true);
    setInactiveError("");

    try {
      const batch = writeBatch(db);
      const userDocRef = doc(db, "users", targetEmail);

      const nextUserState = isInactive
        ? { active: true, reactivatedAt: serverTimestamp() }
        : {
            active: false,
            inactiveAt: serverTimestamp(),
            inactiveBy: currentUserEmail,
          };

      batch.update(userDocRef, nextUserState);
      batch.set(doc(collection(db, "auditLogs")), {
        action: isInactive ? "reactivated" : "deactivated",
        targetEmail,
        targetName: inactiveUser.fullName || "",
        actorEmail: currentUserEmail,
        changes: {
          active: { from: isInactive ? false : true, to: isInactive ? true : false },
        },
        ...(reason ? { reason } : {}),
        timestamp: serverTimestamp(),
      });

      await batch.commit();
      setToast(isInactive ? "User reactivated" : "User marked inactive");
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(""), 2500);
      closeInactiveModal();
    } catch (error) {
      console.error(error);
      setInactiveError(`Could not update the user status (${error?.code || "unknown"}).`);
    } finally {
      setInactiveSaving(false);
    }
  }

  function renderActions(listedUser, isLocked) {
    if (isLocked) {
      return (
        <span
          title="Protected account"
          className="flex size-9 items-center justify-center text-white/35"
        >
          <Lock className="size-4" aria-hidden="true" />
          <span className="sr-only">Protected account</span>
        </span>
      );
    }
    const inactive = listedUser.active === false;
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => openEditModal(listedUser)}
          aria-label={`Edit ${listedUser.email}`}
          title="Edit"
          className={ICON_BTN}
        >
          <Pencil className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => openInactiveModal(listedUser)}
          aria-label={`${inactive ? "Reactivate" : "Mark inactive"} ${listedUser.email}`}
          title={inactive ? "Reactivate" : "Mark inactive"}
          className={inactive ? ICON_BTN : ICON_BTN_DANGER}
        >
          {inactive ? (
            <UserCheck className="size-4" aria-hidden="true" />
          ) : (
            <UserX className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  }

  const rangeEnd = Math.min(pageStart + PAGE_SIZE, filteredUsers.length);

  return (
    // The shell already renders <main>, so this is a div to avoid nested <main> tags
    <div className="w-full text-white">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className={EYEBROW}>Superadmin</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">Manage users</h1>
          <p className="mt-2 text-sm text-white/50">
            {usersLoading
              ? "Loading people…"
              : `${counts.all} ${counts.all === 1 ? "person" : "people"} · add people, change roles and control access.`}
          </p>
        </div>
        <button type="button" onClick={openModal} className={`${PRIMARY} shrink-0`}>
          <Plus className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Add new user</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {usersError ? (
        <p role="alert" className={`${ERROR_BANNER} mt-4 sm:mt-6`}>
          {usersError}
        </p>
      ) : null}

      {/* Filters */}
<div className="mt-6 space-y-3 lg:space-y-0">
  {/* Mobile and tablet: full-width search, then two dropdowns */}
  <div className="space-y-3 lg:hidden">
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/40"
        aria-hidden="true"
      />
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search name, email or role"
        aria-label="Search users"
        className={`${INPUT} !rounded-full !pl-10`}
      />
    </div>
    <div className="grid grid-cols-2 gap-2">
      <select
        value={statusFilter}
        onChange={(event) => setStatusFilter(event.target.value)}
        aria-label="Filter by status"
        className={`${INPUT} !rounded-full`}
      >
        {FILTERS.map((item) => (
          <option key={item.id} value={item.id} className="bg-neutral-900 text-white">
            {item.id === "all" ? "All status" : item.label} ({counts[item.id]})
          </option>
        ))}
      </select>
      <select
        value={roleFilter}
        onChange={(event) => setRoleFilter(event.target.value)}
        aria-label="Filter by role"
        className={`${INPUT} !rounded-full capitalize`}
      >
        {roleOptions.map((option) => (
          <option key={option} value={option} className="bg-neutral-900 capitalize text-white">
            {option === "all" ? "All roles" : option}
          </option>
        ))}
      </select>
    </div>
  </div>

  {/* Desktop: status tabs on the left, search and role on the right */}
  <div className="hidden items-center justify-between gap-3 lg:flex">
    <div
      role="tablist"
      aria-label="Filter users by status"
      className="flex w-fit items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-md"
    >
      {FILTERS.map((item) => {
        const selected = statusFilter === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => setStatusFilter(item.id)}
            className={`!min-h-0 flex items-center justify-center gap-2 whitespace-nowrap !rounded-full px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
              selected ? "bg-white/15 text-white" : "text-white/55 hover:text-white"
            }`}
          >
            {item.label}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                selected ? "bg-white/20 text-white" : "bg-white/10 text-white/60"
              }`}
            >
              {counts[item.id]}
            </span>
          </button>
        );
      })}
    </div>

    <div className="flex gap-2">
      <div className="relative w-64">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/40"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, email or role"
          aria-label="Search users"
          className={`${INPUT} !rounded-full !pl-10`}
        />
      </div>
      <select
        value={roleFilter}
        onChange={(event) => setRoleFilter(event.target.value)}
        aria-label="Filter by role"
        className={`${INPUT} !w-auto shrink-0 !rounded-full capitalize`}
      >
        {roleOptions.map((option) => (
          <option key={option} value={option} className="bg-neutral-900 capitalize text-white">
            {option === "all" ? "All roles" : option}
          </option>
        ))}
      </select>
    </div>
  </div>
</div>
      <div className="mt-4 sm:mt-6">
        {usersLoading ? (
          <div className={`${GLASS} divide-y divide-white/10`} aria-busy="true">
            {Array.from({ length: 8 }).map((_, item) => (
              <div key={item} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <div className="size-9 animate-pulse rounded-xl bg-white/10" />
                <div className="h-4 w-1/3 animate-pulse rounded-full bg-white/10" />
                <div className="ml-auto h-6 w-16 animate-pulse rounded-full bg-white/10" />
              </div>
            ))}
            <span className="sr-only">Loading users</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className={`${GLASS} flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center`}>
            <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/40">
              <Users className="size-6" aria-hidden="true" />
            </div>
            <p className="text-sm text-white/40">
              {users.length === 0
                ? "No users yet. Add the first one with the button above."
                : "No users match this view."}
            </p>
          </div>
        ) : (
          <section className={`${GLASS} overflow-hidden`}>
            {/* Column header (desktop only) */}
            <div
              className={`hidden border-b border-white/10 px-5 py-3 text-xs font-medium uppercase tracking-[.14em] text-white/45 ${COLS}`}
              aria-hidden="true"
            >
              <span>User</span>
              <span>Role</span>
              <span>Designation</span>
              <span>Status</span>
              <span>Actions</span>
            </div>

            <ul className="divide-y divide-white/10">
              {pagedUsers.map((listedUser) => {
                const status = getStatus(listedUser);
                const isLocked =
                  listedUser.role === "superadmin" ||
                  normalizeEmail(listedUser.email) === currentUserEmail;
                const title = (listedUser.fullName || "").trim() || listedUser.email;
                const designationText = listedUser.designation?.trim();

                return (
                  <li
                    key={listedUser.email}
                    className={`flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.05] sm:px-5 ${COLS} ${
                      status === "inactive" ? "opacity-75" : ""
                    }`}
                  >
                    {/* User */}
                    <div className="flex min-w-0 flex-1 items-center gap-3 md:flex-none">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-violet-500/15 text-xs font-semibold text-violet-100">
                        {initials(listedUser)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{title}</p>
                        <p className="truncate text-xs text-white/50">
                          {title !== listedUser.email ? listedUser.email : "No name yet"}
                        </p>
                        {/* Mobile meta line */}
                        <p className="mt-0.5 truncate text-[11px] capitalize text-white/40 md:hidden">
                          {listedUser.role}
                          {designationText ? ` · ${designationText}` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Role */}
                    <div className="hidden md:block">
                      <RoleChip role={listedUser.role} />
                    </div>

                    {/* Designation */}
                    <p className="hidden truncate text-sm text-white/70 md:block">
                      {designationText || <span className="text-white/35">—</span>}
                    </p>

                    {/* Status */}
                    <div className="shrink-0">
                      <StatusBadge status={status} />
                    </div>

                    {/* Actions */}
                    <div className="shrink-0">{renderActions(listedUser, isLocked)}</div>
                  </li>
                );
              })}
            </ul>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 sm:px-5">
              <p className="text-xs text-white/50">
                Showing {pageStart + 1}–{rangeEnd} of {filteredUsers.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage <= 1}
                  aria-label="Previous page"
                  className={GHOST}
                >
                  <ChevronLeft className="size-3.5" aria-hidden="true" />
                  Prev
                </button>
                <span className="px-1 text-xs text-white/60">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= totalPages}
                  aria-label="Next page"
                  className={GHOST}
                >
                  Next
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>
        )}
      </div>

      {toast ? (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-neutral-950/85 px-5 py-3 text-sm text-white shadow-lg shadow-black/40 backdrop-blur-xl md:bottom-6"
        >
          {toast}
        </div>
      ) : null}

      {modalOpen ? (
        <ModalShell labelledBy="add-user-title" onBackdrop={closeModal} maxWidth="max-w-md">
          <p className={EYEBROW}>Users</p>
          <h2 id="add-user-title" className="mt-2 text-2xl font-semibold">
            Add new user
          </h2>
          <form onSubmit={handleAddUser} noValidate>
            <div className="mt-5">
              <label htmlFor="user-email" className={LABEL}>
                Email
              </label>
              <input
                id="user-email"
                type="email"
                placeholder="name@gmail.com"
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={INPUT}
              />
            </div>
            <div className="mt-4">
              <label htmlFor="user-role" className={LABEL}>
                Role
              </label>
              <select
                id="user-role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className={INPUT}
              >
                {ASSIGNABLE_ROLES.map((assignableRole) => (
                  <option key={assignableRole} value={assignableRole} className="bg-neutral-900 text-white">
                    {assignableRole}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4">
              <label htmlFor="user-designation" className={LABEL}>
                Designation
              </label>
              <input
                id="user-designation"
                type="text"
                placeholder="Technical Lead"
                value={designation}
                onChange={(event) => setDesignation(event.target.value)}
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
                {saving ? "Adding…" : "Add"}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {editUser ? (
        <ModalShell labelledBy="edit-user-title" onBackdrop={closeEditModal} maxWidth="max-w-md">
          <p className={EYEBROW}>Users</p>
          <h2 id="edit-user-title" className="mt-2 text-2xl font-semibold">
            Edit user
          </h2>
          <form onSubmit={handleEditSave} noValidate>
            <div className="mt-5">
              <label htmlFor="edit-user-email" className={LABEL}>
                Email
              </label>
              <input
                id="edit-user-email"
                type="email"
                value={editUser.email}
                readOnly
                className={`${INPUT} cursor-not-allowed text-white/60`}
              />
            </div>

            <div className="mt-4">
              <label htmlFor="edit-user-role" className={LABEL}>
                Role
              </label>
              <select
                id="edit-user-role"
                value={editRole}
                onChange={(event) => setEditRole(event.target.value)}
                className={INPUT}
              >
                {ASSIGNABLE_ROLES.map((assignableRole) => (
                  <option key={assignableRole} value={assignableRole} className="bg-neutral-900 text-white">
                    {assignableRole}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label htmlFor="edit-user-designation" className={LABEL}>
                Designation
              </label>
              <input
                id="edit-user-designation"
                type="text"
                value={editDesignation}
                onChange={(event) => setEditDesignation(event.target.value)}
                disabled={editUser.active === false}
                className={INPUT}
              />
            </div>

            <div className="mt-4">
              <label htmlFor="edit-user-reason" className={LABEL}>
                Reason / note
              </label>
              <textarea
                id="edit-user-reason"
                rows={3}
                value={editReason}
                onChange={(event) => setEditReason(event.target.value)}
                placeholder="Optional note"
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
              <button
                type="submit"
                disabled={editSaving || (!((editUser.role || "member") !== editRole) && !(editUser.active !== false && (editUser.designation || "").trim() !== editDesignation.trim()))}
                className={PRIMARY}
              >
                {editSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {inactiveUser ? (
        <ModalShell labelledBy="inactive-user-title" onBackdrop={closeInactiveModal} maxWidth="max-w-md">
          <p className={EYEBROW}>Users</p>
          <h2 id="inactive-user-title" className="mt-2 text-2xl font-semibold">
            {inactiveUser.active === false ? "Reactivate user" : "Mark user inactive"}
          </h2>
          <p className="mt-2 text-sm text-white/60">
            {inactiveUser.active === false
              ? "This will restore access for this account."
              : "This will block sign-in until the user is reactivated."}
          </p>
          <div className="mt-5">
            <label htmlFor="inactive-user-reason" className={LABEL}>
              Reason / note
            </label>
            <textarea
              id="inactive-user-reason"
              rows={3}
              value={inactiveReason}
              onChange={(event) => setInactiveReason(event.target.value)}
              placeholder="Optional reason"
              className={INPUT}
            />
          </div>

          {inactiveError ? (
            <p role="alert" className={`${ERROR_BANNER} mt-4`}>
              {inactiveError}
            </p>
          ) : null}

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={closeInactiveModal} disabled={inactiveSaving} className={GHOST}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleInactiveToggle}
              disabled={inactiveSaving}
              className={inactiveUser.active === false ? PRIMARY : DESTRUCTIVE}
            >
              {inactiveSaving
                ? inactiveUser.active === false
                  ? "Reactivating…"
                  : "Updating…"
                : inactiveUser.active === false
                  ? "Reactivate"
                  : "Confirm"}
            </button>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}

export default function ManageUsersPage() {
  return (
    <RoleGuard allow={["superadmin"]}>
      <ManageUsers />
    </RoleGuard>
  );
}