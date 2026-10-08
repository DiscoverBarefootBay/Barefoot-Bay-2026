import assert from "node:assert/strict";
import { test } from "node:test";
import { communityExcerpt } from "../community-excerpt";

test("stylesheet-first club templates yield actual introductory sentences", () => {
  const html = `<style>.prose:has(.club-master)>h1{display:none!important}
    .club-master,.club-master *{box-sizing:border-box;font-family:Arial}</style>
    <div class="club-master"><header><img src="/banner.jpg"><h1>AA Meeting</h1></header>
    <nav><a href="#join">Join us</a></nav><h2>About our club</h2>
    <p>Neighbors support each other in a welcoming group.</p>
    <p>Meetings take place twice a week.</p><footer>Website template copyright</footer></div>`;
  assert.equal(communityExcerpt(html, "AA Meeting"),
    "Neighbors support each other in a welcoming group. Meetings take place twice a week.");
});

test("styles, scripts, comments, SVG and template contents never become descriptions", () => {
  assert.equal(communityExcerpt(`<STYLE media="all">.x{color:red}</STYLE><!-- ignored -->
    <script>window.alert("ignored")</script><template><p>Template text</p></template>
    <noscript>Enable scripts</noscript><svg><text>Decorative label</text></svg>
    <p>Enjoy music with your neighbors.</p>`), "Enjoy music with your neighbors.");
});

test("introductory paragraphs take priority over leading metadata tables", () => {
  assert.equal(communityExcerpt(`<table><tr><th>Location</th><td>Building X</td></tr></table>
    <p>Our club brings residents together through art.</p><p>All abilities are welcome.</p>`),
    "Our club brings residents together through art. All abilities are welcome.");
});

test("repeated headings and labelled title paragraphs are omitted without losing substantive text", () => {
  assert.equal(communityExcerpt(`<h1>Artists’ Guild</h1><p>Club: Artists' Guild</p>
    <p>Artists’ Guild welcomes new members.</p>`, "Artists' Guild"),
    "Artists’ Guild welcomes new members.");
});

test("named/numeric entities and visible link text are decoded without executing markup", () => {
  assert.equal(communityExcerpt(`<p>Art&nbsp;&amp;&nbsp;music &copy; &#8212; &#x1F3A8;
    <a href="/events">community events</a> &ldquo;welcome&rdquo; &lt;hello&gt;.</p>`),
    "Art & music © — 🎨 community events “welcome” <hello>.");
  assert.equal(communityExcerpt('<p>Join <a href="/club">Chess Club</a> for friendly games.</p>', "Chess Club"),
    "Join Chess Club for friendly games.");
  assert.equal(communityExcerpt('<p>Please <a href="/contact">contact us</a> to join.</p>'),
    "Please contact us to join.");
});

test("adjacent blocks are separated but inline words are not artificially split", () => {
  assert.equal(communityExcerpt("<div>First area</div><div>Second area<br>Third area</div>"),
    "First area Second area Third area");
  assert.equal(communityExcerpt("<p>Join our <strong>friendly</strong> neighbors.</p><p>Everyone is welcome.</p>"),
    "Join our friendly neighbors. Everyone is welcome.");
});

test("list/table-only pages retain useful text and cell/list boundaries", () => {
  assert.equal(communityExcerpt(`<ul><li><p>Walks on Tuesday</p></li><li><p>Games on Friday</p></li></ul>
    <table><tr><th>Venue</th><td><p>Community Hall</p></td></tr></table>`),
    "Walks on Tuesday Games on Friday Venue Community Hall");
});

test("hidden elements and closed disclosures do not leak into excerpts; open prose remains readable", () => {
  assert.equal(communityExcerpt(`<p hidden>Hidden</p><div aria-hidden="true"><p>Hidden again</p></div>
    <p style="display: none !important">Hidden third</p><p style="visibility:hidden;">Hidden fourth</p>
    <details><summary>Show contact</summary><p>Concealed contact text</p></details>
    <details open><summary>Read more</summary><p>Weekly gatherings welcome all residents.</p></details>`),
    "Weekly gatherings welcome all residents.");
});

test("standalone navigation/reveal controls are not used as fallback prose", () => {
  assert.equal(communityExcerpt(`<p>Read more →</p><a href="#">Visit website</a>
    <button>Join us</button><form>Signup labels</form><div role="navigation">Menu links</div>`), "");
});

test("empty/image-only/style-only pages and title-only pages have no invented description", () => {
  for (const html of ["", "<img src='/photo.jpg' alt='A long description'>",
    "<style>.x{display:none}</style><script>console.log('text')</script>",
    "<h1>Chess Club</h1><p>Club Name: Chess Club</p>", "<div>Chess Club</div>", "<span>Chess Club</span>"]) {
    assert.equal(communityExcerpt(html, "Chess Club"), "");
  }
});

test("malformed imported HTML is parsed as readable body text", () => {
  assert.equal(communityExcerpt("<p>We welcome <strong>everyone.<p>Join our weekly gathering."),
    "We welcome everyone. Join our weekly gathering.");
  assert.equal(communityExcerpt("<style>.bad{font:Arial}"), "");
});

test("a useful complete sentence is preferred over a partial next sentence", () => {
  const first = "Our community club welcomes residents interested in learning, friendship and shared activities.";
  assert.equal(communityExcerpt(`<p>${first} ${"More information about gatherings ".repeat(10)}</p>`),
    `${first} …`);
});

test("long prose ends at a word boundary and never exceeds the character budget", () => {
  const text = "Residents gather to share ideas and enjoy activities with their neighbors ".repeat(8);
  const excerpt = communityExcerpt(`<p>${text}</p>`);
  assert.ok(Array.from(excerpt).length <= 220);
  assert.ok(excerpt.endsWith("…"));
  assert.ok(text.includes(`${excerpt.slice(0, -1)} `), "must not cut a word midway");
  assert.equal(communityExcerpt("<p>A short sentence.</p>"), "A short sentence.");
});

test("overlong unbroken Unicode tokens stay bounded without breaking surrogate pairs", () => {
  const excerpt = communityExcerpt(`<p>${"🎨".repeat(400)}</p>`);
  assert.equal(Array.from(excerpt).length, 220);
  assert.ok(!excerpt.includes("\uFFFD"));
  assert.equal(communityExcerpt("Useful content", "", 0), "");
});

test("deeply nested malformed imports do not overflow the call stack", () => {
  assert.equal(communityExcerpt(`${"<div>".repeat(6000)}Welcome to our group.${"</div>".repeat(6000)}`),
    "Welcome to our group.");
});
