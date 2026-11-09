"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNotice } from "@/components/ui/NoticeProvider";
import type { Member } from "@/lib/db/group-members";
import { describeSplit } from "@/lib/domain/describe-split";
import { DefaultSplitForm } from "./DefaultSplitForm";

type DefaultSplitContextValue = {
  // The current members with their weights, as the page was rendered.
  members: Member[];
  openForm: () => void;
};

const DefaultSplitContext = createContext<DefaultSplitContextValue | null>(
  null,
);

type DefaultSplitProviderProps = {
  groupId: string;
  members: Member[];
  children: ReactNode;
};

// Holds the group page's one Default split form (#63), so DefaultSplitControl
// and the invite form's "Set a new split" open the same one. Only rendered for
// a current member of a shared group, since anyone else would get a 403. Render
// it inside the page's NoticeProvider, which says what a save set.
export function DefaultSplitProvider({
  groupId,
  members,
  children,
}: DefaultSplitProviderProps) {
  const router = useRouter();
  const { show, clear } = useNotice();
  const [open, setOpen] = useState(false);
  // A new key for each opening, so the form starts from the current weights.
  const [opening, setOpening] = useState(0);

  const value = useMemo(
    () => ({
      members,
      openForm: () => {
        clear();
        setOpening((count) => count + 1);
        setOpen(true);
      },
    }),
    [members, clear],
  );

  return (
    <DefaultSplitContext.Provider value={value}>
      {children}
      <DefaultSplitForm
        key={opening}
        groupId={groupId}
        members={members}
        open={open}
        onClose={() => setOpen(false)}
        onMembersChanged={() => router.refresh()}
        onSaved={(weights) => {
          show(`Saved the default split: ${describeSplit(weights)}.`, "done");
          router.refresh();
        }}
      />
    </DefaultSplitContext.Provider>
  );
}

// Null outside a provider, such as on a page with no Default split form.
export function useDefaultSplit(): DefaultSplitContextValue | null {
  return useContext(DefaultSplitContext);
}
