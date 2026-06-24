import { Home, Armchair, Tag, Sofa } from "lucide-react";

export function ForSaleLoadingAnimation() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="relative w-64 h-32 mb-8">
        <div className="absolute inset-0 flex items-center justify-center gap-4">
          <div className="animate-bounce" style={{ animationDelay: "0ms", animationDuration: "1.5s" }}>
            <Home className="w-12 h-12 text-primary opacity-70" />
          </div>
          <div className="animate-bounce" style={{ animationDelay: "200ms", animationDuration: "1.5s" }}>
            <Armchair className="w-10 h-10 text-primary opacity-60" />
          </div>
          <div className="animate-bounce" style={{ animationDelay: "400ms", animationDuration: "1.5s" }}>
            <Tag className="w-8 h-8 text-primary opacity-70" />
          </div>
          <div className="animate-bounce" style={{ animationDelay: "600ms", animationDuration: "1.5s" }}>
            <Sofa className="w-10 h-10 text-primary opacity-60" />
          </div>
        </div>
        
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0ms" }}></div>
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: "200ms" }}></div>
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: "400ms" }}></div>
        </div>
      </div>
      
      <div className="mt-8 flex items-center gap-2">
        <div className="h-1 w-16 bg-primary/20 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full animate-loading-bar"></div>
        </div>
      </div>
      
      <style>{`
        @keyframes loading-bar {
          0% {
            width: 0%;
            margin-left: 0%;
          }
          50% {
            width: 75%;
            margin-left: 0%;
          }
          100% {
            width: 0%;
            margin-left: 100%;
          }
        }
        
        .animate-loading-bar {
          animation: loading-bar 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
