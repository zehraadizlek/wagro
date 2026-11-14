/** Formats a date as YYYYMMDD (UTC), the format the climate API expects. */
export function ymd(d: Date): string {
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}${m}${day}`;
}

/**
 * Date range ending 7 days ago, because the data source publishes with a
 * delay of a few days.
 */
export function rangeFor(years: number): { start: string; end: string } {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 7);
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - years);
  return { start: ymd(start), end: ymd(end) };
}
