import Link from "next/link";
import { redirect } from "next/navigation";
import { GroupTile } from "@/components/groups/GroupTile";
import { Badge } from "@/components/ui/Badge";
import { MoneyText } from "@/components/ui/MoneyText";
import { getSessionUserId } from "@/lib/auth/cookies";
import { getOverview } from "@/lib/services/overview-service";
import { listOpenSettlementGroupIds } from "@/lib/services/settlement-service";

// The Settle up landing page (#68). Lists each current shared group with the
// user's balance in words, linking to that group's settle-up screen. A group
// with an open settle-up says "Settle-up in progress". Reads the session, so
// render it inside <Suspense>.
export async function SettleUpBoard() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }
  const { groups } = await getOverview(userId);
  const openSettlements = await listOpenSettlementGroupIds(
    groups.map((group) => group.id),
  );

  return (
    <div className="flex flex-col gap-6">
      {groups.length === 0 ? (
        <p>
          There is nothing to settle.{" "}
          <Link href="/groups" className="font-bold text-owe underline">
            Create a group
          </Link>{" "}
          to plan and split costs with others.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {groups.map((group) => {
            const inProgress = openSettlements.has(group.id);
            return (
              <li key={group.id}>
                <Link
                  href={`/groups/${group.id}/settle-up`}
                  className="flex items-center gap-4 rounded-2xl border-4 border-ink bg-surface p-4 hover:shadow-[4px_4px_0_0_var(--color-ink)]"
                >
                  <GroupTile name={group.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-lg font-bold">
                        {group.name}
                      </h3>
                      {inProgress ? <Badge>Settle-up in progress</Badge> : null}
                    </div>
                    <p className="text-sm font-semibold">
                      <MoneyText cents={group.balanceCents} as="balance" />
                    </p>
                  </div>
                  <span aria-hidden="true" className="text-xl text-owe">
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
