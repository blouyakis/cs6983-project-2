import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AddExpenseButton } from "@/components/expenses/AddExpenseButton";
import { ExpenseList } from "@/components/expenses/ExpenseList";
import { GroupList } from "@/components/lists/GroupList";
import { PaymentHistory } from "@/components/payments/PaymentHistory";
import { Badge } from "@/components/ui/Badge";
import { NoticeLine, NoticeProvider } from "@/components/ui/NoticeProvider";
import { getSessionUserId } from "@/lib/auth/cookies";
import { monthOf, spentInMonthCents } from "@/lib/domain/list-stats";
import { ForbiddenError, NotFoundError } from "@/lib/http/errors";
import { getGroupBalances } from "@/lib/services/balance-service";
import { listGroupExpenses } from "@/lib/services/expense-service";
import { getCurrentSettleUp } from "@/lib/services/settlement-service";
import {
  getGroup,
  listGroups,
  type GroupDetails,
} from "@/lib/services/group-service";
import { listGroupListItems } from "@/lib/services/list-item-service";
import { listPayments } from "@/lib/services/payment-service";
import { groupParamsSchema } from "@/lib/validation/group";
import { DefaultSplitControl } from "./DefaultSplitControl";
import { DefaultSplitProvider } from "./DefaultSplitProvider";
import { GroupTile } from "./GroupTile";
import { InviteForm } from "./InviteForm";
import { MemberList } from "./MemberList";
import { MovingOutCard } from "./MovingOutCard";
import { hasWaitingPayment } from "./moving-out";

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

  // Access was checked by getGroup, and is checked again in each of these.
  // Balances are computed on the server per request (#9); the personal space
  // has nothing to split.
  const balances = group.isPersonal
    ? undefined
    : await getGroupBalances(userId, group.id);
  const expenses = await listGroupExpenses(userId, group.id);
  // While a settle-up is open, the costs in it are frozen (#86); the list
  // shows them locked instead of offering an Edit that would get a 409.
  const openSettleUp = group.isPersonal
    ? null
    : await getCurrentSettleUp(userId, group.id).catch((error: unknown) => {
        if (error instanceof NotFoundError) {
          return null;
        }
        throw error;
      });
  const items = await listGroupListItems(userId, group.id);
  // Paid and confirmed payments, where the recipient confirms one (#14). The
  // personal space has nobody to pay.
  const payments = group.isPersonal
    ? null
    : await listPayments(userId, group.id);
  // The personal list shows this month's spending (#23). Every expense in the
  // personal space is the owner's alone, so it adds up the amounts.
  // TODO(#77): take the month in the user's time zone, not UTC.
  const spentThisMonthCents = group.isPersonal
    ? spentInMonthCents(expenses, monthOf(new Date()))
    : null;
  // A current member of a shared group, who can invite someone, set the
  // default split (#63) and leave (#22). Not the personal space, which has no
  // invitations and can't be left, nor a group they left or that is archived.
  const isActiveSharedMember = !group.isPersonal && !group.readOnly;
  // Moving out: the user's balance as the server computed it, and whether a
  // payment of theirs is waiting, in the payment list or the open settle-up.
  // Null, not zero, when the balances leave the user out, so the card keeps
  // Leave group off instead of offering a leave the server would refuse.
  const myBalanceCents =
    balances?.find((balance) => balance.userId === userId)?.balanceCents ??
    null;
  const myPaymentWaiting = hasWaitingPayment(userId, [
    ...(payments ?? []),
    ...(openSettleUp?.payments ?? []),
  ]);
  const names = Object.fromEntries(
    group.members.map((member) => [member.userId, member.name]),
  );

  // One notice for the whole page, in one place right above the list, whether
  // it came from Log a cost, the list's form or a row.
  const page = (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center gap-3">
        <GroupTile name={group.name} />
        <h1 className="text-3xl font-bold">{group.name}</h1>
        {group.readOnly ? <Badge>Read only</Badge> : null}
        {group.isPersonal ? null : (
          <Link
            href={`/groups/${group.id}/settle-up`}
            aria-label={`Settle up ${group.name}`}
            className="ml-auto rounded-lg border-2 border-ink bg-surface px-4 py-2 font-semibold shadow-[3px_3px_0_0_var(--color-ink)]"
          >
            <span aria-hidden="true">💸 </span>Settle up
          </Link>
        )}
      </header>
      {group.isPersonal ? (
        <p>Private · nothing here is split or visible to anyone.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <MemberList
            members={group.members}
            currentUserId={userId}
            balances={balances}
          />
          {isActiveSharedMember ? <DefaultSplitControl /> : null}
        </div>
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
      <NoticeLine />
      <GroupList
        groupId={group.id}
        isPersonal={group.isPersonal}
        readOnly={group.readOnly}
        items={items}
        names={names}
        currentUserId={userId}
        entryGroups={addableGroups}
        spentThisMonthCents={spentThisMonthCents}
      />
      <ExpenseList
        expenses={expenses}
        members={group.members}
        currentUserId={userId}
        groupName={group.name}
        readOnly={group.readOnly}
        settleUpStartedAt={openSettleUp?.startedAt ?? null}
      />
      {payments ? (
        <PaymentHistory
          groupId={group.id}
          payments={payments}
          names={names}
          currentUserId={userId}
          readOnly={group.readOnly}
        />
      ) : null}
      {isActiveSharedMember ? <InviteForm groupId={group.id} /> : null}
      {isActiveSharedMember ? (
        <MovingOutCard
          groupId={group.id}
          groupName={group.name}
          balanceCents={myBalanceCents}
          hasWaitingPayment={myPaymentWaiting}
          isLastMember={group.members.length === 1}
        />
      ) : null}
    </div>
  );
  return (
    <NoticeProvider>
      {isActiveSharedMember ? (
        <DefaultSplitProvider groupId={group.id} members={group.members}>
          {page}
        </DefaultSplitProvider>
      ) : (
        page
      )}
    </NoticeProvider>
  );
}
