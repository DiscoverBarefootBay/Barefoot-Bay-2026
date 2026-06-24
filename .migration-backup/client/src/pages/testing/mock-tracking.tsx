import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Truck, MapPin, CheckCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";

/**
 * Mock Tracking Page for Testing Order Tracking URLs
 * 
 * This page simulates a package tracking page for testing the "Mark as Shipped" functionality
 * without needing to use real carrier tracking URLs.
 */
export default function MockTrackingPage() {
  const [progress, setProgress] = useState(25);
  const [status, setStatus] = useState("In Transit");
  const [location, setLocation] = useState("Distribution Center, Orlando FL");
  const [events, setEvents] = useState([
    { 
      date: new Date().toLocaleDateString(), 
      time: "08:15 AM", 
      status: "Package in transit", 
      location: "Distribution Center, Orlando FL" 
    },
    { 
      date: new Date(Date.now() - 86400000).toLocaleDateString(), 
      time: "10:30 AM", 
      status: "Package processed", 
      location: "Shipping Facility, Tampa FL" 
    },
    { 
      date: new Date(Date.now() - 172800000).toLocaleDateString(), 
      time: "4:45 PM", 
      status: "Shipping label created", 
      location: "Fulfillment Center, Tampa FL" 
    }
  ]);

  // Get the tracking number from the URL query parameters
  const [, params] = useLocation();
  const query = new URLSearchParams(window.location.search);
  const trackingNumber = query.get("tracking") || "BB123456789";
  
  // Simulate progress updates
  useEffect(() => {
    const timer = setTimeout(() => {
      if (progress < 100) {
        const newProgress = Math.min(progress + 25, 100);
        setProgress(newProgress);
        
        if (newProgress === 50) {
          setStatus("Out for Delivery");
          setLocation("Local Carrier Facility, Barefoot Bay FL");
          setEvents(prev => [
            { 
              date: new Date().toLocaleDateString(), 
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
              status: "Out for delivery", 
              location: "Local Carrier Facility, Barefoot Bay FL" 
            },
            ...prev
          ]);
        } else if (newProgress === 75) {
          setStatus("Arriving Today");
          setLocation("On Vehicle for Delivery, Barefoot Bay FL");
          setEvents(prev => [
            { 
              date: new Date().toLocaleDateString(), 
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
              status: "On vehicle for delivery", 
              location: "Local Delivery Vehicle, Barefoot Bay FL" 
            },
            ...prev
          ]);
        } else if (newProgress === 100) {
          setStatus("Delivered");
          setLocation("Front Door, Barefoot Bay FL");
          setEvents(prev => [
            { 
              date: new Date().toLocaleDateString(), 
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
              status: "Package delivered", 
              location: "Front Door, Barefoot Bay FL" 
            },
            ...prev
          ]);
        }
      }
    }, 10000); // Update every 10 seconds

    return () => clearTimeout(timer);
  }, [progress]);

  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="max-w-3xl mx-auto">
        <CardHeader className="pb-4 border-b">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl mb-1">Package Tracking</CardTitle>
              <CardDescription>Tracking Number: {trackingNumber}</CardDescription>
            </div>
            <div className="bg-blue-50 p-3 rounded-full">
              <Package className="h-6 w-6 text-blue-500" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-lg">{status}</h3>
              <span className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{location}</p>
            <Progress value={progress} className="h-2" />
            
            <div className="flex justify-between mt-3 text-xs">
              <div className="flex flex-col items-center">
                <Package className="h-4 w-4 mb-1 text-green-500" />
                <span>Shipped</span>
              </div>
              <div className="flex flex-col items-center">
                <Truck className={`h-4 w-4 mb-1 ${progress >= 25 ? "text-green-500" : "text-gray-300"}`} />
                <span>In Transit</span>
              </div>
              <div className="flex flex-col items-center">
                <MapPin className={`h-4 w-4 mb-1 ${progress >= 50 ? "text-green-500" : "text-gray-300"}`} />
                <span>Out for Delivery</span>
              </div>
              <div className="flex flex-col items-center">
                <CheckCircle className={`h-4 w-4 mb-1 ${progress === 100 ? "text-green-500" : "text-gray-300"}`} />
                <span>Delivered</span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4">Tracking History</h3>
            <div className="space-y-4">
              {events.map((event, index) => (
                <div key={index} className="border-l-2 border-gray-200 pl-4 pb-2">
                  <div className="flex justify-between">
                    <p className="font-medium">{event.status}</p>
                    <p className="text-sm text-muted-foreground">{event.time}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{event.location}</p>
                  <p className="text-xs text-muted-foreground mt-1">{event.date}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 pt-4 border-t">
            <p className="text-xs text-center text-muted-foreground">
              This is a mock tracking page for testing purposes. In a production environment, 
              this would redirect to the actual carrier's tracking page.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}