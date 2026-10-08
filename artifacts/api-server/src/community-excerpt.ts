import { parseDocument } from "htmlparser2";

type HtmlNode = ReturnType<typeof parseDocument>["children"][number];
type Frame =
  | { kind: "visit"; node: HtmlNode; structured: boolean; inParagraph: boolean }
  | { kind: "close"; tag: string; start: number; paragraph: boolean; inspect: boolean };

// Read content, not styles, executable text, navigation or disclosure controls.
const NON_CONTENT = new Set([
  "head", "title", "style", "script", "noscript", "template", "svg", "math", "iframe",
  "object", "canvas", "form", "input", "textarea", "select", "option", "datalist", "button", "nav",
  "footer", "aside", "summary",
]);
const STRUCTURED = new Set(["table", "ul", "ol", "dl"]);
const BLOCKS = new Set([
  "p", "div", "section", "article", "main", "header", "br", "hr", "blockquote",
  "ul", "ol", "li", "dl", "dt", "dd", "table", "thead", "tbody", "tfoot", "tr", "td", "th",
]);
const CONTROL_ROLES = new Set(["navigation", "menu", "menubar", "tablist", "button", "contentinfo", "tooltip"]);
const CONTROL_TEXT = new Set([
  "read more", "learn more", "view details", "click here", "join now", "contact us",
  "visit website", "show phone number", "show email", "back to clubs", "back to directory",
]);
const sentences = new Intl.Segmenter("en", { granularity: "sentence" });

function normalize(text: string) {
  return text.replace(/[\u200b\uFEFF]/g, "").replace(/\s+/gu, " ").trim();
}

function titleKey(text: string) {
  return normalize(text).toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]/gu, "");
}

function isRepeatedTitle(text: string, title: string) {
  const unlabelled = text.replace(/^(?:club(?: name)?|page(?: title)?|title)\s*:\s*/i, "");
  return !!title && titleKey(unlabelled) === titleKey(title);
}

function isControlText(text: string) {
  return CONTROL_TEXT.has(text.toLowerCase().replace(/[.!?…→»\s]+$/u, ""));
}

/** Keep a complete sentence when useful; otherwise clip between words, not mid-word. */
function shorten(text: string, limit: number) {
  const characters = Array.from(text);
  if (characters.length <= limit) return text;
  if (limit < 3) return "…".slice(0, limit);
  let complete = "";
  let candidate = "";
  for (const { segment } of sentences.segment(text)) {
    candidate += segment;
    if (Array.from(candidate.trim()).length > limit - 2) break;
    complete = candidate.trim();
  }
  if (complete.length >= Math.min(80, limit * 0.45)) return `${complete} …`;
  const prefix = characters.slice(0, limit - 1).join("");
  const boundary = prefix.lastIndexOf(" ");
  // An unbroken token still has to fit; Array.from keeps surrogate pairs intact.
  return `${(boundary > 0 ? prefix.slice(0, boundary) : prefix).trimEnd()}…`;
}

/** Derive an excerpt only. Never sanitize or rewrite the saved CMS document. */
export function communityExcerpt(html: string, title = "", limit = 220): string {
  const document = parseDocument(html, { decodeEntities: true });
  const parts: string[] = [];
  const paragraphs: string[] = [];
  const stack: Frame[] = document.children.slice().reverse().map(node => ({
    kind: "visit", node, structured: false, inParagraph: false,
  }));

  // Iterative traversal also tolerates deeply nested/malformed imported HTML.
  while (stack.length) {
    const frame = stack.pop()!;
    if (frame.kind === "close") {
      if (frame.inspect) {
        const text = normalize(parts.slice(frame.start).join(""));
        if (isRepeatedTitle(text, title) || isControlText(text)) {
          parts.splice(frame.start);
        } else if (frame.paragraph && text) {
          paragraphs.push(text);
        }
      }
      if (BLOCKS.has(frame.tag)) parts.push("\n");
      continue;
    }
    const { node, structured, inParagraph } = frame;
    if (node.type === "text") {
      parts.push(node.data);
      continue;
    }
    if (!("attribs" in node)) continue; // comments, directives and other non-text nodes
    const tag = node.name.toLowerCase();
    const attrs = node.attribs;
    if (
      NON_CONTENT.has(tag) || /^h[1-6]$/.test(tag) ||
      "hidden" in attrs || attrs["aria-hidden"]?.toLowerCase() === "true" ||
      CONTROL_ROLES.has(attrs.role?.toLowerCase()) ||
      /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse))\s*(?:!important\s*)?(?:;|$)/i.test(attrs.style ?? "") ||
      (tag === "details" && !("open" in attrs))
    ) continue;
    const start = parts.length;
    if (BLOCKS.has(tag)) parts.push("\n");
    stack.push({ kind: "close", tag, start, paragraph: tag === "p" && !structured && !inParagraph,
      inspect: tag === "p" && !inParagraph });
    const nextStructured = structured || STRUCTURED.has(tag);
    for (let i = node.children.length - 1; i >= 0; i--) {
      stack.push({ kind: "visit", node: node.children[i], structured: nextStructured, inParagraph: inParagraph || tag === "p" });
    }
  }
  const fallback = paragraphs.length ? "" : parts.join("").split(/\n+/).map(normalize)
    .filter(line => line && !isRepeatedTitle(line, title) && !isControlText(line)).join(" ");
  const text = normalize(paragraphs.length ? paragraphs.join(" ") : fallback);
  if (isRepeatedTitle(text, title) || isControlText(text)) return "";
  return shorten(text, Math.max(0, Math.floor(limit)));
}
