import { formatDay } from "@/components/groups/format-day";
import { Badge } from "@/components/ui/Badge";
import type { ListItem } from "@/lib/db/list-items";
import type { ExpenseLock } from "@/lib/domain/expense-lock";
import { splitLeadingEmoji } from "@/lib/domain/leading-emoji";
import { formatCents } from "@/lib/domain/money";

type ListItemRowProps = {
  item: ListItem;
  // "You", a member's name, or "a former member", worked out by the list.
  addedByName: string;
  completedByName: string | null;
  isPersonal: boolean;
  // Left out in a read-only list. Never offered for a done item, which has to
  // be unchecked first (#12).
  onEdit?: (item: ListItem) => void;
  onDelete?: (item: ListItem) => void;
  // True while its delete is on its way, so it can't be sent twice.
  deleting?: boolean;
  // What a done item cost, from the list response (#12). Null for no cost.
  costCents?: number | null;
  // Why a done item's expense can't be deleted, so it can't be unchecked.
  lock?: ExpenseLock | null;
  // Checks an open item off, or unchecks a done one (#12). Left out, the
  // checkbox is disabled: in a read-only list, and for a done item that only
  // someone else could uncheck, or whose expense is locked.
  onCheckChange?: (item: ListItem) => void;
};

const LOCKS: Record<ExpenseLock, string> = {
  settled: "Settled",
  "settle-up": "In the open settle-up",
};

function details(item: ListItem, addedByName: string, isPersonal: boolean) {
  const who = isPersonal
    ? `Added ${formatDay(item.createdAt)}`
    : `added by ${addedByName}`;
  const cost =
    item.estimatedCents === null
      ? "no cost"
      : `est. ${formatCents(item.estimatedCents)}`;
  return `${who} · ${cost}`;
}

// One row of a list (DESIGN.md "ListItemRow"). The estimate on the right is
// for the eye; the line under the title says the same in words, so screen
// readers hear it once.
export function ListItemRow({
  item,
  addedByName,
  completedByName,
  isPersonal,
  onEdit,
  onDelete,
  deleting = false,
  costCents = null,
  lock = null,
  onCheckChange,
}: ListItemRowProps) {
  const { emoji, text } = splitLeadingEmoji(item.title);
  const done = item.status === "done";

  return (
    <li className="flex items-start gap-3 border-b-2 border-dashed border-divider py-3">
      <input
        type="checkbox"
        checked={done}
        disabled={!onCheckChange}
        onChange={() => onCheckChange?.(item)}
        aria-label={
          done
            ? onCheckChange
              ? `Uncheck ${text}`
              : `${text} is done`
            : `Check off ${text}`
        }
        className="mt-1 size-6 shrink-0 accent-action"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-bold">
          {emoji ? <span aria-hidden="true">{emoji} </span> : null}
          <span className={done ? "line-through" : undefined}>{text}</span>
          {item.quantity !== null ? (
            <span className="font-semibold text-muted"> × {item.quantity}</span>
          ) : null}
        </p>
        {done ? (
          <p className="text-sm font-semibold text-muted">
            ✔ {completedByName ?? "a former member"}
            {costCents === null ? "" : ` paid ${formatCents(costCents)}`} ·{" "}
            {item.completedAt ? formatDay(item.completedAt) : ""}
            {lock ? (
              <span>
                {" · "}
                <span aria-hidden="true">🔒 </span>
                <span>{LOCKS[lock]}</span>
              </span>
            ) : null}
          </p>
        ) : (
          <p className="text-sm font-semibold text-muted">
            {details(item, addedByName, isPersonal)}
          </p>
        )}
        {item.note ? <p className="text-sm">{item.note}</p> : null}
        {done && isPersonal && costCents !== null ? (
          <p>
            <Badge>Logged as personal expense</Badge>
          </p>
        ) : null}
        {!done && (onEdit || onDelete) ? (
          <div className="flex gap-2">
            {onEdit ? (
              <button
                type="button"
                onClick={() => onEdit(item)}
                aria-label={`Edit ${text}`}
                className="rounded-lg border-2 border-ink bg-surface px-3 py-1 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
              >
                Edit
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(item)}
                disabled={deleting}
                aria-label={`Delete ${text}`}
                className="rounded-lg border-2 border-owe bg-surface px-3 py-1 text-sm font-semibold text-owe disabled:cursor-not-allowed disabled:bg-disabled focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
              >
                Delete
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {done ? (
        costCents === null ? null : (
          <span aria-hidden="true" className="shrink-0 font-bold text-action">
            {formatCents(costCents)}
          </span>
        )
      ) : (
        <span aria-hidden="true" className="shrink-0 font-bold text-muted">
          {item.estimatedCents === null
            ? "—"
            : `~${formatCents(item.estimatedCents)}`}
        </span>
      )}
    </li>
  );
}
