import React, { useState } from 'react';
import { Button } from '../ui/button';
import { useToast } from '../ui/use-toast';
import { apiRequest } from '../../lib/api';

interface ManualCreditButtonProps {
  onCreditsAwarded?: (credits: number) => void;
  className?: string;
}

export function ManualCreditButton({ onCreditsAwarded, className }: ManualCreditButtonProps) {
  const [isAwarding, setIsAwarding] = useState(false);
  const { toast } = useToast();

  const handleAwardCredits = async () => {
    setIsAwarding(true);
    
    try {
      const response = await apiRequest('POST', '/api/credits/manual-award', {
        credits: 10
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast({
            title: "Credits Awarded",
            description: `${data.credits} credits have been added to your account.`,
          });
          
          if (onCreditsAwarded) {
            onCreditsAwarded(data.credits);
          }
        } else {
          throw new Error(data.message || 'Failed to award credits');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to award credits');
      }
    } catch (error) {
      console.error('Error awarding credits:', error);
      toast({
        title: "Error",
        description: "Failed to award credits. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAwarding(false);
    }
  };

  return (
    <Button 
      onClick={handleAwardCredits} 
      disabled={isAwarding}
      className={className}
      variant="outline"
    >
      {isAwarding ? "Awarding..." : "Add 10 Credits (Test)"}
    </Button>
  );
}