import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { VendorCommentWithUser } from "@shared/schema";
import { UserAvatar } from "@/components/shared/user-avatar";
import { format } from "date-fns";
import { AlertTriangle, MessageSquare, Trash2 } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent
} from "@/components/ui/card";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ContentModerationMenu } from "@/components/admin/dmca/content-moderation-menu";

interface VendorCommentsProps {
  pageSlug: string;
}

export function VendorComments({ pageSlug }: VendorCommentsProps) {
  const { user } = useAuth();
  const { isAdmin, isModerator, canComment: baseCanComment, hasPermission } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");

  // Special handling for admin override - always allow admins to comment regardless of other factors
  // This is a critical fix to ensure admins can comment regardless of feature flags
  const hasSpecialOverride = user?.role === 'admin';

  // For non-admins, use the permission system that checks for feature flag and approved status
  const canComment = hasSpecialOverride || baseCanComment;
  
  // Debug to help diagnose permission issues
  console.log("VendorComments debug:", { 
    userId: user?.id,
    username: user?.username,
    role: user?.role,
    isAdmin,
    hasSpecialOverride,
    baseCanComment,
    hasPermission, 
    canComment,
    isBlocked: user?.isBlocked
  });

  // Fetch vendor comments
  const { data: comments = [] } = useQuery<VendorCommentWithUser[]>({
    queryKey: ["/api/vendors", pageSlug, "comments"],
    queryFn: async () => {
      const response = await fetch(`/api/vendors/${pageSlug}/comments`, {
        method: 'GET',
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error("Failed to fetch vendor comments");
      }
      return response.json();
    },
  });

  // Add comment mutation
  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch(`/api/vendors/${pageSlug}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content }),
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.message || "Failed to post comment");
        }
        throw new Error("Failed to post comment");
      }

      return response.json();
    },
    onSuccess: () => {
      setComment(""); // Clear comment input
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", pageSlug, "comments"] });
      toast({
        title: "Success",
        description: "Your comment has been posted"
      });
    },
    onError: (error: Error) => {
      console.error("Comment error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to post comment",
        variant: "destructive"
      });
    }
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      const response = await fetch(`/api/vendors/comments/${commentId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const error: Error & { status?: number } = new Error(body?.message || "Failed to delete comment");
        error.status = response.status;
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", pageSlug, "comments"] });
      toast({
        title: "Success",
        description: "Comment deleted successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete comment",
        variant: "destructive"
      });
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {user ? (
          user && !canComment ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <p className="font-medium text-amber-800">Commenting Restricted</p>
              </div>
              <p className="text-amber-700">
                {user.isBlocked 
                  ? `Your account has been blocked${user.blockReason ? `: ${user.blockReason}` : ''}. You cannot post comments at this time.`
                  : "This feature requires a specific membership level to access."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Textarea
                placeholder="Write a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="text-lg"
              />
              <Button
                onClick={() => commentMutation.mutate(comment)}
                disabled={!comment.trim() || commentMutation.isPending}
                className="text-lg py-6 px-8"
              >
                Post Comment
              </Button>
            </div>
          )
        ) : (
          <p className="text-center p-4 text-muted-foreground">Please login to comment</p>
        )}

        <div className="space-y-4">
          {comments.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <MessageSquare className="h-10 w-10 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No comments yet. Be the first to share your thoughts!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-4">
                <div className="flex-shrink-0">
                  {comment.user ? (
                    <UserAvatar 
                      user={comment.user}
                      size="md"
                      showBadge={true}
                      inComments={true}
                    />
                  ) : (
                    <Avatar>
                      <AvatarFallback>?</AvatarFallback>
                    </Avatar>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{comment.user?.username ?? 'Anonymous'}</p>
                      <span className="text-sm text-muted-foreground">•</span>
                      <p className="text-sm text-muted-foreground">
                        {comment.createdAt ? format(new Date(comment.createdAt), "PPp") : ""}
                      </p>
                    </div>
                    {isModerator && (!user || comment.userId !== user.id) ? (
                      <ContentModerationMenu
                        contentType="vendor_comment"
                        contentId={comment.id}
                        deleteFn={() => deleteCommentMutation.mutateAsync(comment.id)}
                      />
                    ) : user && comment.userId === user.id ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-auto"
                              onClick={() => deleteCommentMutation.mutate(comment.id)}
                              disabled={deleteCommentMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete comment</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : null}
                  </div>
                  <p className="mt-2 text-gray-700">{comment.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}