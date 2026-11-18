import { WORK_END_MINUTES, WORK_START_MINUTES } from "@/lib/config";

export function toMinutes(value) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function toTimeString(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

const EMPTY_TOTALS = { workingMinutes: 0, nonWorkingMinutes: 0, totalMinutes: 0 };

// Working day: 09:00 to 16:00 is working, everything outside it is non-working.
// Non-working day (isWorkingDay === false): every minute is non-working.
export function splitRange(startTime, endTime, isWorkingDay = true) {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start === null || end === null || end <= start) {
    return { ...EMPTY_TOTALS };
  }
  const totalMinutes = end - start;
  if (isWorkingDay === false) {
    return { workingMinutes: 0, nonWorkingMinutes: totalMinutes, totalMinutes };
  }
  const workingMinutes = Math.max(0, Math.min(end, WORK_END_MINUTES) - Math.max(start, WORK_START_MINUTES));
  return { workingMinutes, nonWorkingMinutes: totalMinutes - workingMinutes, totalMinutes };
}

export function meetingMinutes(startTime, endTime) {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  return start === null || end === null || end <= start ? 0 : end - start;
}

export function sumRanges(ranges, isWorkingDay = true) {
  return (Array.isArray(ranges) ? ranges : []).reduce((total, range) => {
    const split = splitRange(range?.startTime, range?.endTime, isWorkingDay);
    return {
      workingMinutes: total.workingMinutes + split.workingMinutes,
      nonWorkingMinutes: total.nonWorkingMinutes + split.nonWorkingMinutes,
      totalMinutes: total.totalMinutes + split.totalMinutes,
    };
  }, { ...EMPTY_TOTALS });
}

// Merges overlapping or touching ranges into one set, so the same clock time
// logged by several members is only counted once.
export function mergeRanges(ranges) {
  const sorted = (Array.isArray(ranges) ? ranges : [])
    .map((range) => [toMinutes(range?.startTime), toMinutes(range?.endTime)])
    .filter(([start, end]) => start !== null && end !== null && end > start)
    .sort((first, second) => first[0] - second[0]);

  const merged = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged.map(([start, end]) => ({ startTime: toTimeString(start), endTime: toTimeString(end) }));
}

// groups = array of { ranges, isWorkingDay }, one entry per event.
// A plain array of ranges is also accepted and treated as a working day.
// Each event is merged on its own, then the per-event totals are added together.
export function sumMergedGroups(groups) {
  return (Array.isArray(groups) ? groups : []).reduce((total, group) => {
    const ranges = Array.isArray(group) ? group : group?.ranges;
    const isWorkingDay = Array.isArray(group) ? true : group?.isWorkingDay !== false;
    const split = sumRanges(mergeRanges(ranges), isWorkingDay);
    return {
      workingMinutes: total.workingMinutes + split.workingMinutes,
      nonWorkingMinutes: total.nonWorkingMinutes + split.nonWorkingMinutes,
      totalMinutes: total.totalMinutes + split.totalMinutes,
    };
  }, { ...EMPTY_TOTALS });
}

// Same idea for meetings: merge per event, then add the durations.
export function sumMergedMeetingMinutes(groups) {
  return (Array.isArray(groups) ? groups : []).reduce(
    (total, ranges) =>
      total + mergeRanges(ranges).reduce((sum, range) => sum + meetingMinutes(range.startTime, range.endTime), 0),
    0,
  );
}

export function formatMinutes(minutes) {
  const safeMinutes = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
}

export function validateRanges(ranges) {
  if (!Array.isArray(ranges) || ranges.length < 1 || ranges.length > 10) {
    return { valid: false, error: "Add between 1 and 10 time ranges." };
  }
  const normalized = ranges.map((range) => ({
    start: toMinutes(range?.startTime),
    end: toMinutes(range?.endTime),
  }));
  if (normalized.some(({ start, end }) => start === null || end === null)) {
    return { valid: false, error: "Enter both start and end times." };
  }
  if (normalized.some(({ start, end }) => end <= start)) {
    return { valid: false, error: "End time must be after start time." };
  }
  for (let index = 0; index < normalized.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < normalized.length; otherIndex += 1) {
      if (normalized[index].start < normalized[otherIndex].end && normalized[otherIndex].start < normalized[index].end) {
        return { valid: false, error: "Times must not overlap." };
      }
    }
  }
  return { valid: true, error: "" };
}