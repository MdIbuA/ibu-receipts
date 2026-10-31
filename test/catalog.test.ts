// The Bedrock reader can only name skills the page can prove (or admit it can't),
// so its catalog must be exactly the skill map, in step with every change.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { catalogJson, CATALOG_PATH } from "../scripts/export-catalog.ts";

describe("the Bedrock reader's skill catalog", () => {
  it("matches the skill map exactly (run npm run catalog after editing skills.ts)", () => {
    assert.equal(readFileSync(CATALOG_PATH, "utf8").replace(/\r\n/g, "\n"), catalogJson());
  });
});
