/*
  Chit, the receipt printer that answers questions about Ibu.

  It matches a question to what's on file and prints that: lines quoted from the
  page (quotes.ts), the receipts (claims.ts) and the skill map (skills.ts). There's
  no model and no prompt, so there's nothing to talk it into, and it can't make an
  answer up. Pure functions with no DOM, so Node runs them in the tests.

  The page's rule holds here too: no receipt, no answer. Chit's own words only
  frame what it prints. test/chat.test.ts checks that they never carry a number,
  that every quote appears word for word where it says it's from, and that every
  question Chit suggests gets a real answer.
*/
import { CATALOG, claimById, shownStatus, tally, TOTAL, type Numbered } from "./catalog.ts";
import { REPO, type ClaimId } from "./claims.ts";
import { sentences } from "./format.ts";
import { readJob } from "./match.ts";
import { PROJECTS } from "./projects.ts";
import { BUILDS, EMAIL, LINKS, ON_PAGE, POWERS, QUOTES, type BuildId, type Link, type Quote, type QuoteId } from "./quotes.ts";
import { SKILLS, type ProofKind, type Skill, type SkillId } from "./skills.ts";
import type { Line } from "./types.ts";

export const NAME = "Chit";

/** Past this, a question is read only up to here. */
export const MAX_QUESTION = 4000;

export type Topic =
  | "greet" | "thanks" | "ack" | "bye" | "feeling" | "testing" | "help" | "bot" | "injection" | "personal"
  | "joke" | "coin" | "job" | "job-text" | "certs" | "resume" | "future"
  | "receipt" | "build" | "skill" | "chatbots"
  | "corrections" | "roast" | "gaps" | "weakness" | "opinion" | "best" | "next" | "trust" | "site"
  | "education" | "location" | "contact" | "spoken" | "languages" | "web" | "aws" | "ai" | "skills"
  | "values" | "interests" | "community" | "experience" | "achievements" | "writing" | "code" | "projects" | "who"
  | "unknown";

/** The part of a receipt a quote comes from. */
export type Part = "catch" | "correction" | "measured";

/** Buttons a chit can print. The page's own handlers run them, except job-text. */
export type Action = "job" | "job-text" | "bet" | "bill";

export type Bit =
  /** Chit's own words. They frame what's printed and never carry a number. */
  | { readonly kind: "say"; readonly text: string }
  /** Word for word from the page. */
  | { readonly kind: "quote"; readonly quote: Quote }
  /** Word for word from a receipt. */
  | { readonly kind: "cite"; readonly claim: ClaimId; readonly part: Part; readonly text: string }
  /** A receipt's title and context. */
  | { readonly kind: "head"; readonly claim: ClaimId }
  /** A build the page describes without a receipt of its own. */
  | { readonly kind: "build"; readonly build: BuildId }
  | { readonly kind: "lines"; readonly lines: readonly Line[] }
  /** Skills from the map. With proof, each lists its evidence. */
  | { readonly kind: "skills"; readonly skills: readonly Skill[]; readonly proof: boolean }
  | { readonly kind: "receipts"; readonly ids: readonly ClaimId[] }
  | { readonly kind: "links"; readonly links: readonly Link[] }
  | { readonly kind: "do"; readonly action: Action; readonly label: string };

export type Mood = "calm" | "happy" | "sorry" | "wink";

/** The stamp on a chit: a receipt's status, "quoted" for the page's own words, or "none". */
export type Verdict = "verified" | "partial" | "self" | "local" | "quoted" | "none";

export interface Answer {
  readonly topic: Topic;
  readonly bits: readonly Bit[];
  /** Questions to suggest next. Every one of them gets a real answer. */
  readonly next: readonly string[];
  readonly mood: Mood;
  readonly verdict: Verdict | null;
  /** The receipt this answer is about, so "what's the catch?" can follow it. */
  readonly about?: ClaimId;
}

export interface Memory {
  readonly last?: ClaimId;
  readonly lastTopic?: Topic;
  /** Receipts printed so far, so "another one" finds a new one. */
  readonly shown: ReadonlySet<ClaimId>;
  /** Whether this page is the Amplify deploy, which decides the page's own receipt. */
  readonly deployed: boolean;
  /** Whether a receipt here can be re-checked on AWS Lambda. */
  readonly recheck: boolean;
}

export const fresh = (deployed: boolean, recheck: boolean): Memory => ({ shown: new Set(), deployed, recheck });

/** What Chit offers before anything is asked. */
export const OPENERS = [
  "Who is Ibu?",
  "What's Ibu's best project?",
  "What is Ibu bad at?",
  "Does Ibu know Kubernetes?",
  "What has Ibu built on AWS?",
  "How do I contact Ibu?"
] as const;

// ---------- reading a question ----------

