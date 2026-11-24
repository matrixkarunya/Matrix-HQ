"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ImageKitAbortError,
  ImageKitInvalidRequestError,
  ImageKitServerError,
  ImageKitUploadNetworkError,
  upload,
} from "@imagekit/next";
import { Camera, ExternalLink, Lock, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  CURRENT_YEAR_OPTIONS,
  GENDER_OPTIONS,
  HOSTEL_OPTIONS,
  RESIDENCE_OPTIONS,
} from "@/lib/config";
import { db } from "@/lib/firebase";
import {
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth } from "@/lib/firebase";

const GLASS =
  "rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20 backdrop-blur-xl";

const inputClass =
  "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-400/30 disabled:cursor-not-allowed disabled:opacity-60 [color-scheme:dark]";

const ghostButton =
  "!min-h-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap !rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-60";

const primaryButton =
  "!min-h-0 inline-flex items-center justify-center gap-2 whitespace-nowrap !rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60";

const EDITABLE_FIELDS = [
  "fullName",
  "registerNumber",
  "currentYear",
  "whatsappNumber",
  "gender",
  "residence",
  "hostelName",
  "hostelRoomNumber",
  "currentCgpa",
  "linkedinUrl",
  "githubUrl",
  "websiteUrl",
];

const EMPTY_FORM = {
  fullName: "",
  registerNumber: "",
  currentYear: "",
  whatsappNumber: "",
  gender: "",
  residence: "",
  hostelName: "",
  hostelRoomNumber: "",
  currentCgpa: "",
  linkedinUrl: "",
  githubUrl: "",
  websiteUrl: "",
};

function textValue(value) {
  return typeof value === "string" ? value : "";
}

function normalizeUrl(value) {
  return textValue(value).trim();
}

function validateUrl(value) {
  const normalized = normalizeUrl(value);
  if (!normalized) return true;

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function formFromProfile(profile) {
  return {
    fullName: textValue(profile?.fullName),
    registerNumber: textValue(profile?.registerNumber),
    currentYear: textValue(profile?.currentYear),
    whatsappNumber: textValue(profile?.whatsappNumber),
    gender: textValue(profile?.gender),
    residence: textValue(profile?.residence),
    hostelName: textValue(profile?.hostelName),
    hostelRoomNumber: textValue(profile?.hostelRoomNumber),
    currentCgpa: profile?.currentCgpa === null || profile?.currentCgpa === undefined ? "" : String(profile.currentCgpa),
    linkedinUrl: textValue(profile?.linkedinUrl),
    githubUrl: textValue(profile?.githubUrl),
    websiteUrl: textValue(profile?.websiteUrl),
  };
}

function displayValue(value) {
  return textValue(value).trim() || "Not added";
}

function formatRole(role) {
  return textValue(role).replace(/^./, (letter) => letter.toUpperCase());
}

function initials(name, email) {
  const source = textValue(name).trim() || textValue(email).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2)).toUpperCase() || "M";
}

function linkValue(value) {
  const normalized = normalizeUrl(value);
  return normalized && validateUrl(normalized) ? normalized : "";
}

function validateForm(formData) {
  const errors = {};
  const fullName = formData.fullName.trim();
  const registerNumber = formData.registerNumber.trim().toUpperCase();
  const whatsappNumber = formData.whatsappNumber.replace(/\s/g, "");
  const currentCgpa = formData.currentCgpa.trim();

  if (!fullName) errors.fullName = "Full name is required.";
  if (!registerNumber) {
    errors.registerNumber = "Register number is required.";
  } else if (!/^(URK|PRK)\d{2}[A-Z]{2,3}\d{4}$/.test(registerNumber)) {
    errors.registerNumber = "Enter a valid register number.";
  }
  if (!formData.currentYear) errors.currentYear = "Select your current year.";
  if (!whatsappNumber) {
    errors.whatsappNumber = "WhatsApp number is required.";
  } else if (!/^\+?\d{10,15}$/.test(whatsappNumber)) {
    errors.whatsappNumber = "Enter a valid WhatsApp number.";
  }
  if (!formData.gender) errors.gender = "Select your gender.";
  if (!formData.residence) errors.residence = "Select your residence.";

  if (formData.residence === "HOSTEL") {
    if (!formData.hostelName) errors.hostelName = "Select your hostel.";
    if (!formData.hostelRoomNumber.trim()) errors.hostelRoomNumber = "Hostel room number is required.";
  }

  if (currentCgpa) {
    const numericCgpa = Number(currentCgpa);
    if (!Number.isFinite(numericCgpa) || numericCgpa < 0 || numericCgpa > 10) {
      errors.currentCgpa = "CGPA must be between 0 and 10.";
    }
  }

  if (!validateUrl(formData.linkedinUrl)) errors.linkedinUrl = "Enter a valid LinkedIn URL.";
  if (!validateUrl(formData.githubUrl)) errors.githubUrl = "Enter a valid GitHub URL.";
  if (!validateUrl(formData.websiteUrl)) errors.websiteUrl = "Enter a valid website URL.";

  return errors;
}

