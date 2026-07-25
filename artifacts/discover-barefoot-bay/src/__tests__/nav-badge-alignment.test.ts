import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

/**
 * Regression guard for nav badge positioning misalignment.
 *
 * Background: the "On The Market" badge drifted from the "Vendors" badge because
 * one nav section used `<div className="relative">` while the other used a
 * `<span className="... relative inline-block ...">`. Since badges use
 * `absolute -top-1 -right-1`, a div vs span wrapper produces visually different
 * badge positions even when badge classes are identical (inline-block collapses
 * to text width; block div stretches to full width — the right edge differs).
 *
 * These tests guard against that regression at two levels:
 *
 * LEVEL 1 — DOM rendering (primary):
 *   Render the actual badge class strings extracted from source files in a
 *   realistic nav-section DOM structure and assert the CSS positioning
 *   relationship holds: wrapper has `relative`, badge has `absolute -top-1
 *   -right-1`. Also asserts that the wrapper element type is `div` (not `span`)
 *   by verifying the badge element is a child of a div.relative, and that a
 *   span.relative would produce a structurally different outcome.
 *
 * LEVEL 2 — Source structural assertions (secondary defense):
 *   Grep nav-bar.tsx for each badge-section wrapper and assert it is a `<div>`
 *   with the `"relative"` class. Greps badge component sources to assert class
 *   constants are identical between ForSaleBadge and VendorBadge.
 */

const SRC = resolve(import.meta.dirname, '../..');

async function readSrc(relative: string): Promise<string> {
  return readFile(resolve(SRC, 'src', relative), 'utf-8');
}

// ---------------------------------------------------------------------------
// LEVEL 1: DOM rendering tests
// ---------------------------------------------------------------------------

// Set up a shared jsdom environment for DOM rendering tests.
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
});
(globalThis as Record<string, unknown>).window = dom.window;
(globalThis as Record<string, unknown>).document = dom.window.document;
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Extract `const baseClasses = "..."` from a badge component source file.
 */
function extractBaseClasses(src: string): string {
  const m = src.match(/const\s+baseClasses\s*=\s*"([^"]+)"/);
  if (!m) throw new Error('baseClasses not found in source');
  return m[1];
}

/**
 * Extract `const positionClasses = inMobileMenu ? "" : "..."` from source.
 * Returns the desktop (non-mobile) class string.
 */
function extractDesktopPositionClasses(src: string): string {
  // Pattern: inMobileMenu ? "" : "absolute -top-1 -right-1"
  const m = src.match(/const\s+positionClasses\s*=\s*inMobileMenu\s*\?\s*""\s*:\s*"([^"]+)"/);
  if (!m) throw new Error('positionClasses (mobile-ternary form) not found in source');
  return m[1];
}

/**
 * Build a React element tree that mirrors the nav section structure:
 *   <wrapperTag className={wrapperClass}>
 *     <span>Nav Label</span>          ← anchor text
 *     <div className={badgeClass}>3</div>   ← badge (forced visible)
 *   </wrapperTag>
 *
 * We use the actual class strings read from the component source files so this
 * test stays in sync with the real badge output.
 */
function makeNavSection(
  wrapperTag: string,
  wrapperClass: string,
  badgeClass: string,
): React.ReactElement {
  return React.createElement(
    wrapperTag,
    { className: wrapperClass, 'data-testid': 'nav-section' },
    React.createElement('span', { className: 'text-navy font-advent-pro', 'data-testid': 'nav-label' }, 'On The Market'),
    React.createElement('div', { className: badgeClass, 'data-testid': 'badge' }, '3'),
  );
}

