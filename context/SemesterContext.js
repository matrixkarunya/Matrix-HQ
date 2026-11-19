"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";

const SemesterContext = createContext(null);

const FALLBACK = {
  semesters: [],
  activeSemester: null,
  activeSemesterId: "",
  selectedSemester: null,
  selectedSemesterId: "",
  setSelectedSemesterId: () => {},
  loading: true,
  error: "",
};

export function SemesterProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [semesters, setSemesters] = useState([]);
  const [activeSemesterId, setActiveSemesterId] = useState("");
  const [picked, setPicked] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!db || authLoading || !user) {
      setSemesters([]);
      setActiveSemesterId("");
      setPicked("");
      setListLoading(false);
      setSettingsLoading(false);
      return undefined;
    }

    setListLoading(true);
    setSettingsLoading(true);
    setError("");

    const unsubscribeList = onSnapshot(collection(db, "semesters"), (snapshot) => {
      const next = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      next.sort((a, b) => (b.startedAt?.toMillis?.() || 0) - (a.startedAt?.toMillis?.() || 0));
      setSemesters(next);
      setListLoading(false);
    }, (snapshotError) => {
      console.error("Semesters listener:", snapshotError.code, snapshotError.message);
      setSemesters([]);
      setListLoading(false);
      setError(`Could not load semesters (${snapshotError.code || "unknown"}).`);
    });

    const unsubscribeSettings = onSnapshot(doc(db, "settings", "semester"), (snapshot) => {
      setActiveSemesterId(snapshot.exists() ? String(snapshot.data().activeSemesterId || "") : "");
      setSettingsLoading(false);
    }, (snapshotError) => {
      console.error("Semester settings listener:", snapshotError.code, snapshotError.message);
      setActiveSemesterId("");
      setSettingsLoading(false);
      setError(`Could not load the active semester (${snapshotError.code || "unknown"}).`);
    });

    return () => {
      unsubscribeList();
      unsubscribeSettings();
    };
  }, [authLoading, user]);

  const value = useMemo(() => {
    const activeSemester = semesters.find((item) => item.id === activeSemesterId) || null;
    const selectedSemesterId = picked && semesters.some((item) => item.id === picked) ? picked : activeSemesterId;
    const selectedSemester = semesters.find((item) => item.id === selectedSemesterId) || null;
    return {
      semesters,
      activeSemester,
      activeSemesterId: activeSemester ? activeSemester.id : "",
      selectedSemester,
      selectedSemesterId: selectedSemester ? selectedSemester.id : "",
      // Picking the active semester means "follow the active one".
      setSelectedSemesterId: (id) => setPicked(id === activeSemesterId ? "" : id),
      loading: authLoading || (Boolean(user) && (listLoading || settingsLoading)),
      error,
    };
  }, [activeSemesterId, authLoading, error, listLoading, picked, semesters, settingsLoading, user]);

  return <SemesterContext.Provider value={value}>{children}</SemesterContext.Provider>;
}

export function useSemester() {
  return useContext(SemesterContext) || FALLBACK;
}