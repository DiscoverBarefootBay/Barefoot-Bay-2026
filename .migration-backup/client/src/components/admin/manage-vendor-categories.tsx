import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import { Loader2, Edit, Trash2, Plus, MoveUp, MoveDown, EyeOff, Eye, Home, Store, Leaf, Briefcase, Star } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  // Core business icons
  FaHome, FaBriefcase, FaLeaf, FaStore, FaUtensils, FaCar, FaWrench, 
  FaHammer, FaPaintBrush, FaShoppingCart, FaWater, FaSwimmingPool,
  FaFaucet, FaTree, FaTools, FaGlassCheers, FaDog, FaShoppingBag,
  FaUserTie, FaTruck, FaLaptop, FaBuilding, FaWifi, FaStar, 
  
  // Communication icons
  FaEnvelope, FaPhone, FaAt, FaComments, FaMobileAlt as FaMobile, FaHeadset, FaVideo,
  FaComment, FaComments as FaSms, FaPrint, FaFax, FaBullhorn,
  
  // Home and property services
  FaKey, FaHouseUser, FaChair, FaCouch, FaBed, FaToilet, FaBath,
  FaTemperatureHigh, FaArchway, FaDoorOpen, FaFan, FaSnowflake,
  FaThermometerHalf, FaTrash, FaRecycle, FaCity, FaFireExtinguisher,
  FaLightbulb, 
  
  // Food and Entertainment
  FaBirthdayCake, FaWineGlass, FaCocktail, FaPizzaSlice, FaBeer, FaCoffee,
  FaIceCream, FaHamburger, FaMusic, FaTheaterMasks, FaGamepad, FaFilm, 
  FaTv, FaFlask, FaBowlingBall, FaFish, FaDrumstickBite,
  
  // Health and wellness
  FaHospital, FaAmbulance, FaTooth, FaEye, FaHeartbeat, FaRunning,
  FaWeightHanging, FaYinYang, FaBook, FaClinicMedical, FaPills, FaNotesMedical,
  
  // Personal and professional services
  FaPaw, FaBabyCarriage, FaGraduationCap, FaImage, FaCamera, FaLandmark,
  FaCarAlt, FaGlobe, FaBicycle, FaMotorcycle, FaHeart, FaClipboardCheck,
  FaCut, FaChartLine, FaMoneyBillWave, FaShieldAlt, FaBalanceScale,
  FaUniversity as FaBank, FaIndustry, FaPencilAlt, FaHandsHelping, FaCreditCard,
  
  // Home decor and design
  FaPalette, FaRulerCombined, FaSwatchbook, FaChessBoard, FaVectorSquare,
  FaDraftingCompass, FaLayerGroup, FaGem,
  
  // Outdoor and recreation
  FaUmbrella, FaHiking, FaSwimmer, FaCampground, FaSkiing, FaSeedling,
  FaMountain, FaVolleyballBall, FaHorseHead, FaSkating, FaFutbol, FaGolfBall,
  
  // Technology
  FaMicrochip, FaRobot, FaDesktop, FaPowerOff, FaServer, FaNetworkWired, 
  FaDatabase, FaCodeBranch, FaMobileAlt, FaTabletAlt, FaMemory, FaSatelliteDish,
  FaSitemap, FaKeyboard, FaMouse, FaBluetoothB, FaSdCard,
  
  // Various additional services
  FaPassport, FaPlane, FaParachuteBox, FaTshirt, FaGlasses, FaUmbrellaBeach,
  FaSnowboarding, FaVihara, FaShip, FaTrain, FaSubway, FaTaxi,
  FaParking, FaTicketAlt, FaGift, FaTag
} from "react-icons/fa";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { slugify } from "@/lib/slug-utils";

// Define TypeScript types
type VendorCategory = {
  id: number;
  name: string;
  slug: string;
  icon?: string;
  order: number;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
};

type CategoryFormData = {
  name: string;
  slug: string;
  icon?: string;
  order: number;
  isHidden?: boolean;
};

