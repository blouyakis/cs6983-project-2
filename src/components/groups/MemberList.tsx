import { Avatar } from "@/components/ui/Avatar";
import { MoneyText } from "@/components/ui/MoneyText";
import type { Member } from "@/lib/db/group-members";
import type { Balance } from "@/lib/domain/balances";

type MemberListProps = {
  members: Member[];
  currentUserId: string;
  // Each member's balance for the current period (#9). Left out in the
  // personal space, which has nothing to split.
  balances?: Balance[];
};

// Every current member, in the order they joined, with their balance in
// words (DESIGN.md "MemberList"): "You owe $8.83", "Sam is owed $8.83".
export function MemberList({
  members,
  currentUserId,
  balances,
}: MemberListProps) {
  const cents = new Map(
    (balances ?? []).map((balance) => [balance.userId, balance.balanceCents]),
  );
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">
        Members · all equal, anyone can invite
      </h2>
      <ul className="flex flex-col gap-2">
        {members.map((member, index) => {
          const isYou = member.userId === currentUserId;
          const balance = cents.get(member.userId);
          return (
            <li key={member.userId} className="flex items-center gap-3">
              <Avatar name={member.name} index={index} decorative />
              <span className="font-semibold">
                {member.name}
                {isYou ? " (you)" : ""}
              </span>
              {balance !== undefined ? (
                <span className="ml-auto text-sm">
                  <MoneyText
                    cents={balance}
                    as="balance"
                    who={isYou ? undefined : member.name}
                  />
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
