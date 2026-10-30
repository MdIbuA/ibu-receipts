/*
  The receipt printer: a non-modal panel docked bottom-right, with a tab that
  opens the bill. The page and its navigation stay usable underneath.
*/
import { el } from "./dom.ts";

export interface Printer {
  readonly dock: HTMLDivElement;
  readonly panel: HTMLElement;
  readonly slot: HTMLDivElement;
  readonly tab: HTMLButtonElement;
  readonly tabCount: HTMLSpanElement;
  readonly isOpen: () => boolean;
  /** Print paper into the slot. Focus moves to its title only when asked (not on page load). */
  show(paper: HTMLElement, trigger: HTMLElement | null, moveFocus: boolean): void;
  close(restoreFocus?: boolean): void;
}

export function createPrinter(options: { readonly reduceMotion: MediaQueryList; readonly narrow: MediaQueryList; readonly onClose: () => void }): Printer {
  const { reduceMotion, narrow, onClose } = options;

  const slot = el("div", { class: "rc-slot" });
  // The close button sits above the paper, outside the scrolling area, so it never covers text.
  const closeButton = el("button", { type: "button", class: "rc-close", "aria-label": "Close receipts" }, "×");
  const panel = el("section", {
    id: "rc-panel",
    class: "rc-panel",
    role: "dialog",
    "aria-modal": "false",
    "aria-labelledby": "rc-title",
    hidden: true
  }, el("div", { class: "rc-topbar" }, closeButton), slot);

  const tabCount = el("span", { class: "rc-tab__count" });
  const tab = el("button", { type: "button", class: "rc-tab", "aria-controls": "rc-panel", "aria-expanded": "false" },
    el("span", { class: "rc-tab__icon", "aria-hidden": "true" }),
    el("span", { class: "rc-tab__label", text: "Receipts" }),
    tabCount);

  const dock = el("div", { class: "rc-dock" }, panel, tab);
  document.body.append(dock);

  let returnFocus: HTMLElement | null = null;

  // On phones the hero hint and the floating tab would fight for the same pixels,
  // so the tab tucks away while the hint is on screen and nothing is open.
  const hint = document.querySelector(".hint");
  let hintOnScreen = false;
  const syncTuck = (): void => {
    dock.classList.toggle("is-tucked", hintOnScreen && narrow.matches && panel.hidden === true);
  };
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

  function show(paper: HTMLElement, trigger: HTMLElement | null, moveFocus: boolean): void {
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
    if (moveFocus) paper.querySelector<HTMLElement>("#rc-title")?.focus({ preventScroll: true });
    syncTuck();
  }

  function close(restoreFocus = true): void {
    if (panel.hidden) return;
    panel.hidden = true;
    dock.classList.remove("is-open");
    tab.setAttribute("aria-expanded", "false");
    onClose();
    syncTuck();
    const target = returnFocus?.isConnected ? returnFocus : tab;
    returnFocus = null;
    if (restoreFocus) target.focus();
  }

  closeButton.addEventListener("click", () => close());

  return { dock, panel, slot, tab, tabCount, isOpen: () => !panel.hidden, show, close };
}
