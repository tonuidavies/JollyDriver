/** Currency + number formatting, per design spec ("KES 1,250"). */
export function kes(amount: number, withCode = true): string {
  const n = Math.round(amount || 0);
  const formatted = Math.abs(n).toLocaleString('en-KE');
  const sign = n < 0 ? '- ' : '';
  return `${sign}${withCode ? 'KES ' : ''}${formatted}`;
}

export function kesShort(amount: number): string {
  const abs = Math.abs(amount || 0);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${Math.round(abs)}`;
}

export function initialsOf(name?: string): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function titleCase(s?: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Normalize any Kenyan phone entry to MSISDN (`254` + last 9 digits).
 * Accepts 0723xxxxxx, 2547xxxxxxx, +2547xxxxxxx, 7xxxxxxxx, etc.
 */
export function toMsisdn(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  const last9 = digits.slice(-9);
  return last9.length === 9 ? `254${last9}` : digits;
}
