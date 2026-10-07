/** Bound the complete directory read (including response body), not just headers. */
export async function requestVendorDirectory(url: string, signal?: AbortSignal, timeoutMs = 10_000) {
  const deadline = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
  try {
    const response = await fetch(url, { credentials: "include", signal: combined });
    if (!response.ok) throw new Error(response.status === 401
      ? "Please sign in to view vendors." : "Unable to load vendors. Please try again.");
    const data = await response.json();
    if (!Array.isArray(data?.vendors) || !Array.isArray(data?.categories)) throw new Error("Invalid vendor directory response");
    return data;
  } catch (error) {
    if (deadline.aborted && !signal?.aborted) throw new Error("Vendors took too long to load. Please try again.");
    throw error;
  }
}
