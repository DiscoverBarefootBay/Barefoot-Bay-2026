import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  MessageSquare, 
  ArrowLeft,
  Clock,
  Plus,
  User,
  Loader2,
  Ban,
  Check,
  Zap,
  MessageCircle,
  Eye,
  ArrowUpDown,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { queryClient } from "@/lib/queryClient";
import { ForumLoading } from "@/components/ui/forum-loading";
import { formatDistanceToNow, format } from "date-fns";
import { createTextPreview } from "@/lib/content-preview";

interface ForumCategory {
  id: number;
  name: string;
  description: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

interface ForumPost {
  id: number;
  title: string;
  content: string;
  categoryId: number;
  authorId: number;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  customPreview?: string;
  author: {
    id: number;
    username: string;
    avatarUrl: string | null;
  };
  isUnread?: boolean;
  hasUnreadComments?: boolean;
  lastCommentDate?: string;
}

export default function ForumCategoryPage() {
  const params = useParams<{ categoryId: string }>();
  const categoryId = parseInt(params.categoryId, 10);
  const [_, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreateTopic, canCreateTopicInCategory, isBlocked, hasPermission } = usePermissions();
  
  const [sortBy, setSortBy] = useState<string>('newest_created');

  // Fetch category details
  const { 
    data: category, 
    isLoading: isLoadingCategory 
  } = useQuery<ForumCategory>({
    queryKey: [`/api/forum/categories/${categoryId}`],
    enabled: !isNaN(categoryId),
  });

  // Fetch posts in the category with sort parameter
  const { 
    data: posts, 
    isLoading: isLoadingPosts 
  } = useQuery<ForumPost[]>({
    queryKey: [`/api/forum/categories/${categoryId}/posts`, sortBy],
    queryFn: async () => {
      const response = await fetch(`/api/forum/categories/${categoryId}/posts?sort=${sortBy}`);
      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }
      return response.json();
    },
    enabled: !isNaN(categoryId),
  });

