export function createMessageSubmitter() {
  const inFlight = new Set<string>();

  /** Persist before submitting, so a lost response/refresh can safely retry. */
  return async function submitMessageForm(url: string, form: FormData, userId: number) {
    const parts: string[] = [url];
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") parts.push(key, value);
      else {
        const digest = await crypto.subtle.digest("SHA-256", await value.arrayBuffer());
        parts.push(key, value.name, value.type, Array.from(new Uint8Array(digest)).join(","));
      }
    }
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(parts)));
    const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
    const storageKey = `message-submit:${userId}:${fingerprint}`;
    if (inFlight.has(storageKey)) throw new Error("This message is already being submitted.");
    inFlight.add(storageKey);
    try {
      // Lock the entire request, not just key allocation: otherwise a second tab
      // could allocate a new key immediately after the first clears a successful key.
      // Without origin-wide coordination, fail closed rather than risk duplicate mail.
      if (typeof navigator === "undefined" || !navigator.locks?.request) {
        throw new Error("Safe message submission requires a browser with Web Locks. Use a supported browser in a secure connection; no message was submitted.");
      }
      return await navigator.locks.request(storageKey, { ifAvailable: true }, async lock => {
        if (!lock) throw new Error("This message is already being submitted in another tab. Check send progress.");
        let requestKey = localStorage.getItem(storageKey);
        if (!requestKey) {
          requestKey = crypto.randomUUID();
          localStorage.setItem(storageKey, requestKey);
        }
        const response = await fetch(url, {
          method: "POST", body: form, credentials: "include",
          headers: { "Idempotency-Key": requestKey },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Submission not confirmed. Check progress before retrying.");
        localStorage.removeItem(storageKey);
        window.dispatchEvent(new Event("message-send-progress"));
        return data;
      });
    } finally { inFlight.delete(storageKey); }
  };
}

export const submitMessageForm = createMessageSubmitter();