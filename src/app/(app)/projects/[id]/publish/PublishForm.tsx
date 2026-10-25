"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormState } from "react-dom";
import { Field } from "@/components/Field";
import { FormMessage, StickyActions, SubmitButton } from "@/components/FormBits";
import { PublicProject } from "@/components/PublicProject";
import { useI18n } from "@/i18n/client";
import { type PublishState, previewOrPublish } from "./actions";

export type PublishDefaults = {
  title: string;
  description: string;
  tags: string;
  includeBudget: boolean;
  includeCosts: boolean;
  includeLinks: boolean;
  imageIds: string[];
  coverId: string | null;
};

export function PublishForm({
  projectId,
  defaults,
  images,
  published,
}: {
  projectId: string;
  defaults: PublishDefaults;
  images: { id: string; caption: string | null; thumbUrl: string }[];
  published: boolean;
}) {
  const { t, f } = useI18n();
  const C = t.community;
  const [state, action] = useFormState<PublishState, FormData>(previewOrPublish.bind(null, projectId), {});
  const [selected, setSelected] = useState<string[]>(defaults.imageIds);
  const [cover, setCover] = useState<string | null>(defaults.coverId);
  const e = state.errors ?? {};

  function toggle(id: string, on: boolean) {
    setSelected((cur) => (on ? [...cur, id] : cur.filter((x) => x !== id)));
    if (!on && cover === id) setCover(null);
  }

  return (
    <form action={action} className="space-y-6" noValidate>
      <FormMessage state={state.preview ? {} : state} />
      <section className="card space-y-4">
        <Field label={C.publicTitle} name="title" required defaultValue={defaults.title} maxLength={120} errors={e.title} />
        <Field
          as="textarea"
          label={C.publicDescription}
          name="description"
          defaultValue={defaults.description}
          rows={4}
          maxLength={2000}
          errors={e.description}
          hint={C.publicDescriptionHint}
        />
        <Field label={C.tagsLabel} name="tags" defaultValue={defaults.tags} errors={e.tags} hint={C.tagsHint} />
        <fieldset className="space-y-3">
          {(
            [
              ["includeBudget", C.includeBudget, C.includeBudgetHint, defaults.includeBudget],
              ["includeCosts", C.includeCosts, C.includeCostsHint, defaults.includeCosts],
              ["includeLinks", C.includeLinks, C.includeLinksHint, defaults.includeLinks],
            ] as const
          ).map(([name, label, hint, on]) => (
            <label key={name} className="flex cursor-pointer gap-3">
              <input type="checkbox" name={name} defaultChecked={on} className="mt-1 h-5 w-5 rounded border-zinc-300 text-brand-600" />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="hint block">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </section>

      <section className="card space-y-3" aria-labelledby="publish-images">
        <h2 id="publish-images" className="section-title">
          {C.imagesLabel}
        </h2>
        <p className="hint">{C.imagesHint}</p>
        {images.length === 0 ? (
          <p className="text-sm text-zinc-500">{C.noImages}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((img) => {
              const on = selected.includes(img.id);
              return (
                <li key={img.id} className={`rounded-xl border-2 p-1 ${on ? "border-brand-500" : "border-transparent"}`}>
                  <label className="block cursor-pointer">
                    <img src={img.thumbUrl} alt={img.caption ?? ""} className="aspect-square w-full rounded-lg object-cover" />
                    <span className="mt-1 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="imageIds"
                        value={img.id}
                        checked={on}
                        onChange={(ev) => toggle(img.id, ev.currentTarget.checked)}
                        className="h-5 w-5 rounded border-zinc-300 text-brand-600"
                      />
                      <span className="truncate">{img.caption ?? ""}</span>
                    </span>
                  </label>
                  {on ? (
                    <label className="mt-1 flex items-center gap-2 text-xs">
                      <input
                        type="radio"
                        name="coverId"
                        value={img.id}
                        checked={(cover ?? selected[0]) === img.id}
                        onChange={() => setCover(img.id)}
                      />
                      {C.cover}
                    </label>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {state.preview ? (
        <section className="space-y-3" aria-labelledby="preview-title">
          <div className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:bg-sky-950 dark:text-sky-200">
            <h2 id="preview-title" className="font-semibold">
              {C.previewTitle}
            </h2>
            <p>{C.previewHint}</p>
          </div>
          <div className="rounded-2xl border-2 border-dashed border-sky-300 p-3 dark:border-sky-800" data-testid="publish-preview">
            <PublicProject data={state.preview} t={t} f={f} />
          </div>
        </section>
      ) : null}

      <StickyActions>
        <SubmitButton name="intent" value="preview" className="btn-secondary" pendingText={t.common.working}>
          {C.preview}
        </SubmitButton>
        {state.preview ? (
          <SubmitButton name="intent" value="publish" className="btn-primary flex-1 sm:flex-none" pendingText={C.publishing}>
            {published ? C.updatePublished : C.publish}
          </SubmitButton>
        ) : null}
        <Link href={`/projects/${projectId}`} className="btn-ghost hidden sm:inline-flex">
          {t.common.cancel}
        </Link>
      </StickyActions>
    </form>
  );
}
