"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// "done" for news, such as "Deleted Milk."; "problem" for an error from the
// server. Shown in `action` green and `owe`, and always in words too.
export type NoticeTone = "done" | "problem";
export type Notice = { text: string; tone: NoticeTone };

type Posted = Notice & { source: string };

type NoticeContextValue = {
  posted: Posted | null;
  setPosted: (posted: Posted | null) => void;
};

const NoticeContext = createContext<NoticeContextValue | null>(null);

// Keeps one notice on a page. Each part of the page shows a notice next to
// the button that caused it, and posting a new one clears the last, wherever
// it was, so an old "Added Sponges…" never sits beside "Deleted Sponges.".
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [posted, setPosted] = useState<Posted | null>(null);
  const value = useMemo(() => ({ posted, setPosted }), [posted]);
  return (
    <NoticeContext.Provider value={value}>{children}</NoticeContext.Provider>
  );
}

// `source` names the part of the page, such as "costs" or "list". Without a
// provider, the notice is kept locally, as each part did before.
export function useNotice(source: string) {
  const shared = useContext(NoticeContext);
  const [local, setLocal] = useState<Posted | null>(null);
  const posted = shared ? shared.posted : local;
  const setPosted = shared ? shared.setPosted : setLocal;

  const show = useCallback(
    (text: string, tone: NoticeTone) => setPosted({ source, text, tone }),
    [setPosted, source],
  );
  const clear = useCallback(() => setPosted(null), [setPosted]);
  const notice: Notice | undefined =
    posted && posted.source === source
      ? { text: posted.text, tone: posted.tone }
      : undefined;

  return { notice, show, clear };
}

export const NOTICE_TONES: Record<NoticeTone, string> = {
  done: "text-action",
  problem: "text-owe",
};
