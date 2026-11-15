"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setDoc, doc, serverTimestamp } from "firebase/firestore";
import { CheckCircle2, GraduationCap, Home, Link2, Loader2, Lock, User } from "lucide-react";
import FullScreenLoader from "@/components/FullScreenLoader";
import { useAuth } from "@/context/AuthContext";
import {
  CURRENT_YEAR_OPTIONS,
  GENDER_OPTIONS,
  HOSTEL_OPTIONS,
  RESIDENCE_OPTIONS,
  ROLE_HOME,
} from "@/lib/config";
import { db } from "@/lib/firebase";

const GLASS = "rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20 backdrop-blur-xl";
const EYEBROW = "text-xs font-semibold uppercase tracking-[.22em] text-violet-300/80";
const ICON_CHIP = "flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-violet-500/15 text-violet-200";
const INPUT = "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-400/30 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-red-300/50 [color-scheme:dark]";
const LABEL = "text-sm font-medium text-white/80";
const FIELD_ERROR = "mt-1 block text-xs text-red-300";
const BTN_PRIMARY = "!min-h-0 inline-flex items-center justify-center gap-2 whitespace-nowrap !rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60";
const BANNER_ERROR = "rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100 backdrop-blur-md";
const BANNER_SUCCESS = "rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100 backdrop-blur-md";
const GRID = "grid gap-x-8 gap-y-5 sm:grid-cols-2";

const emptyProfile = {
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
  websiteUrl: "",
  githubUrl: "",
};

function normalizeUrl(value) {
  return typeof value === "string" ? value.trim() : "";
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

function Field({ label, error, hint, className = "", children }) {
  return (
    <label className={`block ${className}`}>
      <span className={`${LABEL} mb-1.5 block`}>{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-white/50">{hint}</span> : null}
      {error ? <span role="alert" className={FIELD_ERROR}>{error}</span> : null}
    </label>
  );
}

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="mb-5 flex items-center gap-3 border-b border-white/10 pb-4">
      <span className={ICON_CHIP}><Icon className="size-[18px]" aria-hidden="true" /></span>
      <h2 className="min-w-0 truncate text-lg font-semibold sm:text-xl">{title}</h2>
    </div>
  );
}

