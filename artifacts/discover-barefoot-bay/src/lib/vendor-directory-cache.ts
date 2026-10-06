import type { QueryClient } from "@tanstack/react-query";

export const vendorDirectoryKey = (id: number | null, role: string) =>
  ["/api/vendors/directory", { userId: id, role }] as const;

/** Extend existing editor invalidations without changing shared CMS queries. */
export function installVendorDirectoryInvalidation(client: QueryClient) {
  return client.getQueryCache().subscribe(event => {
    if (event.type !== "updated" || event.action.type !== "invalidate") return;
    const root = event.query.queryKey[0];
    if (root === "/api/pages" || root === "/api/vendor-categories" || root === "dmca-content-status") {
      void client.invalidateQueries({ queryKey: ["/api/vendors/directory"] });
    }
  });
}
