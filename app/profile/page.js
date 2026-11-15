"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setDoc, doc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import {
  CURRENT_YEAR_OPTIONS,
  GENDER_OPTIONS,
  HOSTEL_OPTIONS,
  RESIDENCE_OPTIONS,
  ROLE_HOME,
} from "@/lib/config";
import { db } from "@/lib/firebase";

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
      setStatus({ type: "success", message: "Registration successful ✅ / Taking you to your welcome page..." });
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
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4 py-8">
        <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm">
          <p className="text-2xl">✅</p>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-900">
            Registration successful
          </h1>
          <p className="mt-3 text-sm text-emerald-800">
            Taking you to your welcome page...
          </p>
        </div>
      </main>
    );
  }

  if (loading) {
    return <p className="p-6 text-sm text-neutral-600">Loading…</p>;
  }

  if (!user) {
    return <p className="p-6 text-sm text-neutral-600">Redirecting…</p>;
  }

  if (role === "superadmin") {
    return <p className="p-6 text-sm text-neutral-600">Redirecting to dashboard…</p>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-8">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-neutral-500">
            Welcome
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Complete your profile</h1>
        </div>

        <p className="mt-3 text-sm text-neutral-600">
          Complete the required information to continue to your Matrix dashboard.
        </p>

        {status.message ? (
          <div
            className={`mt-6 rounded-md border px-4 py-3 text-sm ${
              status.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
            role={status.type === "error" ? "alert" : "status"}
          >
            {status.message}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-8">
          <section className="space-y-5">
            <div className="flex items-center gap-3 border-b border-neutral-200 pb-3">
              <h2 className="text-lg font-semibold">Personal Details</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block text-sm font-medium text-neutral-700">
                <span className="mb-1.5 block">Full Name *</span>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(event) => handleFieldChange("fullName", event.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-2 focus:ring-black"
                  placeholder="Jane Doe"
                />
                {errors.fullName ? <span className="mt-1 block text-xs text-red-700">{errors.fullName}</span> : null}
              </label>

              <label className="block text-sm font-medium text-neutral-700">
                <span className="mb-1.5 block">Register Number *</span>
                <input
                  type="text"
                  value={formData.registerNumber}
                  onChange={(event) => handleFieldChange("registerNumber", event.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-2 focus:ring-black"
                  placeholder="2023CS101"
                />
                {errors.registerNumber ? (
                  <span className="mt-1 block text-xs text-red-700">{errors.registerNumber}</span>
                ) : null}
              </label>

              <label className="block text-sm font-medium text-neutral-700">
                <span className="mb-1.5 block">Current Year *</span>
                <select
                  value={formData.currentYear}
                  onChange={(event) => handleFieldChange("currentYear", event.target.value)}
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-2 focus:ring-black"
                >
                  <option value="">Select current year</option>
                  {CURRENT_YEAR_OPTIONS.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                {errors.currentYear ? (
                  <span className="mt-1 block text-xs text-red-700">{errors.currentYear}</span>
                ) : null}
              </label>

              <label className="block text-sm font-medium text-neutral-700">
                <span className="mb-1.5 block">WhatsApp Number *</span>
                <input
                  type="tel"
                  value={formData.whatsappNumber}
                  onChange={(event) => handleFieldChange("whatsappNumber", event.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-2 focus:ring-black"
                  placeholder="+919876543210"
                />
                {errors.whatsappNumber ? (
                  <span className="mt-1 block text-xs text-red-700">{errors.whatsappNumber}</span>
                ) : null}
              </label>

              <label className="block text-sm font-medium text-neutral-700">
                <span className="mb-1.5 block">Gender *</span>
                <select
                  value={formData.gender}
                  onChange={(event) => handleFieldChange("gender", event.target.value)}
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-2 focus:ring-black"
                >
                  <option value="">Select gender</option>
                  {GENDER_OPTIONS.map((gender) => (
                    <option key={gender} value={gender}>
                      {gender}
                    </option>
                  ))}
                </select>
                {errors.gender ? <span className="mt-1 block text-xs text-red-700">{errors.gender}</span> : null}
              </label>

              <label className="block text-sm font-medium text-neutral-700">
                <span className="mb-1.5 block">Current Position in Matrix</span>
                <input
                  value={profile?.designation?.trim() || "Not assigned yet"}
                  readOnly
                  disabled
                  className="w-full rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-500 outline-none"
                />
                <span className="mt-1 block text-xs text-neutral-500">Assigned by the superadmin</span>
              </label>
            </div>
          </section>

          <section className="space-y-5">
            <div className="flex items-center gap-3 border-b border-neutral-200 pb-3">
              <h2 className="text-lg font-semibold">Residence Details</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block text-sm font-medium text-neutral-700">
                <span className="mb-1.5 block">Residence *</span>
                <select
                  value={formData.residence}
                  onChange={(event) => handleFieldChange("residence", event.target.value)}
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-2 focus:ring-black"
                >
                  <option value="">Select residence</option>
                  {RESIDENCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {errors.residence ? (
                  <span className="mt-1 block text-xs text-red-700">{errors.residence}</span>
                ) : null}
              </label>
            </div>

            {formData.residence === "HOSTEL" ? (
              <div className="grid gap-5 md:grid-cols-2">
                <label className="block text-sm font-medium text-neutral-700">
                  <span className="mb-1.5 block">Hostel Name *</span>
                  <select
                    value={formData.hostelName}
                    onChange={(event) => handleFieldChange("hostelName", event.target.value)}
                    className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-2 focus:ring-black"
                  >
                    <option value="">Select hostel</option>
                    {HOSTEL_OPTIONS.map((hostel) => (
                      <option key={hostel} value={hostel}>
                        {hostel}
                      </option>
                    ))}
                  </select>
                  {errors.hostelName ? (
                    <span className="mt-1 block text-xs text-red-700">{errors.hostelName}</span>
                  ) : null}
                </label>

                <label className="block text-sm font-medium text-neutral-700">
                  <span className="mb-1.5 block">Hostel Room Number *</span>
                  <input
                    type="text"
                    value={formData.hostelRoomNumber}
                    onChange={(event) => handleFieldChange("hostelRoomNumber", event.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-2 focus:ring-black"
                    placeholder="204"
                  />
                  {errors.hostelRoomNumber ? (
                    <span className="mt-1 block text-xs text-red-700">{errors.hostelRoomNumber}</span>
                  ) : null}
                </label>
              </div>
            ) : null}
          </section>

          <section className="space-y-5">
            <div className="flex items-center gap-3 border-b border-neutral-200 pb-3">
              <h2 className="text-lg font-semibold">Academic Details</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block text-sm font-medium text-neutral-700">
                <span className="mb-1.5 block">Current CGPA</span>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={formData.currentCgpa}
                  onChange={(event) => handleFieldChange("currentCgpa", event.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-2 focus:ring-black"
                  placeholder="8.5"
                />
                {errors.currentCgpa ? (
                  <span className="mt-1 block text-xs text-red-700">{errors.currentCgpa}</span>
                ) : null}
              </label>
            </div>
          </section>

          <section className="space-y-5">
            <div className="flex items-center gap-3 border-b border-neutral-200 pb-3">
              <h2 className="text-lg font-semibold">Professional Links</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block text-sm font-medium text-neutral-700">
                <span className="mb-1.5 block">LinkedIn URL</span>
                <input
                  type="url"
                  value={formData.linkedinUrl}
                  onChange={(event) => handleFieldChange("linkedinUrl", event.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-2 focus:ring-black"
                  placeholder="https://www.linkedin.com/in/yourprofile"
                />
                {errors.linkedinUrl ? (
                  <span className="mt-1 block text-xs text-red-700">{errors.linkedinUrl}</span>
                ) : null}
              </label>

              <label className="block text-sm font-medium text-neutral-700">
                <span className="mb-1.5 block">Website URL</span>
                <input
                  type="url"
                  value={formData.websiteUrl}
                  onChange={(event) => handleFieldChange("websiteUrl", event.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-2 focus:ring-black"
                  placeholder="https://yourwebsite.com"
                />
                {errors.websiteUrl ? (
                  <span className="mt-1 block text-xs text-red-700">{errors.websiteUrl}</span>
                ) : null}
              </label>

              <label className="block text-sm font-medium text-neutral-700 md:col-span-2">
                <span className="mb-1.5 block">GitHub URL</span>
                <input
                  type="url"
                  value={formData.githubUrl}
                  onChange={(event) => handleFieldChange("githubUrl", event.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-2 focus:ring-black"
                  placeholder="https://github.com/yourusername"
                />
                {errors.githubUrl ? (
                  <span className="mt-1 block text-xs text-red-700">{errors.githubUrl}</span>
                ) : null}
              </label>
            </div>
          </section>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