function normalizeForm(formData) {
  return {
    fullName: formData.fullName.trim(),
    registerNumber: formData.registerNumber.trim().toUpperCase(),
    currentYear: formData.currentYear,
    whatsappNumber: formData.whatsappNumber.replace(/\s/g, ""),
    gender: formData.gender,
    residence: formData.residence,
    hostelName: formData.hostelName.trim(),
    hostelRoomNumber: formData.hostelRoomNumber.trim(),
    currentCgpa: formData.currentCgpa.trim() === "" ? null : Number.parseFloat(formData.currentCgpa.trim()),
    linkedinUrl: normalizeUrl(formData.linkedinUrl),
    githubUrl: normalizeUrl(formData.githubUrl),
    websiteUrl: normalizeUrl(formData.websiteUrl),
  };
}

function createImageFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const size = Math.min(image.naturalWidth, image.naturalHeight);
      const sourceX = (image.naturalWidth - size) / 2;
      const sourceY = (image.naturalHeight - size) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext("2d");
      context.drawImage(image, sourceX, sourceY, size, size, 0, 0, 512, 512);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("The image could not be compressed."));
          return;
        }
        resolve(blob);
      }, "image/jpeg", 0.85);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read the image."));
    };
    image.src = objectUrl;
  });
}

async function hashEmail(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function imageKitErrorMessage(error) {
  if (error instanceof ImageKitAbortError) return "Photo upload was cancelled.";
  if (error instanceof ImageKitInvalidRequestError) return "ImageKit rejected the photo upload.";
  if (error instanceof ImageKitUploadNetworkError) return "Photo upload could not reach ImageKit.";
  if (error instanceof ImageKitServerError) return "ImageKit could not process the photo.";
  return "Could not upload your photo. Try again.";
}

function Section({ title, children }) {
  return (
    <section className={`${GLASS} p-5 sm:p-6`}>
      <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
      <div className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Detail({ label, value, locked = false }) {
  const content = typeof value === "string" || typeof value === "number" ? displayValue(value) : value;

  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-[.14em] text-white/45">{label}</dt>
      <dd className="mt-1.5 flex flex-wrap items-center gap-2 break-words text-sm text-white">
        {content || "Not added"}
        {locked ? (
          <span
            title="Locked"
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/50"
          >
            <Lock className="size-3" />
            Locked
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="block text-sm font-medium text-white/80">
      <span className="mb-1.5 block">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-300">{error}</span> : null}
    </label>
  );
}

function ExternalLinkValue({ href }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1.5 text-sky-300 underline-offset-4 transition hover:text-sky-200 hover:underline"
    >
      <span className="truncate">{href}</span>
      <ExternalLink className="size-3.5 shrink-0" />
    </a>
  );
}

export default function MyProfile() {
  const { user, role, profile, loading } = useAuth();
  const email = textValue(user?.email).trim().toLowerCase();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ type: "", message: "" });
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [photoSaving, setPhotoSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!loading && user && profile) {
      setFormData(formFromProfile(profile));
    }
  }, [loading, profile, user]);

  useEffect(() => {
    if (loading || !user || !email || !db) return undefined;

    const unsubscribe = onSnapshot(
      doc(db, "userPhotos", email),
      (snapshot) => {
        if (!snapshot.exists()) {
          setPhoto(null);
          return;
        }
        const data = snapshot.data();
        setPhoto({
          url: textValue(data?.url),
          fileId: textValue(data?.fileId),
          dataUrl: textValue(data?.dataUrl),
          updatedAt: data?.updatedAt,
        });
      },
      (error) => {
        console.error("Profile photo listener:", error.code, error.message);
        setPhotoError(`Could not load your photo (${error.code || "unknown"}).`);
      },
    );

    return () => unsubscribe();
  }, [email, loading, user]);

  const avatarText = useMemo(() => initials(profile?.fullName, email), [email, profile?.fullName]);
  const photoUrl = photo?.url
    ? `${photo.url}${photo.url.includes("?") ? "&" : "?"}tr=w-256,h-256&updatedAt=${photo.updatedAt?.toMillis?.() || ""}`
    : photo?.dataUrl || "";
  const visiblePhoto = photoPreview || photoUrl;

  function updateField(field, value) {
    setFormData((current) => {
      const next = { ...current, [field]: value };
      if (field === "residence" && value !== "HOSTEL") {
        next.hostelName = "";
        next.hostelRoomNumber = "";
      }
      return next;
    });
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  function startEditing() {
    setFormData(formFromProfile(profile));
    setErrors({});
    setStatus({ type: "", message: "" });
    setEditing(true);
  }

  function cancelEditing() {
    setFormData(formFromProfile(profile));
    setErrors({});
    setStatus({ type: "", message: "" });
    setEditing(false);
  }

  async function saveProfile(event) {
    event.preventDefault();
    const nextErrors = validateForm(formData);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const nextValues = normalizeForm(formData);
    const currentValues = normalizeForm(formFromProfile(profile));
    const changes = {};

    EDITABLE_FIELDS.forEach((field) => {
      if (field === "hostelName" || field === "hostelRoomNumber") return;
      if (nextValues[field] !== currentValues[field]) changes[field] = nextValues[field];
    });

    if (nextValues.residence === "HOSTEL") {
      if (nextValues.hostelName !== currentValues.hostelName) changes.hostelName = nextValues.hostelName;
      if (nextValues.hostelRoomNumber !== currentValues.hostelRoomNumber) changes.hostelRoomNumber = nextValues.hostelRoomNumber;
    } else if (currentValues.residence === "HOSTEL") {
      changes.hostelName = deleteField();
      changes.hostelRoomNumber = deleteField();
    }

    if (Object.keys(changes).length === 0) {
      setStatus({ type: "error", message: "No changes to save" });
      return;
    }

    setSaving(true);
    setStatus({ type: "", message: "" });
    try {
      await updateDoc(doc(db, "users", email), changes);
      setEditing(false);
      setStatus({ type: "success", message: "Profile updated" });
    } catch (error) {
      console.error("Update profile:", error?.code, error?.message);
      setStatus({ type: "error", message: `Could not update your profile (${error?.code || "unknown"}).` });
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setPhotoError("Choose a JPEG or PNG image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Photo must be 5 MB or smaller.");
      return;
    }

    setPhotoError("");
    try {
      const blob = await createImageFile(file);
      setPhotoPreview(URL.createObjectURL(blob));
      setPhoto({ ...photo, pendingFile: blob });
    } catch (error) {
      setPhotoError(error.message);
    }
  }

  async function savePhoto() {
    if (!photo?.pendingFile || !email || !auth?.currentUser) return;
    setPhotoSaving(true);
    setPhotoError("");
    try {
      const idToken = await auth.currentUser.getIdToken();
      const authResponse = await fetch("/api/imagekit-auth", {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      });
      if (!authResponse.ok) throw new Error("Could not authorize photo upload.");
      const authData = await authResponse.json();
      const fileName = `${await hashEmail(email)}.jpg`;
      const result = await upload({
        file: photo.pendingFile,
        fileName,
        folder: "/matrix/profile-photos",
        useUniqueFileName: false,
        overwriteFile: true,
        publicKey: authData.publicKey,
        signature: authData.signature,
        token: authData.token,
        expire: authData.expire,
        onProgress: () => setPhotoError("Uploading photo…"),
      });
      if (!result.url || !result.fileId) throw new Error("ImageKit returned an incomplete photo.");
      await setDoc(doc(db, "userPhotos", email), {
        url: result.url,
        fileId: result.fileId,
        updatedAt: serverTimestamp(),
      });
      setPhotoPreview("");
      setPhoto((current) => ({ url: result.url, fileId: result.fileId, updatedAt: null }));
      setPhotoError("");
    } catch (error) {
      console.error("Save profile photo:", error?.code, error?.message);
      setPhotoError(imageKitErrorMessage(error));
    } finally {
      setPhotoSaving(false);
    }
  }

  async function removePhoto() {
    if (!photoUrl || !email || !auth?.currentUser) return;
    setPhotoSaving(true);
    setPhotoError("");
    try {
      const idToken = await auth.currentUser.getIdToken();
      const deleteResponse = await fetch("/api/imagekit-delete", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      });
      const deleteWarning = !deleteResponse.ok;
      await deleteDoc(doc(db, "userPhotos", email));
      setPhotoPreview("");
      setPhoto(null);
      if (deleteWarning) setPhotoError("Photo removed here, but the hosted copy could not be deleted.");
    } catch (error) {
      console.error("Remove profile photo:", error?.code, error?.message);
      try {
        await deleteDoc(doc(db, "userPhotos", email));
        setPhoto(null);
        setPhotoError("Photo removed here, but the hosted copy could not be deleted.");
      } catch (deleteError) {
        console.error("Remove profile photo document:", deleteError?.code, deleteError?.message);
        setPhotoError("Could not remove your photo. Try again.");
      }
    } finally {
      setPhotoSaving(false);
    }
  }

  if (loading || !user || !profile) {
    return (
      <div className="w-full text-white" aria-busy="true">
        <div className={`${GLASS} h-36 animate-pulse`} />
        <div className={`${GLASS} mt-4 h-56 animate-pulse`} />
      </div>
    );
  }

  const options = (list) =>
    list.map((option) => (
      <option key={option} value={option} className="bg-neutral-900 text-white">
        {option}
      </option>
    ));

  const linkDetail = (label, value) => (
    <Detail
      label={label}
      value={linkValue(value) ? <ExternalLinkValue href={linkValue(value)} /> : "Not added"}
    />
  );

  return (
    // The shell already renders <main>, so this is a div to avoid nested <main> tags
    <div className="w-full text-white">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80">Account</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">My profile</h1>
        </div>
        {!editing ? (
          <button type="button" onClick={startEditing} className={primaryButton}>
            <Pencil className="size-4" />
            Edit profile
          </button>
        ) : null}
      </div>

      {status.message ? (
        <p
          role={status.type === "error" ? "alert" : "status"}
          className={`mt-5 rounded-xl border px-4 py-3 text-sm backdrop-blur-md ${
            status.type === "success"
              ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
              : "border-red-300/20 bg-red-400/10 text-red-100"
          }`}
        >
          {status.message}
        </p>
      ) : null}
      {photoError ? (
        <p role="alert" className="mt-5 rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100 backdrop-blur-md">
          {photoError}
        </p>
      ) : null}

      {/* Identity card */}
      <section className={`${GLASS} mt-6 p-5 sm:p-6`}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {visiblePhoto ? (
            <img
              src={visiblePhoto}
              alt={profile.fullName || "Profile photo"}
              className="size-24 shrink-0 rounded-full border border-white/15 object-cover shadow-lg shadow-black/40"
            />
          ) : (
            <div className="flex size-24 shrink-0 items-center justify-center rounded-full border border-white/15 bg-violet-500/20 text-2xl font-semibold text-violet-100">
              {avatarText}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-2xl font-semibold">{displayValue(profile.fullName)}</h2>
            <p className="mt-1 text-sm text-white/60">{displayValue(profile.designation)}</p>
            <span className="mt-3 inline-flex rounded-full border border-violet-300/30 bg-violet-500/15 px-3 py-1 text-xs font-medium text-violet-100">
              {formatRole(profile.role || role)}
            </span>
          </div>
          {editing ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={photoSaving} className={ghostButton}>
                <Camera className="size-3.5" />
                Change photo
              </button>
              {photoUrl ? (
                <button
                  type="button"
                  onClick={removePhoto}
                  disabled={photoSaving}
                  className={`${ghostButton} !border-red-300/25 !bg-red-400/10 !text-red-200 hover:!bg-red-400/20`}
                >
                  <Trash2 className="size-3.5" />
                  Remove photo
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {editing && photoPreview ? (
          <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
            <button type="button" onClick={savePhoto} disabled={photoSaving} className={primaryButton}>
              {photoSaving ? "Uploading…" : "Save photo"}
            </button>
            <span className="text-xs text-white/50">Preview ready</span>
          </div>
        ) : null}
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={handlePhotoChange} className="hidden" />
      </section>

      {editing ? (
        <form onSubmit={saveProfile} className="mt-4 space-y-4 sm:mt-6 sm:space-y-6" noValidate>
          <Section title="Personal">
            <Field label="Full name" error={errors.fullName}><input value={formData.fullName} onChange={(event) => updateField("fullName", event.target.value)} className={inputClass} /></Field>
            <Field label="Register number" error={errors.registerNumber}><input value={formData.registerNumber} onChange={(event) => updateField("registerNumber", event.target.value)} className={inputClass} /></Field>
            <Field label="Email"><input value={profile.email || email} readOnly disabled className={inputClass} /></Field>
            <Field label="WhatsApp number" error={errors.whatsappNumber}><input value={formData.whatsappNumber} onChange={(event) => updateField("whatsappNumber", event.target.value)} className={inputClass} /></Field>
            <Field label="Gender" error={errors.gender}>
              <select value={formData.gender} onChange={(event) => updateField("gender", event.target.value)} className={inputClass}>
                <option value="" className="bg-neutral-900 text-white">Select gender</option>
                {options(GENDER_OPTIONS)}
                {formData.gender && !GENDER_OPTIONS.includes(formData.gender) ? <option value={formData.gender} className="bg-neutral-900 text-white">{formData.gender}</option> : null}
              </select>
            </Field>
            <Field label="Current year" error={errors.currentYear}>
              <select value={formData.currentYear} onChange={(event) => updateField("currentYear", event.target.value)} className={inputClass}>
                <option value="" className="bg-neutral-900 text-white">Select current year</option>
                {options(CURRENT_YEAR_OPTIONS)}
              </select>
            </Field>
          </Section>

          <Section title="Matrix">
            <Field label="Position"><input value={displayValue(profile.designation)} readOnly disabled className={inputClass} /></Field>
            <Field label="Role"><input value={formatRole(profile.role || role)} readOnly disabled className={inputClass} /></Field>
          </Section>

          <Section title="Residence">
            <Field label="Residence" error={errors.residence}>
              <select value={formData.residence} onChange={(event) => updateField("residence", event.target.value)} className={inputClass}>
                <option value="" className="bg-neutral-900 text-white">Select residence</option>
                {options(RESIDENCE_OPTIONS)}
              </select>
            </Field>
            {formData.residence === "HOSTEL" ? (
              <>
                <Field label="Hostel name" error={errors.hostelName}>
                  <select value={formData.hostelName} onChange={(event) => updateField("hostelName", event.target.value)} className={inputClass}>
                    <option value="" className="bg-neutral-900 text-white">Select hostel</option>
                    {options(HOSTEL_OPTIONS)}
                  </select>
                </Field>
                <Field label="Hostel room number" error={errors.hostelRoomNumber}><input value={formData.hostelRoomNumber} onChange={(event) => updateField("hostelRoomNumber", event.target.value)} className={inputClass} /></Field>
              </>
            ) : null}
          </Section>

          <Section title="Academic">
            <Field label="CGPA" error={errors.currentCgpa}><input type="number" min="0" max="10" step="0.1" value={formData.currentCgpa} onChange={(event) => updateField("currentCgpa", event.target.value)} className={inputClass} /></Field>
          </Section>

          <Section title="Links">
            <Field label="LinkedIn" error={errors.linkedinUrl}><input type="url" value={formData.linkedinUrl} onChange={(event) => updateField("linkedinUrl", event.target.value)} className={inputClass} /></Field>
            <Field label="GitHub" error={errors.githubUrl}><input type="url" value={formData.githubUrl} onChange={(event) => updateField("githubUrl", event.target.value)} className={inputClass} /></Field>
            <Field label="Portfolio" error={errors.websiteUrl}><input type="url" value={formData.websiteUrl} onChange={(event) => updateField("websiteUrl", event.target.value)} className={inputClass} /></Field>
          </Section>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={cancelEditing}
              disabled={saving}
              className="!min-h-0 !rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className={primaryButton}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 space-y-4 sm:mt-6 sm:space-y-6">
          <Section title="Personal">
            <Detail label="Full name" value={profile.fullName} />
            <Detail label="Register number" value={profile.registerNumber} />
            <Detail label="Email" value={profile.email || email} locked />
            <Detail label="WhatsApp number" value={profile.whatsappNumber} />
            <Detail label="Gender" value={profile.gender} />
            <Detail label="Current year" value={profile.currentYear} />
          </Section>
          <Section title="Matrix">
            <Detail label="Position" value={profile.designation} locked />
            <Detail label="Role" value={profile.role || role} locked />
          </Section>
          <Section title="Residence">
            <Detail label="Residence" value={profile.residence} />
            {profile.residence === "HOSTEL" ? (
              <>
                <Detail label="Hostel name" value={profile.hostelName} />
                <Detail label="Hostel room number" value={profile.hostelRoomNumber} />
              </>
            ) : null}
          </Section>
          <Section title="Academic">
            <Detail label="CGPA" value={profile.currentCgpa} />
          </Section>
          <Section title="Links">
            {linkDetail("LinkedIn", profile.linkedinUrl)}
            {linkDetail("GitHub", profile.githubUrl)}
            {linkDetail("Portfolio", profile.websiteUrl)}
          </Section>
        </div>
      )}
    </div>
  );
}