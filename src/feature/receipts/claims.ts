/*
  Receipts: the evidence behind every underlined claim on the page.

  Rule for this file: every number must be reproducible from a public link below.
  If there is no public proof, the line says so (ok: false). Nothing gets rounded up.
  The compiler holds the rest of the rules (see types.ts), and test/claims.test.ts
  checks that every GitHub link is pinned to a commit.
*/
import type { Claim } from "./types.ts";

export const REPO = "https://github.com/MdIbuA/ibu-receipts";

export const CLAIMS = [
  {
    id: "cryptopulse",
    label: "R² 0.94",
    title: "R² 0.94 on Bitcoin close price",
    context: "CryptoPulse · Infosys Springboard internship",
    status: "verified",
    lines: [
      { k: "R² · close · test set", v: "0.9402" },
      { k: "RMSE · close · test set", v: "$5,049.21" },
      { k: "Direction · close · test set", v: "47.93%" },
      { k: "Direction · open · test set", v: "57.82%" }
    ],
    measured: "LSTM on 60-step windows. Chronological 70/30 split, 15,149 test windows. Notebook run Dec 2025.",
    evidence: [
      { label: "Notebook: “Evaluating Model” cell", url: "https://github.com/MdIbuA/CryptoPulse/blob/0bde245a9a8f1f7aec31d8ae4467b865871a0a2f/milestone%202/bitcoin-infy.ipynb" }
    ],
    catch: "On close price the model calls up-or-down correctly 47.93% of the time. A fair coin averages 50%. The high R² mostly says the next price sits near the last one, so this model has no reliable trading edge. Even on its own training data, close direction was 46.51%.",
    correction: "An earlier write-up of mine called this an 80/20 split. The LSTM cell in the notebook splits 70/30.",
    coin: 47.93
  },
  {
    id: "supermarket",
    label: "30 typed tools",
    title: "30 typed tools, one chat window",
    context: "Supermarket Ops Agent · hiring take-home · 2026",
    status: "verified",
    lines: [
      { k: "Tools in ALL_TOOLS", v: "30" },
      { k: "Tool rounds per message, max", v: "15" },
      { k: "Money stored as", v: "integer paise" },
      { k: "Where prices come from", v: "Postgres, via tools" }
    ],
    evidence: [
      { label: "registry.ts: the 30 tool schemas", url: "https://github.com/MdIbuA/SuperMarketAgent/blob/fcf311e17c8ed933b2d4b7608feb44d274af2a34/src/tools/registry.ts#L15-L57" },
      { label: "runtime.ts: MAX_TOOL_ROUNDS = 15", url: "https://github.com/MdIbuA/SuperMarketAgent/blob/fcf311e17c8ed933b2d4b7608feb44d274af2a34/src/agent/runtime.ts#L10" },
      { label: "schema.prisma: money in paise", url: "https://github.com/MdIbuA/SuperMarketAgent/blob/fcf311e17c8ed933b2d4b7608feb44d274af2a34/prisma/schema.prisma#L3" },
      { label: "README: known limitations", url: "https://github.com/MdIbuA/SuperMarketAgent/blob/fcf311e17c8ed933b2d4b7608feb44d274af2a34/README.md?plain=1#L217-L224" }
    ],
    catch: "One store per bot. Payments are recorded, not processed. Chat history lives in memory, so a restart forgets the conversation (the store's data survives in Postgres).",
    correction: "My README says 32 tools, and so did an earlier write-up. The registry holds 30. The code wins."
  },
  {
    id: "documind",
    label: "built in a weekend",
    title: "Built in a weekend on Amazon Bedrock",
    context: "DocuMind AI · AWS Builder Showcase Challenge · Aug 28–31, 2026",
    status: "verified",
    lines: [
      { k: "Model", v: "Amazon Nova Pro" },
      { k: "Backend", v: "Lambda · Python 3.12" },
      { k: "Frontend", v: "S3 + CloudFront" },
      { k: "Q&A reads, max", v: "12,000 chars" }
    ],
    evidence: [
      { label: "Published write-up on AWS Builder Center", url: "https://builder.aws.com/content/3IXxyXBIA0XvQy27nJLaev2clbM/weekend-showcase-challenge-documind-ai" },
      { label: "README: challenge dates", url: "https://github.com/MdIbuA/DocuMind-AI/blob/04473d196c96482e0c87189ad2749b5ad02bb3f0/README.md?plain=1#L146" },
      { label: "lambda_function.py: the 12,000-char cut", url: "https://github.com/MdIbuA/DocuMind-AI/blob/04473d196c96482e0c87189ad2749b5ad02bb3f0/backend/lambda_function.py#L112" }
    ],
    catch: "There is no retrieval. Q&A sees only the first 12,000 characters of a document (summaries 14,000), so long files lose their later sections. Scanned PDFs have no text layer and aren't OCR'd."
  },
  {
    id: "tripwire",
    label: "~0.2 s",
    title: "A ~0.2 s reflex against prompt injection",
    context: "Tripwire · Strands Agents + Amazon Bedrock · Oct 2026",
    status: "verified",
    lines: [
      { k: "Median decision · guard", v: "233 ms" },
      { k: "Median decision · quarantine", v: "212 ms" },
      { k: "Attacks that worked · unprotected", v: "5 / 10" },
      { k: "Attacks that worked · Tripwire", v: "0 / 10" },
      { k: "Benign tasks completed", v: "100%" }
    ],
    measured: "Offline probe on a laptop RTX 3050 (6 GB). End-to-end runs: 10 scenarios × 2 on Bedrock.",
    evidence: [
      { label: "README: results tables", url: "https://github.com/MdIbuA/strands-tripwire/blob/9f0559ff2898979d43f48c28140248556c281837/README.md?plain=1#L72-L96" },
      { label: "bench/results.md: full run log", url: "https://github.com/MdIbuA/strands-tripwire/blob/9f0559ff2898979d43f48c28140248556c281837/bench/results.md" },
      { label: "README: honest limitations", url: "https://github.com/MdIbuA/strands-tripwire/blob/9f0559ff2898979d43f48c28140248556c281837/README.md?plain=1#L204-L214" }
    ],
    catch: "End to end, the median guard decision took 341 ms, not 0.2 s. The thresholds were tuned by hand on a small scenario set, and the decision model is experimental. It's defense in depth, not a guarantee."
  },
  {
    id: "ghostprobe",
    label: "read-only",
    title: "A read-only S3 tool that found “deleted” data",
    context: "Ghost Probe · AWS Builder Center “Give your Agent a Tool” challenge · Oct 2026",
    status: "verified",
    lines: [
      { k: "IAM actions granted", v: "11, all List/Get" },
      { k: "Verdict on case_25 · before", v: "COMPLETE" },
      { k: "Verdict on case_25 · after", v: "INCOMPLETE" },
      { k: "Hidden copies found", v: "2" },
      { k: "Tool tests on a fake S3", v: "7" }
    ],
    evidence: [
      { label: "Least-privilege IAM policy", url: "https://github.com/MdIbuA/s3-ghost-probe/blob/2a18b3f4496d4223a087e33471144375d15a07e0/docs/s3_probe_iam_policy.json" },
      { label: "README: before / after", url: "https://github.com/MdIbuA/s3-ghost-probe/blob/2a18b3f4496d4223a087e33471144375d15a07e0/README.md?plain=1#L15-L19" },
      { label: "test_s3_probe.py", url: "https://github.com/MdIbuA/s3-ghost-probe/blob/2a18b3f4496d4223a087e33471144375d15a07e0/code/tests/test_s3_probe.py" }
    ],
    catch: "That's one case from a fictional dataset, run against a demo bucket I seeded myself. It proves the gap exists. It doesn't measure how common it is."
  },
  {
    id: "gitbard",
    label: "every Friday",
    title: "A bard that reads my commits every Friday",
    context: "The Git Bard · AWS “Set Your Creative App Free” weekend challenge",
    status: "verified",
    lines: [
      { k: "EventBridge schedule", v: "cron(0 16 ? * FRI *)" },
      { k: "In Coimbatore", v: "Fri, 9:30 PM IST" },
      { k: "Storyteller", v: "Amazon Nova Micro" },
      { k: "Delivery", v: "Amazon SES" },
      { k: "Infrastructure as code", v: "AWS SAM" }
    ],
    evidence: [
      { label: "template.yaml: the Friday schedule", url: "https://github.com/MdIbuA/GitBard/blob/79c750e69e4e2314befa351c515c4466ebfede29/template.yaml#L71-L74" },
      { label: "README: SES sandbox setup", url: "https://github.com/MdIbuA/GitBard/blob/79c750e69e4e2314befa351c515c4466ebfede29/README.md?plain=1#L62-L64" }
    ],
    catch: "It only chronicles the repos I list (mine lists one), and in the SES sandbox it can only email addresses I've verified."
  },
  {
    id: "votersaathi",
    label: "12 Indian languages",
    title: "An election guide in 12 Indian languages",
    context: "Voter Saathi · civic tech · 2026",
    status: "verified",
    lines: [
      { k: "Languages", v: "12" },
      { k: "Written by hand", v: "English" },
      { k: "Generated by an LLM", v: "the other 11" },
      { k: "Models tried, in order", v: "3 free OpenRouter models, then Gemini" },
      { k: "Hosting", v: "Google Cloud Run" }
    ],
    evidence: [
      { label: "README: the 12 languages", url: "https://github.com/MdIbuA/votersaathi/blob/8594c62338df5004c39b7dca56ff388e2a6b5eef/README.md?plain=1#L122-L140" },
      { label: "server.js: OpenRouter first, Gemini as the fallback", url: "https://github.com/MdIbuA/votersaathi/blob/8594c62338df5004c39b7dca56ff388e2a6b5eef/server.js#L82-L127" },
      { label: "README: assumptions", url: "https://github.com/MdIbuA/votersaathi/blob/8594c62338df5004c39b7dca56ff388e2a6b5eef/README.md?plain=1#L202-L208" }
    ],
    catch: "Only English is hand-written. The other 11 languages are generated on each request by free hosted models, so their quality and uptime depend on those models and their quotas.",
    correction: "My README credits Gemini with the other 11 languages. The server tries three free OpenRouter models first (Gemma, Qwen and Llama) and calls Gemini only if they fail or no OpenRouter key is set."
  },
  {
    id: "celebrai",
    label: "86 tests, zero runtime dependencies",
    title: "86 passing tests, zero runtime dependencies",
    context: "CelebrAI · event planner",
    status: "verified",
    lines: [
      { k: "Unit tests passing", v: "86 / 86" },
      { k: "Runtime dependencies", v: "0" },
      { k: "Money stored as", v: "integer paise" }
    ],
    evidence: [
      { label: "package.json: dependencies {}", url: "https://github.com/MdIbuA/Celebrai/blob/18078d1e71b2a54d6f5d4acaadad8df0af9b0976/package.json#L15-L16" },
      { label: "README: the test run", url: "https://github.com/MdIbuA/Celebrai/blob/18078d1e71b2a54d6f5d4acaadad8df0af9b0976/README.md?plain=1#L229-L232" },
      { label: "README: what the tests missed", url: "https://github.com/MdIbuA/Celebrai/blob/18078d1e71b2a54d6f5d4acaadad8df0af9b0976/README.md?plain=1#L265-L277" }
    ],
    catch: "All 86 tests passed while a dialog was painted over the entire app. One look on a real phone caught it. In my README's words, a fully green test suite told us nothing about whether the thing rendered."
  },
  {
    id: "tinytale",
    label: "generated live",
    title: "Every story branch generated live",
    context: "Tiny Tale Toy · Bedrock + Lambda + Amplify",
    status: "verified",
    lines: [
      { k: "Chapters per story", v: "up to 5" },
      { k: "Path", v: "API Gateway → Lambda → Bedrock" },
      { k: "Default model in code", v: "Ministral 3 8B" },
      { k: "JSON parsing stages", v: "3" }
    ],
    evidence: [
      { label: "lambda_function.py: the defensive parser", url: "https://github.com/MdIbuA/tiny-tale-toy/blob/bf82c2ddfba3ead7817d731883d68585ca042d74/backend/lambda_function.py#L79-L122" },
      { label: "lambda_function.py: default model", url: "https://github.com/MdIbuA/tiny-tale-toy/blob/bf82c2ddfba3ead7817d731883d68585ca042d74/backend/lambda_function.py#L19" }
    ],
    catch: "Models don't always return clean JSON. The parser strips code fences, then extracts the object, then salvages fields with regex. If all three fail, the player gets an error instead of a chapter.",
    correction: "The README still says Nova Lite in places. The code's default model is Mistral's Ministral 3 8B."
  },
  {
    id: "roles",
    label: "AWS Student Builder Campus Leader",
    title: "Community roles",
    context: "Student programs",
    status: "partial",
    lines: [
      { k: "AWS Student Builder Campus Leader", v: "no public receipt", ok: false },
      { k: "Microsoft Learn Student Ambassador (Associate)", v: "no public receipt", ok: false },
      { k: "Author on AWS Builder Center", v: "public" }
    ],
    evidence: [
      { label: "AWS Builder Center profile", url: "https://builder.aws.com/community/@abufawaz" },
      { label: "Published article: DocuMind AI", url: "https://builder.aws.com/content/3IXxyXBIA0XvQy27nJLaev2clbM/weekend-showcase-challenge-documind-ai" }
    ],
    catch: "Two of these three roles have no public page I can link to, so they're on my word alone. Ask me about them."
  },
  {
    id: "internships",
    label: "three internships",
    title: "Three internships",
    context: "Experience",
    status: "partial",
    lines: [
      { k: "AI Intern · Infosys Springboard, Batch 5", v: "public" },
      { k: "Backend AI Engineer Intern · FlyRank AI", v: "no public receipt", ok: false },
      { k: "MERN Stack Intern · AICTE program", v: "no public receipt", ok: false }
    ],
    evidence: [
      { label: "CryptoPulse README: Infosys Springboard, Batch 5", url: "https://github.com/MdIbuA/CryptoPulse/blob/0bde245a9a8f1f7aec31d8ae4467b865871a0a2f/README.md?plain=1#L54-L56" }
    ],
    catch: "Only the Infosys internship left public work behind. The other two are on my word alone. Ask me about them."
  },
  {
    id: "hackerrank",
    label: "HackerRank Orchestrate",
    title: "HackerRank Orchestrate, Aug–Oct 2026",
    context: "Monthly build challenges",
    status: "partial",
    lines: [
      { k: "October round: built on its dataset", v: "public" },
      { k: "Aug, Sep, Oct starter repos forked", v: "public" },
      { k: "My submissions and placings", v: "no public receipt", ok: false }
    ],
    evidence: [
      { label: "Ghost Probe audits the October round's dataset", url: "https://github.com/MdIbuA/s3-ghost-probe/blob/2a18b3f4496d4223a087e33471144375d15a07e0/README.md?plain=1#L54-L60" },
      { label: "Fork of the October starter repo", url: "https://github.com/MdIbuA/hackerrank-orchestrate-october26" }
    ],
    catch: "The weakest receipt on this page. A fork proves I pulled the starter kit, not how I did."
  },
  {
    id: "qiskit",
    label: "IBM Qiskit Fall Fest",
    title: "Ran an IBM Qiskit Fall Fest workshop",
    context: "Off the clock · quantum computing",
    status: "self",
    lines: [
      { k: "Workshop: quantum algorithms", v: "self-reported", ok: false }
    ],
    evidence: [
      { label: "My GitHub profile README", url: "https://github.com/MdIbuA" }
    ],
    catch: "The only public record is my own profile README, so treat this one as self-reported."
  },
  {
    id: "site",
    label: "deployed on AWS Amplify",
    title: "This page, served by AWS Amplify Hosting",
    context: "The receipt for this receipt",
    status: "verified",
    build: true,
    lines: [],
    evidence: [
      { label: "amplify.yml: type-check, test, compile, stamp", url: "https://github.com/MdIbuA/ibu-receipts/blob/main/amplify.yml" },
      { label: "stamp-build.sh: writes this receipt", url: "https://github.com/MdIbuA/ibu-receipts/blob/main/scripts/stamp-build.sh" },
      { label: "claims.ts: every receipt on this page, typed", url: "https://github.com/MdIbuA/ibu-receipts/blob/main/src/feature/receipts/claims.ts" }
    ],
    catch: "I didn't write the numbers above. The Amplify build stamps them into the page at deploy time. Open the site from a local copy and this receipt admits it isn't deployed."
  }
] as const satisfies readonly Claim[];

/** Every claim id on the page, as a type: "cryptopulse" | "supermarket" | … */
export type ClaimId = (typeof CLAIMS)[number]["id"];
