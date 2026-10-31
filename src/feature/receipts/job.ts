/*
  The job receipt: paste a job description (or pick a sample) and the printer
  itemizes it against what I can prove. The first reading happens in the browser
  and sends nothing anywhere. A visitor can then ask a model on Bedrock to read
  it closer; that sends the text to AWS once, and nothing is stored or logged.
*/
import { deployCommit } from "./build.ts";
import { claimById } from "./catalog.ts";
import type { ClaimId } from "./claims.ts";
import { el, vh, type Kid } from "./dom.ts";
import { plural } from "./format.ts";
import { evidenceLink, MAX_CHARS, READ_MAX_CHARS, receiptText, type JobLine, type JobReceipt, type Priority } from "./match.ts";
import { barcode, header, lineItems, rule, stamp } from "./paper.ts";
import { PROJECTS } from "./projects.ts";
import { ROLES } from "./roles.ts";
import type { ProofKind } from "./skills.ts";
import { unreachable } from "./types.ts";

const EMAIL = "ibrahimanees.work@gmail.com";

const STATUS: Readonly<Record<ProofKind, string>> = { proven: "Proven", partial: "Partial", none: "No receipt" };
const MARK: Readonly<Record<ProofKind, string>> = { proven: "✓", partial: "~", none: "✗" };
const SECTION: Readonly<Record<Priority, string>> = { must: "Must have", nice: "Nice to have" };

export interface JobHandlers {
  /** Print a receipt for this description. */
  readonly print: (description: string) => void;
}

export interface ReceiptHandlers {
  /** Ask the model on Bedrock to read the description closer; rejects if it can't. Null hides the offer. */
  readonly readWithModel: (() => Promise<void>) | null;
}

// ---------- the form ----------

export function renderJobForm(draft: string, handlers: JobHandlers): HTMLElement {
  const status = el("p", { class: "rc-job__status", "aria-live": "polite" });
  const text = el("textarea", {
    id: "rc-job-text",
    class: "rc-textarea",
    rows: 8,
    maxlength: MAX_CHARS,
    spellcheck: "false",
    "aria-describedby": "rc-job-privacy"
  });
  text.value = draft;

  const form = el("form", { class: "rc-job-form", novalidate: true },
    el("label", { class: "rc-label", for: "rc-job-text", text: "Or paste a job description" }),
    text,
    el("p", { class: "rc-job__hint", id: "rc-job-privacy", text: "Read right here in your browser. Nothing is sent or saved." }),
    el("button", { type: "submit", class: "rc-btn rc-btn--ink" }, "Print my receipt"),
    status);

  const submit = (): void => {
    const description = text.value.trim();
    if (!description) {
      status.textContent = "Paste a job description first, or pick a sample above.";
      text.focus();
      return;
    }
    handlers.print(description);
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submit();
  });
  text.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      submit();
    }
  });

  return el("article", { class: "rc-paper", "data-status": "itemized" },
    header("Job receipt", "bill"),
    el("h2", { id: "rc-title", class: "rc-title", tabindex: "-1", text: "A receipt for your job" }),
    el("p", { class: "rc-context", text: "Paste a job description, or try a sample. I'll itemize what I can prove for each requirement, and what I can't." }),
    rule(),
    el("p", { class: "rc-label", id: "rc-job-samples", text: "Try a sample" }),
    el("div", { class: "rc-actions", role: "group", "aria-labelledby": "rc-job-samples" },
      ROLES.map((role) => el("button", { type: "button", class: "rc-btn", "data-rc-job-sample": role.id }, role.label))),
    el("p", { class: "rc-job__hint", text: "Samples are descriptions I wrote for this demo, not real postings." }),
    rule(),
    form,
    rule(),
    el("footer", { class: "rc-foot" },
      barcode("job"),
      el("p", { class: "rc-thanks", text: "Thank you. Hire responsibly." })));
}

// ---------- the printed receipt ----------

