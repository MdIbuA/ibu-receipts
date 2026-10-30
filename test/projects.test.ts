import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ago, kb, pad, plural, utc } from "../src/feature/receipts/format.ts";
import { fileUrl, isSha, PROJECTS, sha } from "../src/feature/receipts/projects.ts";

const COMMIT = "6dd2cda9d9b674a82587be131203caf419d084f4";

describe("pinned projects", () => {
  it("only accept full commit SHAs", () => {
    assert.equal(isSha(COMMIT), true);
    assert.throws(() => sha("main"), /full commit SHA/);
    assert.throws(() => sha("6dd2cda"), /full commit SHA/);
    assert.throws(() => sha(COMMIT.toUpperCase()), /full commit SHA/);
  });

  it("link a file's exact line at the pinned commit", () => {
    assert.equal(fileUrl("gitbard", "src/app.py", 7),
      `https://github.com/MdIbuA/GitBard/blob/${PROJECTS.gitbard.at}/src/app.py#L7`);
  });

  it("link Markdown in plain view, so the line anchor works", () => {
    assert.match(fileUrl("tripwire", "README.md", 1), /README\.md\?plain=1#L1$/);
  });

  it("link notebooks without an anchor, since GitHub renders them", () => {
    assert.match(fileUrl("cryptopulse", "milestone 2/bitcoin-infy.ipynb", 1457), /milestone%202\/bitcoin-infy\.ipynb$/);
  });

  it("link this site's files at the commit that built the page, or main locally", () => {
    assert.match(fileUrl("site", "amplify.yml", 17, COMMIT), new RegExp(`/ibu-receipts/blob/${COMMIT}/amplify\\.yml#L17$`));
    assert.match(fileUrl("site", "amplify.yml", 17), /\/ibu-receipts\/blob\/main\/amplify\.yml#L17$/);
    assert.match(fileUrl("site", "amplify.yml", 17, "HEAD"), /\/blob\/main\//);
  });
});

describe("formatting", () => {
  it("pads, sizes and dates the way a receipt prints them", () => {
    assert.equal(pad(4), "04");
    assert.equal(kb(2048), "2.0 KB");
    assert.equal(kb(316_671), "309 KB");
    assert.equal(utc("2026-10-29T07:38:48Z"), "2026-10-29 07:38 UTC");
    assert.equal(utc("not a date"), "not a date");
  });

  it("says how long ago a check ran", () => {
    const now = Date.parse("2026-10-30T10:00:00Z");
    assert.equal(ago("2026-10-30T09:59:55Z", now), "just now");
    assert.equal(ago("2026-10-30T09:59:00Z", now), "60 s ago");
    assert.equal(ago("2026-10-30T09:50:00Z", now), "10 min ago");
  });

  it("pluralizes", () => {
    assert.equal(plural(1, "requirement"), "1 requirement");
    assert.equal(plural(3, "requirement"), "3 requirements");
  });
});
