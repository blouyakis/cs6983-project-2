import { MoneyText } from "@/components/ui/MoneyText";

type ListStatsProps = {
  // From openEstimateTotalCents in lib/domain/list-stats.ts.
  openEstimateCents: number;
  isPersonal: boolean;
};

// The card above a list (DESIGN.md "ListStats"): the estimates of the open
// items, "still to buy" in a group and "planned" in the personal space.
// TODO(#12): add spent and spent versus estimate, which need done items' costs.
export function ListStats({ openEstimateCents, isPersonal }: ListStatsProps) {
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
    </dl>
  );
}
