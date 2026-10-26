// Reads event details from an announcement text, usually an Instagram caption
// in Portuguese. Pure (no server code), so it also runs in the browser for
// "Fill in from post text". Best effort: everything it finds is a suggestion
// that a person reviews before the event is published.
import { knownCities, normaliseAddress, normaliseCity, normaliseVenue } from "./names";

export type CaptionEvent = {
  name?: string;
  /** YYYY-MM-DD */
  start?: string;
  end?: string;
  time?: string;
  venue?: string;
  address?: string;
  city?: string;
  tickets?: string;
};

const MONTHS: Record<string, number> = {
  janeiro: 1, jan: 1, january: 1,
  fevereiro: 2, fev: 2, february: 2, feb: 2,
  marco: 3, março: 3, mar: 3, march: 3,
  abril: 4, abr: 4, april: 4, apr: 4,
  maio: 5, mai: 5, may: 5,
  junho: 6, jun: 6, june: 6,
  julho: 7, jul: 7, july: 7,
  agosto: 8, ago: 8, august: 8, aug: 8,
  setembro: 9, set: 9, september: 9, sep: 9, sept: 9,
  outubro: 10, out: 10, october: 10, oct: 10,
  novembro: 11, nov: 11, november: 11,
  dezembro: 12, dez: 12, december: 12, dec: 12,
};
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

const pad = (n: number) => String(n).padStart(2, "0");

/** A day/month without a year means the next such day on or after the post date (allowing 7 days back). */
function withYear(day: number, month: number, year: number | undefined, ref: Date): string | undefined {
  if (day < 1 || day > 31 || month < 1 || month > 12) return undefined;
  let y = year ?? ref.getUTCFullYear();
  if (year === undefined) {
    const candidate = Date.UTC(y, month - 1, day);
    if (candidate < ref.getTime() - 7 * 86_400_000) y += 1;
  }
  const d = new Date(Date.UTC(y, month - 1, day));
  if (d.getUTCMonth() !== month - 1) return undefined; // e.g. 31 November
  return `${y}-${pad(month)}-${pad(day)}`;
}

function fullYear(y: string | undefined): number | undefined {
  if (!y) return undefined;
  const n = Number(y);
  return y.length === 2 ? 2000 + n : n;
}

/** First date (or date range) in the text. Day lists ("29, 30 e 31 de outubro") use the first and last day. */
export function findDates(text: string, ref: Date): { start?: string; end?: string } {
  const t = text.toLowerCase().normalize("NFC");
  const sep = String.raw`\s*(?:,|e|a|até|-|–|/|&)\s*`;
  // "15 e 16 de maio de 2027", "29, 30 e 31 de outubro", "7 de novembro", "15-16 May 2027"
  const words = new RegExp(
    String.raw`\b(\d{1,2})((?:${sep}\d{1,2})*)\s*(?:de\s+)?(${MONTH_RE})\.?(?:\s*(?:de\s+)?(\d{4}))?`,
    "i",
  );
  // "22/11", "22.11.2026", "21 e 22/11", "21-22.11"
  const numeric = /\b(\d{1,2})((?:\s*(?:,|e|a|-|–)\s*\d{1,2})*)[./](\d{1,2})(?:[./](\d{2,4}))?\b/;
  const w = words.exec(t);
  const n = numeric.exec(t);
  const m = w && (!n || w.index <= n.index) ? w : n;
  if (!m) return {};
  const month = m === w ? MONTHS[m[3]!.replace(".", "")]! : Number(m[3]);
  const year = fullYear(m[4]);
  const days = [Number(m[1]), ...(m[2]?.match(/\d{1,2}/g) ?? []).map(Number)];
  const start = withYear(days[0]!, month, year, ref);
  const last = days[days.length - 1]!;
  const end = days.length > 1 ? withYear(last, month, year ?? (start ? Number(start.slice(0, 4)) : undefined), ref) : undefined;
  return { start, end: end && start && end > start ? end : undefined };
}

