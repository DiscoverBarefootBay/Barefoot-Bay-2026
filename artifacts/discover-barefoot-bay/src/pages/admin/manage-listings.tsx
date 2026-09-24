import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { Star, StarOff, Search, RefreshCw } from "lucide-react";
import AdminLayout from "@/components/layouts/admin-layout";
import { ContentModerationMenu } from "@/components/admin/dmca/content-moderation-menu";

// Shape returned by /api/admin/all-listings (includes joined user fields)
interface AdminListing {
  id: number;
  title: string;
  listingType?: string | null;
  price?: number | null;
  address?: string | null;
  status: string;
  featured?: boolean | null;
  featuredAt?: string | null;
  expirationDate?: string | null;
  createdBy?: number | null;
  createdAt?: string | null;
  // joined fields
  createdByUsername?: string | null;
  createdByFullName?: string | null;
  createdByEmail?: string | null;
}

const QUERY_KEY = "/api/admin/all-listings";

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ACTIVE": return "default";
    case "DRAFT": return "secondary";
    case "EXPIRED": return "destructive";
    default: return "outline";
  }
}

export default function ManageListingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const { data: rawData, isLoading, isError, refetch } = useQuery<AdminListing[]>({
    queryKey: [QUERY_KEY],
    // Guard: the global placeholderData injects [] for unknown keys — that
    // happens to be fine here, but we explicitly set it to avoid surprises if
    // the key ever changes.
    placeholderData: [],
  });

  // Ensure we always work with an array regardless of what the global
  // placeholderData fallback injects for this key.
  const listings: AdminListing[] = Array.isArray(rawData) ? rawData : [];

  const featureMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/listings/${id}/feature`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).message || res.statusText);
      }
      return res.json();
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: "Listing featured", description: `Listing #${id} is now featured.` });
    },
    onError: (err: Error, id) => {
      toast({
        title: "Could not feature listing",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const unfeatureMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/listings/${id}/unfeature`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).message || res.statusText);
      }
      return res.json();
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: "Listing unfeatured", description: `Listing #${id} is no longer featured.` });
    },
    onError: (err: Error, id) => {
      toast({
        title: "Could not unfeature listing",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/listings/${id}`);
      return response.text();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: "Listing deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not delete listing", description: err.message, variant: "destructive" });
    },
  });

  const pendingId =
    featureMutation.isPending ? (featureMutation.variables as number) :
    unfeatureMutation.isPending ? (unfeatureMutation.variables as number) :
    null;

  const filtered = listings.filter((l) => {
    const matchesStatus = statusFilter === "ALL" || l.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      l.title?.toLowerCase().includes(q) ||
      l.createdByUsername?.toLowerCase().includes(q) ||
      l.createdByFullName?.toLowerCase().includes(q) ||
      l.createdByEmail?.toLowerCase().includes(q) ||
      String(l.id).includes(q);
    return matchesStatus && matchesSearch;
  });

  const statusCounts = listings.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {});
  const featuredCount = listings.filter((l) => l.featured).length;

  return (
    <AdminLayout>
      <div className="container p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-1">Manage Listings</h1>
          <p className="text-muted-foreground">
            Feature or unfeature On The Market listings. Featured listings get priority placement and appear in the weekly email digest. No credits are charged for admin actions.
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {["ACTIVE", "DRAFT", "EXPIRED"].map((s) => (
            <Card key={s} className="text-center py-3">
              <div className="text-2xl font-bold">{statusCounts[s] ?? 0}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">{s}</div>
            </Card>
          ))}
          <Card className="text-center py-3 border-yellow-400">
            <div className="text-2xl font-bold text-yellow-600">{featuredCount}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Featured</div>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Listings</CardTitle>
            <CardDescription>
              {listings.length} total listing{listings.length !== 1 ? "s" : ""}
              {filtered.length !== listings.length ? ` · ${filtered.length} shown` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title, seller name, or email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {["ALL", "ACTIVE", "DRAFT", "EXPIRED"].map((s) => (
                  <Button
                    key={s}
                    variant={statusFilter === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(s)}
                  >
                    {s}
                  </Button>
                ))}
                <Button variant="ghost" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {isLoading && (
              <div className="text-center py-12 text-muted-foreground">Loading listings…</div>
            )}
            {isError && (
              <div className="text-center py-12 text-destructive">
                Failed to load listings.{" "}
                <Button variant="link" onClick={() => refetch()}>Retry</Button>
              </div>
            )}
            {!isLoading && !isError && filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">No listings match your filters.</div>
            )}

            {!isLoading && !isError && filtered.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">ID</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Featured</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((listing) => {
                      const isPending = pendingId === listing.id;
                      const canFeature = listing.status === "ACTIVE" && !listing.featured;
                      const canUnfeature = !!listing.featured;

                      return (
                        <TableRow key={listing.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {listing.id}
                          </TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate" title={listing.title}>
                            {listing.title}
                          </TableCell>
                          <TableCell className="max-w-[160px]">
                            <div className="text-sm truncate" title={listing.createdByFullName ?? listing.createdByUsername ?? ""}>
                              {listing.createdByFullName || listing.createdByUsername || <span className="text-muted-foreground italic">Unknown</span>}
                            </div>
                            {listing.createdByEmail && (
                              <div className="text-xs text-muted-foreground truncate" title={listing.createdByEmail}>
                                {listing.createdByEmail}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusBadgeVariant(listing.status)}>
                              {listing.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {listing.featured ? (
                              <span className="flex items-center gap-1 text-yellow-600 text-sm font-medium">
                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                Featured
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {listing.expirationDate
                              ? new Date(listing.expirationDate).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                            {canUnfeature ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isPending}
                                onClick={() => unfeatureMutation.mutate(listing.id)}
                                className="gap-1"
                              >
                                <StarOff className="h-3.5 w-3.5" />
                                {isPending ? "Saving…" : "Unfeature"}
                              </Button>
                            ) : canFeature ? (
                              <Button
                                size="sm"
                                variant="default"
                                disabled={isPending}
                                onClick={() => featureMutation.mutate(listing.id)}
                                className="gap-1 bg-yellow-500 hover:bg-yellow-600 text-white"
                              >
                                <Star className="h-3.5 w-3.5" />
                                {isPending ? "Saving…" : "Feature"}
                              </Button>
                            ) : (
                              <span
                                className="text-xs text-muted-foreground"
                                title={`Cannot feature a ${listing.status} listing`}
                              >
                                Not eligible
                              </span>
                            )}
                            <ContentModerationMenu
                              contentType="listing"
                              contentId={listing.id}
                              deleteFn={() => deleteMutation.mutateAsync(listing.id)}
                            />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
