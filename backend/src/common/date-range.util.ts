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
