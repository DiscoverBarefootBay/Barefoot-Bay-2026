import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  captureDetailsDisclosureState,
  captureDetailsDisclosureToggle,
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