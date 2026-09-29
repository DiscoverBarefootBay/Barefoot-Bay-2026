import React from 'react';

// New messages are plain text. Some older messages were saved as HTML, without a
// content-type flag, so only recognize HTML that starts with a known rich-text tag.
const LEGACY_HTML = /^\s*<(?:p|div|br|ul|ol|li|blockquote|h[1-6]|strong|b|em|i|a)(?:\s|\/?>)/i;
const INLINE_TAGS = new Set(['strong', 'b', 'em', 'i', 'u', 'code']);
const BLOCK_TAGS = new Set(['p', 'div', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const DISCARD_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form', 'template']);

function safeLegacyNodes(nodes: NodeListOf<ChildNode> | NodeListOf<Node>, prefix = ''): React.ReactNode[] {
  return Array.from(nodes, (node, index) => {
    const key = `${prefix}-${index}`;
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1) return null;
    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    if (DISCARD_TAGS.has(tag)) return null;
    if (tag === 'br') return <br key={key} />;
    const children = safeLegacyNodes(element.childNodes, key);
    if (tag === 'a') {
      const href = element.getAttribute('href')?.trim() || '';
      // Never preserve arbitrary HTML attributes or executable URL schemes.
      if (/^(?:https?:\/\/|mailto:)/i.test(href)) {
        return <a key={key} href={href} rel="noopener noreferrer">{children}</a>;
      }
      return <React.Fragment key={key}>{children}</React.Fragment>;
    }
    if (INLINE_TAGS.has(tag) || BLOCK_TAGS.has(tag)) {
      return React.createElement(tag, { key }, children);
    }
    return <React.Fragment key={key}>{children}</React.Fragment>;
  });
}

export function MessageBody({ content }: { content: string | null | undefined }) {
  if (!content) return null;

  if (LEGACY_HTML.test(content) && typeof DOMParser !== 'undefined') {
    const document = new DOMParser().parseFromString(content, 'text/html');
    return <div className="prose prose-sm max-w-none break-words">{safeLegacyNodes(document.body.childNodes)}</div>;
  }

  // React escapes text; pre-wrap preserves both single newlines and blank lines.
  return <div className="whitespace-pre-wrap break-words">{content.replace(/\r\n?/g, '\n')}</div>;
}