import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { 
  ArrowLeft,
  Clock,
  Send,
  User,
  Loader2,
  MessageSquare,
  Trash2,
  AlertTriangle,
  Edit,
  ChevronDown,
  CheckCircle,
  Mail,
  X
} from "lucide-react";
import { ForumContent } from "@/components/forum/forum-content";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { useActiveUsers } from "@/hooks/use-active-users";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow, parseISO, format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/shared/user-avatar";
import { usePermissions } from "@/hooks/use-permissions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ForumShareButton } from "@/components/forum/forum-share-button";
import { ForumLikes } from "@/components/forum/forum-likes";

interface ForumPost {
  id: number;
  title: string;
  content: string;
  categoryId: number;
  authorId: number;
  hideDefaultTitle?: boolean;
  createdAt: string;
  updatedAt: string;
  author: {
    id: number;
    username: string;
    avatarUrl: string | null;
  };
  category: {
    id: number;
    name: string;
  };
}

interface ForumComment {
  id: number;
  content: string;
  postId: number;
  authorId: number;
  createdAt: string;
  updatedAt: string;
  author: {
    id: number;
    username: string;
    avatarUrl: string | null;
  };
}

interface CommentComposerProps {
  comment: string;
  setComment: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLiveChat: boolean;
  isPending: boolean;
  isTyping?: boolean;
  disabled?: boolean;
}

