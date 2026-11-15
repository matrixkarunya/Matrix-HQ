"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ROLE_HOME } from "@/lib/config";
import { useAuth } from "@/context/AuthContext";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5">
      <path
        fill="#4285F4"
        d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"
      />
      <path
        fill="#34A853"
        d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"
      />
      <path
        fill="#FBBC05"
        d="M12.6 27.5a12 12 0 0 1 0-7v-5.3H5.8a20 20 0 0 0 0 17.6l6.8-5.3Z"
      />
      <path
        fill="#EA4335"
        d="M24 12.1c3 0 5.7 1 7.8 3.1l5.9-5.9A19.7 19.7 0 0 0 24 4 20 20 0 0 0 5.8 15.2l6.8 5.3c1.6-4.8 6.1-8.4 11.4-8.4Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const { user, role, profileCompleted, loading, error, loginWithGoogle } =
    useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && role) {
      router.replace(profileCompleted ? ROLE_HOME[role] : "/profile");
    }
  }, [loading, profileCompleted, role, router, user]);

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <section className="w-full max-w-md border border-white/10 bg-black/40 p-7 shadow-2xl shadow-black/50 backdrop-blur-2xl sm:p-9">
        <h1 className="text-2xl font-semibold">Sign in to Matrix</h1>
        <p className="mt-2 text-sm leading-6 text-white/60">
          Continue to your Matrix Board account.
        </p>

        <button
          type="button"
          onClick={loginWithGoogle}
          disabled={loading}
          className="mt-7 flex min-h-12 w-full items-center justify-center gap-3 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GoogleIcon />
          {loading ? "Checking…" : "Continue with Google"}
        </button>

        {error ? (
          <p
            role="alert"
            className="mt-4 border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100"
          >
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}