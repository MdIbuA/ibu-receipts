// Reading job descriptions: the traps (Java in JavaScript, "go" the verb), what
// counts as nice-to-have, and the three samples a judge will try first.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyReading, MAX_CHARS, readJob, receiptText } from "../src/feature/receipts/match.ts";
import { ROLES } from "../src/feature/receipts/roles.ts";

const ids = (text: string): string[] => readJob(text).lines.map((line) => line.skill.id);
const line = (text: string, id: string) => readJob(text).lines.find((l) => l.skill.id === id);
const role = (id: string): string => ROLES.find((r) => r.id === id)?.text ?? "";

describe("finding skills", () => {
  it("keeps Java and JavaScript apart", () => {
    assert.deepEqual(ids("Strong JavaScript"), ["javascript"]);
    assert.deepEqual(ids("Java 17 and Spring Boot"), ["java", "spring"]);
  });

  it("finds Go the language, not go the verb", () => {
    assert.deepEqual(ids("Python, Go, Rust"), ["python", "go", "rust"]);
    assert.deepEqual(ids("Golang microservices"), ["go"]);
    assert.deepEqual(ids("Ready to go to market fast"), []);
  });

  it("finds React the library, not react the verb or React Native", () => {
    assert.deepEqual(ids("React and TypeScript"), ["react", "typescript"]);
    assert.deepEqual(ids("React Native apps"), ["react-native"]);
    assert.deepEqual(ids("You react quickly to incidents"), []);
  });

  it("prints the most specific skill when phrases overlap", () => {
    assert.deepEqual(ids("AWS Lambda"), ["lambda"]);
    assert.deepEqual(ids("Oracle PL/SQL"), ["plsql"]);
    assert.deepEqual(ids("Node.js"), ["node"]);
    assert.deepEqual(ids("GitHub Actions"), ["github-actions"]);
    assert.deepEqual(ids("MLOps"), ["mlops"]);
  });

  it("doesn't read words inside other words", () => {
    assert.deepEqual(ids("HTML"), ["html-css"]);
    assert.deepEqual(ids("PostgreSQL"), ["postgres"]);
    assert.deepEqual(ids("a Spring 2027 internship"), ["experience"]);
    assert.deepEqual(ids("Ask Sam about the SAM template"), ["iac"]);
  });

  it("lists each skill once, even when asked for twice", () => {
    assert.deepEqual(ids("Python.\nMore Python.\nPYTHON!"), ["python"]);
  });

  it("reads nothing into an empty or unrelated description", () => {
    assert.deepEqual(readJob("").lines, []);
    assert.deepEqual(readJob("We are a friendly team in a sunny office.").lines, []);
  });
});

describe("must-have or nice-to-have", () => {
  it("follows the description's headings", () => {
    const text = "Requirements\n- Python\nNice to have:\n- Kubernetes\nQualifications\n- Docker";
    assert.equal(line(text, "python")?.priority, "must");
    assert.equal(line(text, "kubernetes")?.priority, "nice");
    assert.equal(line(text, "docker")?.priority, "must");
  });

  it("reads Amazon-style headings", () => {
    const text = "Basic qualifications\n- Python\nPreferred qualifications\n- AWS CDK";
    assert.equal(line(text, "python")?.priority, "must");
    assert.equal(line(text, "cdk")?.priority, "nice");
  });

  it("notices an inline 'is a plus'", () => {
    assert.equal(line("- Python\n- Experience with Terraform is a plus", "terraform")?.priority, "nice");
  });

  it("never treats a bullet as a heading", () => {
    const text = "- Docker (preferred)\n- Python";
    assert.equal(line(text, "docker")?.priority, "nice");
    assert.equal(line(text, "python")?.priority, "must");
  });

  it("counts a skill as a must-have if it is required anywhere", () => {
    assert.equal(line("Bonus:\n- Docker\nRequirements\n- Docker", "docker")?.priority, "must");
  });

  it("lists must-haves first, each in the description's order", () => {
    const priorities = readJob(role("cloud-intern")).lines.map((l) => l.priority);
    assert.deepEqual(priorities, [...priorities].sort((a, b) => (a === b ? 0 : a === "must" ? -1 : 1)));
  });
});

