import assert from "node:assert/strict";
import { test } from "node:test";
import { golfCartTarget, legacyClubTarget, publicClubChoices, withoutLegacyClubAlias } from "../social-club-alias";

const canonical = { id: 447, slug: "social-golf-cart-club", title: "Golf Cart Club", visibilityStatus: "published", isHidden: false };
const legacy = { id: 397, slug: "social-page", title: "Golf Cart Club", visibilityStatus: "published", isHidden: false };

test("confirmed differently-slugged legacy record is one club, retaining preference alias", () => {
  const rows = [{ ...canonical, content: "Canonical media and history" }, { ...legacy, content: "Legacy retained" }];
  const before = structuredClone(rows);
  assert.deepEqual(publicClubChoices(rows), [{ id: 447, slug: canonical.slug, title: canonical.title, aliases: ["social-page"] }]);
  assert.equal(legacyClubTarget(legacy, rows)?.id, 447);
  assert.deepEqual(withoutLegacyClubAlias(rows), [rows[0]]);
  assert.deepEqual(rows, before, "projection must not modify content, records or references");
});

test("legitimate similarly titled named clubs and unconfirmed generic records are not merged", () => {
  const other = { ...canonical, id: 448, slug: "social-another-golf-club" };
  const unrelated = { ...legacy, id: 999 };
  assert.equal(publicClubChoices([canonical, other, legacy]).length, 2);
  assert.equal(publicClubChoices([canonical, unrelated]).length, 2);
  assert.equal(publicClubChoices([canonical, unrelated]).find(p => p.id === canonical.id)?.aliases, undefined,
    "do not assign another environment's unrelated generic-page preferences to Golf Cart Club");
  assert.equal(legacyClubTarget(unrelated, [canonical]), undefined);
});

for (const patch of [{ isHidden: true }, { visibilityStatus: "dmca_hidden" }, { visibilityStatus: "moderation_hidden" }]) {
  test(`hidden/removed canonical club cannot reappear through its legacy copy: ${JSON.stringify(patch)}`, () => {
    const identities = [{ ...canonical, ...patch }, legacy];
    assert.deepEqual(publicClubChoices(identities), []);
    assert.deepEqual(withoutLegacyClubAlias([legacy], identities), []);
  });
}

test("deleting canonical does not revive ghost; deleting legacy preserves saved preferences", () => {
  assert.deepEqual(publicClubChoices([legacy]), []);
  assert.equal(legacyClubTarget(legacy, [legacy]), undefined);
  assert.deepEqual(publicClubChoices([canonical])[0].aliases, ["social-page"]);
});

test("rename follows canonical ID, retaining original and legacy membership values", () => {
  const renamed = { ...canonical, slug: "social-cart-riders", title: "Cart Riders" };
  assert.equal(legacyClubTarget(legacy, [legacy, renamed])?.slug, renamed.slug);
  assert.equal(golfCartTarget([renamed])?.id, canonical.id);
  assert.deepEqual(publicClubChoices([legacy, renamed]), [{
    id: 447, slug: renamed.slug, title: renamed.title,
    aliases: ["social-golf-cart-club", "social-page"],
  }]);
});

test("hiding legacy does not surface older unrelated records sharing the placeholder address", () => {
  const older = { ...legacy, id: 392, title: "Garden Club" };
  assert.deepEqual(withoutLegacyClubAlias([older, canonical], [{ ...legacy, isHidden: true }, canonical]), [canonical]);
});
