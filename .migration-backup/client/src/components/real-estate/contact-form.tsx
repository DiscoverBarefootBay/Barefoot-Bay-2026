import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { AlertCircle, CheckCircle, Send, Loader2 } from "lucide-react";
import type { RealEstateListing } from "@shared/schema";

interface ContactFormProps {
  listing: RealEstateListing;
}

export function ContactForm({ listing }: ContactFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  
  const contactMutation = useMutation({
    mutationFn: async () => {
      if (!message.trim()) {
        throw new Error("Please enter a message");
      }
      
      if (message.trim().length < 10) {
        throw new Error("Your message is too short. Please provide more details.");
      }
      
      const response = await apiRequest("POST", `/api/listings/${listing.id}/contact`, { message });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send message");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Message Sent",
        description: "Your message has been sent to the listing owner. If they don't respond, ask them to check their spam folder.",
      });
      setMessage("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Get contact info from listing
  const contactInfo = listing.contactInfo as { name?: string; email?: string; phone?: string };
  
  // Don't show the form if there's no email in the contact info
  if (!contactInfo?.email) {
    return null;
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact the Owner</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Send a message to {contactInfo.name || "the owner"} about this listing. 
            Your contact information will be included automatically.
          </div>
          
          <Textarea
            placeholder="Type your message here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[120px]"
            disabled={contactMutation.isPending}
          />
          
          {message.trim().length > 0 && message.trim().length < 10 && (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertCircle className="h-4 w-4" />
              <span>Please write at least 10 characters</span>
            </div>
          )}
          
          {contactMutation.isSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>Message sent successfully!</span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="text-sm text-muted-foreground">
          As: {user?.fullName || user?.username}
        </div>
        <Button 
          onClick={() => contactMutation.mutate()}
          disabled={contactMutation.isPending || message.trim().length < 10}
        >
          {contactMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send Message
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}