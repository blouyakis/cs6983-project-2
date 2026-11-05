import { formatCents } from "@/lib/domain/money";

type MoneyTextProps = {
  cents: number;
} & (
  | {
      // A plain amount, such as an estimate or a total.
      as?: "amount";
    }
  | {
      // A signed balance: negative means owing, positive means being owed.
      as: "balance";
      // Whose balance it is. Leave it out for the current user.
      who?: string;
    }
);

const TONES = {
  owe: "text-owe",
  owed: "text-action",
};

// Every amount on a screen goes through this (DESIGN.md "MoneyText"). Cents
// become dollars only here (AGENTS.md Section 6.1), and a balance is written
// in words, "You owe $31.00" or "Sam is owed $42.00", because color alone
// never shows owing (AGENTS.md Section 8). The amount is a child element with
// the tone, so the words stay plain text around it.
export function MoneyText(props: MoneyTextProps) {
  if (props.as !== "balance") {
    return <span>{formatCents(props.cents)}</span>;
  }
  const { cents, who } = props;
  const amount = formatCents(Math.abs(cents));
  if (cents === 0) {
    return <span>{who ? `${who} is` : "You are"} all settled up</span>;
  }
  const tone = cents < 0 ? "owe" : "owed";
  const words = who
    ? `${who} ${tone === "owe" ? "owes" : "is owed"}`
    : tone === "owe"
      ? "You owe"
      : "You are owed";
  return (
    <span>
      {words}{" "}
      <span data-tone={tone} className={`font-bold ${TONES[tone]}`}>
        {amount}
      </span>
    </span>
  );
}
