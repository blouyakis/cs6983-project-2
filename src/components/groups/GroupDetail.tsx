import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { getSessionUserId } from "@/lib/auth/cookies";
import { ForbiddenError } from "@/lib/http/errors";
import { getGroup, type GroupDetails } from "@/lib/services/group-service";
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

  return (
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
      {!group.isPersonal && !group.readOnly ? (
        <InviteForm groupId={group.id} />
      ) : null}
      {/* TODO(#11): show the group's list here. */}
    </div>
  );
}
