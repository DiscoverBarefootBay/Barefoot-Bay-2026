import React, { useState } from "react";
import { Menu, X, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useFlags } from "@/hooks/use-flags";
import { UserAvatar } from "@/components/shared/user-avatar";
import { StoreBadge } from "@/components/shared/store-badge";
import { ForSaleBadge } from "@/components/shared/for-sale-badge";
import { ForumBadge } from "@/components/shared/forum-badge";
import { VendorBadge } from "@/components/shared/vendor-badge";
import { VendorCategoryBadge } from "@/components/shared/vendor-category-badge";
import { useVendorCategoryCounts } from "@/hooks/use-vendor-category-counts";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

export function MobileMenu({ isOpen, onClose, isAdmin }: MobileMenuProps) {
  const { user, logoutMutation, effectiveRole } = useAuth();
  const { isAdmin: hasAdminPermission } = usePermissions();
  const { countsByCategory } = useVendorCategoryCounts();
  
  // Check if we're viewing as a guest (or not logged in)
  const isViewingAsGuest = effectiveRole === 'guest' || !user;
  const { 
    isCalendarEnabled, 
    isForumEnabled, 
    isForSaleEnabled, 
    isStoreEnabled, 
    isVendorsEnabled, 
    isCommunityEnabled 
  } = useFlags();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  
  // Fetch messages and count unread ones - using same logic as Messages page
  const { data: messagesData } = useQuery({
    queryKey: ['/api/messages'],
    enabled: !isViewingAsGuest,
    refetchInterval: 5000, // Refresh every 5 seconds
    staleTime: 0, // Always fetch fresh data - no caching
    refetchOnWindowFocus: true, // Refresh when window regains focus
    refetchOnMount: true, // Always refetch on mount
    retry: 2 // Retry failed requests up to 2 times
  });
  
  // Count unread messages including replies - same logic as Messages page
  const unreadMessagesCount = messagesData ? (() => {
    let count = 0;
    (messagesData as any[]).forEach(message => {
      // Count the main message if unread
      if (message.read === false) {
        count++;
      }
      // Count unread replies
      if (message.replies && message.replies.length > 0) {
        const unreadReplies = message.replies.filter((reply: any) => reply.read === false).length;
        count += unreadReplies;
      }
    });
    return count;
  })() : 0;
  
  // Fetch vendor categories directly from the API
  const { data: vendorCategories } = useQuery({
    queryKey: ['/api/vendor-categories'],
    staleTime: 1000 * 60, // 1 minute - shorter stale time to stay more up-to-date with changes
    select: (data: any) => {
      if (!Array.isArray(data)) {
        console.error("Expected vendor categories data to be an array, but got:", typeof data);
        return [];
      }
      return data;
    },
  });
  
  // Fetch community pages to use in the menu
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
  const { data: communityCategoriesData } = useQuery({
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

  // Fetch the flat list of social clubs for the dedicated Social Clubs nav
  // tab. Mirrors the desktop nav-bar query so both surfaces show the same
  // alphabetised, non-hidden list returned by /api/social-clubs.
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

  // Helper function to get pages with a specific category prefix
  // Helper function to get pages for a category
  // Now uses the database 'category' field first, then falls back to slug checking
  const getPagesForCategory = (prefix: string) => {
    if (!communityPages || !Array.isArray(communityPages)) return [];
    
    // Map between category slugs in community_categories and actual category values in page_contents
    const categoryMapping: {[key: string]: string} = {
      'local-services': 'services',
      'government-regulations': 'government',
      'community-information': 'community',
      'nature-environment': 'nature',
      'transportation-accessibility': 'transportation',
      'religion-community': 'religion',
      'safety-emergency-service': 'safety'
    };
    
    // Get the simple category name from either the mapping or the original prefix
    const targetCategory = categoryMapping[prefix] || prefix;
    
    // Filter based on the explicit category field in the database
    return communityPages.filter(page => {
      // For safety pages, we use completely hardcoded links, so exclude them 
      if ((page.category === 'safety' || page.id === 17 || page.id === 18 || page.id === 19) && 
          prefix !== 'safety-emergency-service' && prefix !== 'safety') {
        return false;
      }
      
      // For other categories, use the category field we populated in the database
      if (page.category) {
        return page.category === targetCategory;
      }
      
      // Fallback to the old slug-based filtering if category isn't populated
      return page.slug && (
        page.slug.startsWith(`${targetCategory}-`) || 
        page.slug.startsWith(`${prefix}-`)
      );
    });
  };
  
  // Special standalone function to render ONLY the 3 safety items for mobile menu
  const renderSafetyItemsMobile = (onCloseMenu: () => void) => {
    return (
      <div className="pl-2 space-y-2" id="mobile-safety-menu-items">
        <Link href="/community/safety/contacts" onClick={onCloseMenu}>
          <div className="py-1 text-navy hover:text-coral">
            Important Contacts (Sheriff, Fire, Medical)
          </div>
        </Link>
        <Link href="/community/safety/pet-rules" onClick={onCloseMenu}>
          <div className="py-1 text-navy hover:text-coral">
            Pet Rules/Safety
          </div>
        </Link>
        <Link href="/community/safety/crime" onClick={onCloseMenu}>
          <div className="py-1 text-navy hover:text-coral">
            Crimes & Reports
          </div>
        </Link>
      </div>
    );
  };
  
  const toggleMenu = (menuName: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuName]: !prev[menuName]
    }));
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Mobile menu panel */}
      <div className="relative w-4/5 max-w-sm bg-white h-full overflow-y-auto p-6 shadow-lg transform transition-transform duration-300">
        {/* Header with close button */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-navy">Menu</h2>
          <button className="p-1 rounded-full hover:bg-gray-100" onClick={onClose}>
            <X size={24} className="text-navy" />
          </button>
        </div>
        
        {/* User section (if logged in and not viewing as guest) */}
        {!isViewingAsGuest && user && (
          <div className="mb-6 pb-6 border-b border-gray-200">
            <div className="flex items-center space-x-3 mb-4">
              {/* Add UserAvatar component */}
              <UserAvatar 
                user={{
                  username: user.username,
                  avatarUrl: user.avatarUrl,
                  isResident: user.isResident,
                  role: user.role,
                  hasMembershipBadge: user.hasMembershipBadge ?? false,
                  subscriptionStatus: user.subscriptionStatus || undefined,
                  createdAt: user.createdAt ? (user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt)) : new Date().toISOString()
                }} 
                size="lg"
                className="flex-shrink-0" 
                inNavbar={false}
                inMobileMenu={true}
                unreadMessages={unreadMessagesCount}
              />
              <div className="flex flex-col min-w-0 flex-1">
                <div className="font-medium text-navy text-lg mb-1 truncate">
                  {user.fullName || user.username}
                </div>
                {user.email && (
                  <div className="text-sm text-gray-500 truncate">{user.email}</div>
                )}
              </div>
            </div>
            
            <div className="mt-4 space-y-2">
              <Link href="/profile" onClick={onClose}>
                <div className="py-2 text-navy hover:text-coral">Profile</div>
              </Link>
              
              <Link href="/messages" onClick={onClose}>
                <div className="py-2 text-navy hover:text-coral flex items-center justify-between">
                  <span>Messages</span>
                  {unreadMessagesCount > 0 && (
                    <div className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-medium text-white">
                      {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
                    </div>
                  )}
                </div>
              </Link>
              
              <Link href="/subscriptions" onClick={onClose}>
                <div className="py-2 text-navy hover:text-coral">Sponsorship</div>
              </Link>
              
              <Link href="/contact-us" onClick={onClose}>
                <div className="py-2 text-navy hover:text-coral">Contact Us</div>
              </Link>
              
              {isAdmin && (
                <Link href="/admin" onClick={onClose}>
                  <div className="py-2 text-navy hover:text-coral">Admin Dashboard</div>
                </Link>
              )}
              
              <button 
                onClick={() => {
                  logoutMutation.mutate();
                  onClose();
                }}
                className="w-full text-left py-2 text-red-500 hover:text-red-700"
              >
                Log Out
              </button>
            </div>
          </div>
        )}
        
        {/* Login button for guests or non-logged in users */}
        {isViewingAsGuest && (
          <div className="mb-6 pb-6 border-b border-gray-200 flex justify-center">
            <Link href="/auth" onClick={onClose}>
              <Button 
                className="h-14 w-14 rounded-full bg-coral hover:bg-coral/90 text-white p-0 flex items-center justify-center"
                data-testid="button-mobile-login"
              >
                <Plus size={28} strokeWidth={2.5} />
              </Button>
            </Link>
          </div>
        )}
        
        {/* Navigation links */}
        <div className="space-y-4">
          {/* Main navigation */}
          <Link href="/" onClick={onClose}>
            <div className="py-2 text-navy hover:text-coral font-medium">Home</div>
          </Link>
          
          {/* Calendar */}
          {isCalendarEnabled() && (
            <Link href="/calendar" onClick={onClose}>
              <div className="py-2 text-navy hover:text-coral font-medium">Calendar</div>
            </Link>
          )}
          
          {/* Forum */}
          {isForumEnabled() && (
            <Link href="/forum" onClick={onClose}>
              <div className="py-2 text-navy hover:text-coral font-medium flex items-center justify-between">
                <span>Extra! Extra!</span>
                <ForumBadge inMobileMenu />
              </div>
            </Link>
          )}
          
          {/* Store dropdown */}
          {isStoreEnabled() && (
            <div className="space-y-2">
              <div 
                className="py-2 text-navy hover:text-coral font-medium cursor-pointer flex items-center justify-between"
                onClick={() => toggleMenu('store')}
              >
                <div className="flex items-center gap-2">
                  <span>Store</span>
                  <StoreBadge inMobileMenu />
                </div>
                {expandedMenus['store'] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </div>
              
              {expandedMenus['store'] && (
                <div className="py-2 px-4 space-y-3 bg-gray-50 rounded-md mt-1">
                  <Link href="/store" onClick={onClose}>
                    <div className="py-1 text-navy hover:text-coral">Browse Products</div>
                  </Link>
                  <Link href="/store/track-order" onClick={onClose}>
                    <div className="py-1 text-navy hover:text-coral">Track Your Order</div>
                  </Link>
                </div>
              )}
            </div>
          )}
          
          {/* For Sale dropdown */}
          {isForSaleEnabled() && (
            <div className="space-y-2">
              <div 
                className="py-2 text-navy hover:text-coral font-medium cursor-pointer flex items-center justify-between"
                onClick={() => toggleMenu('forSale')}
              >
                <div className="flex items-center gap-2">
                  <span>On The Market</span>
                  <ForSaleBadge inMobileMenu />
                </div>
                {expandedMenus['forSale'] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </div>
              
              {expandedMenus['forSale'] && (
                <div className="py-2 px-4 space-y-3 bg-gray-50 rounded-md mt-1">
                  <Link href="/for-sale" onClick={onClose}>
                    <div className="py-1 text-navy hover:text-coral">All Listings</div>
                  </Link>
                  {!isViewingAsGuest && (
                    <Link href="/my-listings" onClick={onClose}>
                      <div className="py-1 text-navy hover:text-coral">My Listings</div>
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Vendors dropdown */}
          {isVendorsEnabled() && (
            <div className="space-y-2">
              <div 
                className="py-2 text-navy hover:text-coral font-medium cursor-pointer flex items-center justify-between"
                onClick={() => toggleMenu('vendors')}
              >
                <div className="flex items-center gap-2">
                  <span>Vendors</span>
                  <VendorBadge inMobileMenu />
                </div>
                {expandedMenus['vendors'] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </div>
              
              {expandedMenus['vendors'] && (
                <div className="py-2 px-4 space-y-3 bg-gray-50 rounded-md mt-1 max-h-[50vh] overflow-y-auto">
                  <Link href="/vendors" onClick={onClose}>
                    <div className="py-1 text-navy hover:text-coral">All Preferred Vendors</div>
                  </Link>
                  
                  {vendorCategories && Array.isArray(vendorCategories) && vendorCategories.length > 0 ? (
                    vendorCategories
                      .filter(category => !category.isHidden)
                      .sort((a, b) => a.order - b.order)
                      .map((category) => (
                        <Link key={category.id} href={`/vendors/${category.slug}`} onClick={onClose}>
                          <div className="py-1 text-navy hover:text-coral flex items-center justify-between">
                            <span>{category.name}</span>
                            <VendorCategoryBadge count={countsByCategory[category.slug] || 0} />
                          </div>
                        </Link>
                      ))
                  ) : (
                    <>
                      <Link href="/vendors/home-service" onClick={onClose}>
                        <div className="py-1 text-navy hover:text-coral">Home Service</div>
                      </Link>
                      <Link href="/vendors/landscaping" onClick={onClose}>
                        <div className="py-1 text-navy hover:text-coral">Landscaping</div>
                      </Link>
                      <Link href="/vendors/professional-services" onClick={onClose}>
                        <div className="py-1 text-navy hover:text-coral">Professional Services</div>
                      </Link>
                    </>
                  )}
                  
                  {isAdmin && (
                    <Link href="/admin/manage-vendors" onClick={onClose}>
                      <div className="py-1 text-navy hover:text-coral font-medium">Manage Vendors</div>
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Social Clubs dropdown — gated on the Community feature flag so the
              existing admin toggle still controls everything in the Community
              family. Lists every social club returned by /api/social-clubs in
              the same alphabetical order the rest of the app uses. */}
          {isCommunityEnabled() && (
            <div className="space-y-2">
              <div
                className="py-2 text-navy hover:text-coral font-medium cursor-pointer flex items-center justify-between"
                onClick={() => toggleMenu('socialClubs')}
                data-testid="mobile-nav-social-clubs-trigger"
              >
                <span>Clubs</span>
                {expandedMenus['socialClubs'] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </div>

              {expandedMenus['socialClubs'] && (
                <div className="py-2 px-4 space-y-3 bg-gray-50 rounded-md mt-1 max-h-[50vh] overflow-y-auto">
                  <Link href="/community/social" onClick={onClose}>
                    <div
                      className="py-1 text-navy hover:text-coral"
                      data-testid="mobile-nav-social-clubs-all"
                    >
                      All Social Clubs
                    </div>
                  </Link>

                  {socialClubs && Array.isArray(socialClubs) && socialClubs.length > 0 ? (
                    socialClubs.map((club: { id: number; slug: string; title: string }) => {
                      const clubSlug = club.slug.replace(/^social-/, '');
                      const href = `/community/social/${clubSlug}`;
                      return (
                        <Link key={club.id} href={href} onClick={onClose}>
                          <div
                            className="py-1 text-navy hover:text-coral"
                            data-testid={`mobile-nav-social-clubs-item-${clubSlug}`}
                          >
                            {club.title}
                          </div>
                        </Link>
                      );
                    })
                  ) : isLoadingSocialClubs ? (
                    <div className="py-1 text-navy/50 italic text-sm">Loading clubs...</div>
                  ) : (
                    <div className="py-1 text-navy/50 italic text-sm">No clubs available.</div>
                  )}

                  {isAdmin && (
                    <Link href="/admin/manage-pages" onClick={onClose}>
                      <div
                        className="py-1 text-navy hover:text-coral font-medium"
                        data-testid="mobile-nav-social-clubs-manage"
                      >
                        Manage Social Clubs
                      </div>
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Community dropdown */}
          {isCommunityEnabled() && (
            <div className="space-y-2">
              <div 
                className="py-2 text-navy hover:text-coral font-medium cursor-pointer flex items-center justify-between"
                onClick={() => toggleMenu('community')}
              >
                <span>Community</span>
                {expandedMenus['community'] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </div>
              
              {expandedMenus['community'] && (
                <div className="py-2 px-4 space-y-3 bg-gray-50 rounded-md mt-1 mb-2 max-h-[40vh] overflow-y-auto">
                  {communityCategoriesData && Array.isArray(communityCategoriesData) && communityCategoriesData.length > 0 ? (
                    // Map through the categories sorted by their order field.
                    // The "Social Clubs" category has been promoted to its own
                    // top-level nav tab, so filter it out here to avoid showing
                    // it in two places. The DB row and admin config are
                    // intentionally untouched.
                    communityCategoriesData
                      .filter((category) => category.slug !== 'social-clubs-86-clubs')
                      .map((category, index) => (
                      <div key={category.id}>
                        {/* Add separator between categories */}
                        {index > 0 && <div className="border-t border-gray-200 my-3"></div>}
                        
                        <div className="mb-2">
                          {/* Make the category header clickable */}
                          <Link 
                            href={`/community/${category.slug.split('-')[0]}`} 
                            onClick={onClose}
                          >
                            <div className="font-bold py-2 text-navy hover:text-coral cursor-pointer transition-colors">
                              {category.name}
                            </div>
                          </Link>
                          
                          {/* Links for Government & Regulation */}
                          {((category.slug && category.slug.startsWith('government')) || 
                            (category.name && (category.name.includes('Government') || category.name.includes('Regulation')))) && (
                            <div className="pl-2 space-y-2">
                              {/* Render all government pages dynamically from the database and sort by order */}
                              {getPagesForCategory('government-regulations')
                                .sort((a, b) => {
                                  const orderA = a.order !== null && a.order !== undefined ? a.order : Number.MAX_SAFE_INTEGER;
                                  const orderB = b.order !== null && b.order !== undefined ? b.order : Number.MAX_SAFE_INTEGER;
                                  return orderA - orderB;
                                })
                                .map((page) => (
                                  <Link key={page.id} href={`/community/government/${page.slug.replace('government-', '')}`} onClick={onClose}>
                                    <div className="py-1 text-navy hover:text-coral">{page.title}</div>
                                  </Link>
                                ))
                              }
                            </div>
                          )}
                          
                          {/* Links for Safety & Emergency Services */}
                          {((category.slug && category.slug.startsWith('safety')) || 
                            (category.name && category.name.includes('Safety & Emergency'))) && (
                            <div className="pl-2 space-y-2">
                              {/* Get safety-related pages from database and respect their order */}
                              {getPagesForCategory('safety-emergency-service')
                                .sort((a, b) => (a.order || 0) - (b.order || 0))
                                .map((page) => (
                                  <Link key={page.id} href={`/community/safety/${page.slug.replace('safety-', '')}`} onClick={onClose}>
                                    <div className="py-1 text-navy hover:text-coral">{page.title}</div>
                                  </Link>
                                ))
                              }
                              
                              {/* If no safety pages were found in the database, fall back to hardcoded links */}
                              {getPagesForCategory('safety-emergency-service').length === 0 && (
                                <>
                                  <Link href="/community/safety/contacts" onClick={onClose}>
                                    <div className="py-1 text-navy hover:text-coral">
                                      Important Contacts (Sheriff, Fire, Medical)
                                    </div>
                                  </Link>
                                  <Link href="/community/safety/pet-rules" onClick={onClose}>
                                    <div className="py-1 text-navy hover:text-coral">
                                      Pet Rules/Safety
                                    </div>
                                  </Link>
                                  <Link href="/community/safety/crime" onClick={onClose}>
                                    <div className="py-1 text-navy hover:text-coral">
                                      Crimes & Reports
                                    </div>
                                  </Link>
                                </>
                              )}
                            </div>
                          )}
                          
                          {/* Links for Community Information */}
                          {((category.slug && category.slug.startsWith('community')) || 
                            (category.name && category.name.includes('Community Information'))) && (
                            <div className="pl-2 space-y-2">
                              {/* Render all community information pages dynamically and sort by order */}
                              {getPagesForCategory('community-information')
                                .sort((a, b) => {
                                  const orderA = a.order !== null && a.order !== undefined ? a.order : Number.MAX_SAFE_INTEGER;
                                  const orderB = b.order !== null && b.order !== undefined ? b.order : Number.MAX_SAFE_INTEGER;
                                  return orderA - orderB;
                                })
                                .map((page) => (
                                  <Link key={page.id} href={`/community/community/${page.slug.replace('community-', '')}`} onClick={onClose}>
                                    <div className="py-1 text-navy hover:text-coral">{page.title}</div>
                                  </Link>
                                ))
                              }
                            </div>
                          )}
                          
                          {/* Links for Local Services & Resources */}
                          {((category.slug && category.slug.startsWith('service')) || 
                            (category.name && category.name.includes('Local Services'))) && (
                            <div className="pl-2 space-y-2">
                              {/* Render all local services pages dynamically and sort by order */}
                              {getPagesForCategory('local-services')
                                .sort((a, b) => {
                                  const orderA = a.order !== null && a.order !== undefined ? a.order : Number.MAX_SAFE_INTEGER;
                                  const orderB = b.order !== null && b.order !== undefined ? b.order : Number.MAX_SAFE_INTEGER;
                                  return orderA - orderB;
                                })
                                .map((page) => (
                                  <Link key={page.id} href={`/community/services/${page.slug.replace('services-', '')}`} onClick={onClose}>
                                    <div className="py-1 text-navy hover:text-coral">{page.title}</div>
                                  </Link>
                                ))
                              }
                            </div>
                          )}
                          
                          {/* Links for Nature & Environment */}
                          {((category.slug && category.slug.startsWith('nature')) || 
                            (category.name && (category.name.includes('Nature & Environment')))) && (
                            <div className="pl-2 space-y-2">
                              {/* Render all nature pages dynamically and sort by order */}
                              {getPagesForCategory('nature-environment')
                                .sort((a, b) => {
                                  const orderA = a.order !== null && a.order !== undefined ? a.order : Number.MAX_SAFE_INTEGER;
                                  const orderB = b.order !== null && b.order !== undefined ? b.order : Number.MAX_SAFE_INTEGER;
                                  return orderA - orderB;
                                })
                                .map((page) => (
                                  <Link key={page.id} href={`/community/nature/${page.slug.replace('nature-', '')}`} onClick={onClose}>
                                    <div className="py-1 text-navy hover:text-coral">{page.title}</div>
                                  </Link>
                                ))
                              }
                              
                              {/* Also render amenities pages */}
                              {getPagesForCategory('amenities')
                                .sort((a, b) => {
                                  const orderA = a.order !== null && a.order !== undefined ? a.order : Number.MAX_SAFE_INTEGER;
                                  const orderB = b.order !== null && b.order !== undefined ? b.order : Number.MAX_SAFE_INTEGER;
                                  return orderA - orderB;
                                })
                                .map((page) => (
                                  <Link key={page.id} href={`/community/amenities/${page.slug.replace('amenities-', '')}`} onClick={onClose}>
                                    <div className="py-1 text-navy hover:text-coral">{page.title}</div>
                                  </Link>
                                ))
                              }
                            </div>
                          )}
                          
                          {/* Links for Transportation & Accessibility */}
                          {((category.slug && category.slug.startsWith('transport')) || 
                            (category.name && category.name.includes('Transportation & Accessibility'))) && (
                            <div className="pl-2 space-y-2">
                              {/* Render all transportation pages dynamically and sort by order */}
                              {getPagesForCategory('transportation-accessibility')
                                .sort((a, b) => {
                                  const orderA = a.order !== null && a.order !== undefined ? a.order : Number.MAX_SAFE_INTEGER;
                                  const orderB = b.order !== null && b.order !== undefined ? b.order : Number.MAX_SAFE_INTEGER;
                                  return orderA - orderB;
                                })
                                .map((page) => (
                                  <Link key={page.id} href={`/community/transportation/${page.slug.replace('transportation-', '')}`} onClick={onClose}>
                                    <div className="py-1 text-navy hover:text-coral">{page.title}</div>
                                  </Link>
                                ))
                              }
                            </div>
                          )}
                          
                          {/* Links for Religion & Community Engagement */}
                          {((category.slug && category.slug.startsWith('religion')) || 
                            (category.name && category.name.includes('Religion & Community'))) && (
                            <div className="pl-2 space-y-2">
                              {/* Render all religion pages dynamically and sort by order */}
                              {getPagesForCategory('religion-community')
                                .sort((a, b) => {
                                  const orderA = a.order !== null && a.order !== undefined ? a.order : Number.MAX_SAFE_INTEGER;
                                  const orderB = b.order !== null && b.order !== undefined ? b.order : Number.MAX_SAFE_INTEGER;
                                  return orderA - orderB;
                                })
                                .map((page) => (
                                  <Link key={page.id} href={`/community/religion/${page.slug.replace('religion-', '')}`} onClick={onClose}>
                                    <div className="py-1 text-navy hover:text-coral">{page.title}</div>
                                  </Link>
                                ))
                              }
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-navy/50 italic text-sm p-2">Loading community categories...</p>
                  )}
                  
                  {isAdmin && (
                    <Link href="/admin/manage-pages" onClick={onClose}>
                      <div className="py-1 text-navy hover:text-coral font-medium mt-2">Manage Pages</div>
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Login/Register for guest users */}
          {!user && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="mb-6">
                <Link href="/auth" onClick={onClose} className="block w-full">
                  <Button variant="outline" className="w-full justify-center py-6 text-lg">
                    Log In
                  </Button>
                </Link>
              </div>
              <div>
                <Link href="/auth?tab=register" onClick={onClose} className="block w-full">
                  <Button className="w-full justify-center py-6 text-lg">
                    Sign Up
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}