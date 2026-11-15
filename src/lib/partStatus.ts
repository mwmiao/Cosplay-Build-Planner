import { PART_STATUSES } from "./constants";

/** What the quick "done" tick should store. `remembered` is the status saved when the part was ticked done. */
export function toggleDone(
  status: string,
  remembered: string | null,
): { status: string; statusBeforeDone: string | null } {
  if (status !== "done") return { status: "done", statusBeforeDone: status };
  const restore =
    remembered && remembered !== "done" && (PART_STATUSES as readonly string[]).includes(remembered)
      ? remembered
      : "building";
  return { status: restore, statusBeforeDone: null };
}

/**
 * What the full edit form should store for statusBeforeDone: the status the part had when it
 * became done (via the form), cleared when it is not done, kept when it stays done.
 */
export function rememberOnEdit(
  before: { status: string; statusBeforeDone: string | null },
  newStatus: string,
): string | null {
  if (newStatus !== "done") return null;
  return before.status === "done" ? before.statusBeforeDone : before.status;
}
