import { firstCharacter } from "@/lib/domain/first-character";

const FILLS = ["bg-avatar-1", "bg-avatar-2", "bg-avatar-3"];

type AvatarProps = {
  name: string;
  // The member's position in the list, so neighbours get different fills.
  index: number;
  // Set when the name is written right next to the avatar, so a screen
  // reader doesn't read it twice.
  decorative?: boolean;
};

// A round circle with the member's first character (DESIGN.md "Avatar").
export function Avatar({ name, index, decorative = false }: AvatarProps) {
  const fill = FILLS[index % FILLS.length];
  return (
    <span
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": name })}
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-ink font-bold text-ink ${fill}`}
    >
      {firstCharacter(name)}
    </span>
  );
}
