"use client";

import { useEffect } from "react";

/**
 * React 19 resets a form's uncontrolled fields after every form action, even when the
 * action returned validation errors (or is only a preview), which would wipe what the
 * person typed. This cancels those resets. A form that really wants clearing calls
 * resetForm(), which is let through.
 */
export function KeepFormValues() {
  useEffect(() => {
    const onReset = (ev: Event) => {
      const form = ev.target as HTMLFormElement;
      if (form.dataset.allowReset !== "1") ev.preventDefault();
    };
    document.addEventListener("reset", onReset, true);
    return () => document.removeEventListener("reset", onReset, true);
  }, []);
  return null;
}

/** Clears a form on purpose (e.g. after "Save & add another"). */
export function resetForm(form: HTMLFormElement | null) {
  if (!form) return;
  form.dataset.allowReset = "1";
  form.reset();
  delete form.dataset.allowReset;
}
