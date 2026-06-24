import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useToast } from '../ui/use-toast';
import { apiRequest } from '../../lib/api';
import { VerifyPaymentButton } from './verify-payment-button';
import { ManualCreditButton } from './manual-credit-button';

interface CreditTransaction {
  id: number;
  transactionType: 'purchase' | 'use' | 'refund';
  credits: number;
  description: string;
  createdAt: string;
  paymentStatus: string;
}

interface UserCreditsDisplayProps {
  className?: string;
  showHistory?: boolean;
}

export function UserCreditsDisplay({ className, showHistory = false }: UserCreditsDisplayProps) {
  const [credits, setCredits] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<CreditTransaction[]>([]);
  const [showHistoryState, setShowHistoryState] = useState(showHistory);
  const { toast } = useToast();

  const fetchCredits = async () => {
    try {
      const response = await apiRequest("GET", "/api/credits/balance");
      if (response.ok) {
        const data = await response.json();
        setCredits(data.credits);
      }
    } catch (error) {
      console.error("Error fetching credits:", error);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await apiRequest("GET", "/api/credits/history");
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history);
      }
    } catch (error) {
      console.error("Error fetching credit history:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchCredits();
      if (showHistoryState) {
        await fetchHistory();
      }
      setIsLoading(false);
    };

    loadData();
  }, [showHistoryState]);

  const handleVerificationComplete = (result: any) => {
    if (result.success && result.credits !== undefined) {
      setCredits(result.credits);
      toast({
        title: "Credits Updated",
        description: `Your credit balance has been updated to ${result.credits} credits.`,
      });

      // Refresh history if showing
      if (showHistoryState) {
        fetchHistory();
      }
    }
  };

  const toggleHistory = async () => {
    if (!showHistoryState && history.length === 0) {
      await fetchHistory();
    }
    setShowHistoryState(!showHistoryState);
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center">Loading credits...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Your Credits</span>
          <span className="text-2xl font-bold text-green-600">{credits}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Credits are used to publish listings. Each listing typically requires 1 credit.
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={toggleHistory}
            >
              {showHistoryState ? "Hide History" : "Show History"}
            </Button>
            
            <VerifyPaymentButton
              className="text-xs"
              onVerificationComplete={handleVerificationComplete}
            />
          </div>

          {showHistoryState && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Credit History</h4>
              {history.length === 0 ? (
                <div className="text-sm text-muted-foreground">No credit transactions found.</div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {history.map((transaction) => (
                    <div 
                      key={transaction.id}
                      className="flex justify-between items-center p-2 bg-muted rounded text-sm"
                    >
                      <div>
                        <div className="font-medium">
                          {transaction.transactionType === 'purchase' && '+ '}
                          {transaction.transactionType === 'use' && '- '}
                          {transaction.transactionType === 'refund' && '+ '}
                          {Math.abs(transaction.credits)} credit{Math.abs(transaction.credits) !== 1 ? 's' : ''}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {transaction.description}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(transaction.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}