/** "das 11h às 19h", "11h-19h", "10:00 – 18:00", "a partir das 15h" */
export function findTime(text: string): string | undefined {
  const range = /(\d{1,2})(?:[h:](\d{2})?|h)\s*(?:-|–|às|as|até|a)\s*(\d{1,2})(?:[h:](\d{2})?|h)/i.exec(text);
  const fmt = (h: string, m?: string) => `${Number(h)}h${m && m !== "00" ? m : ""}`;
  if (range) return `${fmt(range[1]!, range[2])}–${fmt(range[3]!, range[4])}`;
  const single = /(?:às|as|a partir das|from)\s*(\d{1,2})(?:[h:](\d{2})?|h)/i.exec(text);
  return single ? `${fmt(single[1]!, single[2])}` : undefined;
}

const STREET = /\b(?:Rua|R\.|Avenida|Av\.?|Praça|Pç\.?|Largo|Lg\.?|Travessa|Tv\.?|Estrada|Alameda|Calçada|Rotunda|Parque|Campo)\s+[^\n,]{2,80}?(?:,?\s*n\.?º?\s*)?\d{1,4}[A-Za-z]?\b/i;
const POSTAL = /\b(\d{4})\s*[-–]\s*(\d{3})\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'-]{1,40})/;

function stripDecorations(line: string): string {
  return line
    .replace(/[\p{Extended_Pictographic}️‍]/gu, " ")
    .replace(/#[\p{L}\p{N}_]+/gu, " ")
    .replace(/@[\w.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Best-effort event details from an announcement text. `ref` is the post date (for dates without a year). */
export function extractEvent(text: string, ref: Date = new Date()): CaptionEvent {
  const out: CaptionEvent = {};
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Name: first line with letters, without emoji/hashtags.
  const first = lines.map(stripDecorations).find((l) => /\p{L}{3}/u.test(l));
  if (first) out.name = first.replace(/[!.:]+$/, "").slice(0, 120);

  const { start, end } = findDates(text, ref);
  if (start) out.start = start;
  if (end) out.end = end;
  out.time = findTime(text);

  // Location: a 📍 line if there is one (organisers use it a lot), else address-looking text.
  const pinLine = lines.find((l) => /📍|\blocal\s*:|\blocation\s*:|\bonde\s*:/iu.test(l));
  const placeText = pinLine
    ? stripDecorations(pinLine).replace(/^(local|location|onde)\s*:\s*/i, "")
    : undefined;
  const street = STREET.exec(placeText ?? text);
  if (street) out.address = normaliseAddress(street[0]);
  const postal = POSTAL.exec(placeText ?? text);
  if (postal) {
    out.city = normaliseCity(postal[3]!.split(/[,.\n]/)[0]!.trim());
    if (out.address && !out.address.includes(postal[1]!)) out.address = `${out.address}, ${postal[1]}-${postal[2]}`;
  }
  if (placeText) {
    // "CCBombarda, Rua de Miguel Bombarda 285, Porto" → venue = the part before the street.
    const parts = placeText.split(/\s*[,|–-]\s+/).filter(Boolean);
    const venuePart = parts.find((p) => !STREET.test(p) && !POSTAL.test(p) && !knownCities().some((c) => c.toLowerCase() === p.toLowerCase()));
    if (venuePart && venuePart.length <= 120) out.venue = normaliseVenue(venuePart);
  }
  if (!out.city) {
    const scope = (placeText ?? text).toLowerCase();
    const city = [...knownCities()].sort((a, b) => b.length - a.length).find((c) => new RegExp(`\\b${c.toLowerCase()}\\b`, "u").test(scope));
    if (city) out.city = city;
  }

  const ticket = lines.find((l) => /🎟|🎫|bilhete|ingresso|entrada|tickets?\b|€/iu.test(l));
  if (ticket) out.tickets = stripDecorations(ticket).slice(0, 200);
  return out;
}
