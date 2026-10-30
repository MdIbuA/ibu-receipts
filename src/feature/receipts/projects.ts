/*
  The projects that evidence can point into, each pinned to one commit. A link
  built from here can't drift: the file it shows is the file that was checked.
*/
import type { ClaimId } from "./claims.ts";

declare const shaBrand: unique symbol;

/** A full 40-character commit SHA. Only sha() can make one. */
export type Sha = string & { readonly [shaBrand]: true };

export function sha(value: string): Sha {
  if (!isSha(value)) throw new TypeError(`Evidence must be pinned to a full commit SHA, got "${value}"`);
  return value;
}

export function isSha(value: string): value is Sha {
  return /^[0-9a-f]{40}$/.test(value);
}

export interface Project {
  readonly name: string;
  readonly repo: string;
  /** "deploy" is this site: its files are linked at the commit that built the page. */
  readonly at: Sha | "deploy";
  /** The receipt on this page that the project backs, if any. */
  readonly claim?: ClaimId;
}

export const PROJECTS = {
  cryptopulse: { name: "CryptoPulse", repo: "CryptoPulse", at: sha("0bde245a9a8f1f7aec31d8ae4467b865871a0a2f"), claim: "cryptopulse" },
  supermarket: { name: "Supermarket Ops Agent", repo: "SuperMarketAgent", at: sha("fcf311e17c8ed933b2d4b7608feb44d274af2a34"), claim: "supermarket" },
  documind: { name: "DocuMind AI", repo: "DocuMind-AI", at: sha("04473d196c96482e0c87189ad2749b5ad02bb3f0"), claim: "documind" },
  tripwire: { name: "Tripwire", repo: "strands-tripwire", at: sha("9f0559ff2898979d43f48c28140248556c281837"), claim: "tripwire" },
  ghostprobe: { name: "Ghost Probe", repo: "s3-ghost-probe", at: sha("2a18b3f4496d4223a087e33471144375d15a07e0"), claim: "ghostprobe" },
  gitbard: { name: "The Git Bard", repo: "GitBard", at: sha("79c750e69e4e2314befa351c515c4466ebfede29"), claim: "gitbard" },
  votersaathi: { name: "Voter Saathi", repo: "votersaathi", at: sha("8594c62338df5004c39b7dca56ff388e2a6b5eef"), claim: "votersaathi" },
  celebrai: { name: "CelebrAI", repo: "Celebrai", at: sha("18078d1e71b2a54d6f5d4acaadad8df0af9b0976"), claim: "celebrai" },
  tinytale: { name: "Tiny Tale Toy", repo: "tiny-tale-toy", at: sha("bf82c2ddfba3ead7817d731883d68585ca042d74"), claim: "tinytale" },
  unileave: { name: "UniLeave", repo: "unileave-student-leave-management", at: sha("7be4e1e43ca6989f0e45bea4e345ef67969cbf75") },
  site: { name: "This site", repo: "ibu-receipts", at: "deploy", claim: "site" }
} as const satisfies Readonly<Record<string, Project>>;

export type ProjectId = keyof typeof PROJECTS;

export const OWNER_URL = "https://github.com/MdIbuA";

/**
 * A link to one line of a project's file at its pinned commit. This site's own
 * files link at the commit that built the page, or at main for a local copy.
 */
export function fileUrl(id: ProjectId, path: string, line: number, deployCommit = ""): string {
  const project: Project = PROJECTS[id];
  const ref = project.at === "deploy" ? (isSha(deployCommit) ? deployCommit : "main") : project.at;
  const file = `${OWNER_URL}/${project.repo}/blob/${ref}/${path.split("/").map(encodeURIComponent).join("/")}`;
  if (path.endsWith(".ipynb")) return file; // GitHub renders notebooks without line anchors
  if (path.endsWith(".md")) return `${file}?plain=1#L${line}`;
  return `${file}#L${line}`;
}
