"use client";

import { useState } from "react";
import { Field } from "@/components/Field";

/**
 * Plain multipart form posting to the upload route (works without JS too).
 * The client side only pre-checks file sizes and shows a busy state.
 */
export function UploadForm({ projectId, accept, maxMb }: { projectId: string; accept: string; maxMb: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      method="post"
      action={`/api/projects/${projectId}/references`}
      encType="multipart/form-data"
      className="space-y-4"
      onSubmit={(e) => {
        const input = e.currentTarget.elements.namedItem("images") as HTMLInputElement | null;
        const files = Array.from(input?.files ?? []);
        const tooBig = files.filter((f) => f.size > maxMb * 1024 * 1024);
        if (files.length === 0) {
          e.preventDefault();
          setError("Choose at least one image.");
        } else if (tooBig.length) {
          e.preventDefault();
          setError(`Too large (max ${maxMb} MB): ${tooBig.map((f) => f.name).join(", ")}`);
        } else {
          setError(null);
          setBusy(true);
        }
      }}
    >
      <div>
        <label htmlFor="ref-images" className="label">
          Images <span className="text-brand-600">*</span>
        </label>
        <input
          id="ref-images"
          name="images"
          type="file"
          accept={accept}
          multiple
          aria-describedby="ref-images-hint"
          aria-invalid={error ? true : undefined}
          className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-brand-50 file:px-4 file:font-semibold file:text-brand-700 dark:file:bg-brand-900/40 dark:file:text-brand-200"
        />
        <p id="ref-images-hint" className="hint">
          JPEG, PNG, WebP, GIF or AVIF · up to {maxMb} MB each · location data is removed.
        </p>
        {error ? <p className="field-error">{error}</p> : null}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Caption" name="caption" placeholder="e.g. Back of the armor" />
        <Field label="Source link" name="sourceUrl" type="url" inputMode="url" placeholder="https://" />
      </div>
      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={busy}>
        {busy ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}
