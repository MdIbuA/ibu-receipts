/*
  Reads a job description and itemizes it against what I can prove. Pure
  functions only, with no DOM, so Node runs them directly in the tests.

  The reader never invents a requirement. It only prints skills it recognises
  from skills.ts, and only the proof recorded there.
*/
import { fileUrl, PROJECTS } from "./projects.ts";
import { SKILLS, type ProofKind, type Skill, type SkillEvidence } from "./skills.ts";

export type Priority = "must" | "nice";

export interface JobLine {
  readonly skill: Skill;
  readonly priority: Priority;
  /** The words the description used for it, the first time. */
  readonly said: string;
  /** Where that was: [row, column], for reading order. */
  readonly at: readonly [number, number];
}

export interface JobReceipt {
  /** The role's title, if the description starts with one; otherwise "". */
  readonly title: string;
  /** Must-haves first, then nice-to-haves, each in the order the description lists them. */
  readonly lines: readonly JobLine[];
  readonly tally: Readonly<Record<ProofKind, number>>;
  /** True when the description was longer than MAX_CHARS and only the start was read. */
  readonly truncated: boolean;
}

export const MAX_CHARS = 20_000;

const NICE_HEADING = /\b(?:nice[\s-]to[\s-]haves?|good[\s-]to[\s-]haves?|preferred|bonus(?:\s+points)?|pluses|desirable|desired|optional|extra\s+credit)\b/i;
const MUST_HEADING = /\b(?:requirements?|required|must[\s-]haves?|qualifications|what\s+you(?:'ll|\s+will)?\s+(?:need|bring|do)|you\s+(?:have|bring|will\s+need)|minimum|basic|responsibilities|about\s+the\s+role|the\s+role)\b/i;
const NICE_INLINE = /\b(?:is\s+a\s+plus|a\s+plus|nice[\s-]to[\s-]have|good[\s-]to[\s-]have|preferred|bonus|ideally|would\s+be\s+great|is\s+helpful|optional)\b/i;
const BULLET = /^\s*(?:[-*•▪◦–—+]|\d+[.)])\s+/;

// Global copies of every pattern, made once: matchAll needs the g flag.
const MATCHERS = SKILLS.map((skill) => ({
  skill,
  patterns: skill.find.map((re) => new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`))
}));

interface Hit {
  readonly skill: Skill;
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** A heading switches what follows to must-have or nice-to-have. Bullets are never headings. */
function headingKind(row: string): Priority | null {
  if (BULLET.test(row)) return null;
  const text = row.replace(/^[\s#*>]+/, "").trim();
  if (!text || text.length > 60) return null;
  if (!text.endsWith(":") && text.split(/\s+/).length > 6) return null;
  if (NICE_HEADING.test(text)) return "nice";
  if (MUST_HEADING.test(text)) return "must";
  return null;
}

/**
 * Every skill mentioned in one row. When two matches overlap, the longer one wins,
 * so "AWS Lambda" prints as Lambda rather than as both Lambda and AWS.
 */
function hitsIn(row: string): Hit[] {
  const hits: Hit[] = [];
  for (const { skill, patterns } of MATCHERS) {
    for (const pattern of patterns) {
      for (const match of row.matchAll(pattern)) {
        hits.push({ skill, start: match.index, end: match.index + match[0].length, text: match[0] });
      }
    }
  }
  hits.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const kept: Hit[] = [];
  for (const hit of hits) {
    const inside = kept.some((k) => k.skill !== hit.skill && k.start <= hit.start && hit.end <= k.end);
    if (!inside) kept.push(hit);
  }
  return kept.sort((a, b) => a.start - b.start);
}

function titleOf(rows: readonly string[]): string {
  const first = rows.map((row) => row.trim()).find(Boolean) ?? "";
  const looksLikeTitle = first.length <= 80 && !/[.:;!?]$/.test(first) && !BULLET.test(first) && headingKind(first) === null && hitsIn(first).length <= 3;
  return looksLikeTitle ? first : "";
}

export function readJob(description: string): JobReceipt {
  const truncated = description.length > MAX_CHARS;
  const rows = (truncated ? description.slice(0, MAX_CHARS) : description).split(/\r?\n/);

  let section: Priority = "must";
  const found = new Map<string, JobLine>();

  rows.forEach((row, r) => {
    const heading = headingKind(row);
    if (heading) section = heading;
    const priority: Priority = section === "nice" || NICE_INLINE.test(row) ? "nice" : "must";
    for (const hit of hitsIn(row)) {
      const earlier = found.get(hit.skill.id);
      if (!earlier) {
        found.set(hit.skill.id, { skill: hit.skill, priority, said: hit.text, at: [r, hit.start] });
      } else if (earlier.priority === "nice" && priority === "must") {
        // Asked for anywhere as a requirement means it's a requirement.
        found.set(hit.skill.id, { ...earlier, priority: "must" });
      }
    }
  });

  const order = (line: JobLine): number => (line.priority === "must" ? 0 : 1);
  const lines = [...found.values()].sort((a, b) => order(a) - order(b) || a.at[0] - b.at[0] || a.at[1] - b.at[1]);

  const tally: Record<ProofKind, number> = { proven: 0, partial: 0, none: 0 };
  for (const line of lines) tally[line.skill.proof.kind] += 1;

  return { title: titleOf(rows), lines, tally, truncated };
}

/** Where a piece of evidence lives, as a link and a short label. */
export function evidenceLink(evidence: SkillEvidence, deployCommit = ""): { readonly label: string; readonly url: string } {
  if (evidence.kind === "link") return { label: evidence.label, url: evidence.url };
  const name = PROJECTS[evidence.project].name;
  const where = evidence.path.endsWith(".ipynb") ? evidence.path : `${evidence.path}:${evidence.line}`;
  return { label: `${name} · ${where}`, url: fileUrl(evidence.project, evidence.path, evidence.line, deployCommit) };
}

const MARK: Readonly<Record<ProofKind, string>> = { proven: "[✓]", partial: "[~]", none: "[✗]" };
const WORD: Readonly<Record<ProofKind, string>> = { proven: "proven", partial: "partial", none: "no receipt" };

/** The receipt as plain text, for pasting into notes or an applicant tracker. */
export function receiptText(receipt: JobReceipt, pageUrl: string, deployCommit = ""): string {
  const out: string[] = [
    "IBU'S RECEIPTS · JOB RECEIPT",
    `For: ${receipt.title || "your role"}`,
    ""
  ];
  for (const priority of ["must", "nice"] as const) {
    const lines = receipt.lines.filter((line) => line.priority === priority);
    if (!lines.length) continue;
    out.push(priority === "must" ? "MUST HAVE" : "NICE TO HAVE");
    for (const { skill } of lines) {
      const proof = skill.proof;
      out.push(`${MARK[proof.kind]} ${skill.label}: ${WORD[proof.kind]}`);
      if (proof.kind === "proven") {
        for (const evidence of proof.evidence) out.push(`    ${evidenceLink(evidence, deployCommit).url}`);
      } else {
        out.push(`    ${proof.note}`);
      }
    }
    out.push("");
  }
  const { proven, partial, none } = receipt.tally;
  out.push(`Proven ${proven} · Partial ${partial} · No receipt ${none} (of ${receipt.lines.length} requirements I recognised)`);
  out.push("Every ✓ links to public code. Every ✗ is a gap I won't paper over.");
  out.push(pageUrl);
  return out.join("\n");
}
