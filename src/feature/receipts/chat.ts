/*
  Chit's window: ask about Ibu and the printer answers on a roll of paper,
  quoting the page and its receipts. ask.ts decides what to print; this file only
  prints it. The roll feeds up out of the printer with the newest chit at the
  bottom, like the real thing. Nothing typed here leaves the browser or is saved.
*/
import { answer, fresh, MAX_QUESTION, NAME, opening, remember, type Action, type Answer, type Bit, type Memory, type Mood, type Part, type Verdict } from "./ask.ts";
import { claimById } from "./catalog.ts";
import { closest, el, vh, type Kid } from "./dom.ts";
import { pad } from "./format.ts";
import { receiptsFor, skillLine } from "./job.ts";
import { lineItems } from "./paper.ts";
import { BUILDS, type Link } from "./quotes.ts";
import { unreachable } from "./types.ts";

export interface ChatOptions {
  readonly reduceMotion: MediaQueryList;
  /** Phones: Chit opens as a bottom sheet, and tucks away while the hero hint is on screen. */
  readonly narrow: MediaQueryList;
  /** Too narrow for Chit and the printer side by side, so they take turns. */
  readonly solo: MediaQueryList;
  readonly deployed: boolean;
  readonly recheck: boolean;
  /** Chit is about to open. */
  readonly onOpen: () => void;
  /** The printer has the screen right now, so Chit keeps its hello to itself. */
  readonly quiet: () => boolean;
  /** Print a job receipt for text someone pasted into the chat. */
  readonly onJobText: (text: string, trigger: HTMLElement) => void;
}

export interface Chat {
  open(trigger: HTMLElement | null, moveFocus?: boolean): void;
  close(restoreFocus?: boolean): void;
  isOpen(): boolean;
  /** Step aside while the printer has a small screen; restore() brings Chit back. */
  minimize(): void;
  restore(): void;
  contains(target: EventTarget | null): boolean;
}

// ---------- Chit itself ----------

const SVG = "http://www.w3.org/2000/svg";

function svg(tag: string, attrs: Readonly<Record<string, string | number>>, ...kids: Element[]): SVGElement {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  node.append(...kids);
  return node;
}

const eye = (side: "l" | "r", cx: number): SVGElement =>
  svg("g", { class: `chit__eye chit__eye--${side}` },
    svg("ellipse", { class: "chit__white", cx, cy: 35, rx: 4.6, ry: 5.4 }),
    svg("circle", { class: "chit__pupil", cx: cx + 0.8, cy: 36, r: 2.5 }),
    svg("circle", { class: "chit__glint", cx: cx + 1.9, cy: 34, r: 0.95 }));

/** A little thermal printer with a face. Decorative: CSS gives it its moods. */
function mascot(): SVGElement {
  return svg("svg", { class: "chit", viewBox: "0 0 64 64", "aria-hidden": "true", focusable: "false", "data-mood": "calm" },
    svg("g", { class: "chit__paper" },
      svg("path", { class: "chit__sheet", d: "M21 21V7.5l2.2-2 2.2 2 2.2-2 2.2 2 2.2-2 2.2 2 2.2-2 2.2 2 2.2-2 2.2 2V21z" }),
      svg("path", { class: "chit__ink", d: "M25 11.5h14M25 15h9" })),
    svg("rect", { class: "chit__body", x: 7, y: 17, width: 50, height: 37, rx: 12 }),
    svg("rect", { class: "chit__slot", x: 15, y: 17.5, width: 34, height: 4, rx: 2 }),
    svg("circle", { class: "chit__led", cx: 50, cy: 26.5, r: 2.1 }),
    eye("l", 23),
    eye("r", 41),
    svg("path", { class: "chit__arc chit__arc--l", d: "M18.5 36.5q4.5-5.5 9 0" }),
    svg("path", { class: "chit__arc chit__arc--r", d: "M36.5 36.5q4.5-5.5 9 0" }),
    svg("path", { class: "chit__squint", d: "M19 32.5l6.5 3-6.5 3M45 32.5l-6.5 3 6.5 3" }),
    svg("ellipse", { class: "chit__cheek", cx: 15.5, cy: 43.5, rx: 3.6, ry: 2.3 }),
    svg("ellipse", { class: "chit__cheek", cx: 48.5, cy: 43.5, rx: 3.6, ry: 2.3 }),
    svg("path", { class: "chit__mouth", d: "M28.5 44.5q3.5 3.4 7 0" }),
    svg("path", { class: "chit__wobble", d: "M28 46q1.75-1.8 3.5 0t3.5 0" }),
    svg("circle", { class: "chit__o", cx: 32, cy: 45.5, r: 1.8 }),
    svg("path", { class: "chit__drop", d: "M11.5 26c-1.6 2.4-2.4 3.6-2.4 4.7a2.4 2.4 0 0 0 4.8 0c0-1.1-.8-2.3-2.4-4.7z" }),
    svg("rect", { class: "chit__foot", x: 14, y: 52, width: 10, height: 5.5, rx: 2.5 }),
    svg("rect", { class: "chit__foot", x: 40, y: 52, width: 10, height: 5.5, rx: 2.5 }));
}

