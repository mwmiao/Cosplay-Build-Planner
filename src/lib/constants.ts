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

export const STATUS_LABELS: Record<ProjectStatus | PartStatus, string> = {
  idea: "Idea",
  researching: "Researching",
  building: "Building",
  finished: "Finished",
  needed: "Needed",
  ordered: "Ordered",
  arrived: "Arrived",
  done: "Done",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  wig: "Wig",
  armor: "Armor",
  prop: "Prop",
  clothing: "Clothing",
  fabric: "Fabric",
  "sewing-pattern": "Sewing pattern",
  footwear: "Footwear",
  makeup: "Makeup",
  accessory: "Accessory",
  electronics: "Electronics",
  materials: "Materials",
  tools: "Tools",
  other: "Other",
};

export function categoryLabel(value: string): string {
  return (CATEGORY_LABELS as Record<string, string>)[value] ?? value;
}

export function statusLabel(value: string): string {
  return (STATUS_LABELS as Record<string, string>)[value] ?? value;
}

export const SESSION_COOKIE = "cbp_session";
