"use client";

import { useState } from "react";
import { Field } from "@/components/Field";
import { useI18n } from "@/i18n/client";

/**
 * Plain multipart form posting to the upload route (works without JS too).
 * The client side only pre-checks file sizes and shows a busy state.
 */
export function UploadForm({ projectId, accept, maxMb }: { projectId: string; accept: string; maxMb: number }) {
  const { t } = useI18n();
  const R = t.refs;
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
          setError(R.chooseOne);
        } else if (tooBig.length) {
          e.preventDefault();
          setError(R.tooBig(maxMb, tooBig.map((f) => f.name).join(", ")));
        } else {
          setError(null);
          setBusy(true);
        }
      }}
    >
      <div>
        <label htmlFor="ref-images" className="label">
          {R.images} <span className="text-brand-600">*</span>
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
          {R.imagesHint(maxMb)}
        </p>
        {error ? <p className="field-error">{error}</p> : null}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={R.caption} name="caption" placeholder={R.captionPlaceholder} />
        <Field label={R.sourceLink} name="sourceUrl" type="url" inputMode="url" placeholder="https://" />
      </div>
      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={busy}>
        {busy ? R.uploading : R.upload}
      </button>
    </form>
  );
}
