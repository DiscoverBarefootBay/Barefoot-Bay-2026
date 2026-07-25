import { Loader2, MessageSquare, Users } from "lucide-react";

interface ForumLoadingProps {
  type?: 'forums' | 'topics';
  className?: string;
}

export function ForumLoading({ type = 'forums', className = '' }: ForumLoadingProps) {
  const isTopics = type === 'topics';
  
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      {/* Animated icon container */}
      <div className="relative mb-6">
        {/* Background pulse */}
        <div className="absolute inset-0 bg-coral/10 rounded-full animate-ping"></div>
        
        {/* Main icon */}
        <div className="relative bg-white border-2 border-coral/20 rounded-full p-4 shadow-sm">
          {isTopics ? (
            <MessageSquare className="h-8 w-8 text-coral animate-pulse" />
          ) : (
            <Users className="h-8 w-8 text-coral animate-pulse" />
          )}
        </div>
        
        {/* Spinning loader overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-12 w-12 text-coral/30 animate-spin" />
        </div>
      </div>
      
      {/* Loading text with typewriter effect */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-navy mb-2 animate-pulse">
          {isTopics ? 'Loading Stories...' : 'Loading Extra!!!...'}
        </h2>
        <p className="text-navy/60 animate-pulse delay-100">
          {isTopics ? 'Getting the latest stories' : 'Preparing the latest community news'}
        </p>
      </div>
      
      {/* Animated dots */}
      <div className="flex space-x-1 mt-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 bg-coral/40 rounded-full animate-bounce"
            style={{
              animationDelay: `${i * 0.2}s`,
              animationDuration: '1s'
            }}
          />
        ))}
      </div>
    </div>
  );
}