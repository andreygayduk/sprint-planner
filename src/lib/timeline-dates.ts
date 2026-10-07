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
