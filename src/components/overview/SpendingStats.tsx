import { MoneyText } from "@/components/ui/MoneyText";

type SpendingStatsProps = {
  personalThisMonthCents: number;
  groupShareCents: number;
};

// "Your spending" on the desktop overview (DESIGN.md "SpendingStats"): the
// personal space this month, the user's share in groups this period, and the
// total, filled with `ink`. The total is a sum of two server numbers for
// display, not a balance.
export function SpendingStats({
  personalThisMonthCents,
  groupShareCents,
}: SpendingStatsProps) {
  const cards = [
    {
      cents: personalThisMonthCents,
      emoji: "🙋",
      label: "Personal, this month",
      total: false,
    },
    {
      cents: groupShareCents,
      emoji: "👥",
      label: "Your share in groups, this period",
      total: false,
    },
    {
      cents: personalThisMonthCents + groupShareCents,
      emoji: "Σ",
      label: "Total",
      total: true,
    },
  ];
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl font-bold">
        <span aria-hidden="true">🧾 </span>Your spending
      </h2>
      <ul className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <li
            key={card.label}
            className={`flex flex-col gap-1 rounded-2xl border-4 border-ink p-4 ${
              card.total
                ? "bg-ink text-surface shadow-[4px_4px_0_0_var(--color-owe)]"
                : "bg-surface"
            }`}
          >
            <span className="text-3xl font-bold">
              <MoneyText cents={card.cents} />
            </span>
            <span className="font-semibold">
              <span aria-hidden="true">{card.emoji} </span>
              {card.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
