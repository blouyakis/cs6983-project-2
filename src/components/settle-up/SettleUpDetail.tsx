import { notFound, redirect } from "next/navigation";
import { formatDay } from "@/components/groups/format-day";
import { PayDirectlyCard } from "@/components/payments/PayDirectlyCard";
import { Badge } from "@/components/ui/Badge";
import { NoticeLine, NoticeProvider } from "@/components/ui/NoticeProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSessionUserId } from "@/lib/auth/cookies";
import { ForbiddenError, NotFoundError } from "@/lib/http/errors";
import { getGroupBalances } from "@/lib/services/balance-service";
import { listGroupExpenses } from "@/lib/services/expense-service";
import { getGroup, type GroupDetails } from "@/lib/services/group-service";
import {
  getCurrentSettleUp,
  listPastPeriods,
  type SettleUp,
} from "@/lib/services/settlement-service";
import { groupParamsSchema } from "@/lib/validation/group";
import { PastPeriods } from "./PastPeriods";
import { SettleUpPanel } from "./SettleUpPanel";
import { StandingsCard } from "./StandingsCard";

type SettleUpDetailProps = { params: Promise<{ groupId: string }> };

// One group's settle-up screen (DESIGN.md "Settle up", user flow 5). Reads
// the session and the route params, so render it inside <Suspense>. A group
// the user can't see, a malformed id and a personal space are all a plain
// not found, so the page never says whether a group exists.
export async function SettleUpDetail({ params }: SettleUpDetailProps) {
  const parsed = groupParamsSchema.safeParse(await params);
  if (!parsed.success) {
    notFound();
  }
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }
  let group: GroupDetails;
  try {
    group = await getGroup(userId, parsed.data.groupId);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      notFound();
    }
    throw error;
  }
  if (group.isPersonal) {
    notFound();
  }

  // Everything is computed on the server per request (AGENTS.md Section 8).
  const [balances, expenses, settleUp, periods] = await Promise.all([
    getGroupBalances(userId, group.id),
    listGroupExpenses(userId, group.id),
    getCurrentSettleUp(userId, group.id).catch((error: unknown) => {
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error;
    }) as Promise<SettleUp | null>,
    listPastPeriods(userId, group.id),
  ]);
  const unsettled = expenses.filter((expense) => !expense.settled).length;
  // The open period starts where the last closed one ended.
  const periodSince = periods[0]?.closedAt ?? group.createdAt;
  const names = Object.fromEntries(
    group.members.map((member) => [member.userId, member.name]),
  );

  return (
    <NoticeProvider>
      <div className="flex flex-col gap-8">
        <PageHeader
          title={`Settle up · ${group.name}`}
          emoji="💸"
          context={`Open period since ${formatDay(periodSince)} · ${
            unsettled === 1
              ? "1 unsettled expense"
              : `${unsettled} unsettled expenses`
          }`}
          back={{ href: `/groups/${group.id}`, label: `Back to ${group.name}` }}
        >
          {group.readOnly ? <Badge>Read only</Badge> : null}
        </PageHeader>
        <NoticeLine />
        <div className="grid gap-8 lg:grid-cols-2">
          <StandingsCard
            members={group.members}
            balances={balances}
            currentUserId={userId}
            unsettledExpenses={unsettled}
            billHref={`/groups/${group.id}`}
          >
            {/* Recording a payment needs write access (#14). */}
            {group.readOnly ? null : (
              <PayDirectlyCard
                groupId={group.id}
                members={group.members}
                currentUserId={userId}
              />
            )}
          </StandingsCard>
          <SettleUpPanel
            groupId={group.id}
            settleUp={settleUp}
            names={names}
            currentUserId={userId}
            memberCount={group.members.length}
            readOnly={group.readOnly}
          />
        </div>
        {/* Desktop also lists closed past periods (DESIGN.md "Settle up"). */}
        <div className="hidden md:block">
          <PastPeriods periods={periods} />
        </div>
        <p className="text-sm font-semibold text-muted">
          LifeBoard records payments you make elsewhere (Venmo, cash…). It never
          moves money.
        </p>
      </div>
    </NoticeProvider>
  );
}
