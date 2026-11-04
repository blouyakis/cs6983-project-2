import { firstCharacter } from "@/lib/domain/first-character";

// The yellow tile with a group's first character, the same rule as Avatar, so
// "🏠 Flat" shows 🏠 (DESIGN.md "GroupCard"). The name is written beside it,
// so the tile is hidden from screen readers.
export function GroupTile({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      data-testid="group-tile"
      className="inline-flex size-14 shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-sidebar text-2xl font-bold"
    >
      {firstCharacter(name)}
    </span>
  );
}
