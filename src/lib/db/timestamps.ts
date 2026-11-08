// Postgres prints timestamptz to the microsecond, without trailing zeros in
// the fraction: 2026-11-07T10:00:00.1234+00:00. Date.parse keeps only
// milliseconds, so two times in the same millisecond would tie (#75).
const TIMESTAMP = /^(.+T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/;

// A timestamp from the database as microseconds since 1970, for comparing
// times without losing the digits Date.parse drops. The number stays a safe
// integer until the year 2255.
export function toMicros(timestamp: string): number {
  const match = TIMESTAMP.exec(timestamp);
  const wholeSeconds = match ? Date.parse(match[1] + match[3]) : NaN;
  if (!match || Number.isNaN(wholeSeconds)) {
    throw new Error(`Not a timestamp: ${timestamp}`);
  }
  const fraction = (match[2] ?? "").padEnd(6, "0");
  return wholeSeconds * 1000 + Number(fraction);
}
