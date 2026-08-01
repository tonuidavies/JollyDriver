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

export function prettyDate(d: Date = new Date()): string {
  return d.toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}
