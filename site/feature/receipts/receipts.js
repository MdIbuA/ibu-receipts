/*
  Receipts: every underlined claim on the page prints a receipt with its
  evidence, how it was measured, and the catch.

  Progressive enhancement. Without JavaScript each claim is a plain link to its
  evidence. With it, claims become buttons that print into a non-modal panel
  docked bottom-right, so the page and its navigation stay usable underneath.

  Data: claims.js (window.RECEIPTS) and build-info.js (window.BUILD_INFO, which
  the Amplify build rewrites on every deploy).
*/
(() => {
  "use strict";

  const data = window.RECEIPTS;
  if (!data || !Array.isArray(data.claims) || !document.body) return;

  const build = window.BUILD_INFO || { deployed: false };
  const claims = data.claims;
  const total = claims.length;
  const byId = new Map(claims.map((c, i) => [c.id, Object.assign(c, { n: i + 1 })]));

  const STORE_KEY = "ibu-receipts:checked";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const narrow = window.matchMedia("(max-width: 40em)");

  const STAMP = {
    verified: "Verified",
    partial: "Partial",
    self: "Self-reported",
    local: "Not deployed",
    itemized: "Itemized",
    audited: "Fully audited"
  };

  // ---------- helpers ----------

  function el(tag, props, ...kids) {
    const node = document.createElement(tag);
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (value == null || value === false) continue;
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = value;
        else node.setAttribute(key, value === true ? "" : String(value));
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid != null && kid !== false) node.append(kid);
    }
    return node;
  }

  const pad = (n) => String(n).padStart(2, "0");
  const statusOf = (c) => (c.build ? (build.deployed ? "verified" : "local") : c.status);
  const rule = () => el("hr", { class: "rc-rule" });

  function printedAt() {
    try {
      return new Intl.DateTimeFormat(undefined, {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
      }).format(new Date());
    } catch {
      return new Date().toDateString();
    }
  }

  function kb(bytes) {
    const k = Number(bytes) / 1024;
    return (k < 10 ? k.toFixed(1) : Math.round(k)) + " KB";
  }

  function utc(iso) {
    const d = new Date(iso);
    return isNaN(d) ? String(iso) : d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
  }

  // ---------- audit progress (this browser only) ----------

  const checked = new Set(readStore());

  function readStore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter((id) => byId.has(id)) : [];
    } catch {
      return [];
    }
  }

  function writeStore() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify([...checked]));
    } catch {
      // Private mode or blocked storage: progress simply won't survive a reload.
    }
  }

  function tally() {
    const t = { verified: 0, partial: 0, self: 0, local: 0, corrections: 0 };
    for (const c of claims) {
      t[statusOf(c)] += 1;
      if (c.correction) t.corrections += 1;
    }
    return t;
  }

  // ---------- claims become buttons ----------

  for (const link of document.querySelectorAll("a.claim[data-claim]")) {
    const c = byId.get(link.dataset.claim);
    if (!c) continue;
    const btn = el("button", {
      type: "button",
      class: link.className,
      "data-claim": c.id,
      "aria-haspopup": "dialog",
      "aria-controls": "rc-panel",
      "aria-expanded": "false"
    });
    btn.append(...link.childNodes, el("span", { class: "vh", text: ", show receipt" }));
    link.replaceWith(btn);
  }

  // ---------- the printer ----------

  const slot = el("div", { class: "rc-slot" });
  // The close button sits above the paper, outside the scrolling area, so it never covers text.
  const closeBtn = el("button", { type: "button", class: "rc-close", "aria-label": "Close receipts" }, "×");
  const panel = el("section", {
    id: "rc-panel",
    class: "rc-panel",
    role: "dialog",
    "aria-modal": "false",
    "aria-labelledby": "rc-title",
    hidden: true
  }, el("div", { class: "rc-topbar" }, closeBtn), slot);

  const tabCount = el("span", { class: "rc-tab__count" });
  const tab = el("button", {
    type: "button",
    class: "rc-tab",
    "aria-controls": "rc-panel",
    "aria-expanded": "false"
  },
    el("span", { class: "rc-tab__icon", "aria-hidden": "true" }),
    el("span", { class: "rc-tab__label", text: "Receipts" }),
    tabCount
  );

  const dock = el("div", { class: "rc-dock" }, panel, tab);
  document.body.append(dock);

  let current = null;      // id of the receipt on screen, "bill", or null
  let returnFocus = null;  // where focus goes when the panel closes

  // On phones the hero hint and the floating tab would fight for the same pixels,
  // so the tab tucks away while the hint is on screen and nothing is open.
  const hint = document.querySelector(".hint");
  let hintOnScreen = false;
  function syncTuck() {
    dock.classList.toggle("is-tucked", hintOnScreen && narrow.matches && panel.hidden);
  }
  if (hint && "IntersectionObserver" in window) {
    const box = hint.getBoundingClientRect(); // start tucked, so the tab never flashes on load
    hintOnScreen = box.top < window.innerHeight && box.bottom > 0;
    syncTuck();
    new IntersectionObserver((entries) => {
      hintOnScreen = entries.some((entry) => entry.isIntersecting);
      syncTuck();
    }).observe(hint);
    narrow.addEventListener("change", syncTuck);
  }

  function show(paper, trigger, moveFocus) {
    slot.replaceChildren(paper);
    slot.scrollTop = 0;
    panel.hidden = false;
    dock.classList.add("is-open");
    tab.setAttribute("aria-expanded", "true");

    panel.classList.remove("is-printing");
    if (!reduceMotion.matches) {
      void panel.offsetWidth; // restart the feed animation
      panel.classList.add("is-printing");
    }

    if (trigger) returnFocus = trigger;
    if (moveFocus) paper.querySelector("#rc-title").focus({ preventScroll: true });
    syncTuck();
  }

  function close(restoreFocus = true) {
    if (panel.hidden) return;
    panel.hidden = true;
    dock.classList.remove("is-open");
    tab.setAttribute("aria-expanded", "false");
    current = null;
    syncExpanded();
    syncTuck();
    const target = returnFocus && returnFocus.isConnected ? returnFocus : tab;
    returnFocus = null;
    if (restoreFocus) target.focus();
  }

  function openReceipt(id, trigger, moveFocus = true) {
    const c = byId.get(id);
    if (!c) return;
    current = id;
    show(renderReceipt(c), trigger, moveFocus);
    if (!checked.has(id)) {
      checked.add(id);
      writeStore();
    }
    syncExpanded();
    syncCounts();
  }

  // The first-screen shortcut: print the CryptoPulse receipt and race a coin against the model.
  function betAgainstModel(trigger) {
    openReceipt("cryptopulse", trigger);
    const race = slot.querySelector(".rc-coin");
    if (!race) return;
    const start = () => {
      slot.scrollTop += race.getBoundingClientRect().top - slot.getBoundingClientRect().top - 12;
      race.querySelector(".rc-btn").click();
    };
    if (reduceMotion.matches) start();
    else setTimeout(start, 1000); // let the paper finish feeding out first
  }

  function openBill(trigger, moveFocus = true) {
    current = "bill";
    show(renderBill(), trigger, moveFocus);
    syncExpanded();
  }

  // ---------- printing a claim ----------

  function lineItems(lines) {
    return el("ul", { class: "rc-lines" }, lines.map((line) =>
      el("li", { class: "rc-line", "data-ok": line.ok === false ? "false" : null },
        el("span", { class: "rc-line__k", text: line.k }),
        el("span", { class: "rc-line__dots", "aria-hidden": "true" }),
        el("span", { class: "rc-line__v" },
          line.href
            ? el("a", { href: line.href, target: "_blank", rel: "noopener" }, line.v, el("span", { class: "vh", text: " (opens in a new tab)" }))
            : line.v)
      )));
  }

  function evidenceList(list) {
    return el("ul", { class: "rc-evidence" }, list.map((item) =>
      el("li", null,
        el("a", { href: item.url, target: "_blank", rel: "noopener" },
          item.label,
          el("span", { "aria-hidden": "true", text: " ↗" }),
          el("span", { class: "vh", text: " (opens in a new tab)" })))));
  }

  function siteLines() {
    if (!build.deployed) {
      const lines = [
        { k: "Served from", v: "a local copy" },
        { k: "Amplify build", v: "none yet", ok: false }
      ];
      if (build.siteBytes) lines.push({ k: "Everything this site ships", v: kb(build.siteBytes) });
      return lines;
    }
    const lines = [{ k: "Host", v: build.host || "AWS Amplify Hosting" }];
    if (build.siteUrl) lines.push({ k: "Domain", v: build.siteUrl.replace(/^https:\/\//, "") });
    if (build.branch) lines.push({ k: "Branch", v: build.branch });
    const job = parseInt(build.job, 10);
    if (job) lines.push({ k: "Build", v: "#" + job });
    if (build.commit) lines.push({ k: "Commit", v: build.commit.slice(0, 7), href: `${data.repo}/commit/${build.commit}` });
    if (build.builtAt) lines.push({ k: "Built", v: utc(build.builtAt) });
    if (build.region) lines.push({ k: "Region", v: build.region });
    if (build.siteBytes) lines.push({ k: "Everything this site ships", v: kb(build.siteBytes) });
    return lines;
  }

  function stamp(status) {
    return el("p", { class: "rc-stamp", "data-status": status, text: STAMP[status] });
  }

  function barcode(seed) {
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
      bar.setAttribute("x", x);
      bar.setAttribute("width", w);
      bar.setAttribute("height", 30);
      svg.append(bar);
      x += w + 1 + ((h >>> 27) & 1);
    }
    return svg;
  }

  function header(kind, withBack) {
    return el("header", { class: "rc-head" },
      el("p", { class: "rc-brand", text: "Ibu's receipts" }),
      el("p", { class: "rc-meta", text: `${kind} · ${printedAt()}` }),
      withBack && el("button", { type: "button", class: "rc-back", "data-rc-bill": true }, "← All receipts"));
  }

  function renderReceipt(c) {
    const status = statusOf(c);
    const lines = c.build ? siteLines() : c.lines;
    const evidence = c.build && build.deployed && build.commit
      ? [{ label: `This deploy's commit (${build.commit.slice(0, 7)})`, url: `${data.repo}/commit/${build.commit}` }, ...c.evidence]
      : c.evidence;

    return el("article", { class: "rc-paper", "data-status": status },
      header(`Receipt ${pad(c.n)} of ${pad(total)}`, true),
      el("h2", { id: "rc-title", class: "rc-title", tabindex: "-1", text: c.title }),
      el("p", { class: "rc-context", text: c.context }),
      lineItems(lines),
      c.measured && el("p", { class: "rc-measured" }, el("span", { class: "rc-label", text: "Measured " }), c.measured),
      rule(),
      el("section", { class: "rc-block" },
        el("h3", { class: "rc-label", text: "Evidence" }),
        evidenceList(evidence)),
      rule(),
      el("section", { class: "rc-block rc-catch" },
        el("h3", { class: "rc-label", text: "The catch" }),
        el("p", { text: c.catch }),
        c.coin && coinRace(c.coin)),
      c.correction && [
        rule(),
        el("section", { class: "rc-block rc-correction" },
          el("h3", { class: "rc-label", text: "Corrected" }),
          el("p", { text: c.correction }))
      ],
      rule(),
      el("footer", { class: "rc-foot" },
        stamp(status),
        barcode(c.id),
        el("p", { class: "rc-thanks", text: "Thank you. Check again soon." }),
        el("a", { class: "rc-permalink", href: `#r-${c.id}` }, "Link to this receipt")));
  }

  // ---------- coin vs. model ----------

  function coinRace(modelPct) {
    const out = el("p", { class: "rc-coin__out", "aria-live": "polite" });
    const coinFill = el("span", { class: "rc-bar__fill rc-bar__fill--coin", style: "width:0%" });
    const coinValue = el("span", { class: "rc-bar__v", text: "–" });
    const btn = el("button", { type: "button", class: "rc-btn" }, "Flip a coin 100 times");

    const bar = (label, fill, value) =>
      el("div", { class: "rc-bar" },
        el("span", { text: label }),
        el("span", { class: "rc-bar__track" }, fill, el("span", { class: "rc-bar__mark" })),
        value);

    const bars = el("div", { class: "rc-bars", "aria-hidden": "true" },
      bar("Model", el("span", { class: "rc-bar__fill", style: `width:${modelPct}%` }), el("span", { class: "rc-bar__v", text: modelPct + "%" })),
      bar("Coin", coinFill, coinValue));

    function finish(heads) {
      coinFill.style.width = heads + "%";
      coinValue.textContent = heads + "%";
      btn.disabled = false;
      btn.textContent = "Flip again";
      const verdict = heads > modelPct
        ? "The coin beat my model this time."
        : "My model edged the coin this time. Flip again.";
      out.textContent = `Coin: ${heads} of 100 right. Model: ${modelPct}%. ${verdict}`;
    }

    btn.addEventListener("click", () => {
      const flips = Array.from({ length: 100 }, () => Math.random() < 0.5);
      const heads = flips.filter(Boolean).length;
      if (reduceMotion.matches) return finish(heads);

      btn.disabled = true;
      out.textContent = "";
      let i = 0;
      let right = 0;
      const step = () => {
        for (let k = 0; k < 4 && i < flips.length; k += 1, i += 1) right += flips[i] ? 1 : 0;
        coinFill.style.width = (right / i) * 100 + "%";
        coinValue.textContent = Math.round((right / i) * 100) + "%";
        if (i < flips.length) requestAnimationFrame(step);
        else finish(heads);
      };
      requestAnimationFrame(step);
    });

    return el("div", { class: "rc-coin" },
      el("p", { class: "rc-coin__how", text: "A coin that calls up or down at random is right half the time, whatever the market does. Heads counts as a right call." }),
      bars,
      btn,
      out);
  }

  // ---------- the itemized bill ----------

  function renderBill() {
    const t = tally();
    const done = checked.size === total;
    const totals = [
      { k: "Claims on this page", v: String(total) },
      { k: "Backed by public proof", v: String(t.verified) },
      { k: "Partial receipts", v: String(t.partial) },
      { k: "Self-reported", v: String(t.self) }
    ];
    if (t.local) totals.push({ k: "Not deployed (local copy)", v: String(t.local), ok: false });
    totals.push(
      { k: "Write-ups my code corrected", v: String(t.corrections) },
      { k: "Invented facts", v: "0" }
    );

    const highlightOn = document.documentElement.classList.contains("rc-highlight");

    return el("article", { class: "rc-paper", "data-status": done ? "audited" : "itemized" },
      header("Itemized bill", false),
      el("h2", { id: "rc-title", class: "rc-title", tabindex: "-1", text: "Everything this page claims" }),
      el("p", { class: "rc-context", text: "Every receipt shows its evidence and its catch." }),
      lineItems(totals),
      rule(),
      el("p", { class: "rc-label", id: "rc-progress-label", text: `Audited by you: ${checked.size} of ${total}` }),
      el("progress", { class: "rc-progress", max: total, value: checked.size, "aria-labelledby": "rc-progress-label" }),
      rule(),
      el("h3", { class: "rc-label", text: "Items · pick one to print" }),
      el("ol", { class: "rc-items" }, claims.map((c) =>
        el("li", null,
          el("button", { type: "button", class: "rc-item", "data-rc-open": c.id },
            el("span", { class: "rc-item__n", text: pad(c.n) }),
            el("span", { class: "rc-item__k", text: c.label }),
            el("span", { class: "rc-line__dots", "aria-hidden": "true" }),
            el("span", { class: "rc-item__v", "data-done": checked.has(c.id) || null, "aria-hidden": "true", text: checked.has(c.id) ? "✓" : "·" }),
            el("span", { class: "vh", text: checked.has(c.id) ? ", checked" : ", not checked yet" }))))),
      rule(),
      el("div", { class: "rc-actions" },
        el("button", { type: "button", class: "rc-btn", "data-rc-highlight": true, "aria-pressed": String(highlightOn) }, "Highlight claims on the page"),
        el("button", { type: "button", class: "rc-btn", "data-rc-random": true }, "Print a random one"),
        checked.size > 0 && el("button", { type: "button", class: "rc-btn", "data-rc-reset": true }, "Reset my audit")),
      rule(),
      lineItems([{ k: "Trust required", v: "₹0.00" }]),
      el("footer", { class: "rc-foot" },
        stamp(done ? "audited" : "itemized"),
        barcode("bill"),
        el("p", { class: "rc-thanks", text: "Thank you. Visit again." })));
  }

  // ---------- keeping the page in sync ----------

  function syncExpanded() {
    for (const b of document.querySelectorAll("button.claim[data-claim]")) {
      b.setAttribute("aria-expanded", String(b.dataset.claim === current));
      b.toggleAttribute("data-checked", checked.has(b.dataset.claim));
    }
  }

  function syncCounts() {
    const t = tally();
    const set = (selector, value) => {
      for (const node of document.querySelectorAll(selector)) node.textContent = String(value);
    };
    set("[data-rc-total]", total);
    set("[data-rc-verified]", t.verified);
    set("[data-rc-corrections]", t.corrections);
    set("[data-rc-checked]", checked.size);
    tabCount.replaceChildren(`${checked.size}/${total}`, el("span", { class: "vh", text: " audited" }));
    tab.classList.toggle("is-done", checked.size === total);
  }

  function setHighlight(on) {
    document.documentElement.classList.toggle("rc-highlight", on);
    for (const b of document.querySelectorAll("[data-rc-highlight]")) b.setAttribute("aria-pressed", String(on));
  }

  // ---------- events ----------

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const claimBtn = target.closest("button.claim[data-claim]");
    if (claimBtn) return openReceipt(claimBtn.dataset.claim, claimBtn);

    const item = target.closest("[data-rc-open]");
    if (item) return openReceipt(item.dataset.rcOpen, panel.contains(item) ? tab : item);

    if (target.closest("[data-rc-bill]")) {
      const fromPanel = panel.contains(target);
      return openBill(fromPanel ? tab : target.closest("[data-rc-bill]"));
    }

    const bet = target.closest("[data-rc-bet]");
    if (bet) return betAgainstModel(bet);

    const hl = target.closest("[data-rc-highlight]");
    if (hl) return setHighlight(hl.getAttribute("aria-pressed") !== "true");

    if (target.closest("[data-rc-random]")) {
      const pool = claims.filter((c) => !checked.has(c.id));
      const pick = (pool.length ? pool : claims)[Math.floor(Math.random() * (pool.length || total))];
      return openReceipt(pick.id, tab);
    }

    if (target.closest("[data-rc-reset]")) {
      checked.clear();
      writeStore();
      syncExpanded();
      syncCounts();
      return openBill(tab);
    }

    // On a phone the sheet is tall: get it out of the way when someone navigates.
    const jump = target.closest('a[href^="#"]');
    if (jump && narrow.matches && !panel.contains(jump) && !jump.getAttribute("href").startsWith("#r-")) close(false);
  });

  closeBtn.addEventListener("click", () => close());
  tab.addEventListener("click", () => (current === "bill" ? close() : openBill(tab)));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      event.preventDefault();
      close();
    }
  });

  // ---------- the hero stub's deploy stamp ----------

  const deploySlot = document.querySelector("[data-rc-deploy]");
  if (deploySlot) {
    const job = parseInt(build.job, 10);
    const facts = [job ? `build #${job}` : "", build.commit ? `commit ${String(build.commit).slice(0, 7)}` : ""]
      .filter(Boolean).join(" · ");
    deploySlot.replaceChildren(build.deployed
      ? el("button", { type: "button", class: "stub__deploy", "data-rc-open": "site" },
          el("span", { class: "stub__deploy-head", text: "Live on AWS Amplify" }),
          el("span", { class: "stub__deploy-sub", text: facts }),
          el("span", { class: "vh", text: ", show the receipt AWS wrote for this deploy" }))
      : el("p", { class: "stub__deploy stub__deploy--local" },
          el("span", { class: "stub__deploy-head", text: "Local copy" }),
          el("span", { class: "stub__deploy-sub", text: "not deployed yet" })));
  }

  // ---------- first view: the hero stub prints itself, once ----------

  const STUB_KEY = "ibu-receipts:stub-printed";
  const stub = document.querySelector(".stub");
  if (stub) {
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

    // Wait until the stub is actually on screen (below the fold on phones), then print it.
    if (!seen && !reduceMotion.matches && "IntersectionObserver" in window) {
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
  }

  // Deep links: #r-<id> prints that receipt, #receipts prints the bill.
  function fromHash(onLoad) {
    const match = /^#r-([\w-]+)$/.exec(location.hash);
    if (match && byId.has(match[1])) {
      if (current !== match[1]) openReceipt(match[1], null, !onLoad);
    } else if (location.hash === "#receipts") {
      openBill(null, !onLoad);
    }
  }
  window.addEventListener("hashchange", () => fromHash(false));

  syncExpanded();
  syncCounts();
  fromHash(true);
})();
