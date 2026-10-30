// The receipts' rules that types can't express: pinned evidence, honest statuses,
// and a page that prints exactly the claims the data holds.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { CATALOG, isSiteClaim, tally } from "../src/feature/receipts/catalog.ts";
import { CLAIMS } from "../src/feature/receipts/claims.ts";

const page = readFileSync(new URL("../site/index.html", import.meta.url), "utf8");
const PINNED = /^https:\/\/github\.com\/MdIbuA\/[\w.-]+\/(?:blob|tree)\/[0-9a-f]{40}\//;

describe("claims", () => {
  it("have unique ids", () => {
    const ids = CLAIMS.map((claim) => claim.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("each appear on the page, and the page claims nothing else", () => {
    const onPage = new Set([...page.matchAll(/data-claim="([\w-]+)"/g)].map((m) => m[1]));
    assert.deepEqual([...onPage].sort(), CLAIMS.map((claim) => claim.id).sort());
  });

  it("link GitHub files at a pinned commit, except the page's own receipt", () => {
    for (const claim of CATALOG) {
      if (isSiteClaim(claim)) continue;
      for (const { url } of claim.evidence) {
        const isFile = /^https:\/\/github\.com\/MdIbuA\/[^/]+\/(?:blob|tree)\//.test(url);
        if (isFile) assert.match(url, PINNED, `${claim.id}: ${url} isn't pinned to a commit`);
      }
    }
  });

  it("only call a receipt partial if it says which lines lack proof", () => {
    for (const claim of CATALOG.filter((c) => c.status === "partial")) {
      assert.ok(claim.lines.some((line) => line.ok === false), `${claim.id} is partial but every line looks proven`);
    }
  });

  it("only call a receipt self-reported if no line claims public proof", () => {
    for (const claim of CATALOG.filter((c) => c.status === "self")) {
      assert.ok(claim.lines.every((line) => line.ok === false), `${claim.id} is self-reported but a line claims proof`);
    }
  });

  it("race the coin only with a real percentage", () => {
    for (const claim of CATALOG) {
      if (claim.status === "verified" && claim.coin !== undefined) {
        assert.ok(claim.coin > 0 && claim.coin < 100, `${claim.id}: coin ${claim.coin}`);
      }
    }
  });

  it("print every catch and never leave a field blank", () => {
    for (const claim of CATALOG) {
      for (const field of ["label", "title", "context", "catch"] as const) {
        assert.ok(claim[field].trim(), `${claim.id}.${field} is empty`);
      }
    }
  });

  it("count corrections the way the About section says it in words", () => {
    const words = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
    const { corrections } = tally(false);
    assert.match(page, new RegExp(`caught ${words[corrections]} places where my own write-ups disagreed with my code`));
  });
});
