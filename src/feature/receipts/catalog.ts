/* The claims, numbered as they print, with lookups and the page's running totals. */
import { CLAIMS, type ClaimId } from "./claims.ts";
import type { Claim, ClaimStatus, VerifiedClaim } from "./types.ts";

export type Numbered = Claim<ClaimId> & { readonly n: number };

/** What a receipt's stamp says: its status, or "local" for the page's own receipt off AWS. */
export type Shown = ClaimStatus | "local";

export const CATALOG: readonly Numbered[] = CLAIMS.map((claim, i) => ({ ...claim, n: i + 1 }));
export const TOTAL = CATALOG.length;

const BY_ID: ReadonlyMap<string, Numbered> = new Map(CATALOG.map((claim) => [claim.id, claim]));

export const isClaimId = (id: unknown): id is ClaimId => typeof id === "string" && BY_ID.has(id);

export function claimById(id: ClaimId): Numbered {
  const claim = BY_ID.get(id);
  if (!claim) throw new Error(`No claim "${id}"`);
  return claim;
}

/** The page's own receipt, whose lines come from the Amplify build. */
export const isSiteClaim = (claim: Claim): claim is VerifiedClaim & { readonly build: true } =>
  claim.status === "verified" && claim.build === true;

export const shownStatus = (claim: Claim, deployed: boolean): Shown =>
  isSiteClaim(claim) ? (deployed ? "verified" : "local") : claim.status;

export interface Tally {
  readonly verified: number;
  readonly partial: number;
  readonly self: number;
  readonly local: number;
  readonly corrections: number;
}

export function tally(deployed: boolean): Tally {
  const t = { verified: 0, partial: 0, self: 0, local: 0, corrections: 0 };
  for (const claim of CATALOG) {
    t[shownStatus(claim, deployed)] += 1;
    if (claim.correction) t.corrections += 1;
  }
  return t;
}
