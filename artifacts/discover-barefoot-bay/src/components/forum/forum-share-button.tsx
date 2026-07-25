import { ShareButton } from "@/components/shared/share-button";
import { cn } from "@/lib/utils";

interface ForumPost {
  id: number;
  title: string;
  content: string;
  author?: {
    username: string;
  };
  category?: {
    name: string;
  };
  createdAt?: string;
}

interface ForumShareButtonProps {
  post: ForumPost;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  floatingOnMobile?: boolean;
}

export function ForumShareButton({
  post,
  className,
  variant = "outline",
  size = "default",
  floatingOnMobile = false,
}: ForumShareButtonProps) {
  // Construct the full URL for the post
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const postUrl = `${baseUrl}/forum/post/${post.id}`;

  // Create a preview snippet of the content (first 150 characters)
  const contentPreview = post.content
    ? post.content.replace(/<[^>]*>/g, '').substring(0, 150) + (post.content.length > 150 ? '...' : '')
    : '';

  // Create the share title
  const shareTitle = `${post.title} - Barefoot Bay Extra! Extra!`;

  // Create personalized share text with context
  const shareText = post.author && post.category
    ? `Check out this discussion by ${post.author.username} in ${post.category.name}: "${post.title}"\n\n${contentPreview}\n\nJoin the conversation at Barefoot Bay Community!`
    : `Check out this discussion: "${post.title}"\n\n${contentPreview}\n\nJoin the conversation at Barefoot Bay Community!`;

  // Optional: Get a preview image if the post has media
  const imageUrl = undefined; // Can be extended to use post.mediaUrls[0] if available

  if (floatingOnMobile) {
    return (
      <>
        {/* Mobile floating button */}
        <div className="fixed bottom-4 right-4 z-50 sm:hidden" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
          <ShareButton
            title={shareTitle}
            text={shareText}
            url={postUrl}
            imageUrl={imageUrl}
            className={cn("shadow-lg bg-coral hover:bg-coral/90 text-white border-coral", className)}
            variant="default"
            size="icon"
            buttonText="Share"
            dialogTitle="Share Post"
            dialogDescription="Share this discussion with your friends and community"
          />
        </div>
        
        {/* Desktop inline button */}
        <div className="hidden sm:inline-flex">
          <ShareButton
            title={shareTitle}
            text={shareText}
            url={postUrl}
            imageUrl={imageUrl}
            className={className}
            variant={variant}
            size={size}
            buttonText="Share"
            dialogTitle="Share Post"
            dialogDescription="Share this discussion with your friends and community"
          />
        </div>
      </>
    );
  }

  return (
    <ShareButton
      title={shareTitle}
      text={shareText}
      url={postUrl}
      imageUrl={imageUrl}
      className={className}
      variant={variant}
      size={size}
      buttonText="Share"
      dialogTitle="Share Post"
      dialogDescription="Share this discussion with your friends and community"
    />
  );
}
