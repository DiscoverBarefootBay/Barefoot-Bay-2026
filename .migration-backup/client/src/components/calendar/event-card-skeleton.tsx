import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function EventCardSkeleton() {
  return (
    <Card className="border-2 flex flex-col h-full bg-white animate-pulse">
      <CardHeader className="pb-4">
        <div className="flex flex-col space-y-2">
          {/* Category badge skeleton */}
          <div className="h-6 w-48 bg-gray-200 rounded-md self-start"></div>
          {/* Title skeleton */}
          <div className="space-y-2">
            <div className="h-7 bg-gray-200 rounded w-3/4"></div>
            <div className="h-7 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 flex-grow flex flex-col">
        {/* Image skeleton */}
        <div className="aspect-video overflow-hidden rounded-lg bg-gray-200"></div>

        {/* Description skeleton */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>

        {/* Date, time, location skeletons */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 bg-gray-200 rounded"></div>
            <div className="h-4 w-40 bg-gray-200 rounded"></div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-5 w-5 bg-gray-200 rounded"></div>
            <div className="h-4 w-32 bg-gray-200 rounded"></div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-5 w-5 bg-gray-200 rounded"></div>
            <div className="h-4 w-48 bg-gray-200 rounded"></div>
          </div>
        </div>

        {/* Button skeleton */}
        <div className="mt-auto pt-4">
          <div className="h-14 bg-gray-200 rounded w-full"></div>
        </div>
      </CardContent>
    </Card>
  );
}

// Component to show multiple skeleton cards
export function EventCardSkeletonGroup({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <EventCardSkeleton key={index} />
      ))}
    </>
  );
}