/** Restart a blink: a couple of them, then Chit holds still. */
function blink(face: SVGElement): void {
  face.classList.remove("is-blinking");
  void face.getBoundingClientRect();
  face.classList.add("is-blinking");
}

// ---------- what a chit prints ----------

const STAMP: Readonly<Record<Verdict, string>> = {
  verified: "Verified",
  partial: "Partial",
  self: "Self-reported",
  local: "Not deployed",
  quoted: "Quoted",
  none: "No receipt"
};
const PART: Readonly<Record<Part, string>> = { catch: "The catch", correction: "Corrected", measured: "Measured" };
const DATA: Readonly<Record<Exclude<Action, "job-text">, string>> = { job: "data-rc-job", bet: "data-rc-bet", bill: "data-rc-bill" };

const clock = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const now = (): string => clock.format(new Date());

function linkItem({ label, url }: Link): HTMLLIElement {
  return el("li", null, /^https?:\/\//.test(url)
    ? el("a", { href: url, target: "_blank", rel: "noopener" }, label, el("span", { "aria-hidden": "true", text: " ↗" }), vh(" (opens in a new tab)"))
    : el("a", { href: url }, label));
}

export function createChat(options: ChatOptions): Chat {
  const { reduceMotion, narrow, solo } = options;

  let memory: Memory = fresh(options.deployed, options.recheck);
  let answered = 0;
  let printing = false;
  /** Bumped by "tear off", so a chit still printing from before lands nowhere. */
  let generation = 0;
  let minimized = false;
  let returnFocus: HTMLElement | null = null;
  let settle = 0;

  // ---------- the window: a roll of paper over a printer ----------

  const face = mascot();
  const count = el("b", { text: "0" });
  const head = el("div", { class: "chit-roll__head" },
    el("p", { class: "rc-brand", text: "Ibu's receipts" }),
    el("h2", { id: "chit-title", class: "chit-title", text: "Chit-chat" }),
    el("p", { class: "rc-meta", text: `Printed for you at ${now()}` }),
    el("p", { class: "chit-tally" }, "Answered ", count, " · Invented ", el("b", { text: "0" })),
    el("p", { class: "chit-privacy", text: "Matched in your browser. Nothing you type is sent or saved." }));
  const roll = el("div", { class: "chit-roll", role: "log", "aria-labelledby": "chit-title", tabindex: "0" }, head);

  const field = el("textarea", {
    id: "chit-q",
    class: "chit-field",
    rows: 1,
    maxlength: MAX_QUESTION,
    placeholder: "Ask about Ibu…",
    autocomplete: "off",
    spellcheck: "false",
    enterkeyhint: "send",
    "aria-describedby": "chit-keys"
  });
  const form = el("form", { class: "chit-printer", novalidate: true },
    el("span", { class: "chit-printer__face" }, face),
    el("label", { class: "vh", for: "chit-q", text: "Ask Chit about Ibu" }),
    field,
    el("button", { type: "submit", class: "chit-send" }, el("span", { class: "chit-send__icon", "aria-hidden": "true" }), "Print"),
    el("p", { id: "chit-keys", class: "vh", text: "Enter prints your question. Shift and Enter starts a new line." }));

  const tear = el("button", { type: "button", class: "rc-close chit-tear", "aria-label": "Tear off and start over" },
    el("span", { class: "chit-tear__icon", "aria-hidden": "true" }));
  const closeButton = el("button", { type: "button", class: "rc-close", "aria-label": "Close Chit" }, "×");
  const panel = el("section", {
    id: "chit-panel",
    class: "chit-panel",
    role: "dialog",
    "aria-modal": "false",
    "aria-labelledby": "chit-title",
    hidden: true
  }, el("div", { class: "chit-topbar" }, tear, closeButton), roll, form);

  // Closed, Chit waits in the corner. The bubble is the button's name, on phones too.
  const launchFace = mascot();
  const launcher = el("button", { type: "button", class: "chit-launch", "aria-controls": "chit-panel", "aria-expanded": "false" },
    launchFace,
    el("span", { class: "chit-launch__bubble", text: "Ask me about Ibu" }));

  // Each time the page opens, Chit pops a hello above its head, then lets it go. It's
  // decoration over the button, which already says the same, so screen readers skip it
  // and it never catches a click meant for the page underneath.
  const hour = new Date().getHours();
  const hello = el("div", { class: "chit-hello", "aria-hidden": "true", hidden: true },
    el("p", { class: "chit-hello__hi", text: `${hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}! I'm Chit.` }),
    el("p", { class: "chit-hello__text", text: "Ibu's receipt printer. Ask me anything about Ibu, and I'll answer with receipts." }));

  const dock = el("div", { class: "chit-dock" }, panel, hello, launcher);
  document.body.append(dock);

  // On phones the hero hint and Chit would share pixels, so Chit tucks away while the
  // hint is on screen, as the printer's tab does. The hint has its own way in.
  const hint = document.querySelector(".hint");
  let hintOnScreen = false;
  const syncTuck = (): void => {
    dock.classList.toggle("is-tucked", hintOnScreen && narrow.matches && panel.hidden === true);
  };
  if (hint && "IntersectionObserver" in window) {
    const box = hint.getBoundingClientRect();
    hintOnScreen = box.top < window.innerHeight && box.bottom > 0;
    syncTuck();
    new IntersectionObserver((entries) => {
      hintOnScreen = entries.some((entry) => entry.isIntersecting);
      syncTuck();
    }).observe(hint);
    narrow.addEventListener("change", syncTuck);
  }

  // ---------- saying hello ----------

  const HELLO_AFTER_MS = 900;
  const HELLO_FOR_MS = 6000;
  let helloTimer = 0;

  /** Chit hops, smiles and says hello; on a phone it steps out from behind the hint to do it. */
  function sayHello(): void {
    if (!panel.hidden || minimized || options.quiet()) return;
    hello.hidden = false;
    dock.classList.add("is-greeting");
    launchFace.dataset["mood"] = "happy";
    blink(launchFace);
    helloTimer = window.setTimeout(endHello, HELLO_FOR_MS);
  }

  /** The hello pops back down, or goes at once when Chit opens. Chit stays in its corner. */
  function endHello(now = false): void {
    window.clearTimeout(helloTimer);
    if (hello.hidden) return;
    const gone = (): void => {
      hello.hidden = true;
      hello.classList.remove("is-leaving");
      dock.classList.remove("is-greeting");
      launchFace.dataset["mood"] = "calm";
    };
    if (now || reduceMotion.matches) return gone();
    hello.classList.add("is-leaving");
    window.setTimeout(gone, 320);
  }

  window.setTimeout(sayHello, HELLO_AFTER_MS);
  blink(launchFace);

  // ---------- printing ----------

  function mood(next: Mood | "busy"): void {
    window.clearTimeout(settle);
    face.dataset["mood"] = next;
    if (next === "busy" || next === "calm") return;
    blink(face);
    // A reaction lasts a moment, then Chit settles.
    settle = window.setTimeout(() => {
      face.dataset["mood"] = "calm";
    }, 2600);
  }

  function action(kind: Action, label: string, question: string): HTMLButtonElement {
    if (kind !== "job-text") return el("button", { type: "button", class: "rc-btn rc-btn--ink", [DATA[kind]]: true }, label);
    const button = el("button", { type: "button", class: "rc-btn rc-btn--ink" }, label);
    button.addEventListener("click", () => options.onJobText(question, button));
    return button;
  }

  function bitView(bit: Bit, question: string): Kid {
    switch (bit.kind) {
      case "say":
        return el("p", { class: "chit-say", text: bit.text });
      case "quote":
        return el("blockquote", { class: "chit-quote" },
          el("p", { class: "chit-quote__text", text: bit.quote.text }),
          el("p", { class: "chit-from" }, "From the page · ", bit.quote.at ? el("a", { href: bit.quote.at }, bit.quote.from) : bit.quote.from));
      case "cite": {
        const claim = claimById(bit.claim);
        return el("blockquote", { class: "chit-quote chit-quote--receipt", "data-part": bit.part },
          el("p", { class: "chit-quote__label", text: PART[bit.part] }),
          el("p", { class: "chit-quote__text", text: bit.text }),
          el("p", { class: "chit-from", text: `From receipt ${pad(claim.n)} · ${claim.label}` }));
      }
      case "head": {
        const claim = claimById(bit.claim);
        return el("p", { class: "chit-head" }, el("strong", { text: claim.title }), el("span", { text: claim.context }));
      }
      case "build":
        return el("p", { class: "chit-head" }, el("strong", { text: BUILDS[bit.build].name }), el("span", { text: "In brief, on the page" }));
      case "lines":
        return lineItems(bit.lines);
      case "skills":
        return el("ol", { class: bit.proof ? "rc-job chit-skills" : "rc-job chit-skills is-compact" },
          bit.skills.map((skill) => skillLine(skill, { proof: bit.proof, mine: false })));
      case "receipts":
        return receiptsFor(bit.ids);
      case "links":
        return el("ul", { class: "rc-evidence chit-links" }, bit.links.map(linkItem));
      case "do":
        return el("p", { class: "chit-do" }, action(bit.action, bit.label, question));
      default:
        return unreachable(bit);
    }
  }

  function chitView(said: Answer, question: string): HTMLElement {
    return el("article", { class: "chit-reply", "data-topic": said.topic },
      el("p", { class: "chit-reply__meta" },
        el("span", { text: `${NAME} · ${now()}` }),
        said.verdict && el("span", { class: "chit-stamp", "data-status": said.verdict, text: STAMP[said.verdict] })),
      said.bits.map((bit) => bitView(bit, question)),
      said.next.length > 0 && el("div", { class: "chit-next", role: "group", "aria-label": "Ask next" },
        said.next.map((next) => el("button", { type: "button", class: "chit-chip", "data-chit-ask": next }, next))));
  }

  function reveal(node: HTMLElement): void {
    roll.scrollTo({ top: Math.max(0, node.offsetTop - 10), behavior: reduceMotion.matches ? "auto" : "smooth" });
  }

  function ask(question: string): void {
    const text = question.trim();
    if (!text || printing) return;
    printing = true;
    for (const old of roll.querySelectorAll(".chit-next")) old.remove();

    const note = el("div", { class: "chit-note" },
      el("p", { class: "chit-note__label", text: "You asked" }),
      el("p", { class: "chit-note__text", text: text.length > 600 ? `${text.slice(0, 600)}…` : text }));
    const busy = el("p", { class: "chit-busy" }, "Printing", el("span", { class: "chit-busy__dots", "aria-hidden": "true" }));
    roll.append(note, busy);
    reveal(note);
    mood("busy");

    const said = answer(text, memory);
    memory = remember(memory, said);
    const mine = generation;
    // Long enough to read as printing, never long enough to wait for.
    const delay = reduceMotion.matches ? 150 : Math.min(950, 420 + said.bits.length * 70);
    window.setTimeout(() => {
      if (mine !== generation) return;
      const chit = chitView(said, text);
      if (!reduceMotion.matches) chit.classList.add("is-new");
      busy.replaceWith(chit);
      answered += 1;
      count.textContent = String(answered);
      reveal(note);
      printing = false;
      mood(said.mood);
    }, delay);
  }

  // ---------- typing ----------

  const grow = (): void => {
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 128)}px`;
  };

  function submit(): void {
    if (printing || !field.value.trim()) return;
    const text = field.value;
    field.value = "";
    grow();
    ask(text);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submit();
  });
  field.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      submit();
    }
  });
  field.addEventListener("input", grow);
  // Chit watches you type.
  field.addEventListener("focus", () => {
    face.dataset["look"] = "down";
  });
  field.addEventListener("blur", () => {
    delete face.dataset["look"];
  });

  panel.addEventListener("click", (event) => {
    const chip = closest<HTMLButtonElement>(event.target, "[data-chit-ask]");
    if (chip) {
      // A tap shouldn't pop a phone's keyboard up; from a keyboard, carry on typing.
      if (event.detail === 0) field.focus();
      else roll.focus({ preventScroll: true });
      ask(chip.dataset["chitAsk"] ?? "");
      return;
    }
    // On a small screen a link into the page needs the page, so Chit steps aside.
    if (closest(event.target, 'a[href^="#"]') && solo.matches) close(false);
  });

  tear.addEventListener("click", () => {
    generation += 1;
    printing = false;
    memory = fresh(options.deployed, options.recheck);
    answered = 0;
    count.textContent = "0";
    roll.replaceChildren(head, chitView(opening(), ""));
    roll.scrollTop = 0;
    feed();
    mood("happy");
    field.focus();
  });
  closeButton.addEventListener("click", () => close());
  launcher.addEventListener("click", () => open(launcher));

  // ---------- opening and closing ----------

  /** The roll feeds up out of the printer. */
  function feed(): void {
    panel.classList.remove("is-feeding");
    if (reduceMotion.matches) return;
    void panel.offsetWidth;
    panel.classList.add("is-feeding");
  }

  function setOpen(on: boolean): void {
    panel.hidden = !on;
    launcher.hidden = on;
    launcher.setAttribute("aria-expanded", String(on));
    dock.classList.toggle("is-open", on);
    syncTuck();
  }

  function open(trigger: HTMLElement | null, moveFocus = true): void {
    minimized = false;
    endHello(true);
    if (panel.hidden) {
      options.onOpen();
      if (!roll.querySelector(".chit-reply")) roll.append(chitView(opening(), ""));
      setOpen(true);
      feed();
      mood("happy");
    }
    if (trigger) returnFocus = trigger;
    if (moveFocus) field.focus({ preventScroll: true });
  }

  function close(restoreFocus = true): void {
    minimized = false;
    if (panel.hidden) return;
    setOpen(false);
    const target = returnFocus?.isConnected ? returnFocus : launcher;
    returnFocus = null;
    if (restoreFocus) target.focus();
  }

  return {
    open,
    close,
    isOpen: () => !panel.hidden,
    minimize() {
      endHello(true);
      if (panel.hidden) return;
      panel.hidden = true;
      minimized = true;
    },
    restore() {
      if (!minimized) return;
      minimized = false;
      panel.hidden = false;
    },
    contains: (target) => target instanceof Node && dock.contains(target)
  };
}
