"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Member } from "@/lib/db/group-members";
import { describeSplit } from "@/lib/domain/describe-split";
import { DefaultSplitForm } from "./DefaultSplitForm";

type DefaultSplitContextValue = {
  // The current members with their weights, as the page was rendered.
  members: Member[];
  openForm: () => void;
  // What the last save set, for a screen reader, such as "Saved the default
  // split: 60/40 default."
  saved: string;
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
// a current member of a shared group, since anyone else would get a 403.
export function DefaultSplitProvider({
  groupId,
  members,
  children,
}: DefaultSplitProviderProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // A new key for each opening, so the form starts from the current weights.
  const [opening, setOpening] = useState(0);
  const [saved, setSaved] = useState("");

  const value = useMemo(
    () => ({
      members,
      saved,
      openForm: () => {
        setSaved("");
        setOpening((count) => count + 1);
        setOpen(true);
      },
    }),
    [members, saved],
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
        onSaved={(weights) => {
          setSaved(`Saved the default split: ${describeSplit(weights)}.`);
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
