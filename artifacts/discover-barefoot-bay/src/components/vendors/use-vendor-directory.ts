import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { VendorItem, VendorBrowseCategory } from "./vendor-browse";
import { vendorDirectoryKey } from "@/lib/vendor-directory-cache";
import { requestVendorDirectory } from "@/lib/vendor-directory-request";

export interface VendorDirectory {
  vendors: (Omit<VendorItem, "isUnvisited"> & { showInDirectory: boolean; showInCategory: boolean })[];
  categories: VendorBrowseCategory[];
}

export function useVendorDirectory() {
  const { user, effectiveRole, isLoading: accountLoading } = useAuth();
  const client = useQueryClient();
  const key = vendorDirectoryKey(user?.id ?? null, effectiveRole);
  useEffect(() => {
    // Old viewer data is not reusable after switching account or View As role.
    const ownScope = JSON.stringify(key[1]);
    const predicate = (q: { queryKey: readonly unknown[] }) =>
      ["/api/vendors/directory", "/api/vendors/unvisited"].includes(String(q.queryKey[0])) &&
      (typeof q.queryKey[1] === "number" ? q.queryKey[1] !== user?.id : JSON.stringify(q.queryKey[1]) !== ownScope);
    void client.cancelQueries({ predicate }).then(() => client.removeQueries({ predicate }));
  }, [client, user?.id, effectiveRole]);
  const directory = useQuery<VendorDirectory>({
    queryKey: key,
    queryFn: ({ signal }) => requestVendorDirectory(`/api/vendors/directory?includeHidden=${effectiveRole === "admin"}`, signal),
    // Route admission and the server enforce guest permissions. Guests need the
    // public directory too; only their private badges/visit writes stay disabled.
    enabled: !accountLoading,
    placeholderData: undefined,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    retry: false,
  });
  const badge = useQuery<{ unvisitedSlugs: string[] }>({
    queryKey: ["/api/vendors/unvisited", { userId: user?.id ?? null, role: effectiveRole }],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/vendors/unvisited", { credentials: "include", signal });
      if (!res.ok) throw new Error("Unable to load new-vendor badges");
      const data = await res.json();
      if (!Array.isArray(data?.unvisitedSlugs)) throw new Error("Invalid badges");
      return data;
    },
    // Badge work is deliberately not on the first-card critical path.
    enabled: !!user && !!directory.data,
    placeholderData: undefined,
    staleTime: 30_000,
    retry: false,
  });
  useEffect(() => {
    if (!user || !directory.data) return;
    const controller = new AbortController();
    // Let the first cards paint before triggering visit-related menu updates.
    const timer = setTimeout(() => {
      fetch("/api/vendors/visit", { method: "POST", credentials: "include", signal: controller.signal })
        .then(res => { if (res.ok) client.invalidateQueries({ queryKey: ["/api/vendors/new-pages-count"] }); })
        .catch(() => { /* A badge failure never hides the directory. */ });
    }, 500);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [user?.id, effectiveRole, !!directory.data, client]);
  const allItems = useMemo(() => {
    const slugs = new Set(badge.data?.unvisitedSlugs ?? []);
    return (directory.data?.vendors ?? []).map(v => ({ ...v, isUnvisited: slugs.has(v.slug) }));
  }, [directory.data?.vendors, badge.data]);
  const items = useMemo(() => allItems.filter(v => v.showInDirectory), [allItems]);
  return { data: directory.data, isError: directory.isError, error: directory.error, isFetching: directory.isFetching,
    refetch: directory.refetch, items, allItems, isAdmin: effectiveRole === "admin", badgeError: badge.isError };
}
