import { normaliseName } from "./names";
import { safeHttpUrl } from "../safeUrl";

// Pure parsing helpers for the daily events check (no server or database
// access, so they can be tested on their own).

export type FoundEvent = {
  /** Stable id in the source, e.g. "viralagenda:1828114" */
  key: string;
  name: string;
  start: string; // YYYY-MM-DD
  end?: string;
  city: string;
  venue?: string;
  url: string;
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decodeHtml(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

/** Viral Agenda tag pages: one <li class="viral-event …"> per event. Past ones are marked "finished". */
export function parseViralAgenda(html: string, pageUrl: string): FoundEvent[] {
  const out: FoundEvent[] = [];
  const items = html.split(/<li id="c\d+"/).slice(1);
  for (const item of items) {
    const head = item.slice(0, 600);
    if (/class="[^"]*\bfinished\b/.test(head)) continue;
    const id = /data-id="(\d+)"/.exec(head)?.[1];
    const path = /data-url="([^"]+)"/.exec(head)?.[1];
    const start = /data-date-start="(\d{4}-\d{2}-\d{2})/.exec(head)?.[1];
    const end = /data-date-end="(\d{4}-\d{2}-\d{2})/.exec(head)?.[1];
    const title = /class="viral-linked"[^>]*aria-label="([^"]+)"/.exec(item)?.[1] ?? /viral-event-title[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/.exec(item)?.[1];
    const city = /<span class="varios node-name">([\s\S]*?)<\/span>/.exec(item)?.[1];
    const venue = /class="viral-event-place"[^>]*>\s*<span>([\s\S]*?)<\/span>/.exec(item)?.[1];
    const link = safeHttpUrl(path, pageUrl);
    if (!id || !link || !start || !title || !city) continue;
    out.push({
      key: `viralagenda:${id}`,
      name: decodeHtml(title),
      start,
      end: end && end !== start ? end : undefined,
      city: decodeHtml(city),
      venue: venue ? decodeHtml(venue) : undefined,
      url: link,
    });
  }
  return out;
}

/** schema.org Event data in <script type="application/ld+json"> (used by many organisers' sites). */
export function parseJsonLd(html: string, pageUrl: string): FoundEvent[] {
  const out: FoundEvent[] = [];
  const host = new URL(pageUrl).hostname;
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    if (o["@graph"]) visit(o["@graph"]);
    const types = ([] as unknown[]).concat(o["@type"] ?? []).map(String);
    if (!types.some((t) => /Event$/.test(t))) return;
    const name = typeof o.name === "string" ? decodeHtml(o.name) : null;
    const start = typeof o.startDate === "string" ? o.startDate.slice(0, 10) : null;
    const end = typeof o.endDate === "string" ? o.endDate.slice(0, 10) : undefined;
    const loc = (Array.isArray(o.location) ? o.location[0] : o.location) as Record<string, unknown> | undefined;
    const address = loc?.address as Record<string, unknown> | string | undefined;
    const country = typeof address === "object" ? address?.addressCountry : undefined;
    if (country && !/^(PT|Portugal)$/i.test(String(typeof country === "object" ? (country as { name?: string }).name : country))) return;
    const city =
      typeof address === "object" && typeof address?.addressLocality === "string"
        ? address.addressLocality
        : typeof address === "string"
          ? address
          : null;
    if (!name || !start || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !city) return;
    out.push({
      key: `jsonld:${host}:${normaliseName(name)}:${start}`,
      name,
      start,
      end: end && end !== start && /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : undefined,
      city: decodeHtml(city),
      venue: typeof loc?.name === "string" ? decodeHtml(loc.name) : undefined,
      // Only http(s) links: a "javascript:" url must never become a clickable link.
      url: safeHttpUrl(o.url, pageUrl) ?? pageUrl,
    });
  };
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(m[1]!));
    } catch {
      // Ignore invalid blocks.
    }
  }
  return out;
}

/** True when robots.txt (for "*" or our agent) doesn't disallow the path. Missing robots.txt = allowed. */
export function robotsAllows(robots: string, path: string): boolean {
  let applies = false;
  let inGroup = false;
  const disallow: string[] = [];
  const allow: string[] = [];
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const [field, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (!field) continue;
    const f = field.toLowerCase();
    if (f === "user-agent") {
      if (!inGroup) applies = false;
      inGroup = true;
      if (value === "*" || /cosplaybuildplanner/i.test(value)) applies = true;
    } else {
      inGroup = false;
      if (!applies) continue;
      if (f === "disallow" && value) disallow.push(value);
      if (f === "allow" && value) allow.push(value);
    }
  }
  const matches = (rule: string) => {
    const re = new RegExp(`^${rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$")}`);
    return re.test(path);
  };
  const longest = (rules: string[]) => Math.max(-1, ...rules.filter(matches).map((r) => r.length));
  return longest(allow) >= longest(disallow);
}

