// "Sep 2". In UTC, so the server and the browser print the same day.
const day = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function formatDay(iso: string): string {
  return day.format(new Date(iso));
}
