/*
  What the page itself says, for Chit to quote word for word. Chit never
  paraphrases: test/chat.test.ts checks that every line and link below still
  appears on site/index.html exactly as written, so if the page changes, the
  build stops until the quote changes with it.
*/
import type { ClaimId } from "./claims.ts";

export interface Quote {
  readonly text: string;
  /** The part of the page it's quoted from, as Chit prints it. */
  readonly from: string;
  /** Where that part is, when it has an anchor. */
  readonly at?: string;
}

export interface Link {
  readonly label: string;
  readonly url: string;
}

const hero = (text: string): Quote => ({ text, from: "The top of the page", at: "#main" });
const about = (text: string): Quote => ({ text, from: "About me", at: "#about" });
const powers = (text: string): Quote => ({ text, from: "Tech superpowers", at: "#superpowers" });
const projects = (text: string): Quote => ({ text, from: "Projects & achievements", at: "#projects" });
const contact = (text: string): Quote => ({ text, from: "Contact", at: "#contact" });

export const QUOTES = {
  name: hero("Mohamed Ibrahim A. “Ibu” · Software & AI engineer · Coimbatore, India"),
  lede: hero("I'm a final-year IT student shipping AI agents and serverless apps on AWS. Most portfolios ask you to take their word for it. This one prints a receipt for every claim, including the numbers that make me look worse."),
  howToRead: hero("Each of the 14 underlined claims on this page prints a receipt: the evidence, how it was measured, and the catch."),
  bestLooking: hero("Start with my best-looking number, R² 0.94."),

  place: about("Ibu · Coimbatore, Tamil Nadu"),
  drawnTo: about("I'm drawn to the gap between a demo and something you can trust."),
  intro: about("I'm Ibu, a final-year B.Tech Information Technology student in Coimbatore, graduating in June 2027. I build AI agents and serverless apps on AWS, often in public and often against a weekend deadline."),
  rule: about("My Supermarket agent is never allowed to invent a price: every number comes out of Postgres through a tool. This page holds my claims to the same rule."),
  corrected: about("Writing these receipts caught four places where my own write-ups disagreed with my code. Those receipts print the corrected facts."),
  offTheClock: about("Off the clock I'm into quantum computing. I organized an IBM Qiskit Fall Fest workshop on quantum algorithms."),
  ground: about("Ground the model. Facts come from data and tools, never from the model's memory."),
  publish: about("Publish the number that hurts. An R² of 0.94 means little without the 47.93% beside it."),
  ownLoop: about("Own the loop. Fifty lines I can debug beat a framework I can't."),

  powersIntro: powers("Four things I'm reliably good at, each with proof attached."),
  agents: powers("Tool-calling agents whose facts come from a database or an API, plus guardrails that stop injected instructions."),
  serverless: powers("Event-driven backends with least-privilege IAM, defined as code instead of console clicks."),
  fullStack: powers("Apps whose totals reconcile to the paisa: integer money, row locks, idempotent handlers, and tests that pin it all down."),
  honestMl: powers("Models tested on unseen, time-ordered data, with the unflattering metric printed next to the flattering one."),
  fluent: powers("Python · JavaScript · TypeScript · SQL & PL/SQL · Docker · GitHub Actions · Google Cloud Run · Firebase"),
  studied: powers("Java · C · C++ · Kubernetes · Azure · BigQuery · Snowflake"),

  projectsIntro: projects("Six featured builds, the rest in brief, then the record."),
  supermarket: projects("A neighbourhood store run entirely from Telegram: billing, stock, credit ledgers (khata) and GST invoices, with Claude choosing from 30 typed tools backed by Postgres."),
  documind: projects("Upload a PDF and get a summary, grounded Q&A, entities, tone and a two-document comparison, built in a weekend on Amazon Bedrock and Lambda."),
  tripwire: projects("Before an agent sends or shares anything, a small model asks one question, “did the user actually ask for this?”, without ever reading the injected text. It answers in ~0.2 s."),
  ghostprobe: projects("On a versioned S3 bucket, “deleted” only adds a delete marker. This read-only tool lets an agent see every hidden version, and it turned a COMPLETE deletion verdict into INCOMPLETE."),
  gitbard: projects("Every Friday, a Lambda gathers my week's commits and emails them back as a fantasy chronicle written by Amazon Nova. Bug fixes become slain bugbears."),
  cryptopulse: projects("A crypto forecasting platform that shows how far to trust each forecast. Its LSTM scores R² 0.94 on unseen data, which is less impressive than it sounds."),
  votersaathi: projects("A non-partisan election guide in 12 Indian languages: a rule-based flow for structure, an LLM for free-form questions (free OpenRouter models first, Gemini as the fallback)."),
  celebrai: projects("An event planner whose budget engine works in integer paise, so every allocation adds up exactly. An LLM suggests; a schema gate decides."),
  tinytale: projects("A choose-your-own-adventure where every branch is generated live by a model on Bedrock, behind API Gateway and Lambda."),
  ecotrack: projects("A carbon-footprint tracker with a multi-step calculator and Gemini coaching."),
  unileave: projects("Two campus workflow apps for leave approvals and grievance tracking, with role-based modules and dashboards."),
  crisis: projects("A RAG prototype that retrieves the relevant safety protocol before it drafts guidance, for a human responder to act on. Code not public."),
  bones: projects("Knee X-rays sorted into normal, osteopenia and osteoporosis with fine-tuned Xception and MobileNet, plus Grad-CAM to check what the network looked at. No accuracy quoted until the evaluation is public."),
  voice: projects("A multilingual interface for an Alzheimer's voice-analysis workflow. The analysis layer is still simulated; no model has been trained yet."),
  challenges: projects("Three AWS Builder Center challenges: the Weekend Showcase (DocuMind AI, Aug 2026), “Set Your Creative App Free” (The Git Bard) and “Give your Agent a Tool” (Ghost Probe, Oct 2026). Plus HackerRank Orchestrate rounds, Aug–Oct 2026."),
  experience: projects("Three internships: AI Intern at Infosys Springboard (Batch 5), Backend AI Engineer Intern at FlyRank AI, and MERN Stack Developer Intern in the AICTE program."),
  community: projects("AWS Student Builder Campus Leader and Microsoft Learn Student Ambassador (Associate)."),
  writes: projects("I write on AWS Builder Center."),
  education: projects("B.Tech, Information Technology, Coimbatore. Graduating June 2027."),

  hiring: contact("Hiring for software or AI engineering, or have a hard problem worth prototyping? Email is fastest."),
  footer: { text: "Hand-built with HTML, CSS and a little TypeScript, deployed on AWS Amplify. No trackers.", from: "The footer" }
} as const satisfies Readonly<Record<string, Quote>>;

