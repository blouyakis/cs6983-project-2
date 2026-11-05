import type { Expense } from "@/lib/db/expenses";
import type { ListItem } from "@/lib/db/list-items";
import { formatCents } from "@/lib/domain/money";
import type { EntryGroup } from "./EntryForm";

// What the New entry form added, for the notice under the button that opened
// it. Both modes can be reached from either button, so both say where the
// entry went: the form's group picker may have chosen another group.

export function expenseNotice(expense: Expense, group: EntryGroup): string {
  return `Added ${expense.description} (${formatCents(expense.amountCents)}) to ${group.name}.`;
}

export function planNotice(item: ListItem, group: EntryGroup): string {
  return `Added ${item.title} to ${group.name}'s list.`;
}
