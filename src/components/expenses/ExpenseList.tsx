import { Badge } from "@/components/ui/Badge";
import type { Expense } from "@/lib/db/expenses";
import type { Member } from "@/lib/db/group-members";
import { expenseLock } from "@/lib/domain/expense-lock";
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
// edit and a lock on the rest. A cost someone who has left shares is locked
// until it is settled, since they keep the balance they left with (#22). This
// is the list the edit and delete flows (#20) live on, with every cost in the
// group. The table with filters across all the user's groups is ExpenseTable
// on the overview (#15).
export function ExpenseList({
  expenses,
  members,
  currentUserId,
  groupName,
  readOnly,
  settleUpStartedAt,
}: ExpenseListProps) {
  const names = new Map(members.map((member) => [member.userId, member.name]));
  const currentMemberIds = new Set(members.map((member) => member.userId));
  const payerName = (payerId: string) =>
    payerId === currentUserId
      ? "You"
      : (names.get(payerId) ?? "A former member");

  return (
    <section aria-labelledby="costs-heading" className="flex flex-col gap-3">
      <h2 id="costs-heading" className="text-lg font-bold">
        Costs
      </h2>
      {expenses.length === 0 ? (
        <p className="text-muted">No costs yet. Log one above.</p>
      ) : (
        <ul className="flex flex-col divide-y-2 divide-dashed divide-divider rounded-2xl border-4 border-ink bg-surface px-4">
          {expenses.map((expense) => {
            const own = expense.payerId === currentUserId;
            const lock = expenseLock(
              expense,
              settleUpStartedAt,
              currentMemberIds,
            );
            const editable = own && lock === null && !readOnly;
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
                      {lock === "settled"
                        ? "Settled"
                        : !own
                          ? `Only ${names.get(expense.payerId) ?? "the payer"} can edit this`
                          : lock === "settle-up"
                            ? "In the open settle-up"
                            : lock === "member-left" && !readOnly
                              ? "Shared with someone who left"
                              : "Read only"}
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
