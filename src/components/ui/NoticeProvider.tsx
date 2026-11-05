"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// "done" for news, such as "Deleted Milk."; "problem" for an error from the
// server. Shown in `action` green and `owe`, and always in words too.
export type NoticeTone = "done" | "problem";
export type Notice = { text: string; tone: NoticeTone };

type NoticeContextValue = {
  notice: Notice | null;
  show: (text: string, tone: NoticeTone) => void;
  clear: () => void;
};

const NoticeContext = createContext<NoticeContextValue | null>(null);

const TONES: Record<NoticeTone, string> = {
  done: "text-action",
  problem: "text-owe",
};

// One notice for a page (DESIGN.md "Notices"). Every part of the page posts
// to it, and NoticeLine shows it in one place, so the same action never says
// what it did in two places, and a new notice replaces the last.
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const value = useMemo(
    () => ({
      notice,
      show: (text: string, tone: NoticeTone) => setNotice({ text, tone }),
      clear: () => setNotice(null),
    }),
    [notice],
  );
  return (
    <NoticeContext.Provider value={value}>{children}</NoticeContext.Provider>
  );
}

// Throws outside a provider, so a notice is never posted where nothing shows
// it.
export function useNotice(): NoticeContextValue {
  const value = useContext(NoticeContext);
  if (!value) {
    throw new Error("useNotice needs a NoticeProvider");
  }
  return value;
}

// The page's one notice. The region stays in the page, so a notice is
// announced when it appears instead of being created along with its text.
export function NoticeLine() {
  const { notice } = useNotice();
  return (
    <p
      role="status"
      className={`font-semibold ${notice ? TONES[notice.tone] : ""}`}
    >
      {notice?.text}
    </p>
  );
}
