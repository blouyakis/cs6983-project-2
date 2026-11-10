import Link from "next/link";
import { formatDay } from "@/components/groups/format-day";
import type { Member } from "@/lib/db/group-members";
import { expenseLock } from "@/lib/domain/expense-lock";
import { formatCents } from "@/lib/domain/money";
import type { Bill } from "@/lib/services/bill-service";

type ItemizedBillProps = {
  groupId: string;
  bill: Bill;
  // The group's members, for their names.
  members: Member[];
  currentUserId: string;
  // A group the user left, or an archived one: nothing can be edited.
  readOnly: boolean;
  // When a settle-up is open, its started_at, as for ExpenseList (#86).
  settleUpStartedAt: string | null;
};

const CHIP =
  "rounded-full border-2 border-ink px-3 py-1 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2";

// An amount in a tone, written so the words around it carry the meaning, as
// MoneyText does: color never shows owing on its own (AGENTS.md Section 8).
function Toned({ cents, tone }: { cents: number; tone: "owe" | "owed" }) {
  return (
    <span
      data-tone={tone}
      className={`font-bold ${tone === "owe" ? "text-owe" : "text-action"}`}
    >
      {formatCents(cents)}
    </span>
  );
}

function OwedWords({ name, cents }: { name: string; cents: number }) {
  if (cents === 0) {
    return <>You and {name} are even</>;
  }
  return cents > 0 ? (
    <>
      You owe {name} <Toned cents={cents} tone="owe" />
    </>
  ) : (
    <>
      {name} owes you <Toned cents={-cents} tone="owed" />
    </>
  );
}

// The user's itemized bill for one period of a group (#21, DESIGN.md
// "ItemizedBill", user flow 7): only the costs they share, who paid and when,
// their share, and one line per member saying who owes whom. Chips switch
// between the current period and each closed one. Every number comes from
// the server (AGENTS.md Section 8: the browser never computes balances).
// Editing stays in Costs: a second "Edit Groceries" on the page would be two
// controls with one name, so a cost the user can change just has no lock.
export function ItemizedBill({
  groupId,
  bill,
  members,
  currentUserId,
  readOnly,
  settleUpStartedAt,
}: ItemizedBillProps) {
  const names = new Map(members.map((member) => [member.userId, member.name]));
  const nameOf = (userId: string) => names.get(userId) ?? "a former member";
  const payerName = (payerId: string) =>
    payerId === currentUserId
      ? "You"
      : (names.get(payerId) ?? "A former member");
  const totalCents = bill.owed.reduce((sum, row) => sum + row.owedCents, 0);
  const closed = bill.settlementId !== null;
  // A closed period's costs are settled, and nothing open freezes them.
  const startedAt = closed ? null : settleUpStartedAt;

  return (
    <section
      id="bill"
      aria-labelledby="bill-heading"
      className="flex scroll-mt-4 flex-col gap-3"
    >
      <h2 id="bill-heading" className="text-lg font-bold">
        <span aria-hidden="true">🧾 </span>Your bill
      </h2>
      <nav aria-label="Bill period">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link
              href={`/groups/${groupId}#bill`}
              aria-current={closed ? undefined : "page"}
              className={`${CHIP} ${closed ? "bg-surface" : "bg-ink text-surface"}`}
            >
              This period
            </Link>
          </li>
          {bill.pastPeriods.map((period) => {
            const shown = period.id === bill.settlementId;
            return (
              <li key={period.id}>
                <Link
                  href={`/groups/${groupId}?period=${period.id}#bill`}
                  aria-current={shown ? "page" : undefined}
                  className={`${CHIP} ${shown ? "bg-ink text-surface" : "bg-surface"}`}
                >
                  {formatDay(period.startedAt)} –{" "}
                  {formatDay(period.closedAt ?? period.startedAt)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex flex-col gap-4 rounded-2xl border-4 border-ink bg-surface p-4">
        {bill.lines.length === 0 ? (
          <p className="text-muted">
            You aren&apos;t part of any cost in this period.
          </p>
        ) : (
          <ul className="flex flex-col divide-y-2 divide-dashed divide-divider">
            {bill.lines.map((line) => {
              const own = line.payerId === currentUserId;
              const lock = expenseLock(line, startedAt);
              const editable = own && lock === null && !readOnly;
              const labelId = `bill-line-${line.id}`;
              return (
                <li
                  key={line.id}
                  aria-labelledby={labelId}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p id={labelId} className="truncate font-semibold">
                      {line.description}
                    </p>
                    <p className="text-sm text-muted">
                      {payerName(line.payerId)} paid · {formatDay(line.spentOn)}
                    </p>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p>
                        <span>Your share</span>{" "}
                        <Toned cents={line.shareCents} tone="owe" />
                      </p>
                      <p className="text-sm text-muted">
                        of {formatCents(line.amountCents)}
                      </p>
                    </div>
                    {editable ? null : (
                      <span className="text-sm text-muted">
                        <span aria-hidden="true">🔒 </span>
                        {lock === "settled"
                          ? "Settled"
                          : lock === "settle-up" && own
                            ? "In the open settle-up"
                            : own
                              ? "Read only"
                              : `Only ${names.get(line.payerId) ?? "the payer"} can edit this`}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {/* Not in a closed period: its settle-up paid with the fewest
            payments, which often go to a third person, so a pair can still
            show a difference although everyone's total is zero. */}
        {closed || bill.owed.length === 0 ? null : (
          <ul
            aria-label="What you owe each member"
            className="flex flex-col gap-1 border-t-2 border-dashed border-divider pt-3"
          >
            {bill.owed.map((row) => (
              <li key={row.userId}>
                <OwedWords name={nameOf(row.userId)} cents={row.owedCents} />
              </li>
            ))}
          </ul>
        )}
        <p className="font-semibold">
          {closed ? (
            "This period is closed: everything in it was paid."
          ) : totalCents === 0 ? (
            "In all, you're even."
          ) : totalCents > 0 ? (
            <>
              In all, you owe <Toned cents={totalCents} tone="owe" />
            </>
          ) : (
            <>
              In all, you are owed <Toned cents={-totalCents} tone="owed" />
            </>
          )}
        </p>
      </div>
    </section>
  );
}
