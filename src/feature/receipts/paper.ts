/* What the printer prints: a claim's receipt, the itemized bill, and the shared paper parts. */
import { build, recheckUrl } from "./build.ts";
import { CATALOG, isSiteClaim, shownStatus, tally, TOTAL, type Numbered } from "./catalog.ts";
import { REPO, type ClaimId } from "./claims.ts";
import { coinRace } from "./coin.ts";
import { el, vh, type Kid } from "./dom.ts";
import { kb, pad, printedAt, utc } from "./format.ts";
import { recheckBlock } from "./recheck.ts";
import type { Evidence, Line } from "./types.ts";

export type StampKind = "verified" | "partial" | "self" | "local" | "itemized" | "audited";

const STAMP: Readonly<Record<StampKind, string>> = {
  verified: "Verified",
  partial: "Partial",
  self: "Self-reported",
  local: "Not deployed",
  itemized: "Itemized",
  audited: "Fully audited"
};

/** Where a receipt's back button leads. */
export type Back = "bill" | "job" | null;

export const rule = (): HTMLHRElement => el("hr", { class: "rc-rule" });

export function header(kind: string, back: Back): HTMLElement {
  return el("header", { class: "rc-head" },
    el("p", { class: "rc-brand", text: "Ibu's receipts" }),
    el("p", { class: "rc-meta", text: `${kind} · ${printedAt()}` }),
    back === "bill" && el("button", { type: "button", class: "rc-back", "data-rc-bill": true }, "← All receipts"),
    back === "job" && el("button", { type: "button", class: "rc-back", "data-rc-job-back": true }, "← Back to your job receipt"));
}

export function lineItems(lines: readonly Line[]): HTMLUListElement {
  return el("ul", { class: "rc-lines" }, lines.map((line) =>
    el("li", { class: "rc-line", "data-ok": line.ok === false ? "false" : null },
      el("span", { class: "rc-line__k", text: line.k }),
      el("span", { class: "rc-line__dots", "aria-hidden": "true" }),
      el("span", { class: "rc-line__v" },
        line.href ? el("a", { href: line.href, target: "_blank", rel: "noopener" }, line.v, vh(" (opens in a new tab)")) : line.v))));
}

export function evidenceList(list: readonly Evidence[]): HTMLUListElement {
  return el("ul", { class: "rc-evidence" }, list.map((item) =>
    el("li", null,
      el("a", { href: item.url, target: "_blank", rel: "noopener" },
        item.label,
        el("span", { "aria-hidden": "true", text: " ↗" }),
        vh(" (opens in a new tab)")))));
}

export const stamp = (kind: StampKind, text = STAMP[kind]): HTMLParagraphElement =>
  el("p", { class: "rc-stamp", "data-status": kind, text });

/** A decorative barcode, the same for the same seed. */
export function barcode(seed: string): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 160 30");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("class", "rc-barcode");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  for (let x = 4; x < 156;) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    const w = 1 + (h >>> 30);
    if (x + w > 156) break;
    const bar = document.createElementNS(NS, "rect");
    bar.setAttribute("x", String(x));
    bar.setAttribute("width", String(w));
    bar.setAttribute("height", "30");
    svg.append(bar);
    x += w + 1 + ((h >>> 27) & 1);
  }
  return svg;
}

export function foot(kind: StampKind, seed: string, thanks: string, ...extra: Kid[]): HTMLElement {
  return el("footer", { class: "rc-foot" }, stamp(kind), barcode(seed), el("p", { class: "rc-thanks", text: thanks }), extra);
}

// ---------- a claim's receipt ----------

