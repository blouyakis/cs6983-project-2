const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

// Money is stored in integer cents and turned into dollars only for display
// (AGENTS.md Section 6.1), such as in an error message.
export function formatCents(cents: number): string {
  return dollars.format(cents / 100);
}

// The most dollars that stay a safe integer when turned into cents; a field
// with more digits than this isn't a plausible amount anyway.
const MAX_DOLLAR_DIGITS = 10;
const TYPED_DOLLARS = /^\$?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;

// Reads dollars typed into a field, such as "12.34", "12.5" or "$1,234.56", as
// whole cents without floating-point math (AGENTS.md Section 6.1). Returns
// null for anything else, so the caller can ask for the amount again.
export function parseDollars(text: string): number | null {
  const match = TYPED_DOLLARS.exec(text.trim());
  if (!match) {
    return null;
  }
  const dollars = match[1].replaceAll(",", "");
  if (dollars.length > MAX_DOLLAR_DIGITS) {
    return null;
  }
  const cents = (match[2] ?? "").padEnd(2, "0");
  return Number(dollars) * 100 + Number(cents);
}

// Cents as plain text to edit in a field: "12.34", with no symbol or commas.
// parseDollars reads it back as the same cents.
export function centsToInputText(cents: number): string {
  const whole = Math.floor(cents / 100);
  return `${whole}.${String(cents % 100).padStart(2, "0")}`;
}
