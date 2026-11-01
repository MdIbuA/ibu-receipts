// Underlines the nav link for the section currently on screen. On wide screens the same
// signal prints a receipt of your visit in the margin, a line for each section you read.
const links = [...document.querySelectorAll<HTMLAnchorElement>('.nav a[href^="#"]')];

// How long a section must stay on screen to count as read, so flying past it on a
// nav jump doesn't.
const READ_AFTER_MS = 1500;

interface Tape {
  reading(id: string): void;
  left(id: string): void;
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// Decorative, so hidden from assistive tech. It prints out with the first section read,
// and motion.css shows it only where the margin has room.
function visitTape(names: ReadonlyMap<string, string>): Tape {
  const lines = make("ol", "tape__lines");
  const total = make("p", "tape__total");
  const paper = make("div", "tape__paper");
  const tape = make("div", "tape");
  paper.append(make("p", "tape__head", "Your visit"), lines, total);
  tape.append(make("div", "tape__slot"), paper);
  tape.setAttribute("aria-hidden", "true");
  document.body.append(tape);

  const read = new Set<string>();
  const timers = new Map<string, number>();
  const print = (id: string): void => {
    timers.delete(id);
    read.add(id);
    tape.classList.add("is-started");
    const num = document.getElementById(id)?.querySelector(".section__num")?.textContent ?? "";
    const line = make("li", "is-printed");
    line.append(make("span", undefined, `${num} ${names.get(id) ?? id}`.trim()), make("b", undefined, "✓"));
    lines.append(line);
    const done = read.size === names.size;
    total.textContent = done ? "Read in full" : `${read.size} of ${names.size} read`;
    total.classList.toggle("is-done", done);
  };

  return {
    reading(id) {
      if (!read.has(id) && !timers.has(id)) timers.set(id, window.setTimeout(print, READ_AFTER_MS, id));
    },
    left(id) {
      window.clearTimeout(timers.get(id));
      timers.delete(id);
    },
  };
}

if (links.length && "IntersectionObserver" in window) {
  const byId = new Map(links.map((a) => [(a.getAttribute("href") ?? "").slice(1), a]));
  const tape = visitTape(new Map([...byId].map(([id, a]) => [id, a.textContent.trim()])));
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const id = entry.target.id;
      const link = byId.get(id);
      if (!link) continue;
      if (entry.isIntersecting) {
        for (const a of links) a.removeAttribute("aria-current");
        link.setAttribute("aria-current", "true");
        tape.reading(id);
      } else {
        // Scrolled back into the hero: no section is current.
        link.removeAttribute("aria-current");
        tape.left(id);
      }
    }
  }, { rootMargin: "-45% 0px -50% 0px" });

  for (const id of byId.keys()) {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  }
}

export {};
