import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Check, X, AlertTriangle, Loader2, ExternalLink, 
  ChevronDown, ChevronRight, FileJson, Code
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Type definitions for detailed test results
interface DetailedTestResult {
  success: boolean;
  result?: any;
  error?: string;
}

interface DetailedTests {
  maps?: {
    geocoding?: DetailedTestResult;
    javascript?: DetailedTestResult;
  };
  places?: {
    findplace?: DetailedTestResult;
    autocomplete?: DetailedTestResult;
  };
}

interface GoogleStatusData {
  mapsApiKeyConfigured: boolean;
  placesApiKeyConfigured: boolean;
  geminiApiKeyConfigured: boolean;
  mapsApiWorking: boolean;
  placesApiWorking: boolean;
  geminiApiWorking: boolean;
  lastChecked: string;
  detailedTests?: DetailedTests;
}

export default function GoogleStatusChecker() {
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(false);
  const [showDetailedView, setShowDetailedView] = useState(false);

  // Get Google API configuration status
  const {
    data: googleStatus,
    refetch,
    isLoading,
    error,
  } = useQuery<GoogleStatusData>({
    queryKey: ["/api/google/status"],
    enabled: false, // Don't fetch on component mount
  });

  // Function to check Google API status
  const checkGoogleStatus = async () => {
    setIsChecking(true);
    try {
      await refetch();
      toast({
        title: "Status Check Complete",
        description: "Google API status check completed successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check Google API status.",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };

  // Render status indicator
  const renderStatusIndicator = (status: boolean | undefined, label: string) => {
    if (status === undefined) {
      return (
        <div className="flex items-center text-muted-foreground">
          <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
          <span>{label} status unknown</span>
        </div>
      );
    }

    return status ? (
      <div className="flex items-center text-green-600">
        <Check className="h-5 w-5 mr-2" />
        <span>{label} is configured and working</span>
      </div>
    ) : (
      <div className="flex items-center text-red-600">
        <X className="h-5 w-5 mr-2" />
        <span>{label} is not configured or not working</span>
      </div>
    );
  };

  const renderApiKeyStatus = (keyExists: boolean | undefined, apiName: string) => {
    if (keyExists === undefined) {
      return (
        <div className="flex items-center text-muted-foreground">
          <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
          <span>{apiName} API Key status unknown</span>
        </div>
      );
    }

    return keyExists ? (
      <div className="flex items-center text-green-600">
        <Check className="h-5 w-5 mr-2" />
        <span>{apiName} API Key is configured</span>
      </div>
    ) : (
      <div className="flex items-center text-red-600">
        <X className="h-5 w-5 mr-2" />
        <span>{apiName} API Key is missing</span>
      </div>
    );
  };

  // Function to render a detailed test result component
  const renderDetailedTestResult = (test?: DetailedTestResult, title: string = "") => {
    if (!test) return null;
    
    return (
      <div className="mb-4">
        <div className="flex items-center mb-2">
          {test.success ? (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Check className="h-3 w-3 mr-1" />
              Success
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              <X className="h-3 w-3 mr-1" />
              Failed
            </Badge>
          )}
          <span className="ml-2 font-medium">{title}</span>
        </div>
        
        <div className="ml-7">
          {test.error && (
            <div className="text-sm text-red-600 mb-2 border-l-2 border-red-300 pl-2">
              Error: {test.error}
            </div>
          )}
          
          {test.result && (
            <div className="mt-1 text-xs font-mono bg-muted p-2 rounded-md overflow-x-auto">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(test.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render detailed test results section
  const renderDetailedTests = () => {
    if (!googleStatus?.detailedTests) return null;

    const { maps, places } = googleStatus.detailedTests;

    return (
      <Tabs defaultValue="maps" className="w-full mt-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="maps">Maps API Tests</TabsTrigger>
          <TabsTrigger value="places">Places API Tests</TabsTrigger>
        </TabsList>
        
        <TabsContent value="maps" className="pt-4">
          {maps ? (
            <div className="space-y-2">
              {renderDetailedTestResult(maps.geocoding, "Geocoding API")}
              {renderDetailedTestResult(maps.javascript, "JavaScript API")}
              
              <div className="text-sm text-muted-foreground mt-4">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                Note: The JavaScript API test can only verify if the API endpoint responds. 
                It cannot fully verify browser restrictions which may still cause loading failures.
              </div>
            </div>
          ) : (
            <div className="text-center p-4 text-muted-foreground">
              <p>No Maps API tests were performed.</p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="places" className="pt-4">
          {places ? (
            <div className="space-y-2">
              {renderDetailedTestResult(places.findplace, "Find Place API")}
              {renderDetailedTestResult(places.autocomplete, "Autocomplete API")}
            </div>
          ) : (
            <div className="text-center p-4 text-muted-foreground">
              <p>No Places API tests were performed.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    );
  };

  // Helper function to determine if any tests failed
  const hasFailedTests = () => {
    const { detailedTests } = googleStatus || {};
    if (!detailedTests) return false;
    
    const mapsTests = [
      detailedTests.maps?.geocoding?.success,
      detailedTests.maps?.javascript?.success
    ];
    
    const placesTests = [
      detailedTests.places?.findplace?.success,
      detailedTests.places?.autocomplete?.success
    ];
    
    return [...mapsTests, ...placesTests].some(result => result === false);
  };

  return (
    <div className="border rounded-md p-5 bg-card">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Google API Status</h3>
          <div className="flex gap-2">
            {googleStatus && (
              <Button
                onClick={() => setShowDetailedView(!showDetailedView)}
                variant="outline"
                size="sm"
              >
                {showDetailedView ? "Simple View" : "Detailed View"}
              </Button>
            )}
            <Button
              onClick={checkGoogleStatus}
              disabled={isChecking}
              variant="outline"
              size="sm"
            >
              {isChecking || isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                "Check Status"
              )}
            </Button>
          </div>
        </div>

        <Separator />

        {error ? (
          <div className="p-4 border border-red-300 bg-red-50 rounded-md text-red-600">
            <p>Error checking Google API status. Please try again.</p>
          </div>
        ) : googleStatus ? (
          showDetailedView ? (
            <div className="space-y-4 pt-2">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base font-medium">Detailed Test Results</CardTitle>
                  <CardDescription>
                    Comprehensive test results for Google Maps and Places APIs
                    {hasFailedTests() && (
                      <div className="mt-1 text-red-500 font-medium">
                        ⚠️ Some tests failed - see details below
                      </div>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderDetailedTests()}
                </CardContent>
              </Card>
              
              <div className="space-y-2">
                <h4 className="font-medium">API Keys</h4>
                {renderApiKeyStatus(googleStatus.mapsApiKeyConfigured, "Maps")}
                {renderApiKeyStatus(googleStatus.placesApiKeyConfigured, "Places")}
                {renderApiKeyStatus(googleStatus.geminiApiKeyConfigured, "Gemini AI")}
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <h4 className="font-medium">Services Status</h4>
                {renderStatusIndicator(googleStatus.mapsApiWorking, "Google Maps")}
                {renderStatusIndicator(googleStatus.placesApiWorking, "Google Places")}
                {renderStatusIndicator(googleStatus.geminiApiWorking, "Gemini AI")}
              </div>

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="browser-troubleshooting">
                  <AccordionTrigger className="text-sm font-medium">
                    Browser Troubleshooting Tips
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p><strong>If API key tests pass but Maps still fail in the browser:</strong></p>
                      <ol className="list-decimal ml-5 space-y-1">
                        <li>Check if your API key has <strong>domain restrictions</strong> in Google Cloud Console</li>
                        <li>Make sure both <strong>Maps JavaScript API</strong> and <strong>Places API</strong> are enabled</li>
                        <li>Verify the <strong>referrer</strong> in your browser matches allowed domains</li>
                        <li>Check browser console for specific error messages</li>
                        <li>Ensure the billing account associated with the API key is active</li>
                      </ol>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Timestamp */}
              {googleStatus.lastChecked && (
                <div className="text-xs text-muted-foreground pt-2">
                  Last checked: {new Date(googleStatus.lastChecked).toLocaleString()}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {/* API Keys Status */}
              <div className="space-y-2">
                <h4 className="font-medium">API Keys</h4>
                {renderApiKeyStatus(googleStatus.mapsApiKeyConfigured, "Maps")}
                {renderApiKeyStatus(googleStatus.placesApiKeyConfigured, "Places")}
                {renderApiKeyStatus(googleStatus.geminiApiKeyConfigured, "Gemini AI")}
              </div>
              
              <Separator />
              
              {/* Services Status */}
              <div className="space-y-2">
                <h4 className="font-medium">Services Status</h4>
                {renderStatusIndicator(googleStatus.mapsApiWorking, "Google Maps")}
                {renderStatusIndicator(googleStatus.placesApiWorking, "Google Places")}
                {renderStatusIndicator(googleStatus.geminiApiWorking, "Gemini AI")}
              </div>

              {/* Timestamp */}
              {googleStatus.lastChecked && (
                <div className="text-xs text-muted-foreground pt-2">
                  Last checked: {new Date(googleStatus.lastChecked).toLocaleString()}
                </div>
              )}
            </div>
          )
        ) : (
          <div className="py-6 text-center text-muted-foreground">
            <p>Click "Check Status" to verify Google API configuration</p>
          </div>
        )}

        {/* Documentation Links */}
        <div className="pt-2 flex flex-wrap gap-3">
          <a
            href="https://developers.google.com/maps/documentation/javascript/get-api-key"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline inline-flex items-center"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            API Key Setup
          </a>
          <a
            href="https://developers.google.com/maps/documentation/javascript/error-messages"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline inline-flex items-center"
          >
            <Code className="h-4 w-4 mr-1" />
            Error Codes
          </a>
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline inline-flex items-center"
          >
            <FileJson className="h-4 w-4 mr-1" />
            Google Cloud Console
          </a>
        </div>
      </div>
    </div>
  );
}