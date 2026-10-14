// ============================================================
// DATE HELPERS
// Records are keyed by local calendar day (YYYY-MM-DD). Keys are
// always built and parsed in the viewer's time zone so a day never
// shifts when the offset from UTC is negative.
// ============================================================

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateKey(key: string): Date {
  return new Date(`${key}T00:00:00`);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((parseDateKey(toKey).getTime() - parseDateKey(fromKey).getTime()) / 86_400_000);
}

/** `length` consecutive day keys, oldest first, ending `offset` days before `anchor`. */
export function windowKeys(anchor: string, length: number, offset = 0): string[] {
  return Array.from({ length }, (_, i) => addDays(anchor, -offset - (length - 1 - i)));
}

export function dayLetter(key: string): string {
  return parseDateKey(key).toLocaleDateString('en-US', { weekday: 'narrow' });
}

/** "6 Oct" */
export function shortDate(key: string): string {
  const d = parseDateKey(key);
  return `${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`;
}

/** "Tue 6 Oct 2026" */
export function longDate(key: string): string {
  const d = parseDateKey(key);
  return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${shortDate(key)} ${d.getFullYear()}`;
}

/** "Today", "Yesterday" or "6 Oct" */
export function relativeDay(key: string): string {
  const diff = daysBetween(key, todayKey());
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return shortDate(key);
}

export function formatRange(startKey: string, endKey: string): string {
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = sameMonth ? String(start.getDate()) : shortDate(startKey);
  return `${startLabel} – ${shortDate(endKey)}, ${end.getFullYear()}`;
}

/** Latest day key present in any of the given record lists, or null when all are empty. */
export function latestDateKey(...lists: { date: string }[][]): string | null {
  let latest: string | null = null;
  for (const list of lists) {
    for (const item of list) {
      if (latest === null || item.date > latest) latest = item.date;
    }
  }
  return latest;
}
