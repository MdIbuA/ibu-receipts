/* Coin vs. model: a fair coin raced against a model's direction accuracy. */
import { el } from "./dom.ts";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

export function coinRace(modelPct: number): HTMLElement {
  const out = el("p", { class: "rc-coin__out", "aria-live": "polite" });
  // Widths go through the CSSOM: the content security policy blocks style attributes.
  const coinFill = el("span", { class: "rc-bar__fill rc-bar__fill--coin" });
  coinFill.style.width = "0%";
  const modelFill = el("span", { class: "rc-bar__fill" });
  modelFill.style.width = `${modelPct}%`;
  const coinValue = el("span", { class: "rc-bar__v", text: "–" });
  const button = el("button", { type: "button", class: "rc-btn" }, "Flip a coin 100 times");

  const bar = (label: string, fill: HTMLElement, value: HTMLElement): HTMLDivElement =>
    el("div", { class: "rc-bar" },
      el("span", { text: label }),
      el("span", { class: "rc-bar__track" }, fill, el("span", { class: "rc-bar__mark" })),
      value);

  const bars = el("div", { class: "rc-bars", "aria-hidden": "true" },
    bar("Model", modelFill, el("span", { class: "rc-bar__v", text: `${modelPct}%` })),
    bar("Coin", coinFill, coinValue));

  function finish(heads: number): void {
    coinFill.style.width = `${heads}%`;
    coinValue.textContent = `${heads}%`;
    button.disabled = false;
    button.textContent = "Flip again";
    const verdict = heads > modelPct ? "The coin beat my model this time." : "My model edged the coin this time. Flip again.";
    out.textContent = `Coin: ${heads} of 100 right. Model: ${modelPct}%. ${verdict}`;
  }

  button.addEventListener("click", () => {
    const flips = Array.from({ length: 100 }, () => Math.random() < 0.5);
    const heads = flips.filter(Boolean).length;
    if (reduceMotion.matches) return finish(heads);

    button.disabled = true;
    out.textContent = "";
    let i = 0;
    let right = 0;
    const step = (): void => {
      for (let k = 0; k < 4 && i < flips.length; k += 1, i += 1) right += flips[i] ? 1 : 0;
      coinFill.style.width = `${(right / i) * 100}%`;
      coinValue.textContent = `${Math.round((right / i) * 100)}%`;
      if (i < flips.length) requestAnimationFrame(step);
      else finish(heads);
    };
    requestAnimationFrame(step);
  });

  return el("div", { class: "rc-coin" },
    el("p", { class: "rc-coin__how", text: "A coin that calls up or down at random is right half the time, whatever the market does. Heads counts as a right call." }),
    bars,
    button,
    out);
}