export default function ProfileCompletionPage() {
  const router = useRouter();
  const { user, role, profile, profileCompleted, loading, updateProfileCompletion } = useAuth();
  const [formData, setFormData] = useState(emptyProfile);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const redirectTimerRef = useRef(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }

    if (!loading && user && role === "superadmin") {
      router.replace("/superadmin");
      return;
    }

    if (saved) {
      return;
    }

    if (!loading && user && role && role !== "superadmin" && profileCompleted) {
      router.replace("/welcome");
    }
  }, [loading, profileCompleted, role, router, saved, user]);

  useEffect(() => {
    if (!saved) {
      return undefined;
    }

    redirectTimerRef.current = window.setTimeout(() => {
      router.replace("/welcome");
    }, 1500);

    return () => {
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, [router, saved]);

  useEffect(() => () => {
    if (redirectTimerRef.current) {
      window.clearTimeout(redirectTimerRef.current);
    }
  }, []);

  function handleFieldChange(field, value) {
    setFormData((previous) => {
      const next = { ...previous, [field]: value };

      if (field === "residence" && value === "DAYSCHOLAR") {
        next.hostelName = "";
        next.hostelRoomNumber = "";
      }

      return next;
    });

    setErrors((previous) => ({
      ...previous,
      [field]: "",
    }));
  }

  function validateForm() {
    const nextErrors = {};
    const fullName = formData.fullName.trim();
    const registerNumber = formData.registerNumber.trim();
    const whatsappNumber = formData.whatsappNumber.trim();
    const currentCgpa = formData.currentCgpa.trim();

    if (!fullName) nextErrors.fullName = "Full name is required.";
    if (!registerNumber) nextErrors.registerNumber = "Register number is required.";
    if (!formData.currentYear) nextErrors.currentYear = "Select your current year.";
    if (!whatsappNumber) {
      nextErrors.whatsappNumber = "WhatsApp number is required.";
    } else if (!/^(\+?[0-9]{10,15})$/.test(whatsappNumber)) {
      nextErrors.whatsappNumber = "Enter a valid WhatsApp number.";
    }
    if (!formData.gender) nextErrors.gender = "Select your gender.";
    if (!formData.residence) nextErrors.residence = "Select your residence.";

    if (formData.residence === "HOSTEL") {
      if (!formData.hostelName) nextErrors.hostelName = "Select your hostel.";
      if (!formData.hostelRoomNumber.trim()) {
        nextErrors.hostelRoomNumber = "Hostel room number is required.";
      }
    }

    if (currentCgpa) {
      const numericCgpa = Number(currentCgpa);
      if (!Number.isFinite(numericCgpa) || numericCgpa < 0 || numericCgpa > 10) {
        nextErrors.currentCgpa = "CGPA must be between 0 and 10.";
      }
    }

    if (!validateUrl(formData.linkedinUrl)) nextErrors.linkedinUrl = "Enter a valid LinkedIn URL.";
    if (!validateUrl(formData.websiteUrl)) nextErrors.websiteUrl = "Enter a valid website URL.";
    if (!validateUrl(formData.githubUrl)) nextErrors.githubUrl = "Enter a valid GitHub URL.";

    return nextErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!user || !role || role === "superadmin") {
      return;
    }

    const nextErrors = validateForm();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSaving(true);
    setStatus({ type: "", message: "" });

    try {
      const normalizedEmail = user.email?.trim().toLowerCase();
      if (!normalizedEmail) {
        throw new Error("User email is missing.");
      }

      const payload = {
        fullName: formData.fullName.trim(),
        registerNumber: formData.registerNumber.trim(),
        currentYear: formData.currentYear,
        whatsappNumber: formData.whatsappNumber.trim(),
        gender: formData.gender,
        residence: formData.residence,
        profileCompleted: true,
        profileCompletedAt: serverTimestamp(),
        currentCgpa:
          formData.currentCgpa.trim() === "" ? null : Number.parseFloat(formData.currentCgpa.trim()),
        linkedinUrl: normalizeUrl(formData.linkedinUrl),
        websiteUrl: normalizeUrl(formData.websiteUrl),
        githubUrl: normalizeUrl(formData.githubUrl),
      };

      if (formData.residence === "HOSTEL") {
        payload.hostelName = formData.hostelName;
        payload.hostelRoomNumber = formData.hostelRoomNumber.trim();
      }

      await setDoc(doc(db, "users", normalizedEmail), payload, { merge: true });
      updateProfileCompletion(true);
      setSaved(true);
      setStatus({ type: "success", message: "Registration successful. Taking you to your welcome page..." });
    } catch (saveError) {
      console.error(saveError);
      setStatus({
        type: "error",
        message: `Could not save your profile (${saveError?.code || "unknown"}). Please try again.`,
      });
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4 py-8 text-white">
        <div role="status" className={`${GLASS} w-full p-8 text-center`}>
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-200">
            <CheckCircle2 className="size-7" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Registration successful</h1>
          <p className="mt-2 text-sm text-white/60">Taking you to your welcome page...</p>
          <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-full animate-pulse rounded-full bg-gradient-to-r from-violet-400 to-sky-300 motion-reduce:animate-none" />
          </div>
        </div>
      </main>
    );
  }

  if (loading || !user || role === "superadmin") {
    return <FullScreenLoader />;
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 pb-12 text-white sm:px-6 lg:py-12">
      <p className="text-sm font-semibold tracking-[0.3em] text-white/80">MATRIX</p>

      <header className="mt-8">
        <p className={EYEBROW}>Welcome</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">Complete your profile</h1>
        <p className="mt-2 text-sm text-white/50">
          Complete the required information to continue to your Matrix dashboard.
        </p>
      </header>

      {status.message ? (
        <div
          className={`${status.type === "success" ? BANNER_SUCCESS : BANNER_ERROR} mt-6`}
          role={status.type === "error" ? "alert" : "status"}
        >
          {status.message}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4 sm:space-y-6">
        <section className={`${GLASS} p-5 sm:p-6`}>
          <SectionHeader icon={User} title="Personal details" />
          <div className={GRID}>
            <Field label="Full name *" error={errors.fullName}>
              <input
                type="text"
                value={formData.fullName}
                onChange={(event) => handleFieldChange("fullName", event.target.value)}
                aria-invalid={Boolean(errors.fullName)}
                className={INPUT}
                placeholder="Jane Doe"
              />
            </Field>

            <Field label="Register number *" error={errors.registerNumber}>
              <input
                type="text"
                value={formData.registerNumber}
                onChange={(event) => handleFieldChange("registerNumber", event.target.value)}
                aria-invalid={Boolean(errors.registerNumber)}
                className={INPUT}
                placeholder="2023CS101"
              />
            </Field>

            <Field label="Current year *" error={errors.currentYear}>
              <select
                value={formData.currentYear}
                onChange={(event) => handleFieldChange("currentYear", event.target.value)}
                aria-invalid={Boolean(errors.currentYear)}
                className={INPUT}
              >
                <option value="" className="bg-neutral-900 text-white">Select current year</option>
                {CURRENT_YEAR_OPTIONS.map((year) => (
                  <option key={year} value={year} className="bg-neutral-900 text-white">
                    {year}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="WhatsApp number *" error={errors.whatsappNumber}>
              <input
                type="tel"
                value={formData.whatsappNumber}
                onChange={(event) => handleFieldChange("whatsappNumber", event.target.value)}
                aria-invalid={Boolean(errors.whatsappNumber)}
                className={INPUT}
                placeholder="+919876543210"
              />
            </Field>

            <Field label="Gender *" error={errors.gender}>
              <select
                value={formData.gender}
                onChange={(event) => handleFieldChange("gender", event.target.value)}
                aria-invalid={Boolean(errors.gender)}
                className={INPUT}
              >
                <option value="" className="bg-neutral-900 text-white">Select gender</option>
                {GENDER_OPTIONS.map((gender) => (
                  <option key={gender} value={gender} className="bg-neutral-900 text-white">
                    {gender}
                  </option>
                ))}
              </select>
            </Field>

            <label className="block">
              <span className={`${LABEL} mb-1.5 flex items-center justify-between gap-2`}>
                Current position in Matrix
                <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium text-white/60">
                  <Lock className="size-3" aria-hidden="true" />
                  Locked
                </span>
              </span>
              <input
                value={profile?.designation?.trim() || "Not assigned yet"}
                readOnly
                disabled
                className={INPUT}
              />
              <span className="mt-1 block text-xs text-white/50">Assigned by the superadmin</span>
            </label>
          </div>
        </section>

        <section className={`${GLASS} p-5 sm:p-6`}>
          <SectionHeader icon={Home} title="Residence details" />
          <div className={GRID}>
            <Field label="Residence *" error={errors.residence}>
              <select
                value={formData.residence}
                onChange={(event) => handleFieldChange("residence", event.target.value)}
                aria-invalid={Boolean(errors.residence)}
                className={INPUT}
              >
                <option value="" className="bg-neutral-900 text-white">Select residence</option>
                {RESIDENCE_OPTIONS.map((option) => (
                  <option key={option} value={option} className="bg-neutral-900 text-white">
                    {option}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {formData.residence === "HOSTEL" ? (
            <div className={`${GRID} mt-5`}>
              <Field label="Hostel name *" error={errors.hostelName}>
                <select
                  value={formData.hostelName}
                  onChange={(event) => handleFieldChange("hostelName", event.target.value)}
                  aria-invalid={Boolean(errors.hostelName)}
                  className={INPUT}
                >
                  <option value="" className="bg-neutral-900 text-white">Select hostel</option>
                  {HOSTEL_OPTIONS.map((hostel) => (
                    <option key={hostel} value={hostel} className="bg-neutral-900 text-white">
                      {hostel}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Hostel room number *" error={errors.hostelRoomNumber}>
                <input
                  type="text"
                  value={formData.hostelRoomNumber}
                  onChange={(event) => handleFieldChange("hostelRoomNumber", event.target.value)}
                  aria-invalid={Boolean(errors.hostelRoomNumber)}
                  className={INPUT}
                  placeholder="204"
                />
              </Field>
            </div>
          ) : null}
        </section>

        <section className={`${GLASS} p-5 sm:p-6`}>
          <SectionHeader icon={GraduationCap} title="Academic details" />
          <div className={GRID}>
            <Field label="Current CGPA" error={errors.currentCgpa}>
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={formData.currentCgpa}
                onChange={(event) => handleFieldChange("currentCgpa", event.target.value)}
                aria-invalid={Boolean(errors.currentCgpa)}
                className={INPUT}
                placeholder="8.5"
              />
            </Field>
          </div>
        </section>

        <section className={`${GLASS} p-5 sm:p-6`}>
          <SectionHeader icon={Link2} title="Professional links" />
          <div className={GRID}>
            <Field label="LinkedIn URL" error={errors.linkedinUrl}>
              <input
                type="url"
                value={formData.linkedinUrl}
                onChange={(event) => handleFieldChange("linkedinUrl", event.target.value)}
                aria-invalid={Boolean(errors.linkedinUrl)}
                className={INPUT}
                placeholder="https://www.linkedin.com/in/yourprofile"
              />
            </Field>

            <Field label="Website URL" error={errors.websiteUrl}>
              <input
                type="url"
                value={formData.websiteUrl}
                onChange={(event) => handleFieldChange("websiteUrl", event.target.value)}
                aria-invalid={Boolean(errors.websiteUrl)}
                className={INPUT}
                placeholder="https://yourwebsite.com"
              />
            </Field>

            <Field label="GitHub URL" error={errors.githubUrl} className="sm:col-span-2">
              <input
                type="url"
                value={formData.githubUrl}
                onChange={(event) => handleFieldChange("githubUrl", event.target.value)}
                aria-invalid={Boolean(errors.githubUrl)}
                className={INPUT}
                placeholder="https://github.com/yourusername"
              />
            </Field>
          </div>
        </section>

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving} className={`${BTN_PRIMARY} w-full sm:w-auto`}>
            {saving ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </main>
  );
}