"use client";

import { useId, useState } from "react";
import { Field } from "@/components/Field";
import { ProgressBar } from "@/components/ui";
import { useI18n } from "@/i18n/client";

export type UploadKind = "reference" | "part" | "cover" | "progress";

/** Where each kind of upload lands back on its page. */
const ANCHORS: Record<string, string> = { part: "#photos", cover: "#cover", progress: "#progress" };

/**
 * Multipart form posting to the upload route (works without JS too). With JS
 * it pre-checks file sizes and shows how far the upload has got. Used for
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
  /** Existing reference groups (or progress stages), suggested in the group/stage field */
  groups?: string[];
  submitLabel?: string;
}) {
  const { t } = useI18n();
  const R = t.refs;
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState(0);
  /** Percent sent; 100 means the server is processing the images */
  const [sent, setSent] = useState(0);
  const single = kind === "cover";

  // Sent with XMLHttpRequest for its progress events; the route answers with
  // the same redirect as a plain form post, which is followed here.
  const send = (form: HTMLFormElement) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", form.action);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setSent(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 400) return fail();
      window.location.assign(`${xhr.responseURL}${ANCHORS[kind] ?? ""}`);
    };
    xhr.onerror = () => fail();
    xhr.send(new FormData(form));
  };
  const fail = () => {
    setBusy(false);
    setSent(0);
    setError(R.uploadFailed);
  };

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
          e.preventDefault();
          setError(null);
          setBusy(true);
          send(e.currentTarget);
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
          onChange={(e) => setChosen(e.currentTarget.files?.length ?? 0)}
          className="peer sr-only"
        />
        <div className="flex flex-wrap items-center gap-3 rounded-xl peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500">
          <label htmlFor={`${id}-images`} className="btn-secondary cursor-pointer">
            {single ? R.chooseFile : R.chooseFiles}
          </label>
          <span className="text-sm text-zinc-600 dark:text-zinc-400" data-testid="files-chosen">
            {chosen ? R.filesChosen(chosen) : R.noFile}
          </span>
        </div>
        <p id={`${id}-hint`} className="hint">
          {single ? R.imageHint(maxMb) : R.imagesHint(maxMb)}
        </p>
        {error ? (
          <p role="alert" className="field-error">
            {error}
          </p>
        ) : null}
      </div>
      {kind === "progress" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={R.progressDate} name="takenAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          <Field label={R.stage} name="stage" placeholder={R.stagePlaceholder} list={`${id}-stages`} autoComplete="off" />
          <datalist id={`${id}-stages`}>
            {[...new Set([...groups, ...R.stageSuggestions])].map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
          <Field label={R.caption} name="caption" placeholder={R.progressCaptionPlaceholder} />
        </div>
      ) : kind === "cover" ? null : (
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
      {busy ? (
        <div role="status" className="space-y-1" data-testid="upload-progress">
          <ProgressBar value={sent} label={R.uploading} />
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{sent < 100 ? R.sending(sent) : R.processing}</p>
        </div>
      ) : null}
      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={busy}>
        {busy ? R.uploading : (submitLabel ?? R.upload)}
      </button>
    </form>
  );
}
