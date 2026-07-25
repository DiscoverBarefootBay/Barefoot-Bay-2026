import { useState, useEffect, type CSSProperties } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  MessageSquare,
  Loader2,
  Settings,
  Edit,
  Save,
  X,
  CheckCheck,
  Pin,
  Newspaper,
  ArrowUpDown,
  Plus,
  LayoutGrid,
  Columns2,
  Rows2,
  Search,
  Tag,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import bfbLogo from "@assets/image_1784954979351.png";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { Textarea } from "@/components/ui/textarea";
import { ForumLoading } from "@/components/ui/forum-loading";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

interface ForumCategory {
  id: number;
  name: string;
  description: string;
  slug: string;
  postCount: number;
  unreadCount?: number;
}

interface ForumDescription {
  id: number;
  content: string;
}

interface Story {
  id: number;
  title: string;
  excerpt: string;
  image: string | null;
  categoryId: number;
  categoryName: string | null;
  isPinned: boolean;
  isEditoriallyUpdated: boolean;
  commentCount: number;
  isUnread: boolean;
  author?: { id: number; username: string; fullName?: string | null; avatarUrl?: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

interface StoryFeedResponse {
  stories: Story[];
  total: number;
  hasMore: boolean;
}

const PAGE_SIZE = 12;

type StoryView = "grid" | "dual" | "single";

const STORY_VIEW_STORAGE_KEY = "extra-extra-story-view";

const STORY_VIEW_CLASSES: Record<StoryView, string> = {
  grid: "grid grid-cols-1 md:grid-cols-3 gap-6",
  dual: "grid grid-cols-1 md:grid-cols-2 gap-6",
  single: "grid grid-cols-1 gap-4",
};

function loadStoredStoryView(): StoryView {
  try {
    const stored = window.localStorage.getItem(STORY_VIEW_STORAGE_KEY);
    if (stored === "grid" || stored === "dual" || stored === "single") return stored;
  } catch {
    // localStorage unavailable (private mode, etc.) — fall back to default
  }
  return "single";
}

function formatStoryDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function HorizontalStoryCard({ story, index }: { story: Story; index: number }) {
  return (
    <Link href={`/forum/post/${story.id}`}>
      <div
        className="story-banner-enter group"
        style={{ "--story-index": Math.min(index, 8) } as CSSProperties}
      >
        <div
          className={`story-banner-card relative overflow-hidden rounded-xl bg-white cursor-pointer transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-0.5 border ${
            story.isUnread
              ? "border-red-500 border-2 ring-2 ring-red-300 shadow-lg"
              : "border-navy/10 hover:border-ocean/40"
          }`}
          data-testid={`story-banner-${story.id}`}
        >
          {story.isUnread && (
            <div className="absolute top-2 right-2 z-20 bg-red-500 text-white text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full shadow-md">
              New
            </div>
          )}
          <div className="flex items-stretch min-h-[128px] sm:min-h-[146px] group-hover:min-h-[176px] sm:group-hover:min-h-[204px] transition-all duration-300">
            <div className="story-banner-shine relative w-[148px] sm:w-[210px] md:w-[264px] group-hover:w-[188px] sm:group-hover:w-[260px] md:group-hover:w-[320px] flex-shrink-0 overflow-hidden bg-navy/5 transition-all duration-300">
              {story.image ? (
                <img
                  src={story.image}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-ocean/20 to-navy/10">
                  <img
                    src={bfbLogo}
                    alt="Discover Barefoot Bay"
                    loading="lazy"
                    className="max-h-[70%] max-w-[70%] object-contain opacity-90"
                  />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 pointer-events-none" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center px-3.5 sm:px-5 py-2.5 sm:py-3">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                {story.categoryName && (
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-coral">
                    {story.categoryName}
                  </span>
                )}
                {story.isPinned && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-navy text-white shadow-sm">
                    <Pin className="h-3 w-3" /> Pinned
                  </span>
                )}
                {story.isEditoriallyUpdated && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-coral text-white shadow-sm">
                    Updated
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-xl font-extrabold text-navy leading-snug line-clamp-2 group-hover:text-ocean transition-colors break-words [overflow-wrap:anywhere]">
                {story.title}
              </h3>
              {story.excerpt && (
                <p className="story-banner-excerpt text-xs sm:text-sm text-navy/70 line-clamp-2 max-h-0 opacity-0 overflow-hidden group-hover:max-h-16 group-hover:opacity-100 group-hover:mt-1.5 transition-all duration-300">
                  {story.excerpt}
                </p>
              )}
              <div className="mt-1.5 flex items-center gap-3 text-[11px] sm:text-xs text-navy/60">
                <span>{formatStoryDate(story.createdAt)}</span>
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {story.commentCount}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function StoryCard({ story }: { story: Story }) {
  return (
    <Link href={`/forum/post/${story.id}`}>
      <Card
        className={`h-full flex flex-col cursor-pointer transition-all hover:shadow-lg bg-white relative ${
          story.isUnread ? "border-red-500 border-[3px] shadow-lg ring-2 ring-red-300" : "border-navy/10"
        }`}
      >
        {story.isUnread && (
          <div className="absolute -top-2 -right-2 z-10 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
            New
          </div>
        )}
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-navy/5">
          {story.image ? (
            <img
              src={story.image}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-ocean/20 to-navy/10">
              <img
                src={bfbLogo}
                alt="Discover Barefoot Bay"
                loading="lazy"
                className="max-h-[70%] max-w-[60%] object-contain opacity-90"
              />
            </div>
          )}
          <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
            {story.isPinned && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-navy text-white shadow">
                <Pin className="h-3 w-3" /> Pinned
              </span>
            )}
            {story.isEditoriallyUpdated && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-coral text-white shadow">
                Updated
              </span>
            )}
          </div>
        </div>
        <CardContent className="flex flex-col flex-1 p-4">
          {story.categoryName && (
            <span className="text-xs font-semibold uppercase tracking-wide text-coral mb-1.5">
              {story.categoryName}
            </span>
          )}
          <h3 className="text-lg font-bold text-navy leading-snug line-clamp-2 mb-2">{story.title}</h3>
          {story.excerpt && (
            <p className="text-sm text-navy/70 line-clamp-3 mb-3">{story.excerpt}</p>
          )}
          <div className="mt-auto flex items-center justify-between text-xs text-navy/60 pt-2 border-t border-navy/5">
            <span>{formatStoryDate(story.createdAt)}</span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {story.commentCount}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ForumPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin, canCreateTopic, canCreateTopicInCategory } = usePermissions();
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionText, setDescriptionText] = useState("");
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [, navigate] = useLocation();
  const searchString = useSearch();
  // Category filter is URL-addressable (?categoryId=N) so filtered feeds can be
  // linked directly and browser back/forward works between filters.
  const rawCategoryId = new URLSearchParams(searchString).get("categoryId");
  const parsedCategoryId = rawCategoryId ? Number(rawCategoryId) : NaN;
  const selectedCategoryId =
    Number.isInteger(parsedCategoryId) && parsedCategoryId > 0 ? parsedCategoryId : null;
  const setSelectedCategoryId = (categoryId: number | null) => {
    navigate(categoryId ? `/forum?categoryId=${categoryId}` : "/forum");
  };
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [sortBy, setSortBy] = useState<string>("newest_created");
  const [storyView, setStoryView] = useState<StoryView>(loadStoredStoryView);
  // Text search: raw input updates instantly; debounced value drives the server query
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleStoryViewChange = (view: StoryView) => {
    setStoryView(view);
    try {
      window.localStorage.setItem(STORY_VIEW_STORAGE_KEY, view);
    } catch {
      // localStorage unavailable — preference just won't persist
    }
  };

  // Fetch categories (for filter chips)
  const { data: categories, isLoading: categoriesLoading } = useQuery<ForumCategory[]>({
    queryKey: ["/api/forum/categories"],
  });

  // Fetch description
  const { data: description, isLoading: descriptionLoading } = useQuery<ForumDescription>({
    queryKey: ["/api/forum/description"],
  });

  // Fetch story feed (paginated via limit; "Load More" grows the limit)
  const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : "";
  const storiesQueryKey = selectedCategoryId
    ? `/api/forum/stories?limit=${visibleCount}&categoryId=${selectedCategoryId}&sort=${sortBy}${searchParam}`
    : `/api/forum/stories?limit=${visibleCount}&sort=${sortBy}${searchParam}`;
  const {
    data: feed,
    isLoading: storiesLoading,
    isFetching: storiesFetching,
    error: storiesError,
  } = useQuery<StoryFeedResponse>({
    queryKey: [storiesQueryKey],
  });

  useEffect(() => {
    if (description) {
      setDescriptionText(description.content || "");
    }
  }, [description]);

  // Reset pagination when the category filter, sort order, or search term changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedCategoryId, sortBy, debouncedSearch]);

  const updateDescriptionMutation = useMutation({
    mutationFn: (content: string) => {
      return apiRequest("POST", "/api/forum/description", {
        content,
        updatedBy: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/description"] });
      setIsEditingDescription(false);
      toast({
        title: "Success",
        description: "Description updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update description",
        variant: "destructive",
      });
      console.error("Error updating description:", error);
    },
  });

  // Scope Mark All Read to the selected category (matching the old category
  // page behavior); fall back to the global endpoint on "All Stories".
  const markAllReadMutation = useMutation({
    mutationFn: () => {
      return apiRequest(
        "POST",
        selectedCategoryId
          ? `/api/forum/categories/${selectedCategoryId}/mark-all-read`
          : "/api/forum/mark-all-read",
        {},
      );
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/categories"] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/forum/stories"),
      });
      toast({
        title: "Success",
        description: data?.message || `Marked ${data?.updatedCount || 0} stories as read`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to mark all stories as read",
        variant: "destructive",
      });
      console.error("Error marking all stories as read:", error);
    },
  });

  // Dismiss a single category's unread badge (X click on the chip badge)
  const markCategoryReadMutation = useMutation({
    mutationFn: (categoryId: number) => {
      return apiRequest("POST", `/api/forum/categories/${categoryId}/mark-all-read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/categories"] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/forum/stories"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/forum/unread-count"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to mark stories as read",
        variant: "destructive",
      });
      console.error("Error marking category stories as read:", error);
    },
  });

  if ((storiesLoading && !feed) || categoriesLoading || descriptionLoading) {
    return <ForumLoading type="forums" className="min-h-[50vh]" />;
  }

  if (storiesError) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold text-navy mb-2">Something went wrong</h2>
        <p className="text-navy/70">We couldn't load the latest stories. Please try again later.</p>
      </div>
    );
  }

  const handleSaveDescription = () => {
    updateDescriptionMutation.mutate(descriptionText);
  };

  const handleCancelEdit = () => {
    setDescriptionText(description?.content || "");
    setIsEditingDescription(false);
  };

  const stories = feed?.stories ?? [];
  const hasMore = feed?.hasMore ?? false;
  const selectedCategory = selectedCategoryId
    ? (categories ?? []).find((c) => c.id === selectedCategoryId) ?? null
    : null;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-navy">Extra!!!</h1>
          {(isAdmin || description?.content) && (
            <Button
              variant="ghost"
              size="sm"
              className="p-1 h-auto text-navy/40 hover:text-ocean hover:bg-transparent"
              onClick={() => setIsInfoOpen(true)}
              aria-label="About Extra!!!"
            >
              <Info className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {user &&
            (selectedCategoryId
              ? canCreateTopicInCategory(selectedCategoryId)
              : canCreateTopic) && (
              <Link
                href={
                  selectedCategoryId
                    ? `/forum/new-post?category=${selectedCategoryId}`
                    : "/forum/new-post"
                }
              >
                <Button className="bg-coral hover:bg-coral/90 text-white" data-testid="button-create-topic">
                  <Plus className="mr-2 h-4 w-4" /> Create New Topic
                </Button>
              </Link>
            )}
          {user && (
            <Button
              variant="outline"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="border-navy/20 hover:bg-coral/10 hover:text-coral hover:border-coral"
            >
              {markAllReadMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Marking Read</>
              ) : (
                <><CheckCheck className="mr-2 h-4 w-4" /> Mark All Read</>
              )}
            </Button>
          )}
          {isAdmin && (
            <Link href="/admin/manage-forum">
              <Button variant="outline" className="border-navy/20 hover:bg-coral/10 hover:text-coral hover:border-coral">
                <Settings className="mr-2 h-4 w-4" /> Manage Extra!!!
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Description info dialog */}
      <Dialog
        open={isInfoOpen}
        onOpenChange={(open) => {
          setIsInfoOpen(open);
          if (!open) {
            setIsEditingDescription(false);
            setDescriptionText(description?.content || "");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>About Extra!!!</DialogTitle>
          </DialogHeader>
          {!isEditingDescription ? (
            <div>
              <div className="prose max-w-none">
                {description?.content ? (
                  <div dangerouslySetInnerHTML={{ __html: description.content }} />
                ) : (
                  <p className="text-navy/50 italic">
                    No description set yet. Click Edit to add one.
                  </p>
                )}
              </div>
              {isAdmin && (
                <div className="flex justify-end mt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-navy/50 hover:text-coral hover:bg-transparent"
                    onClick={() => setIsEditingDescription(true)}
                  >
                    <Edit className="h-4 w-4 mr-1" /> Edit
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Textarea
                value={descriptionText}
                onChange={(e) => setDescriptionText(e.target.value)}
                placeholder="Enter a description for Extra!!!..."
                className="min-h-[120px]"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveDescription}
                  disabled={updateDescriptionMutation.isPending}
                >
                  {updateDescriptionMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving</>
                  ) : (
                    <><Save className="h-4 w-4 mr-1" /> Save</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Selected category context (name + description + mark-all-read) */}
      {selectedCategory && (
        <div className="mb-6" data-testid="selected-category-header">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-navy">{selectedCategory.name}</h2>
            {(selectedCategory.unreadCount ?? 0) > 0 && (
              <button
                type="button"
                aria-label={`Mark all ${selectedCategory.name} stories as read`}
                title={`Mark all ${selectedCategory.name} stories as read`}
                disabled={
                  markCategoryReadMutation.isPending &&
                  markCategoryReadMutation.variables === selectedCategory.id
                }
                onClick={() => {
                  if (!markCategoryReadMutation.isPending) {
                    markCategoryReadMutation.mutate(selectedCategory.id);
                  }
                }}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white bg-coral hover:bg-coral/80 transition-colors disabled:opacity-60"
                data-testid={`badge-unread-${selectedCategory.id}`}
              >
                {markCategoryReadMutation.isPending &&
                markCategoryReadMutation.variables === selectedCategory.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    {selectedCategory.unreadCount}
                    <X className="h-3 w-3" />
                  </>
                )}
              </button>
            )}
          </div>
          {selectedCategory.description && (
            <p className="text-navy/70 mt-1">{selectedCategory.description}</p>
          )}
        </div>
      )}

      {/* Search + View toggle + Sort Dropdown */}
      <div className="mb-6 flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        <div className="relative w-full sm:flex-1 sm:mr-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy/40 pointer-events-none" />
          <Input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search stories…"
            aria-label="Search stories"
            data-testid="input-story-search"
            className="pl-9 pr-8 border-navy/20 bg-white"
          />
          {searchInput && (
            <button
              type="button"
              aria-label="Clear search"
              data-testid="button-clear-search"
              onClick={() => setSearchInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-navy/50 hover:text-navy hover:bg-navy/5"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-navy/70 font-medium">View as:</span>
          <div
            role="group"
            aria-label="View as"
            className="inline-flex rounded-md border border-navy/20 bg-white overflow-hidden"
          >
            <button
              type="button"
              aria-label="Grid view (3 per row)"
              aria-pressed={storyView === "grid"}
              title="Grid view"
              onClick={() => handleStoryViewChange("grid")}
              data-testid="view-grid"
              className={`p-2 transition-colors ${
                storyView === "grid" ? "bg-navy text-white" : "text-navy/70 hover:bg-navy/5"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Dual column view"
              aria-pressed={storyView === "dual"}
              title="Dual column view"
              onClick={() => handleStoryViewChange("dual")}
              data-testid="view-dual"
              className={`p-2 border-l border-navy/20 transition-colors ${
                storyView === "dual" ? "bg-navy text-white" : "text-navy/70 hover:bg-navy/5"
              }`}
            >
              <Columns2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Single column view"
              aria-pressed={storyView === "single"}
              title="Single column view"
              onClick={() => handleStoryViewChange("single")}
              data-testid="view-single"
              className={`p-2 border-l border-navy/20 transition-colors ${
                storyView === "single" ? "bg-navy text-white" : "text-navy/70 hover:bg-navy/5"
              }`}
            >
              <Rows2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-navy/70" />
          <span className="text-sm text-navy/70 font-medium">Category:</span>
          <Select
            value={selectedCategoryId === null ? "all" : selectedCategoryId.toString()}
            onValueChange={(val) => {
              setSelectedCategoryId(val === "all" ? null : parseInt(val, 10));
            }}
          >
            <SelectTrigger className="w-[180px] border-navy/20 bg-white" data-testid="select-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stories</SelectItem>
              {(categories ?? []).map((category) => {
                const unread = category.unreadCount ?? 0;
                return (
                  <SelectItem key={category.id} value={category.id.toString()} data-testid={`category-option-${category.id}`}>
                    <span className="flex items-center gap-2">
                      {category.name}
                      {unread > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[18px] px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white bg-coral">
                          {unread}
                        </span>
                      )}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
        <ArrowUpDown className="h-4 w-4 text-navy/70" />
        <span className="text-sm text-navy/70 font-medium">Sort by:</span>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[200px] border-navy/20 bg-white" data-testid="select-sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest_created" data-testid="sort-newest-created">Newest Created</SelectItem>
            <SelectItem value="oldest_created" data-testid="sort-oldest-created">Oldest Created</SelectItem>
            <SelectItem value="newest_comment" data-testid="sort-newest-comment">Newest Comment</SelectItem>
            <SelectItem value="oldest_comment" data-testid="sort-oldest-comment">Oldest Comment</SelectItem>
            <SelectItem value="newest_edited" data-testid="sort-newest-edited">Newest Edited</SelectItem>
            <SelectItem value="oldest_edited" data-testid="sort-oldest-edited">Oldest Edited</SelectItem>
          </SelectContent>
        </Select>
        </div>
      </div>

      {/* Story grid */}
      {stories.length === 0 ? (
        <div className="text-center py-16">
          <Newspaper className="h-12 w-12 text-navy/20 mx-auto mb-4" />
          {debouncedSearch ? (
            <>
              <h2 className="text-xl font-bold text-navy mb-1">No stories match your search</h2>
              <p className="text-navy/60">Try a different word or clear the search to see all stories.</p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-navy mb-1">No stories yet</h2>
              <p className="text-navy/60">Check back soon for the latest community news.</p>
            </>
          )}
        </div>
      ) : (
        <div className={STORY_VIEW_CLASSES[storyView]} data-testid="story-grid">
          {stories.map((story, index) =>
            storyView === "single" ? (
              <HorizontalStoryCard key={story.id} story={story} index={index} />
            ) : (
              <StoryCard key={story.id} story={story} />
            ),
          )}
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center mt-8 mb-4">
          <Button
            variant="outline"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            disabled={storiesFetching}
            className="border-navy/20 hover:bg-coral/10 hover:text-coral hover:border-coral px-8"
          >
            {storiesFetching ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</>
            ) : (
              "Load More Stories"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
