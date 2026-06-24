import { Mail, Inbox, Send } from "lucide-react";

export function EmailActivitySkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex justify-center items-center gap-8 py-12">
        <div className="relative">
          <Mail className="h-16 w-16 text-blue-400 animate-pulse" />
          <div className="absolute -top-1 -right-1 h-3 w-3 bg-blue-500 rounded-full animate-ping" />
        </div>
        
        <div className="flex flex-col gap-3">
          <Send className="h-12 w-12 text-purple-400 animate-bounce" style={{ animationDelay: '0.1s' }} />
          <Inbox className="h-12 w-12 text-green-400 animate-bounce" style={{ animationDelay: '0.2s' }} />
        </div>
        
        <div className="relative">
          <Mail className="h-16 w-16 text-orange-400 animate-pulse" style={{ animationDelay: '0.3s' }} />
          <div className="absolute -bottom-1 -left-1 h-3 w-3 bg-orange-500 rounded-full animate-ping" style={{ animationDelay: '0.3s' }} />
        </div>
      </div>

      <div className="space-y-4 max-w-2xl mx-auto">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="flex-shrink-0">
              <div className="h-10 w-10 bg-gradient-to-br from-blue-200 to-blue-300 rounded-lg" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-3/4" />
              <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-1/2" />
            </div>
            <div className="flex-shrink-0">
              <div className="h-6 w-16 bg-gradient-to-r from-blue-200 to-blue-300 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      <div className="text-center">
        <div className="inline-flex items-center gap-2 text-muted-foreground">
          <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" />
          <div className="h-2 w-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
          <div className="h-2 w-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground animate-pulse">Loading email activity...</p>
      </div>
    </div>
  );
}

export function EmailTableSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4 border rounded-lg animate-pulse" style={{ animationDelay: `${i * 0.05}s` }}>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gradient-to-r from-blue-200 to-blue-300 rounded w-2/3" />
            <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-1/2" />
          </div>
          <div className="flex gap-2">
            <div className="h-6 w-12 bg-gradient-to-r from-green-200 to-green-300 rounded" />
            <div className="h-6 w-12 bg-gradient-to-r from-purple-200 to-purple-300 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
