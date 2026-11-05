const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// Pictographs, and the letters that pair up into a flag. Not \p{Emoji}, which
// also matches digits and "#".
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

export type TitleParts = { emoji: string | null; text: string };

// list_items has no emoji column, so ListItemRow shows the emoji a title
// starts with, as in "🥛 Milk" (DESIGN.md "ListItemRow"). Intl.Segmenter keeps
// an emoji such as 👨‍👩‍👧 whole, as in firstCharacter. A title that is only an
// emoji keeps it as its text, so the row never has an empty title.
export function splitLeadingEmoji(title: string): TitleParts {
  const first = graphemes.segment(title)[Symbol.iterator]().next();
  if (first.done || !EMOJI.test(first.value.segment)) {
    return { emoji: null, text: title };
  }
  const text = title.slice(first.value.segment.length).trim();
  return text === ""
    ? { emoji: null, text: title }
    : { emoji: first.value.segment, text };
}
