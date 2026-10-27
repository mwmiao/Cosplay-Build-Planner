"use client";

import { useFormState } from "react-dom";
import { Field } from "@/components/Field";
import { FormMessage, SubmitButton } from "@/components/FormBits";
import { useI18n } from "@/i18n/client";
import type { TestFeedResult } from "@/lib/instagram/monitor";
import type { FormState } from "@/lib/validation";
import type { ManualPostState } from "./actions";

/** "Test feed": fetches and validates the feed on the server and shows the result here. Stores nothing. */
export function TestFeedButton({ action }: { action: (prev: TestFeedResult | null) => Promise<TestFeedResult> }) {
  const { t, f } = useI18n();
  const S = t.instagram;
  const [result, formAction] = useFormState(action, null);
  return (
    <form action={formAction} className="min-w-0">
      <SubmitButton className="btn-ghost min-h-9" pendingText={S.testing}>
        {S.testFeed}
      </SubmitButton>
      {result ? (
        <p
          role="status"
          data-testid="test-feed-result"
          className={`mt-1 break-words text-xs ${result.ok ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}
        >
          {result.ok
            ? S.testOk(result.count, result.latest ? f.dateTime(new Date(result.latest)) : S.noDate)
            : S.testFailed(result.error ?? "")}
        </p>
      ) : null}
    </form>
  );
}

export type SourceValues = {
  username: string;
  displayName: string;
  sourceType: string;
  feedUrl: string;
  providerName: string;
  organiserId: string;
  active: boolean;
};

export function SourceForm({
  action,
  initial,
  organisers,
  providers,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: SourceValues;
  organisers: { id: string; name: string }[];
  providers: string[];
  submitLabel: string;
}) {
  const { t } = useI18n();
  const S = t.instagram;
  const [formState, formAction] = useFormState(action, {});
  // Saving redirects back to this same page, where the state can come back undefined.
  const state = formState ?? {};
  const e = state.errors ?? {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={S.username} name="username" required defaultValue={initial?.username} errors={e.username} placeholder="@account" hint={S.usernameHint} autoComplete="off" />
        <Field label={S.displayName} name="displayName" defaultValue={initial?.displayName} errors={e.displayName} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field
          as="select"
          label={S.sourceType}
          name="sourceType"
          options={Object.entries(S.sourceTypes).map(([value, label]) => ({ value, label }))}
          defaultValue={initial?.sourceType ?? "organiser"}
        />
        <Field
          as="select"
          label={S.organiser}
          name="organiserId"
          options={[{ value: "", label: t.events.noOrganiser }, ...organisers.map((o) => ({ value: o.id, label: o.name }))]}
          defaultValue={initial?.organiserId ?? ""}
        />
        <Field
          as="select"
          label={S.provider}
          name="providerName"
          options={providers.map((p) => ({ value: p, label: (S.providers as Record<string, string>)[p] ?? p }))}
          defaultValue={initial?.providerName ?? "rss-bridge"}
        />
      </div>
      <Field label={S.feedUrl} name="feedUrl" type="url" inputMode="url" defaultValue={initial?.feedUrl} errors={e.feedUrl} hint={S.feedUrlHint} />
      <label className="flex cursor-pointer gap-3">
        <input type="checkbox" name="active" defaultChecked={initial?.active ?? true} className="mt-1 h-5 w-5 rounded border-zinc-300 text-brand-600" />
        <span>
          <span className="block text-sm font-medium">{S.active}</span>
          <span className="hint block">{S.activeHint}</span>
        </span>
      </label>
      <SubmitButton className="btn-primary">{submitLabel}</SubmitButton>
    </form>
  );
}

/** Fallback when a feed breaks: paste a post; it goes through the same detection and review. */
export function ManualPostForm({
  action,
  sources,
}: {
  action: (prev: ManualPostState, formData: FormData) => Promise<ManualPostState>;
  sources: { id: string; username: string }[];
}) {
  const { t } = useI18n();
  const S = t.instagram;
  const [formState, formAction] = useFormState(action, {});
  // Saving redirects back to this same page, where the state can come back undefined.
  const state = formState ?? {};
  const e = state.errors ?? {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          as="select"
          label={S.source}
          name="sourceId"
          options={[{ value: "", label: S.noSource }, ...sources.map((s) => ({ value: s.id, label: `@${s.username}` }))]}
        />
        <Field label={S.postDate} name="publishedAt" type="date" errors={e.publishedAt} />
      </div>
      <Field label={S.permalink} name="permalink" type="url" inputMode="url" required errors={e.permalink} placeholder="https://www.instagram.com/p/…" />
      <Field as="textarea" label={S.caption} name="caption" required rows={5} errors={e.caption} hint={S.captionHint} />
      <Field label={S.imageUrl} name="imageUrl" type="url" inputMode="url" errors={e.imageUrl} />
      <SubmitButton className="btn-primary">{S.addManualPost}</SubmitButton>
    </form>
  );
}
