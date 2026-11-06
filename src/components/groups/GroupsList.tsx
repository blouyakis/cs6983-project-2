import { redirect } from "next/navigation";
import { NoticeLine, NoticeProvider } from "@/components/ui/NoticeProvider";
import { getSessionUserId } from "@/lib/auth/cookies";
import { getOverview } from "@/lib/services/overview-service";
import { ArchivedGroupCard } from "./ArchivedGroupCard";
import { GroupCard } from "./GroupCard";
import { PersonalSpaceCard } from "./PersonalSpaceCard";

// The sections of the Groups page. Reads the session, so render it inside
// <Suspense>.
export async function GroupsList() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }
  // The same numbers as the overview (#10): balances from #9, open items and
  // the personal space's month.
  const {
    personal,
    groups: shared,
    readOnlyGroups: readOnly,
  } = await getOverview(userId);
  const addableGroups = [...(personal ? [personal.group] : []), ...shared].map(
    ({ id, name, isPersonal, members }) => ({
      id,
      name,
      isPersonal,
      members,
    }),
  );

  // One notice for the page, from any card's Add plan here.
  return (
    <NoticeProvider>
      <div className="flex flex-col gap-8">
        <NoticeLine />
        {personal ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-bold tracking-wide text-muted uppercase">
              Just you
            </h2>
            <PersonalSpaceCard
              group={personal.group}
              openItemCount={personal.openItems.length}
              spentThisMonthCents={personal.spentThisMonthCents}
            />
          </section>
        ) : null}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold tracking-wide text-muted uppercase">
            Shared · {shared.length} {shared.length === 1 ? "group" : "groups"}
          </h2>
          {shared.length === 0 ? (
            <p>
              No shared groups yet. Create one to plan and split costs with
              others.
            </p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {shared.map((group) => (
                <li key={group.id}>
                  <GroupCard
                    group={group}
                    currentUserId={userId}
                    addableGroups={addableGroups}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
        {readOnly.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-bold tracking-wide text-muted uppercase">
              Left or archived · read-only history
            </h2>
            <ul className="flex flex-col gap-4">
              {readOnly.map((group) => (
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
