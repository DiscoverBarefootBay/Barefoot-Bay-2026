import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type FeatureFlag = {
  id: number;
  name: string;
  isActive: boolean;
};

/**
 * Global on/off switch for the entire Featured Listings feature on
 * On The Market. When OFF: no gold outlines or ★ Featured badges anywhere
 * on the site or in the weekly email, and the Upgrade to Featured option is
 * hidden (and rejected server-side) for both residents and admins.
 */
export default function FeaturedListingsToggle() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: flags, isLoading } = useQuery<FeatureFlag[]>({
    queryKey: ["/api/feature-flags"],
  });
  const flag = Array.isArray(flags)
    ? flags.find((f) => f.name === "featured_listings")
    : undefined;

  const toggleMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      if (!flag) throw new Error("Featured listings flag not found");
      const res = await apiRequest("PATCH", `/api/feature-flags/${flag.id}`, { isActive });
      return res.json();
    },
    onSuccess: (_data, isActive) => {
      queryClient.invalidateQueries({ queryKey: ["/api/feature-flags"] });
      toast({
        title: isActive ? "Featured listings turned on" : "Featured listings turned off",
        description: isActive
          ? "Gold highlights, ★ Featured badges, and the upgrade option are visible again on the site and in the weekly email."
          : "Featured upgrades are hidden for everyone, and no gold highlights or ★ Featured badges will show on the site or in the weekly email.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Couldn't update the setting",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div className="flex items-start gap-3">
          <Star className="h-5 w-5 mt-0.5 text-yellow-500 shrink-0" />
          <div>
            <p className="font-medium">Featured listings</p>
            <p className="text-sm text-muted-foreground">
              Master switch for the Featured upgrade on On The Market. Turning it off hides the
              upgrade option for residents and admins, and removes gold outlines and ★ Featured
              badges everywhere — on the site and in the weekly email.
            </p>
          </div>
        </div>
        <Switch
          checked={flag ? flag.isActive : true}
          disabled={isLoading || !flag || toggleMutation.isPending}
          onCheckedChange={(checked) => toggleMutation.mutate(checked)}
          aria-label="Toggle featured listings"
        />
      </CardContent>
    </Card>
  );
}
