"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useSemester } from "@/context/SemesterContext";
import { db } from "@/lib/firebase";
import { meetingMinutes, splitRange } from "@/lib/hours";
import useUsers from "@/lib/useUsers";

function listenerError(source, error, setErrors) {
  console.error(`Dashboard ${source} listener:`, error.code, error.message);
  setErrors((current) => ({ ...current, [source]: `Could not load ${source} (${error.code || "unknown"}).` }));
}

function sumSessions(items, getRange) {
  return items.reduce((total, item) => {
    const range = getRange(item);
    if (!range) return total;
    const split = splitRange(range.startTime, range.endTime, range.isWorkingDay !== false);
    return {
      workingMinutes: total.workingMinutes + split.workingMinutes,
      nonWorkingMinutes: total.nonWorkingMinutes + split.nonWorkingMinutes,
      totalMinutes: total.totalMinutes + split.totalMinutes,
    };
  }, { workingMinutes: 0, nonWorkingMinutes: 0, totalMinutes: 0 });
}

export default function useDashboardStats(viewerRole, viewerEmail) {
  const { user, loading: authLoading } = useAuth();
  const { selectedSemesterId, loading: semesterLoading } = useSemester();
  const { users, error: usersError, loading: usersLoading } = useUsers();
  const email = String(viewerEmail || user?.email || "").trim().toLowerCase();
  const [allEvents, setAllEvents] = useState([]);
  const [allMeetings, setAllMeetings] = useState([]);
  const [allWorks, setAllWorks] = useState([]);
  const [allPending, setAllPending] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [loadingSources, setLoadingSources] = useState({ events: true, meetings: true, works: true });
  const [errors, setErrors] = useState({});

  const events = useMemo(
    () => allEvents.filter((event) => event.semesterId && event.semesterId === selectedSemesterId),
    [allEvents, selectedSemesterId],
  );
  const meetings = useMemo(
    () => allMeetings.filter((meeting) => meeting.semesterId && meeting.semesterId === selectedSemesterId),
    [allMeetings, selectedSemesterId],
  );
  const works = useMemo(
    () => allWorks.filter((work) => work.semesterId && work.semesterId === selectedSemesterId),
    [allWorks, selectedSemesterId],
  );
  const eventIdSet = useMemo(() => new Set(events.map((event) => event.id)), [events]);
  const pendingRequests = useMemo(
    () => allPending.filter((request) => eventIdSet.has(request.eventId)),
    [allPending, eventIdSet],
  );

  useEffect(() => {
    if (!db || authLoading || !user || !["admin", "superadmin"].includes(viewerRole)) {
      setAllEvents([]);
      setLoadingSources((current) => ({ ...current, events: false }));
      return undefined;
    }
    setLoadingSources((current) => ({ ...current, events: true }));
    const unsubscribe = onSnapshot(collection(db, "events"), (snapshot) => {
      setAllEvents(snapshot.docs.map((event) => ({ id: event.id, ...event.data() })));
      setLoadingSources((current) => ({ ...current, events: false }));
    }, (error) => {
      setAllEvents([]);
      setLoadingSources((current) => ({ ...current, events: false }));
      listenerError("events", error, setErrors);
    });
    return () => unsubscribe();
  }, [authLoading, user, viewerRole]);

  useEffect(() => {
    if (!db || authLoading || !user || !["admin", "superadmin"].includes(viewerRole)) {
      setAllMeetings([]);
      setLoadingSources((current) => ({ ...current, meetings: false }));
      return undefined;
    }
    setLoadingSources((current) => ({ ...current, meetings: true }));
    const unsubscribe = onSnapshot(collection(db, "meetings"), (snapshot) => {
      setAllMeetings(snapshot.docs.map((meeting) => ({ id: meeting.id, ...meeting.data() })));
      setLoadingSources((current) => ({ ...current, meetings: false }));
    }, (error) => {
      setAllMeetings([]);
      setLoadingSources((current) => ({ ...current, meetings: false }));
      listenerError("meetings", error, setErrors);
    });
    return () => unsubscribe();
  }, [authLoading, user, viewerRole]);

  useEffect(() => {
    if (!db || authLoading || !user || !["admin", "superadmin"].includes(viewerRole)) {
      setAllWorks([]);
      setLoadingSources((current) => ({ ...current, works: false }));
      return undefined;
    }
    setLoadingSources((current) => ({ ...current, works: true }));
    const unsubscribe = onSnapshot(collection(db, "works"), (snapshot) => {
      setAllWorks(snapshot.docs.map((work) => ({ id: work.id, ...work.data() })));
      setLoadingSources((current) => ({ ...current, works: false }));
    }, (error) => {
      setAllWorks([]);
      setLoadingSources((current) => ({ ...current, works: false }));
      listenerError("works", error, setErrors);
    });
    return () => unsubscribe();
  }, [authLoading, user, viewerRole]);

  // Admins only see requests for events they created
  const ownedEventIds = useMemo(() => allEvents
    .filter((event) => viewerRole === "superadmin" || String(event.createdBy || "").trim().toLowerCase() === email)
    .map((event) => event.id), [allEvents, email, viewerRole]);
  const ownedKey = ownedEventIds.join("|");

  useEffect(() => {
    if (!db || authLoading || !user || !["admin", "superadmin"].includes(viewerRole)) {
      setAllPending([]);
      setPendingLoading(false);
      return undefined;
    }
    setPendingLoading(true);
    if (viewerRole === "superadmin") {
      const unsubscribe = onSnapshot(query(collection(db, "completionRequests"), where("status", "==", "pending")), (snapshot) => {
        setAllPending(snapshot.docs.map((request) => ({ id: request.id, ...request.data() })));
        setPendingLoading(false);
      }, (error) => {
        setAllPending([]);
        setPendingLoading(false);
        listenerError("pending requests", error, setErrors);
      });
      return () => unsubscribe();
    }
    if (ownedEventIds.length === 0) {
      setAllPending([]);
      setPendingLoading(false);
      return undefined;
    }
    const requestsByEvent = new Map();
    const unsubscribers = ownedEventIds.map((eventId) => onSnapshot(
      query(collection(db, "completionRequests"), where("eventId", "==", eventId), where("status", "==", "pending")),
      (snapshot) => {
        requestsByEvent.set(eventId, snapshot.docs.map((request) => ({ id: request.id, ...request.data() })));
        setAllPending([...requestsByEvent.values()].flat());
        setPendingLoading(false);
      },
      (error) => {
        setPendingLoading(false);
        listenerError(`pending requests for ${eventId}`, error, setErrors);
      },
    ));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, ownedKey, user, viewerRole]);

  const eventHours = useMemo(
    () => sumSessions(events, (event) => event.attendanceSummary),
    [events],
  );
  const workHours = useMemo(
    () => sumSessions(works, (work) => ({ startTime: work.startTime, endTime: work.endTime, isWorkingDay: work.isWorkingDay })),
    [works],
  );
  const meetingMinutesTotal = useMemo(() => meetings.reduce((total, meeting) => {
    if (!meeting.attendanceSummary) return total;
    return total + meetingMinutes(meeting.attendanceSummary.startTime, meeting.attendanceSummary.endTime);
  }, 0), [meetings]);
  const workingMinutes = eventHours.workingMinutes + workHours.workingMinutes;
  const nonWorkingMinutes = eventHours.nonWorkingMinutes + workHours.nonWorkingMinutes;
  const totalMembers = useMemo(() => users.filter((item) => ["admin", "member"].includes(item.role)).length, [users]);
  const totalAdmins = useMemo(() => users.filter((item) => item.role === "admin").length, [users]);
  const loading = authLoading || semesterLoading || usersLoading || Object.values(loadingSources).some(Boolean) || pendingLoading;
  const error = [...Object.values(errors), usersError].filter(Boolean).join(" ");

  return {
    loading,
    error,
    sourceErrors: { ...errors, users: usersError },
    totalEvents: events.length,
    totalMembers,
    totalAdmins,
    totalMeetings: meetings.length,
    totalWorks: works.length,
    workingMinutes,
    nonWorkingMinutes,
    meetingMinutes: meetingMinutesTotal,
    totalMinutes: workingMinutes + nonWorkingMinutes + meetingMinutesTotal,
    pendingRequests: pendingRequests.length,
  };
}