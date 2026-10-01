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

test("generic route feedback reuses the decorative wave with a neutral accessible status", () => {
  const fallback = source.slice(source.indexOf("function RouteLoading"), source.indexOf("function LaunchPageRoute"));
  assert.match(source, /import \{ BrandedLoadingMark \} from "\.\/components\/shared\/branded-loading-mark"/);
  assert.match(fallback, /role="status" aria-live="polite" data-testid="status-route-loading"/);
  assert.match(fallback, /<span className="sr-only">Loading<\/span>/);
  assert.match(fallback, /<BrandedLoadingMark \/>/);
  assert.match(fallback, /min-h-24/);
  assert.match(fallback, /bg-white/, "opaque backing preserves wave contrast on the black launch screen");
  assert.doesNotMatch(fallback, /Loading page|account|policy|setTimeout|useEffect|useState/);
  assert.equal((source.match(/fallback=\{<RouteLoading \/>\}/g) ?? []).length, 2);
});

test("route suspense remains inside the mounted layout and does not enclose the header", () => {
  const router = source.slice(source.indexOf("function Router"));
  assert.match(router, /<NavBar \/>[\s\S]*<main[^>]*>[\s\S]*<ErrorBoundary key=\{location\}>[\s\S]*<Suspense fallback=\{<RouteLoading \/>\}>[\s\S]*<Switch>/);
  const suspense = router.slice(router.indexOf("<Suspense"), router.indexOf("</Suspense>"));
  assert.doesNotMatch(suspense, /<NavBar|<BackgroundVideo|<LegalConsentGate/);
});

test("shared wave reserves its geometry and only animates without reduced motion", () => {
  const mark = readFileSync(new URL("../components/shared/branded-loading-mark.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../components/shared/branded-loading-mark.css", import.meta.url), "utf8");
  assert.match(mark, /aria-hidden="true"/);
  assert.match(mark, /focusable="false"/);
  assert.match(css, /width: 44px; height: 24px/);
  const motion = css.slice(css.indexOf("@media (prefers-reduced-motion: no-preference)"), css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.equal((css.match(/animation:/g) ?? []).length, (motion.match(/animation:/g) ?? []).length);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*opacity: 0\.35/);
});