// The page without JavaScript must already tell the truth, and the security
// policy must still allow exactly what the page runs.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { tally, TOTAL } from "../src/feature/receipts/catalog.ts";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("site/index.html");
const headers = read("customHttp.yml");

describe("the page before JavaScript runs", () => {
  // Static numbers are what a reader without JavaScript sees. On a local copy the
  // page's own receipt isn't verified, so these match the local tally.
  const t = tally(false);

  it("prints the right totals in every [data-rc-*] slot", () => {
    const slots = (name: string): string[] => [...page.matchAll(new RegExp(`data-rc-${name}>(\\d+)<`, "g"))].map((m) => m[1] ?? "");
    assert.ok(slots("total").length >= 3, "expected several total slots");
    for (const n of slots("total")) assert.equal(Number(n), TOTAL);
    for (const n of slots("verified")) assert.equal(Number(n), t.verified);
    for (const n of slots("corrections")) assert.equal(Number(n), t.corrections);
  });

  it("has no inline styles, which the content security policy would block", () => {
    assert.doesNotMatch(page, /\sstyle\s*=/i);
  });
});

describe("the content security policy", () => {
  it("allows the page's one inline script by its exact hash", () => {
    const inline = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? "");
    assert.equal(inline.length, 1, "exactly one inline script");
    const hash = createHash("sha256").update(inline[0] ?? "").digest("base64");
    assert.ok(headers.includes(`'sha256-${hash}'`), `customHttp.yml is missing 'sha256-${hash}'`);
  });

  it("allows no inline scripts by any other means", () => {
    assert.doesNotMatch(headers, /'unsafe-inline'|'unsafe-eval'/);
  });
});

describe("the modules", () => {
  const sources = readdirSync(new URL("../src/feature/receipts/", import.meta.url)).filter((f) => f.endsWith(".ts")).map((f) => f.replace(/\.ts$/, ".js"));

  it("are all preloaded, and nothing else is", () => {
    const preloaded = [...page.matchAll(/<link rel="modulepreload" href="feature\/receipts\/([\w-]+\.js)">/g)].map((m) => m[1] ?? "");
    assert.deepEqual(preloaded.sort(), sources.filter((f) => f !== "main.js").sort());
  });

  it("start from main.js, which a source file compiles to", () => {
    assert.match(page, /<script type="module" src="feature\/receipts\/main\.js"><\/script>/);
    assert.ok(sources.includes("main.js"));
  });
});
