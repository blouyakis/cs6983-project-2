import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  // "owed" is for a member who is owed money. The words must still say so,
  // because color never shows meaning on its own (AGENTS.md Section 8).
  tone?: "owe" | "owed";
};

const TONES = {
  owe: "bg-tag text-owe",
  owed: "bg-avatar-3 text-action",
};

// Small uppercase text, such as READ ONLY or "owes $31" (DESIGN.md "Badge").
export function Badge({ children, tone = "owe" }: BadgeProps) {
  return (
    <span
      className={`inline-block rounded-md border-2 border-current px-2 py-0.5 text-xs font-bold tracking-wide uppercase ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
