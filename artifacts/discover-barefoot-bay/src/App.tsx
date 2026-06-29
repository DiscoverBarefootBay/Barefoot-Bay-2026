import React, { useEffect, lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
// import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./components/providers/auth-provider";
// WebSocket functionality is disabled to prevent conflicts with Object Storage
// import { initSocket } from "@/utils/socket";
// import calendarSync from "@/utils/calendar-sync";
// Media cache system
// import { initMediaCache } from "@/lib/media-cache";
// Analytics tracking
import { AnalyticsProvider } from "@/lib/analytics";
// New Error Boundary component for improved error handling
import ErrorBoundary from "@/components/error/error-boundary";
// Chat messaging feature
import { ChatProvider } from "./context/ChatContext";
// Rocket easter egg provider
import { RocketEasterEggProvider } from "@/contexts/rocket-easter-egg-context";
// Removed StorePageOverride import - no longer needed
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import HomePage from "@/pages/home-page";
import CalendarPage from "@/pages/calendar-page";
import EventDetailPage from "@/pages/event-detail-page";
import ForSalePage from "@/pages/for-sale-page";
import MyListingsPage from "@/pages/my-listings-page";
import RealEstatePage from "@/pages/real-estate-page";
import ListingDetailPage from "@/pages/listing-detail-page";
// Edit listing functionality now implemented directly in listing-detail-page
import PaymentCompletePage from "@/pages/payment-complete-page";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import ProfileSettings from "@/pages/profile-settings";
import SubscriptionsPage from "@/pages/subscriptions";
import MessagesPage from "@/pages/messages";
import CommunitySettings from "@/pages/community-settings";
// Analytics direct access page
import DirectAnalyticsAccess from "@/pages/direct-analytics-access";
import AdvancedSettings from "@/pages/advanced-settings";
import AmenitiesPage from "@/pages/amenities-page";
import BannerPage from "@/pages/banner-page";
import StorePage from "@/pages/store-page";
import ContactUsPage from "@/pages/contact-us";
import ProductDetailPage from "@/pages/product-detail-page";
import OrderCompletePage from "@/pages/store/order-complete-page";
import { OrderTrackingPage } from "@/pages/store/order-tracking-page";
import TrackOrderPage from "@/pages/store/track-order";
import PaymentPage from "@/pages/store/pay";
import MyReturnsPage from "@/pages/store/my-returns-page";
import ProductManagementPage from "@/pages/admin/product-management";
import OrderManagementPage from "@/pages/admin/order-management";
import ManageReturnsPage from "@/pages/admin/manage-returns-page";
import ProductImageTest from "@/pages/admin/product-image-test";
import VersionFixPage from "@/pages/admin/version-fix";
import FormSubmissionsAdmin from "@/pages/admin/form-submissions";
import ManagePagesAdmin from "@/pages/admin/manage-pages";
import ManageVendorsAdmin from "@/pages/admin/manage-vendors";
import ManageForumCategories from "@/pages/admin/manage-forum";
import ManageCommunityCategoriesPage from "@/pages/admin/manage-community-categories";
import SubscriptionTestPage from "@/pages/subscription-test";
import SubscriptionSuccessPage from "@/pages/subscription-success";
import SubscriptionErrorPage from "@/pages/subscription-error";
import SubscriptionCancelledPage from "@/pages/subscription-cancelled";
import BannerDiagnostic from "@/pages/banner-diagnostic";

import AdminDashboard from "@/pages/admin/dashboard";
import CalendarManagement from "@/pages/admin/calendar-management";
import FeatureManagementPage from "@/pages/admin/feature-management";
import PlatinumSponsorSettingsPage from "@/pages/admin/platinum-sponsor-settings";
import MembershipManagementPage from "@/pages/admin/membership-management";
import AnalyticsDashboard from "@/pages/admin/analytics-dashboard";
import EnhancedAnalyticsDashboard from "@/pages/admin/enhanced-analytics-dashboard";
import AdminMessagesPage from "@/pages/admin/admin-messages";
import EmailActivityPage from "@/pages/admin/email-activity";

import GenericContentPage from "@/pages/generic-content-page";
import FormPage from "@/pages/form-page";
import MockTrackingPage from "@/pages/testing/mock-tracking";
import ForumPage from "@/pages/forum/forum-page";
import ForumCategoryPage from "@/pages/forum/forum-category-page";
import ForumPostPage from "@/pages/forum/forum-post-page";
import NewPostPage from "@/pages/forum/new-post-page";
import EditPostPage from "@/pages/forum/edit-post-page";
import WeatherPage from "@/pages/weather";
import PaymentDiagnostics from "@/pages/payment-diagnostics";
import AuthDebugPage from "@/pages/admin/auth-debug";
import ProductionAuthFixPage from "@/pages/production-auth-fix-page";
import EmergencyAuthFixPage from "@/pages/emergency-auth-fix-page";
import DeploymentDiagnosticPage from "@/pages/deployment-diagnostic";
import MapsTestPage from "@/pages/maps-test-page";
import AvatarTestPage from "@/pages/avatar-test-page";
import LaunchPage from "@/pages/launch-page";
import MapTestPage from "@/pages/map-test-page";
import VendorUrlTestPage from "@/pages/vendor-url-test";
import UnsubscribePage from "@/pages/unsubscribe-page";
import { NavBar } from "./components/layout/nav-bar";
import { Footer } from "./components/layout/footer";
import { ProtectedRoute } from "./lib/protected-route";
import { BackgroundVideo } from "./components/shared/background-video";
import { ViewAsSwitcher } from "./components/admin/view-as-switcher";

// Custom route for the launch page - rendered outside main layout without any navigation
function LaunchPageRoute() {
  // Completely full-screen with no other app elements
  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-black z-50">
      <LaunchPage />
    </div>
  );
}

