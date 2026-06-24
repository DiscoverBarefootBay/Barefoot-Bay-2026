import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

type ListingDisclaimerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ListingDisclaimerDialog({ open, onOpenChange }: ListingDisclaimerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-auto p-6 mt-4">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <DialogTitle className="text-base sm:text-lg">Fair Housing & Legal Disclaimer</DialogTitle>
          </div>
        </DialogHeader>
        
        <div className="space-y-4 pt-2">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800 leading-relaxed">
                <p className="font-semibold mb-2">Important Legal Notice</p>
                <p>
                  By placing an ad on BarefootBay.com—including for real estate sales or rentals, 
                  open houses, garage sales, services, or classified listings—you agree to comply 
                  with all applicable local, state, and federal laws, including the Federal Fair 
                  Housing Act and Florida Fair Housing Act.
                </p>
              </div>
            </div>
          </div>
          
          <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Fair Housing Requirements</h4>
              <p>
                Discriminatory language or practices will not be tolerated. All properties must be 
                made available regardless of race, color, religion, sex, disability, familial status, 
                national origin, or age.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Accuracy Statement</h4>
              <p>
                You certify that all information provided is accurate and truthful to the best of 
                your knowledge.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Platform Rights</h4>
              <p>
                BarefootBay.com reserves the right to reject, edit, or remove any advertisement 
                at any time and for any reason, with or without notice.
              </p>
            </div>
          </div>
          
          <div className="flex justify-end pt-4 border-t">
            <Button 
              onClick={() => onOpenChange(false)}
              variant="outline"
            >
              I Understand
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}