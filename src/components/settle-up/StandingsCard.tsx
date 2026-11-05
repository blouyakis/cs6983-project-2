import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { MoneyText } from "@/components/ui/MoneyText";
import type { Member } from "@/lib/db/group-members";
import type { Balance } from "@/lib/domain/balances";

type StandingsCardProps = {
  members: Member[];
  balances: Balance[];
  currentUserId: string;
  unsettledExpenses: number;
  // Where the footnote's link goes: the group's bill.
  billHref: string;
};

// "Where everyone stands" (DESIGN.md "StandingsCard"): each member's balance
// in words, with a bar for the eye only. Owing fills it in owe, being owed
// in action green. The current user comes first.
export function StandingsCard({
  members,
  balances,
  currentUserId,
  unsettledExpenses,
  billHref,
}: StandingsCardProps) {
  const cents = new Map(
    balances.map((balance) => [balance.userId, balance.balanceCents]),
  );
  const largest = Math.max(
    0,
    ...balances.map((balance) => Math.abs(balance.balanceCents)),
  );
  const ordered = [
    ...members.filter((member) => member.userId === currentUserId),
    ...members.filter((member) => member.userId !== currentUserId),
  ];
  const expensesLabel =
    unsettledExpenses === 1
      ? "1 unsettled expense"
      : `${unsettledExpenses} unsettled expenses`;

  return (
    <section
      aria-labelledby="standings-heading"
      className="flex flex-col gap-4 rounded-2xl border-4 border-ink bg-surface p-4"
    >
      <h2 id="standings-heading" className="text-xl font-bold">
        <span aria-hidden="true">⚖️ </span>Where everyone stands
      </h2>
      <ul className="flex flex-col gap-3">
        {ordered.map((member, index) => {
          const balance = cents.get(member.userId) ?? 0;
          const isYou = member.userId === currentUserId;
          const width = largest === 0 ? 0 : (Math.abs(balance) / largest) * 100;
          return (
            <li key={member.userId} className="flex items-center gap-3">
              <Avatar name={member.name} index={index} decorative />
              <span className="w-28 shrink-0 font-semibold">
                {isYou ? `You (${member.name})` : member.name}
              </span>
              {balance === 0 ? null : (
                <span
                  data-bar
                  aria-hidden="true"
                  className="hidden h-4 flex-1 overflow-hidden rounded-md border-2 border-ink bg-canvas sm:block"
                >
                  <span
                    className={`block h-full ${balance < 0 ? "bg-owe" : "bg-action"}`}
                    style={{ width: `${width.toFixed(1)}%` }}
                  />
                </span>
              )}
              <span className="ml-auto text-right text-sm">
                <MoneyText
                  cents={balance}
                  as="balance"
                  who={isYou ? undefined : member.name}
                />
              </span>
            </li>
          );
        })}
      </ul>
      <p className="border-t-2 border-dashed border-divider pt-3 text-sm font-semibold text-muted">
        <Link href={billHref} className="underline">
          {expensesLabel}
        </Link>
        {" · "}balances move the moment a payment is confirmed.
      </p>
    </section>
  );
}
