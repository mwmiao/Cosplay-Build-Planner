"use client";

import { useId } from "react";

type BaseProps = {
  label: string;
  name: string;
  errors?: string[];
  hint?: string;
  className?: string;
};

type InputProps = BaseProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "className"> & { as?: "input" };
type TextareaProps = BaseProps &
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "className"> & { as: "textarea" };
type SelectProps = BaseProps &
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name" | "className"> & {
    as: "select";
    options: readonly { value: string; label: string }[];
  };

/** Labelled form control with hint + error text wired up via aria attributes. */
export function Field(props: InputProps | TextareaProps | SelectProps) {
  const id = useId();
  const { label, name, errors, hint, className } = props;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [errors?.length ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(" ") || undefined;
  const common = {
    id,
    name,
    "aria-invalid": errors?.length ? true : undefined,
    "aria-describedby": describedBy,
  };

  let control: React.ReactNode;
  if (props.as === "textarea") {
    const { as: _a, label: _l, errors: _e, hint: _h, className: _c, ...rest } = props;
    control = <textarea {...rest} {...common} className="input min-h-28" />;
  } else if (props.as === "select") {
    const { as: _a, label: _l, errors: _e, hint: _h, className: _c, options, ...rest } = props;
    control = (
      <select {...rest} {...common} className="input">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else {
    const { as: _a, label: _l, errors: _e, hint: _h, className: _c, ...rest } = props;
    control = <input {...rest} {...common} className="input" />;
  }

  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {props.required ? <span className="text-brand-600"> *</span> : null}
      </label>
      {control}
      {hint ? (
        <p id={hintId} className="hint">
          {hint}
        </p>
      ) : null}
      {errors?.length ? (
        <p id={errorId} className="field-error">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}
