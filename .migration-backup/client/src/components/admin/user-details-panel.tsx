import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface UserDetailsPanelProps {
  userId: number;
  isExpanded: boolean;
  onToggle: () => void;
}

interface UserDetails {
  createdAt: string | null;
  updatedAt: string | null;
  lastActivity: string | null;
  phoneNumber: string | null;
  membershipBadgeNumber: string | null;
  squareCustomerId: string | null;
  subscriptionId: string | null;
  subscriptionType: string | null;
  subscriptionStatus: string | null;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  isLocalResident: boolean | null;
  ownsHomeInBB: boolean | null;
  rentsHomeInBB: boolean | null;
  isFullTimeResident: boolean | null;
  isSnowbird: boolean | null;
  hasMembershipBadge: boolean | null;
  buysDayPasses: boolean | null;
  hasLivedInBB: boolean | null;
  hasVisitedBB: boolean | null;
  hasFriendsInBB: boolean | null;
  consideringMovingToBB: boolean | null;
  contentStats: {
    forumPosts: number;
    forumComments: number;
    listings: number;
    events: number;
  };
  activityStats: {
    totalSessions: number;
    totalPageViews: number;
  };
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString();
}

const InfoRow = memo(({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4 py-1 text-sm border-b border-gray-100 last:border-0">
    <span className="text-gray-500 shrink-0">{label}</span>
    <span className="text-gray-900 font-medium text-right truncate min-w-0">{value}</span>
  </div>
));

InfoRow.displayName = "InfoRow";

const DetailsContent = memo(({ details }: { details: UserDetails }) => {
  const profileBadges = [];
  if (details.isLocalResident) profileBadges.push("Local Resident");
  if (details.ownsHomeInBB) profileBadges.push("Homeowner");
  if (details.rentsHomeInBB) profileBadges.push("Renter");
  if (details.isFullTimeResident) profileBadges.push("Full-Time");
  if (details.isSnowbird) profileBadges.push("Snowbird");
  if (details.hasMembershipBadge) profileBadges.push("Badge Holder");
  if (details.buysDayPasses) profileBadges.push("Day Pass");
  if (details.hasVisitedBB) profileBadges.push("Visitor");
  if (details.hasFriendsInBB) profileBadges.push("Has Friends");
  if (details.consideringMovingToBB) profileBadges.push("Considering Move");

  return (
    <div className="bg-gray-50 rounded-lg p-4 mt-3 space-y-4">
      {/* Account & Activity Section */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Account & Activity</h4>
        <div className="bg-white rounded p-3">
          <InfoRow label="Created" value={formatRelativeTime(details.createdAt)} />
          <InfoRow label="Last Updated" value={formatRelativeTime(details.updatedAt)} />
          <InfoRow label="Last Active" value={formatRelativeTime(details.lastActivity)} />
          {details.phoneNumber && <InfoRow label="Phone" value={details.phoneNumber} />}
        </div>
      </div>

      {/* Content Stats Section */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Content Stats</h4>
        <div className="bg-white rounded p-3 flex flex-wrap gap-3">
          <div className="text-center min-w-[60px]">
            <div className="text-lg font-bold text-gray-900">{details.contentStats.forumPosts}</div>
            <div className="text-xs text-gray-500">Posts</div>
          </div>
          <div className="text-center min-w-[60px]">
            <div className="text-lg font-bold text-gray-900">{details.contentStats.forumComments}</div>
            <div className="text-xs text-gray-500">Comments</div>
          </div>
          <div className="text-center min-w-[60px]">
            <div className="text-lg font-bold text-gray-900">{details.contentStats.listings}</div>
            <div className="text-xs text-gray-500">Listings</div>
          </div>
          <div className="text-center min-w-[60px]">
            <div className="text-lg font-bold text-gray-900">{details.contentStats.events}</div>
            <div className="text-xs text-gray-500">Events</div>
          </div>
          <div className="text-center min-w-[60px]">
            <div className="text-lg font-bold text-gray-900">{details.activityStats.totalSessions}</div>
            <div className="text-xs text-gray-500">Sessions</div>
          </div>
          <div className="text-center min-w-[60px]">
            <div className="text-lg font-bold text-gray-900">{details.activityStats.totalPageViews}</div>
            <div className="text-xs text-gray-500">Views</div>
          </div>
        </div>
      </div>

      {/* Subscription Section */}
      {(details.subscriptionType || details.membershipBadgeNumber) && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Subscription</h4>
          <div className="bg-white rounded p-3">
            {details.membershipBadgeNumber && (
              <InfoRow label="Badge #" value={<span className="font-mono">{details.membershipBadgeNumber}</span>} />
            )}
            {details.subscriptionType && (
              <InfoRow label="Plan" value={<span className="capitalize">{details.subscriptionType}</span>} />
            )}
            {details.subscriptionStatus && (
              <InfoRow 
                label="Status" 
                value={
                  <Badge 
                    variant="outline"
                    className={details.subscriptionStatus === "active" ? "bg-green-50 text-green-700 border-green-200" : ""}
                  >
                    {details.subscriptionStatus}
                  </Badge>
                } 
              />
            )}
            {details.subscriptionEndDate && (
              <InfoRow label="Expires" value={new Date(details.subscriptionEndDate).toLocaleDateString()} />
            )}
          </div>
        </div>
      )}

      {/* Community Profile Section */}
      {profileBadges.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Community Profile</h4>
          <div className="flex flex-wrap gap-1.5">
            {profileBadges.map((badge) => (
              <Badge key={badge} variant="secondary" className="text-xs">
                {badge}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

DetailsContent.displayName = "DetailsContent";

export const UserDetailsPanel = memo(function UserDetailsPanel({ 
  userId, 
  isExpanded, 
  onToggle 
}: UserDetailsPanelProps) {
  const { data, isLoading, error } = useQuery<{ success: boolean; details: UserDetails }>({
    queryKey: [`/api/users/${userId}/details`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/users/${userId}/details`);
      if (!response.ok) {
        throw new Error("Failed to fetch user details");
      }
      return response.json();
    },
    enabled: isExpanded,
    staleTime: 60000,
    gcTime: 300000,
  });

  return (
    <div className="w-full">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className="text-xs text-gray-500 hover:text-gray-700 w-full justify-center mt-2"
      >
        {isExpanded ? <ChevronUp size={14} className="mr-1" /> : <ChevronDown size={14} className="mr-1" />}
        {isExpanded ? "Hide details" : "View details"}
      </Button>
      
      {isExpanded && (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading...</span>
            </div>
          ) : error ? (
            <div className="text-center py-4 text-sm text-red-500">Failed to load user details</div>
          ) : data?.details ? (
            <DetailsContent details={data.details} />
          ) : null}
        </>
      )}
    </div>
  );
});
