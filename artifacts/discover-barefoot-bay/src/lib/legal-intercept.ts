/**
 * Detects "policy acceptance required" responses from ANY network caller:
 * window.fetch (raw fetch, apiRequest, generated clients) and XMLHttpRequest
 * (axios). Emits a window event the consent gate listens to, so already-open
 * sessions re-check consent the moment the server starts enforcing.
 */
export const LEGAL_REQUIRED_EVENT = "bb:legal-policy-required";

let installed = false;

function isApiUrl(url: string): boolean {
  try {
    const u = new URL(url, window.location.origin);
    return u.origin === window.location.origin && u.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

function emit() {
  try {
    window.dispatchEvent(new CustomEvent(LEGAL_REQUIRED_EVENT));
  } catch {
    /* ignore */
  }
}

export function responseSignalsPolicyRequired(status: number, url: string): boolean {
  if (status !== 428 && status !== 409) return false;
  if (!isApiUrl(url)) return false;
  // 409 is only meaningful from the consent/registration endpoints.
  if (status === 409) return /\/api\/(legal\/consent|register)/.test(url);
  return true;
}

export function installLegalIntercept() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await originalFetch(input, init);
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (responseSignalsPolicyRequired(res.status, url)) emit();
    } catch {
      /* never break the caller */
    }
    return res;
  };

  if (typeof XMLHttpRequest !== "undefined") {
    const proto = XMLHttpRequest.prototype;
    const originalOpen = proto.open;
    proto.open = function (this: XMLHttpRequest & { __bbUrl?: string }, ...args: any[]) {
      this.__bbUrl = String(args[1] ?? "");
      this.addEventListener("loadend", () => {
        try {
          if (responseSignalsPolicyRequired(this.status, this.__bbUrl || "")) emit();
        } catch {
          /* ignore */
        }
      });
      return (originalOpen as any).apply(this, args);
    } as any;
  }
}
