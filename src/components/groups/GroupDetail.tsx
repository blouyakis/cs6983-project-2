import { notFound, redirect } from "next/navigation";
import { AddExpenseButton } from "@/components/expenses/AddExpenseButton";
import { GroupList } from "@/components/lists/GroupList";
import { Badge } from "@/components/ui/Badge";
import { NoticeLine, NoticeProvider } from "@/components/ui/NoticeProvider";
import { getSessionUserId } from "@/lib/auth/cookies";
import { ForbiddenError } from "@/lib/http/errors";
import {
  getGroup,
  listGroups,
  type GroupDetails,
} from "@/lib/services/group-service";
import { listGroupListItems } from "@/lib/services/list-item-service";
import { groupParamsSchema } from "@/lib/validation/group";
import { GroupTile } from "./GroupTile";
import { InviteForm } from "./InviteForm";
import { MemberList } from "./MemberList";

type GroupDetailProps = { params: Promise<{ groupId: string }> };

// One group's page. Reads the session and the route params, so render it
// inside <Suspense>. A group the user can't see, or a malformed id, is a plain
// not found, so the page never says whether a group exists.
export async function GroupDetail({ params }: GroupDetailProps) {
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

  // The groups the user can add a cost to, for the form's group picker: not
  // ones they left or archived ones (AGENTS.md Section 6.6).
  const addableGroups = group.readOnly
    ? []
    : (await listGroups(userId))
        .filter((summary) => !summary.readOnly)
        .map(({ id, name, isPersonal, members }) => ({
          id,
          name,
          isPersonal,
          members,
        }));

  // Access was checked by getGroup, and is checked again here.
  const items = await listGroupListItems(userId, group.id);
  const names = Object.fromEntries(
    group.members.map((member) => [member.userId, member.name]),
  );

  // One notice for the whole page, in one place right above the list, whether
  // it came from Log a cost, the list's form or a row.
  return (
    <NoticeProvider>
      <div className="flex flex-col gap-8">
        <header className="flex flex-wrap items-center gap-3">
          <GroupTile name={group.name} />
          <h1 className="text-3xl font-bold">{group.name}</h1>
          {group.readOnly ? <Badge>Read only</Badge> : null}
        </header>
        {group.isPersonal ? (
          <p>Private · nothing here is split or visible to anyone.</p>
        ) : (
          <MemberList members={group.members} currentUserId={userId} />
        )}
        {group.readOnly ? (
          <p>You can read this group&apos;s history, but not add to it.</p>
        ) : null}
        {group.readOnly ? null : (
          <AddExpenseButton
            groups={addableGroups}
            currentUserId={userId}
            defaultGroupId={group.id}
          />
        )}
        {!group.isPersonal && !group.readOnly ? (
          <InviteForm groupId={group.id} />
        ) : null}
        <NoticeLine />
        <GroupList
          groupId={group.id}
          isPersonal={group.isPersonal}
          readOnly={group.readOnly}
          items={items}
          names={names}
          currentUserId={userId}
          entryGroups={addableGroups}
        />
      </div>
    </NoticeProvider>
  );
}
