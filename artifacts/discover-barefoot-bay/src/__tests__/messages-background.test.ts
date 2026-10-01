import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

function classesIn(file: string) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const classes: string[][] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === "className" &&
        node.initializer && ts.isStringLiteral(node.initializer)) {
      classes.push(node.initializer.text.split(/\s+/));
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return classes;
}

test("messages outer surround is transparent without changing spacing or adding decoration", () => {
  const classes = classesIn("../pages/chat.tsx");
  const outer = classes.find(tokens => tokens.includes("min-h-screen"));
  assert.deepEqual(outer, ["min-h-screen", "bg-transparent", "pt-4", "pb-8", "px-4", "md:px-0"]);
  assert.ok(classes.some(tokens => tokens.join(" ") === "max-w-5xl mx-auto"),
    "the inner messages width and centering stay unchanged");
});

test("white desktop panel and both mobile list/detail panels remain opaque", () => {
  const desktop = classesIn("../components/chat/Chat.tsx");
  assert.ok(desktop.some(tokens => tokens.join(" ") === "bg-white rounded-lg shadow"),
    "only the surround changes, not the desktop panel itself");
  const mobile = classesIn("../components/chat/MobileChat.tsx")
    .filter(tokens => ["flex", "flex-col", "h-full"].every(token => tokens.includes(token)));
  assert.equal(mobile.length, 2, "both list/composer and selected-detail branches are checked");
  for (const panel of mobile) {
    assert.deepEqual(panel, ["flex", "flex-col", "h-full", "bg-white"],
      "mobile message content stays white while the surrounding site shows through");
  }
});

test("all messaging aliases use the same transparent page and responsive layouts", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  for (const alias of ["/messaging", "/messages", "/chat"]) {
    assert.ok(app.includes(`<Route path="${alias}" component={ChatPage} />`));
  }
  const page = readFileSync(new URL("../pages/chat.tsx", import.meta.url), "utf8");
  assert.match(page, /<ChatProvider>[\s\S]*isMobile \? <MobileChat \/> : <Chat \/>[\s\S]*<\/ChatProvider>/);
});