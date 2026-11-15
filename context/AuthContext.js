"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import { ROLE_HOME } from "@/lib/config";

const AuthContext = createContext(null);

function isProfileComplete(profile, role) {
  if (!role || role === "superadmin") {
    return true;
  }

  return Boolean(profile?.profileCompleted === true);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [profile, setProfile] = useState(null);
  const [designation, setDesignation] = useState(null);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const listenerRef = useRef(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (listenerRef.current) {
        listenerRef.current();
        listenerRef.current = null;
      }

      if (!firebaseUser) {
        setUser(null);
        setRole(null);
        setProfile(null);
        setDesignation(null);
        setProfileCompleted(false);
        setLoading(false);
        return;
      }

      const email = firebaseUser.email?.trim().toLowerCase();
      if (!email) {
        setUser(null);
        setRole(null);
        setProfile(null);
        setDesignation(null);
        setProfileCompleted(false);
        setError("Could not check your access. Try again.");
        setLoading(false);
        signOut(auth);
        return;
      }

      setLoading(true);
      const profileDocRef = doc(db, "users", email);

      listenerRef.current = onSnapshot(
        profileDocRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            setUser(null);
            setRole(null);
            setProfile(null);
            setDesignation(null);
            setProfileCompleted(false);
            setError("Access denied: ask the superadmin to add your email");
            setLoading(false);
            signOut(auth);
            return;
          }

          const nextProfile = snapshot.data();
          const nextRole = nextProfile.role;
          const nextDesignation = typeof nextProfile.designation === "string" ? nextProfile.designation.trim() : "";

          if (nextProfile.active === false) {
            setUser(null);
            setRole(null);
            setProfile(null);
            setDesignation(null);
            setProfileCompleted(false);
            setError("Your account is inactive. Contact the superadmin.");
            setLoading(false);
            signOut(auth);
            return;
          }

          if (!Object.hasOwn(ROLE_HOME, nextRole)) {
            setUser(null);
            setRole(null);
            setProfile(null);
            setDesignation(null);
            setProfileCompleted(false);
            setError("Could not check your access. Try again.");
            setLoading(false);
            signOut(auth);
            return;
          }

          setUser(firebaseUser);
          setRole(nextRole);
          setProfile(nextProfile);
          setDesignation(nextDesignation || null);
          setProfileCompleted(isProfileComplete(nextProfile, nextRole));
          setError("");
          setLoading(false);
        },
        (err) => {
          console.error("Profile listener:", err.code, err.message);
          setUser(null);
          setRole(null);
          setProfile(null);
          setDesignation(null);
          setProfileCompleted(false);
          setError(`Could not check your access (${err.code}).`);
          setLoading(false);
          signOut(auth);
        },
      );
    });

    return () => {
      if (listenerRef.current) {
        listenerRef.current();
        listenerRef.current = null;
      }
      unsubscribeAuth();
    };
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (loginError) {
      if (loginError.code !== "auth/popup-closed-by-user") {
        console.error(loginError);
        setError("Could not sign in with Google. Try again.");
      }
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (listenerRef.current) {
      listenerRef.current();
      listenerRef.current = null;
    }
    await signOut(auth);
  }, []);

  const updateProfileCompletion = useCallback((value) => {
    setProfileCompleted(Boolean(value));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        profile,
        designation,
        profileCompleted,
        loading,
        error,
        loginWithGoogle,
        logout,
        updateProfileCompletion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
