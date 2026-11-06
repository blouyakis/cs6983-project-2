import { Badge } from "@/components/ui/Badge";
import type { Expense } from "@/lib/db/expenses";
import type { Member } from "@/lib/db/group-members";
import { formatCents } from "@/lib/domain/money";
import { formatDay } from "@/components/groups/format-day";
import { EditExpenseButton } from "./EditExpenseButton";

type ExpenseListProps = {
  expenses: Expense[];
  // The group's current members, for names and for the edit form.
  members: Member[];
  currentUserId: string;
  groupName: string;
  // A group the user left, or an archived one: nothing can be edited.
  readOnly: boolean;
  // When a settle-up is open, its started_at: costs created on or before it
  // are frozen until the period closes (#86). Null otherwise.
  settleUpStartedAt: string | null;
};

// The group's costs, newest first, with a pencil on the ones the user can
// edit and a lock on the rest (DESIGN.md "ExpenseTable"). The full table with
// filters is #15; this is the list the edit and delete flows (#20) live on.
// TODO(#15): replace with ExpenseTable and ExpenseFilters.
export function ExpenseList({
  expenses,
  members,
  currentUserId,
  groupName,
  readOnly,
  settleUpStartedAt,
}: ExpenseListProps) {
  const names = new Map(members.map((member) => [member.userId, member.name]));
  const payerName = (payerId: string) =>
    payerId === currentUserId
      ? "You"
      : (names.get(payerId) ?? "A former member");

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">Costs</h2>
      {expenses.length === 0 ? (
        <p className="text-muted">No costs yet. Log one above.</p>
      ) : (
        <ul className="flex flex-col divide-y-2 divide-dashed divide-divider rounded-2xl border-4 border-ink bg-surface px-4">
          {expenses.map((expense) => {
            const own = expense.payerId === currentUserId;
            const inSettleUp =
              settleUpStartedAt !== null &&
              expense.createdAt <= settleUpStartedAt;
            const editable =
              own && !expense.settled && !inSettleUp && !readOnly;
            return (
              <li
                key={expense.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    <span className="truncate">{expense.description}</span>
                    {expense.editedAt ? <Badge>Edited</Badge> : null}
                  </p>
                  <p className="text-sm text-muted">
                    {payerName(expense.payerId)} paid ·{" "}
                    {formatDay(expense.spentOn)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-bold">
                    {formatCents(expense.amountCents)}
                  </span>
                  {editable ? (
                    <EditExpenseButton
                      expense={expense}
                      groupName={groupName}
                      members={members}
                      currentUserId={currentUserId}
                    />
                  ) : (
                    <span className="text-sm text-muted">
                      <span aria-hidden="true">🔒 </span>
                      {expense.settled
                        ? "Settled"
                        : inSettleUp && own
                          ? "In the open settle-up"
                          : own
                            ? "Read only"
                            : `Only ${names.get(expense.payerId) ?? "the payer"} can edit this`}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