// Define available icons with their components for the picker
const ICON_OPTIONS = [
  // Business Categories
  { id: "home", label: "Home", component: FaHome },
  { id: "store", label: "Store", component: FaStore },
  { id: "leaf", label: "Landscaping", component: FaLeaf },
  { id: "briefcase", label: "Business", component: FaBriefcase },
  { id: "food", label: "Food & Dining", component: FaUtensils },
  { id: "car", label: "Automotive", component: FaCar },
  { id: "wrench", label: "Repair", component: FaWrench },
  { id: "hammer", label: "Construction", component: FaHammer },
  { id: "paint", label: "Painting", component: FaPaintBrush },
  { id: "shopping", label: "Shopping", component: FaShoppingCart },
  { id: "water", label: "Water Service", component: FaWater },
  { id: "pool", label: "Pool Service", component: FaSwimmingPool },
  { id: "plumbing", label: "Plumbing", component: FaFaucet },
  { id: "lawn", label: "Lawn Care", component: FaTree },
  { id: "tools", label: "Handyman", component: FaTools },
  { id: "entertainment", label: "Entertainment", component: FaGlassCheers },
  { id: "pets", label: "Pet Services", component: FaDog },
  { id: "retail", label: "Retail", component: FaShoppingBag },
  { id: "professional", label: "Professional", component: FaUserTie },
  { id: "delivery", label: "Delivery", component: FaTruck },
  { id: "tech", label: "Technology", component: FaLaptop },
  { id: "realestate", label: "Real Estate", component: FaBuilding },
  { id: "internet", label: "Internet", component: FaWifi },
  { id: "star", label: "Featured", component: FaStar },
  { id: "health", label: "Healthcare", component: FaClinicMedical },
  { id: "education", label: "Education", component: FaGraduationCap },
  { id: "photo", label: "Photography", component: FaCamera },
  { id: "banking", label: "Financial", component: FaLandmark },
  { id: "travel", label: "Travel", component: FaGlobe },
  
  // Specific Home Services
  { id: "cleaning", label: "Cleaning", component: FaSwimmingPool },
  { id: "hvac", label: "HVAC", component: FaTemperatureHigh },
  { id: "electrical", label: "Electrical", component: FaLightbulb },
  { id: "furniture", label: "Furniture", component: FaCouch },
  { id: "dooraccess", label: "Door/Access", component: FaDoorOpen },
  { id: "bathroom", label: "Bathroom", component: FaToilet },
  { id: "trash", label: "Waste Service", component: FaTrash },
  { id: "recycle", label: "Recycling", component: FaRecycle },
  { id: "security", label: "Security", component: FaShieldAlt },
  
  // Food and Entertainment
  { id: "bakery", label: "Bakery", component: FaBirthdayCake },
  { id: "wine", label: "Wine & Spirits", component: FaWineGlass },
  { id: "cocktail", label: "Bar", component: FaCocktail },
  { id: "pizza", label: "Pizza", component: FaPizzaSlice },
  { id: "beer", label: "Brewery", component: FaBeer },
  { id: "coffee", label: "Coffee Shop", component: FaCoffee },
  { id: "icecream", label: "Ice Cream", component: FaIceCream },
  { id: "burgers", label: "Fast Food", component: FaHamburger },
  { id: "music", label: "Music", component: FaMusic },
  { id: "theater", label: "Theater", component: FaTheaterMasks },
  { id: "gaming", label: "Gaming", component: FaGamepad },
  { id: "movies", label: "Movies", component: FaFilm },
  { id: "tv", label: "TV Services", component: FaTv },
  { id: "seafood", label: "Seafood", component: FaFish },
  { id: "meat", label: "Butcher/Meat", component: FaDrumstickBite },
  
  // Health and Wellness 
  { id: "hospital", label: "Hospital", component: FaHospital },
  { id: "emergency", label: "Emergency", component: FaAmbulance },
  { id: "dental", label: "Dental", component: FaTooth },
  { id: "vision", label: "Vision", component: FaEye },
  { id: "heart", label: "Cardiology", component: FaHeartbeat },
  { id: "fitness", label: "Fitness", component: FaRunning },
  { id: "yoga", label: "Yoga/Wellness", component: FaYinYang },
  { id: "pharmacy", label: "Pharmacy", component: FaPills },
  { id: "medical", label: "Medical", component: FaNotesMedical },
  
  // Professional Services
  { id: "childcare", label: "Child Care", component: FaBabyCarriage },
  { id: "hairsalon", label: "Hair Salon", component: FaCut },
  { id: "business", label: "Business", component: FaChartLine },
  { id: "finance", label: "Finance", component: FaMoneyBillWave },
  { id: "legal", label: "Legal", component: FaBalanceScale },
  { id: "bank", label: "Banking", component: FaBank },
  { id: "industry", label: "Industrial", component: FaIndustry },
  { id: "writing", label: "Writing", component: FaPencilAlt },
  { id: "helping", label: "Support", component: FaHandsHelping },
  { id: "payment", label: "Payment", component: FaCreditCard },
  
  // Home Decor and Design
  { id: "art", label: "Art/Design", component: FaPalette },
  { id: "measuring", label: "Measuring", component: FaRulerCombined },
  { id: "design", label: "Interior Design", component: FaSwatchbook },
  { id: "flooring", label: "Flooring", component: FaChessBoard },
  { id: "jewelry", label: "Jewelry", component: FaGem },
  
  // Outdoor and Recreation
  { id: "outdoors", label: "Outdoor", component: FaUmbrella },
  { id: "hiking", label: "Hiking", component: FaHiking },
  { id: "swimming", label: "Swimming", component: FaSwimmer },
  { id: "camping", label: "Camping", component: FaCampground },
  { id: "skiing", label: "Skiing", component: FaSkiing },
  { id: "plants", label: "Plants/Garden", component: FaSeedling },
  { id: "sports", label: "Sports", component: FaVolleyballBall },
  { id: "horses", label: "Equestrian", component: FaHorseHead },
  { id: "skating", label: "Skating", component: FaSkating },
  { id: "soccer", label: "Soccer", component: FaFutbol },
  { id: "golf", label: "Golf", component: FaGolfBall },
  
  // Technology
  { id: "computerservices", label: "Computer Repair", component: FaDesktop },
  { id: "server", label: "Server/IT", component: FaServer },
  { id: "networking", label: "Networking", component: FaNetworkWired },
  { id: "database", label: "Database", component: FaDatabase },
  { id: "mobile", label: "Mobile", component: FaMobileAlt },
  { id: "tablet", label: "Tablet", component: FaTabletAlt },
  { id: "computer", label: "PC Parts", component: FaMemory },
  
  // Other Services
  { id: "travel", label: "Travel Agency", component: FaPassport },
  { id: "airline", label: "Airlines", component: FaPlane },
  { id: "shipping", label: "Shipping", component: FaParachuteBox },
  { id: "clothing", label: "Clothing", component: FaTshirt },
  { id: "glasses", label: "Eyewear", component: FaGlasses },
  { id: "beach", label: "Beach", component: FaUmbrellaBeach },
  { id: "boarding", label: "Boarding", component: FaSnowboarding },
  { id: "boat", label: "Boating", component: FaShip },
  { id: "train", label: "Train", component: FaTrain },
  { id: "transportation", label: "Transportation", component: FaSubway },
  { id: "taxi", label: "Taxi/Ride", component: FaTaxi },
  { id: "parking", label: "Parking", component: FaParking },
  { id: "events", label: "Events", component: FaTicketAlt },
  { id: "gifts", label: "Gifts", component: FaGift },
  { id: "sale", label: "Sale", component: FaTag },

  // Communication Services
  { id: "email", label: "Email", component: FaEnvelope },
  { id: "phone", label: "Phone", component: FaPhone },
  { id: "chat", label: "Chat", component: FaComments },
  { id: "mobile-service", label: "Mobile Service", component: FaMobile },
  { id: "support", label: "Customer Support", component: FaHeadset },
  { id: "video", label: "Video", component: FaVideo },
  { id: "printing", label: "Printing", component: FaPrint },
  { id: "fax", label: "Fax", component: FaFax },
  { id: "marketing", label: "Marketing", component: FaBullhorn },
];