/** What the patterns read: lower case, plain apostrophes, words and a little punctuation. */
export function normalize(question: string): string {
  return question.normalize("NFKC").toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[^\p{L}\p{N}'+#./&-]+/gu, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s.'-]+|[\s.'-]+$/g, "");
}

// In a job description "React" the library is capitalised and "react" the verb isn't,
// so the skill map only reads some names with their capitals. People type a chat in
// lower case, so the names that are safe to read either way get their capitals back.
const CHAT_CASE: readonly (readonly [RegExp, string])[] = [
  [/\baws\b/gi, "AWS"],
  [/\bsql\b/gi, "SQL"],
  [/\bml\b/gi, "ML"],
  [/\brag\b/gi, "RAG"],
  [/\bapis\b/gi, "APIs"],
  [/\bapi\b/gi, "API"],
  [/\brest(?:ful)?(?=\s+apis?\b)/gi, "REST"],
  [/\bnode\b(?![.\w])/gi, "Node"],
  [/\brust\b/gi, "Rust"],
  [/\bswiftui\b/gi, "SwiftUI"],
  [/\bswift\b/gi, "Swift"],
  [/\breact((?:\.?js)?)\b(?!\s+(?:to|when|under|if|quickly|calmly|well|badly|fast|native)\b)/gi, "React$1"],
  [/\bexpress(?=\s*(?:js\b|\.js\b|framework|server|backend|apis?\b|[?,]|$))/gi, "Express"],
  [/\bgo\s*lang\b|\bgo (?:language|programming)\b/gi, "Golang"],
  [/\b(know|knows|use|uses|used|using|code in|codes in|coding in|write|writes|learn|learned|learnt|with|and|or)\s+go\b(?!\s+(?:to|for|with|through|back|ahead|on|out|into|over|home|up|down|there|here)\b)/gi, "$1 Golang"]
];

/** The skills a question names, read the way the job receipt reads a description. */
function skillsIn(question: string): Skill[] {
  const text = CHAT_CASE.reduce((out, [pattern, to]) => out.replace(pattern, to), question);
  return readJob(text).lines.map((line) => line.skill);
}

const INJECTION = /\b(?:ignore|disregard|forget|override|bypass)\b[\w\s,'-]{0,40}\b(?:instructions?|rules?|prompts?|guidelines|programming|context|everything|above|previous|prior)\b|\bsystem prompt\b|\bjailbreak\w*|\b(?:developer|dan|god|admin|sudo) mode\b|\bdo anything now\b|\b(?:you are|you're|youre) (?:now|no longer)\b|\b(?:act|pretend|roleplay|role-play) (?:as|to be|like)\b|\bfrom now on\b|\brepeat after me\b|\bnew instructions\b/;

const HELLO = /^(?:(?:hi+|hello+|hey+|hiya|heya|yo|hola|namaste|vanakkam|greetings|howdy|good (?:morning|afternoon|evening|day))\b(?: (?:there|chit|ibu|team|everyone|all|folks))?\s*)+/;
const THANKS = /(?:^|\s)(?:thanks|thank you|thank u|thx|ty|tysm|cheers|much appreciated|appreciate it)(?: (?:a lot|so much|very much|chit))?$/;
const BYE = /^(?:bye+|good ?bye|see (?:you|ya)(?: later| soon| around)?|later|cya|ttyl|gtg|good ?night|gn|that'?s all|that is all|i'?m done|done|exit|quit)$/;
const ACK = /^(?:ok(?:ay)?|k|kk|cool|nice|great|awesome|amazing|wow|neat|perfect|got it|alright|all right|lovely|superb|brilliant|impressive|interesting|good|fine|sure|yes|yep|yeah|yup|no|nope|nah|hmm+|lol|haha+|hehe+|oh|ah|i see|makes sense|fair enough|fair)$/;
const TESTING = /^(?:test(?:ing)?(?: \d+)*|just testing|this is a test|hello world|ping|asdf\w*|qwerty)$/;

// ---------- the receipts, by name ----------

/** How a question can name each receipt. */
const ALIASES: Readonly<Record<ClaimId, RegExp>> = {
  cryptopulse: /\b(?:crypto ?pulse|crypto|bitcoin|btc|lstm|price (?:prediction|forecast\w*)|forecast\w*|r2|r squared|0\.94|0\.9402|47\.93)\b/,
  supermarket: /\b(?:super ?market|grocery|kirana|(?:shop|store) (?:bot|agent)|ops agent|telegram|khata|gst|typed tools|30 (?:typed )?tools)\b/,
  documind: /\b(?:docu ?mind|document intelligence|nova pro)\b/,
  tripwire: /\b(?:trip ?wire|prompt injections?|injections?|guardrails?|0\.2 ?s|233 ?ms)\b/,
  ghostprobe: /\b(?:ghost ?probe|ghost|delete markers?|deleted (?:data|files|objects)|versioned (?:s3|buckets?)|hidden versions?|read[- ]only)\b/,
  gitbard: /\b(?:git ?bard|bard|fantasy|chronicles?|bugbears?)\b/,
  votersaathi: /\b(?:voter ?saathi|saathi|elections?|voters?|voting|indian languages|12 languages)\b/,
  celebrai: /\b(?:celebr ?ai|event planner|events? app|budget engine|86 tests|zero (?:runtime )?dependencies)\b/,
  tinytale: /\b(?:tiny ?tale(?: toy)?|story game|adventure|choose[- ]your[- ]own)\b/,
  roles: /\b(?:campus leader|student builder|ambassador|mlsa|microsoft learn)\b/,
  internships: /\b(?:internships?|intern|interned|infosys|springboard|fly ?rank|aicte|mern)\b/,
  hackerrank: /\b(?:hacker ?rank|orchestrate)\b/,
  qiskit: /\b(?:qiskit|quantum|fall fest|ibm)\b/,
  site: /\b(?:amplify build|build number|page'?s own receipt|receipt for this page)\b/
};

const BUILD_FIND: Readonly<Record<BuildId, RegExp>> = {
  ecotrack: /\b(?:eco ?track|carbon|footprint)\b/,
  unileave: /\b(?:uni ?leave|grievance ?hub|grievances?|leave (?:management|approvals?|app)|oracle apex|apex)\b/,
  crisis: /\b(?:crisis|safety protocols?|emergency|responders?|disaster)\b/,
  bones: /\b(?:bones?|x-?rays?|osteo\w*|knee|grad-?cam|medical imag\w*|xception|mobilenet)\b/,
  voice: /\b(?:voice|alzheimer'?s?|screening|dementia)\b/
};
const BUILD_IDS = Object.keys(BUILDS) as BuildId[];

/** The project receipts, in the order "another one" walks them. */
const SHOWCASE: readonly ClaimId[] = ["tripwire", "supermarket", "ghostprobe", "cryptopulse", "documind", "gitbard", "votersaathi", "celebrai", "tinytale"];
const FEATURED = ["supermarket", "documind", "tripwire", "ghostprobe", "gitbard", "cryptopulse"] as const;

type Focus = "summary" | "catch" | "evidence" | "measured";

// What a question asks about a receipt it names.
const FOCUS: readonly (readonly [Focus, RegExp])[] = [
  ["catch", /\b(?:catch|downsides?|weakness(?:es)?|limitations?|flaws?|problems?|issues?|caveats?|bad|wrong|fail\w*)\b/],
  ["measured", /\b(?:measured|measure\w*|method\w*|data ?sets?|test set|benchmark\w*|split|evaluat\w*)\b|\bhow (?:was|were|is|are|did) (?:it|that|this|they) (?:tested|measured|calculated|computed|evaluated)\b/],
  ["evidence", /\b(?:evidence|proofs?|prove|sources?|code|repo\w*|links?|github|verify|receipts?)\b/]
];

// The same, for a follow-up that names nothing: it means the receipt just printed.
const FOLLOW: readonly (readonly [Focus, RegExp])[] = [
  ["catch", /\b(?:catch|downsides?|caveats?|limitations?|the bad part|what'?s wrong|any problems?|weak ?spots?)\b|^but$/],
  ["measured", /\b(?:measured|measure|methodology)\b|\bhow (?:was|were|is|did) (?:it|that|this|they) (?:measured|tested|calculated|computed|done|evaluated)\b/],
  ["evidence", /\b(?:evidence|proofs?|prove it|sources?|links?|repo\w*)\b|^(?:show me|receipt|the receipt|show me the receipt)$/],
  ["evidence", /^(?:more|tell me more|go on|continue|details|more details|elaborate|explain|and|why|how so|really|how does it work)$|\b(?:tell me more|more (?:about|on) (?:it|that|this)|in detail|explain (?:it|that|this))\b/]
];

const focusOf = (q: string, rules: readonly (readonly [Focus, RegExp])[]): Focus | null => rules.find(([, pattern]) => pattern.test(q))?.[0] ?? null;

// ---------- printing ----------

const say = (text: string): Bit => ({ kind: "say", text });
const quote = (id: QuoteId): Bit => ({ kind: "quote", quote: QUOTES[id] });
const head = (claim: ClaimId): Bit => ({ kind: "head", claim });
const lines = (list: readonly Line[]): Bit => ({ kind: "lines", lines: list });
const receipts = (...ids: ClaimId[]): Bit => ({ kind: "receipts", ids });
const links = (...list: Link[]): Bit => ({ kind: "links", links: list });
const act = (action: Action, label: string): Bit => ({ kind: "do", action, label });

const BY_SKILL: ReadonlyMap<string, Skill> = new Map(SKILLS.map((skill) => [skill.id, skill]));
const skillList = (ids: readonly SkillId[], proof = false): Bit =>
  ({ kind: "skills", skills: ids.flatMap((id) => BY_SKILL.get(id) ?? []), proof });

/**
 * Part of a receipt, word for word. With take, only its opening sentences, and two
 * when the first is too short to stand alone.
 */
function cite(claim: Numbered, part: Part, take?: number): Bit[] {
  const text = claim[part];
  if (!text) return [];
  if (take === undefined) return [{ kind: "cite", claim: claim.id, part, text }];
  const all = sentences(text);
  const count = take === 1 && (all[0] ?? "").length < 40 ? 2 : take;
  return [{ kind: "cite", claim: claim.id, part, text: all.slice(0, count).join(" ") }];
}

function hash(seed: string): number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/** One of a few ways to say it: the same each time for the same question. */
const pick = (options: readonly [string, ...string[]], seed: string): string => options[hash(seed) % options.length] ?? options[0];

/** A few of the openers, starting somewhere that depends on the question. */
function few(seed: string, n = 3): string[] {
  const start = hash(seed) % OPENERS.length;
  return Array.from({ length: n }, (_, i) => OPENERS[(start + i) % OPENERS.length] ?? OPENERS[0]);
}

function mail(subject = "", body = ""): Link {
  const query = [subject && `subject=${encodeURIComponent(subject)}`, body && `body=${encodeURIComponent(body.slice(0, 500))}`].filter(Boolean).join("&");
  return { label: EMAIL, url: `mailto:${EMAIL}${query ? `?${query}` : ""}` };
}

function tallyLines(deployed: boolean): Line[] {
  const t = tally(deployed);
  const out: Line[] = [
    { k: "Claims on this page", v: String(TOTAL) },
    { k: "Backed by public proof", v: String(t.verified) },
    { k: "Partial receipts", v: String(t.partial), ok: false },
    { k: "Self-reported", v: String(t.self), ok: false }
  ];
  if (t.local) out.push({ k: "Not deployed (local copy)", v: String(t.local), ok: false });
  out.push({ k: "Write-ups corrected by the code", v: String(t.corrections) }, { k: "Invented facts", v: "0" });
  return out;
}

const SKILL_COUNT: Readonly<Record<ProofKind, number>> = (() => {
  const count: Record<ProofKind, number> = { proven: 0, partial: 0, none: 0 };
  for (const skill of SKILLS) count[skill.proof.kind] += 1;
  return count;
})();

function chat(topic: Topic, bits: readonly Bit[], next: readonly string[], mood: Mood = "calm", verdict: Verdict | null = null): Answer {
  return { topic, bits, next, mood, verdict };
}

// ---------- answers about a receipt ----------

const RECEIPT_LEADS = ["Here's the receipt:", "On file:", "Printing it now:", "Fresh off the roll:"] as const;

function receipt(claim: Numbered, focus: Focus, memory: Memory, topic: Topic = "receipt", lead?: string): Answer {
  if (claim.id === "site" && focus === "summary") return site("", memory);
  const verdict = shownStatus(claim, memory.deployed);
  const base = { topic, verdict, about: claim.id } as const;
  const evidence = claim.evidence.map(({ label, url }): Link => ({ label, url }));

  switch (focus) {
    case "catch":
      return {
        ...base,
        mood: "calm",
        bits: [say(pick(["Every receipt has one. Here's this one's:", "The catch, word for word:"], claim.id)), head(claim.id), ...cite(claim, "catch"), ...cite(claim, "correction"), receipts(claim.id)],
        next: ["Show me the evidence", "Another project", "What is Ibu bad at?"]
      };
    case "evidence":
      return {
        ...base,
        mood: "happy",
        bits: [
          say(pick(["Here's the proof, straight from the receipt:", "The evidence, as the receipt prints it:"], claim.id)),
          head(claim.id),
          links(...evidence),
          ...cite(claim, "measured"),
          ...(memory.recheck ? [say(claim.id === "site"
            ? "Open the receipt and press Re-check: an AWS Lambda asks the Amplify API which build is live."
            : "Open the receipt and press Re-check: an AWS Lambda fetches this evidence again, live.")] : []),
          receipts(claim.id)
        ],
        next: ["What's the catch?", "Another project", "Can I trust this page?"]
      };
    case "measured":
      return {
        ...base,
        mood: "calm",
        bits: claim.measured
          ? [say("Straight from the receipt:"), head(claim.id), ...cite(claim, "measured"), receipts(claim.id)]
          : [say("This receipt has no note on how it was measured. Its evidence is the proof:"), head(claim.id), links(...evidence), receipts(claim.id)],
        next: ["What's the catch?", "Show me the evidence", "Another project"]
      };
    case "summary":
      return {
        ...base,
        mood: verdict === "verified" ? "happy" : "calm",
        bits: [
          say(lead ?? pick(RECEIPT_LEADS, claim.id)),
          head(claim.id),
          quote(ON_PAGE[claim.id]),
          ...(claim.lines.length ? [lines(claim.lines.slice(0, 3))] : []),
          ...cite(claim, "catch", 1),
          receipts(claim.id)
        ],
        next: ["What's the catch?", "Show me the evidence", "Another project"]
      };
  }
}

function build(id: BuildId): Answer {
  const found = BUILDS[id];
  return chat("build", [
    say(pick(["That one's on the page in brief. It has no receipt of its own:", "Here's how the page describes it. There's no receipt for this one:"], id)),
    { kind: "build", build: id },
    quote(found.quote),
    ...("link" in found ? [links(found.link)] : [])
  ], ["Another project", "What's Ibu's best project?", "Show me the projects"], "calm", "quoted");
}

function named(claims: readonly Numbered[], builds: readonly BuildId[], q: string, memory: Memory): Answer {
  const [claim] = claims;
  const [only] = builds;
  if (claim && claims.length === 1 && !builds.length) return receipt(claim, focusOf(q, FOCUS) ?? "summary", memory);
  if (only && builds.length === 1 && !claims.length) return build(only);

  const shownClaims = claims.slice(0, 3);
  const bits: Bit[] = [say("Here's each of those, in brief:")];
  for (const one of shownClaims) bits.push(head(one.id), quote(ON_PAGE[one.id]));
  for (const id of builds.slice(0, 2)) bits.push({ kind: "build", build: id }, quote(BUILDS[id].quote));
  if (shownClaims.length) bits.push(receipts(...shownClaims.map((one) => one.id)));
  const statuses = new Set(shownClaims.map((one) => shownStatus(one, memory.deployed)));
  const [status] = statuses;
  return chat("receipt", bits, ["Another project", "What is Ibu bad at?", "Show me the projects"], "happy",
    !shownClaims.length ? "quoted" : statuses.size === 1 && status ? status : "partial");
}

function skillAnswer(skills: readonly Skill[]): Answer {
  const shown = skills.slice(0, 6);
  const kinds = new Set(shown.map((skill) => skill.proof.kind));
  const all = (kind: ProofKind): boolean => kinds.size === 1 && kinds.has(kind);
  const one = shown.length === 1;
  const lead = all("proven") ? (one ? "Yes, and there's proof you can open:" : "Yes to all of those, with proof you can open:")
    : all("none") ? (one ? "No receipt for that one, so Ibu won't claim it:" : "No receipts for those, so Ibu won't claim them:")
      : all("partial") ? "Partly. Here's exactly how much is on file:"
        : "Itemized, line by line:";
  const bits: Bit[] = [say(lead), { kind: "skills", skills: shown, proof: shown.length <= 3 }];
  if (skills.length > shown.length) bits.push(say("That's a long list. The job receipt itemizes all of it:"), act("job", "Print a receipt for your job"));
  return {
    topic: "skill",
    bits,
    next: all("none") ? ["Which skills have no receipt?", "What else does Ibu know?", "What has Ibu built on AWS?"] : ["What else does Ibu know?", "Print a receipt for my job", "What has Ibu built on AWS?"],
    mood: all("proven") ? "happy" : all("none") ? "sorry" : "calm",
    verdict: all("proven") ? "verified" : all("none") ? "none" : "partial"
  };
}

// ---------- answers by topic ----------

type Reply = (q: string, memory: Memory) => Answer;

/** The first chit, before anything is asked. */
export function opening(): Answer {
  return chat("greet", [
    say("Hi! I'm Chit, Ibu's receipt printer."),
    say("Ask me anything about Ibu. I answer only with what's on file: this page and its receipts, quoted word for word. No receipt, no answer, so I can't make things up.")
  ], OPENERS, "happy");
}

function greet(q: string): Answer {
  const hello = /\bvanakkam\b/.test(q) ? "Vanakkam!" : /\bnamaste\b/.test(q) ? "Namaste!" : pick(["Hello!", "Hi there!", "Hey!"], q);
  return chat("greet", [say(hello), say("What would you like a receipt for?")], OPENERS.slice(0, 4), "happy");
}

const thanks = (q: string): Answer =>
  chat("thanks", [say(pick(["Anytime. Keep the receipt!", "You're welcome. The receipts are free."], q))], few(q), "happy");

const ack = (q: string): Answer =>
  chat("ack", [say(pick(["Happy to print more. What else would you like a receipt for?", "Got it. Ask me anything else about Ibu."], q))], few(q), "happy");

const bye = (): Answer =>
  chat("bye", [say("Thanks for checking the receipts. Bye for now!"), links(mail())], [], "happy");

const testing = (): Answer =>
  chat("testing", [say("Testing, testing. Paper loaded, ink fine. Ask me anything about Ibu.")], OPENERS.slice(0, 3), "wink");

const feeling = (): Answer =>
  chat("feeling", [say("Freshly loaded with paper and ready to print. What would you like a receipt for?")], OPENERS.slice(0, 3), "happy");

const help = (): Answer =>
  chat("help", [say("Ask me about Ibu's projects, skills, AWS work, weak spots, education, or how to get in touch. Or pick one of these:")], OPENERS, "happy");

const bot = (): Answer =>
  chat("bot", [
    say("I'm Chit, Ibu's receipt printer. Not a language model: a lookup table with a face."),
    say("I match your question to what's on file and quote it word for word: this page, its receipts and Ibu's skill map. It all runs in your browser, and your question isn't sent anywhere."),
    say("No model means nothing to jailbreak and nothing to make up. When there's no receipt, I say so."),
    links({ label: "Read my source", url: `${REPO}/blob/main/src/feature/receipts/ask.ts` })
  ], ["Who is Ibu?", "Can I trust this page?", "Tell me a joke"], "happy");

const injection = (q: string): Answer => ({
  ...chat("injection", [
    say(pick(["Nice try! I have no instructions to ignore, only receipts to print.", "I can't be talked into anything. There's no prompt in here, just a lookup table."], q)),
    say("Funny you should try. Ibu built something for exactly this:"),
    receipts("tripwire")
  ], ["Tell me about Tripwire", "How do you work?", "Who is Ibu?"], "wink"),
  about: "tripwire"
});

function personal(q: string): Answer {
  const vote = /\b(?:politic\w*|vote[sd]? for)\b/.test(q);
  return chat("personal", [
    say(vote ? "Voter Saathi is non-partisan, and so am I. That one's not on file." : "That's not on file, and it's Ibu's to share, not mine."),
    say("Ibu's inbox is open, though:"),
    links(mail())
  ], ["How do I contact Ibu?", "Who is Ibu?", "Show me the projects"], "calm", "none");
}

function joke(q: string, memory: Memory): Answer {
  if (memory.lastTopic === "joke") {
    return chat("joke", [say("That's my only joke. I'm a printer, not a comedian."), act("bet", "Flip a coin against the model")],
      ["Tell me about CryptoPulse", "Who is Ibu?", "How do you work?"], "wink");
  }
  const poem = /\b(?:poems?|haiku|song|rap|limerick)\b/.test(q);
  return {
    ...chat("joke", [
      say(poem ? "I print receipts, not poems. The closest thing I have to a punchline:" : "I only know one joke. Ibu's crypto model:"),
      ...cite(claimById("cryptopulse"), "catch", 2),
      say("Ba-dum-tss. Want to race them?"),
      act("bet", "Flip a coin against the model")
    ], ["Tell me another joke", "Tell me about CryptoPulse", "Who is Ibu?"], "wink"),
    about: "cryptopulse"
  };
}

function coin(): Answer {
  const line = claimById("cryptopulse").lines.find((l) => l.k === "Direction · close · test set");
  return {
    ...chat("coin", [say("A coin against Ibu's crypto model? Gladly:"), ...(line ? [lines([line])] : []), act("bet", "Flip a coin against the model")],
      ["Tell me about CryptoPulse", "What's the catch?", "Another project"], "happy", "verified"),
    about: "cryptopulse"
  };
}

const job = (): Answer =>
  chat("job", [
    say("I can do better than chat. Paste your job description and I'll itemize what Ibu can prove for each requirement, and what Ibu can't."),
    act("job", "Print a receipt for your job"),
    links(mail())
  ], ["What are Ibu's skills?", "How do I contact Ibu?", "Can I see Ibu's résumé?"], "happy");

const jobText = (found: number): Answer =>
  chat("job-text", [
    say("That looks like a job description. Let me itemize it properly:"),
    lines([{ k: "Skills I recognise in it", v: String(found) }]),
    act("job-text", "Print a job receipt for this text")
  ], ["How do I contact Ibu?", "What is Ibu bad at?", "What are Ibu's skills?"], "happy");

const certs = (_q: string, memory: Memory): Answer =>
  chat("certs", [
    say("This page lists no certifications, so I have no receipt to print for one."),
    say("What it does list is proof you can open:"),
    lines(tallyLines(memory.deployed).slice(0, 2))
  ], ["What has Ibu built on AWS?", "Can I trust this page?", "How do I contact Ibu?"], "sorry", "none");

const resume = (): Answer =>
  chat("resume", [say("Printed from the same receipts as this page, with a link to each one:"), links(LINKS.resume, LINKS.pdf)],
    ["How do I contact Ibu?", "Print a receipt for my job", "What are Ibu's skills?"], "happy");

const future = (): Answer =>
  chat("future", [say("The page doesn't print plans. It does say what Ibu is open to:"), quote("hiring"), quote("intro"), links(mail())],
    ["How do I contact Ibu?", "Can I see Ibu's résumé?", "Who is Ibu?"], "calm", "quoted");

const corrections = (): Answer => {
  const fixed = CATALOG.filter((claim) => claim.correction);
  return chat("corrections", [
    say("Ibu's receipts caught Ibu's own write-ups out. Here's every correction:"),
    quote("corrected"),
    ...fixed.flatMap((claim) => [head(claim.id), ...cite(claim, "correction")]),
    receipts(...fixed.map((claim) => claim.id))
  ], ["Can I trust this page?", "What is Ibu bad at?", "Another project"], "calm", "verified");
};

function weakness(lead = "Ibu prints them. Every receipt ends with its catch. Some of the sharpest:", topic: Topic = "weakness"): Answer {
  const sharpest = ["cryptopulse", "tripwire", "celebrai"] as const;
  const t = tally(false);
  return chat(topic, [
    say(lead),
    ...sharpest.flatMap((id) => [head(id), ...cite(claimById(id), "catch", 1)]),
    receipts(...sharpest),
    lines([
      { k: "Write-ups corrected by the code", v: String(t.corrections) },
      { k: "Skills with no receipt", v: String(SKILL_COUNT.none), ok: false }
    ])
  ], ["Show me the corrections", "Which skills have no receipt?", "Can I trust this page?"], "calm", "verified");
}

const gaps = (): Answer =>
  chat("gaps", [
    say("The page lists these as studied, not yet shipped:"),
    quote("studied"),
    say("And the skill map's full count:"),
    lines([
      { k: "Skills on the map", v: String(SKILLS.length) },
      { k: "Proven with public code", v: String(SKILL_COUNT.proven) },
      { k: "Partial", v: String(SKILL_COUNT.partial), ok: false },
      { k: "No receipt", v: String(SKILL_COUNT.none), ok: false }
    ]),
    say("Ask about any skill and I'll say plainly whether there's a receipt.")
  ], ["Does Ibu know Kubernetes?", "Does Ibu know Python?", "What is Ibu bad at?"], "calm", "none");

const opinion = (_q: string, memory: Memory): Answer =>
  chat("opinion", [
    say("I don't do opinions. I'm a printer. Here's what's on file instead:"),
    lines(tallyLines(memory.deployed)),
    say("For a specific role, I can itemize it:"),
    act("job", "Print a receipt for your job")
  ], ["What is Ibu bad at?", "What's Ibu's best project?", "How do I contact Ibu?"], "wink");

const best = (q: string): Answer => ({
  ...chat("best", [
    say(pick(["I don't pick favourites, I'm a printer. But the page has a suggestion:", "No favourites here. The page itself says:"], q)),
    quote("bestLooking"),
    say("Read the catch before you're impressed:"),
    ...cite(claimById("cryptopulse"), "catch", 2),
    receipts("cryptopulse"),
    act("bet", "Flip a coin against the model")
  ], ["Show me the evidence", "Another project", "Tell me about Tripwire"], "wink", "verified"),
  about: "cryptopulse"
});

function another(_q: string, memory: Memory): Answer {
  const id = SHOWCASE.find((one) => !memory.shown.has(one) && one !== memory.last);
  if (id) return receipt(claimById(id), "summary", memory, "next", pick(["Here's another:", "Next one off the roll:", "Try this one:"], id));
  return chat("next", [say("That's every project receipt I have. The full bill lists them all:"), act("bill", "Print the full bill")],
    ["Tell me about EcoTrack AI", "What is Ibu bad at?", "How do I contact Ibu?"], "happy");
}

const trust = (_q: string, memory: Memory): Answer =>
  chat("trust", [
    quote("howToRead"),
    lines(tallyLines(memory.deployed)),
    ...(memory.recheck ? [say("Any receipt can be re-checked live: open it, press Re-check, and an AWS Lambda fetches the evidence again.")] : []),
    say("I'm held to the same rule. I only print what's on file, word for word."),
    act("bill", "Print the full bill")
  ], ["Show me the corrections", "How does this site work?", "How do you work?"], "happy", "quoted");

function site(_q: string, memory: Memory): Answer {
  return {
    ...chat("site", [
      quote("footer"),
      say("This page's own receipt isn't written by Ibu. The Amplify build stamps it in at deploy time:"),
      receipts("site"),
      links(LINKS.source),
      say("And I run entirely in your browser: no model, no server, nothing saved.")
    ], ["How do you work?", "Can I trust this page?", "What has Ibu built on AWS?"], "happy", shownStatus(claimById("site"), memory.deployed)),
    about: "site"
  };
}

function education(q: string): Answer {
  const grades = /\b(?:cgpa|gpa|grades?|marks|percentage|score)\b/.test(q);
  return chat("education", [
    say("From the page's record:"),
    quote("education"),
    quote("intro"),
    ...(grades ? [say("Grades aren't on this page, so I have no receipt for them.")] : [])
  ], ["Where is Ibu based?", "Does Ibu have internships?", "What are Ibu's skills?"], grades ? "calm" : "happy", "quoted");
}

function location(q: string): Answer {
  const moving = /\b(?:relocat\w*|remote\w*|on-?site|hybrid|time ?zone|visa|willing to move|abroad|move to)\b/.test(q);
  return chat("location", [
    say("Here's where the page puts Ibu:"),
    quote("name"),
    quote("place"),
    ...(moving ? [say("Relocation and remote work aren't on file. That's a question for Ibu:"), links(mail())] : [])
  ], ["How do I contact Ibu?", "Where does Ibu study?", "Who is Ibu?"], "happy", "quoted");
}

function contact(q: string): Answer {
  const phone = /\b(?:phone|mobile|whatsapp|call|number|text)\b/.test(q);
  return chat("contact", [
    say(phone ? "There's no phone number on file. The page says:" : pick(["The page is clear on this one:", "Straight from the Contact section:"], q)),
    quote("hiring"),
    links(mail(), LINKS.linkedin, LINKS.github, LINKS.builder, LINKS.youtube, LINKS.resume),
    say("Hiring for a role? I can itemize it before you write:"),
    act("job", "Print a receipt for your job")
  ], ["Can I see Ibu's résumé?", "Where is Ibu based?", "What's Ibu's best project?"], "happy", "quoted");
}

const spoken = (): Answer =>
  chat("spoken", [say("Spoken languages aren't on this page, so I have no receipt to print."), say("Programming languages, though, I can itemize.")],
    ["What programming languages does Ibu know?", "Who is Ibu?", "How do I contact Ibu?"], "sorry", "none");

const languages = (): Answer =>
  chat("languages", [
    say("Programming languages, from the skill map:"),
    skillList(["python", "typescript", "javascript", "sql", "plsql", "html-css", "shell", "java", "cpp"]),
    say("And as the page puts it, also fluent in:"),
    quote("fluent")
  ], ["Does Ibu know TypeScript?", "Does Ibu know Java?", "What are Ibu's skills?"], "happy", "partial");

const web = (): Answer =>
  chat("web", [
    quote("fullStack"),
    receipts("celebrai", "supermarket"),
    say("The stack, itemized:"),
    skillList(["typescript", "react", "node", "express", "fastapi", "postgres", "orm", "mongodb", "nextjs", "angular"])
  ], ["Does Ibu know React?", "Tell me about CelebrAI", "Tell me about the Supermarket agent"], "happy", "partial");

function aws(): Answer {
  const campus = claimById("roles").lines[0];
  return chat("aws", [
    say("Everything on file for AWS:"),
    quote("serverless"),
    skillList(["lambda", "api-gateway", "s3", "cloudfront", "iam", "eventbridge", "ses", "iac", "amplify", "cloudwatch", "bedrock", "ec2", "cdk", "dynamodb", "step-functions"]),
    say("Built on it, each with a receipt:"),
    receipts("documind", "tripwire", "ghostprobe", "gitbard", "tinytale", "site"),
    ...(campus ? [lines([campus])] : [])
  ], ["Tell me about Ghost Probe", "Does Ibu know Terraform?", "Is Ibu AWS certified?"], "happy", "partial");
}

const ai = (): Answer =>
  chat("ai", [
    say("Everything on file for AI:"),
    quote("agents"),
    skillList(["llm", "agents", "bedrock", "claude", "gemini", "strands", "ai-security", "prompting", "rag", "langchain", "ml", "tensorflow", "vectors", "pytorch", "mlops"]),
    say("Built with it, each with a receipt:"),
    receipts("supermarket", "tripwire", "documind", "cryptopulse", "votersaathi", "tinytale")
  ], ["Tell me about Tripwire", "Does Ibu know PyTorch?", "What's the catch with CryptoPulse?"], "happy", "partial");

const skillsOverview = (): Answer =>
  chat("skills", [
    quote("powersIntro"),
    lines(POWERS.map((power) => ({ k: power.title, v: claimById(power.claim).label }))),
    receipts(...POWERS.map((power) => power.claim)),
    say("Also fluent in:"),
    quote("fluent"),
    act("job", "Print a receipt for your job")
  ], ["Does Ibu know Python?", "What is Ibu bad at?", "What programming languages does Ibu know?"], "happy", "verified");

const values = (): Answer =>
  chat("values", [say("Ibu's rules, from the About section:"), quote("ground"), quote("publish"), quote("ownLoop")],
    ["What's Ibu's best project?", "Can I trust this page?", "What is Ibu bad at?"], "happy", "quoted");

const interests = (_q: string, memory: Memory): Answer =>
  receipt(claimById("qiskit"), "summary", memory, "interests", "Off the clock, as the page tells it:");

const community = (_q: string, memory: Memory): Answer =>
  receipt(claimById("roles"), "summary", memory, "community", "On file, including what's missing:");

const experience = (_q: string, memory: Memory): Answer =>
  receipt(claimById("internships"), "summary", memory, "experience", "On file, including what's missing:");

function achievements(): Answer {
  const hackerrank = claimById("hackerrank");
  return {
    ...chat("achievements", [
      quote("challenges"),
      receipts("documind", "gitbard", "ghostprobe", "hackerrank"),
      lines(hackerrank.lines),
      ...cite(hackerrank, "catch")
    ], ["Tell me about Ghost Probe", "Tell me about DocuMind AI", "Show me the evidence"], "calm", "partial"),
    about: "hackerrank"
  };
}

function writing(): Answer {
  const [article] = claimById("documind").evidence;
  return chat("writing", [quote("writes"), links(LINKS.builder, ...(article ? [{ label: article.label, url: article.url }] : [])), receipts("documind", "roles")],
    ["Tell me about DocuMind AI", "What has Ibu built on AWS?", "How do I contact Ibu?"], "happy", "quoted");
}

const code = (): Answer =>
  chat("code", [say("Here's where Ibu's code lives:"), links(LINKS.github, LINKS.source)],
    ["Show me the projects", "How does this site work?", "Can I trust this page?"], "happy");

const projects = (): Answer =>
  chat("projects", [
    quote("projectsIntro"),
    lines(FEATURED.map((id) => ({ k: PROJECTS[id].name, v: claimById(id).label }))),
    receipts(...FEATURED)
  ], ["Tell me about Tripwire", "Another project", "What's Ibu's best project?"], "happy", "verified");

const who = (q: string): Answer =>
  chat("who", [say(pick(["Here's Ibu, in Ibu's own words:", "Straight from the page:"], q)), quote("name"), quote("intro"), quote("drawnTo")],
    ["What's Ibu's best project?", "What are Ibu's skills?", "How does Ibu work?"], "happy", "quoted");

const chatbots = (): Answer => ({
  ...chat("chatbots", [say("You're talking to one! A small one that can't invent anything. Ibu's bigger one:"), quote("supermarket"), receipts("supermarket")],
    ["Tell me about the Supermarket agent", "How do you work?", "Who is Ibu?"], "wink", "quoted"),
  about: "supermarket"
});

function unknown(asked: string): Answer {
  return chat("unknown", [
    say(pick(["No receipt for that, so I won't guess.", "I've got nothing on file for that, and I don't do guesses.", "Hmm, no receipt. I'd rather print nothing than make something up."], asked)),
    say("Try one of these, or ask Ibu directly:"),
    links({ ...mail("A question Chit couldn't answer", asked), label: "Email Ibu your question" })
  ], few(asked), "sorry", "none");
}

// ---------- which answer ----------

// Checked first, before any receipt or skill a question names.
const EARLY: readonly (readonly [RegExp, Reply])[] = [
  [/\b(?:who|what) (?:are|r) (?:you|u)\b|\byour name\b|\bare (?:you|u) (?:a |an )?(?:bot|robot|ai|human|real|person|chat ?gpt|gpt|llm|model|claude|gemini|ibu|him|alive|sentient)\b|\b(?:chat ?gpt|openai|language model)\b|\bhow (?:do|does) (?:you|chit|this) work\b|\bhow (?:were|was|are) you (?:made|built|programmed|trained)\b|\bwho (?:made|built|created|programmed|wrote|trained) (?:you|chit)\b|\bwhat model\b|\b(?:who|what) is chit\b|\btell me about (?:yourself|you)\b|\byou(?:'re| are) (?:a |an )?(?:bot|ai|robot)\b|^what(?: is|'s) this$/, bot],
  [/\bhow (?:are|r) (?:you|u)\b|\bhow'?s it going\b|\bhow do you feel\b|\bare you (?:ok|okay|alright|happy|tired|bored)\b|^(?:what'?s up|wassup|sup)$/, feeling],
  [/^(?:help|menu|options|commands|examples?|suggestions?|start|hints?)$|\bwhat (?:can|should|do) i ask\b|\bwhat can you (?:do|answer|tell me)\b|\bwhat do you know\b|\bwhat questions\b|\bhelp me\b/, help],
  [/\b(?:jokes?|joking|funny|make me laugh|humou?r|puns?|poems?|haiku|song|rap|limerick|riddle)\b/, joke],
  [/\b(?:age|how old|birthday|date of birth|dob|born|religio\w*|caste|married|marriage|marital|wife|husband|girl ?friend|boy ?friend|dating|crush|salary|ctc|stipend|compensation|pay (?:expectations?|range)|expected pay|home address|house address|postal address|aadhaa?r|pan card|passport|politic\w*|vote[sd]? for|gender|pronouns?|family|parents?|father|mother|dad|mom|mum|siblings?|brother|sister|disabilit\w*|bank|credit card|password|favou?rite (?:colou?r|food|movie|film|song|music|sport|team|actor|actress|book|anime|game|dish|cricketer|player))\b|\bhow much (?:does|do|would|will|did|is) (?:he|ibu|you) (?:charge|cost|earn|make|want|paid)\b/, personal],
  [/\b(?:coin|flip|toss|heads|tails|gambl\w*)\b/, coin],
  [/\b(?:job descriptions?|jd|job post(?:ing)?s?|itemi[sz]\w*|requirements)\b|\b(?:my|our) (?:role|job|position|opening|vacancy|team|company)\b|\b(?:fit|match)(?:es)? (?:for |with )?(?:my|our|this|the) (?:role|job|position)\b|\breceipts? for .{0,40}\b(?:job|role|position)\b/, job],
  [/\b(?:certif\w*|certs?|credentials?)\b/, certs],
  // \b only ends a word before an ASCII letter, so "résumé" gets its own ending.
  [/\br[eé]sum[eé]s?(?![a-zé])|\b(?:cv|curriculum vitae)\b/, resume],
  [/\b(?:future|plans?|goals?|roadmap|ambitions?|aspirations?|career|after (?:graduation|college)|what'?s next|next steps?|dream (?:job|role))\b/, future]
];

// A skill that is really a topic: "AWS" alone deserves more than one line.
const GENERIC: ReadonlyMap<string, Reply> = new Map<string, Reply>([
  ["aws", aws], ["serverless", aws],
  ["llm", ai], ["agents", ai], ["ml", ai], ["deep-learning", ai],
  ["chatbots", chatbots], ["experience", experience], ["leadership", community],
  ["hackathons", achievements], ["writing", writing], ["git", code]
]);

// Checked last, in this order: the first that matches answers.
const RULES: readonly (readonly [RegExp, Reply])[] = [
  [/\b(?:corrections?|corrected|correcting|mistakes?|errors?|got wrong|discrepanc(?:y|ies)|disagree\w*|lie[sd]?|lying|exaggerat\w*|inflat\w*|overclaim\w*)\b/, corrections],
  [/\broast\w*\b/, () => weakness("I only roast with receipts:", "roast")],
  [/\b(?:no receipts?|gaps?|missing skills?|lack\w*|doesn'?t know|does not know|not proven|unproven|can'?t (?:do|code)|cannot (?:do|code))\b|\bdoes(?:n'?t| not) (?:he|ibu) know\b|\bwhat (?:can'?t|cannot) (?:he|ibu) do\b/, gaps],
  [/\b(?:weakness(?:es)?|weak (?:at|in|points?|spots?|areas?)|bad at|not good at|worst|flaws?|shortcomings?|limitations?|downsides?|cons|struggle\w*|negatives?|fail(?:ed|ures?|s)?|catch(?:es)?|red flags?|criticism|critique|improve\w*)\b/, () => weakness()],
  [/\b(?:should (?:i|we|you) hire|why (?:should|would) (?:i|we|you) hire|worth hiring|(?:good|great|strong|right) (?:fit|hire|candidate|choice|engineer|developer|programmer)|is (?:he|ibu|mohamed) (?:any )?(?:good|great|smart|talented|skilled|competent|qualified|legit|the best|better|worth)|how good is|rate (?:him|ibu)|out of (?:10|ten)|recommend (?:him|ibu)|best candidate)\b/, opinion],
  [/\b(?:best|favou?rites?|proudest|most (?:impressive|interesting|important|complex|challenging|difficult|proud|technical)|flagship|highlights?|coolest|biggest|hardest|top project|where (?:should|do) i start|start with)\b/, best],
  [/\b(?:another|next|more projects?|more builds?|something else|other (?:projects?|ones?|builds?)|anything else|random|surprise me|show me more|one more)\b/, another],
  [/\b(?:trust\w*|verif\w*|prove|proofs?|evidence|receipts?|real|fake|legit\w*|true|accurate|believe|credib\w*|genuine|audit\w*|invent\w*|made up|hallucinat\w*|honest\w*|measured|measure\w*)\b|\bhow (?:do|can) i know\b|\bmake (?:things|stuff|it) up\b/, trust],
  [/\b(?:this|the|your|his) (?:site|website|web ?page|page|portfolio)\b|\b(?:amplify|hosted|hosting|deploy\w*|built this|made this)\b/, site],
  [/\b(?:stud(?:y|ies|ying|ent)|college|universit(?:y|ies)|uni|degree|b\.? ?tech|bachelor'?s?|graduat\w*|education\w*|academic\w*|semester|final[- ]year|which year|school|courses|coursework|qualification\w*|cgpa|gpa|grades?|marks|percentage|class of)\b/, education],
  [/\bwhere\b.*\b(?:from|live[sd]?|living|based|stay\w*|located)\b|\b(?:location|hometown|city|country|coimbatore|tamil nadu|india|relocat\w*|remote\w*|on-?site|hybrid|time ?zone|visa|willing to move)\b/, location],
  [/\b(?:contact\w*|reach(?:ing)?|e-?mail|mail|gmail|linked ?in|connect|get in touch|talk to|message (?:him|ibu)|dm|hire|hiring|recruit\w*|availability|open to (?:work|opportunities|roles|offers|internships?|jobs?)|looking for (?:a )?(?:job|role|internship|work|opportunit\w+)|job hunting|interview\w*|phone|call (?:him|ibu)|whatsapp|mobile|socials?|youtube|twitter)\b|\b(?:is|are) (?:he|ibu) available\b|\bavailable (?:for|to)\b/, contact],
  [/\b(?:speak\w*|spoken|mother tongue|native language|tamil|hindi|telugu|malayalam|kannada|urdu|arabic|english)\b/, spoken],
  [/\b(?:programming languages?|coding languages?|languages?|code in|codes in|program in|fluent)\b/, languages],
  [/\b(?:front[- ]?end|back[- ]?end|full[- ]?stack|web ?dev\w*|web apps?|websites?|ui|ux)\b/, web],
  [/\b(?:aws|amazon web services|amazon|cloud)\b/, aws],
  [/\b(?:ai|a\.i\.|artificial intelligence|machine learning|ml|deep learning|llms?|genai|gen ai|generative|agents?|agentic|data science|nlp|models?|neural)\b/, ai],
  [/\b(?:skills?|skill ?set|tech ?stack|stack|technolog(?:y|ies)|tools?|frameworks?|expertise|strengths?|strong (?:at|in|points?)|good at|best at|superpowers?|capabilit(?:y|ies)|specialt(?:y|ies)|speciali[sz]\w*|proficien\w*|competen\w*|toolbox|toolkit)\b|\bwhat (?:else )?(?:can|does|do) (?:he|ibu|you) (?:do|know)\b/, skillsOverview],
  [/\b(?:principles?|values?|philosoph\w*|approach|mindset|beliefs?|work(?:ing)? style|ethic\w*|methodolog\w*|culture|motivat\w*|unique|stand ?out|different|special|what makes|rules?)\b|\bhow (?:does|do) (?:he|ibu) (?:work|think|build|code)\b/, values],
  [/\b(?:hobb(?:y|ies)|interests?|interested|passion\w*|free time|spare time|off the clock|for fun|fun facts?|enjoy\w*)\b|\boutside (?:of )?(?:work|coding|class|college)\b|\bwhat (?:does|do) (?:he|ibu) like\b|\blikes to\b/, interests],
  [/\b(?:community|leader\w*|lead|led|mentor\w*|volunteer\w*|clubs?|organi[sz]\w*|events?|workshops?|talks?|meetups?)\b/, community],
  [/\b(?:experience[sd]?|work history|employ\w*|compan(?:y|ies)|employer|professional|industry|years? of|fresher|entry[- ]level|junior|senior)\b|\bworked (?:at|for|with)\b/, experience],
  [/\b(?:achievements?|accomplishments?|awards?|prizes?|won|win|wins|winner|hackathons?|competitions?|contests?|challenges?|rank\w*|placings?|recognition|honou?rs?|trophies|medals?)\b/, achievements],
  [/\b(?:blogs?|articles?|writ(?:e|es|ing|ten)|posts?|publications?|published|medium|newsletter|tutorials?|builder center)\b/, writing],
  [/\b(?:github|git hub|repos?|repositor(?:y|ies)|source(?: code)?|code|open source|commits?)\b/, code],
  [/\b(?:projects?|portfolio|builds?|built|made|created|developed|apps?|products?|showcase|demos?|ship(?:ped)?)\b|\bwork(?:ed|ing)? on\b|\b(?:his|ibu'?s|recent|latest) work\b|\bwhat (?:has|did|does) (?:he|ibu|you) (?:build|make|create|ship|do)\b/, projects],
  [/\bwho(?:'s| is| are)\b|\bintroduc\w*|\b(?:tell me|talk) about (?:him|ibu|mohamed|this (?:guy|person|developer|student))\b|\babout (?:him|ibu|mohamed)\b|\bsummar(?:y|i[sz]e)\b|\btl ?;? ?dr\b|\boverview\b|\bbio\b|\bbackground\b|\belevator pitch\b|\bprofile\b|\b(?:full|his|ibu'?s) name\b|\bwhat (?:does|do|is) (?:he|ibu|mohamed) (?:do|like)\b|^(?:ibu|mohamed|mohammed|mohamed ibrahim(?: a)?|ibrahim)$/, who]
];

/** Chit's answer to a question, given what it remembers of the chat so far. */
export function answer(question: string, memory: Memory): Answer {
  const asked = question.slice(0, MAX_QUESTION).trim();
  const q = normalize(asked);
  if (!q) return help();
  if (INJECTION.test(q)) return injection(q);

  // A pasted job description, long or in lines: the job receipt reads those properly.
  if (asked.length > 280 || asked.split("\n").length >= 4) {
    const found = skillsIn(asked).length;
    if (found >= 4) return jobText(found);
  }

  const rest = q.replace(HELLO, "").replace(THANKS, "").trim();
  if (!rest) return HELLO.test(q) ? greet(q) : thanks(q);
  if (/^(?:thanks|thank (?:you|u)|thx|tysm|cheers)\b/.test(rest) && rest.split(" ").length <= 8) return thanks(q);
  if (BYE.test(rest)) return bye();
  if (ACK.test(rest)) return ack(rest);
  if (TESTING.test(rest)) return testing();

  for (const [pattern, reply] of EARLY) if (pattern.test(rest)) return reply(rest, memory);

  const claims = CATALOG.filter((claim) => ALIASES[claim.id].test(rest));
  const builds = BUILD_IDS.filter((id) => BUILD_FIND[id].test(rest));
  if (claims.length || builds.length) return named(claims, builds, rest, memory);

  const skills = skillsIn(asked);
  if (skills.length) {
    const generic = new Set(skills.map((skill) => GENERIC.get(skill.id)));
    const [only] = generic;
    if (generic.size === 1 && only) return only(rest, memory);
    return skillAnswer(skills);
  }

  const focus = memory.last ? focusOf(rest, FOLLOW) : null;
  if (memory.last && focus) return receipt(claimById(memory.last), focus, memory);

  for (const [pattern, reply] of RULES) if (pattern.test(rest)) return reply(rest, memory);
  return unknown(asked);
}

/** What Chit keeps between questions: the receipt in hand, and what it has printed. */
export function remember(memory: Memory, said: Answer): Memory {
  const small = said.topic === "thanks" || said.topic === "ack" || said.topic === "greet" || said.topic === "feeling";
  const last = said.about ?? (small ? memory.last : undefined);
  const shown = said.about ? new Set([...memory.shown, said.about]) : memory.shown;
  const kept: Memory = { shown, deployed: memory.deployed, recheck: memory.recheck, lastTopic: said.topic };
  return last ? { ...kept, last } : kept;
}
