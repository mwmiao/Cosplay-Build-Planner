"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import type { ImportOptions, ImportPreview, ImportReport } from "@/lib/transfer/import";
import { previewImport, runImport } from "./actions";

type Mode = ImportOptions["mode"];
type ProjectOption = { id: string; name: string };

function ErrorList({ title, errors }: { title: string; errors: string[] }) {
  return (
    <div
      role="alert"
      data-testid="import-errors"
      className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300"
    >
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {errors.map((e, i) => (
          <li key={i} className="break-words">
            {e}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ImportWizard({ projects }: { projects: ProjectOption[] }) {
  const { t, f } = useI18n();
  const T = t.transfer;
  const [text, setText] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("create");
  const [targetId, setTargetId] = useState("");
  const [confirm, setConfirm] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pending, startTransition] = useTransition();

  // Re-check against the chosen project (duplicates, currency) when the target changes.
  useEffect(() => {
    if (!text || mode === "create" || !targetId) return;
    startTransition(async () => {
      const res = await previewImport(text, targetId);
      if (res.ok) setPreview(res.preview);
    });
  }, [text, mode, targetId]);

  async function onFile(file: File | undefined) {
    setPreview(null);
    setErrors([]);
    setReport(null);
    setText(null);
    if (!file) return;
    let content: string;
    try {
      content = await file.text();
    } catch {
      setErrors([T.readFailed]);
      return;
    }
    setText(content);
    startTransition(async () => {
      const res = await previewImport(content);
      if (res.ok) {
        setPreview(res.preview);
        // A file exported from a project that still exists: suggest merging into it.
        if (res.preview.matchingProject) setTargetId(res.preview.matchingProject.id);
      } else {
        setErrors(res.errors);
      }
    });
  }

  function submit() {
    if (!text) return;
    const options: ImportOptions =
      mode === "create" ? { mode } : mode === "merge" ? { mode, targetId } : { mode, targetId, confirm };
    startTransition(async () => {
      const res = await runImport(text, options);
      if (res.ok) {
        setReport(res.report);
        setErrors([]);
      } else {
        setErrors(res.errors);
      }
    });
  }

  if (report) {
    const R = T.report;
    const lines = [
      report.mode === "create" ? R.created(report.projectName) : report.mode === "merge" ? R.merged(report.projectName) : R.replaced(report.projectName),
      R.parts(report.partsCreated),
      R.paidKept(report.paidPreserved),
      ...(report.mode === "merge" ? [R.partsSkipped(report.partsSkipped), R.itemsSkipped(report.itemsSkipped)] : []),
      ...(report.mode === "replace" ? [R.partsRemoved(report.partsRemoved), R.itemsRemoved(report.itemsRemoved)] : []),
      R.items(report.itemsCreated),
      ...(report.referencesSkipped ? [R.references(report.referencesSkipped)] : []),
      ...(report.backup ? [R.backup(report.backup)] : []),
    ];
    return (
      <section role="status" aria-labelledby="report-title" className="card space-y-3">
        <h2 id="report-title" className="section-title text-green-700 dark:text-green-400">
          {T.reportTitle}
        </h2>
        <ul className="space-y-1 text-sm" data-testid="import-report">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
        {report.warnings.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-400">
            {report.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-2">
          <Link href={`/projects/${report.projectId}`} className="btn-primary">
            {T.openProject}
          </Link>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setReport(null);
              setPreview(null);
              setText(null);
              setConfirm("");
            }}
          >
            {T.importAnother}
          </button>
        </div>
      </section>
    );
  }

  const target = preview?.target && preview.target.id === targetId ? preview.target : null;
  const canSubmit =
    !!preview &&
    !pending &&
    (mode === "create" ||
      (mode === "merge" && !!target && !target.currencyMismatch) ||
      (mode === "replace" && !!target && confirm.trim() === target.name));

  return (
    <div className="space-y-6">
      <section className="card space-y-3">
        <label htmlFor="import-file" className="label">
          {T.chooseFile}
        </label>
        <input
          id="import-file"
          type="file"
          accept=".json,application/json"
          onChange={(e) => onFile(e.currentTarget.files?.[0])}
          className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-brand-50 file:px-4 file:font-semibold file:text-brand-700 dark:file:bg-brand-900/40 dark:file:text-brand-200"
        />
        {pending && !preview ? <p className="hint">{T.checking}</p> : null}
      </section>

      {errors.length ? <ErrorList title={preview ? T.errors.failed : T.invalidTitle} errors={errors} /> : null}

      {preview ? (
        <>
          <section className="card space-y-3" aria-labelledby="preview-title">
            <h2 id="preview-title" className="section-title">
              {T.previewTitle}
            </h2>
            <p className="hint">
              {T.fileInfo(preview.schemaVersion, f.dateTime(new Date(preview.exportedAt)), preview.appVersion)}
            </p>
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm" data-testid="import-preview">
              <dt className="text-zinc-500 dark:text-zinc-400">{T.project}</dt>
              <dd className="font-semibold">
                {preview.projectName}
                {preview.series ? <span className="font-normal text-zinc-500"> · {preview.series}</span> : null}
              </dd>
              <dt className="text-zinc-500 dark:text-zinc-400">{T.expenses}</dt>
              <dd className="tabular-nums">{preview.partCount}</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">{T.paidExpenses}</dt>
              <dd className="tabular-nums">{preview.paidCount}</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">{T.shoppingItems}</dt>
              <dd className="tabular-nums">{preview.shoppingItemCount}</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">{T.currencies}</dt>
              <dd>{preview.currencies.join(", ")}</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">{T.baseCurrency}</dt>
              <dd>{preview.base}</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">{T.paidTotal}</dt>
              <dd className="tabular-nums">{f.money(preview.paidCents, preview.base)}</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">{T.plannedTotal}</dt>
              <dd className="tabular-nums">
                {preview.plannedConverted ? "≈ " : ""}
                {f.money(preview.plannedCents, preview.base)}
              </dd>
              <dt className="text-zinc-500 dark:text-zinc-400">{T.budget}</dt>
              <dd className="tabular-nums">{f.money(preview.budgetCents, preview.base)}</dd>
            </dl>
            <div>
              <h3 className="text-sm font-semibold">{T.warnings}</h3>
              {preview.warnings.length ? (
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-400">
                  {preview.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              ) : (
                <p className="hint">{T.noWarnings}</p>
              )}
            </div>
          </section>

          <section className="card space-y-4">
            <fieldset className="space-y-2">
              <legend className="section-title mb-2">{T.modeTitle}</legend>
              {(
                [
                  ["create", T.modeCreate, T.modeCreateHint],
                  ["merge", T.modeMerge, T.modeMergeHint],
                  ["replace", T.modeReplace, T.modeReplaceHint],
                ] as const
              ).map(([value, label, hint]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${
                    mode === value ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30" : "border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="mode"
                    value={value}
                    checked={mode === value}
                    onChange={() => {
                      setMode(value);
                      setConfirm("");
                    }}
                    className="mt-1 h-4 w-4 text-brand-600 focus:ring-brand-500"
                  />
                  <span>
                    <span className="block font-medium">{label}</span>
                    <span className="hint block">{hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {mode !== "create" ? (
              <div className="space-y-3">
                <div>
                  <label htmlFor="import-target" className="label">
                    {T.targetProject}
                  </label>
                  <select
                    id="import-target"
                    className="input"
                    value={targetId}
                    onChange={(e) => {
                      setTargetId(e.currentTarget.value);
                      setConfirm("");
                    }}
                  >
                    <option value="">{T.pickProject}</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {target && mode === "merge" ? (
                  target.currencyMismatch ? (
                    <p role="alert" className="text-sm text-red-700 dark:text-red-400">
                      {T.currencyMismatch(preview.base, target.base)}
                    </p>
                  ) : (
                    <div className="space-y-1 text-sm" data-testid="merge-summary">
                      <p>{T.mergeSummary(target.newParts, target.duplicateParts)}</p>
                      <p>{T.itemsSummary(target.newItems, target.duplicateItems)}</p>
                    </div>
                  )
                ) : null}

                {target && mode === "replace" ? (
                  <div className="space-y-3">
                    <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
                      {T.replaceWarning(target.name, target.existingParts, target.existingItems)}
                    </p>
                    <div>
                      <label htmlFor="import-confirm" className="label">
                        {T.confirmLabel(target.name)}
                      </label>
                      <input
                        id="import-confirm"
                        className="input"
                        value={confirm}
                        onChange={(e) => setConfirm(e.currentTarget.value)}
                        autoComplete="off"
                        aria-invalid={confirm !== "" && confirm.trim() !== target.name ? true : undefined}
                      />
                      {confirm !== "" && confirm.trim() !== target.name ? (
                        <p className="field-error">{T.confirmMismatch}</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className={`${mode === "replace" ? "btn-danger" : "btn-primary"} w-full sm:w-auto`}
            >
              {pending ? T.importing : mode === "create" ? T.submitCreate : mode === "merge" ? T.submitMerge : T.submitReplace}
            </button>
          </section>
        </>
      ) : null}
    </div>
  );
}
