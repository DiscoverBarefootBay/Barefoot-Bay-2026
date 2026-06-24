import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { type InteractionWithUser } from "@shared/schema";
import { UserAvatar } from "@/components/shared/user-avatar";

interface UserAvatarCarouselProps {
  interactions: InteractionWithUser[];
}

export function UserAvatarCarousel({ interactions }: UserAvatarCarouselProps) {
  // Remove duplicate users and sort by interaction type
  const uniqueUsers = Array.from(
    new Map(
      interactions.map(interaction => [interaction.userId, interaction])
    ).values()
  );

  if (uniqueUsers.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <ScrollArea className="w-full whitespace-nowrap rounded-md">
        <div className="flex space-x-4 p-4">
          {uniqueUsers.map((interaction) => (
            <div
              key={interaction.userId}
              className="flex-none"
              title={`${interaction.user?.username || 'Anonymous'} - ${interaction.interactionType}`}
            >
              <div className="border-2 border-background rounded-full">
                <UserAvatar 
                  user={interaction.user || {
                    username: 'Anonymous',
                    avatarUrl: null,
                    isResident: false
                  }}
                  size="lg"
                  showBadge={true}
                />
              </div>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}