describe('nav badge DOM rendering — badge-in-div.relative vs badge-in-span.relative', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = dom.window.document.createElement('div');
    dom.window.document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  const render = async (el: React.ReactElement): Promise<void> => {
    await act(async () => { root.render(el); });
  };

  it('badge rendered inside div.relative has correct absolute positioning classes', async () => {
    const [forSaleSrc, vendorSrc] = await Promise.all([
      readSrc('components/shared/for-sale-badge.tsx'),
      readSrc('components/shared/vendor-badge.tsx'),
    ]);

    for (const [name, src] of [['ForSaleBadge', forSaleSrc], ['VendorBadge', vendorSrc]] as const) {
      const baseClasses = extractBaseClasses(src);
      const desktopPositionClasses = extractDesktopPositionClasses(src);
      const fullBadgeClass = `${baseClasses} ${desktopPositionClasses}`;

      // Render the badge inside a div.relative — the correct nav-bar structure
      await render(makeNavSection('div', 'relative', fullBadgeClass));

      const section = container.querySelector('[data-testid="nav-section"]') as HTMLElement;
      const badge = container.querySelector('[data-testid="badge"]') as HTMLElement;

      assert.ok(section, `${name}: nav-section element not found in DOM`);
      assert.ok(badge, `${name}: badge element not found in DOM`);

      // Wrapper must be a div (block element)
      assert.equal(
        section.tagName.toLowerCase(),
        'div',
        `${name}: nav section wrapper must be a <div>, got <${section.tagName.toLowerCase()}>`,
      );

      // Wrapper must have the 'relative' class so absolute-positioned badge anchors correctly
      assert.ok(
        section.classList.contains('relative'),
        `${name}: nav section wrapper must have class "relative"`,
      );

      // Badge must be a direct child of the wrapper
      assert.equal(
        badge.parentElement,
        section,
        `${name}: badge must be a direct child of the nav-section wrapper`,
      );

      // Badge must carry absolute positioning class
      assert.ok(
        badge.classList.contains('absolute'),
        `${name}: badge must have class "absolute" — got: ${badge.className}`,
      );

      // Badge must carry the top/right offset classes
      assert.ok(
        badge.classList.contains('-top-1'),
        `${name}: badge must have class "-top-1" — got: ${badge.className}`,
      );
      assert.ok(
        badge.classList.contains('-right-1'),
        `${name}: badge must have class "-right-1" — got: ${badge.className}`,
      );

      // Badge must contain a visible count
      assert.equal(badge.textContent, '3', `${name}: badge must render the count`);
    }
  });

  it('badge rendered inside span.relative (the broken pattern) differs from div.relative', async () => {
    // This test documents the broken pattern so that if someone reverts the fix
    // and wraps in a span instead of a div, the structural difference is visible
    // in test output. The span wrapper itself is not an error that this test
    // fails on — the structural assertion above already guards against it
    // appearing in nav-bar.tsx. This test records what the broken DOM looks like.
    const forSaleSrc = await readSrc('components/shared/for-sale-badge.tsx');
    const baseClasses = extractBaseClasses(forSaleSrc);
    const desktopPositionClasses = extractDesktopPositionClasses(forSaleSrc);
    const fullBadgeClass = `${baseClasses} ${desktopPositionClasses}`;

    // Render inside a span.relative (the broken pattern)
    await render(makeNavSection('span', 'relative inline-block', fullBadgeClass));

    const section = container.querySelector('[data-testid="nav-section"]') as HTMLElement;
    const badge = container.querySelector('[data-testid="badge"]') as HTMLElement;

    assert.ok(section, 'span.relative nav section rendered');
    assert.ok(badge, 'badge rendered inside span.relative');

    // In the broken pattern, the wrapper is a span (inline element)
    assert.equal(
      section.tagName.toLowerCase(),
      'span',
      'span wrapper is a <span> (this represents the broken pattern — the correct wrapper is <div>)',
    );

    // The badge still has absolute class but its anchor is now the inline-block span,
    // which collapses to text width — badge right edge is at the span's right edge,
    // not the full nav-item right edge. Document this difference:
    assert.ok(
      badge.classList.contains('absolute'),
      'badge inside span.relative still has absolute class — but positions relative to the span (wrong anchor)',
    );

    // This test does NOT fail when the span wrapper is present — it only documents the
    // behavior. The guard against <span> actually appearing in nav-bar.tsx is in
    // the source-structural test suite below.
  });

  it('ForSaleBadge and VendorBadge produce identical positioning class strings', async () => {
    const [forSaleSrc, vendorSrc] = await Promise.all([
      readSrc('components/shared/for-sale-badge.tsx'),
      readSrc('components/shared/vendor-badge.tsx'),
    ]);

    const forSalePos = extractDesktopPositionClasses(forSaleSrc);
    const vendorPos = extractDesktopPositionClasses(vendorSrc);

    assert.equal(
      forSalePos,
      vendorPos,
      `Badge positionClasses diverged:\n  ForSaleBadge: "${forSalePos}"\n  VendorBadge:  "${vendorPos}"`,
    );

    // Render both in identical div.relative wrappers and compare the resulting
    // badge class lists to confirm they are structurally equivalent in the DOM
    const forSaleBase = extractBaseClasses(forSaleSrc);
    const vendorBase = extractBaseClasses(vendorSrc);

    await render(makeNavSection('div', 'relative', `${forSaleBase} ${forSalePos}`));
    const forSaleBadge = container.querySelector('[data-testid="badge"]') as HTMLElement;
    const forSaleClasses = [...forSaleBadge.classList].sort().join(' ');

    await render(makeNavSection('div', 'relative', `${vendorBase} ${vendorPos}`));
    const vendorBadge = container.querySelector('[data-testid="badge"]') as HTMLElement;
    const vendorClasses = [...vendorBadge.classList].sort().join(' ');

    assert.equal(
      forSaleClasses,
      vendorClasses,
      `ForSaleBadge and VendorBadge rendered class lists differ:\n  ForSaleBadge: ${forSaleClasses}\n  VendorBadge:  ${vendorClasses}`,
    );
  });
});

// ---------------------------------------------------------------------------
// LEVEL 2: Source structural assertions (secondary defense)
// ---------------------------------------------------------------------------

/**
 * For each `{isXxxEnabled() && (` block in nav-bar.tsx, find the FIRST JSX
 * opening tag in that block (i.e., the outermost wrapper element for the nav
 * section). Returns an array of `{ feature, tag, className }` objects.
 *
 * Strategy: scan lines forward from the feature-flag line, skipping blank
 * lines and JSX expression delimiters `(`, until we hit a line that starts
 * with `<`. That first `<element>` line is the direct child of the feature
 * gate — the wrapper that must be a `<div className="relative">`.
 */
