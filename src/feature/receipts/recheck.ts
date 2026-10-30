/* Re-check: an AWS Lambda fetches a receipt's pinned evidence and checks it again, live. */
import { build } from "./build.ts";
import { isSiteClaim, type Numbered } from "./catalog.ts";
import { el, vh } from "./dom.ts";
import { ago } from "./format.ts";

/** What the Lambda answers. ok: null means "couldn't check right now", never "failed". */
interface Check {
  readonly label: string;
  readonly ok: boolean | null;
  readonly detail: string;
  readonly url?: string;
}

interface Result {
  readonly ok: boolean | null;
  readonly checks: readonly Check[];
  readonly checkedAt: string;
  readonly live?: { readonly job: number; readonly commit?: string };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** The API is ours, but the page still treats its answer as untrusted input. */
function parse(body: unknown): Result {
  if (!isRecord(body) || !Array.isArray(body["checks"])) throw new Error("Unexpected response");
  const checks: Check[] = body["checks"].filter(isRecord).map((c) => ({
    label: String(c["label"] ?? ""),
    ok: typeof c["ok"] === "boolean" ? c["ok"] : null,
    detail: String(c["detail"] ?? ""),
    ...(typeof c["url"] === "string" && /^https:\/\//.test(c["url"]) ? { url: c["url"] } : {})
  }));
  const live = isRecord(body["live"]) && typeof body["live"]["job"] === "number"
    ? { live: { job: body["live"]["job"], commit: String(body["live"]["commit"] ?? "") } }
    : {};
  return {
    ok: typeof body["ok"] === "boolean" ? body["ok"] : null,
    checks,
    checkedAt: String(body["checkedAt"] ?? ""),
    ...live
  };
}

const MARK = (ok: boolean | null): string => (ok === true ? "✓" : ok === false ? "✗" : "?");
const SAY = (ok: boolean | null): string => (ok === true ? "Passed: " : ok === false ? "Failed: " : "Not checked: ");

function summary(result: Result): string {
  const n = result.checks.length;
  const passed = result.checks.filter((c) => c.ok === true).length;
  const one = n === 1;
  if (result.ok === true) return one ? "✓ The check passed" : `✓ All ${n} checks passed`;
  if (result.ok === false) return one ? "✗ The check failed" : `✗ ${n - passed} of ${n} checks failed`;
  return one ? "? The check couldn't run right now" : "? Some checks couldn't run right now";
}

function render(claim: Numbered, result: Result): HTMLElement[] {
  const rows = result.checks.map((check) =>
    el("li", { "data-ok": String(check.ok) },
      el("span", { class: "rc-recheck__mark", "aria-hidden": "true", text: MARK(check.ok) }),
      vh(SAY(check.ok)),
      el("span", null,
        check.url ? el("a", { href: check.url, target: "_blank", rel: "noopener" }, check.label, vh(" (opens in a new tab)")) : check.label,
        el("span", { class: "rc-recheck__detail", text: ` — ${check.detail}` }))));

  // The page's own receipt: compare what AWS says is live with what this page was built from.
  if (isSiteClaim(claim) && result.live) {
    const page = Number.parseInt(build.job ?? "", 10);
    const liveCommit = result.live.commit ?? "";
    const same = page === result.live.job && (!liveCommit || (build.commit ?? "").startsWith(liveCommit.slice(0, 7)));
    rows.push(el("li", { "data-ok": String(same) },
      el("span", { class: "rc-recheck__mark", "aria-hidden": "true", text: same ? "✓" : "!" }),
      el("span", null, same
        ? "This page was built by that exact build."
        : page < result.live.job
          ? `AWS has a newer build (#${result.live.job}) than this page (#${page}). Reload to get it.`
          : `This page is build #${page}; AWS hasn't reported it as finished yet.`)));
  }

  return [
    el("p", { class: "rc-recheck__summary", "data-ok": String(result.ok) },
      summary(result),
      el("span", { class: "rc-recheck__when", text: ` · checked ${ago(result.checkedAt)} by AWS Lambda` })),
    el("ul", { class: "rc-recheck__list" }, rows)
  ];
}

export function recheckBlock(claim: Numbered, url: string): HTMLElement {
  const out = el("div", { class: "rc-recheck__out", "aria-live": "polite" });
  const button = el("button", { type: "button", class: "rc-btn" }, "Re-check with AWS Lambda");

  button.addEventListener("click", async () => {
    button.disabled = true;
    out.replaceChildren(el("p", { class: "rc-recheck__how", text: "Fetching the evidence and checking it again…" }));
    const timer = new AbortController();
    const timeout = setTimeout(() => timer.abort(), 9000);
    try {
      const response = await fetch(`${url}?id=${encodeURIComponent(claim.id)}`, { signal: timer.signal, cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      out.replaceChildren(...render(claim, parse(await response.json())));
    } catch {
      // The receipt never depends on the checker being up.
      out.replaceChildren(el("p", { class: "rc-recheck__how", text: "Couldn't reach the checker just now. The receipt above still stands on its own evidence." }));
    } finally {
      clearTimeout(timeout);
      button.disabled = false;
      button.textContent = "Re-check again";
    }
  });

  return el("section", { class: "rc-block rc-recheck" },
    el("h3", { class: "rc-label", text: "Re-check it yourself" }),
    el("p", { class: "rc-recheck__how", text: isSiteClaim(claim)
      ? "A Lambda asks the AWS Amplify API which build is live right now."
      : "A Lambda fetches this receipt's evidence from GitHub, at the pinned commit, and checks it again." }),
    button,
    out);
}
