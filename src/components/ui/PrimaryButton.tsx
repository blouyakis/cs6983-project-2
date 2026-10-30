import type { ButtonHTMLAttributes } from "react";

export function PrimaryButton({
  type = "button",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      type={type}
      className={`rounded-lg border-2 border-ink bg-action px-4 py-2 font-semibold text-white shadow-[3px_3px_0_0_var(--color-ink)] disabled:bg-disabled disabled:text-ink disabled:shadow-none ${className}`}
    />
  );
}
