"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";

export default function useUsers() {
  const { user, role, loading } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [usersLoading, setUsersLoading] = useState(true);

  useEffect(() => {
    if (!db || loading || !user || !["superadmin", "admin"].includes(role)) {
      setUsers([]);
      setError("");
      setUsersLoading(false);
      return undefined;
    }

    setError("");
    setUsersLoading(true);
    const usersQuery = query(collection(db, "users"), orderBy("email"));
    const unsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        const nextUsers = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }));
        setUsers(nextUsers);
        setUsersLoading(false);
      },
      (error) => {
        console.error("Users listener:", error.code, error.message);
        setUsers([]);
        setError(`Could not load users (${error.code || "unknown"}).`);
        setUsersLoading(false);
      },
    );

    return () => unsubscribe();
  }, [loading, role, user]);

  return { users, error, loading: usersLoading };
}
