import "server-only";
import { cookies } from "next/headers";

export type View = "grid" | "list";

/**
 * Sort and layout for a list page: the URL wins, then the choice remembered
 * in the page's cookie (written by <ViewControls>), then the defaults.
 */
export function viewPrefs<S extends string>(
  cookie: string,
  search: { sort?: string; layout?: string },
  sorts: readonly S[],
  defaults: { sort: S; view: View },
): { sort: S; view: View } {
  const saved = cookies().get(cookie)?.value;
  const [savedSort, savedView] = saved ? decodeURIComponent(saved).split(".") : [];
  const pick = (...values: (string | undefined)[]) => values.find((v): v is S => !!v && (sorts as readonly string[]).includes(v));
  const view = [search.layout, savedView].find((v): v is View => v === "grid" || v === "list");
  return { sort: pick(search.sort, savedSort) ?? defaults.sort, view: view ?? defaults.view };
}
