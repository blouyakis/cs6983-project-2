import { MoneyText } from "@/components/ui/MoneyText";
import type { BalanceSummary as Totals } from "@/lib/domain/overview";

// The phone overview's balances (DESIGN.md "BalanceSummary"): You owe and
// You're owed side by side, then the net across all groups in words.
export function BalanceSummary({ totals }: { totals: Totals }) {
  return (
    <section
      aria-label="Your balances"
      className="flex flex-col gap-4 rounded-2xl border-4 border-ink bg-surface p-4 shadow-[4px_4px_0_0_var(--color-owe)]"
    >
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-sm font-bold tracking-wide text-muted uppercase">
            You owe
          </dt>
          <dd className="text-3xl font-bold text-owe">
            <MoneyText cents={totals.owingCents} />
          </dd>
        </div>
        <div className="border-l-2 border-dashed border-divider pl-4">
          <dt className="text-sm font-bold tracking-wide text-muted uppercase">
            You&apos;re owed
          </dt>
          <dd className="text-3xl font-bold text-action">
            <MoneyText cents={totals.owedCents} />
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink pt-3">
        <p className="font-semibold">
          Net across all groups:{" "}
          <MoneyText cents={totals.netCents} as="balance" />
        </p>
        {/* TODO(#68): add the Settle button, linking to /settle-up. */}
      </div>
    </section>
  );
}
