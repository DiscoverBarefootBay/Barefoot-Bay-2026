import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAcceptances,
  isConsentExemptPath,
  isPolicyStaleError,
  parseConsentStatus,
  parsePolicies,
  reconcileSelections,
  type LegalPolicy,
} from "../lib/legal";
import { responseSignalsPolicyRequired } from "../lib/legal-intercept";

const p = (key: "terms" | "privacy" | "dmca", versionId: number): LegalPolicy => ({
  key,
  versionId,
  title: key,
  url: `/${key}`,
  publishedAt: "2026-01-02T00:00:00Z",
  contentHtml: "<p>x</p>",
  changeNotes: null,
});
const all = [p("terms", 1), p("privacy", 2), p("dmca", 3)];

describe("consent status parsing never grants on bad data", () => {
  for (const bad of [null, [], {}, "", { policies: [], outstanding: [] }, { policies: [], outstanding: [], requiresAcceptance: "false" }]) {
    it(`rejects ${JSON.stringify(bad)}`, () => {
      assert.throws(() => parseConsentStatus(bad));
    });
  }
  it("forces acceptance when outstanding is non-empty even if flag false", () => {
    const s = parseConsentStatus({ policies: all, outstanding: [all[0]], requiresAcceptance: false });
    assert.equal(s.requiresAcceptance, true);
  });
  it("accepts a valid current status", () => {
    const s = parseConsentStatus({ policies: all, outstanding: [], requiresAcceptance: false });
    assert.equal(s.requiresAcceptance, false);
  });
  it("rejects malformed policy entries", () => {
    assert.throws(() => parseConsentStatus({ policies: [{ key: "terms" }], outstanding: [], requiresAcceptance: false }));
  });
});

describe("policy manifest", () => {
  it("requires all three policies", () => {
    assert.throws(() => parsePolicies({ policies: [all[0], all[1]] }));
    assert.throws(() => parsePolicies([]));
    assert.equal(parsePolicies({ policies: all }).length, 3);
  });
});

describe("acceptance selection", () => {
  it("requires every policy explicitly selected at the exact version", () => {
    assert.equal(buildAcceptances(all, {}), null);
    assert.equal(buildAcceptances(all, { terms: 1, privacy: 2 }), null);
    assert.equal(buildAcceptances(all, { terms: 1, privacy: 2, dmca: 99 }), null);
    assert.deepEqual(buildAcceptances(all, { terms: 1, privacy: 2, dmca: 3 }), [
      { key: "terms", versionId: 1, accepted: true },
      { key: "privacy", versionId: 2, accepted: true },
      { key: "dmca", versionId: 3, accepted: true },
    ]);
    assert.equal(buildAcceptances([], {}), null);
  });
  it("drops selections for a policy republished during review", () => {
    const r = reconcileSelections({ terms: 1, privacy: 2 }, [p("terms", 4), p("privacy", 2)]);
    assert.deepEqual(r.selections, { privacy: 2 });
    assert.equal(r.dropped, true);
  });
  it("detects stale-version errors", () => {
    assert.ok(isPolicyStaleError({ status: 409 }));
    assert.ok(isPolicyStaleError({ code: "POLICY_ACCEPTANCE_REQUIRED" }));
    assert.ok(!isPolicyStaleError({ status: 500 }));
  });
});

describe("exempt routes stay narrow", () => {
  for (const path of ["/terms", "/privacy", "/dmca", "/dmca/notice", "/dmca/status/abc", "/forgot-password", "/reset-password?token=1", "/copyright-notices/C-1/counter-notice", "/copyright-notices", "/copyright-notices/", "/copyright-notices/BB-2026-0042"]) {
    it(`allows ${path}`, () => assert.ok(isConsentExemptPath(path)));
  }
  for (const path of ["/", "/profile", "/admin", "/copyright-notices/C-1/edit", "/copyright-notices/C-1/counter-notice/x", "/admin/copyright-notices", "/activity", "/inbox", "/messages", "/dmca-evil", "/terms/extra", "/auth"]) {
    it(`blocks ${path}`, () => assert.ok(!isConsentExemptPath(path)));
  }
});

describe("network intercept", () => {
  it("signals only same-origin api 428s and consent 409s", () => {
    (globalThis as any).window = { location: { origin: "http://localhost" } };
    assert.ok(responseSignalsPolicyRequired(428, "/api/forum/posts"));
    assert.ok(responseSignalsPolicyRequired(409, "/api/legal/consent"));
    assert.ok(!responseSignalsPolicyRequired(409, "/api/forum/posts"));
    assert.ok(!responseSignalsPolicyRequired(428, "https://example.org/api/x"));
    assert.ok(!responseSignalsPolicyRequired(200, "/api/x"));
  });
});

import { decideGate, LEGAL_QUERY_KEYS } from "../lib/legal";

describe("gate decision freshness and identity", () => {
  const ok = { policies: all, outstanding: [], requiresAcceptance: false };
  const base = { signedIn: true, exempt: false, authLoading: false, isError: false, status: ok, dataUpdatedAt: 100, freshAfter: 50 };
  it("renders children only with a fresh accepted status", () => {
    assert.equal(decideGate(base), "children");
  });
  it("blocks (verifying) when accepted status predates a navigation/focus/428 recheck", () => {
    assert.equal(decideGate({ ...base, freshAfter: 200 }), "verifying");
  });
  it("never mounts children with unknown status", () => {
    assert.equal(decideGate({ ...base, status: undefined }), "skeleton");
    assert.equal(decideGate({ ...base, authLoading: true }), "skeleton");
  });
  it("errors instead of granting on fetch failure even with old accepted data", () => {
    assert.equal(decideGate({ ...base, isError: true }), "error");
  });
  it("prompts on outstanding, errors on inconsistent status", () => {
    assert.equal(decideGate({ ...base, status: { policies: all, outstanding: [all[0]], requiresAcceptance: true } }), "prompt");
    assert.equal(decideGate({ ...base, status: { policies: all, outstanding: [], requiresAcceptance: true } }), "error");
  });
  it("prompts even if stale (outstanding always wins)", () => {
    assert.equal(decideGate({ ...base, freshAfter: 999, status: { policies: all, outstanding: [all[1]], requiresAcceptance: true } }), "prompt");
  });
  it("exempt and anonymous paths render children", () => {
    assert.equal(decideGate({ ...base, exempt: true, isError: true }), "children");
    assert.equal(decideGate({ ...base, signedIn: false, status: undefined }), "children");
  });
  it("scopes consent cache by account", () => {
    assert.notDeepEqual(LEGAL_QUERY_KEYS.consent(1), LEGAL_QUERY_KEYS.consent(2));
    assert.deepEqual(LEGAL_QUERY_KEYS.consent(7).slice(0, 2), [...LEGAL_QUERY_KEYS.consentRoot]);
  });
});

import { LegalApiError, isPolicyRequiredError as needsPolicy } from "../lib/legal";
describe("filed-claims 428 handling", () => {
  it("classifies 428 claims failures as policy-required, not generic", () => {
    assert.ok(needsPolicy(new LegalApiError("x", 428, null)));
    assert.ok(needsPolicy(new LegalApiError("x", 403, "POLICY_ACCEPTANCE_REQUIRED")));
    assert.ok(!needsPolicy(new LegalApiError("x", 500, null)));
    assert.ok(!needsPolicy(new LegalApiError("x", 409, null)));
  });
});
