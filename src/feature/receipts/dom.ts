/* A tiny, typed stand-in for a UI framework: build elements with attributes and children. */

export type Attr = string | number | boolean | null | undefined;

export interface Props {
  readonly class?: string;
  readonly text?: string;
  readonly [attribute: string]: Attr;
}

export type Kid = Node | string | number | false | null | undefined | readonly Kid[];

const isList = (kid: Kid): kid is readonly Kid[] => Array.isArray(kid);

function append(parent: ParentNode, kids: readonly Kid[]): void {
  for (const kid of kids) {
    if (kid == null || kid === false) continue;
    if (isList(kid)) append(parent, kid);
    else parent.append(typeof kid === "number" ? String(kid) : kid);
  }
}

/**
 * document.createElement with attributes and children. The return type follows the
 * tag: el("button") is an HTMLButtonElement, el("textarea") an HTMLTextAreaElement.
 * true sets an empty attribute; false, null and undefined leave it out.
 */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = String(value);
    else if (key === "text") node.textContent = String(value);
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  append(node, kids);
  return node;
}

/** Visually hidden text for screen readers. */
export const vh = (text: string): HTMLSpanElement => el("span", { class: "vh", text });

/** The nearest element matching the selector, from a DOM event's target. */
export function closest<E extends Element = HTMLElement>(target: EventTarget | null, selector: string): E | null {
  return target instanceof Element ? target.closest<E>(selector) : null;
}
