import { useState, useEffect } from "react";
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
} from "lucide-react";
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

function formatStoryDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StoryCard({ story }: { story: Story }) {
  return (
    <Link href={`/forum/post/${story.id}`}>
      <Card
        className={`h-full flex flex-col overflow-hidden cursor-pointer transition-all hover:shadow-lg bg-white ${
          story.isUnread ? "border-coral/40 shadow-sm" : "border-navy/10"
        }`}
      >
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
            {story.isUnread && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-ocean text-navy shadow">
                New
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

  // Fetch categories (for filter chips)
  const { data: categories, isLoading: categoriesLoading } = useQuery<ForumCategory[]>({
    queryKey: ["/api/forum/categories"],
  });

  // Fetch description
  const { data: description, isLoading: descriptionLoading } = useQuery<ForumDescription>({
    queryKey: ["/api/forum/description"],
  });

  // Fetch story feed (paginated via limit; "Load More" grows the limit)
  const storiesQueryKey = selectedCategoryId
    ? `/api/forum/stories?limit=${visibleCount}&categoryId=${selectedCategoryId}&sort=${sortBy}`
    : `/api/forum/stories?limit=${visibleCount}&sort=${sortBy}`;
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

  // Reset pagination when the category filter or sort order changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedCategoryId, sortBy]);

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
        <h1 className="text-3xl font-bold text-navy">Extra! Extra!</h1>
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
                <Settings className="mr-2 h-4 w-4" /> Manage Extra! Extra!
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Description */}
      {(description?.content || isAdmin) && (
        <Card className="mb-6 bg-white">
          <CardContent className="pt-6">
            {!isEditingDescription ? (
              <div className="relative">
                <div className="prose max-w-none">
                  {description?.content ? (
                    <div dangerouslySetInnerHTML={{ __html: description.content }} />
                  ) : (
                    <p className="text-navy/50 italic">
                      {isAdmin ? "No description available. Click edit to add one." : ""}
                    </p>
                  )}
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 text-navy/50 hover:text-coral hover:bg-transparent"
                    onClick={() => setIsEditingDescription(true)}
                  >
                    <Edit className="h-4 w-4 mr-1" /> Edit
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Textarea
                  value={descriptionText}
                  onChange={(e) => setDescriptionText(e.target.value)}
                  placeholder="Enter a description for Extra! Extra!..."
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
          </CardContent>
        </Card>
      )}

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedCategoryId(null)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            selectedCategoryId === null
              ? "bg-navy text-white"
              : "bg-white text-navy border border-navy/20 hover:border-coral hover:text-coral"
          }`}
        >
          All Stories
        </button>
        {(categories ?? []).map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategoryId(category.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCategoryId === category.id
                ? "bg-navy text-white"
                : "bg-white text-navy border border-navy/20 hover:border-coral hover:text-coral"
            }`}
          >
            {category.name}
            {(category.unreadCount ?? 0) > 0 && (
              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-coral text-white">
                {category.unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Selected category context (name + description, from the old category page) */}
      {selectedCategory && (
        <div className="mb-6" data-testid="selected-category-header">
          <h2 className="text-2xl font-bold text-navy">{selectedCategory.name}</h2>
          {selectedCategory.description && (
            <p className="text-navy/70 mt-1">{selectedCategory.description}</p>
          )}
        </div>
      )}

      {/* Sort Dropdown */}
      <div className="mb-6 flex items-center justify-end gap-2">
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

      {/* Story grid */}
      {stories.length === 0 ? (
        <div className="text-center py-16">
          <Newspaper className="h-12 w-12 text-navy/20 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-navy mb-1">No stories yet</h2>
          <p className="text-navy/60">Check back soon for the latest community news.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
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
