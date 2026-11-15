"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { meetingMinutes, splitRange } from "@/lib/hours";
import useUsers from "@/lib/useUsers";

function listenerError(source, error, setErrors) {
  console.error(`Dashboard ${source} listener:`, error.code, error.message);
  setErrors((current) => ({ ...current, [source]: `Could not load ${source} (${error.code || "unknown"}).` }));
}

export default function useDashboardStats(viewerRole, viewerEmail) {
  const { user, loading: authLoading } = useAuth();
  const { users, error: usersError, loading: usersLoading } = useUsers();
  const email = String(viewerEmail || user?.email || "").trim().toLowerCase();
  const [events, setEvents] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [loadingSources, setLoadingSources] = useState({ events: true, meetings: true });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!db || authLoading || !user || !["admin", "superadmin"].includes(viewerRole)) {
      setEvents([]);
      setLoadingSources((current) => ({ ...current, events: false }));
      return undefined;
    }
    setLoadingSources((current) => ({ ...current, events: true }));
    const unsubscribe = onSnapshot(collection(db, "events"), (snapshot) => {
      setEvents(snapshot.docs.map((event) => ({ id: event.id, ...event.data() })));
      setLoadingSources((current) => ({ ...current, events: false }));
    }, (error) => {
      setEvents([]);
      setLoadingSources((current) => ({ ...current, events: false }));
      listenerError("events", error, setErrors);
    });
    return () => unsubscribe();
  }, [authLoading, user, viewerRole]);

  useEffect(() => {
    if (!db || authLoading || !user || !["admin", "superadmin"].includes(viewerRole)) {
      setMeetings([]);
      setLoadingSources((current) => ({ ...current, meetings: false }));
      return undefined;
    }
    setLoadingSources((current) => ({ ...current, meetings: true }));
    const unsubscribe = onSnapshot(collection(db, "meetings"), (snapshot) => {
      setMeetings(snapshot.docs.map((meeting) => ({ id: meeting.id, ...meeting.data() })));
      setLoadingSources((current) => ({ ...current, meetings: false }));
    }, (error) => {
      setMeetings([]);
      setLoadingSources((current) => ({ ...current, meetings: false }));
      listenerError("meetings", error, setErrors);
    });
    return () => unsubscribe();
  }, [authLoading, user, viewerRole]);

  const ownedEventIds = useMemo(() => events
    .filter((event) => viewerRole === "superadmin" || String(event.createdBy || "").trim().toLowerCase() === email)
    .map((event) => event.id), [email, events, viewerRole]);

  useEffect(() => {
    if (!db || authLoading || !user || !["admin", "superadmin"].includes(viewerRole)) {
      setPendingRequests([]);
      setPendingLoading(false);
      return undefined;
    }
    setPendingLoading(true);
    if (viewerRole === "superadmin") {
      const unsubscribe = onSnapshot(query(collection(db, "completionRequests"), where("status", "==", "pending")), (snapshot) => {
        setPendingRequests(snapshot.docs.map((request) => ({ id: request.id, ...request.data() })));
        setPendingLoading(false);
      }, (error) => {
        setPendingRequests([]);
        setPendingLoading(false);
        listenerError("pending requests", error, setErrors);
      });
      return () => unsubscribe();
    }
    if (ownedEventIds.length === 0) {
      setPendingRequests([]);
      setPendingLoading(false);
      return undefined;
    }
    const requestsByEvent = new Map();
    const unsubscribers = ownedEventIds.map((eventId) => onSnapshot(
      query(collection(db, "completionRequests"), where("eventId", "==", eventId), where("status", "==", "pending")),
      (snapshot) => {
        requestsByEvent.set(eventId, snapshot.docs.map((request) => ({ id: request.id, ...request.data() })));
        setPendingRequests([...requestsByEvent.values()].flat());
        setPendingLoading(false);
      },
      (error) => {
        setPendingLoading(false);
        listenerError(`pending requests for ${eventId}`, error, setErrors);
      },
    ));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [authLoading, ownedEventIds, user, viewerRole]);

  const eventHours = useMemo(() => events.reduce((total, event) => {
    if (!event.attendanceSummary) return total;
    const split = splitRange(event.attendanceSummary.startTime, event.attendanceSummary.endTime);
    return {
      workingMinutes: total.workingMinutes + split.workingMinutes,
      nonWorkingMinutes: total.nonWorkingMinutes + split.nonWorkingMinutes,
      totalMinutes: total.totalMinutes + split.totalMinutes,
    };
  }, { workingMinutes: 0, nonWorkingMinutes: 0, totalMinutes: 0 }), [events]);
  const meetingMinutesTotal = useMemo(() => meetings.reduce((total, meeting) => {
    if (!meeting.attendanceSummary) return total;
    return total + meetingMinutes(meeting.attendanceSummary.startTime, meeting.attendanceSummary.endTime);
  }, 0), [meetings]);
  const combinedHours = useMemo(() => {
    const workingMinutes = eventHours.workingMinutes;
    const nonWorkingMinutes = eventHours.nonWorkingMinutes;
    return { workingMinutes, nonWorkingMinutes, totalMinutes: workingMinutes + nonWorkingMinutes + meetingMinutesTotal };
  }, [eventHours, meetingMinutesTotal]);
  const totalMembers = useMemo(() => users.filter((item) => ["admin", "member"].includes(item.role)).length, [users]);
  const totalAdmins = useMemo(() => users.filter((item) => item.role === "admin").length, [users]);
  const loading = authLoading || usersLoading || Object.values(loadingSources).some(Boolean) || pendingLoading;
  const error = [...Object.values(errors), usersError].filter(Boolean).join(" ");

  return {
    loading,
    error,
    sourceErrors: { ...errors, users: usersError },
    totalEvents: events.length,
    totalMembers,
    totalAdmins,
    totalMeetings: meetings.length,
    workingMinutes: combinedHours.workingMinutes,
    nonWorkingMinutes: combinedHours.nonWorkingMinutes,
    meetingMinutes: meetingMinutesTotal,
    totalMinutes: combinedHours.totalMinutes,
    pendingRequests: pendingRequests.length,
  };
}