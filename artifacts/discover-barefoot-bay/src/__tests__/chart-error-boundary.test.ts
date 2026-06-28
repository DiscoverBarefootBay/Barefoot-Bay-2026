import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import ChartErrorBoundary from '../components/error/chart-error-boundary';

/**
 * Regression guard for the "stuck Analytics chart" bug.
 *
 * A one-off chart render failure used to pin the ChartErrorBoundary fallback
 * forever. The boundary now takes a `resetKeys` prop (see
 * `components/error/chart-error-boundary.tsx`): when any value in that array
 * changes, the boundary clears its error and re-attempts rendering. The
 * analytics dashboard keys each chart on its driving inputs
 * (e.g. `[range, filterBots, journeyType, data.length]`) so changing a filter
 * self-heals a transient failure.
 *
 * These tests exercise the real boundary against a child that throws once:
 *  - changing `resetKeys` must clear the fallback and render the recovered child
 *  - leaving `resetKeys` unchanged must keep the boundary in the fallback
 */

// --- jsdom environment (the boundary needs a real DOM renderer + lifecycle) ---
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
});

(globalThis as unknown as { window: unknown }).window = dom.window;
(globalThis as unknown as { document: unknown }).document = dom.window.document;
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A child that throws on demand so we can simulate a transient chart failure. */
function Bomb({ shouldThrow }: { shouldThrow: boolean }): React.ReactElement {
  if (shouldThrow) {
    throw new Error('simulated chart render failure');
  }
  return React.createElement('div', null, 'chart-content');
}

const FALLBACK = /be displayed/;
const CHART = /chart-content/;

describe('ChartErrorBoundary resetKeys recovery', () => {
  let container: HTMLDivElement;
  let root: Root;
  // React logs caught render errors to console.error; silence it for clean output.
  const originalConsoleError = console.error;

  before(() => {
    console.error = () => {};
  });

  after(() => {
    console.error = originalConsoleError;
  });

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

  const render = async (element: React.ReactElement): Promise<void> => {
    await act(async () => {
      root.render(element);
    });
  };

  it('clears the fallback and renders the child when resetKeys change', async () => {
    await render(
      React.createElement(
        ChartErrorBoundary,
        { resetKeys: [1] },
        React.createElement(Bomb, { shouldThrow: true }),
      ),
    );
    assert.match(container.textContent ?? '', FALLBACK, 'expected the fallback after the throw');
    assert.doesNotMatch(container.textContent ?? '', CHART);

    // Same as a user changing a filter: data changes, the failure was transient.
    await render(
      React.createElement(
        ChartErrorBoundary,
        { resetKeys: [2] },
        React.createElement(Bomb, { shouldThrow: false }),
      ),
    );
    assert.match(container.textContent ?? '', CHART, 'expected the recovered chart after resetKeys change');
    assert.doesNotMatch(container.textContent ?? '', FALLBACK);
  });

  it('stays in the fallback when resetKeys do NOT change', async () => {
    await render(
      React.createElement(
        ChartErrorBoundary,
        { resetKeys: [1] },
        React.createElement(Bomb, { shouldThrow: true }),
      ),
    );
    assert.match(container.textContent ?? '', FALLBACK, 'expected the fallback after the throw');

    // Re-render with identical resetKeys: even though the child would now succeed,
    // the boundary must remain pinned to the fallback (no self-reset).
    await render(
      React.createElement(
        ChartErrorBoundary,
        { resetKeys: [1] },
        React.createElement(Bomb, { shouldThrow: false }),
      ),
    );
    assert.match(container.textContent ?? '', FALLBACK, 'expected the boundary to stay in the fallback');
    assert.doesNotMatch(container.textContent ?? '', CHART);
  });
});
