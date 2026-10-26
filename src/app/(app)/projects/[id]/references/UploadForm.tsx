"use client";

import { useId, useState } from "react";
import { Field } from "@/components/Field";
import { useI18n } from "@/i18n/client";

export type UploadKind = "reference" | "part" | "cover";

/**
 * Plain multipart form posting to the upload route (works without JS too).
 * The client side only pre-checks file sizes and shows a busy state. Used for
 * reference images, a part's photos and the project's main picture.
 */
export function UploadForm({
  projectId,
  accept,
  maxMb,
  kind = "reference",
  partId,
  groups = [],
  submitLabel,
}: {
  projectId: string;
  accept: string;
  maxMb: number;
  kind?: UploadKind;
  partId?: string;
  /** Existing reference groups, suggested in the group field */
  groups?: string[];
  submitLabel?: string;
}) {
  const { t } = useI18n();
  const R = t.refs;
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const single = kind === "cover";

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
      <input type="hidden" name="kind" value={kind} />
      {partId ? <input type="hidden" name="partId" value={partId} /> : null}
      <div>
        <label htmlFor={`${id}-images`} className="label">
          {single ? R.image : R.images} <span className="text-brand-600">*</span>
        </label>
        <input
          id={`${id}-images`}
          name="images"
          type="file"
          accept={accept}
          multiple={!single}
          aria-describedby={`${id}-hint`}
          aria-invalid={error ? true : undefined}
          className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-brand-50 file:px-4 file:font-semibold file:text-brand-700 dark:file:bg-brand-900/40 dark:file:text-brand-200"
        />
        <p id={`${id}-hint`} className="hint">
          {single ? R.imageHint(maxMb) : R.imagesHint(maxMb)}
        </p>
        {error ? <p className="field-error">{error}</p> : null}
      </div>
      {kind === "cover" ? null : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={R.caption} name="caption" placeholder={R.captionPlaceholder} />
          {kind === "reference" ? (
            <>
              <Field label={R.group} name="groupName" placeholder={R.groupPlaceholder} list={`${id}-groups`} autoComplete="off" />
              <datalist id={`${id}-groups`}>
                {groups.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </>
          ) : null}
          <Field label={R.sourceLink} name="sourceUrl" type="url" inputMode="url" placeholder="https://" />
        </div>
      )}
      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={busy}>
        {busy ? R.uploading : (submitLabel ?? R.upload)}
      </button>
    </form>
  );
}
