import { MoneyText } from "@/components/ui/MoneyText";

type ListStatsProps = {
  // From openEstimateTotalCents in lib/domain/list-stats.ts.
  openEstimateCents: number;
  isPersonal: boolean;
  // The personal space's spending this month, from spentInMonthCents. Null in
  // a shared group, which doesn't show it.
  spentThisMonthCents: number | null;
};

// The card above a list (DESIGN.md "ListStats"): the estimates of the open
// items, "still to buy" in a group and "planned" in the personal space, which
// also shows what was spent this month (#23). That one counts every personal
// expense dated this month, logged directly or by checking off an item, so the
// personal list needs no other spent figure.
// TODO(#12): add spent and spent versus estimate to a shared group's list.
// They come from done items' costs, so they mean something different from the
// personal space's spent this month.
export function ListStats({
  openEstimateCents,
  isPersonal,
  spentThisMonthCents,
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
