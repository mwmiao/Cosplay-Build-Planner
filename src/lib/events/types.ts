// Event categories and how firm an event's date is. Shared by forms, pages and validation.
export const EVENT_TYPES = ["convention", "market", "gaming", "workshop", "other"] as const;
export const ANNOUNCE_STATUSES = ["announced", "tickets", "confirmed", "cancelled"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export type AnnounceStatus = (typeof ANNOUNCE_STATUSES)[number];
