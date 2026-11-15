"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import FullScreenLoader from "@/components/FullScreenLoader";
import { ROLE_HOME } from "@/lib/config";
import { useAuth } from "@/context/AuthContext";

export default function RoleGuard({ allow, children }) {
  const { user, role, profileCompleted, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    if (role !== "superadmin" && !profileCompleted) {
      router.replace("/profile");
      return;
    }

    if (!allow.includes(role)) {
      router.replace(ROLE_HOME[role] || "/login");
    }
  }, [allow, loading, profileCompleted, role, router, user]);

  if (loading || !user || !allow.includes(role)) {
    return <FullScreenLoader />;
  }

  if (role !== "superadmin" && !profileCompleted) {
    return <FullScreenLoader />;
  }

  return children;
}