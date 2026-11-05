import { formatDay } from "@/components/groups/format-day";
import type { ListItem } from "@/lib/db/list-items";
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
}: ListItemRowProps) {
  const { emoji, text } = splitLeadingEmoji(item.title);
  const done = item.status === "done";

  return (
    <li className="flex items-start gap-3 border-b-2 border-dashed border-divider py-3">
      {/* TODO(#12): checking off opens the check-off form, and unchecking a
          done row opens a ConfirmDialog. */}
      <input
        type="checkbox"
        checked={done}
        disabled
        readOnly
        aria-label={done ? `${text} is done` : `Check off ${text}`}
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
          // TODO(#12): add the actual cost once the list response carries it.
          <p className="text-sm font-semibold text-muted">
            ✔ {completedByName ?? "a former member"} ·{" "}
            {item.completedAt ? formatDay(item.completedAt) : ""}
          </p>
        ) : (
          <p className="text-sm font-semibold text-muted">
            {details(item, addedByName, isPersonal)}
          </p>
        )}
        {item.note ? <p className="text-sm">{item.note}</p> : null}
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
                aria-label={`Delete ${text}`}
                className="rounded-lg border-2 border-owe bg-surface px-3 py-1 text-sm font-semibold text-owe focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
              >
                Delete
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {done ? null : (
        <span aria-hidden="true" className="shrink-0 font-bold text-muted">
          {item.estimatedCents === null
            ? "—"
            : `~${formatCents(item.estimatedCents)}`}
        </span>
      )}
    </li>
  );
}
