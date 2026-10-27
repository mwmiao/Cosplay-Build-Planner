"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useFormState } from "react-dom";
import { Field } from "@/components/Field";
import { FormMessage, StickyActions, SubmitButton } from "@/components/FormBits";
import { useI18n } from "@/i18n/client";
import { extractEvent } from "@/lib/events/caption";
import { ANNOUNCE_STATUSES, EVENT_TYPES } from "@/lib/events/types";
import type { FormState } from "@/lib/validation";

export type EventFormValues = {
  name: string;
  startDate: string;
  endDate: string;
  time: string;
  city: string;
  country: string;
  venue: string;
  address: string;
  mapUrl: string;
  url: string;
  sourceUrl: string;
  tickets: string;
  notes: string;
  eventType: string;
  announceStatus: string;
  organiserId: string;
};

/**
 * Admin add/edit form; with `suggest`, the user-facing suggestion form (no
 * exact map link or organiser). "Fill in from post text" reads a pasted
 * announcement (e.g. an Instagram caption) and fills the empty fields.
 */
export function EventForm({
  action,
  initial,
  submitLabel,
  suggest = false,
  organisers = [],
  postId,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: Partial<EventFormValues>;
  submitLabel: string;
  suggest?: boolean;
  organisers?: { id: string; name: string }[];
  /** Instagram post this event is being created from */
  postId?: string;
}) {
  const { t } = useI18n();
  const E = t.events;
  const [state, formAction] = useFormState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [pasted, setPasted] = useState("");
  const [filled, setFilled] = useState<string | null>(null);
  const e = state.errors ?? {};

  function fillFromText() {
    const form = formRef.current;
    if (!form || !pasted.trim()) return;
    const found = extractEvent(pasted, new Date());
    const set = (name: string, value: string | undefined) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | null;
      if (el && value && !el.value) el.value = value;
    };
    set("name", found.name);
    set("startDate", found.start);
    set("endDate", found.end);
    set("time", found.time);
    set("venue", found.venue);
    set("address", found.address);
    set("city", found.city);
    set("tickets", found.tickets);
    const count = Object.values(found).filter(Boolean).length;
    setFilled(count ? E.filledFields(count) : E.nothingFound);
  }

  const typeOptions = EVENT_TYPES.map((v) => ({ value: v, label: E.types[v] }));
  const statusOptions = ANNOUNCE_STATUSES.map((v) => ({ value: v, label: E.statuses[v] }));

  return (
    <form ref={formRef} action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      {postId ? <input type="hidden" name="postId" value={postId} /> : null}
      <details className="rounded-xl border border-dashed border-zinc-300 p-3 dark:border-zinc-700" open={suggest}>
        <summary className="cursor-pointer text-sm font-semibold">{E.fillFromPost}</summary>
        <div className="mt-2 space-y-2">
          <p className="hint">{E.fillFromPostHint}</p>
          <label className="sr-only" htmlFor="event-paste">
            {E.pasteLabel}
          </label>
          <textarea
            id="event-paste"
            className="input min-h-28"
            value={pasted}
            onChange={(ev) => setPasted(ev.target.value)}
            placeholder={E.pastePlaceholder}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-secondary" onClick={fillFromText}>
              {E.fillButton}
            </button>
            {filled ? (
              <span role="status" className="text-sm text-zinc-600 dark:text-zinc-300">
                {filled}
              </span>
            ) : null}
          </div>
        </div>
      </details>

      <Field label={E.name} name="name" required defaultValue={initial?.name} errors={e.name} placeholder="Lisboa Games Week 2027" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={E.startDate} name="startDate" type="date" required defaultValue={initial?.startDate} errors={e.startDate} />
        <Field label={E.endDate} name="endDate" type="date" defaultValue={initial?.endDate} errors={e.endDate} hint={E.endDateHint} />
        <Field label={E.time} name="time" defaultValue={initial?.time} errors={e.time} placeholder="11h–19h" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field as="select" label={E.eventType} name="eventType" options={typeOptions} defaultValue={initial?.eventType ?? "other"} />
        <Field as="select" label={E.announceStatus} name="announceStatus" options={statusOptions} defaultValue={initial?.announceStatus ?? "announced"} hint={E.announceStatusHint} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={E.venue} name="venue" defaultValue={initial?.venue} errors={e.venue} placeholder="FIL – Parque das Nações" hint={E.venueHint} />
        <Field label={E.address} name="address" defaultValue={initial?.address} errors={e.address} hint={E.addressHint} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={E.city} name="city" required defaultValue={initial?.city} errors={e.city} placeholder="Lisboa" />
        <Field label={E.country} name="country" defaultValue={initial?.country ?? "Portugal"} errors={e.country} />
      </div>
      {suggest ? null : (
        <Field label={E.mapUrl} name="mapUrl" type="url" inputMode="url" defaultValue={initial?.mapUrl} errors={e.mapUrl} placeholder="https://maps.app.goo.gl/…" hint={E.mapUrlHint} />
      )}
      <Field label={E.link} name="url" type="url" inputMode="url" defaultValue={initial?.url} errors={e.url} placeholder="https://" hint={E.linkHint} />
      <Field label={E.tickets} name="tickets" defaultValue={initial?.tickets} errors={e.tickets} placeholder={E.ticketsPlaceholder} />
      <Field
        label={E.sourceUrl}
        name="sourceUrl"
        type="url"
        inputMode="url"
        defaultValue={initial?.sourceUrl}
        errors={e.sourceUrl}
        placeholder="https://www.instagram.com/p/…"
        hint={E.sourceUrlHint}
      />
      {suggest || organisers.length === 0 ? null : (
        <Field
          as="select"
          label={E.organiser}
          name="organiserId"
          options={[{ value: "", label: E.noOrganiser }, ...organisers.map((o) => ({ value: o.id, label: o.name }))]}
          defaultValue={initial?.organiserId ?? ""}
        />
      )}
      <Field as="textarea" label={E.notes} name="notes" defaultValue={initial?.notes} errors={e.notes} rows={3} />
      <StickyActions>
        <SubmitButton className="btn-primary flex-1 sm:flex-none">{submitLabel}</SubmitButton>
        <Link href="/events" className="btn-secondary hidden sm:inline-flex">
          {t.common.cancel}
        </Link>
      </StickyActions>
    </form>
  );
}
