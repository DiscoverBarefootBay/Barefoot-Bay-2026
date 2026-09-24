import React, { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { 
  FileText, 
  ArrowLeft,
  Clock,
  Search,
  AlertTriangle,
  Ban,
  FileWarning,
  CheckCircle,
  HelpCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type DMCAStatusResponse = {
  caseNumber: string;
  receivedAt: string;
  updatedAt: string;
  status: "Received" | "Under review" | "Needs information" | "Content disabled" | "Counter-notice received" | "Closed";
};

const STATUS_STEPS = [
  "Received",
  "Under review",
  "Content disabled",
  "Counter-notice received",
  "Closed"
];

export default function DMCAStatusPage() {
  const { token } = useParams<{ token: string }>();

  useEffect(() => {
    // Add noindex meta tag to prevent search engines from indexing status pages with tokens
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    const originalContent = meta.getAttribute('content');
    meta.setAttribute('content', 'noindex');

    // The token in this URL is a credential: don't leak it via Referer headers.
    let referrerMeta = document.querySelector('meta[name="referrer"]');
    const createdReferrerMeta = !referrerMeta;
    if (!referrerMeta) {
      referrerMeta = document.createElement('meta');
      referrerMeta.setAttribute('name', 'referrer');
      document.head.appendChild(referrerMeta);
    }
    const originalReferrer = referrerMeta.getAttribute('content');
    referrerMeta.setAttribute('content', 'no-referrer');
    
    return () => {
      if (createdReferrerMeta) referrerMeta?.remove();
      else if (originalReferrer) referrerMeta?.setAttribute('content', originalReferrer);
      if (originalContent) {
        meta?.setAttribute('content', originalContent);
      } else {
        meta?.remove();
      }
    };
  }, []);

  const { data, isLoading, isPlaceholderData, error } = useQuery<DMCAStatusResponse, Error>({
    queryKey: [`/api/dmca/status/${token}`],
    retry: false, // Don't retry on 404s
  });

  if (isLoading || isPlaceholderData) {
    return (
      <div className="max-w-3xl mx-auto py-24 px-4 sm:px-6 flex justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Handle 404 specifically or other errors
  if (error || !data || typeof data.caseNumber !== "string") {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6">
        <Card className="border-0 shadow-lg text-center p-8">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Notice Not Found</h1>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            We couldn't find a DMCA notice with that tracking link. The link may have expired or is incorrect.
          </p>
          <Button asChild>
            <Link href="/dmca">Return to DMCA Policy</Link>
          </Button>
        </Card>
      </div>
    );
  }

  // Helper to determine active step in the linear flow
  const getCurrentStepIndex = (status: string) => {
    // If it's "Needs information", it logically sits around "Under review"
    if (status === "Needs information") return 1; 
    return STATUS_STEPS.indexOf(status);
  };

  const currentIndex = getCurrentStepIndex(data.status);

  // Icon mapping for current status summary
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Received": return <Clock className="w-8 h-8 text-blue-500" />;
      case "Under review": return <Search className="w-8 h-8 text-indigo-500" />;
      case "Needs information": return <AlertTriangle className="w-8 h-8 text-amber-500" />;
      case "Content disabled": return <Ban className="w-8 h-8 text-red-500" />;
      case "Counter-notice received": return <FileWarning className="w-8 h-8 text-orange-500" />;
      case "Closed": return <CheckCircle className="w-8 h-8 text-green-500" />;
      default: return <HelpCircle className="w-8 h-8 text-gray-500" />;
    }
  };

  const getStatusDescription = (status: string) => {
    switch (status) {
      case "Received": return "Your notice has been received and is in the queue.";
      case "Under review": return "Our trust & safety team is currently reviewing your notice.";
      case "Needs information": return "We need more information to process your notice. Check your email.";
      case "Content disabled": return "The reported content has been disabled pending further action.";
      case "Counter-notice received": return "A valid counter-notice has been received from the user. We will notify you via email of the next steps.";
      case "Closed": return "This case is now closed. A final resolution has been reached.";
      default: return "";
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6">
      <Link href="/dmca" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Policy
      </Link>

      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">Notice Status</h1>
          <p className="text-lg text-gray-600">Track the progress of your DMCA takedown request.</p>
        </div>
        <div className="bg-gray-100 px-4 py-2 rounded-md border border-gray-200 inline-flex items-center">
          <FileText className="w-4 h-4 mr-2 text-gray-500" />
          <span className="font-mono font-bold text-gray-800">Case {data.caseNumber}</span>
        </div>
      </div>

      <Card className="shadow-sm border-gray-200 mb-8 overflow-hidden">
        <div className="bg-gray-50/50 p-6 md:p-8 border-b border-gray-200">
          <div className="flex items-start gap-4">
            <div className="shrink-0 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
              {getStatusIcon(data.status)}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                {data.status === "Needs information" ? "Action Required" : data.status}
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed">
                {getStatusDescription(data.status)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="p-6 md:p-8">
          <div className="relative">
            {/* Connecting Line */}
            <div className="absolute top-5 left-[10%] right-[10%] h-0.5 bg-gray-200" />
            
            <div className="relative flex justify-between">
              {STATUS_STEPS.map((step, index) => {
                // "Closed" can follow a rejected notice, so never imply the
                // content-disabled / counter-notice steps actually happened.
                const isCompleted = index < currentIndex && !(data.status === "Closed" && index >= 2);
                const isCurrent = index === currentIndex;
                
                // If the state is "Needs information", we show it on the "Under review" step (index 1)
                const isWarningStep = data.status === "Needs information" && index === 1;

                return (
                  <div key={step} className="flex flex-col items-center relative z-10 flex-1 min-w-0 px-0.5">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center border-2 mb-3 bg-white transition-colors duration-300
                      ${isCompleted ? 'border-primary bg-primary text-white' : 
                        isWarningStep ? 'border-amber-500 bg-amber-50 text-amber-600' :
                        isCurrent ? 'border-primary text-primary' : 'border-gray-300 text-gray-400'}
                    `}>
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : isWarningStep ? (
                        <AlertTriangle className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-bold">{index + 1}</span>
                      )}
                    </div>
                    <span className={`text-[11px] sm:text-xs leading-tight text-center font-medium ${isCurrent || isWarningStep ? 'text-gray-900' : 'text-gray-500'}`}>
                      {isWarningStep ? "Needs Info" : step}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 uppercase tracking-wider font-semibold block mb-1">Received On</span>
            <span className="text-gray-900 font-medium">
              {new Date(data.receivedAt).toLocaleDateString(undefined, { 
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })}
            </span>
          </div>
          <div>
            <span className="text-gray-500 uppercase tracking-wider font-semibold block mb-1">Last Updated</span>
            <span className="text-gray-900 font-medium">
              {new Date(data.updatedAt).toLocaleDateString(undefined, { 
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })}
            </span>
          </div>
        </div>
      </Card>
      
      {data.status === "Needs information" && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-r-lg mb-8 shadow-sm">
          <div className="flex">
            <AlertTriangle className="w-6 h-6 text-amber-500 mr-4 shrink-0" />
            <div>
              <h3 className="text-amber-800 font-bold text-lg mb-2">We need more details</h3>
              <p className="text-amber-700 leading-relaxed mb-4">
                Our team reviewed your notice but requires additional information to proceed. We have sent an email detailing what is needed.
              </p>
              <p className="text-amber-700 text-sm font-medium">
                Please reply to the email with the requested information. Your request will remain paused until we hear back.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
