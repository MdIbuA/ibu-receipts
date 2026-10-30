// The skill map: well-formed, and every line in this repo it points at really
// shows what it says. (Other repos are read by scripts/check-evidence.ts.)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { PROJECTS } from "../src/feature/receipts/projects.ts";
import { SKILLS, type FileEvidence } from "../src/feature/receipts/skills.ts";

const files = SKILLS.flatMap((skill) => (skill.proof.kind === "proven" ? skill.proof.evidence : []))
  .filter((evidence): evidence is FileEvidence => evidence.kind === "file");

describe("skills", () => {
  it("have unique ids and labels", () => {
    assert.equal(new Set(SKILLS.map((s) => s.id)).size, SKILLS.length);
    assert.equal(new Set(SKILLS.map((s) => s.label)).size, SKILLS.length);
  });

  it("never match an empty string, so every hit is real text", () => {
    for (const skill of SKILLS) {
      for (const pattern of skill.find) assert.equal(new RegExp(pattern.source, pattern.flags).test(""), false, skill.id);
    }
  });

  it("each find their own label", () => {
    // Labels that are lists ("C# and .NET") must still be found by their first term.
    for (const skill of SKILLS) {
      const firstTerm = skill.label.split(/ and | or | \(|, /)[0] ?? skill.label;
      assert.ok(skill.find.some((p) => new RegExp(p.source, p.flags).test(firstTerm)), `${skill.id} doesn't find "${firstTerm}"`);
    }
  });

  it("explain every partial or missing receipt", () => {
    for (const skill of SKILLS) {
      if (skill.proof.kind !== "proven") assert.ok(skill.proof.note.trim().endsWith("."), `${skill.id} needs a note`);
    }
  });

  it("point at lines in this repo that really show the skill", () => {
    const local = files.filter((evidence) => PROJECTS[evidence.project].at === "deploy");
    assert.ok(local.length > 5, "expected evidence in this repo");
    for (const { path, line, shows } of local) {
      const text = readFileSync(new URL(`../${path}`, import.meta.url), "utf8").split(/\r?\n/)[line - 1] ?? "";
      assert.ok(text.toLowerCase().includes(shows.toLowerCase()), `${path}:${line} should show "${shows}", but reads "${text.trim()}"`);
    }
  });

  it("give every file a real line number", () => {
    for (const { path, line } of files) assert.ok(Number.isInteger(line) && line >= 1, `${path}:${line}`);
  });
});
