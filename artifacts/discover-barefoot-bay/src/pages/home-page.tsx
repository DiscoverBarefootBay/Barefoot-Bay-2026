import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CommunityShowcase } from "@/components/home/community-showcase";
import { PlatinumSponsorsSection } from "@/components/home/platinum-sponsors-section";
import { UnifiedSearch } from "@/components/home/unified-search";
import { useQuery } from "@tanstack/react-query";
import { EventCard } from "@/components/calendar/event-card";
import { EventCardSkeletonGroup } from "@/components/calendar/event-card-skeleton";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useHomepageClock } from "@/hooks/use-homepage-clock";
import { homepageEventsOptions, selectHomepageEvents } from "@/lib/homepage-events";

export default function HomePage() {
  const { user } = useAuth();
  const today = useHomepageClock();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const eventsQuery = useQuery(homepageEventsOptions(user?.id, today));
  const sortedTodaysEvents = selectHomepageEvents(eventsQuery.data ?? [], selectedCategory, today);

  return (
    <div className="space-y-6">
      <section className="text-center pt-12 pb-8 space-y-3">
        <div className="overflow-visible">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight drop-shadow-md animate-slide-up leading-tight py-2">
            Welcome to Barefoot Bay
          </h1>
          <p className="hidden md:block text-3xl max-w-4xl mx-auto leading-relaxed drop-shadow animate-slide-up-delayed text-gray-700 transition-colors duration-500 hover:text-navy">
            Your Community Hub for Events, Club Activities, News, General Discussion, and more
          </p>
        </div>

        <div className="mt-8">
          <UnifiedSearch />
        </div>
      </section>

      <section>
        <CommunityShowcase />
      </section>

      <section className="max-w-6xl mx-auto px-8" data-testid="section-home-events">
        <div className="space-y-6">
          {/* Mobile: Stacked layout - Title first, then filter */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h2 className="text-xl md:text-2xl font-semibold flex items-center gap-2 md:gap-3 order-first">
              <CalendarIcon className="h-5 w-5 md:h-6 md:w-6 hidden md:inline" />
              <span className="hidden md:inline">Events for {format(today, "MMMM d, yyyy")}</span>
              <span className="md:hidden">Events for {format(today, "MMM d, yyyy")}</span>
            </h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-2 md:mt-0">
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="w-full sm:w-[220px] h-12 text-xl">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-bold text-xl py-3 text-[#111827] bg-[#FDFEFE] border border-[#E7EAEE] rounded-md data-[highlighted]:bg-[#F29A8A] data-[highlighted]:border-[#EA7F6D] data-[state=checked]:bg-[#F29A8A] data-[state=checked]:border-[#EA7F6D]">All Categories</SelectItem>
                  <SelectItem value="entertainment" className="font-bold text-[#111827] bg-[#7FD7C6] border border-[#5FC4B1] text-xl py-3 my-1 rounded-md data-[highlighted]:bg-[#F29A8A] data-[highlighted]:border-[#EA7F6D] data-[state=checked]:bg-[#F29A8A] data-[state=checked]:border-[#EA7F6D]">
                    Entertainment & Activities
                  </SelectItem>
                  <SelectItem value="government" className="font-bold text-[#111827] bg-[#6FA8DC] border border-[#4F93D3] text-xl py-3 my-1 rounded-md data-[highlighted]:bg-[#F29A8A] data-[highlighted]:border-[#EA7F6D] data-[state=checked]:bg-[#F29A8A] data-[state=checked]:border-[#EA7F6D]">
                    Government & Politics
                  </SelectItem>
                  <SelectItem value="social" className="font-bold text-[#111827] bg-[#F6D8A8] border border-[#EBC28B] text-xl py-3 my-1 rounded-md data-[highlighted]:bg-[#F29A8A] data-[highlighted]:border-[#EA7F6D] data-[state=checked]:bg-[#F29A8A] data-[state=checked]:border-[#EA7F6D]">
                    Social Clubs
                  </SelectItem>
                  <SelectItem value="promotional" className="font-bold text-[#111827] bg-[#FFF3CD] border border-[#F1E1BA] text-xl py-3 my-1 rounded-md data-[highlighted]:bg-[#F29A8A] data-[highlighted]:border-[#EA7F6D] data-[state=checked]:bg-[#F29A8A] data-[state=checked]:border-[#EA7F6D]">
                    Promotional
                  </SelectItem>
                  <SelectItem value="bulletin" className="font-bold text-[#111827] bg-[#C9C3E6] border border-[#B3AADF] text-xl py-3 my-1 rounded-md data-[highlighted]:bg-[#F29A8A] data-[highlighted]:border-[#EA7F6D] data-[state=checked]:bg-[#F29A8A] data-[state=checked]:border-[#EA7F6D]">
                    Bulletin
                  </SelectItem>
                  <SelectItem value="platinum_sponsor" className="font-bold text-[#111827] bg-gradient-to-r from-[#E5E7EB] to-[#9CA3AF] border border-[#9CA3AF] text-xl py-3 my-1 rounded-md data-[highlighted]:bg-[#F29A8A] data-[highlighted]:border-[#EA7F6D] data-[state=checked]:bg-[#F29A8A] data-[state=checked]:border-[#EA7F6D]">
                    Platinum Sponsors
                  </SelectItem>
                </SelectContent>
              </Select>
              <Link href="/calendar" className="w-full sm:w-auto">
                <Button variant="outline" className="h-12 text-xl px-6 w-full sm:w-auto">View All Events</Button>
              </Link>
            </div>
          </div>

          <PlatinumSponsorsSection fullWidth buttonLayout="horizontal" />

          {eventsQuery.isError ? (
            <div role="alert" className="p-4 space-y-2 border rounded-md" data-testid="status-home-events-error">
              <p>Unable to load today’s events. Please try again.</p>
              <Button variant="outline" onClick={() => eventsQuery.refetch()} disabled={eventsQuery.isFetching} data-testid="button-retry-home-events">
                {eventsQuery.isFetching ? "Retrying…" : "Retry"}
              </Button>
            </div>
          ) : eventsQuery.isLoading ? (
            <div role="status" className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="status-home-events-loading">
              <span className="sr-only">Loading today’s events…</span>
              <EventCardSkeletonGroup count={2} />
            </div>
          ) : sortedTodaysEvents.length === 0 ? (
            <p role="status" className="p-4 text-muted-foreground" data-testid="status-home-events-empty">
              {selectedCategory === "all" ? "No events scheduled for today." : "No events in this category today."}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sortedTodaysEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Feature boxes removed as requested */}

      {!user && (
        <div className="text-center mt-20 mb-16">
          <p className="text-2xl mb-8 text-navy font-semibold">Join our community to access all features</p>
          <Link href="/auth">
            <Button size="lg" className="px-12 py-8 text-xl text-white">Sign Up Now</Button>
          </Link>
        </div>
      )}
    </div>
  );
}