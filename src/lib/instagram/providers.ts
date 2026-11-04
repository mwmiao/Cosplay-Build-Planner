// Feed providers. The default reads a self-hosted RSS-Bridge (no Instagram
// login, token or official API). To add RSS.app, Apify…: implement
// InstagramSourceProvider (types.ts) and add it to PROVIDERS below; nothing
// else in the app changes.
import { PrivateAddressError, assertPublicUrl } from "../netGuard";
import { parseFeed } from "./feed";
import { FeedError, type FeedSource, type FetchOptions, type FetchResult, type InstagramSourceProvider } from "./types";

const PRIVATE_FEED_MESSAGE = "This feed address points to a private network address, which isn't allowed. Set ALLOW_PRIVATE_FEED_URLS=true if it is your own feed provider.";

/** The bundled RSS-Bridge, or any address when the owner has allowed private feed URLs. */
function isTrustedFeedUrl(feedUrl: string): boolean {
  if (process.env.ALLOW_PRIVATE_FEED_URLS === "true") return true;
  const base = process.env.RSS_BRIDGE_BASE_URL?.trim();
  try {
    return Boolean(base) && new URL(feedUrl).origin === new URL(base!).origin;
  } catch {
    return false;
  }
}

const CACHE_MS = 5 * 60_000;
const cache = new Map<string, { at: number; body: string }>();

/** GET a feed with a timeout, a short in-memory cache and readable errors. */
export async function fetchFeedText(
  url: string,
  { useCache = true, publicOnly = false }: { useCache?: boolean; publicOnly?: boolean } = {},
): Promise<string> {
  const hit = cache.get(url);
  if (useCache && hit && Date.now() - hit.at < CACHE_MS) return hit.body;
  let res: Response;
  try {
    // publicOnly: every address, including each redirect, must be a public one.
    let target = url;
    for (let hops = 0; ; hops++) {
      if (publicOnly) await assertPublicUrl(target);
      res = await fetch(target, {
        headers: { Accept: "application/atom+xml, application/rss+xml, application/xml, text/xml" },
        signal: AbortSignal.timeout(30_000),
        redirect: publicOnly ? "manual" : "follow",
        cache: "no-store",
      });
      const location = res.headers.get("location");
      if (!publicOnly || res.status < 300 || res.status >= 400 || !location) break;
      if (hops >= 3) throw new FeedError("Feed redirected too many times", "invalid");
      target = new URL(location, target).toString();
    }
  } catch (err) {
    if (err instanceof FeedError) throw err;
    if (err instanceof PrivateAddressError) throw new FeedError(PRIVATE_FEED_MESSAGE, "invalid");
    const cause = (err as { cause?: { code?: string } })?.cause?.code ?? (err as Error)?.name;
    throw new FeedError(`Can't reach ${new URL(url).origin} (${cause ?? "network error"})`, "unreachable");
  }
  const body = await res.text();
  if (!res.ok) {
    // RSS-Bridge explains its errors in the page; keep a short plain-text excerpt.
    const excerpt = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
    throw new FeedError(`Feed returned HTTP ${res.status}${excerpt ? `: ${excerpt}` : ""}`, "http", res.status);
  }
  if (body.length > 5 * 1024 * 1024) throw new FeedError("Feed is too large", "invalid");
  cache.set(url, { at: Date.now(), body });
  return body;
}

function parseOrThrow(body: string) {
  try {
    return parseFeed(body);
  } catch {
    throw new FeedError("The feed isn't valid RSS/Atom (the bridge may have returned an error page)", "invalid");
  }
}

/** Default: a self-hosted RSS-Bridge (https://github.com/RSS-Bridge/rss-bridge), Instagram bridge, Atom output. */
export const rssBridgeProvider: InstagramSourceProvider = {
  name: "rss-bridge",
  buildFeedUrl(username) {
    const base = process.env.RSS_BRIDGE_BASE_URL?.trim().replace(/\/+$/, "");
    if (!base) return null;
    const qs = new URLSearchParams({ action: "display", bridge: "Instagram", context: "Username", u: username, media_type: "all", format: "Atom" });
    return `${base}/?${qs.toString()}`;
  },
  async fetchRecentPosts(source: FeedSource, options: FetchOptions = {}): Promise<FetchResult> {
    const feedUrl = source.feedUrl || this.buildFeedUrl(source.username);
    if (!feedUrl) throw new FeedError("RSS_BRIDGE_BASE_URL isn't set and the source has no feed URL", "notConfigured");
    // A feed address typed in by an admin must be public, unless it is the bundled
    // RSS-Bridge or ALLOW_PRIVATE_FEED_URLS=true (a feed provider on your own network).
    const publicOnly = Boolean(source.feedUrl) && !isTrustedFeedUrl(feedUrl);
    return { feedUrl, posts: parseOrThrow(await fetchFeedText(feedUrl, { useCache: !options.fresh, publicOnly })) };
  },
};

/** Sample posts for local development (never in production). */
export const MOCK_FEED = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>mock_cosplay_market</title>
  <entry>
    <id>https://www.instagram.com/p/MockPost001/</id>
    <title>QUIMERA ART MARKET</title>
    <link rel="alternate" href="https://www.instagram.com/p/MockPost001/"/>
    <published>2026-10-07T10:00:00+00:00</published>
    <content type="html">&lt;p&gt;✨ QUIMERA ART MARKET ✨&lt;br&gt;🗓 29, 30 e 31 de outubro&lt;br&gt;⏰ 11h às 20h&lt;br&gt;📍 CCBombarda, Rua de Miguel Bombarda 285, Porto&lt;br&gt;🎟 Entrada livre #cosplay #artmarket&lt;/p&gt;&lt;img src="https://example.invalid/poster.jpg"&gt;</content>
  </entry>
  <entry>
    <id>https://www.instagram.com/p/MockPost002/</id>
    <title>Obrigado!</title>
    <link rel="alternate" href="https://www.instagram.com/p/MockPost002/"/>
    <published>2026-10-01T10:00:00+00:00</published>
    <content type="html">Obrigado a todos os que vieram! 💜</content>
  </entry>
</feed>`;

export const mockProvider: InstagramSourceProvider = {
  name: "mock",
  buildFeedUrl: (username) => `mock://${username}`,
  async fetchRecentPosts(source) {
    if (process.env.NODE_ENV === "production") throw new FeedError("The mock provider is for development only", "notConfigured");
    return { feedUrl: `mock://${source.username}`, posts: parseFeed(MOCK_FEED) };
  },
};

export const PROVIDERS: Record<string, InstagramSourceProvider> = {
  [rssBridgeProvider.name]: rssBridgeProvider,
  [mockProvider.name]: mockProvider,
};

export function getProvider(name: string): InstagramSourceProvider {
  return PROVIDERS[name] ?? rssBridgeProvider;
}

/** Whether RSS-Bridge answers at RSS_BRIDGE_BASE_URL (admin status). */
export async function rssBridgeReachable(): Promise<{ ok: boolean; base: string | null; error?: string }> {
  const base = process.env.RSS_BRIDGE_BASE_URL?.trim().replace(/\/+$/, "") || null;
  if (!base) return { ok: false, base, error: "RSS_BRIDGE_BASE_URL isn't set" };
  try {
    const res = await fetch(`${base}/`, { signal: AbortSignal.timeout(5_000), cache: "no-store" });
    return res.ok ? { ok: true, base } : { ok: false, base, error: `HTTP ${res.status}` };
  } catch (err) {
    const cause = (err as { cause?: { code?: string } })?.cause?.code ?? (err as Error)?.name;
    return { ok: false, base, error: cause ?? "unreachable" };
  }
}