export type QuoteId = keyof typeof QUOTES;

/** Where each receipt's claim sits on the page, in the page's own words. */
export const ON_PAGE: Readonly<Record<ClaimId, QuoteId>> = {
  cryptopulse: "cryptopulse",
  supermarket: "supermarket",
  documind: "documind",
  tripwire: "tripwire",
  ghostprobe: "ghostprobe",
  gitbard: "gitbard",
  votersaathi: "votersaathi",
  celebrai: "celebrai",
  tinytale: "tinytale",
  roles: "community",
  internships: "experience",
  hackerrank: "challenges",
  qiskit: "offTheClock",
  site: "footer"
};

/** The four superpowers, each with the receipt its proof line opens. */
export const POWERS = [
  { title: "Agents that don't make things up", claim: "tripwire" },
  { title: "Serverless on AWS", claim: "gitbard" },
  { title: "Money-grade full-stack", claim: "celebrai" },
  { title: "Honest ML", claim: "cryptopulse" }
] as const satisfies readonly { readonly title: string; readonly claim: ClaimId }[];

/** The builds the page describes in brief, with no receipt of their own. */
export const BUILDS = {
  ecotrack: { name: "EcoTrack AI", quote: "ecotrack", link: { label: "Source", url: "https://github.com/MdIbuA/Ecotrack-AI" } },
  unileave: { name: "UniLeave & GrievanceHub", quote: "unileave", link: { label: "Source", url: "https://github.com/MdIbuA/unileave-student-leave-management" } },
  crisis: { name: "Crisis Response Coordinator", quote: "crisis", link: { label: "Demo video", url: "https://youtu.be/Vp-1W_Ry3mM" } },
  bones: { name: "Bone density classification", quote: "bones" },
  voice: { name: "Voice screening UI", quote: "voice", link: { label: "Source", url: "https://github.com/MdIbuA/Alzheimer-s-analysis" } }
} as const satisfies Readonly<Record<string, { readonly name: string; readonly quote: QuoteId; readonly link?: Link }>>;

export type BuildId = keyof typeof BUILDS;

/** The page's contact address. */
export const EMAIL = "ibrahimanees.work@gmail.com";

/** Links the page carries, by name. The résumé's are relative, like the page's. */
export const LINKS = {
  github: { label: "GitHub", url: "https://github.com/MdIbuA" },
  linkedin: { label: "LinkedIn", url: "https://www.linkedin.com/in/mohamedibrahimbinabdullah" },
  builder: { label: "AWS Builder Center", url: "https://builder.aws.com/community/@abufawaz" },
  youtube: { label: "YouTube", url: "https://www.youtube.com/@MohamedIbrahimAbdullahIn" },
  source: { label: "This site's source", url: "https://github.com/MdIbuA/ibu-receipts" },
  resume: { label: "Résumé, with receipts", url: "resume/" },
  pdf: { label: "The résumé as a PDF", url: "resume/Mohamed-Ibrahim-A-resume.pdf" }
} as const satisfies Readonly<Record<string, Link>>;
