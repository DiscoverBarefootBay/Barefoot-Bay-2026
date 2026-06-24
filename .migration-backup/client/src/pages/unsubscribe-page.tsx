import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Mail, MailCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

export default function UnsubscribePage() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);
  const [isUnsubscribed, setIsUnsubscribed] = useState(false);

  const handleUnsubscribe = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to manage your email preferences.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    setIsUnsubscribing(true);
    try {
      const response = await apiRequest("POST", "/api/user/unsubscribe-emails", {
        userId: user.id,
      });

      const data = await response.json();

      if (data.success) {
        setIsUnsubscribed(true);
        toast({
          title: "Unsubscribed Successfully",
          description: "You will no longer receive any email notifications from Barefoot Bay.",
        });
      } else {
        throw new Error(data.message || "Failed to unsubscribe");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to unsubscribe. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUnsubscribing(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto my-12 px-4">
        <Card className="border-navy/10">
          <CardHeader>
            <CardTitle className="text-2xl text-navy">Email Preferences</CardTitle>
            <CardDescription>Please sign in to manage your email notification preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/auth")} className="bg-ocean hover:bg-ocean/90 text-white">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto my-12 px-4">
      <Card className="border-navy/10">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            {isUnsubscribed ? (
              <MailCheck className="h-8 w-8 text-ocean" />
            ) : (
              <Mail className="h-8 w-8 text-navy" />
            )}
            <CardTitle className="text-2xl text-navy">Email Notification Preferences</CardTitle>
          </div>
          <CardDescription>
            Manage your email notification settings for forum posts, calendar events, and all community updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isUnsubscribed ? (
            <div className="bg-ocean/10 border border-ocean/20 rounded-lg p-6 text-center">
              <MailCheck className="h-12 w-12 text-ocean mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-navy mb-2">You're Unsubscribed</h3>
              <p className="text-gray-600 mb-4">
                You will no longer receive any email notifications from Barefoot Bay.
              </p>
              <p className="text-sm text-gray-500">
                You can update your preferences anytime from your account settings.
              </p>
              <Button
                onClick={() => navigate("/")}
                variant="outline"
                className="mt-4 border-navy/20 hover:bg-navy/5"
              >
                Return to Home
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-navy mb-2">About Email Notifications</h3>
                <p className="text-sm text-gray-600">
                  You currently receive email notifications for new forum posts created by administrators,
                  upcoming calendar events, and other community updates sent by administrators.
                </p>
              </div>

              <div className="pt-4">
                <h3 className="font-semibold text-navy mb-3">Unsubscribe from Email Notifications</h3>
                <p className="text-sm text-gray-600 mb-4">
                  If you no longer wish to receive these emails, you can unsubscribe below. You can always
                  re-enable notifications later from your account settings.
                </p>
                <Button
                  onClick={handleUnsubscribe}
                  disabled={isUnsubscribing}
                  variant="destructive"
                  className="w-full sm:w-auto"
                  data-testid="button-unsubscribe"
                >
                  {isUnsubscribing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Unsubscribing...
                    </>
                  ) : (
                    "Unsubscribe from Email Notifications"
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
