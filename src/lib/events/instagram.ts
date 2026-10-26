// Instagram via Meta's official Instagram API ("business discovery"): with an
// access token for YOUR professional (business/creator) Instagram account, it
// returns the public posts of other business/creator accounts by username.
// No scraping. Personal accounts and age-gated accounts can't be read.
// Setup: INSTAGRAM_USER_ID (your professional account's Instagram user id) and
// INSTAGRAM_ACCESS_TOKEN in the environment (see README → Events → Instagram).
import { type CaptionEvent, extractEvent } from "./caption";

export const GRAPH_VERSION = "v26.0";

export type InstagramPost = {
  id: string;
  caption?: string;
  timestamp?: string;
  permalink?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
};

export type InstagramAccount = { username: string; name?: string; posts: InstagramPost[] };

export class InstagramError extends Error {
  constructor(
    message: string,
    readonly kind: "notSetUp" | "token" | "account" | "rateLimit" | "other",
  ) {
    super(message);
  }
}

export function instagramConfig(): { userId: string; token: string } | null {
  const userId = process.env.INSTAGRAM_USER_ID?.trim();
  const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  return userId && token ? { userId, token } : null;
}

const USERNAME = /^[A-Za-z0-9._]{1,30}$/;

/** Reads one account's recent posts. One request per account per check. */
export async function fetchAccount(username: string, fetcher: typeof fetch = fetch): Promise<InstagramAccount> {
  const config = instagramConfig();
  if (!config) throw new InstagramError("Instagram isn't set up", "notSetUp");
  if (!USERNAME.test(username)) throw new InstagramError("Invalid username", "account");
  const fields = `business_discovery.username(${username}){username,name,media.limit(15){id,caption,timestamp,permalink,media_type,media_url,thumbnail_url}}`;
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(config.userId)}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(config.token)}`;
  const res = await fetcher(url, { signal: AbortSignal.timeout(20_000), cache: "no-store" });
  const body = (await res.json().catch(() => null)) as Record<string, any> | null;
  return parseBusinessDiscovery(body, res.status);
}

/** Turns the API response (or error) into an account with posts. Exported for tests. */
export function parseBusinessDiscovery(body: Record<string, any> | null, status = 200): InstagramAccount {
  const err = body?.error;
  if (err || status >= 400) {
    const code = Number(err?.code);
    // Never include the token or full API message in what's stored/shown.
    if (code === 190 || code === 102) throw new InstagramError("Access token expired or invalid", "token");
    if (code === 4 || code === 17 || code === 32 || code === 613) throw new InstagramError("Rate limit reached", "rateLimit");
    if (code === 100 || code === 110) throw new InstagramError("Account not found, private, or not a business/creator account", "account");
    throw new InstagramError(`Instagram API error${code ? ` ${code}` : ""}`, "other");
  }
  const bd = body?.business_discovery;
  if (!bd) throw new InstagramError("Unexpected response", "other");
  const posts: InstagramPost[] = Array.isArray(bd.media?.data) ? bd.media.data.filter((p: any) => typeof p?.id === "string") : [];
  return { username: String(bd.username ?? ""), name: typeof bd.name === "string" ? bd.name : undefined, posts };
}

export type PostEvent = CaptionEvent & {
  key: string;
  start: string;
  url?: string;
  posterUrl?: string;
  caption: string;
};

/**
 * Posts that announce an event: a caption with a date that isn't long past.
 * The organiser's usual venue/city fill gaps (recurring markets use the same place).
 */
export function postsToEvents(
  account: InstagramAccount,
  organiser: { name: string; city?: string | null; usualVenue?: string | null; usualAddress?: string | null },
  now = new Date(),
): PostEvent[] {
  const out: PostEvent[] = [];
  for (const post of account.posts) {
    if (!post.caption) continue;
    const posted = post.timestamp ? new Date(post.timestamp) : now;
    const found = extractEvent(post.caption, Number.isNaN(posted.getTime()) ? now : posted);
    if (!found.start) continue;
    const ends = new Date(`${found.end ?? found.start}T00:00:00.000Z`);
    if (ends.getTime() < now.getTime() - 86_400_000) continue; // already over
    const hasOwnPlace = !!(found.venue || found.address);
    out.push({
      ...found,
      start: found.start,
      // The caption's first line is often decoration; the organiser name is a safe default.
      name: found.name && found.name.length >= 3 ? found.name : organiser.name,
      venue: found.venue ?? (hasOwnPlace ? undefined : (organiser.usualVenue ?? undefined)),
      address: found.address ?? (hasOwnPlace ? undefined : (organiser.usualAddress ?? undefined)),
      city: found.city ?? organiser.city ?? undefined,
      key: `instagram:${post.id}`,
      url: post.permalink,
      posterUrl: post.media_type === "VIDEO" ? post.thumbnail_url : post.media_url,
      caption: post.caption.slice(0, 2000),
    });
  }
  return out;
}
