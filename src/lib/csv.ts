type Cell = string | number | boolean | null | undefined;

/** Quotes a CSV cell and neutralises spreadsheet formula injection (=, +, -, @). */
function cell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // A plain money amount such as "-12.50" (budget export) is a number, not a formula.
  const isPlainAmount = typeof value === "string" && /^-\d+\.\d{2}$/.test(s);
  if (typeof value === "string" && !isPlainAmount && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Cell[][]): string {
  // BOM so Excel opens UTF-8 (accents, emoji) correctly.
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, rows: Cell[][]): Response {
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]/g, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function centsToDecimal(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? "" : (cents / 100).toFixed(2);
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