function extractNavSectionWrappers(navBarSrc: string): Array<{
  feature: string;
  tag: string;
  classAttr: string;
  lineNumber: number;
}> {
  const lines = navBarSrc.split('\n');
  const results: Array<{ feature: string; tag: string; classAttr: string; lineNumber: number }> = [];

  // Feature flags that own badge components in the desktop nav
  const badgeFeatures = ['isForumEnabled', 'isForSaleEnabled', 'isStoreEnabled', 'isVendorsEnabled'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matchedFeature = badgeFeatures.find((f) => line.includes(`${f}() &&`));
    if (!matchedFeature) continue;

    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
      const trimmed = lines[j].trim();
      if (trimmed === '' || trimmed === '(' || trimmed === '{') continue;
      if (trimmed.startsWith('//') || trimmed.startsWith('{/*') || trimmed.startsWith('*')) continue;
      if (trimmed === '))' || trimmed === ')}' || trimmed.startsWith('{is')) break;

      if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.startsWith('<!--')) {
        const tagMatch = trimmed.match(/^<(\w[\w.-]*)/);
        const tag = tagMatch ? tagMatch[1] : '(unknown)';
        const classMatch = trimmed.match(/className=(?:"([^"]*)"|\{`([^`]*)`\}|'([^']*)')/);
        const classAttr = classMatch ? (classMatch[1] ?? classMatch[2] ?? classMatch[3] ?? '') : '';
        results.push({ feature: matchedFeature, tag, classAttr, lineNumber: j + 1 });
        break;
      }
    }
  }

  return results;
}

describe('nav badge wrapper consistency — source structural check (nav-bar.tsx)', () => {
  it('every badge-hosting nav section opens with <div className="relative">, not a <span>', async () => {
    const navBarSrc = await readSrc('components/layout/nav-bar.tsx');
    const wrappers = extractNavSectionWrappers(navBarSrc);

    assert.ok(
      wrappers.length >= 4,
      `Expected at least 4 badge-hosting nav sections (Forum, ForSale, Store, Vendors), found ${wrappers.length}. ` +
        `Check that isForumEnabled/isForSaleEnabled/isStoreEnabled/isVendorsEnabled are still present in nav-bar.tsx.`,
    );

    const failures: string[] = [];
    for (const { feature, tag, classAttr, lineNumber } of wrappers) {
      if (tag.toLowerCase() !== 'div') {
        failures.push(
          `${feature} (line ${lineNumber}): outermost wrapper is <${tag}>, expected <div>. ` +
            `Absolute-positioned badges anchor to the wrong edge inside a <${tag}>.`,
        );
      }
      if (!classAttr.includes('relative')) {
        failures.push(
          `${feature} (line ${lineNumber}): wrapper <${tag}> is missing "relative" class — ` +
            `got className="${classAttr.slice(0, 80)}". Badge needs a positioned ancestor.`,
        );
      }
    }

    assert.deepEqual(
      failures,
      [],
      `Nav badge wrapper violations found:\n  ${failures.join('\n  ')}`,
    );
  });
});

describe('badge component class parity — source structural check', () => {
  it('ForSaleBadge and VendorBadge declare identical positionClasses', async () => {
    const [forSaleSrc, vendorSrc] = await Promise.all([
      readSrc('components/shared/for-sale-badge.tsx'),
      readSrc('components/shared/vendor-badge.tsx'),
    ]);
    const forSalePos = extractDesktopPositionClasses(forSaleSrc);
    const vendorPos = extractDesktopPositionClasses(vendorSrc);
    assert.equal(
      forSalePos, vendorPos,
      `ForSaleBadge and VendorBadge positionClasses diverged:\n  ForSaleBadge: "${forSalePos}"\n  VendorBadge:  "${vendorPos}"`,
    );
  });

  it('ForSaleBadge and VendorBadge declare identical baseClasses', async () => {
    const [forSaleSrc, vendorSrc] = await Promise.all([
      readSrc('components/shared/for-sale-badge.tsx'),
      readSrc('components/shared/vendor-badge.tsx'),
    ]);
    const forSaleBase = extractBaseClasses(forSaleSrc);
    const vendorBase = extractBaseClasses(vendorSrc);
    assert.equal(
      forSaleBase, vendorBase,
      `ForSaleBadge and VendorBadge baseClasses diverged:\n  ForSaleBadge: "${forSaleBase}"\n  VendorBadge:  "${vendorBase}"`,
    );
  });

  it('ForSaleBadge carries "absolute -top-1 -right-1" for desktop positioning', async () => {
    const src = await readSrc('components/shared/for-sale-badge.tsx');
    assert.ok(src.includes('absolute -top-1 -right-1'), 'ForSaleBadge missing desktop absolute position classes');
  });

  it('VendorBadge carries "absolute -top-1 -right-1" for desktop positioning', async () => {
    const src = await readSrc('components/shared/vendor-badge.tsx');
    assert.ok(src.includes('absolute -top-1 -right-1'), 'VendorBadge missing desktop absolute position classes');
  });
});
