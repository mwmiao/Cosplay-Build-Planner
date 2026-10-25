"use client";

import { useTransition } from "react";
import { useFormState } from "react-dom";
import { Field } from "@/components/Field";
import { FormMessage, SubmitButton } from "@/components/FormBits";
import { LOCALES, currencyOptions, getDictionary } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { CURRENCY_CODES } from "@/lib/currencies";
import { refreshRatesNow, saveDefaultCurrency, setLanguage } from "./actions";

export function DefaultCurrencyForm({ current }: { current: string }) {
  const { t } = useI18n();
  const [state, action] = useFormState(saveDefaultCurrency, {});
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <Field
        as="select"
        label={t.settings.defaultCurrency}
        name="defaultCurrency"
        options={currencyOptions(t.intl, CURRENCY_CODES)}
        defaultValue={current}
        errors={state.errors?.defaultCurrency}
        hint={t.settings.defaultCurrencyHint}
      />
      <SubmitButton className="btn-secondary">{t.common.save}</SubmitButton>
    </form>
  );
}

export function RefreshRatesButton() {
  const { t } = useI18n();
  const [state, action] = useFormState(refreshRatesNow, {});
  return (
    <form action={action} className="space-y-2">
      <FormMessage state={state} />
      <SubmitButton className="btn-secondary" pendingText={t.settings.updatingRates}>
        {t.settings.updateRates}
      </SubmitButton>
    </form>
  );
}

/** Switches the UI language for this device; each option is labelled in its own language. */
export function LanguagePicker() {
  const { t, locale } = useI18n();
  const [pending, startTransition] = useTransition();
  return (
    <fieldset disabled={pending}>
      <legend className="label">{t.settings.language}</legend>
      <div className="inline-flex flex-wrap rounded-xl border border-zinc-300 p-1 dark:border-zinc-700">
        {LOCALES.map((l) => (
          <label
            key={l}
            lang={l}
            className={`flex min-h-10 cursor-pointer items-center rounded-lg px-4 text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 ${
              locale === l ? "bg-brand-600 text-white" : "text-zinc-700 dark:text-zinc-300"
            }`}
          >
            <input
              type="radio"
              name="language"
              value={l}
              checked={locale === l}
              onChange={() => startTransition(() => setLanguage(l))}
              className="sr-only"
            />
            {getDictionary(l).languageName}
          </label>
        ))}
      </div>
      <p className="hint">{t.settings.languageHint}</p>
    </fieldset>
  );
}
