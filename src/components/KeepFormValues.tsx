"use client";

import { useEffect } from "react";

/** Forms being cleared on purpose right now (see resetForm). */
const clearing = new WeakSet<HTMLFormElement>();

/**
 * React 19 resets a form's uncontrolled fields after every form action, even when the
 * action returned validation errors (or is only a preview), which would wipe what the
 * person typed. This cancels those resets; resetForm() is the way to clear on purpose.
 */
export function KeepFormValues() {
  useEffect(() => {
    const onReset = (ev: Event) => {
      if (!clearing.has(ev.target as HTMLFormElement)) ev.preventDefault();
    };
    document.addEventListener("reset", onReset, true);
    return () => document.removeEventListener("reset", onReset, true);
  }, []);
  return null;
}

/** Clears a form on purpose (e.g. after "Save & add another"). */
export function resetForm(form: HTMLFormElement | null) {
  if (!form) return;
  clearing.add(form);
  form.reset();
  clearing.delete(form);
}
