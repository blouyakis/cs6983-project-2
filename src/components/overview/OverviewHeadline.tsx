import type { ReactNode } from "react";
import { MoneyText } from "@/components/ui/MoneyText";
import type { BalanceSummary } from "@/lib/domain/overview";

type OverviewHeadlineProps = {
  totals: BalanceSummary;
  now: Date;
  // The Add a plan or cost button, at the right.
  children?: ReactNode;
};

// TODO(#77): show the day in the user's time zone, not UTC.
function formatToday(now: Date): string {
  return now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// The desktop overview's net balance as one sentence (DESIGN.md
// "OverviewHeadline"), with the amount in `owe` or `action` and the words
// around it, so owing never shows by color alone.
export function OverviewHeadline({
  totals,
  now,
  children,
}: OverviewHeadlineProps) {
  return (
    <section className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-4xl font-bold lg:text-5xl">
          <MoneyText cents={totals.netCents} as="balance" /> across your groups.
        </h2>
        <p className="font-semibold text-muted">
          {formatToday(now)} · you owe <MoneyText cents={totals.owingCents} />{" "}
          and are owed <MoneyText cents={totals.owedCents} />
        </p>
      </div>
      {children}
    </section>
  );
}