function CommentComposer({ 
  comment, 
  setComment, 
  onSubmit, 
  isLiveChat, 
  isPending,
  isTyping = false,
  disabled = false
}: CommentComposerProps) {
  if (isLiveChat) {
    return (
      <div style={{ 
        position: 'sticky', 
        bottom: 0, 
        background: '#000',
        borderTop: '2px solid #009900',
        zIndex: 10
      }}>
        <div style={{ padding: '12px' }}>
          <div style={{ 
            color: '#00ff00', 
            fontFamily: 'monospace', 
            fontSize: '0.9rem',
            fontWeight: 'bold',
            marginBottom: '8px'
          }}>
            {'>>> SEND MESSAGE'}
          </div>
          <form onSubmit={onSubmit}>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Type your message here..."
              className="min-h-[80px] mb-2 bg-black text-green-400 border-green-500 font-mono focus:border-green-300 placeholder:text-green-600"
              style={{
                backgroundColor: '#000',
                color: '#00ff00',
                fontFamily: 'monospace',
                border: '1px solid #009900'
              }}
            />
            {isTyping && (
              <div className="typing-indicator mb-2" style={{ color: '#00aa00', fontSize: '0.8rem' }}>
                {'>>> USER IS TRANSMITTING... <<<'}
              </div>
            )}
            <div className="flex justify-end">
              <Button 
                type="submit" 
                className="chat-send-btn"
                style={{
                  background: '#000',
                  border: '1px solid #009900',
                  color: '#009900',
                  fontFamily: 'monospace'
                }}
                disabled={disabled || isPending || !comment.trim() || isTyping}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    SENDING...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    SEND
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Card className="border border-navy/10 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-navy">
          Add Your Comment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit}>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your thoughts on this topic..."
            className="min-h-[100px] mb-3 border-navy/20 focus:border-coral"
          />
          <div className="flex justify-end">
            <Button 
              type="submit" 
              className="bg-coral hover:bg-coral/90 text-white"
              disabled={disabled || isPending || !comment.trim()}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Post Comment
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ForumPostPage() {
  const params = useParams<{ postId: string }>();
  const postId = parseInt(params.postId, 10);
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin, hasPermission, checkFeaturePermission } = usePermissions();
  const [comment, setComment] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<number | null>(null);
  const [showPostContent, setShowPostContent] = useState(true);
  const [isAnimationFading, setIsAnimationFading] = useState(false);
  const [notifiedUsers, setNotifiedUsers] = useState<Array<{username: string, email: string, additionalUsernames?: string[]}>>([]);
  
  // Scroll to bottom functionality
  const commentSectionRef = useRef<HTMLDivElement | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(true);
  const [hasNewComments, setHasNewComments] = useState(false);
  const lastCommentCountRef = useRef(0);
  
  const scrollToCommentSection = () => {
    if (commentSectionRef.current) {
      commentSectionRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  };

  // Live chat functionality for post 267
  const [liveChatComments, setLiveChatComments] = useState<ForumComment[]>([]);
  const [lastPollTimestamp, setLastPollTimestamp] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isLiveChatPost = postId === 267;
  
  // Enhanced UX states for live chat microinteractions
  const [isTyping, setIsTyping] = useState(false);
  const [typingMessages, setTypingMessages] = useState<Set<number>>(new Set());
  const [typedContent, setTypedContent] = useState<Map<number, string>>(new Map());
  const typingTimeouts = useRef<Map<number, NodeJS.Timeout>>(new Map());
  
  // Real-time active users tracking for this page
  const postPath = `/forum/post/${postId}`;
  const { activeUsers: activeUserList, activeUserCount, isLoading: activeUsersLoading, error: activeUsersError } = useActiveUsers(postPath);

  // Terminal typing animation function
  const typeMessage = useCallback((messageId: number, content: string, speed: number = 50) => {
    const currentTyped = typedContent.get(messageId) || '';
    if (currentTyped.length < content.length) {
      const nextChar = content.charAt(currentTyped.length);
      const newTyped = currentTyped + nextChar;
      
      setTypedContent(prev => new Map(prev.set(messageId, newTyped)));
      
      const timeout = setTimeout(() => {
        typeMessage(messageId, content, speed);
      }, speed);
      
      typingTimeouts.current.set(messageId, timeout);
    } else {
      // Typing complete, remove from typing set
      setTypingMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
    }
  }, [typedContent]);

  // Start typing animation for new messages
  const startTypingAnimation = useCallback((comment: ForumComment) => {
    if (!isLiveChatPost) return;
    
    setTypingMessages(prev => new Set(prev.add(comment.id)));
    setTypedContent(prev => new Map(prev.set(comment.id, '')));
    
    // Add slight delay before starting to type
    setTimeout(() => {
      typeMessage(comment.id, comment.content, 30 + Math.random() * 40); // Random typing speed
    }, 200);
  }, [isLiveChatPost, typeMessage]);

  // Enhanced comment submission with typing effect
  const handleCommentSubmitWithTyping = async () => {
    console.log("[LIVE CHAT DEBUG] handleCommentSubmitWithTyping called");
    console.log("[LIVE CHAT DEBUG] comment:", comment);
    console.log("[LIVE CHAT DEBUG] user:", user);
    console.log("[LIVE CHAT DEBUG] hasPermission:", hasPermission);
    console.log("[LIVE CHAT DEBUG] isAdmin:", isAdmin);
    
    if (!comment.trim()) {
      console.log("[LIVE CHAT DEBUG] BLOCKED: Comment is empty");
      return;
    }
    console.log("[LIVE CHAT DEBUG] Comment not empty, continuing...");
    
    if (!user) {
      console.log("[LIVE CHAT DEBUG] BLOCKED: No user");
      toast({
        title: "Authentication Required",
        description: "You must be logged in to post a comment.",
        variant: "destructive",
      });
      return;
    }
    console.log("[LIVE CHAT DEBUG] User exists, continuing...");
    
    if (!hasPermission && !isAdmin) {
      console.log("[LIVE CHAT DEBUG] BLOCKED: No permission - hasPermission:", hasPermission, "isAdmin:", isAdmin);
      toast({
        title: "Commenting Restricted",
        description: user.isBlocked
          ? `Your account has been blocked${user.blockReason ? `: ${user.blockReason}` : ''}.`
          : "This feature requires a specific membership level to access.",
        variant: "destructive",
      });
      return;
    }
    console.log("[LIVE CHAT DEBUG] Permission check passed, continuing...");
    
    let typingIndicator: NodeJS.Timeout | null = null;
    
    if (isLiveChatPost) {
      setIsTyping(true);
      
      // Show typing indicator
      typingIndicator = setTimeout(() => {
        setIsTyping(false);
      }, 1000 + Math.random() * 500);
    }
    
    console.log("[LIVE CHAT DEBUG] About to call mutateAsync...");
    try {
      await addCommentMutation.mutateAsync({ content: comment });
      console.log("[LIVE CHAT DEBUG] mutateAsync completed successfully");
      setComment("");
      
      if (isLiveChatPost && typingIndicator) {
        // Clear typing state and trigger refresh
        setIsTyping(false);
        clearTimeout(typingIndicator);
      }
    } catch (error) {
      console.log("[LIVE CHAT DEBUG] mutateAsync failed:", error);
      if (isLiveChatPost) {
        setIsTyping(false);
        if (typingIndicator) clearTimeout(typingIndicator);
      }
      console.error('Failed to submit comment:', error);
    }
  };

  // Fetch post details
  const { 
    data: post, 
    isLoading: isLoadingPost 
  } = useQuery<ForumPost>({
    queryKey: [`/api/forum/posts/${postId}`],
    enabled: !isNaN(postId),
    onSuccess: (data) => {
      // Log the full post data to help with debugging
      console.log("DEBUG Post data received:", data);
    },
    // This is critical to prevent rendering before data is available
    select: (data) => {
      if (!data) return undefined;
      
      // Ensure dates are properly formatted
      return {
        ...data,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString()
      };
    }
  });

  // Fetch comments for the post
  const { 
    data: comments, 
    isLoading: isLoadingComments,
    refetch: refetchComments
  } = useQuery<ForumComment[]>({
    queryKey: [`/api/forum/posts/${postId}/comments`],
    enabled: !isNaN(postId),
    staleTime: isLiveChatPost ? 0 : 30000, // Live chat always fresh, others cache 30s
    gcTime: isLiveChatPost ? 0 : 300000, // Live chat no cache, others 5min (gcTime replaces cacheTime in TanStack Query v5)
    select: (data) => {
      // CRITICAL: Filter to ensure we only show comments for THIS post
      // This prevents cache pollution across different posts
      const filteredComments = data?.filter(comment => comment.postId === postId) || [];
      if (filteredComments.length !== (data?.length || 0)) {
        console.error(`⚠️ Cache pollution detected! Found ${data?.length || 0} comments but only ${filteredComments.length} belong to post ${postId}`);
      }
      return filteredComments;
    }
  });

  // Handle notified users from location state (passed from new-post page)
  useEffect(() => {
    const state = (window.history.state as any)?.state;
    if (state?.notifiedUsers && Array.isArray(state.notifiedUsers)) {
      setNotifiedUsers(state.notifiedUsers);
      // Clear the state after reading it so it doesn't persist on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Handle live chat comments update when data changes
  useEffect(() => {
    if (isLiveChatPost && comments) {
      setLiveChatComments(prevComments => {
        if (!prevComments || prevComments.length === 0) {
          // First load - use the fetched data (already sorted newest first from backend)
          console.log('Live chat: Initial load with', comments.length, 'comments');
          return comments;
        }
        
        // Create a map of existing comment IDs for fast lookup
        const existingIds = new Set(prevComments.map(c => c.id));
        
        // Find new comments that don't already exist
        const newComments = comments.filter(comment => !existingIds.has(comment.id));
        
        if (newComments.length > 0) {
          console.log('Live chat: Adding', newComments.length, 'new comments');
          // Merge and sort all comments (newest first)
          const allComments = [...prevComments, ...newComments];
          return allComments.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        } else {
          // No new comments, but make sure we have all existing comments from the server
          // This handles the case where server has comments that aren't in our local state
          const serverCommentIds = new Set(comments.map(c => c.id));
          const missingFromLocal = comments.filter(comment => !existingIds.has(comment.id));
          
          if (missingFromLocal.length > 0) {
            console.log('Live chat: Restoring', missingFromLocal.length, 'missing comments');
            const allComments = [...prevComments, ...missingFromLocal];
            return allComments.sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          }
          
          return prevComments;
        }
      });
      
      // Set initial timestamp for polling
      if (comments.length > 0) {
        const latestComment = comments.reduce((latest, comment) => {
          return new Date(comment.createdAt) > new Date(latest.createdAt) ? comment : latest;
        });
        setLastPollTimestamp(latestComment.createdAt);
      } else {
        setLastPollTimestamp(new Date().toISOString());
      }
    }
  }, [isLiveChatPost, comments]);

  // Track scroll position to hide button when near comment section
  useEffect(() => {
    const handleScroll = () => {
      if (commentSectionRef.current) {
        const rect = commentSectionRef.current.getBoundingClientRect();
        const isVisible = rect.top <= window.innerHeight;
        setShowScrollButton(!isVisible);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial state
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Detect new comments for pulse effect
  useEffect(() => {
    const currentCount = comments?.length || 0;
    
    if (currentCount > lastCommentCountRef.current && lastCommentCountRef.current > 0) {
      setHasNewComments(true);
      // Clear the pulse effect after 5 seconds
      const timer = setTimeout(() => setHasNewComments(false), 5000);
      lastCommentCountRef.current = currentCount;
      return () => clearTimeout(timer);
    }
    
    // Always update the ref to track the current count
    lastCommentCountRef.current = currentCount;
  }, [comments]);

  // Set up polling interval for live chat comments
  useEffect(() => {
    if (isLiveChatPost) {
      pollIntervalRef.current = setInterval(() => {
        // Refetch comments every 10 seconds
        refetchComments();
      }, 10000); // Poll every 10 seconds
      
      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      };
    }
  }, [isLiveChatPost, refetchComments]);

  // Auto-hide post content for live chat after animation completes
  useEffect(() => {
    if (isLiveChatPost && showPostContent) {
      const isMobile = window.innerWidth <= 768;
      const fadeDelay = isMobile ? 20000 : 33000; // Start fade 2s before end
      const hideDelay = isMobile ? 22000 : 35000; // 22s mobile, 35s desktop
      
      // Start fade-out effect before complete hide
      const fadeTimer = setTimeout(() => {
        setIsAnimationFading(true);
      }, fadeDelay);
      
      // Complete hide after fade
      const hideTimer = setTimeout(() => {
        setShowPostContent(false);
      }, hideDelay);
      
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [isLiveChatPost, showPostContent]);

  // Cleanup on unmount or route change
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  // Mark post as read when viewing
  useEffect(() => {
    if (post && comments && user) {
      // Get the latest comment ID if there are comments
      const latestCommentId = comments.length > 0 
        ? Math.max(...comments.map(c => c.id))
        : null;

      // Mark the post as read with the latest comment ID
      const markAsRead = async () => {
        try {
          await fetch(`/api/forum/posts/${postId}/mark-read`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              lastReadCommentId: latestCommentId
            }),
          });
          
          // Invalidate relevant caches to update unread indicators immediately
          queryClient.invalidateQueries({ queryKey: [`/api/forum/categories/${post.categoryId}/posts`] });
          queryClient.invalidateQueries({ queryKey: ['/api/forum/categories'] });
          queryClient.invalidateQueries({ queryKey: [`/api/forum/categories/${post.categoryId}/unread-status`] });
        } catch (error) {
          console.error('Failed to mark post as read:', error);
        }
      };

      // Mark as read after a short delay to ensure the user is actually viewing the content
      const timer = setTimeout(markAsRead, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [post, comments, user, postId, queryClient]);

  // Delete post mutation
  // Mutation for toggling whether the auto-rendered post title is hidden.
  // The server enforces author/admin permission on this endpoint.
  const toggleHideTitleMutation = useMutation({
    mutationFn: async (hideDefaultTitle: boolean) => {
      const response = await apiRequest(
        "PATCH",
        `/api/forum/posts/${postId}`,
        { hideDefaultTitle },
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update title visibility");
      }
      return response.json();
    },
    onMutate: async (hideDefaultTitle: boolean) => {
      // Optimistically update so the title hides/shows immediately.
      const queryKey = [`/api/forum/posts/${postId}`];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ForumPost>(queryKey);
      queryClient.setQueryData<ForumPost | undefined>(queryKey, (old) =>
        old ? { ...old, hideDefaultTitle } : old,
      );
      return { previous };
    },
    onError: (
      error: Error,
      _vars: boolean,
      context: { previous: ForumPost | undefined } | undefined,
    ) => {
      if (context?.previous) {
        queryClient.setQueryData([`/api/forum/posts/${postId}`], context.previous);
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: (updated: ForumPost) => {
      // Use the server's response so the cache is consistent without an
      // extra refetch round-trip (avoids any optimistic-state flicker).
      queryClient.setQueryData<ForumPost | undefined>(
        [`/api/forum/posts/${postId}`],
        (old) => (old ? { ...old, ...updated } : updated),
      );
      queryClient.invalidateQueries({ queryKey: [`/api/forum/posts/${postId}`] });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/forum/posts/${postId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete post");
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate the query cache for the category's posts
      if (post) {
        queryClient.invalidateQueries({ queryKey: [`/api/forum/categories/${post.categoryId}/posts`] });
      }
      
      toast({
        title: "Post Deleted",
        description: "The post has been deleted successfully.",
      });
      
      // Navigate back to the category page
      if (post) {
        navigate(`/forum/category/${post.categoryId}`);
      } else {
        navigate("/forum");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      setCommentToDelete(commentId);
      const response = await fetch(`/api/forum/comments/${commentId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete comment");
      }
      
      return response.json();
    },
    onSuccess: (data, commentId) => {
      // Invalidate ONLY this specific post's comments cache - exact match
      queryClient.invalidateQueries({ 
        queryKey: [`/api/forum/posts/${postId}/comments`],
        exact: true // CRITICAL: Only invalidate this exact query
      });
      
      // For live chat posts, also remove the comment from the local state
      if (isLiveChatPost) {
        setLiveChatComments(prev => prev.filter(comment => comment.id !== commentId));
      }
      
      toast({
        title: "Comment Deleted",
        description: "The comment has been deleted successfully.",
      });
      setCommentToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setCommentToDelete(null);
    },
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (commentData: { content: string }) => {
      const response = await apiRequest("POST", `/api/forum/posts/${postId}/comments`, commentData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add comment");
      }
      
      return response.json();
    },
    onSuccess: (newComment) => {
      console.log(`✅ Comment created successfully:`, newComment);
      
      // CRITICAL: Verify the returned comment has the correct postId
      if (newComment.postId !== postId) {
        console.error(`🚨 BUG DETECTED: Server returned comment with postId ${newComment.postId} but we're on post ${postId}!`);
        toast({
          title: "Error",
          description: "Comment was created but may appear on wrong post. Please refresh the page.",
          variant: "destructive",
        });
        return;
      }
      
      // Clear the comment input field
      setComment("");
      
      // Add the new comment to the existing comments list in the cache
      // This immediately updates the UI without waiting for a refetch
      if (newComment && comments) {
        // Add user info to the new comment (assuming it's returned from the API)
        // If not in the response, we'll add the current user's info as a temporary solution
        const commentWithAuthor = {
          ...newComment,
          author: newComment.author || {
            id: user?.id || 0,
            username: user?.username || 'Unknown',
            avatarUrl: user?.avatarUrl || null
          }
        };
        
        // Update the cache with the new comment included - use EXACT key match
        queryClient.setQueryData(
          [`/api/forum/posts/${postId}/comments`], 
          [...comments, commentWithAuthor]
        );
        
        // For live chat, also update the live chat comments and timestamp
        if (isLiveChatPost) {
          setLiveChatComments(prev => {
            const merged = [...prev, commentWithAuthor];
            return merged.sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          });
          setLastPollTimestamp(commentWithAuthor.createdAt);
        }
      }
      
      // Invalidate ONLY this specific post's comments cache - use exact match
      queryClient.invalidateQueries({ 
        queryKey: [`/api/forum/posts/${postId}/comments`],
        exact: true // CRITICAL: Only invalidate this exact query, not pattern matches
      });
      
      // Invalidate category-level caches so other users see unread indicators
      if (post) {
        queryClient.invalidateQueries({ queryKey: [`/api/forum/categories/${post.categoryId}/posts`] });
        queryClient.invalidateQueries({ queryKey: ['/api/forum/categories'] });
        queryClient.invalidateQueries({ queryKey: [`/api/forum/categories/${post.categoryId}/unread-status`] });
      }
      
      toast({
        title: "Comment Added",
        description: "Your comment has been posted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmitComment = async (e: React.FormEvent) => {
    console.log("[COMMENT DEBUG] handleSubmitComment called");
    console.log("[COMMENT DEBUG] comment:", comment);
    console.log("[COMMENT DEBUG] user:", user);
    console.log("[COMMENT DEBUG] hasPermission:", hasPermission);
    console.log("[COMMENT DEBUG] isAdmin:", isAdmin);
    
    e.preventDefault();
    console.log("[COMMENT DEBUG] preventDefault called");
    
    if (!comment.trim()) {
      console.log("[COMMENT DEBUG] BLOCKED: Comment is empty");
      return;
    }
    console.log("[COMMENT DEBUG] Comment not empty, continuing...");
    
    if (!user) {
      console.log("[COMMENT DEBUG] BLOCKED: No user");
      toast({
        title: "Authentication Required",
        description: "You must be logged in to post a comment.",
        variant: "destructive",
      });
      return;
    }
    console.log("[COMMENT DEBUG] User exists, continuing...");
    
    if (!hasPermission && !isAdmin) {
      console.log("[COMMENT DEBUG] BLOCKED: No permission - hasPermission:", hasPermission, "isAdmin:", isAdmin);
      toast({
        title: "Commenting Restricted",
        description: user.isBlocked
          ? `Your account has been blocked${user.blockReason ? `: ${user.blockReason}` : ''}.`
          : "This feature requires a specific membership level to access.",
        variant: "destructive",
      });
      return;
    }
    console.log("[COMMENT DEBUG] Permission check passed, calling mutation...");
    
    addCommentMutation.mutate({ content: comment });
    console.log("[COMMENT DEBUG] Mutation called");
  };

  if (isLoadingPost || isLoadingComments) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-coral" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold text-navy mb-2">Post Not Found</h2>
        <p className="text-navy/70 mb-6">The post you're looking for doesn't exist or has been removed.</p>
        <Button onClick={() => navigate("/forum")} variant="outline" className="border-navy/20">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Forums
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Mobile-first navigation and actions */}
      <div className="mb-6">
        <Button 
          onClick={() => navigate(`/forum/category/${post.categoryId}`)} 
          variant="ghost" 
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to {post.category?.name || 'Category'}
        </Button>

        {/* Email notification success alert */}
        {notifiedUsers.length > 0 && (
          <Alert className="mb-4 border-green-200 bg-green-50 relative" data-testid="alert-notification-success">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-green-100"
              onClick={() => setNotifiedUsers([])}
              data-testid="button-dismiss-notification-alert"
            >
              ✕
            </Button>
            <AlertTitle className="text-green-800 font-semibold pr-8">Email Notifications Sent Successfully</AlertTitle>
            <AlertDescription className="text-green-700">
              <p className="mb-3">Your post has been created and notifications were sent to {notifiedUsers.length} {notifiedUsers.length === 1 ? 'mailbox' : 'mailboxes'}:</p>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {notifiedUsers.map((user, index) => {
                  const sharedUsernames = user.additionalUsernames ?? [];
                  const allUsernames = [user.username, ...sharedUsernames].filter(Boolean);
                  return (
                    <div key={index} className="flex items-center gap-2 text-sm bg-white rounded-md p-2 border border-green-200" data-testid={`notification-user-${index}`}>
                      <Mail className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="font-medium text-navy">{allUsernames.join(', ')}</span>
                      <span className="text-gray-500">({user.email})</span>
                      {sharedUsernames.length > 0 && (
                        <span
                          className="text-xs text-green-700 italic"
                          data-testid={`notification-user-${index}-shared-mailbox`}
                        >
                          shared mailbox
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Responsive action buttons */}
        <div className="flex flex-wrap justify-center sm:justify-end items-center gap-2 mb-4">
          {/* Hide-default-title checkbox - visible to post author and admins.
              Useful when the author's body content already includes its own
              styled headline, so the auto-rendered title would otherwise show
              twice. */}
          {(user && (user.id === post.author?.id || isAdmin)) && (
            <div className="flex items-center gap-2 px-2 h-9 rounded-md border border-navy/20">
              <Checkbox
                id="hide-default-title"
                checked={!!post.hideDefaultTitle}
                disabled={toggleHideTitleMutation.isPending}
                onCheckedChange={(checked) =>
                  toggleHideTitleMutation.mutate(checked === true)
                }
                data-testid="checkbox-hide-default-title"
              />
              <Label
                htmlFor="hide-default-title"
                className="text-sm text-navy/80 cursor-pointer select-none"
              >
                Hide default title
              </Label>
            </div>
          )}

          {/* Edit button - visible to post author and admins */}
          {(user && (user.id === post.author?.id || isAdmin)) && (
            <Button 
              variant="outline" 
              size="sm"
              className="border-navy/20 hover:bg-coral/10 hover:text-coral hover:border-coral"
              onClick={() => navigate(`/forum/edit-post/${post.id}`)}
            >
              <Edit className="mr-2 h-4 w-4" /> Edit Post
            </Button>
          )}

          {/* Delete button - visible to admins only */}
          {isAdmin && (
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  size="sm"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete Post
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the post
                    and all associated comments.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deletePostMutation.mutate()}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={deletePostMutation.isPending}
                  >
                    {deletePostMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </>
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Main post - retro styling for live chat */}
      {isLiveChatPost ? (
        showPostContent && (
          <div className="bbs-chat-267" style={{ 
            position: 'relative',
            background: '#000', 
            color: '#00ff00', 
            fontFamily: 'monospace', 
            border: '2px solid #009900',
            borderRadius: '4px 4px 0 0', 
            padding: '16px',
            minHeight: '200px',
            marginBottom: '0',
            borderBottom: 'none',
            opacity: isAnimationFading ? 0 : 1,
            transition: 'opacity 2s ease-out'
          }}>
            <button
              onClick={() => setShowPostContent(false)}
              data-testid="button-skip-animation"
              className="absolute top-2 right-2 z-10 hover:bg-[#009900] transition-colors"
              style={{
                background: 'none',
                border: '1px solid #009900',
                color: '#00ff00',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                borderRadius: '2px',
                fontFamily: 'monospace',
                fontSize: '18px',
                fontWeight: 'bold',
                padding: '0'
              }}
              title="Skip animation"
              aria-label="Skip animation and go to chat"
            >
              <X className="h-4 w-4" />
            </button>
            <ForumContent 
              content={post.content} 
              className="prose-green"
              style={{ color: '#00ff00', fontFamily: 'monospace' }}
            />
          </div>
        )
      ) : (
        <Card className="border border-navy/10 mb-8 bg-white">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              {post.hideDefaultTitle ? (
                /* Title is hidden per the author/admin's checkbox; render an
                   accessible label so screen readers and the document outline
                   still know what this post is. */
                <h2 className="sr-only">{post.title}</h2>
              ) : (
                <CardTitle className="text-2xl font-bold text-navy" data-testid="text-post-title">
                  {post.title}
                </CardTitle>
              )}
              <div className="flex items-center text-navy/70 text-sm">
                <Clock className="h-4 w-4 mr-1" />
                <span>
                  {(() => {
                    try {
                      // Make sure post exists and createdAt is defined
                      if (!post || !post.createdAt) {
                        console.error("Post or post.createdAt is undefined:", post);
                        return "Invalid date";
                      }
                      
                      // Verify the date string is valid
                      const timestamp = Date.parse(post.createdAt);
                      if (isNaN(timestamp)) {
                        console.error("Invalid post.createdAt date:", post.createdAt);
                        return "Invalid date";
                      }
                      
                      const dateObj = new Date(timestamp);
                      if (isNaN(dateObj.getTime())) {
                        console.error("Invalid date object after parsing post.createdAt:", post.createdAt);
                        return "Invalid date";
                      }
                      
                      return format(dateObj, 'MMM d, yyyy h:mm a');
                    } catch (error) {
                      console.error("Date formatting error for post.createdAt:", error);
                      return "Invalid date";
                    }
                  })()}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <ForumContent 
              content={post.content} 
              className="prose-navy prose-headings:text-navy prose-strong:text-navy/90" 
            />
          </CardContent>
          <CardFooter className="border-t border-navy/5 bg-navy/5 py-3 px-6">
            <div className="flex items-center text-navy/70">
              <UserAvatar 
                user={post.author}
                size="sm"
                showBadge={true}
                inComments={true}
              />
              <span className="ml-2">{post.author?.username || 'Anonymous'}</span>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Forum Likes Section - above comments for regular posts */}
      {post && !isLiveChatPost && (
        <div className="my-6 flex flex-wrap items-start gap-4">
          <ForumLikes postId={post.id} />
          <ForumShareButton 
            post={post}
            variant="outline"
            className="text-lg py-6 px-8"
            floatingOnMobile={false}
          />
        </div>
      )}

      {/* Comments section */}
      <div className={isLiveChatPost ? "" : "mb-8"}>
        {!isLiveChatPost && (
          <h2 className="text-xl font-bold text-navy mb-4 flex items-center">
            <MessageSquare className="mr-2 h-5 w-5" />
            Comments {comments && comments.length > 0 && `(${comments.length})`}
          </h2>
        )}
        
        {/* Retro Live Chat for post 267 - Flex container for messages + sticky form */}
        {isLiveChatPost ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            maxHeight: showPostContent ? '55vh' : 'calc(100vh - 250px)',
            border: '2px solid #009900',
            borderTop: showPostContent ? 'none' : '2px solid #009900',
            borderRadius: showPostContent ? '0 0 4px 4px' : '4px',
            overflow: 'hidden',
            marginBottom: '2rem'
          }}>
            <div className="bbs-chat-267" style={{ 
              background: '#000', 
              color: '#00ff00', 
              fontFamily: 'monospace', 
              padding: '12px',
              flex: '1',
              overflowY: 'auto',
              scrollPaddingBottom: '20px'
            }}>
            <style>
              {`
                .bbs-chat-267 .chat-message { 
                  border-bottom: 1px dashed #009900; 
                  padding: 4px 8px; 
                  margin-bottom: 2px; 
                }
                .bbs-chat-267 .chat-message:last-child { 
                  border-bottom: none; 
                }
                .bbs-chat-267 .chat-username { 
                  color: #00ff00; 
                  font-weight: bold; 
                }
                .bbs-chat-267 .chat-time { 
                  font-size: 0.75rem; 
                  color: #00aa00; 
                }
                .bbs-chat-267 .chat-content { 
                  color: #00ff00; 
                  margin-top: 2px; 
                }
                .bbs-chat-267 .chat-admin-button {
                  background: none;
                  border: 1px solid #009900;
                  color: #009900;
                  font-family: monospace;
                  font-size: 0.7rem;
                  padding: 1px 4px;
                  margin-left: 8px;
                  cursor: pointer;
                }
                .bbs-chat-267 .chat-admin-button:hover {
                  background: #009900;
                  color: #000;
                }
                
                /* Terminal cursor animation */
                .terminal-cursor {
                  animation: blink 1s infinite;
                  color: #00ff00;
                  font-weight: bold;
                }
                
                @keyframes blink {
                  0%, 50% { opacity: 1; }
                  51%, 100% { opacity: 0; }
                }
                
                /* Typing indicator */
                .typing-indicator {
                  color: #00aa00;
                  font-style: italic;
                  animation: pulse 1.5s infinite;
                }
                
                @keyframes pulse {
                  0%, 100% { opacity: 0.6; }
                  50% { opacity: 1; }
                }
                
                /* Message slide-in animation */
                .chat-message {
                  animation: slideInFromBottom 0.3s ease-out;
                }
                
                @keyframes slideInFromBottom {
                  from {
                    opacity: 0;
                    transform: translateY(10px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
                
                /* Send button enhancement */
                .bbs-chat-267 .chat-send-btn {
                  background: #000;
                  border: 1px solid #009900;
                  color: #009900;
                  font-family: monospace;
                  transition: all 0.2s ease;
                }
                
                .bbs-chat-267 .chat-send-btn:hover {
                  background: #009900;
                  color: #000;
                  box-shadow: 0 0 10px #009900;
                }
                
                .bbs-chat-267 .chat-send-btn:active {
                  transform: scale(0.95);
                }
              `}
            </style>
            {/* Live Chat Header with Analytics */}
            <div className="border-bottom-1 border-green-500 pb-2 mb-3" style={{ borderBottom: '1px dashed #009900' }}>
              <div className="flex justify-between items-center">
                <div>
                  <span style={{ color: '#00ff00', fontWeight: 'bold' }}>{'>>> BAREFOOT BAY LIVE CHAT <<<'}</span>
                </div>
                <div style={{ color: '#00aa00', fontSize: '0.75rem' }}>
                  {activeUserList && activeUserList.length > 0 ? (
                    <span>ACTIVE: {activeUserList.map(user => user.username).join(', ')} • </span>
                  ) : (
                    <span>{activeUserCount} ACTIVE USER{activeUserCount !== 1 ? 'S' : ''} • </span>
                  )}
                  <span>STATUS: {activeUsersLoading ? 'CONNECTING...' : 'LIVE'}</span>
                </div>
              </div>
              <div style={{ color: '#00aa00', fontSize: '0.7rem', marginTop: '4px' }}>
                AUTO-REFRESH: 10 SEC • STATUS: ONLINE
              </div>
            </div>
            
            {(!liveChatComments || liveChatComments.length === 0) && (!comments || comments.length === 0) ? (
              <div className="text-center py-8">
                <p style={{ color: '#00aa00' }}>{'>>> WAITING FOR MESSAGES... <<<'}</p>
                <p style={{ color: '#00aa00', fontSize: '0.8rem', marginTop: '8px' }}>POLLING EVERY 10 SECONDS</p>
              </div>
            ) : (
              <div>
                {(liveChatComments && liveChatComments.length > 0 ? liveChatComments : comments || []).map((comment) => (
                  <div key={comment.id} className="chat-message">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="chat-username">{comment.author?.username || 'Anonymous'}</span>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className="chat-time">
                          {(() => {
                            if (!comment || !comment.createdAt) return 'ERR';
                            
                            try {
                              // Ensure timestamp is parsed as UTC by appending 'Z' if no timezone info exists
                              let dateString = comment.createdAt;
                              if (!dateString.includes('Z') && !dateString.includes('+') && !dateString.includes('-', 10)) {
                                dateString = dateString.replace(' ', 'T') + 'Z';
                              }
                              
                              const messageDate = new Date(dateString);
                              if (isNaN(messageDate.getTime())) return "ERR";
                              
                              const now = Date.now();
                              const diffMs = now - messageDate.getTime();
                              const diffSeconds = Math.floor(diffMs / 1000);
                              const diffMinutes = Math.floor(diffSeconds / 60);
                              const diffHours = Math.floor(diffMinutes / 60);
                              
                              // Only show NOW for very recent messages (less than 10 seconds)
                              if (diffSeconds < 10 && diffSeconds >= 0) {
                                return 'NOW';
                              } else if (diffMinutes < 1 && diffSeconds >= 0) {
                                return `${diffSeconds}S`;
                              } else if (diffMinutes < 60 && diffMinutes >= 0) {
                                return `${diffMinutes}M`;
                              } else if (diffHours < 24 && diffHours >= 0) {
                                return format(messageDate, 'HH:mm');
                              } else {
                                return format(messageDate, 'MM/dd HH:mm');
                              }
                            } catch (error) {
                              console.error('Timestamp formatting error:', error, comment);
                              return "ERR";
                            }
                          })()}
                        </span>
                        {checkFeaturePermission?.('comments') && (isAdmin || (user && comment.author?.id === user.id) || (user && post && post.authorId === user.id)) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button className="chat-admin-button">DEL</button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Comment</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this comment? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteCommentMutation.mutate(comment.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  {deleteCommentMutation.isPending && commentToDelete === comment.id ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Deleting...
                                    </>
                                  ) : (
                                    "Delete"
                                  )}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                    <div className="chat-content">
                      {typingMessages.has(comment.id) ? (
                        <span>
                          {typedContent.get(comment.id) || ''}
                          <span className="terminal-cursor">_</span>
                        </span>
                      ) : (
                        comment.content.includes('<') ? (
                          <ForumContent content={comment.content} className="prose-sm" />
                        ) : (
                          comment.content
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Sticky comment form for live chat */}
          {user && checkFeaturePermission?.('comments') && (
            <CommentComposer
              comment={comment}
              setComment={setComment}
              onSubmit={(e) => {
                e.preventDefault();
                handleCommentSubmitWithTyping();
              }}
              isLiveChat={true}
              isPending={addCommentMutation.isPending}
              isTyping={isTyping}
            />
          )}
        </div>
        ) : (
          /* Standard comments for all other posts */
          <>
            {!comments || comments.length === 0 ? (
              <div className="text-center py-8 bg-navy/5 rounded-lg">
                <MessageSquare className="h-10 w-10 mx-auto text-navy/30 mb-3" />
                <p className="text-navy/70">No comments yet. Be the first to join the conversation!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.filter(comment => comment && comment.id).map((comment) => (
                  <Card key={comment.id} className="border border-navy/10 bg-white">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <UserAvatar 
                          user={comment.author || {
                            id: 0,
                            username: 'Anonymous',
                            avatarUrl: null,
                            isResident: false,
                            role: 'user',
                            createdAt: new Date().toISOString()
                          }}
                          size="md"
                          showBadge={true}
                          inComments={true}
                        />
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-navy">{comment.author?.username || 'Anonymous'}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-navy/60">
                                {comment && comment.createdAt ? (
                                  (() => {
                                    try {
                                      if (!comment || !comment.createdAt) {
                                        console.error("Comment or comment.createdAt is undefined:", comment);
                                        return "Invalid date";
                                      }
                                      
                                      // Ensure timestamp is parsed as UTC by appending 'Z' if no timezone info exists
                                      let dateString = comment.createdAt;
                                      if (!dateString.includes('Z') && !dateString.includes('+') && !dateString.includes('-', 10)) {
                                        dateString = dateString.replace(' ', 'T') + 'Z';
                                      }
                                      
                                      const dateObj = new Date(dateString);
                                      if (isNaN(dateObj.getTime())) {
                                        console.error("Invalid comment.createdAt date:", comment.createdAt);
                                        return "Invalid date";
                                      }
                                      
                                      const now = Date.now();
                                      const diffMs = now - dateObj.getTime();
                                      
                                      // Show "Just now" only for comments less than 1 minute old
                                      if (diffMs < 60 * 1000 && diffMs >= 0) {
                                        return 'Just now';
                                      }
                                      
                                      return format(dateObj, 'MMM d, yyyy h:mm a');
                                    } catch (error) {
                                      console.error("Date formatting error for comment.createdAt:", error);
                                      return "Invalid date";
                                    }
                                  })()
                                ) : ''}
                              </span>
                              {checkFeaturePermission?.('comments') && (isAdmin || (user && comment.author?.id === user.id) || (user && post && post.authorId === user.id)) && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      className="h-6 w-6 rounded-full hover:bg-red-100 hover:text-red-600"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Comment</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete this comment? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteCommentMutation.mutate(comment.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        {deleteCommentMutation.isPending && commentToDelete === comment.id ? (
                                          <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Deleting...
                                          </>
                                        ) : (
                                          "Delete"
                                        )}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </div>
                          <div className="text-navy/80">
                            {comment.content.includes('<') ? (
                              <ForumContent content={comment.content} className="prose-sm" />
                            ) : (
                              <p>{comment.content}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add comment form */}
      <div ref={commentSectionRef}>
        {!user ? (
        <div className="text-center py-6 bg-navy/5 rounded-lg">
          <p className="text-navy/70 mb-3">You need to be logged in to post comments.</p>
          <Button onClick={() => navigate("/auth")} className="bg-coral hover:bg-coral/90 text-white">
            Sign In to Comment
          </Button>
        </div>
      ) : !checkFeaturePermission?.('comments') ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800 mb-1">
                Commenting Restricted
              </h3>
              <p className="text-sm text-yellow-700">
                {user.isBlocked 
                  ? `Your account has been blocked${user.blockReason ? `: ${user.blockReason}` : ''}. You cannot post comments at this time.`
                  : "This feature requires a specific membership level to access."}
              </p>
            </div>
          </div>
        </div>
      ) : !isLiveChatPost ? (
        <CommentComposer
          comment={comment}
          setComment={setComment}
          onSubmit={handleSubmitComment}
          isLiveChat={false}
          isPending={addCommentMutation.isPending}
        />
      ) : null}
      </div>

      {/* Forum Likes & Share Section - below comments for live chat post */}
      {post && isLiveChatPost && (
        <div className="my-6 flex flex-wrap items-start gap-4">
          <ForumLikes postId={post.id} />
          <ForumShareButton 
            post={post}
            variant="outline"
            className="text-lg py-6 px-8"
            floatingOnMobile={false}
          />
        </div>
      )}

      {/* Floating scroll to bottom button - positioned on the left side with smart visibility */}
      {showScrollButton && (
        <Button
          onClick={scrollToCommentSection}
          className={`fixed left-4 bottom-4 z-40 bg-coral hover:bg-coral/90 text-white rounded-full shadow-lg transition-all duration-300 hover:scale-110 ${
            hasNewComments ? 'animate-pulse ring-4 ring-coral/50' : ''
          }`}
          size="icon"
          title="Scroll to comments"
          data-testid="button-scroll-to-comments"
          style={{
            bottom: 'max(1rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))'
          }}
        >
          <ChevronDown className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}