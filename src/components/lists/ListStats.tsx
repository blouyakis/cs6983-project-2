import { MoneyText } from "@/components/ui/MoneyText";
import type { CheckedOffTotals } from "@/lib/domain/list-stats";
import { formatCents } from "@/lib/domain/money";

type ListStatsProps = {
  // From openEstimateTotalCents in lib/domain/list-stats.ts.
  openEstimateCents: number;
  isPersonal: boolean;
  // The personal space's spending this month, from spentInMonthCents. Null in
  // a shared group, which doesn't show it.
  spentThisMonthCents: number | null;
  // Spent and spent versus estimate in a shared group, from checkedOffTotals
  // (#12). Left out in the personal space, which shows spent this month.
  checkedOff?: CheckedOffTotals | null;
};

// In words, so it never depends on a color (AGENTS.md Section 8).
function versusEstimate(overEstimateCents: number): string {
  if (overEstimateCents > 0) {
    return `${formatCents(overEstimateCents)} over the estimate`;
  }
  if (overEstimateCents < 0) {
    return `${formatCents(-overEstimateCents)} under the estimate`;
  }
  return "Right on the estimate";
}

// The card above a list (DESIGN.md "ListStats"): the estimates of the open
// items, "still to buy" in a group and "planned" in the personal space, which
// also shows what was spent this month (#23). That one counts every personal
// expense dated this month, logged directly or by checking off an item, so the
// personal list needs no other spent figure.
// A shared group also shows spent and spent versus estimate, from the costs
// its done items were checked off with (#12).
export function ListStats({
  openEstimateCents,
  isPersonal,
  spentThisMonthCents,
  checkedOff = null,
}: ListStatsProps) {
  return (
    <dl className="flex gap-4 rounded-2xl border-4 border-ink bg-surface p-4 shadow-[6px_6px_0_0_var(--color-owe)]">
      <div className="flex flex-col gap-1">
        <dt className="text-sm font-bold tracking-wide text-muted uppercase">
          <span aria-hidden="true">🔮 </span>
          {isPersonal ? "Planned" : "Still to buy"}
        </dt>
        <dd className="text-3xl font-bold">
          <MoneyText cents={openEstimateCents} />
        </dd>
      </div>
      {checkedOff === null ? null : (
        <div className="flex flex-col gap-1">
          <dt className="text-sm font-bold tracking-wide text-muted uppercase">
            <span aria-hidden="true">🧾 </span>Spent
          </dt>
          <dd className="text-3xl font-bold">
            <MoneyText cents={checkedOff.spentCents} />
          </dd>
          {checkedOff.overEstimateCents === null ? null : (
            <dd className="text-sm font-semibold text-muted">
              {versusEstimate(checkedOff.overEstimateCents)}
            </dd>
          )}
        </div>
      )}
      {spentThisMonthCents === null ? null : (
        <div className="flex flex-col gap-1 rounded-xl bg-ink p-3 text-surface">
          <dt className="text-sm font-bold tracking-wide uppercase">
            <span aria-hidden="true">🧾 </span>Spent this month
          </dt>
          <dd className="text-3xl font-bold">
            <MoneyText cents={spentThisMonthCents} />
          </dd>
        </div>
      )}
    </dl>
  );
}
