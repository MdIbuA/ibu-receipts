/* Which receipts this visitor has opened. Kept in this browser only; never sent anywhere. */
import { isClaimId } from "./catalog.ts";
import type { ClaimId } from "./claims.ts";

const KEY = "ibu-receipts:checked";

export function loadAudit(): Set<ClaimId> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return new Set(Array.isArray(saved) ? saved.filter(isClaimId) : []);
  } catch {
    return new Set();
  }
}

export function saveAudit(checked: ReadonlySet<ClaimId>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...checked]));
  } catch {
    // Private mode or blocked storage: progress simply won't survive a reload.
  }
}
