import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CalendarDays, Clock, MapPin } from "lucide-react";

export function EventDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex gap-3">
          <div className="h-10 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse rounded-md" />
          <div className="h-10 w-24 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse rounded-md" />
          <div className="h-10 w-28 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse rounded-md" />
        </div>
      </div>

      <Card className="bg-white shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center animate-pulse">
                <CalendarDays className="h-8 w-8 text-blue-500" />
              </div>
              <div className="absolute inset-0 bg-blue-400 rounded-xl animate-ping opacity-20" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-8 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-md w-3/4 animate-pulse" />
              <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-md w-48 animate-pulse" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Clock className="h-5 w-5 text-blue-400 animate-pulse" />
            </div>
            <div className="h-5 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-md w-40 animate-pulse" />
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <MapPin className="h-5 w-5 text-blue-400 animate-pulse" />
            </div>
            <div className="h-5 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-md w-64 animate-pulse" />
          </div>

          <div className="space-y-3 pt-4">
            <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-md w-full animate-pulse" />
            <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-md w-5/6 animate-pulse" />
            <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-md w-4/6 animate-pulse" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-white shadow-md">
          <CardHeader>
            <div className="h-6 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-md w-32 animate-pulse" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-md w-full animate-pulse" />
            <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-md w-3/4 animate-pulse" />
            <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-md w-5/6 animate-pulse" />
          </CardContent>
        </Card>

        <Card className="bg-white shadow-md">
          <CardHeader>
            <div className="h-6 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-md w-24 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="h-48 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 rounded-lg animate-pulse" />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="h-14 bg-gradient-to-r from-blue-100 via-blue-50 to-blue-100 rounded-md w-32 animate-pulse" />
        <div className="h-14 bg-gradient-to-r from-blue-100 via-blue-50 to-blue-100 rounded-md w-40 animate-pulse" />
        <div className="h-14 bg-gradient-to-r from-blue-100 via-blue-50 to-blue-100 rounded-md w-36 animate-pulse" />
      </div>

      <Card className="bg-white shadow-md">
        <CardHeader>
          <div className="h-6 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-md w-32 animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="h-24 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-md w-full animate-pulse" />
            <div className="h-10 bg-gradient-to-r from-blue-100 via-blue-50 to-blue-100 rounded-md w-32 animate-pulse" />
          </div>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="h-12 w-12 bg-gradient-to-br from-gray-300 via-gray-200 to-gray-300 rounded-full animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-md w-32 animate-pulse" />
                  <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-md w-full animate-pulse" />
                  <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-md w-3/4 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
