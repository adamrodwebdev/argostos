/*
 * Building the interface's elements: text always goes in as text (never markup), names and
 * classes come from the game's own constants.
 */

export interface ElementParts {
  readonly className?: string;
  readonly text?: string;
  /** Attributes (`aria-label`, `type`…), from the game's own words. */
  readonly attributes?: Readonly<Record<string, string>>;
}

export function create<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  parts: ElementParts = {},
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (parts.className) element.className = parts.className;
  if (parts.text !== undefined) element.textContent = parts.text;
  for (const [name, value] of Object.entries(parts.attributes ?? {})) {
    element.setAttribute(name, value);
  }
  return element;
}

/** A button of the interface (`type="button"`: it never submits anything). */
export function button(document: Document, parts: ElementParts = {}): HTMLButtonElement {
  return create(document, 'button', {
    ...parts,
    attributes: { type: 'button', ...parts.attributes },
  });
}
