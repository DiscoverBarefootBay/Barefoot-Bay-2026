import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { createLegalRecheckBatcher } from "../lib/legal-recheck";

test("focus/visibility/navigation bursts block immediately but issue one latest check", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 100 });
  let invalidations = 0; let checks = 0; const completions: number[] = [];
  const batch = createLegalRecheckBatcher(() => { invalidations++; }, async () => { checks++; }, t => completions.push(t));
  batch.request();
  mock.timers.tick(20);
  batch.request();
  batch.request();
  assert.equal(invalidations, 3);
  assert.equal(checks, 0);
  mock.timers.tick(50);
  await Promise.resolve();
  assert.equal(checks, 1);
  assert.deepEqual(completions, [170]);
  batch.dispose();
  mock.timers.reset();
});
test("a signal after request start cannot authorize from that older request", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 100 });
  const resolve: (() => void)[] = []; const completions: number[] = [];
  const batch = createLegalRecheckBatcher(() => {}, () => new Promise<void>(done => resolve.push(done)), t => completions.push(t));
  batch.request();
  mock.timers.tick(50);
  batch.request();
  resolve[0]();
  await Promise.resolve();
  assert.deepEqual(completions, []);
  mock.timers.tick(50);
  resolve[1]();
  await Promise.resolve();
  assert.deepEqual(completions, [200]);
  batch.dispose();
  mock.timers.reset();
});
test("cleanup and failures cannot restore a cached grant", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  let checks = 0; let completions = 0;
  const batch = createLegalRecheckBatcher(() => {}, async () => { checks++; throw Error("offline"); }, () => { completions++; });
  batch.request();
  batch.dispose();
  mock.timers.tick(50);
  assert.equal(checks, 0);
  batch.request(); // effect setup replay
  mock.timers.tick(50);
  await Promise.resolve();
  assert.equal(checks, 1);
  assert.equal(completions, 0);
  batch.dispose();
  mock.timers.reset();
});