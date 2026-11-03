import { Avatar } from "@/components/ui/Avatar";
import type { Member } from "@/lib/db/group-members";

type MemberListProps = { members: Member[]; currentUserId: string };

// Every current member, in the order they joined (DESIGN.md "MemberList").
export function MemberList({ members, currentUserId }: MemberListProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">
        Members · all equal, anyone can invite
      </h2>
      <ul className="flex flex-col gap-2">
        {members.map((member, index) => (
          <li key={member.userId} className="flex items-center gap-3">
            <Avatar name={member.name} index={index} decorative />
            <span className="font-semibold">
              {member.name}
              {member.userId === currentUserId ? " (you)" : ""}
            </span>
            {/* TODO(#9): add the member's balance Badge, written in words. */}
          </li>
        ))}
      </ul>
    </section>
  );
}
