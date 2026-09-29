import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { MessageBody } from '../components/chat/MessageBody';

function render(content: string) {
  return renderToStaticMarkup(React.createElement(MessageBody, { content }));
}

test('plain message and reply text keep single newlines, blank lines, and wrapping', () => {
  const content = 'First line\r\nsecond line\r\n\r\nA long paragraph that wraps naturally.\n\nLast paragraph';
  const markup = render(content);
  assert.match(markup, /whitespace-pre-wrap/);
  assert.match(markup, /First line\nsecond line\n\nA long paragraph that wraps naturally\.\n\nLast paragraph/);
  assert.match(markup, /break-words/);
  assert.doesNotMatch(markup, /<br|<p/);
});

test('literal markup in plain text is escaped, not executed or interpreted', () => {
  const markup = render('Hello <img src=x onerror=alert(1)>\n<script>alert(1)</script> & friends');
  assert.match(markup, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(markup, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(markup, /<script|<img/);
});

test('recognized historical HTML remains readable but executable content is discarded', () => {
  const previousParser = globalThis.DOMParser;
  globalThis.DOMParser = new JSDOM('').window.DOMParser;
  try {
    const markup = render('<p onclick="alert(1)">First <strong>bold</strong><br>line</p><p>Second <a href="javascript:alert(1)">unsafe link</a> <a href="https://example.com">safe link</a></p><script>alert(1)</script>');
    assert.match(markup, /<p>First <strong>bold<\/strong><br\/>line<\/p><p>Second unsafe link <a href="https:\/\/example.com"/);
    assert.doesNotMatch(markup, /onclick|javascript:|<script|alert\(1\)/);
  } finally {
    globalThis.DOMParser = previousParser;
  }
});