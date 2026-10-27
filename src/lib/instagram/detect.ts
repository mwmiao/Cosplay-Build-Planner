// Decides whether a post announces an event, and reads its details.
// Deterministic (keywords + the Portuguese date/place reader); no external AI.
import { type CaptionEvent, extractEvent } from "../events/caption";

const KEYWORDS: [RegExp, string][] = [
  [/\bcosplay(s|ers?)?\b/i, "cosplay"],
  [/\b(con|convention|convenção|convencao)\b/i, "convention"],
  [/\bevent[oa]?s?\b/i, "event"],
  [/\b(meet-?ups?|encontros?)\b/i, "meetup"],
  [/\b(photo-?shoots?|shootings?|sess(ão|ao|ões|oes) fotogr[aá]ficas?)\b/i, "photoshoot"],
  [/\b(contests?|concursos?|competi[çc](ão|ao|ões))\b/i, "contest"],
  [/\bworkshops?\b/i, "workshop"],
  [/\b(tickets?|bilhetes?|ingressos?|entrada livre|entrada gratuita|inscri[çc](ões|oes|ão))\b/i, "tickets"],
  [/\b(feira|mercado|market|festival|expo)\b/i, "market"],
];

export type Detection = {
  /** 0–100 */
  confidence: number;
  /** "high" = reasonable to propose as an event; "low" = possible event, needs review; "none" = not an event */
  level: "high" | "low" | "none";
  reasons: string[];
  fields: CaptionEvent & { ticketUrl?: string };
};

const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/gi;

/** `ref` = when the post was published (dates without a year are read relative to it). */
export function detectEvent(text: string, ref: Date): Detection {
  const fields: Detection["fields"] = extractEvent(text, ref);
  const reasons: string[] = [];
  let score = 0;
  const hits = KEYWORDS.filter(([re]) => re.test(text)).map(([, k]) => k);
  if (hits.length) {
    score += Math.min(3, hits.length);
    reasons.push(`keywords: ${hits.join(", ")}`);
  }
  if (fields.start) {
    score += 3;
    reasons.push(fields.end ? `dates ${fields.start}–${fields.end}` : `date ${fields.start}`);
  }
  if (fields.time) {
    score += 1;
    reasons.push(`time ${fields.time}`);
  }
  if (fields.venue || fields.address) {
    score += 2;
    reasons.push("venue/address");
  } else if (fields.city) {
    score += 1;
    reasons.push(`city ${fields.city}`);
  }
  const ticketUrl = text.match(URL_RE)?.find((u) => /ticket|bilhete|bol\.pt|eventbrite|seetickets|shotgun|blueticket|ticketline/i.test(u));
  if (ticketUrl) {
    fields.ticketUrl = ticketUrl;
    reasons.push("ticket link");
  }
  const confidence = Math.min(100, Math.round((score / 9) * 100));
  const level = fields.start && hits.length && (fields.venue || fields.address || fields.city) ? "high" : score >= 2 ? "low" : "none";
  return { confidence, level, reasons, fields };
}
