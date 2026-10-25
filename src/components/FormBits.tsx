"use client";

import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/validation";

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText = "Saving…",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={className} {...rest}>
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <div
      role={state.ok ? "status" : "alert"}
      className={`rounded-xl px-4 py-3 text-sm ${
        state.ok
          ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300"
          : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300"
      }`}
    >
      {state.message}
    </div>
  );
}

/** Button that asks for confirmation before submitting its form. */
export function ConfirmButton({
  message,
  children,
  className = "btn-danger",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { message: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Sticky footer bar that keeps the main form action within thumb reach on phones. */
export function StickyActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-6 border-t border-zinc-200 bg-zinc-50/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:backdrop-blur-none">
      <div className="flex flex-wrap gap-3">{children}</div>
    </div>
  );
}
