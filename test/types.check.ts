/*
  Type-level tests: each @ts-expect-error below is a dishonest receipt that must
  NOT compile. If a rule in types.ts ever loosens, its line stops erroring, the
  directive goes unused, and `npm run typecheck` fails. Never run, only checked.
*/
import type { ClaimId } from "../src/feature/receipts/claims.ts";
import type { Sha } from "../src/feature/receipts/projects.ts";
import type { FileEvidence, Proof } from "../src/feature/receipts/skills.ts";
import type { PartialClaim, VerifiedClaim } from "../src/feature/receipts/types.ts";

const base = { id: "x", label: "x", title: "x", context: "x", catch: "x" } as const;
const link = { label: "x", url: "https://example.test" } as const;

export const verifiedWithoutEvidence: VerifiedClaim = {
  ...base,
  status: "verified",
  lines: [],
  // @ts-expect-error: a verified receipt must cite at least one public link
  evidence: []
};

export const verifiedWithAnUnprovenLine: VerifiedClaim = {
  ...base,
  status: "verified",
  // @ts-expect-error: an unproven line belongs on a partial or self-reported receipt
  lines: [{ k: "x", v: "x", ok: false }],
  evidence: [link]
};

export const partialWithoutEvidence: PartialClaim = {
  ...base,
  status: "partial",
  lines: [{ k: "x", v: "no public receipt", ok: false }],
  // @ts-expect-error: a partial receipt still cites what it can
  evidence: []
};

export const provenByMyWord: Proof = {
  kind: "proven",
  // @ts-expect-error: a skill is proven by a file or a link, never by nothing
  evidence: []
};

export const evidenceFromNowhere: FileEvidence = {
  kind: "file",
  // @ts-expect-error: evidence can only point into a pinned project
  project: "some-repo",
  path: "x",
  line: 1,
  shows: "x"
};

// @ts-expect-error: only sha() makes a Sha, so a branch name can't pose as a commit
export const unpinned: Sha = "main";

// @ts-expect-error: receipts can only link claims that exist on the page
export const missingClaim: ClaimId = "phd";