function proofOf(line: JobLine): Kid {
  const proof = line.skill.proof;
  switch (proof.kind) {
    case "proven": {
      const claims = new Set<ClaimId>();
      const links = proof.evidence.map((evidence) => {
        if (evidence.kind === "file") {
          const project = PROJECTS[evidence.project];
          if ("claim" in project) claims.add(project.claim);
        }
        const { label, url } = evidenceLink(evidence, deployCommit);
        return el("li", null,
          el("a", { href: url, target: "_blank", rel: "noopener" }, label, el("span", { "aria-hidden": "true", text: " ↗" }), vh(" (opens in a new tab)")));
      });
      return [
        el("ul", { class: "rc-job__proof" }, links),
        claims.size > 0 && receiptsFor([...claims])
      ];
    }
    case "partial":
      return [
        el("p", { class: "rc-job__note", text: proof.note }),
        proof.evidence && proof.evidence.length > 0 && el("ul", { class: "rc-job__proof" }, proof.evidence.map((evidence) =>
          el("li", null, el("a", { href: evidence.url, target: "_blank", rel: "noopener" }, evidence.label, el("span", { "aria-hidden": "true", text: " ↗" }), vh(" (opens in a new tab)"))))),
        proof.claim && receiptsFor([proof.claim])
      ];
    case "none":
      return el("p", { class: "rc-job__note", text: `${proof.note} I won't claim this.` });
    default:
      return unreachable(proof);
  }
}

/** Buttons that print the page's own receipts behind a line. */
function receiptsFor(ids: readonly ClaimId[]): HTMLElement {
  return el("p", { class: "rc-job__receipts" },
    el("span", { text: ids.length === 1 ? "Receipt:" : "Receipts:" }),
    ids.map((id) => el("button", { type: "button", class: "claim", "data-rc-open": id }, claimById(id).label, vh(", show receipt"))));
}

/** The description's own words for a line, shown when a model did the reading. */
const quoted = (said: string): HTMLParagraphElement => el("p", { class: "rc-job__quote", text: `“${said}”` });

function jobLine(line: JobLine, byModel: boolean): HTMLLIElement {
  const kind = line.skill.proof.kind;
  return el("li", { class: "rc-job__item", "data-proof": kind },
    el("p", { class: "rc-line rc-job__line" },
      el("span", { class: "rc-job__mark", "aria-hidden": "true", text: MARK[kind] }),
      el("span", { class: "rc-line__k", text: line.skill.label }),
      el("span", { class: "rc-line__dots", "aria-hidden": "true" }),
      el("span", { class: "rc-line__v", text: STATUS[kind] })),
    byModel && quoted(line.said),
    proofOf(line));
}

/** The offer to have a model on Bedrock read the description closer. */
function readCloser(readWithModel: () => Promise<void>, truncated: boolean): HTMLElement {
  const status = el("p", { class: "rc-job__status", "aria-live": "polite" });
  const button = el("button", { type: "button", class: "rc-btn rc-btn--ink" }, "Read it with Amazon Bedrock");
  button.addEventListener("click", async () => {
    button.disabled = true;
    status.textContent = "Amazon Nova Micro is reading the description…";
    try {
      await readWithModel(); // prints the closer reading in place of this receipt
    } catch {
      status.textContent = "Bedrock couldn't read it just now. The receipt above is my browser's own reading.";
      button.disabled = false;
    }
  });
  return el("section", { class: "rc-block rc-model" },
    el("h3", { class: "rc-label", text: "Read it closer" }),
    el("p", { class: "rc-job__hint", text: `My browser only knows the words on my skill map. Amazon Nova Micro on Bedrock reads the whole description, including requirements outside the map, but it can only quote your text and point at skills I can show you. This sends the description${truncated ? ` (its first ${READ_MAX_CHARS.toLocaleString("en")} characters)` : ""} to AWS once; nothing is stored or logged.` }),
    button,
    status);
}

