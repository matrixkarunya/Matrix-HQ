"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useSemester } from "@/context/SemesterContext";
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
  const { selectedSemesterId, loading: semesterLoading } = useSemester();
  const email = String(user?.email || "").trim().toLowerCase();
  const [allEvents, setAllEvents] = useState([]);
  const [attendanceByEvent, setAttendanceByEvent] = useState({});
  const [allMeetings, setAllMeetings] = useState([]);
  const [attendanceByMeeting, setAttendanceByMeeting] = useState({});
  const [allWorks, setAllWorks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [workLogs, setWorkLogs] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [meetingsLoading, setMeetingsLoading] = useState(true);
  const [meetingAttendanceLoading, setMeetingAttendanceLoading] = useState(true);
  const [worksLoading, setWorksLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [workLogsLoading, setWorkLogsLoading] = useState(true);
  const [error, setError] = useState("");

  // Only the selected semester's events, meetings and works count. Attendance, task hours
  // and requests follow their event.
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

  useEffect(() => {
    if (!db || authLoading || !user) {
      setAllEvents([]);
      setEventsLoading(false);
      return undefined;
    }
    setEventsLoading(true);
    const unsubscribe = onSnapshot(collection(db, "events"), (snapshot) => {
      setAllEvents(snapshot.docs.map((event) => ({ id: event.id, ...event.data() })));
      setEventsLoading(false);
    }, (snapshotError) => {
      console.error("My hours events listener:", snapshotError.code, snapshotError.message);
      setAllEvents([]);
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
      setAllMeetings([]);
      setMeetingsLoading(false);
      return undefined;
    }
    setMeetingsLoading(true);
    const unsubscribe = onSnapshot(collection(db, "meetings"), (snapshot) => {
      setAllMeetings(snapshot.docs.map((meeting) => ({ id: meeting.id, ...meeting.data() })));
      setMeetingsLoading(false);
    }, (snapshotError) => {
      console.error("My hours meetings listener:", snapshotError.code, snapshotError.message);
      setAllMeetings([]);
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

  // Works I took part in
  useEffect(() => {
    if (!db || authLoading || !user || !email) {
      setAllWorks([]);
      setWorksLoading(false);
      return undefined;
    }
    setWorksLoading(true);
    const unsubscribe = onSnapshot(
      query(collection(db, "works"), where("participants", "array-contains", email)),
      (snapshot) => {
        setAllWorks(snapshot.docs.map((work) => ({ id: work.id, ...work.data() })));
        setWorksLoading(false);
      },
      (snapshotError) => {
        console.error("My hours works listener:", snapshotError.code, snapshotError.message);
        setAllWorks([]);
        setWorksLoading(false);
        setError(`Could not load works (${snapshotError.code || "unknown"}).`);
      },
    );
    return () => unsubscribe();
  }, [authLoading, email, user]);

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

  // Task submissions only count when their event is in the selected semester.
  const semesterTasks = useMemo(
    () => [...requests, ...workLogs].filter((item) => eventIdSet.has(item.eventId)),
    [eventIdSet, requests, workLogs],
  );
  const taskTotalsByEvent = useMemo(() => semesterTasks.reduce((result, request) => {
    const totals = sumRanges(request.timeEntries, request.isWorkingDay !== false);
    result[request.eventId] = addTotals(result[request.eventId] || EMPTY_TOTALS, totals);
    return result;
  }, {}), [semesterTasks]);
  const taskCountByEvent = useMemo(() => semesterTasks.reduce((result, request) => {
    result[request.eventId] = (result[request.eventId] || 0) + 1;
    return result;
  }, {}), [semesterTasks]);

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

  // Works have no present/absent: if I'm a participant, the hours are mine.
  const workRows = useMemo(() => works.map((work) => {
    const split = splitRange(work.startTime, work.endTime, work.isWorkingDay !== false);
    return {
      workId: work.id,
      type: "Work",
      name: work.title || work.id,
      date: work.date || "",
      status: null,
      startTime: work.startTime || "",
      endTime: work.endTime || "",
      workingMinutes: split.workingMinutes,
      nonWorkingMinutes: split.nonWorkingMinutes,
      meetingMinutes: null,
      totalMinutes: split.totalMinutes,
    };
  }), [works]);
  const workTotals = useMemo(() => workRows.reduce((result, row) => addTotals(result, {
    workingMinutes: row.workingMinutes,
    nonWorkingMinutes: row.nonWorkingMinutes,
    totalMinutes: row.totalMinutes,
  }), EMPTY_TOTALS), [workRows]);

  // Working / non-working hours: attended events + approved tasks + works
  const totals = useMemo(() => addTotals(perEvent.reduce((result, item) => addTotals(result, {
    workingMinutes: item.workingMinutes,
    nonWorkingMinutes: item.nonWorkingMinutes,
    totalMinutes: item.totalMinutes,
  }), EMPTY_TOTALS), workTotals), [perEvent, workTotals]);
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
  const rows = useMemo(() => [
    ...perEvent.map((row) => ({ ...row, type: "Event", name: row.eventName, meetingMinutes: null })),
    ...meetingRows,
    ...workRows,
  ].sort((first, second) => String(second.date).localeCompare(String(first.date))), [meetingRows, perEvent, workRows]);
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
    loading: authLoading || semesterLoading || eventsLoading || attendanceLoading || tasksLoading || workLogsLoading || meetingsLoading || meetingAttendanceLoading || worksLoading,
    error,
    semesterId: selectedSemesterId,
    totals,
    workTotals,
    eventSessionTotals,
    meetingSessionMinutes,
    allSessionTotalMinutes: eventSessionTotals.totalMinutes + workTotals.totalMinutes + meetingSessionMinutes,
    fromEventsMinutes,
    fromTasksMinutes,
    perEvent,
    rows,
    meetingRows,
    workRows,
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