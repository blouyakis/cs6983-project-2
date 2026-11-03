const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// The first character a person sees in a name, for Avatar and the group tile
// in GroupCard (DESIGN.md). Intl.Segmenter keeps an emoji such as 👨‍👩‍👧 or
// 🇺🇸, or a letter with a combining accent, whole, where name[0] would split
// it. Letters come out in capitals.
export function firstCharacter(name: string): string {
  const first = graphemes.segment(name.trim())[Symbol.iterator]().next();
  return first.done ? "?" : first.value.segment.toUpperCase();
}
