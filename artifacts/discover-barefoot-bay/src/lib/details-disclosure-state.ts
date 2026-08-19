/**
 * Raw CMS HTML can include native <details>/<summary> disclosures. React
 * replaces the children of a dangerouslySetInnerHTML container when page
 * content refreshes, which otherwise resets every disclosure to closed.
 */
export type DetailsDisclosureState = Map<string, boolean>;

function normalizeSummaryText(details: HTMLDetailsElement): string {
  return (details.querySelector("summary")?.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function disclosureKey(details: HTMLDetailsElement, index: number): string {
  if (details.dataset.disclosureKey) return details.dataset.disclosureKey;
  if (details.id) return `id:${details.id}`;
  return `summary:${normalizeSummaryText(details)}:${index}`;
}

/**
 * Remember one disclosure that the visitor toggled before a content refresh
 * can replace its HTML. Untouched disclosures are intentionally not stored,
 * so a future CMS update can still control their initial `open` attribute.
 */
export function captureDetailsDisclosureState(
  container: HTMLElement,
  state: DetailsDisclosureState,
  details: HTMLDetailsElement,
): void {
  const allDetails = Array.from(container.querySelectorAll<HTMLDetailsElement>("details"));
  const index = allDetails.indexOf(details);
  if (index === -1) return;

  const key = disclosureKey(details, index);
  details.dataset.disclosureKey = key;
  state.set(key, details.open);
}

/**
 * Capture the native `toggle` event emitted by a <details> control. The
 * listener is installed in capture phase because `toggle` is not guaranteed
 * to bubble across browsers.
 */
export function captureDetailsDisclosureToggle(
  container: HTMLElement,
  state: DetailsDisclosureState,
  event: Event,
): void {
  const DetailsElement = container.ownerDocument.defaultView?.HTMLDetailsElement;
  const details = event.target;
  if (!DetailsElement || !(details instanceof DetailsElement) || !container.contains(details)) {
    return;
  }
  captureDetailsDisclosureState(container, state, details);
}

/**
 * Reapply only states the visitor has actually changed. New disclosures keep
 * the `open` attribute supplied by the CMS rather than being forced closed.
 */
export function restoreDetailsDisclosureState(
  container: HTMLElement,
  state: DetailsDisclosureState,
): void {
  Array.from(container.querySelectorAll<HTMLDetailsElement>("details")).forEach((details, index) => {
    const key = disclosureKey(details, index);
    details.dataset.disclosureKey = key;
    const open = state.get(key);
    if (open !== undefined) details.open = open;
  });
}