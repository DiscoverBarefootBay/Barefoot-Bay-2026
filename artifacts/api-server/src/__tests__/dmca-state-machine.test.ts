import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertTransition,
  canTransition,
  DMCA_TRANSITIONS,
  DmcaCaseStatus,
  InvalidDmcaTransitionError,
  isDmcaStatus,
} from "../dmca/state-machine";
import { formatCaseNumber, parseCaseNumber } from "../dmca/case-number";

describe("DMCA state machine", () => {
  it("accepts every transition explicitly present in the transition table", () => {
    for (const [from, destinations] of Object.entries(DMCA_TRANSITIONS)) {
      for (const to of destinations) {
        assert.equal(canTransition(from, to), true);
        assert.doesNotThrow(() => assertTransition(from, to));
      }
    }
  });

  it("rejects disallowed transitions with the typed conflict error", () => {
    assert.throws(
      () => assertTransition(DmcaCaseStatus.RECEIVED, DmcaCaseStatus.RESTORED),
      (error: unknown) => error instanceof InvalidDmcaTransitionError && error.statusCode === 409,
    );
    assert.equal(canTransition(DmcaCaseStatus.CLOSED, DmcaCaseStatus.RECEIVED), false);
  });

  it("rejects unknown statuses", () => {
    assert.equal(isDmcaStatus("invented"), false);
    assert.equal(canTransition("invented", DmcaCaseStatus.RECEIVED), false);
    assert.throws(() => assertTransition("invented", DmcaCaseStatus.RECEIVED), InvalidDmcaTransitionError);
  });
});

describe("DMCA case numbers", () => {
  it("formats and parses the documented representation", () => {
    assert.equal(formatCaseNumber(2026, 142), "BB-DMCA-2026-000142");
    assert.deepEqual(parseCaseNumber("BB-DMCA-2026-000142"), { year: 2026, seq: 142 });
  });

  it("rejects malformed inputs", () => {
    assert.equal(parseCaseNumber("DMCA-2026-142"), null);
    assert.throws(() => formatCaseNumber(1999, 1));
    assert.throws(() => formatCaseNumber(2026, 0));
  });
});