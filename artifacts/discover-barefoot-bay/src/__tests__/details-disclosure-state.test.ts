import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  captureDetailsDisclosureClickIntent,
  captureDetailsDisclosureState,
  captureDetailsDisclosureToggle,
  rollbackDetailsDisclosureClickIntent,
  restoreDetailsDisclosureState,
} from "../lib/details-disclosure-state";

const CONTACT_DISCLOSURES = `
  <div class="meeting">
    <details><summary>Show phone number</summary><p>555-0100</p></details>
    <details><summary>Show email</summary><p>club@example.test</p></details>
  </div>
`;

test("restores an opened contact disclosure after CMS HTML is replaced", () => {
  const dom = new JSDOM(`<main>${CONTACT_DISCLOSURES}</main>`);
  const container = dom.window.document.querySelector("main")!;
  const state = new Map<string, boolean>();
  const [phone] = container.querySelectorAll("details");

  phone.open = true;
  captureDetailsDisclosureState(container, state, phone);

  // Mirrors React replacing a dangerouslySetInnerHTML container after a query
  // refresh: native <details> nodes are new and initially closed.
  container.innerHTML = CONTACT_DISCLOSURES;
  restoreDetailsDisclosureState(container, state);

  const [restoredPhone, restoredEmail] = container.querySelectorAll("details");
  assert.equal(restoredPhone.open, true);
  assert.equal(restoredEmail.open, false);
});

test("keeps a disclosure closed when the visitor closes it before a refresh", () => {
  const dom = new JSDOM(`<main>${CONTACT_DISCLOSURES}</main>`);
  const container = dom.window.document.querySelector("main")!;
  const state = new Map<string, boolean>();
  const [, email] = container.querySelectorAll("details");

  email.open = true;
  captureDetailsDisclosureState(container, state, email);
  email.open = false;
  captureDetailsDisclosureState(container, state, email);

  container.innerHTML = CONTACT_DISCLOSURES;
  restoreDetailsDisclosureState(container, state);

  const [, restoredEmail] = container.querySelectorAll("details");
  assert.equal(restoredEmail.open, false);
});

test("does not override a CMS default for an untouched disclosure", () => {
  const dom = new JSDOM(`<main>${CONTACT_DISCLOSURES}</main>`);
  const container = dom.window.document.querySelector("main")!;
  const state = new Map<string, boolean>();
  const [phone] = container.querySelectorAll("details");

  phone.open = true;
  captureDetailsDisclosureState(container, state, phone);

  // An admin intentionally opens the email disclosure in a later CMS update.
  container.innerHTML = CONTACT_DISCLOSURES.replace(
    "<details><summary>Show email",
    "<details open><summary>Show email",
  );
  restoreDetailsDisclosureState(container, state);

  const [restoredPhone, restoredEmail] = container.querySelectorAll("details");
  assert.equal(restoredPhone.open, true);
  assert.equal(restoredEmail.open, true);
});

test("records only the native disclosure that emitted a non-bubbling toggle event", () => {
  const dom = new JSDOM(`<main>${CONTACT_DISCLOSURES}</main>`);
  const container = dom.window.document.querySelector("main")!;
  const state = new Map<string, boolean>();
  const [phone, email] = container.querySelectorAll("details");

  container.addEventListener(
    "toggle",
    (event) => captureDetailsDisclosureToggle(container, state, event),
    true,
  );
  phone.open = true;
  phone.dispatchEvent(new dom.window.Event("toggle"));

  // A capture-phase listener receives a non-bubbling event and does not
  // accidentally store the untouched email disclosure.
  assert.equal(state.size, 1);

  container.innerHTML = CONTACT_DISCLOSURES.replace(
    "<details><summary>Show email",
    "<details open><summary>Show email",
  );
  restoreDetailsDisclosureState(container, state);

  const [restoredPhone, restoredEmail] = container.querySelectorAll("details");
  assert.equal(restoredPhone.open, true);
  assert.equal(restoredEmail.open, true);
  assert.equal(email.open, false);
});

