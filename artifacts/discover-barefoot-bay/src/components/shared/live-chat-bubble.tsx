import { useState, useMemo, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useLocation } from "wouter";
import { usePermissions } from "@/hooks/use-permissions";
import { useNavigationTooltip } from '@/contexts/navigation-tooltip-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const LIVE_CHAT_POST_ID = 267; // Specific forum post ID for live chat

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function formatChatTime(createdAt: string): string {
  try {
    let dateString = createdAt;
    // Ensure UTC parsing when no timezone info is present
    if (!dateString.includes('Z') && !dateString.includes('+') && !dateString.includes('-', 10)) {
      dateString = dateString.replace(' ', 'T') + 'Z';
    }
    const messageDate = new Date(dateString);
    if (isNaN(messageDate.getTime())) return 'ERR';

    const diffMs = Date.now() - messageDate.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffSeconds < 10 && diffSeconds >= 0) return 'NOW';
    if (diffMinutes < 1 && diffSeconds >= 0) return `${diffSeconds}S`;
    if (diffMinutes < 60 && diffMinutes >= 0) return `${diffMinutes}M`;
    if (diffHours < 24 && diffHours >= 0) {
      return messageDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    const mm = String(messageDate.getMonth() + 1).padStart(2, '0');
    const dd = String(messageDate.getDate()).padStart(2, '0');
    const hhmm = messageDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${mm}/${dd} ${hhmm}`;
  } catch {
    return 'ERR';
  }
}

// ---------------------------------------------------------------------------
// Preview popup content (terminal-styled)
// ---------------------------------------------------------------------------

interface PreviewComment {
  id: number;
  postId: number;
  content: string;
  createdAt: string;
  author?: { id: number; username: string };
}

interface LiveChatPreviewContentProps {
  comments: PreviewComment[];
  isLoading: boolean;
  isError: boolean;
  onOpenChat: () => void;
}

// Injected once — keyframes + themed scrollbar pseudo-selectors (can't be inline styles)
const PREVIEW_STYLE_ID = 'live-chat-preview-styles';
function ensurePreviewStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(PREVIEW_STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = PREVIEW_STYLE_ID;
  el.textContent = `
    @keyframes lcb-blink {
      0%, 49% { opacity: 1; }
      50%, 100% { opacity: 0; }
    }
    @keyframes lcb-scanline {
      0%   { opacity: 0.15; }
      50%  { opacity: 0.35; }
      100% { opacity: 0.15; }
    }
    .lcb-preview-body::-webkit-scrollbar { width: 4px; }
    .lcb-preview-body::-webkit-scrollbar-track { background: #001400; }
    .lcb-preview-body::-webkit-scrollbar-thumb { background: #00cc00; border-radius: 2px; }
    .lcb-preview-body::-webkit-scrollbar-thumb:hover { background: #00ff00; }
  `;
  document.head.appendChild(el);
}

function TerminalLoadingState() {
  ensurePreviewStyles();
  return (
    <div style={{ paddingTop: '4px' }}>
      {/* "ESTABLISHING UPLINK..." with blinking block cursor */}
      <div style={{ color: '#00cc00', fontSize: '0.75rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '2px' }}>
        <span>{'>>> ESTABLISHING UPLINK...'}</span>
        <span
          style={{
            display: 'inline-block',
            width: '8px',
            height: '0.85em',
            background: '#00ff00',
            verticalAlign: 'text-bottom',
            animation: 'lcb-blink 0.8s step-start infinite',
          }}
        />
      </div>
      {/* Flickering skeleton rows to simulate incoming data */}
      {[0.9, 0.7, 0.55].map((opacity, i) => (
        <div
          key={i}
          style={{
            borderBottom: '1px dashed #003300',
            padding: '4px 0',
            marginBottom: '2px',
            animation: `lcb-scanline ${1.1 + i * 0.3}s ease-in-out infinite`,
            animationDelay: `${i * 0.18}s`,
          }}
        >
          {/* username placeholder */}
          <div style={{
            height: '7px',
            width: `${38 + i * 12}%`,
            background: '#004400',
            borderRadius: '2px',
            marginBottom: '3px',
            opacity,
          }} />
          {/* message placeholder */}
          <div style={{
            height: '6px',
            width: `${65 + i * 8}%`,
            background: '#003300',
            borderRadius: '2px',
            opacity: opacity * 0.7,
          }} />
        </div>
      ))}
    </div>
  );
}

function LiveChatPreviewContent({ comments, isLoading, isError, onOpenChat }: LiveChatPreviewContentProps) {
  ensurePreviewStyles();

  // Hover-to-expand: rest the pointer on a truncated message for ~0.5s to see
  // the full text; collapses again on mouse leave.
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRowMouseEnter = (id: number, isTruncated: boolean) => {
    if (!isTruncated) return;
    if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
    expandTimerRef.current = setTimeout(() => setExpandedId(id), 500);
  };

  const handleRowMouseLeave = () => {
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
    setExpandedId(null);
  };

  useEffect(() => () => {
    if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
  }, []);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Open live chat"
      onClick={onOpenChat}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenChat();
        }
      }}
      style={{
        background: '#000',
        border: '2px solid #009900',
        borderRadius: '4px',
        fontFamily: 'monospace',
        width: '280px',
        overflow: 'hidden',
        cursor: 'pointer',
        pointerEvents: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: '1px dashed #009900',
          padding: '6px 10px 4px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ color: '#00ff00', fontWeight: 'bold', fontSize: '0.7rem' }}>
          {'>>> LIVE CHAT <<<'}
        </span>
        <span style={{ color: '#00aa00', fontSize: '0.65rem' }}>PREVIEW</span>
      </div>

      {/* Body — themed scrollbar via .lcb-preview-body class */}
      <div
        className="lcb-preview-body"
        style={{
          padding: '6px 10px',
          minHeight: '60px',
          maxHeight: '180px',
          overflowY: 'auto',
          // Firefox scrollbar
          scrollbarWidth: 'thin',
          scrollbarColor: '#00cc00 #001400',
        } as React.CSSProperties}
      >
        {isLoading ? (
          <TerminalLoadingState />
        ) : isError ? (
          <p style={{ color: '#00aa00', fontSize: '0.75rem', margin: 0 }}>{'>>> UNAVAILABLE <<<'}</p>
        ) : comments.length === 0 ? (
          <TerminalLoadingState />
        ) : (
          comments.map((comment) => {
            const rawText = comment.content.includes('<') ? stripHtml(comment.content) : comment.content;
            const isTruncated = rawText.length > 60;
            const isExpanded = expandedId === comment.id;
            const displayText = isExpanded || !isTruncated ? rawText : rawText.slice(0, 60) + '…';
            return (
              <div
                key={comment.id}
                onMouseEnter={() => handleRowMouseEnter(comment.id, isTruncated)}
                onMouseLeave={handleRowMouseLeave}
                style={{
                  borderBottom: '1px dashed #004400',
                  padding: '3px 0',
                  marginBottom: '2px',
                  background: isExpanded ? '#001a00' : 'transparent',
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ color: '#00ff00', fontWeight: 'bold', fontSize: '0.72rem' }}>
                    {comment.author?.username ?? 'Anonymous'}
                  </span>
                  <span style={{ color: '#00aa00', fontSize: '0.65rem', marginLeft: '6px', flexShrink: 0 }}>
                    {formatChatTime(comment.createdAt)}
                  </span>
                </div>
                <div style={{ color: '#00ff00', fontSize: '0.72rem', marginTop: '1px', lineHeight: 1.3, wordBreak: 'break-word' }}>
                  {displayText}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: '1px dashed #009900',
          padding: '4px 10px',
          color: '#00aa00',
          fontSize: '0.65rem',
        }}
      >
        ▶ Click to open live chat
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LiveChatBubble() {
  const { user } = useAuth();
  const { canSeeWeatherRocketIcons } = usePermissions();
  const { activeTooltip, toggleTooltip } = useNavigationTooltip();
  const [, navigate] = useLocation();
  const [isGlitching, setIsGlitching] = useState(false);
  const [showMarkReadX, setShowMarkReadX] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const queryClient = useQueryClient();

  // Show as faded with tooltip when user doesn't have permission or is not logged in
  const isDisabled = !user || !canSeeWeatherRocketIcons;

  // Whether the live-chat preview tooltip is currently open (registered users only)
  const isPreviewOpen = !isDisabled && activeTooltip === 'chat';

  // ---------------------------------------------------------------------------
  // Unread count query (existing — unchanged logic, types tightened for RQ v5)
  // ---------------------------------------------------------------------------
  const { data: unreadData } = useQuery<{ unreadCount: number }>({
    queryKey: [`/api/forum/posts/${LIVE_CHAT_POST_ID}/unread-comments`],
    enabled: !!user,
    refetchInterval: 5000,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 2,
    // Note: onError was removed from useQuery options in TanStack Query v5
  });

  const unreadCount = unreadData?.unreadCount || 0;

  // ---------------------------------------------------------------------------
  // Preview comments query — enabled only while popup is open
  // ---------------------------------------------------------------------------
  const { data: rawPreviewData, isLoading: isPreviewLoading, isError: isPreviewError } = useQuery({
    queryKey: [`/api/forum/posts/${LIVE_CHAT_POST_ID}/comments`],
    enabled: isPreviewOpen,
    staleTime: 0,
    refetchInterval: isPreviewOpen ? 5000 : false,
  });

  // NOTE: the app's global react-query placeholderData injects null for this
  // query key immediately, which makes isLoading report false before the first
  // real response. Treat a null/undefined payload as still loading (unless the
  // fetch errored) so the UPLINK animation actually shows.
  const isPreviewDataPending = !isPreviewError && (isPreviewLoading || rawPreviewData == null);

  // Minimum display time for the UPLINK animation: play it on EVERY popup open
  // for ~700ms, even when the data is already cached / arrives instantly.
  const [minLoadingActive, setMinLoadingActive] = useState(false);
  // Ref mirrors isPreviewOpen from the previous commit so the very first
  // render after opening shows the loader synchronously (the effect below
  // only runs after that commit — without this, cached data would flash).
  const prevPreviewOpenRef = useRef(false);
  const justOpened = isPreviewOpen && !prevPreviewOpenRef.current;
  useEffect(() => {
    prevPreviewOpenRef.current = isPreviewOpen;
    if (!isPreviewOpen) {
      setMinLoadingActive(false);
      return;
    }
    setMinLoadingActive(true);
    const timer = setTimeout(() => setMinLoadingActive(false), 700);
    return () => clearTimeout(timer);
  }, [isPreviewOpen]);

  // The 700ms open-window loader plays on EVERY open (even if the query is in
  // an error state from a previous attempt); once the window expires, an
  // errored request shows UNAVAILABLE instead of spinning forever.
  const showPreviewLoading = minLoadingActive || justOpened || (!isPreviewError && isPreviewDataPending);

  const previewComments = useMemo<PreviewComment[]>(() => {
    // Guard: global placeholderData fallback can inject [] or null for unknown-shaped data
    if (!Array.isArray(rawPreviewData)) return [];
    // Sort DESC (newest first), take top 5, so newest renders at top of preview.
    return (rawPreviewData as PreviewComment[])
      .filter((c) => c.postId === LIVE_CHAT_POST_ID) // defensive: prevent cross-post cache pollution
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5); // 5 most recent, descending (newest at top)
  }, [rawPreviewData]);

  // ---------------------------------------------------------------------------
  // Mark-all-read mutation (existing — unchanged)
  // ---------------------------------------------------------------------------
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/forum/posts/${LIVE_CHAT_POST_ID}/mark-all-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to mark live chat comments as read');
      }
      return response.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: [`/api/forum/posts/${LIVE_CHAT_POST_ID}/unread-comments`] });
      const previousData = queryClient.getQueryData([`/api/forum/posts/${LIVE_CHAT_POST_ID}/unread-comments`]);
      queryClient.setQueryData([`/api/forum/posts/${LIVE_CHAT_POST_ID}/unread-comments`], { unreadCount: 0 });
      setShowMarkReadX(false);
      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/forum/posts/${LIVE_CHAT_POST_ID}/unread-comments`] });
    },
    onError: (_error: any, _variables: any, context: any) => {
      console.error('Error marking all live chat comments as read:', _error);
      if (context?.previousData) {
        queryClient.setQueryData([`/api/forum/posts/${LIVE_CHAT_POST_ID}/unread-comments`], context.previousData);
      }
      setShowMarkReadX(false);
    }
  });

  // ---------------------------------------------------------------------------
  // Event handlers — disabled branch
  // ---------------------------------------------------------------------------
  const handleDisabledClick = () => {
    toggleTooltip('chat');
  };

  // ---------------------------------------------------------------------------
  // Event handlers — registered branch
  // ---------------------------------------------------------------------------

  const triggerGlitch = () => {
    setIsGlitching(true);
    setTimeout(() => setIsGlitching(false), 300);
  };

  // Desktop click: close tooltip first, then glitch + navigate
  const handleChatClick = () => {
    toggleTooltip(null);
    triggerGlitch();
    navigate(`/forum/post/${LIVE_CHAT_POST_ID}`);
  };

  // Mobile: single tap goes straight to live chat (no preview step).
  // Taps on the unread badge are left alone so its synthesized click can
  // still run mark-all-read (its click handler stops propagation).
  const handleChatTouchEnd = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest?.('[data-lcb-badge]')) return;
    e.preventDefault(); // prevent synthesised click from also firing
    toggleTooltip(null);
    triggerGlitch();
    navigate(`/forum/post/${LIVE_CHAT_POST_ID}`);
  };

  // ---------------------------------------------------------------------------
  // Badge hover handlers (existing — unchanged)
  // ---------------------------------------------------------------------------
  const handleMarkAllReadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    markAllReadMutation.mutate(undefined);
  };

  const handleBadgeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      markAllReadMutation.mutate(undefined);
    }
  };

  const handleMouseEnter = () => {
    const isMobile = window.innerWidth <= 768;
    if (!isMobile && unreadCount > 0) {
      setIsHovered(true);
      setShowMarkReadX(true);
    }
  };

  const handleMouseLeave = () => {
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) {
      setIsHovered(false);
      setShowMarkReadX(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Shared visual content (badge lives here — unchanged from original)
  // ---------------------------------------------------------------------------
  const chatContent = (
    <div className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 hover:bg-gray-100/20 rounded-full transition-colors">
      {/* Custom chat icon with animated typing dots */}
      <div className="relative w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8">
        {/* Chat bubble outline with glitch effect on click */}
        <svg
          className={`w-full h-full fill-transparent ${isGlitching ? 'animate-chat-glitch' : ''}`}
          style={{ stroke: '#00cc00', strokeWidth: '1.5' }}
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>

        {/* Animated typing dots - positioned slightly above center */}
        <div
          className="absolute flex items-center justify-center space-x-0.5"
          style={{ top: '43%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}
        >
          <div className="w-0.5 h-0.5 rounded-full animate-typing-pulse-1" style={{ backgroundColor: '#00cc00' }}></div>
          <div className="w-0.5 h-0.5 rounded-full animate-typing-pulse-2" style={{ backgroundColor: '#00cc00' }}></div>
          <div className="w-0.5 h-0.5 rounded-full animate-typing-pulse-3" style={{ backgroundColor: '#00cc00' }}></div>
        </div>
      </div>

      {/* Badge indicator for unread comments — unchanged */}
      {unreadCount > 0 && !isDisabled && (
        <div
          className="absolute -top-1 -right-1 z-20"
          data-lcb-badge
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleBadgeClick}
        >
          {showMarkReadX ? (
            <button
              onClick={handleMarkAllReadClick}
              className="bg-red-500 hover:bg-red-600 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 transition-colors"
              aria-label="Mark all live chat comments as read"
            >
              <X className="w-3 h-3" />
            </button>
          ) : (
            <div className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Unregistered / no-permission branch — unchanged
  if (isDisabled) {
    return (
      <TooltipProvider>
        <Tooltip
          open={activeTooltip === 'chat'}
          onOpenChange={(open) => open ? toggleTooltip('chat') : toggleTooltip(null)}
          delayDuration={0}
        >
          <TooltipTrigger asChild>
            <button
              className="opacity-40 cursor-not-allowed touch-manipulation"
              onClick={handleDisabledClick}
              onTouchEnd={handleDisabledClick}
              disabled
              aria-label="Live Chat - Registration Required"
            >
              {chatContent}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <div className="p-3 text-center">
              <p className="font-bold text-lg mb-2">💬 Live Chat</p>
              <p className="text-red-500 font-semibold mb-2">For Registered Users Only</p>
              <p className="text-sm text-gray-600 mb-2">
                Join community discussions in real-time
              </p>
              <a
                href="/auth?tab=register"
                className="text-xs text-blue-600 font-medium hover:underline cursor-pointer"
              >
                Sign up today to unlock this feature!
              </a>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Registered branch — hover preview popup
  return (
    <TooltipProvider>
      <Tooltip
        open={activeTooltip === 'chat'}
        onOpenChange={(open) => open ? toggleTooltip('chat') : toggleTooltip(null)}
        delayDuration={0}
      >
        <TooltipTrigger asChild>
          <button
            className="cursor-pointer touch-manipulation"
            onClick={handleChatClick}
            onTouchEnd={handleChatTouchEnd}
            aria-label="Open Live Chat"
          >
            {chatContent}
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          sideOffset={8}
          className="p-0 border-0 bg-transparent shadow-none"
        >
          <LiveChatPreviewContent
            comments={previewComments}
            isLoading={showPreviewLoading}
            isError={isPreviewError}
            onOpenChat={handleChatClick}
          />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
