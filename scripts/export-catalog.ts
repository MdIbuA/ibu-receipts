/*
  Writes the skill catalog the Bedrock reader Lambda uses (ids and labels only,
  no proof) from src/feature/receipts/skills.ts, the single source of truth.
  npm run catalog; test/catalog.test.ts fails if the two drift apart.
*/
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { SKILLS } from "../src/feature/receipts/skills.ts";

export const CATALOG_PATH = new URL("../infra/recheck/src/skill_catalog.json", import.meta.url);

export function catalogJson(): string {
  return `${JSON.stringify(SKILLS.map(({ id, label }) => ({ id, label })), null, 1)}\n`;
}

// Run directly (not imported by the test): write the file.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(CATALOG_PATH, catalogJson());
  console.log(`wrote ${SKILLS.length} skills to infra/recheck/src/skill_catalog.json`);
}
