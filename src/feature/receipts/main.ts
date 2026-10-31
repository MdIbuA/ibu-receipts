/*
  Receipts: every underlined claim on the page prints a receipt with its
  evidence, how it was measured, and the catch. A recruiter can also print a
  receipt for their own job description.

  Progressive enhancement. Without JavaScript each claim is a plain link to its
  evidence. With it, claims become buttons that print into a non-modal panel
  docked bottom-right, so the page and its navigation stay usable underneath.
*/
import { loadAudit, saveAudit } from "./audit.ts";
import { build } from "./build.ts";
import { CATALOG, claimById, isClaimId, tally, TOTAL } from "./catalog.ts";
import type { ClaimId } from "./claims.ts";
import { closest, el, vh } from "./dom.ts";
import { renderJobForm, renderJobReceipt } from "./job.ts";
import { readJob, type JobReceipt } from "./match.ts";
import { renderBill, renderReceipt, type Back } from "./paper.ts";
import { createPrinter } from "./printer.ts";
import { ROLES, type RoleId } from "./roles.ts";
import { printStubOnce, stampDeploy } from "./stub.ts";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const narrow = window.matchMedia("(max-width: 40em)");

/** What the printer shows right now. */
type Current = ClaimId | "bill" | "job" | null;
let current: Current = null;

const checked = loadAudit();

/** The job description being worked on, and its last printed receipt, kept in memory only. */
let draft = "";
let lastJob: JobReceipt | null = null;

const printer = createPrinter({
  reduceMotion,
  narrow,
  onClose: () => {
    current = null;
    syncExpanded();
  }
});

// ---------- claims become buttons ----------

for (const link of document.querySelectorAll<HTMLAnchorElement>("a.claim[data-claim]")) {
  const id = link.dataset["claim"];
  if (!isClaimId(id)) continue;
  const button = el("button", {
    type: "button",
    class: link.className,
    "data-claim": id,
    "aria-haspopup": "dialog",
    "aria-controls": "rc-panel",
    "aria-expanded": "false"
  }, [...link.childNodes], vh(", show receipt"));
  link.replaceWith(button);
}

// ---------- printing ----------

function openReceipt(id: ClaimId, trigger: HTMLElement | null, moveFocus = true, back: Back = "bill"): void {
  current = id;
  printer.show(renderReceipt(claimById(id), back), trigger, moveFocus);
  if (!checked.has(id)) {
    checked.add(id);
    saveAudit(checked);
  }
  syncExpanded();
  syncCounts();
}

function openBill(trigger: HTMLElement | null, moveFocus = true): void {
  current = "bill";
  printer.show(renderBill(checked, document.documentElement.classList.contains("rc-highlight")), trigger, moveFocus);
  syncExpanded();
}

function openJobForm(trigger: HTMLElement | null, moveFocus = true): void {
  current = "job";
  printer.show(renderJobForm(draft, { print: (description) => printJob(description, null) }), trigger, moveFocus);
  syncExpanded();
}

function printJob(description: string, trigger: HTMLElement | null, moveFocus = true): void {
  draft = description;
  lastJob = readJob(description);
  showLastJob(trigger, moveFocus);
}

function showLastJob(trigger: HTMLElement | null, moveFocus = true): void {
  if (!lastJob) return openJobForm(trigger, moveFocus);
  current = "job";
  const pageUrl = `${build.siteUrl || location.origin + location.pathname.replace(/index\.html$/, "")}`.replace(/\/?$/, "/#job");
  printer.show(renderJobReceipt(lastJob, pageUrl), trigger, moveFocus);
  syncExpanded();
}

function printSample(id: RoleId, trigger: HTMLElement | null, moveFocus = true): void {
  const role = ROLES.find((r) => r.id === id);
  if (role) printJob(role.text, trigger, moveFocus);
}

const isRoleId = (id: unknown): id is RoleId => ROLES.some((role) => role.id === id);

// The first-screen shortcut: print the CryptoPulse receipt and race a coin against the model.
function betAgainstModel(trigger: HTMLElement): void {
  openReceipt("cryptopulse", trigger);
  const race = printer.slot.querySelector(".rc-coin");
  if (!race) return;
  const start = (): void => {
    printer.slot.scrollTop += race.getBoundingClientRect().top - printer.slot.getBoundingClientRect().top - 12;
    race.querySelector<HTMLButtonElement>(".rc-btn")?.click();
  };
  if (reduceMotion.matches) start();
  else setTimeout(start, 1000); // let the paper finish feeding out first
}

// ---------- keeping the page in sync ----------

