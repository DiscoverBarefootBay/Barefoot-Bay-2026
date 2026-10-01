import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { readEvents, readActiveSponsors, parseEventReadOptions } from "../event-read-model";

function database(rows: any[], grouped: any[] = []) {
  const calls: any[] = [];
  const executor = {
    select(fields?: unknown) {
      const call: any = { fields };
      calls.push(call);
      const chain: any = {
        from() { return chain; },
        where(predicate: any) {
          call.where = predicate ? new PgDialect().sqlToQuery(predicate) : undefined;
          return chain;
        },
        groupBy() { call.grouped = true; return chain; },
        orderBy() { call.ordered = true; return chain; },
        limit(value: number) { call.limit = value; return chain; },
        then(resolve: any, reject: any) { return Promise.resolve(fields ? grouped : rows).then(resolve, reject); },
      };
      return chain;
    },
  };
  return { executor: executor as any, calls };
}

describe("event read model performance and contracts", () => {
  it("accepts legacy unbounded callers but rejects malformed/oversized date windows", () => {
    assert.deepEqual(parseEventReadOptions({}), {});
    for (const query of [
      { start: "2026-10-01" },
      { start: ["2026-10-01"], end: "2026-11-01" },
      { start: "bad", end: "worse" },
      { start: "2026-11-01T00:00:00Z", end: "2026-10-01T00:00:00Z" },
      { start: "2026-01-01T00:00:00Z", end: "2026-12-01T00:00:00Z" },
      { search: [] }, { search: "" }, { search: "x".repeat(201) },
    ]) assert.throws(() => parseEventReadOptions(query));
  });

  it("counts full-archive children in a single query regardless of parent count", async () => {
    const rows = Array.from({ length: 400 }, (_, i) => ({ id: i + 1, isRecurring: true, parentEventId: null }));
    rows.push({ id: 501, isRecurring: false, parentEventId: 1 } as any);
    rows.push({ id: 502, isRecurring: false, parentEventId: 1 } as any);
    const fake = database(rows);
    const results = await readEvents(fake.executor);
    assert.equal(fake.calls.length, 1);
    assert.equal((results[0] as any).childCount, 2);
    assert.equal((results[1] as any).childCount, 0);
    assert.equal((results[400] as any).childCount, undefined);
  });

  it("uses a single grouped count query for ranged parents, including children outside the window", async () => {
    const fake = database([{ id: 7, isRecurring: true, parentEventId: null }], [{ parentId: 7, count: 100 }]);
    const options = parseEventReadOptions({ start: "2026-10-01T04:00:00Z", end: "2026-11-01T04:00:00Z" });
    const results = await readEvents(fake.executor, options);
    assert.equal(fake.calls.length, 2);
    assert.match(fake.calls[0].where.sql, /"start_date" < .*"end_date" >=/);
    assert.equal(fake.calls[1].grouped, true);
    assert.deepEqual(fake.calls[1].where.params, [7]);
    assert.equal((results[0] as any).childCount, 100);
  });

  it("does not count children when no recurring parents are in a range", async () => {
    const fake = database([]);
    await readEvents(fake.executor, parseEventReadOptions({ start: "2026-10-01T00:00:00Z", end: "2026-11-01T00:00:00Z" }));
    assert.equal(fake.calls.length, 1);
  });

  it("parameterizes title search and escapes wildcard characters across history", async () => {
    const fake = database([]);
    await readEvents(fake.executor, parseEventReadOptions({ search: "  50%_off  " }));
    assert.match(fake.calls[0].where.sql, /ilike \$1/);
    assert.deepEqual(fake.calls[0].where.params, ["%50\\%\\_off%"]);
    assert.doesNotMatch(fake.calls[0].where.sql, /start_date/);
  });

  it("queries only active, public, parent sponsors with a three-item limit", async () => {
    const fake = database([]);
    await readActiveSponsors(fake.executor, new Date("2026-10-01T00:00:00Z"));
    assert.equal(fake.calls.length, 1);
    assert.equal(fake.calls[0].limit, 3);
    assert.equal(fake.calls[0].ordered, true);
    assert.match(fake.calls[0].where.sql, /"parent_event_id" is null/);
    assert.match(fake.calls[0].where.sql, /visibility_status/);
    assert.ok(fake.calls[0].where.params.includes("platinum_sponsor"));
  });
});