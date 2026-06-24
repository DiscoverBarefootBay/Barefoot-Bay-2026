import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { ForumReactionWithUser } from "@shared/schema";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ThumbsUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface ForumLikesProps {
  postId: number;
}

export function ForumLikes({ postId }: ForumLikesProps) {
  const { user } = useAuth();
  const { isAdmin, canReact } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const canInteract = isAdmin || canReact;

  const { data: reactions = [] } = useQuery<ForumReactionWithUser[]>({
    queryKey: ["/api/forum/posts", postId, "reactions"],
    queryFn: async () => {
      const response = await fetch(`/api/forum/posts/${postId}/reactions`, {
        method: 'GET',
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error("Failed to fetch forum reactions");
      }
      return response.json();
    },
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/forum/posts/${postId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ type: 'like' }),
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.message || "Failed to like post");
        }
        throw new Error("Failed to like post");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/posts", postId, "reactions"] });
      toast({
        title: "Success",
        description: "Your like has been recorded"
      });
    },
    onError: (error: Error) => {
      console.error("Like error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to like post",
        variant: "destructive"
      });
    }
  });

  const likedUsers = reactions.filter(r => r.reactionType === "like");
  
  const userReaction = user && reactions.find(r => r.userId === user.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant={userReaction?.reactionType === "like" ? "default" : "outline"}
                  className="text-lg py-6 px-8"
                  onClick={() => likeMutation.mutate()}
                  disabled={!user || likeMutation.isPending || (user && !canInteract && !isAdmin)}
                >
                  <ThumbsUp className="mr-2" />
                  Like ({likedUsers.length})
                </Button>
              </span>
            </TooltipTrigger>
            {user && !canInteract && !isAdmin && (
              <TooltipContent className="max-w-xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <p>This feature requires a specific membership level.</p>
                </div>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>

      {likedUsers.length > 0 && (
        <div className="relative">
          <ScrollArea className="w-full whitespace-nowrap rounded-md">
            <div className="flex space-x-4 p-4">
              {likedUsers.map((reaction) => (
                <div
                  key={reaction.userId}
                  className="flex-none"
                  title={reaction.user?.username || 'Anonymous'}
                >
                  <div className="border-2 border-background rounded-full">
                    <UserAvatar 
                      user={{
                        username: reaction.user?.username || 'Anonymous',
                        avatarUrl: reaction.user?.avatarUrl,
                        isResident: reaction.user?.isResident,
                        role: reaction.user?.role,
                        subscriptionStatus: reaction.user?.subscriptionStatus,
                        hasMembershipBadge: reaction.user?.hasMembershipBadge,
                        createdAt: reaction.user?.createdAt ?? undefined
                      }}
                      size="md"
                      showBadge={true}
                    />
                  </div>
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
