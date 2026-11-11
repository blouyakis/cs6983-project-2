import { formatDay } from "@/components/groups/format-day";
import { Badge } from "@/components/ui/Badge";
import type { Member } from "@/lib/db/group-members";
import type { EditLock } from "@/lib/domain/expense-history";
import { formatCents } from "@/lib/domain/money";
import type { ExpenseHistoryRow } from "@/lib/services/expense-history-service";
import { EditExpenseButton } from "./EditExpenseButton";

type ExpenseTableProps = {
  expenses: ExpenseHistoryRow[];
  currentUserId: string;
  // Each group's members by group id, for the payer's name and the edit form.
  membersByGroup: Record<string, Member[]>;
  // What to say when there is nothing to list.
  emptyMessage: string;
};

const CELL = "px-3 py-3 align-top";
const HEAD = "px-3 py-2 text-left text-sm font-bold";

// Why a row has a lock, in words (AGENTS.md Section 8: never an icon alone).
function lockLabel(lock: EditLock, payerName: string): string {
  switch (lock) {
    case "settled":
      return "Settled";
    case "not-payer":
      return `Only ${payerName} can edit this`;
    case "settle-up":
      return "In the open settle-up";
    case "read-only":
      return "Read only";
    case "member-left":
      return "Shared with someone who left";
  }
}

// The expense history (#15, DESIGN.md "ExpenseTable"): Date, Expense, Group,
// Paid by, Total, Your share and Edit. Edit has a pencil on an unsettled
// expense the user paid and a lock, with the reason, on the rest; a legend
// under the table explains both. The rows and what can be edited come from
// the server (listExpenseHistory); nothing is worked out here.
export function ExpenseTable({
  expenses,
  currentUserId,
  membersByGroup,
  emptyMessage,
}: ExpenseTableProps) {
  if (expenses.length === 0) {
    return <p className="text-muted">{emptyMessage}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {/* A wide table scrolls sideways inside this region, never the page.
          It can be focused so a keyboard user can scroll it. */}
      <div
        role="region"
        aria-label="Expenses table"
        tabIndex={0}
        className="overflow-x-auto rounded-2xl border-4 border-ink bg-surface"
      >
        <table className="w-full border-collapse">
          <caption className="sr-only">
            The expenses you share, newest first
          </caption>
          <thead>
            <tr className="border-b-2 border-ink">
              <th scope="col" className={HEAD}>
                Date
              </th>
              <th scope="col" className={HEAD}>
                Expense
              </th>
              <th scope="col" className={HEAD}>
                Group
              </th>
              <th scope="col" className={HEAD}>
                Paid by
              </th>
              <th scope="col" className={`${HEAD} text-right`}>
                Total
              </th>
              <th scope="col" className={`${HEAD} text-right`}>
                Your share
              </th>
              <th scope="col" className={HEAD}>
                Edit
              </th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-dashed divide-divider">
            {expenses.map((expense) => {
              const members = membersByGroup[expense.groupId] ?? [];
              const payer = members.find(
                (member) => member.userId === expense.payerId,
              );
              const payerName = payer?.name ?? "a former member";
              return (
                <tr key={expense.id}>
                  <td className={`${CELL} whitespace-nowrap`}>
                    {formatDay(expense.spentOn)}
                  </td>
                  <th scope="row" className={`${CELL} text-left font-semibold`}>
                    <span className="flex flex-wrap items-center gap-2">
                      {expense.description}
                      {expense.editedAt ? <Badge>Edited</Badge> : null}
                    </span>
                  </th>
                  <td className={CELL}>{expense.groupName}</td>
                  <td className={CELL}>
                    {expense.payerId === currentUserId
                      ? "You"
                      : (payer?.name ?? "A former member")}
                  </td>
                  <td className={`${CELL} text-right whitespace-nowrap`}>
                    {formatCents(expense.amountCents)}
                  </td>
                  <td
                    className={`${CELL} text-right font-bold whitespace-nowrap`}
                  >
                    {formatCents(expense.yourShareCents)}
                  </td>
                  <td className={CELL}>
                    {expense.editLock === null ? (
                      <EditExpenseButton
                        expense={expense}
                        groupName={expense.groupName}
                        members={members}
                        currentUserId={currentUserId}
                      />
                    ) : (
                      <span className="text-sm text-muted">
                        <span aria-hidden="true">🔒 </span>
                        {lockLabel(expense.editLock, payerName)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted">
        <span aria-hidden="true">✏️ </span>You paid it and it isn&apos;t
        settled, so you can edit it. <span aria-hidden="true">🔒 </span>Someone
        else paid it, or it is settled, in an open settle-up, shared with
        someone who left, or read-only.
      </p>
    </div>
  );
}