function syncExpanded(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>("button.claim[data-claim]")) {
    const id = button.dataset["claim"] ?? "";
    button.setAttribute("aria-expanded", String(id === current));
    button.toggleAttribute("data-checked", isClaimId(id) && checked.has(id));
  }
}

function syncCounts(): void {
  const t = tally(build.deployed);
  const set = (selector: string, value: number): void => {
    for (const node of document.querySelectorAll(selector)) node.textContent = String(value);
  };
  set("[data-rc-total]", TOTAL);
  set("[data-rc-verified]", t.verified);
  set("[data-rc-corrections]", t.corrections);
  set("[data-rc-checked]", checked.size);
  printer.tabCount.replaceChildren(`${checked.size}/${TOTAL}`, vh(" audited"));
  printer.tab.classList.toggle("is-done", checked.size === TOTAL);
}

function setHighlight(on: boolean): void {
  document.documentElement.classList.toggle("rc-highlight", on);
  for (const button of document.querySelectorAll("[data-rc-highlight]")) button.setAttribute("aria-pressed", String(on));
}

// ---------- events ----------

document.addEventListener("click", (event) => {
  const { target } = event;
  const inPanel = target instanceof Node && printer.panel.contains(target);

  const claimButton = closest(target, "button.claim[data-claim]");
  const claimId = claimButton?.dataset["claim"];
  if (claimButton && isClaimId(claimId)) return openReceipt(claimId, claimButton);

  const item = closest(target, "[data-rc-open]");
  const itemId = item?.dataset["rcOpen"];
  if (item && isClaimId(itemId)) {
    // From a job receipt, a claim's receipt offers the way back to it.
    return openReceipt(itemId, inPanel ? printer.tab : item, true, inPanel && current === "job" ? "job" : "bill");
  }

  const bill = closest(target, "[data-rc-bill]");
  if (bill) return openBill(inPanel ? printer.tab : bill);

  const job = closest(target, "[data-rc-job]");
  if (job) return openJobForm(inPanel ? printer.tab : job);

  if (closest(target, "[data-rc-job-back]")) return showLastJob(printer.tab);

  const sample = closest(target, "[data-rc-job-sample]");
  const sampleId = sample?.dataset["rcJobSample"];
  if (sample && isRoleId(sampleId)) return printSample(sampleId, inPanel ? printer.tab : sample);

  const bet = closest(target, "[data-rc-bet]");
  if (bet) return betAgainstModel(bet);

  const highlight = closest(target, "[data-rc-highlight]");
  if (highlight) return setHighlight(highlight.getAttribute("aria-pressed") !== "true");

  if (closest(target, "[data-rc-random]")) {
    const pool = CATALOG.filter((claim) => !checked.has(claim.id));
    const from = pool.length ? pool : CATALOG;
    const pick = from[Math.floor(Math.random() * from.length)];
    if (pick) openReceipt(pick.id, printer.tab);
    return;
  }

  if (closest(target, "[data-rc-reset]")) {
    checked.clear();
    saveAudit(checked);
    syncExpanded();
    syncCounts();
    return openBill(printer.tab);
  }

  // On a phone the sheet is tall: get it out of the way when someone navigates.
  const jump = closest<HTMLAnchorElement>(target, 'a[href^="#"]');
  const href = jump?.getAttribute("href") ?? "";
  if (jump && narrow.matches && !inPanel && !/^#(?:r-|job|receipts)/.test(href)) printer.close(false);
});

printer.tab.addEventListener("click", () => (current === "bill" ? printer.close() : openBill(printer.tab)));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && printer.isOpen()) {
    event.preventDefault();
    printer.close();
  }
});

// ---------- the hero stub ----------

const deploySlot = document.querySelector("[data-rc-deploy]");
if (deploySlot) stampDeploy(deploySlot);
const stub = document.querySelector<HTMLElement>(".stub");
if (stub) printStubOnce(stub, reduceMotion);

// ---------- deep links ----------
// #r-<id> prints that receipt, #receipts the bill, #job the job form, #job-<sample> a sample's receipt.

function fromHash(onLoad: boolean): void {
  const hash = location.hash;
  const receipt = /^#r-([\w-]+)$/.exec(hash)?.[1];
  const sample = /^#job-([\w-]+)$/.exec(hash)?.[1];
  if (isClaimId(receipt)) {
    if (current !== receipt) openReceipt(receipt, null, !onLoad);
  } else if (hash === "#receipts") {
    openBill(null, !onLoad);
  } else if (hash === "#job") {
    openJobForm(null, !onLoad);
  } else if (isRoleId(sample)) {
    printSample(sample, null, !onLoad);
  }
}
window.addEventListener("hashchange", () => fromHash(false));

syncExpanded();
syncCounts();
fromHash(true);
