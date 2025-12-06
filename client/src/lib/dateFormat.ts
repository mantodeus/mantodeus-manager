export type DateInput = Date | string | null | undefined;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function normalizeDate(value: DateInput): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatShortDate(date: Date): string {
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

function sortAndDeduplicateDates(dates: Date[]): Date[] {
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  return sorted.reduce<Date[]>((acc, current) => {
    if (acc.length === 0) {
      acc.push(current);
      return acc;
    }
    const last = acc[acc.length - 1];
    if (!isSameDay(last, current)) {
      acc.push(current);
    }
    return acc;
  }, []);
}

function formatDateSegments(dates: Date[]): string[] {
  if (dates.length === 0) return [];

  const normalized = sortAndDeduplicateDates(dates);
  const segments: string[] = [];
  let rangeStart = normalized[0];
  let previous = normalized[0];

  for (let i = 1; i < normalized.length; i++) {
    const current = normalized[i];
    const diffDays = Math.round((current.getTime() - previous.getTime()) / DAY_IN_MS);
    if (diffDays === 1) {
      previous = current;
      continue;
    }

    segments.push(buildSegment(rangeStart, previous));
    rangeStart = current;
    previous = current;
  }

  segments.push(buildSegment(rangeStart, previous));
  return segments;
}

function buildSegment(start: Date, end: Date): string {
  if (isSameDay(start, end)) {
    return formatShortDate(start);
  }
  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
}

export function formatProjectSchedule(options: {
  dates?: (Date | string)[] | null;
  start?: DateInput;
  end?: DateInput;
}): { label: string; primaryDate: Date | null } {
  const normalizedDates = options.dates
    ? options.dates
        .map((value) => normalizeDate(value))
        .filter((value): value is Date => Boolean(value))
    : [];

  if (normalizedDates.length > 0) {
    const segments = formatDateSegments(normalizedDates);
    return {
      label: segments.join(", "),
      primaryDate: sortAndDeduplicateDates(normalizedDates)[0] ?? null,
    };
  }

  const startDate = normalizeDate(options.start);
  const endDate = normalizeDate(options.end);

  if (startDate && endDate) {
    if (isSameDay(startDate, endDate)) {
      return { label: formatShortDate(startDate), primaryDate: startDate };
    }
    return {
      label: `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`,
      primaryDate: startDate,
    };
  }

  if (startDate) {
    return { label: formatShortDate(startDate), primaryDate: startDate };
  }

  if (endDate) {
    return { label: formatShortDate(endDate), primaryDate: endDate };
  }

  return { label: "Not scheduled", primaryDate: null };
}
