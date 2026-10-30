import { useId, type InputHTMLAttributes } from "react";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  name: string;
  hint?: string;
  error?: string;
};

export function TextField({
  label,
  name,
  hint,
  error,
  type = "text",
  ...inputProps
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      <input
        {...inputProps}
        id={id}
        name={name}
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="rounded-lg border-2 border-ink bg-surface px-3 py-2 text-ink aria-invalid:border-owe"
      />
      <p id={errorId} aria-live="polite" className="text-sm text-owe">
        {error}
      </p>
    </div>
  );
}
