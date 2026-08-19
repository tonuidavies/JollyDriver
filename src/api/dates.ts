/** Small date helpers — API expects YYYY-MM-DD and defaults to today. */
export function ymd(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfMonth(d: Date = new Date()): string {
  return ymd(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function prettyMonth(d: Date = new Date()): string {
  return d.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
}

/** N days before today, as YYYY-MM-DD. */
export function daysAgo(n: number, d: Date = new Date()): string {
  const c = new Date(d);
  c.setDate(c.getDate() - n);
  return ymd(c);
}

/** Current calendar month as YYYY-MM (what the monthly reports expect). */
export function currentMonth(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export type RangePreset = 'today' | '7d' | '30d' | '90d' | 'month';

/** from/to pair for a preset. Reports default to today or the last 7 days server-side. */
export function rangeFor(preset: RangePreset): { from: string; to: string } {
  const to = ymd();
  switch (preset) {
    case 'today': return { from: to, to };
    case '30d': return { from: daysAgo(29), to };
    case '90d': return { from: daysAgo(89), to };
    case 'month': return { from: startOfMonth(), to };
    case '7d':
    default: return { from: daysAgo(6), to };
  }
}

export function prettyDate(d: Date = new Date()): string {
  return d.toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}
