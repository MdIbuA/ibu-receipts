/*
  The shapes behind every receipt. The page's honesty rules live here as types,
  so breaking one is a compile error rather than something a reviewer has to spot:

    - a "verified" claim cites at least one public link, and none of its lines
      may be marked as unproven
    - a "partial" claim cites a link too, and says which lines it can't prove
    - a skill is "proven" only by a file or a link, never by my word
*/

/** A list with at least one item. */
export type NonEmpty<T> = readonly [T, ...T[]];

/** How much of a claim is backed by something you can open. */
export type ClaimStatus = "verified" | "partial" | "self";

/** One printed line item. */
export interface Line {
  readonly k: string;
  readonly v: string;
  /** false marks a line with no public proof. */
  readonly ok?: false;
  readonly href?: string;
}

/** A line that needs no caveat: the only kind a verified receipt may print. */
export type ProvenLine = Line & { readonly ok?: never };

export interface Evidence {
  readonly label: string;
  readonly url: string;
}

interface ClaimBase<Id extends string> {
  /** Matches data-claim="…" on the page. */
  readonly id: Id;
  /** The claim as it reads on the page. */
  readonly label: string;
  readonly title: string;
  readonly context: string;
  /** How and when the numbers were produced. */
  readonly measured?: string;
  /** The part that makes me look worse. */
  readonly catch: string;
  /** Where an earlier write-up of mine disagreed with the code. */
  readonly correction?: string;
}

export interface VerifiedClaim<Id extends string = string> extends ClaimBase<Id> {
  readonly status: "verified";
  readonly lines: readonly ProvenLine[];
  readonly evidence: NonEmpty<Evidence>;
  /** Direction accuracy to race against a coin. */
  readonly coin?: number;
  /** The page's own receipt: its lines come from the Amplify build. */
  readonly build?: true;
}

export interface PartialClaim<Id extends string = string> extends ClaimBase<Id> {
  readonly status: "partial";
  readonly lines: readonly Line[];
  readonly evidence: NonEmpty<Evidence>;
}

export interface SelfClaim<Id extends string = string> extends ClaimBase<Id> {
  readonly status: "self";
  readonly lines: readonly Line[];
  readonly evidence: readonly Evidence[];
}

export type Claim<Id extends string = string> = VerifiedClaim<Id> | PartialClaim<Id> | SelfClaim<Id>;

/** What scripts/stamp-build.sh writes into build-info.js on every Amplify build. */
export interface BuildInfo {
  readonly deployed: boolean;
  readonly host?: string;
  readonly appId?: string;
  readonly branch?: string;
  readonly job?: string;
  readonly commit?: string;
  readonly region?: string;
  readonly siteUrl?: string;
  readonly verifyUrl?: string;
  readonly builtAt?: string;
  readonly siteBytes?: number;
}

declare global {
  interface Window {
    readonly BUILD_INFO?: BuildInfo;
  }
}

/** Fails to compile if a switch over a union forgets a case. */
export function unreachable(value: never): never {
  throw new Error(`Unhandled case: ${String(value)}`);
}
