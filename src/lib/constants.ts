import type { Dict } from "@/i18n";

export const PROJECT_STATUSES = ["idea", "researching", "building", "finished"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PART_STATUSES = ["needed", "ordered", "arrived", "building", "done"] as const;
export type PartStatus = (typeof PART_STATUSES)[number];

export const CATEGORIES = [
  "wig",
  "armor",
  "prop",
  "clothing",
  "fabric",
  "sewing-pattern",
  "footwear",
  "makeup",
  "accessory",
  "electronics",
  "materials",
  "tools",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export function categoryLabel(value: string, t: Dict): string {
  return t.category[value] ?? value;
}

export function statusLabel(value: string, t: Dict): string {
  return t.status[value] ?? value;
}