function Router() {
  // Check URL to determine if we're on the launch page
  const isLaunchPage = window.location.pathname === '/launch';
  
  // If we're on the launch page, render only the launch page without regular layout
  if (isLaunchPage) {
    return <LaunchPageRoute />;
  }
  
  // Otherwise render the regular app layout
  return (
    <div className="min-h-screen relative flex flex-col">
      <BackgroundVideo 
        videoUrl="/static/videos/BackgroundVideo.mp4"
      />
      <div className="relative z-10 bg-transparent flex-grow flex flex-col">
        <NavBar />
        <main className="container mx-auto px-4 py-4 md:py-8 flex-grow">
          <ErrorBoundary>
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/auth" component={AuthPage} />
            <Route path="/forgot-password" component={ForgotPasswordPage} />
            <Route path="/reset-password" component={ResetPasswordPage} />
            <Route path="/unsubscribe" component={UnsubscribePage} />
            {/* Calendar Routes */}
            <Route path="/calendar" component={CalendarPage} />
            <Route path="/events/:id" component={EventDetailPage} />
            
            {/* For Sale Routes */}
            <Route path="/for-sale" component={ForSalePage} />
            <Route path="/my-listings" component={MyListingsPage} />
            <Route path="/for-sale/payment-complete" component={PaymentCompletePage} />
            <Route path="/payment-complete" component={PaymentCompletePage} />
            {/* Edit listings functionality now handled via Dialog in the detail page */}
            <Route path="/for-sale/:id" component={ListingDetailPage} />
            <Route path="/real-estate" component={RealEstatePage} />
            <Route path="/real-estate/:id" component={ListingDetailPage} />
            
            {/* Store Routes */}
            <Route path="/store" component={() => <StorePage />} />
            <Route path="/product/:id" component={ProductDetailPage} />
            <Route path="/store/pay/:orderId" component={PaymentPage} />
            <Route path="/store/order-complete/:orderId" component={OrderCompletePage} />
            <Route path="/store/track-order" component={TrackOrderPage} />
            <ProtectedRoute path="/store/my-returns" component={MyReturnsPage} requiredFeature="STORE" />
            
            {/* Forum Routes */}
            <Route path="/forum" component={ForumPage} />
            <Route path="/forum/category/:categoryId" component={ForumCategoryPage} />
            <Route path="/forum/post/:postId" component={ForumPostPage} />
            <ProtectedRoute path="/forum/new-post" component={NewPostPage} requiredFeature="FORUM" />
            <ProtectedRoute path="/forum/edit-post/:postId" component={EditPostPage} requiredFeature="FORUM" />
            <Route path="/amenities" component={AmenitiesPage} />
            <Route path="/banner" component={BannerPage} />
            <Route path="/weather" component={WeatherPage} />
            {/* User Settings Routes */}
            <ProtectedRoute path="/profile" component={ProfileSettings} />
            <ProtectedRoute path="/subscriptions" component={SubscriptionsPage} />
            <Route path="/subscription-test" component={SubscriptionTestPage} />
            {/* Subscription Flow Pages */}
            <Route path="/subscription/success" component={SubscriptionSuccessPage} />
            <Route path="/subscription/error" component={SubscriptionErrorPage} />
            <Route path="/subscription/cancelled" component={SubscriptionCancelledPage} />
            <ProtectedRoute path="/community-settings" component={CommunitySettings} />
            <ProtectedRoute path="/advanced-settings" component={AdvancedSettings} />
            {/* Chat Interface - New messaging system */}
            <Route path="/messages">
              <Suspense fallback={<div className="text-center p-8">Loading chat...</div>}>
                {React.createElement(lazy(() => import('./pages/chat')))}
              </Suspense>
            </Route>
            <Route path="/chat">
              <Suspense fallback={<div className="text-center p-8">Loading chat...</div>}>
                {React.createElement(lazy(() => import('./pages/chat')))}
              </Suspense>
            </Route>
            <Route path="/contact-us" component={ContactUsPage} />
            <Route path="/forms/:slug" component={FormPage} />
            
            {/* Admin Routes - All require admin access */}
            <ProtectedRoute path="/admin" component={AdminDashboard} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/version-fix" component={VersionFixPage} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/products" component={ProductManagementPage} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/orders" component={OrderManagementPage} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/returns" component={ManageReturnsPage} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/product-image-test" component={ProductImageTest} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/form-submissions" component={FormSubmissionsAdmin} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/manage-pages" component={ManagePagesAdmin} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/manage-vendors" component={ManageVendorsAdmin} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/manage-forum" component={ManageForumCategories} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/community-categories" component={ManageCommunityCategoriesPage} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/messages" component={AdminMessagesPage} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/analytics" component={AnalyticsDashboard} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/email-activity" component={EmailActivityPage} requiredFeature="ADMIN" />

            <ProtectedRoute path="/admin/calendar-management" component={CalendarManagement} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/feature-management" component={FeatureManagementPage} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/platinum-sponsor-settings" component={PlatinumSponsorSettingsPage} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/membership-management" component={MembershipManagementPage} requiredFeature="ADMIN" />
            {/* Single consolidated analytics route */}
            <ProtectedRoute path="/analytics-dashboard" component={EnhancedAnalyticsDashboard} requiredFeature="ADMIN" />
            
            {/* Enhanced Analytics Dashboard (heatmaps, user segments, journey, export) */}
            <ProtectedRoute path="/enhanced-analytics" component={EnhancedAnalyticsDashboard} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/enhanced-analytics" component={EnhancedAnalyticsDashboard} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/enhanced-analytics-dashboard" component={EnhancedAnalyticsDashboard} requiredFeature="ADMIN" />

            <Route path="/direct-analytics" component={() => {
              window.location.href = '/analytics-dashboard';
              return null;
            }} />

            
            {/* Community Pages - Handle all /community/ paths with the generic content page */}
            <ProtectedRoute path="/community/community" component={() => <GenericContentPage />} requiredFeature="COMMUNITY" />
            <ProtectedRoute path="/community/community/:page" component={GenericContentPage} requiredFeature="COMMUNITY" />
            <ProtectedRoute path="/community/government" component={GenericContentPage} requiredFeature="COMMUNITY" />
            <ProtectedRoute path="/community/government/:page" component={GenericContentPage} requiredFeature="COMMUNITY" />
            <ProtectedRoute path="/community/transportation" component={GenericContentPage} requiredFeature="COMMUNITY" />
            <ProtectedRoute path="/community/transportation/:page" component={GenericContentPage} requiredFeature="COMMUNITY" />
            <ProtectedRoute path="/community/religion" component={GenericContentPage} requiredFeature="COMMUNITY" />
            <ProtectedRoute path="/community/religion/:page" component={GenericContentPage} requiredFeature="COMMUNITY" />
            <ProtectedRoute path="/community/vendors" component={GenericContentPage} requiredFeature="COMMUNITY" />
            <ProtectedRoute path="/community/vendors/:page" component={GenericContentPage} requiredFeature="COMMUNITY" />
            <ProtectedRoute path="/community/:category" component={GenericContentPage} requiredFeature="COMMUNITY" />
            <ProtectedRoute path="/community/:category/:page" component={GenericContentPage} requiredFeature="COMMUNITY" />
            
            {/* Legacy /more routes - redirect to /community */}
            <Route path="/more/:category" component={({ params }) => {
              // Redirect from /more/category to /community/category
              window.location.replace(`/community/${params.category}`);
              return null;
            }} />
            <Route path="/more/:category/:page" component={({ params }) => {
              // Redirect from /more/category/page to /community/category/page
              window.location.replace(`/community/${params.category}/${params.page}`);
              return null;
            }} />
            
            {/* Terms & Privacy pages */}
            <Route path="/terms" component={() => <GenericContentPage slug="terms-and-agreements" />} />
            <Route path="/privacy" component={() => <GenericContentPage slug="privacy-policy" />} />
            
            {/* Dedicated routes for Vendors pages */}
            <ProtectedRoute path="/vendors" component={() => <GenericContentPage slug="vendors-main" />} requiredFeature="VENDORS" />
            
            {/* Special redirects for malformed vendor URLs with "services-" prefix */}
            <Route path="/vendors/home/services-:vendor" component={({ params }) => {
              const vendor = params.vendor;
              console.log(`Redirecting from malformed URL /vendors/home/services-${vendor} to correct URL /vendors/home-services/${vendor}`);
              window.location.replace(`/vendors/home-services/${vendor}`);
              return null;
            }} />
            
            {/* Additional special case for /vendors/home-services/services-vendor-name */}
            <Route path="/vendors/home-services/services-:vendor" component={({ params }) => {
              const vendor = params.vendor;
              console.log(`Handling duplicated services prefix: /vendors/home-services/services-${vendor} → /vendors/home-services/${vendor}`);
              window.location.replace(`/vendors/home-services/${vendor}`);
              return null;
            }} />

            {/* Special handling for compound categories that get split incorrectly */}
            <Route path="/vendors/home/services/:vendor" component={({ params }) => {
              const vendor = params.vendor;
              console.log(`Handling incorrectly split category: /vendors/home/services/${vendor} → /vendors/home-services/${vendor}`);
              window.location.replace(`/vendors/home-services/${vendor}`);
              return null;
            }} />
            
            {/* Special handling for technology-and-electronics that gets split incorrectly */}
            <Route path="/vendors/technology/and-electronics-:vendor" component={({ params }) => {
              const vendor = params.vendor;
              console.log(`Handling incorrectly split technology category: /vendors/technology/and-electronics-${vendor} → /vendors/technology-and-electronics/${vendor}`);
              window.location.replace(`/vendors/technology-and-electronics/${vendor}`);
              return null;
            }} />
            
            {/* Special handling for technology-and-electronics that gets split incorrectly */}
            <Route path="/vendors/technology/and-electronics/:vendor" component={({ params }) => {
              const vendor = params.vendor;
              console.log(`Handling incorrectly split technology category: /vendors/technology/and-electronics/${vendor} → /vendors/technology-and-electronics/${vendor}`);
              window.location.replace(`/vendors/technology-and-electronics/${vendor}`);
              return null;
            }} />
            
            {/* Universal handler for all vendor pages with undefined vendor */}
            <Route path="/vendors/:category/undefined" component={({ params }) => {
              const category = params.category;
              console.log(`Fixing undefined vendor URL in category: ${category}`);
              // Redirect back to category listing page
              const fixedUrl = `/vendors/${category}`.replace(/\/\//g, '/');
              console.log(`Redirecting to fixed URL: ${fixedUrl}`);
              window.location.replace(fixedUrl);
              return null;
            }} />
            
            {/* Universal handler for all vendor pages to ensure proper loading */}
            <Route path="/vendors/:category/:vendor" component={({ params }) => {
              const category = params.category;
              const vendor = params.vendor;
              
              // Skip special handling if it's a system route
              if (vendor === 'main' || vendor === 'edit' || vendor === 'create') {
                return <GenericContentPage />;
              }
              
              console.log(`🔍 Universal vendor page handler for: ${category}/${vendor}`);
              
              // Generate slug from URL parameters
              const slug = `vendors-${category}-${vendor}`;
              console.log(`Generated slug: ${slug}`);
              
              // Pre-fetch the content to ensure it's available
              fetch(`/api/pages/${slug}?forceRefresh=true`)
                .then(response => {
                  if (response.ok) {
                    console.log(`✅ Successfully prefetched vendor content for ${category}/${vendor}`);
                  } else {
                    console.error(`❌ Failed to prefetch vendor content for ${category}/${vendor}:`, response.status);
                  }
                })
                .catch(error => {
                  console.error(`❌ Error prefetching vendor content for ${category}/${vendor}:`, error);
                });
              
              // Render generic content page with explicit slug
              return <GenericContentPage slug={slug} />;
            }} />
            
            {/* Generic redirect for compound categories with "and" that get split incorrectly */}
            <Route path="/vendors/:part1/and-:part2-:vendor" component={({ params }: any) => {
              const part1 = params.part1;
              const part2 = params.part2;
              const vendor = params.vendor;
              console.log(`Handling split "and" compound category: /vendors/${part1}/and-${part2}-${vendor} → /vendors/${part1}-and-${part2}/${vendor}`);
              window.location.replace(`/vendors/${part1}-and-${part2}/${vendor}`);
              return null;
            }} />
            
            {/* Generic redirect for compound categories with "and" that get split differently */}
            <Route path="/vendors/:part1/and-:part2/:vendor" component={({ params }: any) => {
              const part1 = params.part1;
              const part2 = params.part2;
              const vendor = params.vendor;
              console.log(`Handling split "and" compound category: /vendors/${part1}/and-${part2}/${vendor} → /vendors/${part1}-and-${part2}/${vendor}`);
              window.location.replace(`/vendors/${part1}-and-${part2}/${vendor}`);
              return null;
            }} />
            
            {/* Generic redirect for other categories that might have the same issue */}
            <Route path="/vendors/:part1/services-:vendor" component={({ params }: any) => {
              const part1 = params.part1;
              const vendor = params.vendor;
              if (part1 !== 'home-services' && part1 !== 'home') {
                console.log(`Redirecting from malformed URL /vendors/${part1}/services-${vendor} to correct URL /vendors/${part1}-services/${vendor}`);
                window.location.replace(`/vendors/${part1}-services/${vendor}`);
              }
              return null;
            }} />
            
            {/* Catch-all for any other split compound categories */}
            <Route path="/vendors/:part1/:part2-:vendor" component={({ params }: any) => {
              // Only handle if this looks like a split compound category
              const part1 = params.part1;
              const part2 = params.part2; 
              const vendor = params.vendor;
              
              console.log(`Detected potential split compound category: /vendors/${part1}/${part2}-${vendor}`);
              
              // Get all compound categories (comprehensive list from database analysis)
              const compoundCategories = [
                'home-services',
                'food-and-dining',
                'health-and-medical', 
                'technology-and-electronics',
                'real-estate-senior-living',
                'insurance-financial-services', 
                'beauty-personal-care',
                'hvac-and-air-quality',
                'anchor-and-vapor-barrier',
                'automotive-golf-carts',
                'moving-and-transportation',
                'new-homes-installation'
              ];
              
              // Find a matching compound category
              for (const compound of compoundCategories) {
                const parts = compound.split('-');
                // If the first part of compound matches part1 AND
                // the subsequent part matches part2, this is likely a broken compound URL
                if (parts.length >= 2 && parts[0] === part1) {
                  const correctCategory = compound;
                  console.log(`Fixing likely broken compound category URL: /vendors/${part1}/${part2}-${vendor} → /vendors/${correctCategory}/${vendor}`);
                  window.location.replace(`/vendors/${correctCategory}/${vendor}`);
                  return null;
                }
              }
              
              return null;
            }} />
            
            {/* Standard vendor detail page route */}
            <ProtectedRoute path="/vendors/:category/:vendor" component={GenericContentPage} requiredFeature="VENDORS" />
            <ProtectedRoute path="/vendors/:page" component={GenericContentPage} requiredFeature="VENDORS" />
            
            {/* Testing Pages */}
            <Route path="/testing/track" component={MockTrackingPage} />
            <Route path="/testing/maps" component={MapsTestPage} />
            <Route path="/testing/map" component={MapTestPage} />
            <Route path="/testing/avatar" component={AvatarTestPage} />
            <Route path="/testing/vendor-url" component={VendorUrlTestPage} />
            <ProtectedRoute path="/admin/payment-diagnostics" component={PaymentDiagnostics} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/auth-debug" component={AuthDebugPage} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/fix-production-auth" component={ProductionAuthFixPage} requiredFeature="ADMIN" />
            
            {/* Emergency authentication repair - publicly accessible */}
            <Route path="/emergency-auth-fix" component={EmergencyAuthFixPage} />
            
            {/* Deployment diagnostic tool - publicly accessible */}
            <Route path="/deployment-diagnostic" component={DeploymentDiagnosticPage} />
            
            {/* Direct Analytics Access - Added as a fail-safe since regular analytics links are not working */}
            <Route path="/analytics-access" component={() => {
              const AnalyticsStandalone = require('@/pages/analytics-standalone').default;
              return <AnalyticsStandalone />;
            }} />
            
            {/* Banner diagnostic tool - publicly accessible */}
            <Route path="/banner-diagnostic">
              {() => {
                const BannerDiagnosticPage = React.lazy(() => import('@/pages/banner-diagnostic'));
                return (
                  <React.Suspense fallback={<div className="flex justify-center items-center min-h-screen">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>}>
                    <BannerDiagnosticPage />
                  </React.Suspense>
                );
              }}
            </Route>
            
            {/* Object Storage debugging tool - admin access */}
            <ProtectedRoute path="/admin/object-storage-debug" component={() => {
              const ObjectStorageDebugPage = React.lazy(() => import('@/pages/object-storage-debug'));
              return (
                <React.Suspense fallback={<div>Loading...</div>}>
                  <ObjectStorageDebugPage />
                </React.Suspense>
              );
            }} requiredFeature="ADMIN" />
            
            <Route component={() => <NotFound />} />
          </Switch>
          </ErrorBoundary>
        </main>
        <Footer />
      </div>
      <ViewAsSwitcher />
    </div>
  );
}

// Regular router is already properly handling launch page via LaunchPageRoute
function AppRouter() {
  return <Router />;
}

function App() {
  // Critical diagnostic log - confirm App component is mounting
  console.log('🔍 [MOBILE DEBUG] App component is mounting');
  
  // Initialize media cache system which includes fallback images
  useEffect(() => {
    // Initialize media cache and fallback image system
    // initMediaCache();
    
    // Initialize analytics tracking system
    console.log("[Analytics]", "Analytics tracking system temporarily disabled");
    
    // Note: The chat feature uses WebSockets for its own functionality
    // Other WebSocket functionality has been disabled to prevent conflicts with Object Storage
    console.log("[System]", "General WebSocket functionality is disabled to prevent conflicts with Object Storage");
    
    // Signal to Replit that the app has loaded
    setTimeout(() => {
      // Add meta tags to head
      const addMetaTag = (name: string, content: string) => {
        if (!document.querySelector(`meta[name="${name}"]`)) {
          const meta = document.createElement('meta');
          meta.name = name;
          meta.content = content;
          document.head.appendChild(meta);
        }
      };
      
      // Add meta tags for Replit
      addMetaTag('replit-cartographer-status', 'ready');
      addMetaTag('replit-page-ready', 'true');
      
      // Signal in console
      console.warn("REPLIT_APP_LOADED");
      
      // Try sending postMessage to Replit iframe parent
      try {
        window.parent?.postMessage({ type: "app:loaded", status: "complete" }, "*");
      } catch (e) {
        // Silent fail if posting to parent doesn't work
      }
    }, 1000);
    
    // Cleanup function
    return () => {
      // WebSocket cleanup is disabled
      console.log("[System]", "WebSocket cleanup is disabled");
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AuthProvider>
          <AnalyticsProvider>
            <RocketEasterEggProvider>
              <AppRouter />
              {/* <Toaster /> */}
            </RocketEasterEggProvider>
          </AnalyticsProvider>
        </AuthProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;