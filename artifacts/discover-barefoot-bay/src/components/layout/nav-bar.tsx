import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  Settings,
  Users,
  Shield,
  ShoppingBag,
  Package,
  MoreHorizontal,
  Building,
  AlertTriangle,
  CreditCard,
  Info,
  Store,
  Leaf,
  Car,
  Heart,
  RotateCcw,
  RefreshCcw,
  Home,
  User,
  Briefcase,
  ThermometerSun,
  MessageSquare,
  Menu,
  Star,
  X,
} from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { useFlags } from "@/hooks/use-flags";
import { UserAvatar } from "@/components/shared/user-avatar";
import { WeatherWidget } from "@/components/shared/weather-widget";
import { RocketLaunchViewer } from "@/components/shared/rocket-launch-viewer";
import { LiveChatBubble } from "@/components/shared/live-chat-bubble";
import { NavigationTooltipProvider } from "@/contexts/navigation-tooltip-context";
import { ForumBadge } from "@/components/shared/forum-badge";
import { StoreBadge } from "@/components/shared/store-badge";
import { ForSaleBadge } from "@/components/shared/for-sale-badge";
import { VendorBadge } from "@/components/shared/vendor-badge";
import { VendorCategoryBadge } from "@/components/shared/vendor-category-badge";
import { useVendorCategoryCounts } from "@/hooks/use-vendor-category-counts";
import { MobileMenu } from "./mobile-menu";
import { 
  FaHome, FaBriefcase, FaLeaf, FaStore, FaUtensils, FaCar, FaWrench, 
  FaHammer, FaPaintBrush, FaShoppingCart, FaWater, FaSwimmingPool,
  FaFaucet, FaTree, FaTools, FaGlassCheers, FaDog, FaShoppingBag,
  FaUserTie, FaTruck, FaLaptop, FaBuilding, FaWifi, FaStar, FaEnvelope,
  FaPhone, FaKey, FaTv, FaAt, FaBook, FaClinicMedical, FaPaw,
  FaGraduationCap, FaImage, FaCamera, FaLandmark, FaCarAlt, FaGlobe, 
  FaBicycle, FaMotorcycle, FaHeart, FaClipboardCheck, 
  
  // Additional icons for community categories
  FaCity, FaClipboardCheck as FaClipboardList, FaBalanceScale, FaBullhorn,
  FaMountain, FaSeedling, FaThermometerHalf, FaUmbrellaBeach,
  FaHospital, FaTooth, FaHouseUser, FaCouch, FaTaxi, FaTrain,
  FaSubway, FaPlane, FaComments, FaHandsHelping, FaVihara, FaRunning,
  FaGolfBall, FaDesktop, FaMobileAlt as FaMobile, FaNetworkWired, 
  FaMicrochip, FaPowerOff, FaAmbulance, FaFireExtinguisher, 
  FaShieldAlt, FaHeartbeat, FaUniversity as FaBank,
  
  // Additional icon sets
  // Recreation & Activities
  FaSwimmer, FaHiking, FaBiking, FaFish, FaCampground, FaDumbbell, 
  FaVolleyballBall, FaTableTennis, FaBasketballBall, FaFootballBall, 
  FaGolfBall as FaGolf, FaBaseballBall, FaChess, FaGuitar, 
  FaGamepad, FaTheaterMasks, FaTicketAlt, FaMusic, FaPuzzlePiece,
  
  // Weather & Seasons
  FaSnowflake, FaCloudRain, FaCloudSunRain, FaWind, FaUmbrella, FaCloud, 
  FaCloudSun, FaCloudMoon, FaSun as FaSunIcon, FaMoon, FaRainbow,
  
  // Food & Dining
  FaCoffee, FaCocktail, FaWineGlass, FaBeer, FaIceCream, FaPizzaSlice, 
  FaHamburger, FaCheese, FaCookie, FaAppleAlt, FaCarrot, FaEgg,
  
  // Communication & Media
  FaNewspaper, FaVideo, FaHeadphones, FaPodcast, FaMicrophone, FaRadio, 
  FaInbox, FaMailBulk, FaPrint, FaRss, FaCommentDots, FaCommentAlt,
  
  // Finance & Business  
  FaCreditCard, FaMoneyBillWave, FaPiggyBank, FaChartLine, FaChartBar, 
  FaPercentage, FaReceipt, FaFileInvoiceDollar, FaHandHoldingUsd, FaStore as FaStorefront,
  
  // Personal & Lifestyle
  FaBed, FaShower, FaSoap, FaToilet, FaToothbrush, FaBath, FaHotTub, 
  FaUmbrellaBeach as FaBeach, FaSpa, FaMasksTheater, FaGem, FaGift, 
  FaTshirt, FaSocks, FaShirt, FaGlasses,
  
  // Time & Scheduling  
  FaClock, FaRegClock, FaCalendarAlt, FaCalendarDay, FaCalendarWeek, 
  FaHourglassHalf, FaStopwatch, FaBell, FaRegBell,
  
  // Direction & Location
  FaMapMarkedAlt, FaMap, FaCompass, FaDirections, FaLocationArrow, 
  FaSearchLocation, FaRoute, FaMapSigns, FaStreetView
} from "react-icons/fa";