export function renderJobReceipt(receipt: JobReceipt, pageUrl: string, handlers: ReceiptHandlers): HTMLElement {
  const { lines, tally, unmapped, readBy } = receipt;
  const role = receipt.title || "your role";
  const byModel = readBy.kind === "model";
  const kind = byModel ? `Job receipt, read by ${readBy.model}` : "Job receipt";
  const offer = handlers.readWithModel && !byModel ? [rule(), readCloser(handlers.readWithModel, receipt.truncated)] : null;

  if (!lines.length && !unmapped.length) {
    return el("article", { class: "rc-paper", "data-status": "itemized" },
      header(kind, "bill"),
      el("h2", { id: "rc-title", class: "rc-title", tabindex: "-1", text: "Nothing I recognise yet" }),
      el("p", { class: "rc-context", text: byModel
        ? "The model found no requirements in that text. Paste the requirements section of a job description, or try a sample."
        : "I couldn't find any skills I know in that text. Paste the requirements section of a job description, or try a sample." }),
      offer,
      rule(),
      el("div", { class: "rc-actions" },
        el("button", { type: "button", class: "rc-btn rc-btn--ink", "data-rc-job": true }, "Try again")),
      rule(),
      el("footer", { class: "rc-foot" }, barcode("job-empty"), el("p", { class: "rc-thanks", text: "Thank you. Hire responsibly." })));
  }

  const copyStatus = el("p", { class: "rc-job__status", "aria-live": "polite" });
  const copy = el("button", { type: "button", class: "rc-btn" }, "Copy as text");
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(receiptText(receipt, pageUrl, deployCommit));
      copyStatus.textContent = "Copied. Paste it into your notes.";
    } catch {
      copyStatus.textContent = "Your browser blocked copying. Select the receipt and copy it instead.";
    }
  });

  const sections = (["must", "nice"] as const).map((priority) => {
    const group = lines.filter((line) => line.priority === priority);
    return group.length > 0 && [
      rule(),
      el("section", { class: "rc-block", "aria-labelledby": `rc-job-${priority}` },
        el("h3", { class: "rc-label", id: `rc-job-${priority}`, text: `${SECTION[priority]} · ${group.length}` }),
        el("ol", { class: "rc-job" }, group.map((line) => jobLine(line, byModel))))
    ];
  });

  const outside = unmapped.length > 0 && [
    rule(),
    el("section", { class: "rc-block", "aria-labelledby": "rc-job-unmapped" },
      el("h3", { class: "rc-label", id: "rc-job-unmapped", text: `Not on my skill map · ${unmapped.length}` }),
      el("ol", { class: "rc-job" }, unmapped.map((item) =>
        el("li", { class: "rc-job__item", "data-proof": "unmapped" },
          el("p", { class: "rc-line rc-job__line" },
            el("span", { class: "rc-job__mark", "aria-hidden": "true", text: "?" }),
            el("span", { class: "rc-line__k", text: item.quote }),
            el("span", { class: "rc-line__dots", "aria-hidden": "true" }),
            el("span", { class: "rc-line__v", text: "Ask me" })),
          el("p", { class: "rc-job__note", text: item.priority === "nice" ? "A nice-to-have I can't map to proof yet." : "Not something I can point you to proof for here." })))))
  ];

  const share = lines.length ? tally.proven / lines.length : 0;
  const subject = encodeURIComponent(`Your job receipt: ${role}`);
  const context = byModel
    ? `${readBy.model} read it${readBy.ms > 0 ? ` in ${(readBy.ms / 1000).toFixed(1)} s` : ""}: ${plural(lines.length, "requirement")} on my skill map${unmapped.length ? `, ${unmapped.length} outside it` : ""}. Every line quotes your description.`
    : `I recognised ${plural(lines.length, "requirement")}${receipt.truncated ? `, reading the first ${MAX_CHARS.toLocaleString("en")} characters` : ""}.`;

  return el("article", { class: "rc-paper", "data-status": "itemized" },
    header(kind, "bill"),
    el("h2", { id: "rc-title", class: "rc-title", tabindex: "-1", text: `Receipt for: ${role}` }),
    el("p", { class: "rc-context", text: context }),
    sections,
    outside,
    offer,
    rule(),
    lineItems([
      { k: "Proven, with public code", v: String(tally.proven) },
      { k: "Partial", v: String(tally.partial), ...(tally.partial ? { ok: false as const } : {}) },
      { k: "No receipt", v: String(tally.none), ...(tally.none ? { ok: false as const } : {}) },
      { k: "Invented to fit your job", v: "0" }
    ]),
    rule(),
    el("p", { class: "rc-job__hint", text: byModel
      ? "Every ✓ links to public code. Every ✗ is a gap I won't paper over. The model only picked lines; every proof on this receipt was already on my page."
      : "Every ✓ links to public code. Every ✗ is a gap I won't paper over. I only itemize skills I recognise; for anything else in your description, ask me." }),
    el("div", { class: "rc-actions" },
      copy,
      el("a", { class: "rc-btn", href: `mailto:${EMAIL}?subject=${subject}` }, "Email me about this role"),
      el("button", { type: "button", class: "rc-btn", "data-rc-job": true }, "Try another")),
    copyStatus,
    rule(),
    el("footer", { class: "rc-foot" },
      stamp(share >= 0.5 ? "verified" : "partial", `${tally.proven} of ${lines.length} proven`),
      barcode(`job-${role}`),
      el("p", { class: "rc-thanks", text: "Thank you. Hire responsibly." })));
}