  // Mark all posts in category as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/forum/categories/${categoryId}/mark-all-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark all posts as read');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || "All posts marked as read",
      });
      
      // Refetch the posts to update read state (include sortBy in query key)
      queryClient.invalidateQueries({ queryKey: [`/api/forum/categories/${categoryId}/posts`, sortBy] });
      // Also invalidate categories to update unread counts
      queryClient.invalidateQueries({ queryKey: ['/api/forum/categories'] });
    },
    onError: (error) => {
      console.error('Error marking all posts as read:', error);
      toast({
        title: "Error",
        description: "Failed to mark all posts as read. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoadingCategory || isLoadingPosts) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-coral" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold text-navy mb-2">Category Not Found</h2>
        <p className="text-navy/70 mb-6">The category you're looking for doesn't exist or has been removed.</p>
        <Link href="/forum">
          <Button variant="outline" className="border-navy/20">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Forums
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <Link href="/forum">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Forums
          </Button>
        </Link>
        <div className="flex justify-between items-start">
          <div className="flex-1 pr-4">
            <h1 className="text-3xl font-bold text-navy">{category.name}</h1>
            <p className="text-navy/70 mt-1">{category.description}</p>
          </div>
          {user && (
            <div className="flex gap-2">
              {/* Mark All Read Button */}
              <Button 
                variant="outline" 
                className="border-navy/20 text-navy hover:bg-navy/5 hidden md:flex"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
              >
                {markAllReadMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Mark All Read
              </Button>
              
              {/* Create New Topic Button */}
              {canCreateTopicInCategory(category.id) && (
                <Link href={`/forum/new-post?category=${category.id}`}>
                  {/* Desktop button */}
                  <Button variant="default" className="bg-coral hover:bg-coral/90 text-white hidden md:flex">
                    <Plus className="mr-2 h-4 w-4" /> Create New Topic
                  </Button>
                  {/* Mobile floating action button */}
                  <Button 
                    variant="default" 
                    size="icon"
                    className="bg-coral hover:bg-coral/90 text-white md:hidden fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <Plus className="h-6 w-6" />
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
        
        {user && isBlocked && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 flex items-center gap-2">
            <Ban className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">Your account has been blocked.</p>
              <p className="text-sm">You cannot create new topics or post comments in the forum.</p>
              {user.blockReason && (
                <p className="text-sm mt-1 italic">Reason: {user.blockReason}</p>
              )}
            </div>
          </div>
        )}
        
        {/* Sort Dropdown */}
        <div className="mt-4 flex items-center justify-end gap-2">
          <ArrowUpDown className="h-4 w-4 text-navy/70" />
          <span className="text-sm text-navy/70 font-medium">Sort by:</span>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[200px] border-navy/20" data-testid="select-sort">
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

      {/* ALWAYS show loading if we don't have content to display - NEVER show empty states */}
      {(isLoadingPosts || !posts || posts.length === 0) ? (
        <ForumLoading type="topics" className="py-12" />
      ) : (
        <div className="grid gap-4">
          {posts.map((post) => {
            // Determine the read state
            const isNewPost = post.isUnread;
            const hasNewComments = post.hasUnreadComments && !post.isUnread;
            const isFullyRead = !post.isUnread && !post.hasUnreadComments;
            
            return (
              <Card key={post.id} className={`border transition-all duration-300 hover:shadow-lg bg-white ${
                isNewPost 
                  ? 'border-amber-400/60 shadow-amber-100 shadow-md bg-gradient-to-r from-amber-50 to-orange-50' 
                  : hasNewComments 
                    ? 'border-coral/40 shadow-coral/10 shadow-md bg-gradient-to-r from-coral/5 to-pink-50' 
                    : 'border-navy/10 hover:border-navy/20'
              }`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <Link href={`/forum/post/${post.id}`}>
                      <CardTitle className={`text-xl font-bold cursor-pointer hover:text-coral transition-colors ${
                        isNewPost ? 'text-amber-900' : hasNewComments ? 'text-navy' : 'text-navy/80'
                      }`}>
                        <div className="flex items-center gap-2">
                          {post.title}
                          {isNewPost && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow-sm">
                              <Zap className="h-3 w-3" />
                              NEW POST
                            </span>
                          )}
                          {hasNewComments && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-coral to-pink-400 text-white shadow-sm">
                              <MessageCircle className="h-3 w-3" />
                              NEW REPLIES
                            </span>
                          )}
                        </div>
                      </CardTitle>
                    </Link>
                    <div className="flex items-center gap-2">
                      {isNewPost && (
                        <div className="flex-shrink-0 w-3 h-3 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full animate-pulse shadow-lg"></div>
                      )}
                      {hasNewComments && (
                        <div className="flex-shrink-0 w-3 h-3 bg-gradient-to-r from-coral to-pink-400 rounded-full shadow-lg"></div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <p className={`line-clamp-2 ${
                    isNewPost ? 'text-amber-800/80' : hasNewComments ? 'text-navy/75' : 'text-navy/70'
                  }`}>
                    {createTextPreview(post.content, 100, post.customPreview)}
                  </p>
                </CardContent>
                <CardFooter className={`flex justify-between border-t py-4 px-6 ${
                  isNewPost 
                    ? 'border-amber-200/50 bg-gradient-to-r from-amber-50/50 to-orange-50/50' 
                    : hasNewComments 
                      ? 'border-coral/20 bg-gradient-to-r from-coral/5 to-pink-50/50' 
                      : 'border-navy/5 bg-navy/5'
                }`}>
                  <div className={`flex items-center ${
                    isNewPost ? 'text-amber-700' : hasNewComments ? 'text-coral/80' : 'text-navy/70'
                  }`}>
                    <User className="h-4 w-4 mr-2" />
                    <span className="mr-4 font-medium">{post.author.username}</span>
                    <Clock className="h-4 w-4 mr-2" />
                    <span className="text-sm">
                      {(() => {
                        try {
                          const timestamp = Date.parse(post.createdAt);
                          if (isNaN(timestamp)) {
                            console.error("Invalid post.createdAt date in category view:", post.createdAt);
                            return "Invalid date";
                          }
                          
                          const dateObj = new Date(timestamp);
                          if (isNaN(dateObj.getTime())) {
                            console.error("Invalid date object after parsing post.createdAt in category view:", post.createdAt);
                            return "Invalid date";
                          }
                          
                          return format(dateObj, 'MMM d, yyyy h:mm a');
                        } catch (error) {
                          console.error("Date formatting error for post.createdAt in category view:", error);
                          return "Invalid date";
                        }
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center">
                      <MessageSquare className={`h-4 w-4 mr-2 ${
                        isNewPost ? 'text-amber-600' : hasNewComments ? 'text-coral' : 'text-navy/70'
                      }`} />
                      <span className={`mr-2 font-medium ${
                        isNewPost ? 'text-amber-700' : hasNewComments ? 'text-coral' : 'text-navy/70'
                      }`}>
                        {post.commentCount || 0}
                      </span>
                    </div>
                    <Link href={`/forum/post/${post.id}`}>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className={`transition-all duration-200 font-medium ${
                          isNewPost
                            ? 'border-amber-400 bg-gradient-to-r from-amber-400 to-orange-400 text-white hover:from-amber-500 hover:to-orange-500 shadow-md hover:shadow-lg'
                            : hasNewComments 
                              ? 'border-coral bg-gradient-to-r from-coral to-pink-400 text-white hover:from-coral/90 hover:to-pink-400/90 shadow-md hover:shadow-lg' 
                              : 'border-navy/20 hover:bg-coral/10 hover:text-coral hover:border-coral'
                        }`}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {isNewPost ? 'Read New' : hasNewComments ? 'View Replies' : 'View'}
                      </Button>
                    </Link>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}