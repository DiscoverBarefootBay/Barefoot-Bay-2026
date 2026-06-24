import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "path";

// Replit dev plugins (runtime-error-modal, cartographer, dev-banner) were
// removed because each one opens its own WebSocket/polling connection or
// surfaces a full-screen overlay that triggered an endless reload loop on the
// Replit mobile app when the user switched tabs and came back. The other
// artifacts (slides, mockup-sandbox) don't load them and don't have the bug.
// Set REPLIT_DEV_PLUGINS=true to re-enable them for desktop debugging.
const enableReplitDevPlugins = process.env.REPLIT_DEV_PLUGINS === "true";

const benignErrorFilterShim: PluginOption = {
  name: "benign-error-filter-shim",
  enforce: "post",
  apply: "serve",
  transformIndexHtml() {
    return [
      {
        tag: "script",
        injectTo: "head-prepend",
        children: `
(function () {
  function isKnownBenignMessage(msg) {
    if (typeof msg !== "string" || msg.length === 0) return false;
    if (msg.indexOf("ResizeObserver loop") !== -1) return true;
    if (msg === "Script error.") return true;
    if (msg === "(unknown runtime error)") return true;
    return false;
  }
  function isViteOverlayStack(stack) {
    if (typeof stack !== "string" || stack.length === 0) return false;
    return (
      stack.indexOf("@vite/client") !== -1 &&
      (stack.indexOf("createErrorOverlay") !== -1 ||
        stack.indexOf("ErrorOverlay") !== -1)
    );
  }
  function looksLikeAppendChildNull(msg) {
    return (
      typeof msg === "string" &&
      msg.indexOf("Cannot read properties of null") !== -1 &&
      msg.indexOf("appendChild") !== -1
    );
  }
  function isEarlyParsePhase() {
    // Vite's overlay only crashes when <body> hasn't been parsed yet.
    return !document.body || document.readyState === "loading";
  }
  function isViteOverlayError(stack, msg, filename) {
    // Vite's @vite/client createErrorOverlay calls document.body.appendChild
    // before <body> exists during HEAD parsing, throwing this exact TypeError.
    // The error then cascades into unhandledrejection events that the runtime
    // error overlay surfaces as a crash.
    if (isViteOverlayStack(stack)) return true;
    if (typeof filename === "string" && filename.indexOf("/@vite/client") !== -1) {
      return true;
    }
    // Fallback for stack-stripped / cross-origin cases: only swallow the
    // exact appendChild-on-null TypeError when <body> isn't ready yet, which
    // is the only situation where the Vite overlay produces it. Real app code
    // touching a null element after mount will not match this guard.
    if (looksLikeAppendChildNull(msg) && isEarlyParsePhase()) return true;
    return false;
  }
  window.addEventListener(
    "error",
    function (evt) {
      var err = evt.error;
      var msg =
        (err && typeof err.message === "string" && err.message) ||
        (typeof evt.message === "string" ? evt.message : "");
      var stack = err && typeof err.stack === "string" ? err.stack : "";
      var filename = typeof evt.filename === "string" ? evt.filename : "";
      if (isViteOverlayError(stack, msg, filename) || isKnownBenignMessage(msg)) {
        evt.stopImmediatePropagation();
        evt.preventDefault();
      }
    },
    true
  );
  window.addEventListener(
    "unhandledrejection",
    function (evt) {
      var reason = evt.reason;
      if (reason == null) {
        evt.stopImmediatePropagation();
        evt.preventDefault();
        return;
      }
      var msg = "";
      var stack = "";
      if (typeof reason === "string") {
        msg = reason;
      } else {
        if (typeof reason.message === "string") msg = reason.message;
        if (typeof reason.stack === "string") stack = reason.stack;
      }
      if (isViteOverlayError(stack, msg, "") || isKnownBenignMessage(msg)) {
        evt.stopImmediatePropagation();
        evt.preventDefault();
      }
    },
    true
  );
})();
        `.trim(),
      },
    ];
  },
};

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

// HMR configuration for the Replit HTTPS proxy.
//
// Why this exists: without an explicit `hmr` block, Vite's HMR client guesses
// the WebSocket target from `window.location` but uses the dev server's
// internal port. Behind Replit's shared proxy that mismatch (and the mobile
// webview backgrounding/dropping the WebSocket when the user switches tabs in
// the Replit mobile app) caused the client to fall back to full page reloads
// in an endless loop. Pinning the HMR connection to `wss://<replit-domain>:443`
// makes it survive the proxy and reconnect cleanly after the tab is
// foregrounded again.
//
// `DISABLE_HMR=true` is an escape hatch: if a future mobile webview still
// can't keep the WebSocket alive, set it and the preview will stop
// live-updating silently instead of reloading in a loop.
const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;
const disableHmr = process.env.DISABLE_HMR === "true";
const hmrConfig: false | { protocol: "wss"; host: string; clientPort: 443 } | undefined =
  disableHmr
    ? false
    : replitDevDomain
      ? { protocol: "wss", host: replitDevDomain, clientPort: 443 }
      : // Fallback: let Vite auto-detect (desktop dev / non-Replit envs).
        undefined;

export default defineConfig({
  base: basePath,
  plugins: [
    benignErrorFilterShim,
    react(),
    themePlugin(),
    ...(enableReplitDevPlugins
      ? [
          await import("@replit/vite-plugin-runtime-error-modal").then((m) =>
            m.default(),
          ),
          ...(process.env.NODE_ENV !== "production" &&
          process.env.REPL_ID !== undefined
            ? [
                await import("@replit/vite-plugin-cartographer").then((m) =>
                  m.cartographer({
                    root: path.resolve(import.meta.dirname, ".."),
                  }),
                ),
                await import("@replit/vite-plugin-dev-banner").then((m) =>
                  m.devBanner(),
                ),
              ]
            : []),
        ]
      : []),
  ],
  css: {
    postcss: {
      plugins: [
        (await import("tailwindcss")).default,
        (await import("autoprefixer")).default,
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    hmr: hmrConfig,
    fs: {
      strict: false,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
