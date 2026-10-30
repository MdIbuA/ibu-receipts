/* The hero stub: its deploy stamp, and printing itself out of the slot on first view. */
import { build } from "./build.ts";
import { el, vh } from "./dom.ts";

const STUB_KEY = "ibu-receipts:stub-printed";

/** "Live on AWS Amplify · build #9 · commit abc1234", a button that prints the page's own receipt. */
export function stampDeploy(slot: Element): void {
  const job = Number.parseInt(build.job ?? "", 10);
  const facts = [job ? `build #${job}` : "", build.commit ? `commit ${build.commit.slice(0, 7)}` : ""].filter(Boolean).join(" · ");
  slot.replaceChildren(build.deployed
    ? el("button", { type: "button", class: "stub__deploy", "data-rc-open": "site" },
        el("span", { class: "stub__deploy-head", text: "Live on AWS Amplify" }),
        el("span", { class: "stub__deploy-sub", text: facts }),
        vh(", show the receipt AWS wrote for this deploy"))
    : el("p", { class: "stub__deploy stub__deploy--local" },
        el("span", { class: "stub__deploy-head", text: "Local copy" }),
        el("span", { class: "stub__deploy-sub", text: "not deployed yet" })));
}

/** The first time the stub is on screen, it feeds out of the printer slot. Once per browser. */
export function printStubOnce(stub: HTMLElement, reduceMotion: MediaQueryList): void {
  const printedFor = stub.querySelector("[data-rc-printed]");
  if (printedFor) {
    const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date());
    printedFor.textContent = `Printed for you at ${time}`;
  }

  let seen = false;
  try {
    seen = localStorage.getItem(STUB_KEY) === "1";
  } catch {
    // Storage blocked: the stub just prints on every visit.
  }
  if (seen || reduceMotion.matches || !("IntersectionObserver" in window)) return;

  // Wait until the stub is actually on screen (below the fold on phones), then print it.
  stub.classList.add("is-waiting");
  const watcher = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    watcher.disconnect();
    stub.classList.replace("is-waiting", "is-printing");
    try {
      localStorage.setItem(STUB_KEY, "1");
    } catch {
      // fine
    }
  }, { threshold: 0.4 });
  watcher.observe(stub);

  // Safety net for browsers that never report the intersection: if the stub is
  // on screen and still waiting after 8 s, just show it.
  setTimeout(() => {
    if (!stub.classList.contains("is-waiting")) return;
    const box = stub.getBoundingClientRect();
    if (box.top < window.innerHeight && box.bottom > 0) {
      watcher.disconnect();
      stub.classList.remove("is-waiting");
    }
  }, 8000);
}
