/*
  Reads every piece of evidence the page links to and fails if any of it is gone
  or no longer says what the page claims:

    - each skill's file, at its pinned commit: the named line must show the named text
    - every other link (receipts' evidence, skills' links): it must still resolve

  This site's own files are checked offline by test/skills.test.ts. Needs the
  network, so it runs in CI (npm run evidence), not in the Amplify build.
*/
import { CLAIMS } from "../src/feature/receipts/claims.ts";
import { PROJECTS } from "../src/feature/receipts/projects.ts";
import { SKILLS, type FileEvidence } from "../src/feature/receipts/skills.ts";

interface Outcome {
  readonly what: string;
  readonly ok: boolean;
  readonly detail: string;
}

const RAW = "https://raw.githubusercontent.com/MdIbuA";

/** github.com/…/blob/<ref>/<path> → the raw file, without the line anchor. */
function rawUrl(url: string): string | null {
  const match = /^https:\/\/github\.com\/MdIbuA\/([^/]+)\/blob\/([^/]+)\/([^?#]+)/.exec(url);
  return match ? `${RAW}/${match[1]}/${match[2]}/${match[3]}` : null;
}

async function get(url: string): Promise<Response> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "follow", headers: { "user-agent": "ibu-receipts evidence check" } });
      if (response.status < 500 || attempt === 3) return response;
    } catch (error) {
      if (attempt === 3) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
  }
}

const files = new Map<string, Promise<readonly string[] | null>>();
function linesOf(url: string): Promise<readonly string[] | null> {
  let pending = files.get(url);
  if (!pending) {
    pending = get(url).then(async (r) => (r.ok ? (await r.text()).split(/\r?\n/) : null));
    files.set(url, pending);
  }
  return pending;
}

async function checkFile(evidence: FileEvidence, skill: string): Promise<Outcome> {
  const project = PROJECTS[evidence.project];
  const what = `${skill}: ${project.repo}/${evidence.path}:${evidence.line}`;
  if (project.at === "deploy") return { what, ok: true, detail: "this repo (checked by the unit tests)" };
  const lines = await linesOf(`${RAW}/${project.repo}/${project.at}/${evidence.path.split("/").map(encodeURIComponent).join("/")}`);
  if (!lines) return { what, ok: false, detail: "file not found at the pinned commit" };
  const text = lines[evidence.line - 1] ?? "";
  return text.toLowerCase().includes(evidence.shows.toLowerCase())
    ? { what, ok: true, detail: `shows "${evidence.shows}"` }
    : { what, ok: false, detail: `expected "${evidence.shows}", found "${text.trim().slice(0, 80)}"` };
}

async function checkLink(url: string, owner: string): Promise<Outcome> {
  const raw = rawUrl(url);
  try {
    const response = await get(raw ?? url);
    return { what: `${owner}: ${url}`, ok: response.ok, detail: `HTTP ${response.status}` };
  } catch (error) {
    return { what: `${owner}: ${url}`, ok: false, detail: String(error) };
  }
}

// Every check, at most eight requests at a time.
const jobs: (() => Promise<Outcome>)[] = [];
for (const skill of SKILLS) {
  const proof = skill.proof;
  const evidence = proof.kind === "proven" ? proof.evidence : proof.kind === "partial" ? proof.evidence ?? [] : [];
  for (const item of evidence) {
    jobs.push(item.kind === "file" ? () => checkFile(item, skill.id) : () => checkLink(item.url, skill.id));
  }
}
const seen = new Set<string>();
for (const claim of CLAIMS) {
  for (const { url } of claim.evidence) {
    if (seen.has(url) || url.includes("/ibu-receipts/blob/main/")) continue; // this repo's main is checked by tests
    seen.add(url);
    jobs.push(() => checkLink(url, claim.id));
  }
}

const results: Outcome[] = [];
await Promise.all(Array.from({ length: 8 }, async () => {
  for (let job = jobs.shift(); job; job = jobs.shift()) results.push(await job());
}));

const failed = results.filter((r) => !r.ok);
for (const r of failed) console.error(`✗ ${r.what} — ${r.detail}`);
console.log(`${results.length - failed.length} of ${results.length} pieces of evidence check out.`);
process.exitCode = failed.length ? 1 : 0;
