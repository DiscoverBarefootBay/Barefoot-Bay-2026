import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { build } from "esbuild";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("real Community browse cards render the same plain excerpt in horizontal, grid and dual views", async () => {
  const dir = await mkdtemp(path.join(process.cwd(), ".community-excerpt-ui-"));
  const dom = new JSDOM("<div id='root'></div>", { url: "https://fixture.test/community/social", pretendToBeVisual: true });
  const names = ["window", "document", "location", "history", "addEventListener", "removeEventListener", "dispatchEvent", "HTMLElement", "Element", "Node",
    "Document", "DocumentFragment", "Event", "CustomEvent", "MutationObserver", "localStorage",
    "requestAnimationFrame", "cancelAnimationFrame", "getComputedStyle", "IS_REACT_ACT_ENVIRONMENT"];
  const prior = Object.fromEntries(names.map(name => [name, (globalThis as any)[name]]));
  for (const name of names) {
    const value = (dom.window as any)[name];
    (globalThis as any)[name] = name === "window" ? dom.window : name === "IS_REACT_ACT_ENVIRONMENT" ? true :
      typeof value === "function" && ["addEventListener", "removeEventListener", "dispatchEvent", "requestAnimationFrame", "cancelAnimationFrame", "getComputedStyle"].includes(name)
        ? value.bind(dom.window) : value;
  }
  let root: ReturnType<typeof createRoot> | undefined;
  try {
    const outfile = path.join(dir, "browse.mjs");
    await build({
      stdin: { contents: 'export { VendorBrowse } from "@/components/vendors/vendor-browse";',
        resolveDir: process.cwd(), sourcefile: "browse.tsx", loader: "tsx" },
      outfile, bundle: true, format: "esm", platform: "node", packages: "external", jsx: "automatic",
      plugins: [{ name: "test-assets-and-aliases", setup(b) {
        b.onResolve({ filter: /^@assets\// }, () => ({ path: "image", namespace: "assets" }));
        b.onLoad({ filter: /.*/, namespace: "assets" }, () => ({ contents: 'export default "/image.png";', loader: "js" }));
        b.onResolve({ filter: /^@\// }, args => {
          const base = path.resolve(process.cwd(), "src", args.path.slice(2));
          return { path: [base, base + ".tsx", base + ".ts"].find(existsSync) ?? base };
        });
      } }],
    });
    const { VendorBrowse } = await import(pathToFileURL(outfile).href);
    const description = "Neighbors enjoy art & music. All abilities are welcome.";
    const item = { slug: "social-artists", title: "Artists", description, image: null,
      href: "/community/social/artists", categorySlug: "social", categoryLabel: "Social Clubs",
      isHidden: false, isUnvisited: false, createdAt: null };
    root = createRoot(dom.window.document.getElementById("root")!);
    await act(async () => root!.render(createElement(VendorBrowse, {
      vendors: [item], categories: [{ slug: "social", label: "Social Clubs" }], selectedCategorySlug: "social",
      onCategoryChange: () => {}, showAdminBadge: false, storageKey: "community-view", includeAllCategories: false,
    })));
    const horizontal = dom.window.document.querySelector("p.story-banner-excerpt")!;
    assert.equal(horizontal.textContent, description);
    assert.ok(horizontal.classList.contains("line-clamp-2"));
    assert.ok(horizontal.classList.contains("group-hover:opacity-100"));
    for (const view of ["grid", "dual"]) {
      await act(async () => dom.window.document.querySelector<HTMLButtonElement>(`[data-testid="vendor-view-${view}"]`)!.click());
      assert.equal(dom.window.document.querySelector("p.line-clamp-3")?.textContent, description);
      assert.equal(dom.window.localStorage.getItem("community-view"), view);
      assert.equal(dom.window.document.querySelector("a")?.getAttribute("href"), item.href);
    }
    await act(async () => root!.render(createElement(VendorBrowse, {
      vendors: [{ ...item, description: "" }], categories: [], selectedCategorySlug: "social",
      onCategoryChange: () => {}, showAdminBadge: false, storageKey: "community-view",
    })));
    assert.ok(dom.window.document.body.textContent?.includes("No description available"));
  } finally {
    if (root) await act(async () => root!.unmount());
    dom.window.close();
    Object.assign(globalThis, prior);
    await rm(dir, { recursive: true, force: true });
  }
});
