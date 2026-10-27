// Instagram monitoring: shared shapes and the provider interface.
//
// A provider turns a public Instagram account into recent posts. The rest of
// the app (storage, duplicate checks, event detection, review, notifications)
// only sees InstagramPostInput, so a provider can be swapped (RSS-Bridge today;
// RSS.app, Apify… later) without touching anything else. To add one: implement
// InstagramSourceProvider and register it in providers.ts.

/** One post, normalised from whatever the provider returns. */
export type InstagramPostInput = {
  /** Post id or feed GUID (preferred for duplicate checks) */
  externalId: string | null;
  /** Link to the post (fallback for duplicate checks) */
  permalink: string | null;
  title: string | null;
  caption: string | null;
  publishedAt: Date | null;
  imageUrl: string | null;
  /** The raw entry as received, for debugging */
  raw: string | null;
};

export type FeedSource = { username: string; feedUrl: string | null };

export type FetchResult = { feedUrl: string; posts: InstagramPostInput[] };

/** fresh: skip the short response cache (an admin's "Check now" / "Test feed"). */
export type FetchOptions = { fresh?: boolean };

/** Why a fetch failed, so the admin page can say something useful. */
export class FeedError extends Error {
  constructor(
    message: string,
    readonly kind: "unreachable" | "http" | "invalid" | "notConfigured",
    readonly status?: number,
  ) {
    super(message);
  }
}

export interface InstagramSourceProvider {
  readonly name: string;
  /** Feed URL for a username, or null when this provider can't build one (needs a manual URL). */
  buildFeedUrl(username: string): string | null;
  /** Recent posts of the account (newest first or any order). Throws FeedError. */
  fetchRecentPosts(source: FeedSource, options?: FetchOptions): Promise<FetchResult>;
}
