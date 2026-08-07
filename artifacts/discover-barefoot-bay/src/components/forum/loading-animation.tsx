import { Newspaper, Megaphone, MessageSquare, Coffee } from "lucide-react";

/**
 * Forum-personalized loading micro-animation, in the same spirit as the
 * On The Market ForSaleLoadingAnimation: staggered bouncing community-news
 * icons, pulsing "typing" dots, and a sweeping progress bar.
 * Honors prefers-reduced-motion (static icons + steady bar).
 */
export function ForumLoadingAnimation({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-4 ${compact ? "py-10" : "py-16 min-h-[40vh]"}`}
      role="status"
      aria-label="Loading the latest community stories"
    >
      <div className="relative w-64 h-28 mb-6">
        <div className="absolute inset-0 flex items-center justify-center gap-4">
          <div className="animate-bounce motion-reduce:animate-none" style={{ animationDelay: "0ms", animationDuration: "1.5s" }}>
            <Newspaper className="w-12 h-12 text-primary opacity-70" />
          </div>
          <div className="animate-bounce motion-reduce:animate-none" style={{ animationDelay: "200ms", animationDuration: "1.5s" }}>
            <Megaphone className="w-10 h-10 text-primary opacity-60" />
          </div>
          <div className="animate-bounce motion-reduce:animate-none" style={{ animationDelay: "400ms", animationDuration: "1.5s" }}>
            <MessageSquare className="w-9 h-9 text-primary opacity-70" />
          </div>
          <div className="animate-bounce motion-reduce:animate-none" style={{ animationDelay: "600ms", animationDuration: "1.5s" }}>
            <Coffee className="w-10 h-10 text-primary opacity-60" />
          </div>
        </div>

        {/* "someone's typing" dots */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse motion-reduce:animate-none" style={{ animationDelay: "0ms" }}></div>
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse motion-reduce:animate-none" style={{ animationDelay: "200ms" }}></div>
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse motion-reduce:animate-none" style={{ animationDelay: "400ms" }}></div>
        </div>
      </div>

      <p className="text-navy/70 font-medium mb-4">Hot off the press...</p>

      <div className="flex items-center gap-2">
        <div className="h-1 w-24 bg-primary/20 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full animate-forum-loading-bar motion-reduce:animate-none motion-reduce:w-full"></div>
        </div>
      </div>

      <style>{`
        @keyframes forum-loading-bar {
          0% { width: 0%; margin-left: 0%; }
          50% { width: 75%; margin-left: 0%; }
          100% { width: 0%; margin-left: 100%; }
        }
        .animate-forum-loading-bar {
          animation: forum-loading-bar 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
