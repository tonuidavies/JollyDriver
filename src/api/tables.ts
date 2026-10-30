/**
 * Most `reports/*` endpoints return the same table the web report pages render:
 *
 *   { summary: [{label, value}], columns: [{label, align?}],
 *     rows: [[{text, align?, weight?, isPill?, pillBg?, pillColor?}, …]], chart }
 *
 * Values arrive pre-formatted ("KES 9,385", "85%"), so read them by column label
 * and parse numbers out of the text only where a figure is needed.
 */
export type ReportCell = {
  text?: string | number | null;
  align?: string;
  weight?: string;
  isPill?: boolean;
  pillBg?: string;
  pillColor?: string;
};

export type ReportTable = {
  summary: { label: string; value: string }[];
  columns: { label: string; align?: string }[];
  rows: ReportCell[][];
};

/** The table inside a report response, or null when it isn't one. */
export function asTable(res: any): ReportTable | null {
  const d = res?.data ?? res;
  if (!d || !Array.isArray(d.columns) || !Array.isArray(d.rows)) return null;
  return {
    summary: Array.isArray(d.summary)
      ? d.summary.map((s: any) => ({ label: String(s?.label ?? ''), value: String(s?.value ?? '') }))
      : [],
    columns: d.columns.map((c: any) => ({ label: String(c?.label ?? ''), align: c?.align })),
    rows: d.rows.filter(Array.isArray),
  };
}

/** Rows as `{ [column label]: cell text }`. */
export function rowObjects(t: ReportTable): Record<string, string>[] {
  return t.rows.map((r) =>
    Object.fromEntries(t.columns.map((c, i) => [c.label, r[i]?.text == null ? '' : String(r[i]?.text)]))
  );
}

/** "KES 9,385" → 9385, "85%" → 85, "-1,200" → -1200, "" → 0. */
export function figure(text: unknown): number {
  if (typeof text === 'number') return Number.isFinite(text) ? text : 0;
  const m = String(text ?? '').replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
}