function siteLines(): Line[] {
  if (!build.deployed) {
    const lines: Line[] = [
      { k: "Served from", v: "a local copy" },
      { k: "Amplify build", v: "none yet", ok: false }
    ];
    if (build.siteBytes) lines.push({ k: "Everything this site ships", v: kb(build.siteBytes) });
    return lines;
  }
  const lines: Line[] = [{ k: "Host", v: build.host ?? "AWS Amplify Hosting" }];
  if (build.siteUrl) lines.push({ k: "Domain", v: build.siteUrl.replace(/^https:\/\//, "") });
  if (build.branch) lines.push({ k: "Branch", v: build.branch });
  const job = Number.parseInt(build.job ?? "", 10);
  if (job) lines.push({ k: "Build", v: `#${job}` });
  if (build.commit) lines.push({ k: "Commit", v: build.commit.slice(0, 7), href: `${REPO}/commit/${build.commit}` });
  if (build.builtAt) lines.push({ k: "Built", v: utc(build.builtAt) });
  if (build.region) lines.push({ k: "Region", v: build.region });
  if (build.siteBytes) lines.push({ k: "Everything this site ships", v: kb(build.siteBytes) });
  return lines;
}

export function renderReceipt(claim: Numbered, back: Back): HTMLElement {
  const status = shownStatus(claim, build.deployed);
  const site = isSiteClaim(claim);
  const lines = site ? siteLines() : claim.lines;
  const evidence: readonly Evidence[] = site && build.deployed && build.commit
    ? [{ label: `This deploy's commit (${build.commit.slice(0, 7)})`, url: `${REPO}/commit/${build.commit}` }, ...claim.evidence]
    : claim.evidence;
  const coin = claim.status === "verified" ? claim.coin : undefined;

  return el("article", { class: "rc-paper", "data-status": status },
    header(`Receipt ${pad(claim.n)} of ${pad(TOTAL)}`, back),
    el("h2", { id: "rc-title", class: "rc-title", tabindex: "-1", text: claim.title }),
    el("p", { class: "rc-context", text: claim.context }),
    lineItems(lines),
    claim.measured && el("p", { class: "rc-measured" }, el("span", { class: "rc-label", text: "Measured " }), claim.measured),
    rule(),
    el("section", { class: "rc-block" },
      el("h3", { class: "rc-label", text: "Evidence" }),
      evidenceList(evidence)),
    rule(),
    el("section", { class: "rc-block rc-catch" },
      el("h3", { class: "rc-label", text: "The catch" }),
      el("p", { text: claim.catch }),
      coin !== undefined && coinRace(coin)),
    claim.correction && [
      rule(),
      el("section", { class: "rc-block rc-correction" },
        el("h3", { class: "rc-label", text: "Corrected" }),
        el("p", { text: claim.correction }))
    ],
    recheckUrl && [rule(), recheckBlock(claim, recheckUrl)],
    rule(),
    foot(status, claim.id, "Thank you. Check again soon.",
      el("a", { class: "rc-permalink", href: `#r-${claim.id}` }, "Link to this receipt")));
}

// ---------- the itemized bill ----------

export function renderBill(checked: ReadonlySet<ClaimId>, highlightOn: boolean): HTMLElement {
  const t = tally(build.deployed);
  const done = checked.size === TOTAL;
  const totals: Line[] = [
    { k: "Claims on this page", v: String(TOTAL) },
    { k: "Backed by public proof", v: String(t.verified) },
    { k: "Partial receipts", v: String(t.partial) },
    { k: "Self-reported", v: String(t.self) }
  ];
  if (t.local) totals.push({ k: "Not deployed (local copy)", v: String(t.local), ok: false });
  totals.push(
    { k: "Write-ups my code corrected", v: String(t.corrections) },
    { k: "Invented facts", v: "0" }
  );

  return el("article", { class: "rc-paper", "data-status": done ? "audited" : "itemized" },
    header("Itemized bill", null),
    el("h2", { id: "rc-title", class: "rc-title", tabindex: "-1", text: "Everything this page claims" }),
    el("p", { class: "rc-context", text: "Every receipt shows its evidence and its catch." }),
    lineItems(totals),
    rule(),
    el("p", { class: "rc-label", id: "rc-progress-label", text: `Audited by you: ${checked.size} of ${TOTAL}` }),
    el("progress", { class: "rc-progress", max: TOTAL, value: checked.size, "aria-labelledby": "rc-progress-label" }),
    rule(),
    el("h3", { class: "rc-label", text: "Items · pick one to print" }),
    el("ol", { class: "rc-items" }, CATALOG.map((claim) =>
      el("li", null,
        el("button", { type: "button", class: "rc-item", "data-rc-open": claim.id },
          el("span", { class: "rc-item__n", text: pad(claim.n) }),
          el("span", { class: "rc-item__k", text: claim.label }),
          el("span", { class: "rc-line__dots", "aria-hidden": "true" }),
          el("span", { class: "rc-item__v", "data-done": checked.has(claim.id) || null, "aria-hidden": "true", text: checked.has(claim.id) ? "✓" : "·" }),
          vh(checked.has(claim.id) ? ", checked" : ", not checked yet"))))),
    rule(),
    el("div", { class: "rc-actions" },
      el("button", { type: "button", class: "rc-btn rc-btn--ink", "data-rc-job": true }, "Print a receipt for your job"),
      el("button", { type: "button", class: "rc-btn", "data-rc-highlight": true, "aria-pressed": String(highlightOn) }, "Highlight claims on the page"),
      el("button", { type: "button", class: "rc-btn", "data-rc-random": true }, "Print a random one"),
      checked.size > 0 && el("button", { type: "button", class: "rc-btn", "data-rc-reset": true }, "Reset my audit")),
    rule(),
    lineItems([{ k: "Trust required", v: "₹0.00" }]),
    foot(done ? "audited" : "itemized", "bill", "Thank you. Visit again."));
}
