import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("App.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

test("page chunks are all dynamically imported with stable module-level lazy declarations", () => {
  let count = 0;
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      assert.equal(/(?:@\/|\.\/)pages\//.test(node.moduleSpecifier.getText(ast)), false);
    }
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "lazy") {
      count++;
      assert.ok(ts.isVariableDeclaration(node.parent));
      assert.ok(ts.isVariableDeclarationList(node.parent.parent));
      assert.ok(ts.isVariableStatement(node.parent.parent.parent));
      assert.equal(node.parent.parent.parent.parent, ast, "lazy identities must not be recreated on render");
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(count > 80);
  assert.doesNotMatch(source, /require\(/);
});

test("all messaging aliases share one stable lazy page and launch keeps a local suspense/error boundary", () => {
  for (const path of ["/messaging", "/messages", "/chat"]) {
    assert.ok(source.includes(`<Route path="${path}" component={ChatPage} />`));
  }
  const launch = source.slice(source.indexOf("function LaunchPageRoute"), source.indexOf("function Router"));
  assert.match(launch, /<ErrorBoundary>[\s\S]*<Suspense[\s\S]*<LaunchPage/);
  assert.match(source, /<ErrorBoundary key=\{location\}>[\s\S]*<Suspense[\s\S]*<Switch>/);
  assert.match(source, /const \[location\] = useLocation\(\)/);
});