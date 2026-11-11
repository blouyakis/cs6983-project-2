import Link from "next/link";
import { redirect } from "next/navigation";
import { AddPlanButton } from "@/components/expenses/AddPlanButton";
import {
  ExpenseHistory,
  type SearchParams,
} from "@/components/expenses/ExpenseHistory";
import { ArchivedGroupCard } from "@/components/groups/ArchivedGroupCard";
import { GroupCard } from "@/components/groups/GroupCard";
import { NoticeLine, NoticeProvider } from "@/components/ui/NoticeProvider";
import { getSessionUserId } from "@/lib/auth/cookies";
import { getOverview } from "@/lib/services/overview-service";
import { BalanceSummary } from "./BalanceSummary";
import { CornerChips } from "./CornerChips";
import { MyList } from "./MyList";
import { OverviewHeadline } from "./OverviewHeadline";
import { SpendingStats } from "./SpendingStats";

const SECTION_HEADING = "text-sm font-bold tracking-wide text-muted uppercase";

// The overview's content (#10), per the desktop and phone mockups. Every
// number comes from the server (getOverview); nothing is added up here except
// SpendingStats' display total. Reads the session, so render it inside
// <Suspense>. `searchParams` are the page's, for the expense history's
// filters (#15).
export async function OverviewBoard({
  searchParams,
}: { searchParams?: Promise<SearchParams> } = {}) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }
  const [overview, query] = await Promise.all([
    getOverview(userId),
    searchParams ?? {},
  ]);
  const { personal, groups, readOnlyGroups } = overview;
  const addableGroups = [...(personal ? [personal.group] : []), ...groups].map(
    ({ id, name, isPersonal, members }) => ({ id, name, isPersonal, members }),
  );
  const addPlan = (label: string) => (
    <AddPlanButton
      groups={addableGroups}
      currentUserId={userId}
      label={label}
      primary
    />
  );

  return (
    <NoticeProvider>
      <div className="flex flex-col gap-8">
        <NoticeLine />

        {/* Desktop: the headline, a card per group, then the spending. As in
            the mockup there is no personal card; personal spending is the
            first SpendingStats card and the sidebar links to the space. */}
        <div className="hidden flex-col gap-8 md:flex">
          <OverviewHeadline totals={overview} now={new Date()}>
            {addPlan("Add a plan or cost")}
          </OverviewHeadline>
          {groups.length === 0 ? (
            <p>
              No shared groups yet.{" "}
              <Link href="/groups" className="font-bold text-owe underline">
                Create one
              </Link>{" "}
              to plan and split costs with others.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {groups.map((group) => (
                <li key={group.id}>
                  <GroupCard
                    group={group}
                    currentUserId={userId}
                    addableGroups={addableGroups}
                    wide
                  />
                </li>
              ))}
            </ul>
          )}
          <SpendingStats
            personalThisMonthCents={personal?.spentThisMonthCents ?? 0}
            groupShareCents={overview.groupShareThisPeriodCents}
          />
          {/* Every expense the user shares, with filters (#15). The groups
              they left are in it too, up to the day they left. */}
          <ExpenseHistory
            userId={userId}
            groups={[
              ...(personal ? [personal.group] : []),
              ...groups,
              ...readOnlyGroups,
            ]}
            query={query}
          />
        </div>

        {/* Phone: the balances, the corners with Just me first, and the
            personal list. */}
        <div className="flex flex-col gap-6 md:hidden">
          <BalanceSummary totals={overview} />
          <CornerChips
            personal={
              personal
                ? {
                    id: personal.group.id,
                    spentThisMonthCents: personal.spentThisMonthCents,
                  }
                : null
            }
            groups={groups}
          />
          {personal ? (
            <MyList
              groupId={personal.group.id}
              currentUserId={userId}
              items={personal.openItems}
              openEstimateCents={personal.openEstimateCents}
            />
          ) : null}
          <div>{addPlan("Add a plan")}</div>
        </div>

        {readOnlyGroups.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className={SECTION_HEADING}>
              Left or archived · read-only history
            </h2>
            <ul className="flex flex-col gap-4">
              {readOnlyGroups.map((group) => (
                <li key={group.id}>
                  <ArchivedGroupCard group={group} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </NoticeProvider>
  );
}