export function NavBar() {
  const { user, logoutMutation } = useAuth();
  const { isAdmin } = usePermissions();
  const { 
    isCalendarEnabled, 
    isForumEnabled, 
    isForSaleEnabled, 
    isStoreEnabled, 
    isVendorsEnabled, 
    isCommunityEnabled 
  } = useFlags();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showMarkReadX, setShowMarkReadX] = useState(false);
  
  const queryClient = useQueryClient();
  const { countsByCategory } = useVendorCategoryCounts();
  
  // Fetch messages and count unread ones - using same logic as Messages page
  const { data: messagesData } = useQuery({
    queryKey: ['/api/messages'],
    enabled: !!user,
    refetchInterval: 5000, // Refresh every 5 seconds
    staleTime: 0, // Always fetch fresh data - no caching
    refetchOnWindowFocus: true, // Refresh when window regains focus
    refetchOnMount: true, // Always refetch on mount
    retry: 2, // Retry failed requests up to 2 times
    onError: (error: any) => {
      console.error('Error fetching messages for unread count:', error);
    }
  });
  
  // Count unread messages including replies - same logic as Messages page
  const unreadMessagesCount = messagesData ? (() => {
    let count = 0;
    (messagesData as any[]).forEach(message => {
      // Check if thread has any unread messages (main message or any replies) - same logic as MessageList
      const hasReplies = message.replies && Array.isArray(message.replies) && message.replies.length > 0;
      const hasUnreadInThread = !message.read || (hasReplies && message.replies.some((reply: any) => !reply.read));
      
      if (hasUnreadInThread) {
        count++;
      }
    });
    return count;
  })() : 0;
  
  // Debug log for troubleshooting notification issues
  console.log('Unread messages count:', unreadMessagesCount);
  
  // Mutation to mark all messages as read
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/messages/mark-all-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark messages as read');
      }
      
      return response.json();
    },
    onMutate: async () => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['/api/messages'] });
      
      // Snapshot the previous value for rollback
      const previousMessages = queryClient.getQueryData(['/api/messages']);
      
      // Optimistically update the cache - mark all messages as read
      queryClient.setQueryData(['/api/messages'], (oldData: any) => {
        if (!oldData || !Array.isArray(oldData)) return oldData;
        
        return oldData.map(message => ({
          ...message,
          read: true,
          replies: message.replies ? message.replies.map((reply: any) => ({
            ...reply,
            read: true
          })) : []
        }));
      });
      
      // Reset the X mode state immediately
      setShowMarkReadX(false);
      
      return { previousMessages };
    },
    onSuccess: (data) => {
      console.log('Successfully marked all messages as read:', data);
      // Don't invalidate immediately - let the optimistic update persist
      // The query will naturally refetch on its interval (5 seconds)
      // This prevents the badge from reappearing immediately after clicking X
    },
    onError: (error, variables, context) => {
      console.error('Error marking all messages as read:', error);
      // Rollback optimistic update
      if (context?.previousMessages) {
        queryClient.setQueryData(['/api/messages'], context.previousMessages);
      }
      // Reset the X mode state on error too
      setShowMarkReadX(false);
    }
  });
  
  // Handle badge click - switch to X mode on desktop, mark all read on mobile
  const handleBadgeClick = (e: React.MouseEvent) => {
    console.log('🔴 Badge clicked!', { showMarkReadX, unreadMessagesCount });
    e.preventDefault();
    e.stopPropagation();
    if (unreadMessagesCount > 0) {
      const isMobile = window.innerWidth < 768;
      console.log('🔴 Device check:', { isMobile, width: window.innerWidth });
      // On mobile, directly mark all as read
      if (isMobile) {
        console.log('🔴 Mobile: marking all as read');
        markAllReadMutation.mutate();
      } else {
        // On desktop, switch to X mode
        console.log('🔴 Desktop: switching to X mode');
        setShowMarkReadX(true);
      }
    }
  };
  
  // Handle X click - mark all as read (desktop only)
  const handleMarkAllRead = (e: React.MouseEvent) => {
    console.log('🔴 X clicked!');
    e.preventDefault();
    e.stopPropagation();
    markAllReadMutation.mutate();
  };
  
  // Handle hover for desktop - show X mode
  const handleBadgeHover = () => {
    const isDesktop = window.innerWidth >= 768;
    console.log('🔴 Badge hover:', { isDesktop, unreadMessagesCount, showMarkReadX });
    if (isDesktop && unreadMessagesCount > 0) {
      console.log('🔴 Desktop hover: switching to X mode');
      setShowMarkReadX(true);
    }
  };
  
  // Handle mouse leave for desktop - hide X mode
  const handleBadgeLeave = () => {
    const isDesktop = window.innerWidth >= 768;
    console.log('🔴 Badge leave:', { isDesktop });
    if (isDesktop) {
      console.log('🔴 Desktop leave: hiding X mode');
      setShowMarkReadX(false);
    }
  };
  
  // Fetch vendor categories from the database (filtered to non-hidden ones)
  const { data: vendorCategories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['/api/vendor-categories'],
    staleTime: 1000 * 60, // 1 minute - reduced stale time to stay more responsive to admin changes
    select: (data: any) => {
      // Check if data is an array before using it
      if (!Array.isArray(data)) {
        console.error("Expected vendor categories data to be an array, but got:", typeof data);
        return [];
      }
      return data;
    },
  });
  
  // Fetch community pages to use in the dropdown menu
  const { data: communityPages } = useQuery({
    queryKey: ['/api/pages'],
    staleTime: 1000 * 60 * 5, // 5 minutes
    select: (data: any) => {
      if (!Array.isArray(data)) {
        console.error("Expected pages data to be an array, but got:", typeof data);
        return [];
      }
      return data;
    },
  });

  // Fetch community categories from the database to display in the administrator defined order
  const { data: communityCategories } = useQuery({
    queryKey: ['/api/community-categories'],
    staleTime: 1000 * 60 * 5, // 5 minutes
    select: (data: any) => {
      if (!Array.isArray(data)) {
        console.error("Expected community categories data to be an array, but got:", typeof data);
        return [];
      }
      // The backend already sorts by the order field, but we can ensure it here too
      return data.sort((a, b) => a.order - b.order);
    },
  });

  // Fetch the flat list of social clubs (page_contents rows whose slug starts
  // with `social-`) for the dedicated Social Clubs nav tab. The endpoint
  // already returns the list sorted alphabetically by title.
  const { data: socialClubs, isLoading: isLoadingSocialClubs } = useQuery({
    queryKey: ['/api/social-clubs'],
    staleTime: 1000 * 60 * 5, // 5 minutes
    select: (data: any) => {
      if (!Array.isArray(data)) {
        console.error("Expected social clubs data to be an array, but got:", typeof data);
        return [];
      }
      return data;
    },
  });

  // Helper function to get pages for a specific category
  // Uses the database 'category' field to match pages to categories
  const getPagesForCategory = (categorySlug: string) => {
    if (!communityPages || !Array.isArray(communityPages)) return [];
    
    // Extract the first part of the category slug (before any dash)
    // e.g., "government-regulations" -> "government"
    const categoryPrefix = categorySlug.split('-')[0];
    
    // Filter pages that belong to this category
    return communityPages.filter(page => {
      if (!page) return false;
      
      // Match using the page's category field
      if (page.category) {
        return page.category === categoryPrefix;
      }
      
      // Fallback: match by slug prefix
      if (page.slug) {
        return page.slug.startsWith(`${categoryPrefix}-`);
      }
      
      return false;
    }).sort((a, b) => {
      // Sort by order field, defaulting to MAX_SAFE_INTEGER if not set
      const orderA = a.order !== null && a.order !== undefined ? a.order : Number.MAX_SAFE_INTEGER;
      const orderB = b.order !== null && b.order !== undefined ? b.order : Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });
  };
  
  // Helper function to render category icon
  const renderCategoryIcon = (iconName: string | undefined, categoryName: string) => {
    // If we have an icon name from the database, render it
    if (iconName) {
      const iconMap: { [key: string]: JSX.Element } = {
        'FaBuilding': <FaBuilding className="h-4 w-4" />,
        'FaLandmark': <FaLandmark className="h-4 w-4" />,
        'FaCity': <FaCity className="h-4 w-4" />,
        'FaBook': <FaBook className="h-4 w-4" />,
        'FaClipboardCheck': <FaClipboardCheck className="h-4 w-4" />,
        'FaBalanceScale': <FaBalanceScale className="h-4 w-4" />,
        'FaBullhorn': <FaBullhorn className="h-4 w-4" />,
        'FaGlobe': <FaGlobe className="h-4 w-4" />,
        'FaLeaf': <FaLeaf className="h-4 w-4" />,
        'FaTree': <FaTree className="h-4 w-4" />,
        'FaWater': <FaWater className="h-4 w-4" />,
        'FaMountain': <FaMountain className="h-4 w-4" />,
        'FaSeedling': <FaSeedling className="h-4 w-4" />,
        'FaThermometerHalf': <FaThermometerHalf className="h-4 w-4" />,
        'FaUmbrellaBeach': <FaUmbrellaBeach className="h-4 w-4" />,
        'FaSun': <FaStar className="h-4 w-4" />,
        'FaStore': <FaStore className="h-4 w-4" />,
        'FaUtensils': <FaUtensils className="h-4 w-4" />,
        'FaShoppingCart': <FaShoppingCart className="h-4 w-4" />,
        'FaHospital': <FaHospital className="h-4 w-4" />,
        'FaTooth': <FaTooth className="h-4 w-4" />,
        'FaClinicMedical': <FaClinicMedical className="h-4 w-4" />,
        'FaGraduationCap': <FaGraduationCap className="h-4 w-4" />,
        'FaBank': <FaBank className="h-4 w-4" />,
        'FaHome': <FaHome className="h-4 w-4" />,
        'FaHouseUser': <FaHouseUser className="h-4 w-4" />,
        'FaTools': <FaTools className="h-4 w-4" />,
        'FaHammer': <FaHammer className="h-4 w-4" />,
        'FaWrench': <FaWrench className="h-4 w-4" />,
        'FaPaintBrush': <FaPaintBrush className="h-4 w-4" />,
        'FaCouch': <FaCouch className="h-4 w-4" />,
        'FaKey': <FaKey className="h-4 w-4" />,
        'FaCar': <FaCar className="h-4 w-4" />,
        'FaCarAlt': <FaCarAlt className="h-4 w-4" />,
        'FaTruck': <FaTruck className="h-4 w-4" />,
        'FaTaxi': <FaTaxi className="h-4 w-4" />,
        'FaBus': <FaSubway className="h-4 w-4" />,
        'FaTrain': <FaTrain className="h-4 w-4" />,
        'FaBicycle': <FaBicycle className="h-4 w-4" />,
        'FaPlane': <FaPlane className="h-4 w-4" />,
        'FaUsers': <FaComments className="h-4 w-4" />,
        'FaHeart': <FaHeart className="h-4 w-4" />,
        'FaHandsHelping': <FaHandsHelping className="h-4 w-4" />,
        'FaDog': <FaDog className="h-4 w-4" />,
        'FaPaw': <FaPaw className="h-4 w-4" />,
        'FaVihara': <FaVihara className="h-4 w-4" />,
        'FaRunning': <FaRunning className="h-4 w-4" />,
        'FaFootballBall': <FaGolfBall className="h-4 w-4" />,
        'FaDesktop': <FaDesktop className="h-4 w-4" />,
        'FaMobile': <FaMobile className="h-4 w-4" />,
        'FaWifi': <FaWifi className="h-4 w-4" />,
        'FaTv': <FaTv className="h-4 w-4" />,
        'FaLaptop': <FaLaptop className="h-4 w-4" />,
        'FaNetworkWired': <FaNetworkWired className="h-4 w-4" />,
        'FaMicrochip': <FaMicrochip className="h-4 w-4" />,
        'FaPowerOff': <FaPowerOff className="h-4 w-4" />,
        'FaAmbulance': <FaAmbulance className="h-4 w-4" />,
        'FaFireExtinguisher': <FaFireExtinguisher className="h-4 w-4" />,
        'FaShieldAlt': <FaShieldAlt className="h-4 w-4" />,
        'FaHeartbeat': <FaHeartbeat className="h-4 w-4" />,
      };
      
      return iconMap[iconName] || <Info className="h-4 w-4" />;
    }
    
    // Fallback to name-based icon selection
    const name = categoryName.toLowerCase();
    if (name.includes('government')) return <Building className="h-4 w-4" />;
    if (name.includes('safety')) return <AlertTriangle className="h-4 w-4" />;
    if (name.includes('information')) return <Info className="h-4 w-4" />;
    if (name.includes('weather') || name.includes('environment')) return <ThermometerSun className="h-4 w-4" />;
    if (name.includes('nature')) return <Leaf className="h-4 w-4" />;
    if (name.includes('transport')) return <Car className="h-4 w-4" />;
    if (name.includes('religion')) return <Heart className="h-4 w-4" />;
    if (name.includes('service')) return <Store className="h-4 w-4" />;
    return <Info className="h-4 w-4" />;
  };

  return (
    <div className="nav-container">
      <nav className="bg-white bg-opacity-0 z-50">
        <div className="container mx-auto px-4 xl:px-8 h-20 xl:h-32 flex items-center justify-between">
          <div className="flex items-center">
            <Link href="/">
              <div className="flex items-center cursor-pointer">
                <img 
                  src="/assets/DiscoverBFBText.png" 
                  alt="Discover Barefoot Bay"
                  className="h-16 xl:h-24 w-auto"
                />
              </div>
            </Link>
            <NavigationTooltipProvider>
              <div className="ml-2 sm:ml-4 flex items-center gap-1 sm:gap-2 md:gap-3">
                <RocketLaunchViewer />
                <WeatherWidget />
                <LiveChatBubble />
              </div>
            </NavigationTooltipProvider>
          </div>

          {/* Mobile menu button - shows more aggressively when signed out to prevent crowding */}
          <button 
            className={`${!user ? '2xl:hidden' : 'xl:hidden'} p-2 text-navy focus:outline-none`}
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu size={28} />
          </button>

          {/* Desktop menu - only shows on very large screens when signed out to preserve logo/rocket visibility */}
          <div className={`${!user ? 'hidden 2xl:flex' : 'hidden xl:flex'} items-center gap-3 xl:gap-4 2xl:gap-5`}>
            {/* Calendar navigation item */}
            {isCalendarEnabled() && (
              <Link href="/calendar">
                <span className={`text-navy hover:text-coral transition-colors font-advent-pro cursor-pointer ${!user ? 'text-xl px-1 py-1' : 'text-2xl px-2 py-1'}`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                  Calendar
                </span>
              </Link>
            )}
            
            {/* Forum navigation item */}
            {isForumEnabled() && (
              <Link href="/forum">
                <div className="relative">
                  <span className={`text-navy hover:text-coral transition-colors font-advent-pro cursor-pointer ${!user ? 'text-xl px-1 py-1' : 'text-2xl px-2 py-1'}`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                    Extra! Extra!
                  </span>
                  <ForumBadge />
                </div>
              </Link>
            )}
            
            {/* For Sale navigation item */}
            {isForSaleEnabled() && (
              <div className="relative">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <span className={`text-navy hover:text-coral transition-colors font-advent-pro cursor-pointer ${!user ? 'text-xl px-1 py-1' : 'text-2xl px-2 py-1'} relative`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                      For Sale
                    </span>
                  </DropdownMenuTrigger>
                <DropdownMenuContent className="dropdown-menu-content w-56 bg-white border border-navy/20 p-4 shadow-lg">
                  <Link href="/for-sale">
                    <DropdownMenuItem className="hover:bg-coral/10 hover:text-coral focus:bg-coral/10 focus:text-coral py-2">
                      <Home className="mr-2 h-4 w-4" />
                      <span>All Listings</span>
                    </DropdownMenuItem>
                  </Link>
                  {user && (
                    <Link href="/my-listings">
                      <DropdownMenuItem className="hover:bg-coral/10 hover:text-coral focus:bg-coral/10 focus:text-coral py-2 mt-1">
                        <User className="mr-2 h-4 w-4" />
                        <span>My Listings</span>
                      </DropdownMenuItem>
                    </Link>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <ForSaleBadge />
            </div>
            )}
            
            {/* Store navigation item */}
            {isStoreEnabled() && (
              <div className="relative">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <span className={`text-navy hover:text-coral transition-colors font-advent-pro cursor-pointer ${!user ? 'text-xl px-1 py-1' : 'text-2xl px-2 py-1'} relative`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                      Store
                    </span>
                  </DropdownMenuTrigger>
                <DropdownMenuContent className="dropdown-menu-content w-56 bg-white border border-navy/20 p-4 shadow-lg">
                  <Link href="/store">
                    <DropdownMenuItem className="hover:bg-coral/10 hover:text-coral focus:bg-coral/10 focus:text-coral py-2">
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      <span>Browse Products</span>
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/store/track-order">
                    <DropdownMenuItem className="hover:bg-coral/10 hover:text-coral focus:bg-coral/10 focus:text-coral py-2 mt-1">
                      <Package className="mr-2 h-4 w-4" />
                      <span>Track Your Order</span>
                    </DropdownMenuItem>
                  </Link>
                </DropdownMenuContent>
              </DropdownMenu>
              <StoreBadge />
            </div>
            )}
            
            {/* Vendors navigation item */}
            {isVendorsEnabled() && (
              <div className="relative">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <span className={`text-navy hover:text-coral transition-colors font-advent-pro cursor-pointer ${!user ? 'text-xl px-1 py-1' : 'text-2xl px-2 py-1'}`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                      Vendors
                    </span>
                  </DropdownMenuTrigger>
                <DropdownMenuContent className="dropdown-menu-content w-56 bg-white border border-navy/20 p-4 shadow-lg max-h-[70vh] overflow-y-auto overflow-x-hidden">
                  {/* Always show the "All Preferred Vendors" option at the top */}
                  <Link href="/vendors">
                    <DropdownMenuItem className="hover:bg-coral/10 hover:text-coral focus:bg-coral/10 focus:text-coral py-2">
                      <Star className="mr-2 h-4 w-4" />
                      <span>All Preferred Vendors</span>
                    </DropdownMenuItem>
                  </Link>
                  
                  {/* Show dynamic vendor categories loaded from database */}
                  {vendorCategories && Array.isArray(vendorCategories) && vendorCategories.length > 0 ? (
                    vendorCategories
                      // Filter out hidden categories in the navigation menu
                      .filter(category => !category.isHidden)
                      .sort((a, b) => a.order - b.order) // Sort by order field
                      .map((category) => (
                        <Link key={category.id} href={`/vendors/${category.slug}`}>
                          <DropdownMenuItem className="hover:bg-coral/10 hover:text-coral focus:bg-coral/10 focus:text-coral py-2 mt-1 flex items-center justify-between w-full">
                            <div className="flex items-center">
                              {(() => {
                                if (category.icon) {
                                  switch(category.icon) {
                                    case 'home': return <FaHome className="mr-2 h-4 w-4" />;
                                    case 'store': return <FaStore className="mr-2 h-4 w-4" />;
                                    case 'leaf': return <FaLeaf className="mr-2 h-4 w-4" />;
                                    case 'briefcase': return <FaBriefcase className="mr-2 h-4 w-4" />;
                                    case 'food': return <FaUtensils className="mr-2 h-4 w-4" />;
                                    case 'car': return <FaCar className="mr-2 h-4 w-4" />;
                                    case 'wrench': return <FaWrench className="mr-2 h-4 w-4" />;
                                    case 'hammer': return <FaHammer className="mr-2 h-4 w-4" />;
                                    case 'paint': return <FaPaintBrush className="mr-2 h-4 w-4" />;
                                    case 'shopping': return <FaShoppingCart className="mr-2 h-4 w-4" />;
                                    case 'water': return <FaWater className="mr-2 h-4 w-4" />;
                                    case 'pool': return <FaSwimmingPool className="mr-2 h-4 w-4" />;
                                    case 'plumbing': return <FaFaucet className="mr-2 h-4 w-4" />;
                                    case 'lawn': return <FaTree className="mr-2 h-4 w-4" />;
                                    case 'tools': return <FaTools className="mr-2 h-4 w-4" />;
                                    case 'entertainment': return <FaGlassCheers className="mr-2 h-4 w-4" />;
                                    case 'pets': return <FaDog className="mr-2 h-4 w-4" />;
                                    case 'retail': return <FaShoppingBag className="mr-2 h-4 w-4" />;
                                    case 'professional': return <FaUserTie className="mr-2 h-4 w-4" />;
                                    case 'delivery': return <FaTruck className="mr-2 h-4 w-4" />;
                                    case 'tech': return <FaLaptop className="mr-2 h-4 w-4" />;
                                    case 'realestate': return <FaBuilding className="mr-2 h-4 w-4" />;
                                    case 'internet': return <FaWifi className="mr-2 h-4 w-4" />;
                                    case 'star': return <FaStar className="mr-2 h-4 w-4" />;
                                    case 'health': return <FaClinicMedical className="mr-2 h-4 w-4" />;
                                    case 'education': return <FaGraduationCap className="mr-2 h-4 w-4" />;
                                    case 'photo': return <FaCamera className="mr-2 h-4 w-4" />;
                                    case 'banking': return <FaLandmark className="mr-2 h-4 w-4" />;
                                    case 'travel': return <FaGlobe className="mr-2 h-4 w-4" />;
                                    default: return <FaStore className="mr-2 h-4 w-4" />;
                                  }
                                }
                                if (category.name.toLowerCase().includes('home')) {
                                  return <Home className="mr-2 h-4 w-4" />;
                                } else if (category.name.toLowerCase().includes('landscap')) {
                                  return <Leaf className="mr-2 h-4 w-4" />;
                                } else if (category.name.toLowerCase().includes('contract') || 
                                           category.name.toLowerCase().includes('professional')) {
                                  return <Briefcase className="mr-2 h-4 w-4" />;
                                } else {
                                  return <Store className="mr-2 h-4 w-4" />;
                                }
                              })()}
                              <span>{category.name}</span>
                            </div>
                            <VendorCategoryBadge count={countsByCategory[category.slug] || 0} />
                          </DropdownMenuItem>
                        </Link>
                      ))
                  ) : (
                    <>
                      {/* Fallback for when categories aren't loaded yet */}
                      <Link href="/vendors/home-service">
                        <DropdownMenuItem className="hover:bg-coral/10 hover:text-coral focus:bg-coral/10 focus:text-coral py-2 mt-1">
                          <Home className="mr-2 h-4 w-4" />
                          <span>Home Service</span>
                        </DropdownMenuItem>
                      </Link>
                      <Link href="/vendors/landscaping">
                        <DropdownMenuItem className="hover:bg-coral/10 hover:text-coral focus:bg-coral/10 focus:text-coral py-2 mt-1">
                          <Leaf className="mr-2 h-4 w-4" />
                          <span>Landscaping</span>
                        </DropdownMenuItem>
                      </Link>
                      <Link href="/vendors/professional-services">
                        <DropdownMenuItem className="hover:bg-coral/10 hover:text-coral focus:bg-coral/10 focus:text-coral py-2 mt-1">
                          <Briefcase className="mr-2 h-4 w-4" />
                          <span>Professional Services</span>
                        </DropdownMenuItem>
                      </Link>
                    </>
                  )}
                  
                  {/* Admin-only manage button */}
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator className="my-2 border-t border-navy/10" />
                      <Link href="/admin/manage-vendors">
                        <DropdownMenuItem className="text-white bg-coral hover:bg-white hover:text-coral focus:bg-white focus:text-coral border border-transparent hover:border-navy/20 py-2 rounded mt-1 transition-colors">
                          <Settings className="mr-2 h-4 w-4" />
                          <span className="font-medium">Manage</span>
                        </DropdownMenuItem>
                      </Link>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <VendorBadge />
            </div>
            )}

            {/* Social Clubs navigation item — gated on the Community feature
                flag so the existing admin toggle still controls everything in
                the Community family. The dropdown lists every social club
                returned by /api/social-clubs (the same flat list the rest of
                the app already uses), so admins keep full control over which
                clubs appear by editing the underlying page_contents rows. */}
            {isCommunityEnabled() && (
              <div className="relative">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <span
                      className={`text-navy hover:text-coral transition-colors font-advent-pro cursor-pointer ${!user ? 'text-xl px-1 py-1' : 'text-2xl px-2 py-1'}`}
                      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
                      data-testid="nav-social-clubs-trigger"
                    >
                      Clubs
                    </span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="dropdown-menu-content w-64 bg-white border border-navy/20 p-4 shadow-lg max-h-[70vh] overflow-y-auto overflow-x-hidden">
                    {/* Always show the "All Social Clubs" landing-page link at the top */}
                    <Link href="/community/social">
                      <DropdownMenuItem
                        className="hover:bg-coral/10 hover:text-coral focus:bg-coral/10 focus:text-coral py-2"
                        data-testid="nav-social-clubs-all"
                      >
                        <Users className="mr-2 h-4 w-4" />
                        <span>All Social Clubs</span>
                      </DropdownMenuItem>
                    </Link>
                    <DropdownMenuSeparator className="my-2 border-t border-navy/10" />

                    {/* Show every club returned by the existing endpoint */}
                    {socialClubs && Array.isArray(socialClubs) && socialClubs.length > 0 ? (
                      socialClubs.map((club: { id: number; slug: string; title: string }) => {
                        const clubSlug = club.slug.replace(/^social-/, '');
                        const href = `/community/social/${clubSlug}`;
                        return (
                          <Link key={club.id} href={href}>
                            <DropdownMenuItem
                              className="hover:bg-coral/10 hover:text-coral focus:bg-coral/10 focus:text-coral py-2"
                              data-testid={`nav-social-clubs-item-${clubSlug}`}
                            >
                              <span>{club.title}</span>
                            </DropdownMenuItem>
                          </Link>
                        );
                      })
                    ) : isLoadingSocialClubs ? (
                      <p className="text-navy/50 italic text-sm p-2">Loading clubs...</p>
                    ) : (
                      <p className="text-navy/50 italic text-sm p-2">No clubs available.</p>
                    )}

                    {/* Admin-only manage button */}
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator className="my-2 border-t border-navy/10" />
                        <Link href="/admin/manage-pages">
                          <DropdownMenuItem
                            className="text-white bg-coral hover:bg-white hover:text-coral focus:bg-white focus:text-coral border border-transparent hover:border-navy/20 py-2 rounded mt-1 transition-colors"
                            data-testid="nav-social-clubs-manage"
                          >
                            <Settings className="mr-2 h-4 w-4" />
                            <span className="font-medium">Manage Social Clubs</span>
                          </DropdownMenuItem>
                        </Link>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Community navigation item */}
            {isCommunityEnabled() && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <span className={`text-navy hover:text-coral transition-colors font-advent-pro cursor-pointer flex items-center ${!user ? 'text-xl px-1 py-1' : 'text-2xl px-2 py-1'}`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                    Community
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="dropdown-menu-content community-dropdown w-72 bg-white border border-navy/20 p-4 shadow-lg [&_li]:text-navy [&_li]:transition-colors [&_li]:rounded-sm [&_li]:cursor-pointer [&_li]:py-1 [&_.my-2]:border-navy/10 max-h-[70vh] overflow-y-auto overflow-x-hidden">
                
                  {communityCategories && Array.isArray(communityCategories) && communityCategories.length > 0 ? (
                    // Map through the categories sorted by their order field.
                    // The "Social Clubs" category has been promoted to its own
                    // top-level nav tab, so filter it out here to avoid showing
                    // it in two places. The DB row and admin config are
                    // intentionally untouched.
                    communityCategories
                      .filter((category) => category.slug !== 'social-clubs-86-clubs')
                      .map((category, index) => (
                      <div key={category.id}>
                        {/* Add separator between categories */}
                        {index > 0 && <DropdownMenuSeparator className="my-2 border-t border-navy/10" />}
                        
                        <DropdownMenuGroup>
                          {/* Category header with icon */}
                          <div className="mb-2">
                            <Link href={`/community/${category.slug.split('-')[0]}`}>
                              <div className="flex items-center cursor-pointer hover:text-coral transition-colors">
                                <div className="mr-2">
                                  {renderCategoryIcon(category.icon, category.name)}
                                </div>
                                <span className="font-bold">{category.name}</span>
                              </div>
                            </Link>
                          </div>
                          
                          {/* Dynamically render all pages for this category */}
                          {(() => {
                            const categoryPages = getPagesForCategory(category.slug);
                            const categoryPrefix = category.slug.split('-')[0];
                            
                            return categoryPages.length > 0 && (
                              <div className="pl-6 mb-4 space-y-2">
                                {categoryPages.map((page) => {
                                  // Construct the page URL
                                  const pageSlug = page.slug.replace(`${categoryPrefix}-`, '');
                                  const pageUrl = `/community/${categoryPrefix}/${pageSlug}`;
                                  
                                  return (
                                    <Link key={page.id} href={pageUrl}>
                                      <DropdownMenuItem className="hover:bg-coral/10 hover:text-coral focus:bg-coral/10 focus:text-coral">
                                        {page.title}
                                      </DropdownMenuItem>
                                    </Link>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </DropdownMenuGroup>
                      </div>
                    ))
                  ) : (
                    <p className="text-navy/50 italic text-sm p-2">Loading community categories...</p>
                  )}
                  
                  {/* Admin-only manage button */}
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator className="my-2 border-t border-navy/10" />
                      <Link href="/admin/manage-pages">
                        <DropdownMenuItem className="text-white bg-coral hover:bg-white hover:text-coral focus:bg-white focus:text-coral border border-transparent hover:border-navy/20 py-2 rounded mt-1 transition-colors">
                          <Settings className="mr-2 h-4 w-4" />
                          <span className="font-medium">Manage Pages</span>
                        </DropdownMenuItem>
                      </Link>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {/* User menu */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="h-9 w-9 rounded-full cursor-pointer">
                    <UserAvatar 
                      user={user} 
                      className="h-full w-full" 
                      inNavbar={true}
                      unreadMessages={unreadMessagesCount}
                    />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="dropdown-menu-content w-56 bg-white border border-navy/20 p-4 shadow-lg">
                  <div className="flex flex-col items-center mb-4">
                    <span className="font-medium text-navy text-lg mb-1">{user.fullName || user.username}</span>
                    {user.email && <span className="text-sm text-navy/60">{user.email}</span>}
                  </div>
                  
                  <DropdownMenuItem className="hover:bg-coral/10 hover:text-coral focus:bg-coral/10 focus:text-coral py-2">
                    <Link href="/profile" className="flex items-center w-full">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem className="hover:bg-coral/10 hover:text-coral focus:bg-coral/10 focus:text-coral py-2 mt-1 relative">
                    <div className="flex items-center w-full justify-between">
                      <Link href="/messages" className="flex items-center">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        <span>Messages</span>
                      </Link>
                      {unreadMessagesCount > 0 && (
                        <div 
                          className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium text-white cursor-pointer transition-colors z-50 ${
                            showMarkReadX ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'
                          }`}
                          onClick={showMarkReadX ? handleMarkAllRead : handleBadgeClick}
                          onMouseEnter={handleBadgeHover}
                          onMouseLeave={handleBadgeLeave}
                          title={showMarkReadX ? 'Click to mark all messages as read' : 'Click to mark all messages as read'}
                        >
                          {showMarkReadX ? (
                            <X className="h-3 w-3" />
                          ) : (
                            unreadMessagesCount > 99 ? "99+" : unreadMessagesCount
                          )}
                        </div>
                      )}
                    </div>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem className="hover:bg-coral/10 hover:text-coral focus:bg-coral/10 focus:text-coral py-2 mt-1">
                    <Link href="/subscriptions" className="flex items-center w-full">
                      <CreditCard className="mr-2 h-4 w-4" />
                      <span>Sponsorship</span>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem className="hover:bg-coral/10 hover:text-coral focus:bg-coral/10 focus:text-coral py-2 mt-1">
                    <Link href="/contact-us" className="flex items-center w-full">
                      <MessageSquare className="mr-2 h-4 w-4" />
                      <span>Contact Us</span>
                    </Link>
                  </DropdownMenuItem>
                  
                  {isAdmin && (
                    <DropdownMenuItem className="hover:bg-coral/10 hover:text-coral focus:bg-coral/10 focus:text-coral py-2 mt-1">
                      <Link href="/admin" className="flex items-center w-full">
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Admin Dashboard</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  
                  <DropdownMenuSeparator className="my-2 border-t border-navy/10" />
                  
                  <DropdownMenuItem 
                    onClick={() => logoutMutation.mutate()} 
                    className="hover:bg-red-50 hover:text-red-500 focus:bg-red-50 focus:text-red-500 text-red-500/90 py-2 mt-1 cursor-pointer"
                  >
                    Log Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Button 
                  asChild
                  variant="link" 
                  className="text-navy hover:text-coral font-medium transition-colors font-advent-pro text-lg p-0"
                >
                  <Link href="/auth">
                    Log In
                  </Link>
                </Button>
                <Button 
                  asChild
                  className="bg-coral hover:bg-coral/90 text-white font-medium transition-colors font-advent-pro text-lg px-4 py-1 h-auto"
                >
                  <Link href="/auth?tab=register">
                    Sign Up
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </nav>
      
      {/* Mobile menu */}
      <MobileMenu 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)}
        isAdmin={isAdmin}
      />
    </div>
  );
}