test("keeps the first summary click when CMS HTML is replaced before toggle fires", () => {
  const dom = new JSDOM(`<main>${CONTACT_DISCLOSURES}</main>`);
  const container = dom.window.document.querySelector("main")!;
  const state = new Map<string, boolean>();

  container.addEventListener(
    "click",
    (event) =>
      captureDetailsDisclosureClickIntent(
        container,
        state,
        event as unknown as MouseEvent,
      ),
    true,
  );
  container.addEventListener("click", (event) => {
    const target = event.target as Element;
    if (!target.closest("summary")) return;

    // Reproduce the failing timing: React replaces CMS HTML during the click,
    // before the browser's queued native toggle event can be captured.
    container.innerHTML = CONTACT_DISCLOSURES;
    restoreDetailsDisclosureState(container, state);
  });

  container.querySelector<HTMLElement>("summary")!.click();
  assert.equal(container.querySelector("details")!.open, true);

  // The second activation remains native and closes the same disclosure.
  container.querySelector<HTMLElement>("summary")!.click();
  assert.equal(container.querySelector("details")!.open, false);
});

test("restores first-click state into a newly mounted content container", () => {
  const dom = new JSDOM(`<div id="page"><main>${CONTACT_DISCLOSURES}</main></div>`);
  const page = dom.window.document.querySelector("#page")!;
  const firstContainer = page.querySelector("main")!;
  const state = new Map<string, boolean>();
  const firstSummary = firstContainer.querySelector("summary")!;

  // Capture the intent from the real summary target before replacing the
  // entire content container, as happens during a transient parent remount.
  firstSummary.addEventListener(
    "click",
    (event) =>
      captureDetailsDisclosureClickIntent(
        firstContainer,
        state,
        event as unknown as MouseEvent,
      ),
    { capture: true, once: true },
  );
  firstSummary.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, button: 0 }));

  page.innerHTML = `<main>${CONTACT_DISCLOSURES}</main>`;
  const remountedContainer = page.querySelector("main")!;
  restoreDetailsDisclosureState(remountedContainer, state);

  assert.equal(remountedContainer.querySelector("details")!.open, true);
});

test("rolls back click intent when a later handler cancels native activation", async () => {
  const dom = new JSDOM(`<main>${CONTACT_DISCLOSURES}</main>`);
  const container = dom.window.document.querySelector("main")!;
  const state = new Map<string, boolean>();

  container.addEventListener(
    "click",
    (event) => {
      const intent = captureDetailsDisclosureClickIntent(
        container,
        state,
        event as unknown as MouseEvent,
      );
      if (!intent) return;
      queueMicrotask(() => {
        if (event.defaultPrevented) {
          rollbackDetailsDisclosureClickIntent(container, state, intent);
        }
      });
    },
    true,
  );
  container.addEventListener("click", (event) => {
    event.preventDefault();
    container.innerHTML = CONTACT_DISCLOSURES;
    restoreDetailsDisclosureState(container, state);
  });

  container.querySelector<HTMLElement>("summary")!.click();
  await new Promise<void>((resolve) => queueMicrotask(resolve));

  assert.equal(container.querySelector("details")!.open, false);
  assert.equal(state.size, 0);
});

test("captures a keyboard-synthesized primary click before replacement", () => {
  const dom = new JSDOM(`<main>${CONTACT_DISCLOSURES}</main>`);
  const container = dom.window.document.querySelector("main")!;
  const state = new Map<string, boolean>();
  const summary = container.querySelector("summary")!;

  container.addEventListener(
    "click",
    (event) =>
      captureDetailsDisclosureClickIntent(
        container,
        state,
        event as unknown as MouseEvent,
      ),
    true,
  );
  container.addEventListener("click", () => {
    container.innerHTML = CONTACT_DISCLOSURES;
    restoreDetailsDisclosureState(container, state);
  });

  summary.dispatchEvent(
    new dom.window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      detail: 0,
    }),
  );

  assert.equal(container.querySelector("details")!.open, true);
});