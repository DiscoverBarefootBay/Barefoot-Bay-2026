import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { VendorInteractionWithUser } from "@shared/schema";
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

interface VendorLikesProps {
  pageSlug: string;
}

export function VendorLikes({ pageSlug }: VendorLikesProps) {
  const { user } = useAuth();
  const { isAdmin, canReact } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Ensure that admin users can always interact with vendors
  const canInteract = isAdmin || canReact;

  // Fetch vendor interactions
  const { data: interactions = [] } = useQuery<VendorInteractionWithUser[]>({
    queryKey: ["/api/vendors", pageSlug, "interactions"],
    queryFn: async () => {
      const response = await fetch(`/api/vendors/${pageSlug}/interactions`, {
        method: 'GET',
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error("Failed to fetch vendor interactions");
      }
      return response.json();
    },
  });

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/vendors/${pageSlug}/interactions`, {
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
          throw new Error(error.message || "Failed to like vendor");
        }
        throw new Error("Failed to like vendor");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", pageSlug, "interactions"] });
      toast({
        title: "Success",
        description: "Your like has been recorded"
      });
    },
    onError: (error: Error) => {
      console.error("Like error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to like vendor",
        variant: "destructive"
      });
    }
  });

  // Filter to get all likes
  const likedUsers = interactions.filter(i => i.interactionType === "like");
  
  // Check if current user has liked
  const userInteraction = user && interactions.find(i => i.userId === user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant={userInteraction?.interactionType === "like" ? "default" : "outline"}
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
              {likedUsers.map((interaction) => (
                <div
                  key={interaction.userId}
                  className="flex-none"
                  title={interaction.user?.username || 'Anonymous'}
                >
                  <div className="border-2 border-background rounded-full">
                    <UserAvatar 
                      user={{
                        username: interaction.user?.username || 'Anonymous',
                        avatarUrl: interaction.user?.avatarUrl,
                        isResident: interaction.user?.isResident,
                        role: interaction.user?.role,
                        subscriptionStatus: interaction.user?.subscriptionStatus,
                        hasMembershipBadge: interaction.user?.hasMembershipBadge,
                        createdAt: interaction.user?.createdAt
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