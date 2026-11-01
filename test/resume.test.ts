// The résumé is printed from the receipts' own data, and the PDF from the résumé page.
// These hold both to that: nothing on them can drift from what the receipts say.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { CATALOG, claimById, isClaimId } from "../src/feature/receipts/catalog.ts";
import { sourceHash } from "../scripts/resume-pdf.ts";
import { firstSentence, HEADLINES, PDF, PRINTED_IDS, renderResume, SITE, SKILLS } from "../scripts/resume.ts";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("site/resume/index.html");

describe("the résumé", () => {
  it("is exactly what scripts/resume.ts prints (npm run resume)", () => {
    assert.equal(page, renderResume(), "site/resume/index.html is stale: run npm run resume");
  });

  it("prints every claim once, linked to its live receipt", () => {
    assert.deepEqual([...PRINTED_IDS].sort(), CATALOG.map((claim) => claim.id).sort());
    for (const { id } of CATALOG) assert.equal(page.split(`href="${SITE}/#r-${id}"`).length - 1, 1, id);
  });

  it("leads each project with lines its receipt really has", () => {
    for (const [id, keys] of Object.entries(HEADLINES)) {
      assert.ok(isClaimId(id), `no claim "${id}"`);
      if (!isClaimId(id)) continue;
      const lines: readonly { readonly k: string }[] = claimById(id).lines;
      for (const k of keys ?? []) assert.ok(lines.some((line) => line.k === k), `${id} has no line "${k}"`);
    }
  });

  it("opens each catch with a whole sentence", () => {
    assert.equal(firstSentence("End to end, it took 341 ms, not 0.2 s. The thresholds were tuned by hand."), "End to end, it took 341 ms, not 0.2 s.");
    assert.equal(firstSentence("One sentence only."), "One sentence only.");
  });

  it("lists only skills the portfolio lists", () => {
    const portfolio = read("site/index.html").replaceAll("&amp;", "&");
    for (const [group, items] of SKILLS) {
      assert.ok(portfolio.includes(group), group);
      for (const skill of items) assert.ok(portfolio.includes(skill), skill);
    }
  });

  it("has no inline styles or scripts, which the content security policy would block", () => {
    assert.doesNotMatch(page, /\sstyle\s*=/i);
    assert.doesNotMatch(page, /<script/i);
  });

  it("offers a PDF printed from this exact page (npm run resume:pdf)", () => {
    assert.ok(existsSync(new URL(`../site/resume/${PDF}`, import.meta.url)), `site/resume/${PDF} is missing`);
    assert.equal(read("site/resume/resume.sha256").trim(), sourceHash(), "the PDF is stale: run npm run resume:pdf");
  });
});
