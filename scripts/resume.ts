/*
  My résumé, printed as one long receipt: npm run resume.

  It's built from the same typed claims as the page's receipts, so it can't say
  anything a receipt doesn't, and every claim on it links to that receipt, live.
  Writes site/resume/index.html. test/resume.test.ts fails if that file drifts from
  what this script prints, or if the PDF wasn't re-rendered after it changed
  (npm run resume:pdf).
*/
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { claimById, isSiteClaim, tally, TOTAL, type Numbered } from "../src/feature/receipts/catalog.ts";
import type { ClaimId } from "../src/feature/receipts/claims.ts";
import { bars, firstSentence } from "../src/feature/receipts/format.ts";
import type { ClaimStatus, Line } from "../src/feature/receipts/types.ts";

/** The live site. The PDF can't follow relative links, so every link is absolute. */
export const SITE = "https://main.d1nj3qfdmf673t.amplifyapp.com";
export const PDF = "Mohamed-Ibrahim-A-resume.pdf";
/** Printed on the résumé. Change it whenever what it says changes. */
const PRINTED = "1 November 2026";

const ENTITIES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (text: string): string => text.replace(/[&<>"]/g, (c) => ENTITIES[c] ?? c);
const link = (href: string, text: string, attrs = ""): string => `<a href="${esc(href)}"${attrs}>${esc(text)}</a>`;

const STATUS: Readonly<Record<ClaimStatus, string>> = { verified: "Verified", partial: "Partial", self: "Self-reported" };

/** Skills as the portfolio lists them; test/resume.test.ts checks each one is on the page. */
export const SKILLS: readonly (readonly [group: string, items: readonly string[]])[] = [
  ["Agents that don't make things up", ["Amazon Bedrock", "Strands Agents", "Claude API", "Gemini API", "LangChain", "RAG"]],
  ["Serverless on AWS", ["Lambda", "API Gateway", "EventBridge", "S3 + CloudFront", "SES", "SAM", "Amplify", "IAM"]],
  ["Money-grade full-stack", ["TypeScript", "React", "Node + Express", "FastAPI", "PostgreSQL + Prisma", "MongoDB", "Oracle APEX"]],
  ["Honest ML", ["TensorFlow / Keras", "scikit-learn", "Computer vision", "NLP"]],
  ["Also fluent in", ["Python", "JavaScript", "TypeScript", "SQL & PL/SQL", "Docker", "GitHub Actions", "Google Cloud Run", "Firebase"]],
  ["Studied, not yet shipped", ["Java", "C", "C++", "Kubernetes", "Azure", "BigQuery", "Snowflake"]]
];

const PRINCIPLES: readonly (readonly [string, string])[] = [
  ["Ground the model.", "Facts come from data and tools, never from the model's memory."],
  ["Publish the number that hurts.", "An R² of 0.94 means little without the 47.93% beside it."],
  ["Own the loop.", "Fifty lines I can debug beat a framework I can't."]
];

/** Which receipts print in which section. A project's name leads its entry. */
const SECTIONS: readonly { readonly title: string; readonly ids: readonly ClaimId[]; readonly projects?: true }[] = [
  { title: "Experience", ids: ["internships"] },
  { title: "Selected work", ids: ["cryptopulse", "supermarket", "documind", "tripwire", "ghostprobe", "gitbard", "votersaathi", "celebrai", "tinytale"], projects: true },
  { title: "Community", ids: ["roles", "hackerrank", "qiskit"] },
  { title: "This portfolio", ids: ["site"] }
];

/** Every claim the résumé prints, in order. */
export const PRINTED_IDS: readonly ClaimId[] = SECTIONS.flatMap((s) => s.ids);

function lines(list: readonly Line[], cls = "lines"): string {
  const items = list.map((line) =>
    `<li><span class="k">${esc(line.k)}</span><span class="dots" aria-hidden="true"></span><span class="v${line.ok === false ? " v--none" : ""}">${esc(line.v)}</span></li>`);
  return `<ul class="${cls}">\n${items.map((i) => `            ${i}`).join("\n")}\n          </ul>`;
}

/** A receipt's catch opens with its point; the rest is one click away on the receipt. */
export { firstSentence };

/**
  A résumé is skimmed, so each project leads with its headline lines, in this order;
  its receipt prints them all. test/resume.test.ts checks every name is a real line.
*/
export const HEADLINES: Readonly<Partial<Record<ClaimId, readonly string[]>>> = {
  cryptopulse: ["R² · close · test set", "Direction · close · test set"],
  supermarket: ["Tools in ALL_TOOLS", "Where prices come from"],
  documind: ["Model", "Backend"],
  tripwire: ["Attacks that worked · Tripwire", "Median decision · guard"],
  ghostprobe: ["IAM actions granted", "Verdict on case_25 · before", "Verdict on case_25 · after"],
  gitbard: ["EventBridge schedule", "Storyteller"],
  votersaathi: ["Languages", "Models tried, in order"],
  celebrai: ["Unit tests passing", "Runtime dependencies"],
  tinytale: ["Path", "Default model in code"]
};

function item(claim: Numbered, project: boolean, section: string): string {
  const [name = claim.title, ...rest] = claim.context.split(" · ");
  const heading = project ? name : claim.title;
  const sub = project ? [claim.title, ...rest].join(" · ") : claim.context;
  const all: readonly Line[] = claim.lines;
  const picks = HEADLINES[claim.id];
  // The page's own receipt is stamped by each Amplify build, so its numbers live on the page.
  const site = isSiteClaim(claim);
  const printed: readonly Line[] = site ? [{ k: "Build and commit", v: "stamped live by Amplify" }]
    : picks ? picks.flatMap((k) => all.filter((line) => line.k === k)) : all;
  const caught = site ? "I didn't type the build and commit: the Amplify build stamps them into the live page at deploy time." : firstSentence(claim.catch);
  const [first, ...more] = claim.evidence;
  const notes = [
    `<p class="note"><b>The catch:</b> ${esc(caught)}</p>`,
    claim.correction ? `<p class="note note--fix"><b>Corrected:</b> ${esc(claim.correction)}</p>` : "",
    first ? `<p class="proof">Evidence: ${link(first.url, first.label)}${more.length ? ` · ${more.length} more on the receipt` : ""}</p>` : ""
  ].filter(Boolean);
  return `        <li class="item" id="r-${claim.id}">
          <h3>${link(`${SITE}/#r-${claim.id}`, `#${claim.n} ${heading}`)}<span class="status" data-status="${claim.status}">${STATUS[claim.status]}</span></h3>
          ${sub.toLowerCase() === section.toLowerCase() ? "" : `<p class="sub">${esc(sub)}</p>\n          `}${lines(printed)}
          ${notes.join("\n          ")}
        </li>`;
}

function section(id: string, title: string, body: string): string {
  return `      <section aria-labelledby="s-${id}">
        <h2 id="s-${id}">${esc(title)}</h2>
${body}
      </section>`;
}

/**
  The torn edge for the PDF: half-circle bites as one vector path, in millimetres across
  the PDF's 146 mm of paper. (A repeating CSS gradient draws the same edge on screen,
  but Chrome prints repeating gradients as megabytes of picture.)
*/
function edge(side: "top" | "bottom"): string {
  const r = 1.32;
  const step = 3.44;
  const arcs: string[] = [];
  for (let cx = step / 2; cx + r <= 146; cx += step) {
    const x = (cx - r).toFixed(2);
    arcs.push(side === "top" ? `M${x} 0a${r} ${r} 0 0 0 ${2 * r} 0z` : `M${x} ${r}a${r} ${r} 0 0 1 ${2 * r} 0z`);
  }
  return `<svg class="edge edge--${side}" viewBox="0 0 146 ${r}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="${arcs.join("")}"/></svg>`;
}

function barcode(seed: string): string {
  const rects = bars(seed).map(({ x, w }) => `<rect x="${x}" width="${w}" height="30"/>`).join("");
  return `<svg class="barcode" viewBox="0 0 160 30" preserveAspectRatio="none" aria-hidden="true" focusable="false">${rects}</svg>`;
}

export function renderResume(): string {
  const t = tally(true);
  const claims = SECTIONS.map((s) => section(
    s.title.toLowerCase().replace(/\s+/g, "-"),
    s.title,
    `      <ul class="items">\n${s.ids.map((id) => item(claimById(id), s.projects === true, s.title)).join("\n")}\n      </ul>`
  ));
  const [experience = "", work = "", community = "", portfolio = ""] = claims;
  const skills = SKILLS.map(([group, items]) =>
    `          <li><b>${esc(group)}</b> <span>${items.map(esc).join(" · ")}</span></li>`).join("\n");
  const principles = PRINCIPLES.map(([lead, text]) =>
    `          <li><b>${esc(lead)}</b> ${esc(text)}</li>`).join("\n");
  const totals = lines([
    { k: "Claims on this résumé", v: String(TOTAL) },
    { k: "Backed by public proof", v: String(t.verified) },
    { k: "Partly proven", v: String(t.partial) },
    { k: "Self-reported", v: String(t.self) },
    { k: "Corrected by my own code", v: String(t.corrections) },
    { k: "Invented facts", v: "0" }
  ], "lines totals");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Résumé with receipts · Mohamed Ibrahim A.</title>
  <meta name="description" content="The résumé of Mohamed Ibrahim A. (Ibu), printed as one long receipt: every claim links to its evidence and prints its catch.">
  <meta name="color-scheme" content="light dark">
  <meta property="og:type" content="profile">
  <meta property="og:title" content="Ibu's résumé, with receipts">
  <meta property="og:description" content="Every claim on this résumé links to its evidence, and every receipt prints its catch.">
  <meta property="og:url" content="${SITE}/resume/">
  <meta property="og:image" content="${SITE}/assets/img/og.png">
  <link rel="icon" href="../assets/img/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="resume.css">
</head>
<body>
  <!-- Generated by scripts/resume.ts from src/feature/receipts. Edit those, then: npm run resume -->
  <nav class="bar" aria-label="Résumé">
    <a href="../">← Back to the portfolio</a>
    <a class="bar__pdf" href="${PDF}" download>Download the PDF</a>
  </nav>
  <main class="roll">
    <article class="paper" aria-labelledby="name">
      ${edge("top")}
      <header class="head">
        <p class="brand">Ibu's résumé</p>
        <p class="tag">with receipts</p>
        <h1 id="name">Mohamed Ibrahim A.</h1>
        <p class="role">Software &amp; AI engineer · Coimbatore, India</p>
        <ul class="contact">
          <li>${link("mailto:ibrahimanees.work@gmail.com", "ibrahimanees.work@gmail.com")}</li>
          <li>${link("https://github.com/MdIbuA", "github.com/MdIbuA")}</li>
          <li>${link("https://www.linkedin.com/in/mohamedibrahimbinabdullah", "linkedin.com/in/mohamedibrahimbinabdullah")}</li>
          <li>${link(`${SITE}/`, SITE.replace("https://", ""))}</li>
        </ul>
        <p class="printed">Printed ${PRINTED} · ${TOTAL} claims, each with a receipt</p>
        <ul class="legend">
          <li><span class="status" data-status="verified">Verified</span> every line has public proof</li>
          <li><span class="status" data-status="partial">Partial</span> some lines are on my word</li>
          <li><span class="status" data-status="self">Self-reported</span> no public record yet</li>
        </ul>
      </header>
${section("profile", "Profile", `        <p>Final-year B.Tech Information Technology student in Coimbatore, graduating in June 2027. I build AI agents and serverless apps on AWS, often in public and often against a weekend deadline.</p>
        <p>My one rule: the model never invents a fact. This résumé keeps it too. Every claim links to its receipt, and every receipt prints its catch, the part that makes me look worse.</p>
        <ul class="plain">
${principles}
        </ul>`)}
${experience}
${work}
${section("skills", "Skills", `        <ul class="plain skills">
${skills}
        </ul>`)}
${community}
${section("education", "Education", lines([{ k: "B.Tech, Information Technology · Coimbatore", v: "June 2027" }]).replace(/^/, "        "))}
${portfolio}
${section("totals", "Totals", `        ${totals}`)}
      <footer class="foot">
        <p class="stamp">${t.verified} of ${TOTAL} verified</p>
        ${barcode(`resume ${PRINTED}`)}
        <p class="thanks">Thank you. Check again soon.</p>
        <p class="live">Every # above is a live receipt you can re-check with AWS Lambda at ${link(`${SITE}/`, SITE.replace("https://", ""))}</p>
      </footer>
      ${edge("bottom")}
    </article>
  </main>
</body>
</html>
`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const out = resolve(import.meta.dirname, "..", "site", "resume", "index.html");
  writeFileSync(out, renderResume());
  console.log(`wrote ${out}`);
}
