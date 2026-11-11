import type { Member } from "@/lib/db/group-members";
import {
  ForbiddenError,
  ValidationError,
  type FieldErrors,
} from "@/lib/http/errors";
import {
  listExpenseHistory,
  type ExpenseHistoryRow,
} from "@/lib/services/expense-history-service";
import type { GroupSummary } from "@/lib/services/group-service";
import { expenseHistoryQuerySchema } from "@/lib/validation/expense";
import { parseInput } from "@/lib/validation/parse";
import { ExpenseFilters, type ExpenseFilterValues } from "./ExpenseFilters";
import { ExpenseTable } from "./ExpenseTable";

// A page's search params, as Next.js gives them.
export type SearchParams = Record<string, string | string[] | undefined>;

type ExpenseHistoryProps = {
  userId: string;
  // Every group the user is or was in, personal space included.
  groups: GroupSummary[];
  // The page's search params: groupId, paidBy, from and to.
  query: SearchParams;
};

// The section's id, so the filter form can come back to it.
const SECTION_ID = "expenses";

// A filter that appears twice in the address counts once, with its first
// value.
function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

// Everyone who is or was in one of the user's groups, the user first as
// "You", then by name.
function payersOf(
  userId: string,
  groups: readonly GroupSummary[],
): { userId: string; name: string }[] {
  const names = new Map<string, string>();
  for (const group of groups) {
    for (const member of group.members) {
      names.set(member.userId, member.name);
    }
  }
  names.delete(userId);
  const others = Array.from(names, ([id, name]) => ({ userId: id, name })).sort(
    (a, b) => a.name.localeCompare(b.name),
  );
  return [{ userId, name: "You" }, ...others];
}

// "Your expenses" on the overview (#15, user story 1): ExpenseFilters above
// ExpenseTable. The filters come from the address and go through the same
// schema and service as GET /api/expenses, so the page and the API always
// agree. A filter the server refuses is shown next to its field, with no
// table, instead of an error page. Async: render it on the server.
export async function ExpenseHistory({
  userId,
  groups,
  query,
}: ExpenseHistoryProps) {
  const values: ExpenseFilterValues = {
    groupId: first(query.groupId),
    paidBy: first(query.paidBy),
    from: first(query.from),
    to: first(query.to),
  };
  const filtered = Object.values(values).some((value) => value !== "");

  let expenses: ExpenseHistoryRow[] | null = null;
  let errors: FieldErrors = {};
  try {
    expenses = await listExpenseHistory(
      userId,
      parseInput(expenseHistoryQuerySchema, values),
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      errors = error.fields ?? {};
    } else if (error instanceof ForbiddenError) {
      // A group id from the address that isn't one of the user's groups.
      errors = { groupId: "Choose one of your groups." };
    } else {
      throw error;
    }
  }

  const membersByGroup: Record<string, Member[]> = Object.fromEntries(
    groups.map((group) => [group.id, group.members]),
  );

  return (
    <section
      id={SECTION_ID}
      aria-labelledby="expenses-heading"
      className="flex flex-col gap-4"
    >
      <h2 id="expenses-heading" className="text-2xl font-bold">
        <span aria-hidden="true">📒 </span>Your expenses
      </h2>
      <ExpenseFilters
        action={`/#${SECTION_ID}`}
        groups={groups.map(({ id, name }) => ({ id, name }))}
        payers={payersOf(userId, groups)}
        values={values}
        errors={errors}
        count={expenses?.length ?? null}
      />
      {expenses === null ? null : (
        <ExpenseTable
          expenses={expenses}
          currentUserId={userId}
          membersByGroup={membersByGroup}
          emptyMessage={
            filtered
              ? "Nothing matches. Change or clear the filters to see more."
              : "No expenses yet. A cost you add or share shows up here."
          }
        />
      )}
    </section>
  );
}
