/* Formatting for printed receipts. Pure, so the tests can pin it down. */

export const pad = (n: number): string => String(n).padStart(2, "0");

export function kb(bytes: number): string {
  const k = bytes / 1024;
  return `${k < 10 ? k.toFixed(1) : Math.round(k)} KB`;
}

export function utc(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function ago(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (!Number.isFinite(seconds) || seconds < 10) return "just now";
  return seconds < 120 ? `${seconds} s ago` : `${Math.round(seconds / 60)} min ago`;
}

export function printedAt(date = new Date()): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    }).format(date);
  } catch {
    return date.toDateString();
  }
}

/** "1 requirement", "3 requirements". */
export const plural = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? "" : "s"}`;