describe("the receipt", () => {
  it("takes the first line as the role's title, unless it is a heading or a list", () => {
    assert.equal(readJob(role("cloud-intern")).title, "Cloud Engineering Intern (AWS)");
    assert.equal(readJob("- Python\n- AWS").title, "");
    assert.equal(readJob("Requirements:\n- Python").title, "");
  });

  it("reads only the first MAX_CHARS characters", () => {
    const long = `Python\n${"filler ".repeat(MAX_CHARS / 7)}\nKubernetes`;
    const receipt = readJob(long);
    assert.equal(receipt.truncated, true);
    assert.deepEqual(receipt.lines.map((l) => l.skill.id), ["python"]);
  });

  it("tallies exactly the lines it prints", () => {
    const receipt = readJob(role("ml-engineer"));
    const { proven, partial, none } = receipt.tally;
    assert.equal(proven + partial + none, receipt.lines.length);
  });

  it("as text, links every proven line at a pinned commit and admits every gap", () => {
    const receipt = readJob(role("backend"));
    const text = receiptText(receipt, "https://example.test/#job");
    for (const { skill } of receipt.lines) assert.ok(text.includes(skill.label), skill.label);
    assert.match(text, /\[✗\] Kubernetes|\[✗\] Java/);
    for (const url of text.match(/https:\/\/github\.com\/MdIbuA\/(?!ibu-receipts)[^\s]+/g) ?? []) {
      assert.match(url, /\/blob\/[0-9a-f]{40}\//, url);
    }
  });
});

describe("the samples a judge tries first", () => {
  it("each mix proof with honest gaps", () => {
    for (const { id, text } of ROLES) {
      const { tally, lines } = readJob(text);
      assert.ok(lines.length >= 10, `${id}: only ${lines.length} lines`);
      assert.ok(tally.proven > 0 && tally.none > 0, `${id}: needs both proof and gaps`);
      assert.ok(lines.some((l) => l.priority === "nice"), `${id}: needs a nice-to-have section`);
    }
  });

  it("reads the cloud intern role the way a person would", () => {
    const receipt = readJob(role("cloud-intern"));
    const status = Object.fromEntries(receipt.lines.map((l) => [l.skill.id, `${l.priority}:${l.skill.proof.kind}`]));
    assert.equal(status["lambda"], "must:proven");
    assert.equal(status["iac"], "must:proven");
    assert.equal(status["dynamodb"], "must:none");
    assert.equal(status["terraform"], "nice:none");
    assert.equal(status["bedrock"], "nice:proven");
    assert.equal(status["kubernetes"], "nice:none");
  });
});

describe("a closer reading by a model on Bedrock", () => {
  const text = "Cloud Intern\nRequirements\n- Python and AWS Lambda\n- Experience with Kubernetes would be valued\n- Advanced Excel skills";
  const base = readJob(text);
  const reading = (requirements: unknown[]) => ({ model: "Amazon Nova Micro", ms: 1200, requirements });
  const ids = (receipt: ReturnType<typeof readJob> | null) => receipt?.lines.map((l) => `${l.skill.id}:${l.priority}`) ?? [];

  it("only accepts quotes the description really says, for skills on the map", () => {
    const merged = applyReading(text, base, reading([
      { quote: "Python and AWS Lambda", priority: "must", skill: "python" },
      { quote: "10 years of Go", priority: "must", skill: "go" },
      { quote: "AWS Lambda", priority: "must", skill: "cobol" },
      { quote: "Python", priority: "must", skill: "not-a-skill" }
    ]));
    assert.ok(!ids(merged).some((id) => id.startsWith("go:")), "an invented quote got through");
    assert.ok(!ids(merged).some((id) => id.startsWith("cobol")), "an unknown skill got through");
  });

  it("lets the model's sense of nice-to-have win over the patterns' default", () => {
    assert.equal(line(text, "kubernetes")?.priority, "must");
    const merged = applyReading(text, base, reading([{ quote: "Experience with Kubernetes would be valued", priority: "nice", skill: "kubernetes" }]));
    assert.ok(ids(merged).includes("kubernetes:nice"));
  });

  it("keeps what the patterns found even when the model missed it", () => {
    const merged = applyReading(text, base, reading([]));
    assert.deepEqual(ids(merged), ids(base));
  });

  it("lists requirements outside the map in the description's own words", () => {
    const merged = applyReading(text, base, reading([
      { quote: "Advanced Excel skills", priority: "must", skill: "none" },
      { quote: "advanced  excel skills", priority: "must", skill: null }
    ]));
    assert.deepEqual(merged?.unmapped.map((u) => u.quote), ["Advanced Excel skills"]);
  });

  it("says who read it, and keeps the receipt's title", () => {
    const merged = applyReading(text, base, reading([]));
    assert.deepEqual(merged?.readBy, { kind: "model", model: "Amazon Nova Micro", ms: 1200 });
    assert.equal(merged?.title, "Cloud Intern");
  });

  it("refuses anything that isn't a reading", () => {
    for (const answer of [null, "text", { requirements: "nope" }, { error: "model-unavailable" }]) {
      assert.equal(applyReading(text, base, answer), null);
    }
  });

  it("as text, names the reader and lists what's outside the map", () => {
    const merged = applyReading(text, base, reading([{ quote: "Advanced Excel skills", priority: "must", skill: "none" }]));
    const out = merged ? receiptText(merged, "https://example.test/#job") : "";
    assert.match(out, /NOT ON MY SKILL MAP\n\[\?\] "Advanced Excel skills": ask me/);
    assert.match(out, /Read by Amazon Nova Micro on Amazon Bedrock/);
  });
});
