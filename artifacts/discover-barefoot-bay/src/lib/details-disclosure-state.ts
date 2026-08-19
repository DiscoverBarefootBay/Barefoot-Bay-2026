/**
 * Raw CMS HTML can include native <details>/<summary> disclosures. React
 * replaces the children of a dangerouslySetInnerHTML container when page
 * content refreshes, which otherwise resets every disclosure to closed.
 */
export type DetailsDisclosureState = Map<string, boolean>;

export interface DetailsDisclosureClickIntent {
  key: string;
  previousOpen: boolean;
  previousState: boolean | undefined;
  hadPreviousState: boolean;
}

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
 * Record the state a native summary activation is about to produce. Browsers
 * may queue the `toggle` event until after React has already replaced the CMS
 * node, so waiting for `toggle` alone can lose the visitor's first click.
 *
 * This intentionally does not prevent the click or change `details.open`;
 * native details/summary behavior remains the only thing controlling the DOM.
 */
export function captureDetailsDisclosureClickIntent(
  container: HTMLElement,
  state: DetailsDisclosureState,
  event: MouseEvent,
): DetailsDisclosureClickIntent | null {
  if (event.defaultPrevented || event.button !== 0) return null;

  const view = container.ownerDocument.defaultView;
  const ElementClass = view?.Element;
  const DetailsElement = view?.HTMLDetailsElement;
  const target = event.target;
  if (!ElementClass || !DetailsElement || !(target instanceof ElementClass)) return null;

  const summary = target.closest("summary");
  const details = summary?.parentElement;
  if (
    !summary ||
    !(details instanceof DetailsElement) ||
    !container.contains(details)
  ) {
    return null;
  }

  const allDetails = Array.from(container.querySelectorAll<HTMLDetailsElement>("details"));
  const index = allDetails.indexOf(details);
  if (index === -1) return null;

  const key = disclosureKey(details, index);
  const intent: DetailsDisclosureClickIntent = {
    key,
    previousOpen: details.open,
    previousState: state.get(key),
    hadPreviousState: state.has(key),
  };
  details.dataset.disclosureKey = key;
  state.set(key, !details.open);
  return intent;
}

/**
 * Undo a speculative click intent if a later target/bubble handler cancelled
 * the native summary activation. This also repairs a replacement container
 * that may already have restored the speculative value during the event.
 */
export function rollbackDetailsDisclosureClickIntent(
  container: HTMLElement | null,
  state: DetailsDisclosureState,
  intent: DetailsDisclosureClickIntent,
): void {
  if (intent.hadPreviousState) {
    state.set(intent.key, intent.previousState!);
  } else {
    state.delete(intent.key);
  }

  if (!container) return;
  Array.from(container.querySelectorAll<HTMLDetailsElement>("details")).forEach((details, index) => {
    if (disclosureKey(details, index) === intent.key) {
      details.open = intent.previousOpen;
    }
  });
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