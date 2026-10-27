// Small RSS 2.0 / Atom reader (no dependencies). Pure, so it's unit-tested
// with fixture feeds. Reads only what the monitor needs; unknown markup is
// ignored rather than failing the whole feed.
import type { InstagramPostInput } from "./types";
import { safeHttpUrl } from "../safeUrl";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

/** Text content of the first <tag>, with CDATA unwrapped and entities decoded (not HTML-stripped). */
function tagText(xml: string, tag: string): string | null {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
  if (!m) return null;
  const inner = m[1]!.trim();
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(inner);
  return cdata ? cdata[1]! : decodeEntities(inner);
}

function attr(xml: string, tag: string, name: string, where?: RegExp): string | null {
  const re = new RegExp(`<${tag}\\b([^>]*)/?>`, "gi");
  for (const m of xml.matchAll(re)) {
    const attrs = m[1]!;
    if (where && !where.test(attrs)) continue;
    const v = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(attrs);
    if (v) return decodeEntities(v[1]!);
  }
  return null;
}

/** HTML (as found in descriptions) → plain text with line breaks kept. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function firstImage(html: string | null): string | null {
  if (!html) return null;
  const m = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(html);
  return m ? decodeEntities(m[1]!) : null;
}

function date(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Instagram post id from a permalink like https://www.instagram.com/p/ABC123/ (or /reel/). */
export function shortcodeFromUrl(url: string | null): string | null {
  if (!url) return null;
  const m = /instagram\.com\/(?:[^/]+\/)?(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i.exec(url);
  return m ? m[1]! : null;
}

/**
 * Parses an RSS 2.0 or Atom document into posts. Throws when the text isn't
 * a feed at all (so "RSS-Bridge returned an error page" isn't read as "no posts").
 */
export function parseFeed(xml: string): InstagramPostInput[] {
  const text = xml.replace(/^﻿/, "").trim();
  const isAtom = /<feed\b[^>]*xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(text) || /<feed[\s>]/i.test(text);
  const isRss = /<rss[\s>]/i.test(text) || /<rdf:RDF[\s>]/i.test(text);
  if (!isAtom && !isRss) throw new Error("Not an RSS or Atom feed");

  const blocks = [...text.matchAll(isRss ? /<item\b[\s\S]*?<\/item>/gi : /<entry\b[\s\S]*?<\/entry>/gi)].map((m) => m[0]);
  return blocks.map((raw) => {
    const link = isRss
      ? tagText(raw, "link")
      : (attr(raw, "link", "href", /rel=["']alternate["']/i) ?? attr(raw, "link", "href"));
    const html = isRss
      ? (tagText(raw, "content:encoded") ?? tagText(raw, "description"))
      : (tagText(raw, "content") ?? tagText(raw, "summary"));
    const guid = isRss ? tagText(raw, "guid") : tagText(raw, "id");
    // Only http(s) links are kept (a feed could carry "javascript:" links).
    const permalink = safeHttpUrl(link);
    const title = tagText(raw, "title");
    const caption = html ? htmlToText(html) : null;
    return {
      // An Instagram shortcode is the most stable id; otherwise the feed's GUID.
      externalId: shortcodeFromUrl(permalink) ?? shortcodeFromUrl(guid) ?? guid?.trim() ?? null,
      permalink,
      title: title ? htmlToText(title).slice(0, 300) : null,
      caption: caption || (title ? htmlToText(title) : null),
      publishedAt: date(isRss ? (tagText(raw, "pubDate") ?? tagText(raw, "dc:date")) : (tagText(raw, "published") ?? tagText(raw, "updated"))),
      imageUrl: safeHttpUrl(
        attr(raw, "enclosure", "url", /type=["']image\//i) ??
          attr(raw, "media:content", "url") ??
          attr(raw, "media:thumbnail", "url") ??
          firstImage(html),
      ),
      raw: raw.slice(0, 20_000),
    };
  });
}