export default function ManageVendorCategories() {
  const queryClient = useQueryClient();
  
  // State for forms and UI
  const [categoryForm, setCategoryForm] = useState<CategoryFormData>({
    name: "",
    slug: "",
    order: 0
  });
  const [editingCategory, setEditingCategory] = useState<VendorCategory | null>(null);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);

  // Query for fetching categories (including hidden ones in admin view)
  const { data: categories, isLoading, error } = useQuery({
    queryKey: ['/api/vendor-categories', 'includeHidden', true],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/vendor-categories?includeHidden=true');
        const data = await response.json();
        console.log("ManageVendorCategories: API response:", data);
        return data;
      } catch (error) {
        console.error("ManageVendorCategories: Error fetching categories:", error);
        throw error;
      }
    },
    select: (data: any) => {
      // Check if data is an array before using it
      if (!Array.isArray(data)) {
        console.error("ManageVendorCategories: Expected categories data to be an array, but got:", typeof data);
        return [];
      }
      console.log("ManageVendorCategories: Processed categories:", data.length, "items");
      return data;
    },
    staleTime: 30000, // 30 seconds - reduces unnecessary refetches
    retry: 3,
    retryDelay: 1000,
  });

  // Mutations for CRUD operations
  const createCategoryMutation = useMutation({
    mutationFn: (newCategory: CategoryFormData) => 
      apiRequest('POST', '/api/vendor-categories', newCategory),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-categories'] });
      toast({
        title: "Success",
        description: "Category created successfully",
      });
      setIsAddSheetOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create category",
        variant: "destructive",
      });
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: Partial<CategoryFormData> }) => 
      apiRequest('PATCH', `/api/vendor-categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-categories'] });
      toast({
        title: "Success",
        description: "Category updated successfully",
      });
      setIsEditSheetOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update category",
        variant: "destructive",
      });
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/vendor-categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-categories'] });
      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
      setDeletingCategoryId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete category",
        variant: "destructive",
      });
    }
  });

  // Helper functions
  const resetForm = () => {
    setCategoryForm({
      name: "",
      slug: "",
      order: 0,
      isHidden: false
    });
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setCategoryForm({
      ...categoryForm,
      name,
      slug: slugify(name)
    });
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCategoryForm({
      ...categoryForm,
      slug: slugify(e.target.value)
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (categoryForm.name.trim() === "") {
      toast({
        title: "Validation Error",
        description: "Category name is required",
        variant: "destructive",
      });
      return;
    }

    createCategoryMutation.mutate(categoryForm);
  };

  const handleEdit = (category: VendorCategory) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      slug: category.slug,
      icon: category.icon,
      order: category.order,
      isHidden: category.isHidden
    });
    setIsEditSheetOpen(true);
  };
  
  const handleToggleVisibility = (category: VendorCategory) => {
    updateCategoryMutation.mutate({
      id: category.id,
      data: { isHidden: !category.isHidden }
    });
    
    toast({
      title: category.isHidden ? "Category Unhidden" : "Category Hidden",
      description: `${category.name} is now ${category.isHidden ? "visible" : "hidden"} on the Vendors page.`,
    });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    
    if (categoryForm.name.trim() === "") {
      toast({
        title: "Validation Error",
        description: "Category name is required",
        variant: "destructive",
      });
      return;
    }

    updateCategoryMutation.mutate({
      id: editingCategory.id,
      data: categoryForm
    });
  };

  const handleDelete = (id: number) => {
    setDeletingCategoryId(id);
  };

  const confirmDelete = () => {
    if (deletingCategoryId) {
      deleteCategoryMutation.mutate(deletingCategoryId);
    }
  };

  // Function to resequence all category orders (ensuring they are sequential 0, 1, 2, 3...)
  const resequenceCategoryOrders = async () => {
    if (!categories || !Array.isArray(categories)) {
      console.error("Expected categories to be an array:", categories);
      return;
    }
    
    console.log("Resequencing category orders...");
    
    // Get the categories sorted by their current order
    const sortedCategories = [...categories].sort((a, b) => a.order - b.order);
    
    // Update each category with a sequential order starting from 0
    const updatePromises = sortedCategories.map((category, idx) => {
      if (category.order !== idx) {
        console.log(`Updating ${category.name} order from ${category.order} to ${idx}`);
        return updateCategoryMutation.mutateAsync({
          id: category.id,
          data: { order: idx }
        });
      }
      return Promise.resolve();
    });
    
    // Wait for all updates to complete
    try {
      await Promise.all(updatePromises);
      console.log("Category order resequencing completed");
    } catch (error) {
      console.error("Error resequencing category orders:", error);
    }
  };

  const handleMoveUp = (category: VendorCategory, index: number) => {
    if (index === 0) return; // Already at the top
    if (!categories || !Array.isArray(categories)) {
      console.error("Expected categories to be an array:", categories);
      return;
    }
    
    const prevCategory = categories[index - 1];
    
    // Swap orders
    updateCategoryMutation.mutate({
      id: category.id,
      data: { order: prevCategory.order }
    });
    
    updateCategoryMutation.mutate({
      id: prevCategory.id,
      data: { order: category.order }
    });
    
    toast({
      title: "Category Order Updated",
      description: `${category.name} has been moved up in the category order.`,
    });
  };
  
  const handleMoveDown = (category: VendorCategory, index: number) => {
    if (!categories || !Array.isArray(categories) || index >= categories.length - 1) return; // Already at the bottom
    
    const nextCategory = categories[index + 1];
    
    // Swap orders
    updateCategoryMutation.mutate({
      id: category.id,
      data: { order: nextCategory.order }
    });
    
    updateCategoryMutation.mutate({
      id: nextCategory.id,
      data: { order: category.order }
    });
    
    toast({
      title: "Category Order Updated",
      description: `${category.name} has been moved down in the category order.`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-destructive">
            <p>Error loading vendor categories</p>
            <Button
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/vendor-categories'] })}
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Vendor Categories</CardTitle>
        <CardDescription>
          Add, edit, or remove vendor categories that appear on the Vendors page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-end mb-6">
          <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
            <SheetTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Category
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Add New Category</SheetTitle>
                <SheetDescription>
                  Create a new vendor category that will appear on the Vendors page.
                </SheetDescription>
              </SheetHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="grid w-full gap-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={categoryForm.name}
                    onChange={handleNameChange}
                    placeholder="e.g., Home Services"
                  />
                </div>
                <div className="grid w-full gap-1.5">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={categoryForm.slug}
                    onChange={handleSlugChange}
                    placeholder="e.g., home-services"
                  />
                  <p className="text-sm text-muted-foreground">
                    URL-friendly version of the name. Auto-generated, but you can customize it.
                  </p>
                </div>
                <div className="grid w-full gap-1.5">
                  <Label htmlFor="order">Order</Label>
                  <Input
                    id="order"
                    type="number"
                    value={categoryForm.order}
                    onChange={(e) => setCategoryForm({ ...categoryForm, order: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
                
                <div className="grid w-full gap-1.5">
                  <Label>Icon</Label>
                  <ScrollArea className="h-72 border rounded-md p-4">
                    <RadioGroup
                      value={categoryForm.icon || ""}
                      onValueChange={(value) => setCategoryForm({ ...categoryForm, icon: value })}
                      className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6"
                    >
                      {ICON_OPTIONS.map((icon) => {
                        const IconComponent = icon.component;
                        return (
                          <div key={icon.id} className="flex items-center space-x-2 mr-4">
                            <RadioGroupItem value={icon.id} id={`icon-${icon.id}`} className="flex-shrink-0" />
                            <Label htmlFor={`icon-${icon.id}`} className="flex items-center cursor-pointer text-nowrap">
                              <IconComponent className="h-5 w-5 mr-2 flex-shrink-0" />
                              <span className="text-sm whitespace-nowrap overflow-hidden text-ellipsis">{icon.label}</span>
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  </ScrollArea>
                  <p className="text-sm text-muted-foreground">
                    Choose an icon to represent this category in the dropdown menu.
                  </p>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    id="is-hidden"
                    checked={categoryForm.isHidden}
                    onCheckedChange={(checked) => setCategoryForm({ ...categoryForm, isHidden: checked })}
                  />
                  <Label htmlFor="is-hidden">
                    Hide category from vendors page
                    <p className="text-xs text-muted-foreground mt-1">
                      Hidden categories are not visible to users but are preserved in the database.
                    </p>
                  </Label>
                </div>
                <SheetFooter>
                  <SheetClose asChild>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </SheetClose>
                  <Button
                    type="submit"
                    disabled={createCategoryMutation.isPending}
                  >
                    {createCategoryMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Category
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories && categories.length > 0 ? (
                categories.map((category: VendorCategory, index: number) => (
                  <TableRow 
                    key={category.id} 
                    className={category.isHidden ? "opacity-60" : ""}
                  >
                    <TableCell className="font-medium">
                      {category.name}
                      {category.isHidden && (
                        <span className="ml-2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">
                          Hidden
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{category.slug}</TableCell>
                    <TableCell>{category.order}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleMoveUp(category, index)}
                          disabled={index === 0}
                        >
                          <MoveUp className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleMoveDown(category, index)}
                          disabled={!categories || index >= categories.length - 1}
                        >
                          <MoveDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(category)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleVisibility(category)}
                          title={category.isHidden ? "Unhide category" : "Hide category"}
                        >
                          {category.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(category.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6">
                    No categories found. Add your first category using the button above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Edit Category Sheet */}
        <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Edit Category</SheetTitle>
              <SheetDescription>
                Update the details of this vendor category.
              </SheetDescription>
            </SheetHeader>
            <form onSubmit={handleUpdate} className="space-y-4 py-4">
              <div className="grid w-full gap-1.5">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={categoryForm.name}
                  onChange={handleNameChange}
                />
              </div>
              <div className="grid w-full gap-1.5">
                <Label htmlFor="edit-slug">Slug</Label>
                <Input
                  id="edit-slug"
                  value={categoryForm.slug}
                  onChange={handleSlugChange}
                />
                <p className="text-sm text-muted-foreground">
                  URL-friendly version of the name.
                </p>
              </div>
              <div className="grid w-full gap-1.5">
                <Label htmlFor="edit-order">Order</Label>
                <Input
                  id="edit-order"
                  type="number"
                  value={categoryForm.order}
                  onChange={(e) => setCategoryForm({ ...categoryForm, order: parseInt(e.target.value) || 0 })}
                />
              </div>
              
              <div className="grid w-full gap-1.5">
                <Label>Icon</Label>
                <ScrollArea className="h-72 border rounded-md p-4">
                  <RadioGroup
                    value={categoryForm.icon || ""}
                    onValueChange={(value) => setCategoryForm({ ...categoryForm, icon: value })}
                    className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6"
                  >
                    {ICON_OPTIONS.map((icon) => {
                      const IconComponent = icon.component;
                      return (
                        <div key={icon.id} className="flex items-center space-x-2 mr-4">
                          <RadioGroupItem value={icon.id} id={`edit-icon-${icon.id}`} className="flex-shrink-0" />
                          <Label htmlFor={`edit-icon-${icon.id}`} className="flex items-center cursor-pointer text-nowrap">
                            <IconComponent className="h-5 w-5 mr-2 flex-shrink-0" />
                            <span className="text-sm whitespace-nowrap overflow-hidden text-ellipsis">{icon.label}</span>
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                </ScrollArea>
                <p className="text-sm text-muted-foreground">
                  Choose an icon to represent this category in the dropdown menu.
                </p>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="edit-is-hidden"
                  checked={categoryForm.isHidden}
                  onCheckedChange={(checked) => setCategoryForm({ ...categoryForm, isHidden: checked })}
                />
                <Label htmlFor="edit-is-hidden">
                  Hide category from vendors page
                  <p className="text-xs text-muted-foreground mt-1">
                    Hidden categories are not visible to users but are preserved in the database.
                  </p>
                </Label>
              </div>
              <SheetFooter>
                <SheetClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </SheetClose>
                <Button
                  type="submit"
                  disabled={updateCategoryMutation.isPending}
                >
                  {updateCategoryMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Category
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={deletingCategoryId !== null}
          onOpenChange={(open) => !open && setDeletingCategoryId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete this
                vendor category from the database.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>
                {deleteCategoryMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}