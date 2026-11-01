const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

// Money is stored in integer cents and turned into dollars only for display
// (AGENTS.md Section 6.1), such as in an error message.
export function formatCents(cents: number): string {
  return dollars.format(cents / 100);
}
