export type WorkLaneValue = "development" | "feature_testing";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function toDayString(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  return value.toISOString().slice(0, 10);
}

export function parseDay(day: string) {
  return new Date(`${day}T00:00:00.000Z`);
}

export function addDays(day: string, days: number) {
  const date = parseDay(day);
  date.setUTCDate(date.getUTCDate() + days);
  return toDayString(date);
}

export function daysBetween(start: string, end: string) {
  return Math.round((parseDay(end).getTime() - parseDay(start).getTime()) / MS_PER_DAY);
}

export function enumerateDays(start: string, end: string) {
  const days: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function clampDay(day: string, min: string, max: string) {
  if (day < min) return min;
  if (day > max) return max;
  return day;
}

export function isWeekend(day: string) {
  const weekday = parseDay(day).getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function holidaySet(days: Iterable<string>) {
  return new Set(days);
}

export function isNonWorkingDay(day: string, holidays: ReadonlySet<string>) {
  return isWeekend(day) || holidays.has(day);
}

export function nextWorkingDay(day: string, holidays: ReadonlySet<string>) {
  let cursor = day;
  while (isNonWorkingDay(cursor, holidays)) {
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

export function previousWorkingDay(day: string, holidays: ReadonlySet<string>) {
  let cursor = day;
  while (isNonWorkingDay(cursor, holidays)) {
    cursor = addDays(cursor, -1);
  }
  return cursor;
}

/** Move `start` by `delta` working days (can be negative). */
export function addWorkingDays(
  start: string,
  delta: number,
  holidays: ReadonlySet<string>,
) {
  if (delta === 0) {
    return nextWorkingDay(start, holidays);
  }

  let cursor = start;
  let remaining = Math.abs(delta);
  const step = delta > 0 ? 1 : -1;

  while (remaining > 0) {
    cursor = addDays(cursor, step);
    if (!isNonWorkingDay(cursor, holidays)) {
      remaining -= 1;
    }
  }

  return cursor;
}

export function workingDaysBetween(
  start: string,
  end: string,
  holidays: ReadonlySet<string>,
): number {
  if (end < start) {
    return -workingDaysBetween(end, start, holidays);
  }

  let count = 0;
  let cursor = start;
  while (cursor <= end) {
    if (!isNonWorkingDay(cursor, holidays)) {
      count += 1;
    }
    cursor = addDays(cursor, 1);
  }
  return count;
}

export function enumerateWorkingDays(
  start: string,
  end: string,
  holidays: ReadonlySet<string>,
) {
  return enumerateDays(start, end).filter(
    (day) => !isNonWorkingDay(day, holidays),
  );
}

/**
 * Shift a calendar-inclusive range by `deltaDays` calendar columns while
 * preserving working-day duration for the assignee.
 */
export function shiftWorkingRange(
  start: string,
  end: string,
  deltaDays: number,
  holidays: ReadonlySet<string>,
) {
  const duration = Math.max(
    0,
    workingDaysBetween(start, end, holidays) - 1,
  );
  const rawStart = addDays(start, deltaDays);
  const nextStart = nextWorkingDay(rawStart, holidays);
  const nextEnd = addWorkingDays(nextStart, duration, holidays);
  return { startDate: nextStart, endDate: nextEnd };
}

export function resizeWorkingStart(
  start: string,
  end: string,
  deltaDays: number,
  holidays: ReadonlySet<string>,
) {
  const rawStart = addDays(start, deltaDays);
  let nextStart = nextWorkingDay(rawStart, holidays);
  if (nextStart > end) {
    nextStart = previousWorkingDay(end, holidays);
  }
  return nextStart;
}

export function resizeWorkingEnd(
  start: string,
  end: string,
  deltaDays: number,
  holidays: ReadonlySet<string>,
) {
  const rawEnd = addDays(end, deltaDays);
  let nextEnd =
    deltaDays >= 0
      ? nextWorkingDay(rawEnd, holidays)
      : previousWorkingDay(rawEnd, holidays);
  if (nextEnd < start) {
    nextEnd = nextWorkingDay(start, holidays);
  }
  return nextEnd;
}

export function defaultWorkingEnd(
  start: string,
  holidays: ReadonlySet<string>,
  workingSpan = 2,
) {
  const snapped = nextWorkingDay(start, holidays);
  return addWorkingDays(snapped, workingSpan, holidays);
}

export function computeVisibleRange(inputs: {
  sprintStarts: string[];
  sprintEnds: string[];
  blockStarts: string[];
  blockEnds: string[];
  today?: string;
}) {
  const today = inputs.today ?? toDayString(new Date());
  const all = [
    ...inputs.sprintStarts,
    ...inputs.sprintEnds,
    ...inputs.blockStarts,
    ...inputs.blockEnds,
  ].filter(Boolean);

  if (all.length === 0) {
    return {
      start: addDays(today, -14),
      end: addDays(today, 14),
    };
  }

  const start = all.reduce((min, day) => (day < min ? day : min));
  const end = all.reduce((max, day) => (day > max ? day : max));
  return { start, end };
}

/** Assign non-overlapping stack rows within a lane. */
export function stackRows(
  blocks: { id: string; startDate: string; endDate: string }[],
) {
  const sorted = [...blocks].sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
    return a.endDate.localeCompare(b.endDate);
  });
  const rowEnds: string[] = [];
  const rows = new Map<string, number>();

  for (const block of sorted) {
    let row = rowEnds.findIndex((end) => end < block.startDate);
    if (row < 0) {
      row = rowEnds.length;
      rowEnds.push(block.endDate);
    } else {
      rowEnds[row] = block.endDate;
    }
    rows.set(block.id, row);
  }

  return { rows, rowCount: Math.max(rowEnds.length, 1) };
}
