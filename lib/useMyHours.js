"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { meetingMinutes, splitRange, sumRanges } from "@/lib/hours";

const EMPTY_TOTALS = { workingMinutes: 0, nonWorkingMinutes: 0, totalMinutes: 0 };

function addTotals(first, second) {
  return {
    workingMinutes: first.workingMinutes + second.workingMinutes,
    nonWorkingMinutes: first.nonWorkingMinutes + second.nonWorkingMinutes,
    totalMinutes: first.totalMinutes + second.totalMinutes,
  };
}

export default function useMyHours() {
  const { user, loading: authLoading } = useAuth();
  const email = String(user?.email || "").trim().toLowerCase();
  const [events, setEvents] = useState([]);
  const [attendanceByEvent, setAttendanceByEvent] = useState({});
  const [meetings, setMeetings] = useState([]);
  const [attendanceByMeeting, setAttendanceByMeeting] = useState({});
  const [requests, setRequests] = useState([]);
  const [workLogs, setWorkLogs] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [meetingsLoading, setMeetingsLoading] = useState(true);
  const [meetingAttendanceLoading, setMeetingAttendanceLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [workLogsLoading, setWorkLogsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!db || authLoading || !user) {
      setEvents([]);
      setEventsLoading(false);
      return undefined;
    }
    setEventsLoading(true);
    const unsubscribe = onSnapshot(collection(db, "events"), (snapshot) => {
      setEvents(snapshot.docs.map((event) => ({ id: event.id, ...event.data() })));
      setEventsLoading(false);
    }, (snapshotError) => {
      console.error("My hours events listener:", snapshotError.code, snapshotError.message);
      setEvents([]);
      setEventsLoading(false);
      setError(`Could not load events (${snapshotError.code || "unknown"}).`);
    });
    return () => unsubscribe();
  }, [authLoading, user]);

  useEffect(() => {
    if (!db || authLoading || !user || !email) {
      setAttendanceByEvent({});
      setAttendanceLoading(false);
      return undefined;
    }
    if (events.length === 0) {
      setAttendanceByEvent({});
      setAttendanceLoading(false);
      return undefined;
    }
    setAttendanceLoading(true);
    const unsubscribers = events.map((event) => onSnapshot(
      doc(db, "events", event.id, "attendance", email),
      (snapshot) => {
        setAttendanceByEvent((current) => ({ ...current, [event.id]: snapshot.exists() ? snapshot.data() : null }));
        setAttendanceLoading(false);
      },
      (snapshotError) => {
        console.error("My hours attendance listener:", snapshotError.code, snapshotError.message);
        setError(`Could not load attendance (${snapshotError.code || "unknown"}).`);
        setAttendanceLoading(false);
      },
    ));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [authLoading, email, events, user]);

  useEffect(() => {
    if (!db || authLoading || !user) {
      setMeetings([]);
      setMeetingsLoading(false);
      return undefined;
    }
    setMeetingsLoading(true);
    const unsubscribe = onSnapshot(collection(db, "meetings"), (snapshot) => {
      setMeetings(snapshot.docs.map((meeting) => ({ id: meeting.id, ...meeting.data() })));
      setMeetingsLoading(false);
    }, (snapshotError) => {
      console.error("My hours meetings listener:", snapshotError.code, snapshotError.message);
      setMeetings([]);
      setMeetingsLoading(false);
      setError(`Could not load meetings (${snapshotError.code || "unknown"}).`);
    });
    return () => unsubscribe();
  }, [authLoading, user]);

  useEffect(() => {
    if (!db || authLoading || !user || !email) {
      setAttendanceByMeeting({});
      setMeetingAttendanceLoading(false);
      return undefined;
    }
    const savedMeetings = meetings.filter((meeting) => Boolean(meeting.attendanceSummary));
    if (savedMeetings.length === 0) {
      setAttendanceByMeeting({});
      setMeetingAttendanceLoading(false);
      return undefined;
    }
    setMeetingAttendanceLoading(true);
    let cancelled = false;
    Promise.all(savedMeetings.map(async (meeting) => {
      try {
        const snapshot = await getDoc(doc(db, "meetings", meeting.id, "attendance", email));
        return [meeting.id, snapshot.exists() ? snapshot.data() : null];
      } catch (snapshotError) {
        console.error("My hours meeting attendance read:", snapshotError.code, snapshotError.message);
        if (!cancelled) setError(`Could not load meeting attendance (${snapshotError.code || "unknown"}).`);
        return [meeting.id, null];
      }
    })).then((entries) => {
      if (cancelled) return;
      setAttendanceByMeeting(Object.fromEntries(entries));
      setMeetingAttendanceLoading(false);
    });
    return () => { cancelled = true; };
  }, [authLoading, email, meetings, user]);

  useEffect(() => {
    if (!db || authLoading || !user || !email) {
      setRequests([]);
      setTasksLoading(false);
      return undefined;
    }
    setTasksLoading(true);
    const unsubscribe = onSnapshot(
      query(collection(db, "completionRequests"), where("requestedBy", "==", email)),
      (snapshot) => {
        setRequests(snapshot.docs.filter((request) => request.data().status === "approved").map((request) => ({ id: request.id, ...request.data() })));
        setTasksLoading(false);
      },
      (snapshotError) => {
        console.error("My hours tasks listener:", snapshotError.code, snapshotError.message);
        setRequests([]);
        setTasksLoading(false);
        setError(`Could not load approved tasks (${snapshotError.code || "unknown"}).`);
      },
    );
    return () => unsubscribe();
  }, [authLoading, email, user]);

  useEffect(() => {
    if (!db || authLoading || !user || !email) {
      setWorkLogs([]);
      setWorkLogsLoading(false);
      return undefined;
    }
    setWorkLogsLoading(true);
    const unsubscribe = onSnapshot(
      query(collection(db, "workLogs"), where("memberEmail", "==", email)),
      (snapshot) => {
        setWorkLogs(snapshot.docs.map((log) => ({ id: log.id, ...log.data() })));
        setWorkLogsLoading(false);
      },
      (snapshotError) => {
        console.error("My hours work logs listener:", snapshotError.code, snapshotError.message);
        setWorkLogs([]);
        setWorkLogsLoading(false);
        setError(`Could not load work logs (${snapshotError.code || "unknown"}).`);
      },
    );
    return () => unsubscribe();
  }, [authLoading, email, user]);

  // Each task submission carries its own isWorkingDay flag (missing = working day)
  const taskTotalsByEvent = useMemo(() => [...requests, ...workLogs].reduce((result, request) => {
    const totals = sumRanges(request.timeEntries, request.isWorkingDay !== false);
    result[request.eventId] = addTotals(result[request.eventId] || EMPTY_TOTALS, totals);
    return result;
  }, {}), [requests, workLogs]);
  const taskCountByEvent = useMemo(() => [...requests, ...workLogs].reduce((result, request) => {
    result[request.eventId] = (result[request.eventId] || 0) + 1;
    return result;
  }, {}), [requests, workLogs]);

  const perEvent = useMemo(() => events.map((event) => {
    const attendance = attendanceByEvent[event.id];
    const isWorkingDay = (attendance?.isWorkingDay ?? event.attendanceSummary?.isWorkingDay) !== false;
    const eventTotals = attendance?.present === true
      ? splitRange(attendance.startTime, attendance.endTime, isWorkingDay)
      : EMPTY_TOTALS;
    const taskTotals = taskTotalsByEvent[event.id] || EMPTY_TOTALS;
    return {
      eventId: event.id,
      eventName: event.name || event.id,
      date: event.date || "",
      status: event.attendanceSummary
        ? attendance?.present === true ? "Present" : "Absent"
        : taskTotals.totalMinutes > 0 ? "Not recorded" : null,
      startTime: attendance?.startTime || event.attendanceSummary?.startTime || "",
      endTime: attendance?.endTime || event.attendanceSummary?.endTime || "",
      ...addTotals(eventTotals, taskTotals),
      eventTotals,
      taskTotals,
      taskCount: taskCountByEvent[event.id] || 0,
    };
  }).filter((item) => item.status || item.taskTotals.totalMinutes > 0).sort((first, second) => String(second.date).localeCompare(String(first.date))), [attendanceByEvent, events, taskCountByEvent, taskTotalsByEvent]);

  const totals = useMemo(() => perEvent.reduce((result, item) => addTotals(result, {
    workingMinutes: item.workingMinutes,
    nonWorkingMinutes: item.nonWorkingMinutes,
    totalMinutes: item.totalMinutes,
  }), EMPTY_TOTALS), [perEvent]);
  const eventSessionTotals = useMemo(() => events.reduce((result, event) => {
    if (!event.attendanceSummary) return result;
    const session = splitRange(
      event.attendanceSummary.startTime,
      event.attendanceSummary.endTime,
      event.attendanceSummary.isWorkingDay !== false,
    );
    return addTotals(result, session);
  }, EMPTY_TOTALS), [events]);
  const meetingSessionMinutes = useMemo(() => meetings.reduce((total, meeting) => {
    if (!meeting.attendanceSummary) return total;
    return total + meetingMinutes(meeting.attendanceSummary.startTime, meeting.attendanceSummary.endTime);
  }, 0), [meetings]);
  const meetingRows = useMemo(() => meetings
    .filter((meeting) => Boolean(meeting.attendanceSummary))
    .map((meeting) => {
      const attendance = attendanceByMeeting[meeting.id];
      const present = attendance?.present === true;
      const duration = present ? meetingMinutes(attendance.startTime, attendance.endTime) : null;
      return {
        meetingId: meeting.id,
        type: "Meeting",
        name: meeting.title || meeting.id,
        date: meeting.date || "",
        status: attendance ? present ? "Present" : "Absent" : "Not recorded",
        startTime: attendance?.startTime || meeting.attendanceSummary?.startTime || "",
        endTime: attendance?.endTime || meeting.attendanceSummary?.endTime || "",
        workingMinutes: null,
        nonWorkingMinutes: null,
        meetingMinutes: duration,
        totalMinutes: duration,
      };
    }), [attendanceByMeeting, meetings]);
  const rows = useMemo(() => [...perEvent.map((row) => ({ ...row, type: "Event", name: row.eventName, meetingMinutes: null })), ...meetingRows]
    .sort((first, second) => String(second.date).localeCompare(String(first.date))), [meetingRows, perEvent]);
  const fromEventsMinutes = useMemo(() => perEvent.reduce((total, item) => total + item.eventTotals.totalMinutes, 0), [perEvent]);
  const fromTasksMinutes = useMemo(() => Object.values(taskTotalsByEvent).reduce((total, item) => total + item.totalMinutes, 0), [taskTotalsByEvent]);
  const meetingTotalMinutes = useMemo(() => meetingRows.reduce((total, row) => total + (row.meetingMinutes || 0), 0), [meetingRows]);
  const recordedCount = useMemo(() => events.filter((event) => Boolean(event.attendanceSummary)).length, [events]);
  const presentCount = useMemo(() => events.filter((event) => event.attendanceSummary && attendanceByEvent[event.id]?.present === true).length, [attendanceByEvent, events]);
  const meetingRecordedCount = useMemo(() => meetingRows.length, [meetingRows]);
  const meetingPresentCount = useMemo(() => meetingRows.filter((row) => row.status === "Present").length, [meetingRows]);
  const combinedRecordedCount = useMemo(() => recordedCount + meetingRecordedCount, [meetingRecordedCount, recordedCount]);
  const combinedPresentCount = useMemo(() => presentCount + meetingPresentCount, [meetingPresentCount, presentCount]);

  return {
    loading: authLoading || eventsLoading || attendanceLoading || tasksLoading || workLogsLoading || meetingsLoading || meetingAttendanceLoading,
    error,
    totals,
    eventSessionTotals,
    meetingSessionMinutes,
    allSessionTotalMinutes: eventSessionTotals.totalMinutes + meetingSessionMinutes,
    fromEventsMinutes,
    fromTasksMinutes,
    perEvent,
    rows,
    meetingRows,
    meetingTotalMinutes,
    combinedTotals: { ...totals, totalMinutes: totals.totalMinutes + meetingTotalMinutes },
    attendancePercentage: recordedCount === 0 ? null : (presentCount / recordedCount) * 100,
    attendanceCount: presentCount,
    attendanceRecordedCount: recordedCount,
    combinedAttendancePercentage: combinedRecordedCount === 0 ? null : (combinedPresentCount / combinedRecordedCount) * 100,
    combinedAttendanceCount: combinedPresentCount,
    combinedAttendanceRecordedCount: combinedRecordedCount,
  };
}