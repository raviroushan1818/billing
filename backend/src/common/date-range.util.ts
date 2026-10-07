/** Parse YYYY-MM-DD as start of that calendar day (UTC). */
export function startOfDay(isoDate: string): Date {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${isoDate}`);
  }
  return d;
}

/** Parse YYYY-MM-DD as end of that calendar day (UTC). */
export function endOfDay(isoDate: string): Date {
  const d = new Date(`${isoDate}T23:59:59.999Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${isoDate}`);
  }
  return d;
}

export function parseDateRange(from: string, to: string): { from: Date; to: Date } {
  return { from: startOfDay(from), to: endOfDay(to) };
}

/** India Standard Time offset (UTC+05:30); the business day for payments. */
const IST_OFFSET_MS = 330 * 60 * 1000;

/** Calendar date (YYYY-MM-DD) of an instant, as seen in IST. */
export function istDateOf(instant: Date): string {
  return new Date(instant.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Instant bounds of IST calendar days, for filtering real timestamps (paidAt etc). */
export function parseIstDateRange(from: string, to: string): { from: Date; to: Date } {
  return {
    from: new Date(startOfDay(from).getTime() - IST_OFFSET_MS),
    to: new Date(endOfDay(to).getTime() - IST_OFFSET_MS),
  };
}

/** Whole days from a calendar date (YYYY-MM-DD) to the IST date of an instant. */
export function istDaysSince(calendarDate: Date, instant: Date): number {
  const a = Date.parse(`${calendarDate.toISOString().slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${istDateOf(instant)}T00:00:00Z`);
  return Math.max(0, Math.round((b - a) / 86_400_000));
}
