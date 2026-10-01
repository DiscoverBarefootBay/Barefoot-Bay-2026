import { useEffect, lazy, Suspense } from "react";
import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
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
import { installUnreadInvalidation } from "./lib/message-unread";
import { useInternalNavigation } from "./hooks/use-internal-navigation";
// Rocket easter egg provider
import { RocketEasterEggProvider } from "@/contexts/rocket-easter-egg-context";
// Removed StorePageOverride import - no longer needed
const NotFound = lazy(() => import("@/pages/not-found"));
const AuthPage = lazy(() => import("@/pages/auth-page"));
const HomePage = lazy(() => import("@/pages/home-page"));
const CalendarPage = lazy(() => import("@/pages/calendar-page"));
const EventDetailPage = lazy(() => import("@/pages/event-detail-page"));
const ForSalePage = lazy(() => import("@/pages/for-sale-page"));
const MyListingsPage = lazy(() => import("@/pages/my-listings-page"));
const RealEstatePage = lazy(() => import("@/pages/real-estate-page"));
const ListingDetailPage = lazy(() => import("@/pages/listing-detail-page"));
// Edit listing functionality now implemented directly in listing-detail-page
const PaymentCompletePage = lazy(() => import("@/pages/payment-complete-page"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const ProfileSettings = lazy(() => import("@/pages/profile-settings"));
const SubscriptionsPage = lazy(() => import("@/pages/subscriptions"));
const CopyrightNoticesPage = lazy(() => import("@/pages/copyright-notices/list-page"));
const CopyrightNoticeDetailPage = lazy(() => import("@/pages/copyright-notices/detail-page"));
const CounterNoticePage = lazy(() => import("@/pages/copyright-notices/counter-notice-page"));
const CommunitySettings = lazy(() => import("@/pages/community-settings"));
// Analytics direct access page
const AdvancedSettings = lazy(() => import("@/pages/advanced-settings"));
const AmenitiesPage = lazy(() => import("@/pages/amenities-page"));
const BannerPage = lazy(() => import("@/pages/banner-page"));
const StorePage = lazy(() => import("@/pages/store-page"));
const ContactUsPage = lazy(() => import("@/pages/contact-us"));
const DMCAPolicyPage = lazy(() => import("@/pages/dmca/dmca-policy-page"));
const DMCANoticePage = lazy(() => import("@/pages/dmca/dmca-notice-page"));
const DMCAStatusPage = lazy(() => import("@/pages/dmca/dmca-status-page"));
const ProductDetailPage = lazy(() => import("@/pages/product-detail-page"));
const OrderCompletePage = lazy(() => import("@/pages/store/order-complete-page"));
const TrackOrderPage = lazy(() => import("@/pages/store/track-order"));
const PaymentPage = lazy(() => import("@/pages/store/pay"));
const MyReturnsPage = lazy(() => import("@/pages/store/my-returns-page"));
const ProductManagementPage = lazy(() => import("@/pages/admin/product-management"));
const OrderManagementPage = lazy(() => import("@/pages/admin/order-management"));
const ManageReturnsPage = lazy(() => import("@/pages/admin/manage-returns-page"));
const ProductImageTest = lazy(() => import("@/pages/admin/product-image-test"));
const VersionFixPage = lazy(() => import("@/pages/admin/version-fix"));
const FormSubmissionsAdmin = lazy(() => import("@/pages/admin/form-submissions"));
const ManagePagesAdmin = lazy(() => import("@/pages/admin/manage-pages"));
const ManageVendorsAdmin = lazy(() => import("@/pages/admin/manage-vendors"));
const ManageForumCategories = lazy(() => import("@/pages/admin/manage-forum"));
const ManageCommunityCategoriesPage = lazy(() => import("@/pages/admin/manage-community-categories"));
const SubscriptionTestPage = lazy(() => import("@/pages/subscription-test"));
const SubscriptionSuccessPage = lazy(() => import("@/pages/subscription-success"));
const SubscriptionErrorPage = lazy(() => import("@/pages/subscription-error"));
const SubscriptionCancelledPage = lazy(() => import("@/pages/subscription-cancelled"));
const BannerDiagnostic = lazy(() => import("@/pages/banner-diagnostic"));

const AdminDashboard = lazy(() => import("@/pages/admin/dashboard"));
const CalendarManagement = lazy(() => import("@/pages/admin/calendar-management"));
const FeatureManagementPage = lazy(() => import("@/pages/admin/feature-management"));
const PlatinumSponsorSettingsPage = lazy(() => import("@/pages/admin/platinum-sponsor-settings"));
const MembershipManagementPage = lazy(() => import("@/pages/admin/membership-management"));
const AnalyticsDashboard = lazy(() => import("@/pages/admin/analytics-dashboard"));
const EnhancedAnalyticsDashboard = lazy(() => import("@/pages/admin/enhanced-analytics-dashboard"));
const AdminMessagesPage = lazy(() => import("@/pages/admin/admin-messages"));
const EmailActivityPage = lazy(() => import("@/pages/admin/email-activity"));
const OnTheMarketEmailsPage = lazy(() => import("@/pages/admin/on-the-market-emails"));
const ManageListingsPage = lazy(() => import("@/pages/admin/manage-listings"));

const DmcaDashboard = lazy(() => import("@/pages/admin/dmca/dashboard"));
const DmcaNewCase = lazy(() => import("@/pages/admin/dmca/new-case"));
const DmcaCaseDetail = lazy(() => import("@/pages/admin/dmca/case-detail"));
const DmcaLegalHolds = lazy(() => import("@/pages/admin/dmca/legal-holds"));
const DmcaRepeatInfringers = lazy(() => import("@/pages/admin/dmca/repeat-infringers"));
const DmcaSettings = lazy(() => import("@/pages/admin/dmca/settings"));
const DmcaPermissions = lazy(() => import("@/pages/admin/dmca/permissions"));
const ModeratedPosts = lazy(() => import("@/pages/admin/moderated-posts"));

const GenericContentPage = lazy(() => import("@/pages/generic-content-page"));
const FormPage = lazy(() => import("@/pages/form-page"));
const MockTrackingPage = lazy(() => import("@/pages/testing/mock-tracking"));
const ForumPage = lazy(() => import("@/pages/forum/forum-page"));
const ForumCategoryRedirect = lazy(() => import("@/pages/forum/forum-category-redirect"));
const ForumPostPage = lazy(() => import("@/pages/forum/forum-post-page"));
const NewPostPage = lazy(() => import("@/pages/forum/new-post-page"));
const EditPostPage = lazy(() => import("@/pages/forum/edit-post-page"));
const WeatherPage = lazy(() => import("@/pages/weather"));
const PaymentDiagnostics = lazy(() => import("@/pages/payment-diagnostics"));
const AuthDebugPage = lazy(() => import("@/pages/admin/auth-debug"));
const ProductionAuthFixPage = lazy(() => import("@/pages/production-auth-fix-page"));
const EmergencyAuthFixPage = lazy(() => import("@/pages/emergency-auth-fix-page"));
const DeploymentDiagnosticPage = lazy(() => import("@/pages/deployment-diagnostic"));
const MapsTestPage = lazy(() => import("@/pages/maps-test-page"));
const AvatarTestPage = lazy(() => import("@/pages/avatar-test-page"));
const LaunchPage = lazy(() => import("@/pages/launch-page"));
const MapTestPage = lazy(() => import("@/pages/map-test-page"));
const VendorUrlTestPage = lazy(() => import("@/pages/vendor-url-test"));
const UnsubscribePage = lazy(() => import("@/pages/unsubscribe-page"));
const ChatPage = lazy(() => import("@/pages/chat"));
const AnalyticsStandalone = lazy(() => import("@/pages/analytics-standalone"));
const ObjectStorageDebugPage = lazy(() => import("@/pages/object-storage-debug"));
import { NavBar } from "./components/layout/nav-bar";
import { Footer } from "./components/layout/footer";
import { ProtectedRoute } from "./lib/protected-route";
import { BackgroundVideo } from "./components/shared/background-video";
import { ViewAsSwitcher } from "./components/admin/view-as-switcher";
import { LegalConsentGate } from "./components/legal/legal-consent-gate";
const LegalPolicyPage = lazy(() => import("@/pages/legal/legal-policy-page"));
const LegalHistoryPage = lazy(() => import("@/pages/admin/legal-history"));

function RouteLoading() {
  return <div role="status" data-testid="status-route-loading" className="text-center p-8">Loading page...</div>;
}

// Custom route for the launch page - rendered outside main layout without any navigation
function LaunchPageRoute() {
  // Completely full-screen with no other app elements
  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-black z-50">
      <ErrorBoundary>
        <Suspense fallback={<RouteLoading />}><LaunchPage /></Suspense>
      </ErrorBoundary>
    </div>
  );
}

function Router() {
  useInternalNavigation(import.meta.env.BASE_URL);
  // Check URL to determine if we're on the launch page
  const [location] = useLocation();
  const isLaunchPage = location === '/launch';
  
  // If we're on the launch page, render only the launch page without regular layout
  if (isLaunchPage) {
    return <LegalConsentGate><LaunchPageRoute /></LegalConsentGate>;
  }
  
  // Otherwise render the regular app layout
  return (
    <LegalConsentGate>
    <div className="min-h-screen relative flex flex-col">
      <BackgroundVideo 
        videoUrl="/static/videos/BackgroundVideo.mp4"
      />
      <div className="relative z-10 bg-transparent flex-grow flex flex-col">
        <NavBar />
        <main className="container mx-auto px-4 py-4 md:py-8 flex-grow">
          <ErrorBoundary key={location}>
          <Suspense fallback={<RouteLoading />}>
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
            <Route path="/forum/category/:categoryId" component={ForumCategoryRedirect} />
            <Route path="/forum/post/:postId" component={ForumPostPage} />
            <ProtectedRoute path="/forum/new-post" component={NewPostPage} requiredFeature="FORUM" />
            <ProtectedRoute path="/forum/edit-post/:postId" component={EditPostPage} requiredFeature="FORUM" />
            <Route path="/amenities" component={AmenitiesPage} />
            <Route path="/banner" component={BannerPage} />
            <Route path="/weather" component={WeatherPage} />
            {/* User Settings Routes */}
            <ProtectedRoute path="/profile" component={ProfileSettings} />
            <ProtectedRoute path="/subscriptions" component={SubscriptionsPage} />
             <ProtectedRoute path="/copyright-notices" component={CopyrightNoticesPage} />
             <ProtectedRoute path="/copyright-notices/:caseNumber" component={CopyrightNoticeDetailPage} />
             <ProtectedRoute path="/copyright-notices/:caseNumber/counter-notice" component={CounterNoticePage} />
            <Route path="/subscription-test" component={SubscriptionTestPage} />
            {/* Subscription Flow Pages */}
            <Route path="/subscription/success" component={SubscriptionSuccessPage} />
            <Route path="/subscription/error" component={SubscriptionErrorPage} />
            <Route path="/subscription/cancelled" component={SubscriptionCancelledPage} />
            <ProtectedRoute path="/community-settings" component={CommunitySettings} />
            <ProtectedRoute path="/advanced-settings" component={AdvancedSettings} />
            {/* Chat Interface - New messaging system */}
            <Route path="/messaging" component={ChatPage} />
            <Route path="/messages" component={ChatPage} />
            <Route path="/chat" component={ChatPage} />
            <Route path="/contact-us" component={ContactUsPage} />
            <Route path="/forms/:slug" component={FormPage} />
            
            {/* Admin Routes - All require admin access */}
            <ProtectedRoute path="/admin" component={AdminDashboard} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/moderated-posts" component={ModeratedPosts} />
            <ProtectedRoute path="/admin/dmca" component={DmcaDashboard} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/dmca/new" component={DmcaNewCase} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/dmca/cases/:id" component={DmcaCaseDetail} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/dmca/holds" component={DmcaLegalHolds} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/dmca/repeat-infringers" component={DmcaRepeatInfringers} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/dmca/settings" component={DmcaSettings} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/dmca/permissions" component={DmcaPermissions} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/version-fix" component={VersionFixPage} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/products" component={ProductManagementPage} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/orders" component={OrderManagementPage} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/returns" component={ManageReturnsPage} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/product-image-test" component={ProductImageTest} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/form-submissions" component={FormSubmissionsAdmin} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/legal-history" component={LegalHistoryPage} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/manage-pages" component={ManagePagesAdmin} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/manage-vendors" component={ManageVendorsAdmin} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/manage-forum" component={ManageForumCategories} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/community-categories" component={ManageCommunityCategoriesPage} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/messages" component={AdminMessagesPage} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/analytics" component={AnalyticsDashboard} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/email-activity" component={EmailActivityPage} requiredFeature="ADMIN" />
            <ProtectedRoute path="/admin/on-the-market-emails" component={OnTheMarketEmailsPage} requiredFeature="ADMIN" />

            <ProtectedRoute path="/admin/manage-listings" component={ManageListingsPage} requiredFeature="ADMIN" />
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
              return <Redirect to="/analytics-dashboard" replace />;
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
              return <Redirect to={`/community/${params.category}`} replace />;
            }} />
            <Route path="/more/:category/:page" component={({ params }) => {
              // Redirect from /more/category/page to /community/category/page
              return <Redirect to={`/community/${params.category}/${params.page}`} replace />;
            }} />
            
            {/* Terms & Privacy pages */}
            <Route path="/terms" component={() => <LegalPolicyPage policyKey="terms" />} />
            <Route path="/privacy" component={() => <LegalPolicyPage policyKey="privacy" />} />
            <Route path="/dmca" component={DMCAPolicyPage} />
            <Route path="/dmca/notice" component={DMCANoticePage} />
            <Route path="/dmca/status/:token" component={DMCAStatusPage} />
            
            {/* Dedicated routes for Vendors pages */}
            <ProtectedRoute path="/vendors" component={() => <GenericContentPage slug="vendors-main" />} requiredFeature="VENDORS" />
            
            {/* Special redirects for malformed vendor URLs with "services-" prefix */}
            <Route path="/vendors/home/services-:vendor" component={({ params }) => {
              const vendor = params.vendor;
              console.log(`Redirecting from malformed URL /vendors/home/services-${vendor} to correct URL /vendors/home-services/${vendor}`);
              return <Redirect to={`/vendors/home-services/${vendor}`} replace />;
            }} />
            
            {/* Additional special case for /vendors/home-services/services-vendor-name */}
            <Route path="/vendors/home-services/services-:vendor" component={({ params }) => {
              const vendor = params.vendor;
              console.log(`Handling duplicated services prefix: /vendors/home-services/services-${vendor} → /vendors/home-services/${vendor}`);
              return <Redirect to={`/vendors/home-services/${vendor}`} replace />;
            }} />

            {/* Special handling for compound categories that get split incorrectly */}
            <Route path="/vendors/home/services/:vendor" component={({ params }) => {
              const vendor = params.vendor;
              console.log(`Handling incorrectly split category: /vendors/home/services/${vendor} → /vendors/home-services/${vendor}`);
              return <Redirect to={`/vendors/home-services/${vendor}`} replace />;
            }} />
            
            {/* Special handling for technology-and-electronics that gets split incorrectly */}
            <Route path="/vendors/technology/and-electronics-:vendor" component={({ params }) => {
              const vendor = params.vendor;
              console.log(`Handling incorrectly split technology category: /vendors/technology/and-electronics-${vendor} → /vendors/technology-and-electronics/${vendor}`);
              return <Redirect to={`/vendors/technology-and-electronics/${vendor}`} replace />;
            }} />
            
            {/* Special handling for technology-and-electronics that gets split incorrectly */}
            <Route path="/vendors/technology/and-electronics/:vendor" component={({ params }) => {
              const vendor = params.vendor;
              console.log(`Handling incorrectly split technology category: /vendors/technology/and-electronics/${vendor} → /vendors/technology-and-electronics/${vendor}`);
              return <Redirect to={`/vendors/technology-and-electronics/${vendor}`} replace />;
            }} />
            
            {/* Universal handler for all vendor pages with undefined vendor */}
            <Route path="/vendors/:category/undefined" component={({ params }) => {
              const category = params.category;
              console.log(`Fixing undefined vendor URL in category: ${category}`);
              // Redirect back to category listing page
              const fixedUrl = `/vendors/${category}`.replace(/\/\//g, '/');
              console.log(`Redirecting to fixed URL: ${fixedUrl}`);
              return <Redirect to={fixedUrl} replace />;
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
              return <Redirect to={`/vendors/${part1}-and-${part2}/${vendor}`} replace />;
            }} />
            
            {/* Generic redirect for compound categories with "and" that get split differently */}
            <Route path="/vendors/:part1/and-:part2/:vendor" component={({ params }: any) => {
              const part1 = params.part1;
              const part2 = params.part2;
              const vendor = params.vendor;
              console.log(`Handling split "and" compound category: /vendors/${part1}/and-${part2}/${vendor} → /vendors/${part1}-and-${part2}/${vendor}`);
              return <Redirect to={`/vendors/${part1}-and-${part2}/${vendor}`} replace />;
            }} />
            
            {/* Generic redirect for other categories that might have the same issue */}
            <Route path="/vendors/:part1/services-:vendor" component={({ params }: any) => {
              const part1 = params.part1;
              const vendor = params.vendor;
              if (part1 !== 'home-services' && part1 !== 'home') {
                console.log(`Redirecting from malformed URL /vendors/${part1}/services-${vendor} to correct URL /vendors/${part1}-services/${vendor}`);
                return <Redirect to={`/vendors/${part1}-services/${vendor}`} replace />;
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
                  return <Redirect to={`/vendors/${correctCategory}/${vendor}`} replace />;
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
            <Route path="/analytics-access" component={AnalyticsStandalone} />
            
            {/* Banner diagnostic tool - publicly accessible */}
            <Route path="/banner-diagnostic" component={BannerDiagnostic} />
            
            {/* Object Storage debugging tool - admin access */}
            <ProtectedRoute path="/admin/object-storage-debug" component={ObjectStorageDebugPage} requiredFeature="ADMIN" />
            
            <Route component={() => <NotFound />} />
          </Switch>
          </Suspense>
          </ErrorBoundary>
        </main>
        <Footer />
      </div>
      <ViewAsSwitcher />
    </div>
    </LegalConsentGate>
  );
}

// Regular router is already properly handling launch page via LaunchPageRoute
function AppRouter() {
  return <Router />;
}

function App() {
  useEffect(() => installUnreadInvalidation(queryClient), []);
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