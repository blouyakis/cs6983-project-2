import { formatDay } from "@/components/groups/format-day";
import { Badge } from "@/components/ui/Badge";
import type { ClosedPeriod } from "@/lib/db/settlements";

type PastPeriodsProps = {
  periods: ClosedPeriod[];
};

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

// One card per closed period (DESIGN.md "PastPeriods"), newest first.
export function PastPeriods({ periods }: PastPeriodsProps) {
  return (
    <section
      aria-labelledby="past-periods-heading"
      className="flex flex-col gap-3"
    >
      <h2 id="past-periods-heading" className="text-xl font-bold">
        <span aria-hidden="true">🗂️ </span>Past periods
      </h2>
      {periods.length === 0 ? (
        <p className="text-muted">No period has closed yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {periods.map((period) => (
            <li
              key={period.id}
              className="flex items-center justify-between gap-3 rounded-2xl border-4 border-ink bg-surface p-4"
            >
              <div>
                <p className="font-bold">
                  {formatDay(period.startedAt)} –{" "}
                  {formatDay(period.closedAt ?? period.startedAt)}
                </p>
                <p className="text-sm font-semibold text-muted">
                  {count(period.expenseCount, "expense")} ·{" "}
                  {count(period.paymentCount, "payment")}
                </p>
              </div>
              <Badge>Closed</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
