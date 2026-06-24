import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import { Loader2, Edit, Trash2, Plus, MoveUp, MoveDown, AlertTriangle, Building, Info, Store, ThermometerSun, Leaf, Car, Heart } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { slugify } from "@/lib/slug-utils";
import { 
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
  FaIceCream, FaHamburger, FaMusic, FaGamepad, FaFilm, 
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
  FaParking, FaTicketAlt, FaGift, FaTag,
  
  // Additional Recreation & Activities
  FaBiking, FaTableTennis, FaBasketballBall, FaFootballBall, 
  FaGolfBall as FaGolf, FaBaseballBall, FaChess, FaGuitar,
  FaTicketAlt as FaTicket, FaPuzzlePiece,
  
  // Weather & Seasons
  FaCloudRain, FaCloudSunRain, FaWind, FaCloud, 
  FaCloudSun, FaCloudMoon, FaSun, FaMoon, FaRainbow,
  
  // Additional Food icons
  FaCheese, FaCookie, FaAppleAlt, FaCarrot, FaEgg,
  
  // Communication & Media
  FaNewspaper, FaHeadphones, FaPodcast, FaMicrophone, 
  FaInbox, FaMailBulk, FaRss, FaCommentDots, FaCommentAlt,
  
  // Finance & Business
  FaPercentage, FaReceipt, FaFileInvoiceDollar, FaHandHoldingUsd, FaStore as FaStorefront,
  
  // Personal & Lifestyle
  FaShower, FaSoap, FaSpa, FaGem as FaJewel, FaGift as FaPresent, 
  
  // Time & Scheduling
  FaClock, FaRegClock, FaCalendarAlt, FaCalendarDay, FaCalendarWeek, 
  FaHourglassHalf, FaStopwatch, FaBell, FaRegBell,
  
  // Direction & Location
  FaMapMarkedAlt, FaMap, FaCompass, FaDirections, FaLocationArrow, 
  FaSearchLocation, FaRoute, FaMapSigns, FaStreetView
} from "react-icons/fa";

// Define TypeScript types
type CommunityCategory = {
  id: number;
  name: string;
  slug: string;
  icon?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

type CategoryFormData = {
  name: string;
  slug: string;
  icon?: string;
  order: number;
};

// Helper component to display icons in the radio group
interface IconRadioItemProps {
  value: string;
  icon: React.ReactNode;
  label: string;
}

function IconRadioItem({ value, icon, label }: IconRadioItemProps) {
  return (
    <div className="relative">
      <RadioGroupItem
        value={value}
        id={`icon-${value}`}
        className="sr-only"
      />
      <Label
        htmlFor={`icon-${value}`}
        className="flex flex-col items-center justify-center p-2 rounded-md border-2 border-muted bg-transparent cursor-pointer hover:bg-accent data-[state=checked]:bg-accent data-[state=checked]:border-primary transition-colors"
        data-state={document.getElementById(`icon-${value}`)?.getAttribute("data-state") || "unchecked"}
      >
        <div className="text-center mb-1">
          {icon}
        </div>
        <div className="text-xs font-medium truncate w-full text-center">
          {label}
        </div>
      </Label>
    </div>
  );
}

export default function ManageCommunityCategories() {
  const queryClient = useQueryClient();
  
  // State for forms and UI
  const [categoryForm, setCategoryForm] = useState<CategoryFormData>({
    name: "",
    slug: "",
    icon: "",
    order: 0
  });
  const [editingCategory, setEditingCategory] = useState<CommunityCategory | null>(null);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);

  // Query for fetching categories
  const { data: categories, isLoading, error } = useQuery({
    queryKey: ['/api/community-categories'],
  });

  // Mutations for CRUD operations
  const createCategoryMutation = useMutation({
    mutationFn: (newCategory: CategoryFormData) => 
      apiRequest('POST', '/api/community-categories', newCategory),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community-categories'] });
      toast({
        title: "Success",
        description: "Community category created successfully",
      });
      setIsAddSheetOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create community category",
        variant: "destructive",
      });
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: Partial<CategoryFormData> }) => 
      apiRequest('PATCH', `/api/community-categories/${id}`, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['/api/community-categories'] });
      
      // Check if any pages were updated due to slug change
      const metadata = response._meta;
      if (metadata && metadata.updatedPages > 0) {
        toast({
          title: "Success",
          description: `Community category updated successfully. ${metadata.updatedPages} page(s) were also updated with the new slug.`,
        });
      } else {
        toast({
          title: "Success",
          description: "Community category updated successfully",
        });
      }
      
      setIsEditSheetOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update community category",
        variant: "destructive",
      });
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/community-categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community-categories'] });
      toast({
        title: "Success",
        description: "Community category deleted successfully",
      });
      setDeletingCategoryId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete community category",
        variant: "destructive",
      });
    }
  });

  // Helper functions
  const resetForm = () => {
    setCategoryForm({
      name: "",
      slug: "",
      icon: "",
      order: 0
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

  const handleEdit = (category: CommunityCategory) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      slug: category.slug,
      icon: category.icon || "",
      order: category.order
    });
    setIsEditSheetOpen(true);
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

  const handleMoveUp = (category: CommunityCategory, index: number) => {
    if (index === 0) return; // Already at the top
    
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
  };
  
  const handleMoveDown = (category: CommunityCategory, index: number) => {
    if (!categories || index >= categories.length - 1) return; // Already at the bottom
    
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
            <p>Error loading community categories</p>
            <Button
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/community-categories'] })}
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
        <CardTitle>Manage Community Categories</CardTitle>
        <CardDescription>
          Add, edit, or remove community categories that appear throughout the site.
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
                  Create a new community category that will appear in navigation and community pages.
                </SheetDescription>
              </SheetHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="grid w-full gap-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={categoryForm.name}
                    onChange={handleNameChange}
                    placeholder="e.g., Government & Regulations"
                  />
                </div>
                <div className="grid w-full gap-1.5">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={categoryForm.slug}
                    onChange={handleSlugChange}
                    placeholder="e.g., government"
                  />
                  <p className="text-sm text-muted-foreground">
                    URL-friendly version of the name. Auto-generated, but you can customize it.
                  </p>
                </div>
                <div className="grid w-full gap-1.5">
                  <Label htmlFor="icon">Select Icon</Label>
                  
                  <div className="border rounded-md p-2">
                    <Input
                      id="icon"
                      value={categoryForm.icon}
                      onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                      placeholder="Icon name or select below"
                      className="mb-2"
                    />
                    
                    <ScrollArea className="h-[200px] pr-4">
                      <RadioGroup
                        value={categoryForm.icon}
                        onValueChange={(value) => setCategoryForm({ ...categoryForm, icon: value })}
                        className="grid grid-cols-4 gap-2"
                      >
                        {/* Government & Information Icons */}
                        <div className="col-span-4 mt-2 mb-1 font-medium text-sm text-muted-foreground">Government & Information</div>
                        <IconRadioItem value="FaBuilding" icon={<FaBuilding size={20} />} label="Building" />
                        <IconRadioItem value="FaLandmark" icon={<FaLandmark size={20} />} label="Landmark" />
                        <IconRadioItem value="FaCity" icon={<FaCity size={20} />} label="City" />
                        <IconRadioItem value="FaBook" icon={<FaBook size={20} />} label="Book" />
                        <IconRadioItem value="FaClipboardCheck" icon={<FaClipboardCheck size={20} />} label="Clipboard" />
                        <IconRadioItem value="FaBalanceScale" icon={<FaBalanceScale size={20} />} label="Scale" />
                        <IconRadioItem value="FaBullhorn" icon={<FaBullhorn size={20} />} label="Bullhorn" />
                        <IconRadioItem value="FaGlobe" icon={<FaGlobe size={20} />} label="Globe" />
                        
                        {/* Nature & Environment Icons */}
                        <div className="col-span-4 mt-2 mb-1 font-medium text-sm text-muted-foreground">Nature & Environment</div>
                        <IconRadioItem value="FaLeaf" icon={<FaLeaf size={20} />} label="Leaf" />
                        <IconRadioItem value="FaTree" icon={<FaTree size={20} />} label="Tree" />
                        <IconRadioItem value="FaWater" icon={<FaWater size={20} />} label="Water" />
                        <IconRadioItem value="FaMountain" icon={<FaMountain size={20} />} label="Mountain" />
                        <IconRadioItem value="FaSeedling" icon={<FaSeedling size={20} />} label="Seedling" />
                        <IconRadioItem value="FaThermometerHalf" icon={<FaThermometerHalf size={20} />} label="Temperature" />
                        <IconRadioItem value="FaUmbrellaBeach" icon={<FaUmbrellaBeach size={20} />} label="Beach" />
                        <IconRadioItem value="FaSun" icon={<FaSun size={20} />} label="Sun" />
                        <IconRadioItem value="FaCloudSun" icon={<FaCloudSun size={20} />} label="Cloudy" />
                        <IconRadioItem value="FaCloudRain" icon={<FaCloudRain size={20} />} label="Rain" />
                        <IconRadioItem value="FaSnowflake" icon={<FaSnowflake size={20} />} label="Snow" />
                        <IconRadioItem value="FaWind" icon={<FaWind size={20} />} label="Wind" />
                        <IconRadioItem value="FaRainbow" icon={<FaRainbow size={20} />} label="Rainbow" />
                        <IconRadioItem value="FaSun" icon={<FaStar size={20} />} label="Sun" />
                        
                        {/* Services & Business Icons */}
                        <div className="col-span-4 mt-2 mb-1 font-medium text-sm text-muted-foreground">Services & Businesses</div>
                        <IconRadioItem value="FaStore" icon={<FaStore size={20} />} label="Store" />
                        <IconRadioItem value="FaUtensils" icon={<FaUtensils size={20} />} label="Restaurant" />
                        <IconRadioItem value="FaShoppingCart" icon={<FaShoppingCart size={20} />} label="Shopping" />
                        <IconRadioItem value="FaHospital" icon={<FaHospital size={20} />} label="Hospital" />
                        <IconRadioItem value="FaTooth" icon={<FaTooth size={20} />} label="Dental" />
                        <IconRadioItem value="FaClinicMedical" icon={<FaClinicMedical size={20} />} label="Medical" />
                        <IconRadioItem value="FaGraduationCap" icon={<FaGraduationCap size={20} />} label="Education" />
                        <IconRadioItem value="FaBank" icon={<FaBank size={20} />} label="Bank" />
                        <IconRadioItem value="FaMoneyBillWave" icon={<FaMoneyBillWave size={20} />} label="Money" />
                        <IconRadioItem value="FaCreditCard" icon={<FaCreditCard size={20} />} label="Credit Card" />
                        <IconRadioItem value="FaChartLine" icon={<FaChartLine size={20} />} label="Chart" />
                        <IconRadioItem value="FaFileInvoiceDollar" icon={<FaFileInvoiceDollar size={20} />} label="Invoice" />
                        <IconRadioItem value="FaReceipt" icon={<FaReceipt size={20} />} label="Receipt" />
                        <IconRadioItem value="FaPercentage" icon={<FaPercentage size={20} />} label="Percentage" />
                        <IconRadioItem value="FaHandHoldingUsd" icon={<FaHandHoldingUsd size={20} />} label="Finance" />
                        <IconRadioItem value="FaStorefront" icon={<FaStorefront size={20} />} label="Storefront" />
                        
                        {/* Home & Property Icons */}
                        <div className="col-span-4 mt-2 mb-1 font-medium text-sm text-muted-foreground">Home & Property</div>
                        <IconRadioItem value="FaHome" icon={<FaHome size={20} />} label="Home" />
                        <IconRadioItem value="FaHouseUser" icon={<FaHouseUser size={20} />} label="House" />
                        <IconRadioItem value="FaTools" icon={<FaTools size={20} />} label="Tools" />
                        <IconRadioItem value="FaHammer" icon={<FaHammer size={20} />} label="Hammer" />
                        <IconRadioItem value="FaWrench" icon={<FaWrench size={20} />} label="Wrench" />
                        <IconRadioItem value="FaPaintBrush" icon={<FaPaintBrush size={20} />} label="Paint" />
                        <IconRadioItem value="FaCouch" icon={<FaCouch size={20} />} label="Furniture" />
                        <IconRadioItem value="FaKey" icon={<FaKey size={20} />} label="Key" />
                        
                        {/* Transportation Icons */}
                        <div className="col-span-4 mt-2 mb-1 font-medium text-sm text-muted-foreground">Transportation</div>
                        <IconRadioItem value="FaCar" icon={<FaCar size={20} />} label="Car" />
                        <IconRadioItem value="FaCarAlt" icon={<FaCarAlt size={20} />} label="Car Alt" />
                        <IconRadioItem value="FaTruck" icon={<FaTruck size={20} />} label="Truck" />
                        <IconRadioItem value="FaTaxi" icon={<FaTaxi size={20} />} label="Taxi" />
                        <IconRadioItem value="FaBus" icon={<FaSubway size={20} />} label="Bus" />
                        <IconRadioItem value="FaTrain" icon={<FaTrain size={20} />} label="Train" />
                        <IconRadioItem value="FaBicycle" icon={<FaBicycle size={20} />} label="Bicycle" />
                        <IconRadioItem value="FaPlane" icon={<FaPlane size={20} />} label="Plane" />
                        
                        {/* Community & Social Icons */}
                        <div className="col-span-4 mt-2 mb-1 font-medium text-sm text-muted-foreground">Community & Social</div>
                        <IconRadioItem value="FaUsers" icon={<FaComments size={20} />} label="Users" />
                        <IconRadioItem value="FaHeart" icon={<FaHeart size={20} />} label="Heart" />
                        <IconRadioItem value="FaHandsHelping" icon={<FaHandsHelping size={20} />} label="Helping" />
                        <IconRadioItem value="FaDog" icon={<FaDog size={20} />} label="Pet" />
                        <IconRadioItem value="FaPaw" icon={<FaPaw size={20} />} label="Paw" />
                        <IconRadioItem value="FaVihara" icon={<FaVihara size={20} />} label="Religion" />
                        <IconRadioItem value="FaRunning" icon={<FaRunning size={20} />} label="Activity" />
                        <IconRadioItem value="FaFootballBall" icon={<FaGolfBall size={20} />} label="Sports" />
                        
                        {/* Recreation & Activities */}
                        <div className="col-span-4 mt-2 mb-1 font-medium text-sm text-muted-foreground">Recreation & Activities</div>
                        <IconRadioItem value="FaSwimmer" icon={<FaSwimmer size={20} />} label="Swimming" />
                        <IconRadioItem value="FaHiking" icon={<FaHiking size={20} />} label="Hiking" />
                        <IconRadioItem value="FaBiking" icon={<FaBiking size={20} />} label="Biking" />
                        <IconRadioItem value="FaFish" icon={<FaFish size={20} />} label="Fishing" />
                        <IconRadioItem value="FaCampground" icon={<FaCampground size={20} />} label="Camping" />
                        <IconRadioItem value="FaVolleyballBall" icon={<FaVolleyballBall size={20} />} label="Volleyball" />
                        <IconRadioItem value="FaTableTennis" icon={<FaTableTennis size={20} />} label="Table Tennis" />
                        <IconRadioItem value="FaBasketballBall" icon={<FaBasketballBall size={20} />} label="Basketball" />
                        <IconRadioItem value="FaFootballBall" icon={<FaFootballBall size={20} />} label="Football" />
                        <IconRadioItem value="FaGolf" icon={<FaGolf size={20} />} label="Golf" />
                        <IconRadioItem value="FaMusic" icon={<FaMusic size={20} />} label="Music" />
                        <IconRadioItem value="FaGamepad" icon={<FaGamepad size={20} />} label="Gaming" />
                        <IconRadioItem value="FaPuzzlePiece" icon={<FaPuzzlePiece size={20} />} label="Puzzles" />
                        
                        {/* Technology Icons */}
                        <div className="col-span-4 mt-2 mb-1 font-medium text-sm text-muted-foreground">Technology</div>
                        <IconRadioItem value="FaDesktop" icon={<FaDesktop size={20} />} label="Computer" />
                        <IconRadioItem value="FaMobile" icon={<FaMobile size={20} />} label="Mobile" />
                        <IconRadioItem value="FaWifi" icon={<FaWifi size={20} />} label="WiFi" />
                        <IconRadioItem value="FaTv" icon={<FaTv size={20} />} label="TV" />
                        <IconRadioItem value="FaLaptop" icon={<FaLaptop size={20} />} label="Laptop" />
                        <IconRadioItem value="FaNetworkWired" icon={<FaNetworkWired size={20} />} label="Network" />
                        <IconRadioItem value="FaMicrochip" icon={<FaMicrochip size={20} />} label="Chip" />
                        <IconRadioItem value="FaPowerOff" icon={<FaPowerOff size={20} />} label="Power" />

                        {/* Safety & Emergency */}
                        <div className="col-span-4 mt-2 mb-1 font-medium text-sm text-muted-foreground">Safety & Emergency</div>
                        <IconRadioItem value="FaAmbulance" icon={<FaAmbulance size={20} />} label="Ambulance" />
                        <IconRadioItem value="FaFireExtinguisher" icon={<FaFireExtinguisher size={20} />} label="Fire" />
                        <IconRadioItem value="FaShieldAlt" icon={<FaShieldAlt size={20} />} label="Shield" />
                        <IconRadioItem value="FaHeartbeat" icon={<FaHeartbeat size={20} />} label="Heartbeat" />
                      </RadioGroup>
                    </ScrollArea>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Choose an icon that best represents this category.
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
                <TableHead>Icon</TableHead>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories && categories.length > 0 ? (
                categories.map((category: CommunityCategory, index: number) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell>{category.slug}</TableCell>
                    <TableCell>
                      {category.icon ? (
                        <div className="flex items-center">
                          <div className="mr-2 text-foreground">
                            {category.icon.startsWith('Fa') && (
                              <>
                                {category.icon === 'FaBuilding' && <FaBuilding size={16} />}
                                {category.icon === 'FaLandmark' && <FaLandmark size={16} />}
                                {category.icon === 'FaCity' && <FaCity size={16} />}
                                {category.icon === 'FaBook' && <FaBook size={16} />}
                                {category.icon === 'FaClipboardCheck' && <FaClipboardCheck size={16} />}
                                {category.icon === 'FaBalanceScale' && <FaBalanceScale size={16} />}
                                {category.icon === 'FaBullhorn' && <FaBullhorn size={16} />}
                                {category.icon === 'FaGlobe' && <FaGlobe size={16} />}
                                {category.icon === 'FaLeaf' && <FaLeaf size={16} />}
                                {category.icon === 'FaTree' && <FaTree size={16} />}
                                {category.icon === 'FaWater' && <FaWater size={16} />}
                                {category.icon === 'FaMountain' && <FaMountain size={16} />}
                                {category.icon === 'FaSeedling' && <FaSeedling size={16} />}
                                {category.icon === 'FaThermometerHalf' && <FaThermometerHalf size={16} />}
                                {category.icon === 'FaUmbrellaBeach' && <FaUmbrellaBeach size={16} />}
                                {category.icon === 'FaSun' && <FaStar size={16} />}
                                {category.icon === 'FaStore' && <FaStore size={16} />}
                                {category.icon === 'FaUtensils' && <FaUtensils size={16} />}
                                {category.icon === 'FaShoppingCart' && <FaShoppingCart size={16} />}
                                {category.icon === 'FaHospital' && <FaHospital size={16} />}
                                {category.icon === 'FaTooth' && <FaTooth size={16} />}
                                {category.icon === 'FaClinicMedical' && <FaClinicMedical size={16} />}
                                {category.icon === 'FaGraduationCap' && <FaGraduationCap size={16} />}
                                {category.icon === 'FaBank' && <FaBank size={16} />}
                                {category.icon === 'FaHome' && <FaHome size={16} />}
                                {category.icon === 'FaHouseUser' && <FaHouseUser size={16} />}
                                {category.icon === 'FaTools' && <FaTools size={16} />}
                                {category.icon === 'FaHammer' && <FaHammer size={16} />}
                                {category.icon === 'FaWrench' && <FaWrench size={16} />}
                                {category.icon === 'FaPaintBrush' && <FaPaintBrush size={16} />}
                                {category.icon === 'FaCouch' && <FaCouch size={16} />}
                                {category.icon === 'FaKey' && <FaKey size={16} />}
                                {category.icon === 'FaCar' && <FaCar size={16} />}
                                {category.icon === 'FaCarAlt' && <FaCarAlt size={16} />}
                                {category.icon === 'FaTruck' && <FaTruck size={16} />}
                                {category.icon === 'FaTaxi' && <FaTaxi size={16} />}
                                {category.icon === 'FaBus' && <FaSubway size={16} />}
                                {category.icon === 'FaTrain' && <FaTrain size={16} />}
                                {category.icon === 'FaBicycle' && <FaBicycle size={16} />}
                                {category.icon === 'FaPlane' && <FaPlane size={16} />}
                                {category.icon === 'FaUsers' && <FaComments size={16} />}
                                {category.icon === 'FaHeart' && <FaHeart size={16} />}
                                {category.icon === 'FaHandsHelping' && <FaHandsHelping size={16} />}
                                {category.icon === 'FaDog' && <FaDog size={16} />}
                                {category.icon === 'FaPaw' && <FaPaw size={16} />}
                                {category.icon === 'FaVihara' && <FaVihara size={16} />}
                                {category.icon === 'FaRunning' && <FaRunning size={16} />}
                                {category.icon === 'FaFootballBall' && <FaGolfBall size={16} />}
                                {category.icon === 'FaDesktop' && <FaDesktop size={16} />}
                                {category.icon === 'FaMobile' && <FaMobile size={16} />}
                                {category.icon === 'FaWifi' && <FaWifi size={16} />}
                                {category.icon === 'FaTv' && <FaTv size={16} />}
                                {category.icon === 'FaLaptop' && <FaLaptop size={16} />}
                                {category.icon === 'FaNetworkWired' && <FaNetworkWired size={16} />}
                                {category.icon === 'FaMicrochip' && <FaMicrochip size={16} />}
                                {category.icon === 'FaPowerOff' && <FaPowerOff size={16} />}
                                {category.icon === 'FaAmbulance' && <FaAmbulance size={16} />}
                                {category.icon === 'FaFireExtinguisher' && <FaFireExtinguisher size={16} />}
                                {category.icon === 'FaShieldAlt' && <FaShieldAlt size={16} />}
                                {category.icon === 'FaHeartbeat' && <FaHeartbeat size={16} />}
                                
                                {/* Recreation & Activities */}
                                {category.icon === 'FaSwimmer' && <FaSwimmer size={16} />}
                                {category.icon === 'FaHiking' && <FaHiking size={16} />}
                                {category.icon === 'FaBiking' && <FaBiking size={16} />}
                                {category.icon === 'FaFish' && <FaFish size={16} />}
                                {category.icon === 'FaCampground' && <FaCampground size={16} />}
                                {category.icon === 'FaVolleyballBall' && <FaVolleyballBall size={16} />}
                                {category.icon === 'FaTableTennis' && <FaTableTennis size={16} />}
                                {category.icon === 'FaBasketballBall' && <FaBasketballBall size={16} />}
                                {category.icon === 'FaFootballBall' && <FaFootballBall size={16} />}
                                {category.icon === 'FaGolf' && <FaGolf size={16} />}
                                {category.icon === 'FaPuzzlePiece' && <FaPuzzlePiece size={16} />}
                                
                                {/* Weather */}
                                {category.icon === 'FaCloudRain' && <FaCloudRain size={16} />}
                                {category.icon === 'FaCloudSunRain' && <FaCloudSunRain size={16} />}
                                {category.icon === 'FaWind' && <FaWind size={16} />}
                                {category.icon === 'FaCloud' && <FaCloud size={16} />}
                                {category.icon === 'FaCloudSun' && <FaCloudSun size={16} />}
                                {category.icon === 'FaCloudMoon' && <FaCloudMoon size={16} />}
                                {category.icon === 'FaMoon' && <FaMoon size={16} />}
                                {category.icon === 'FaRainbow' && <FaRainbow size={16} />}
                                
                                {/* Finance */}
                                {category.icon === 'FaMoneyBillWave' && <FaMoneyBillWave size={16} />}
                                {category.icon === 'FaCreditCard' && <FaCreditCard size={16} />}
                                {category.icon === 'FaChartLine' && <FaChartLine size={16} />}
                                {category.icon === 'FaFileInvoiceDollar' && <FaFileInvoiceDollar size={16} />}
                                {category.icon === 'FaReceipt' && <FaReceipt size={16} />}
                                {category.icon === 'FaPercentage' && <FaPercentage size={16} />}
                                {category.icon === 'FaHandHoldingUsd' && <FaHandHoldingUsd size={16} />}
                                {category.icon === 'FaStorefront' && <FaStorefront size={16} />}
                              </>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{category.icon}</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
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
                  <TableCell colSpan={5} className="text-center py-6">
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
                Update the details of this community category.
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
                {editingCategory && categoryForm.slug !== editingCategory.slug && (
                  <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-sm rounded border border-yellow-200 dark:border-yellow-800">
                    <AlertTriangle className="h-4 w-4 inline-block mr-1" />
                    <span>
                      Changing the slug will automatically update all related page URLs to use the new slug.
                      This helps prevent broken links, but may impact bookmarks or shared links.
                    </span>
                  </div>
                )}
              </div>
              <div className="grid w-full gap-1.5">
                <Label htmlFor="edit-icon">Select Icon</Label>
                
                <div className="border rounded-md p-2">
                  <Input
                    id="edit-icon"
                    value={categoryForm.icon}
                    onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                    placeholder="Icon name or select below"
                    className="mb-2"
                  />
                  
                  <ScrollArea className="h-[200px] pr-4">
                    <RadioGroup
                      value={categoryForm.icon}
                      onValueChange={(value) => setCategoryForm({ ...categoryForm, icon: value })}
                      className="grid grid-cols-4 gap-2"
                    >
                      {/* Government & Information Icons */}
                      <div className="col-span-4 mt-2 mb-1 font-medium text-sm text-muted-foreground">Government & Information</div>
                      <IconRadioItem value="FaBuilding" icon={<FaBuilding size={20} />} label="Building" />
                      <IconRadioItem value="FaLandmark" icon={<FaLandmark size={20} />} label="Landmark" />
                      <IconRadioItem value="FaCity" icon={<FaCity size={20} />} label="City" />
                      <IconRadioItem value="FaBook" icon={<FaBook size={20} />} label="Book" />
                      <IconRadioItem value="FaClipboardCheck" icon={<FaClipboardCheck size={20} />} label="Clipboard" />
                      <IconRadioItem value="FaBalanceScale" icon={<FaBalanceScale size={20} />} label="Scale" />
                      <IconRadioItem value="FaBullhorn" icon={<FaBullhorn size={20} />} label="Bullhorn" />
                      <IconRadioItem value="FaGlobe" icon={<FaGlobe size={20} />} label="Globe" />
                      
                      {/* Nature & Environment Icons */}
                      <div className="col-span-4 mt-2 mb-1 font-medium text-sm text-muted-foreground">Nature & Environment</div>
                      <IconRadioItem value="FaLeaf" icon={<FaLeaf size={20} />} label="Leaf" />
                      <IconRadioItem value="FaTree" icon={<FaTree size={20} />} label="Tree" />
                      <IconRadioItem value="FaWater" icon={<FaWater size={20} />} label="Water" />
                      <IconRadioItem value="FaMountain" icon={<FaMountain size={20} />} label="Mountain" />
                      <IconRadioItem value="FaSeedling" icon={<FaSeedling size={20} />} label="Seedling" />
                      <IconRadioItem value="FaThermometerHalf" icon={<FaThermometerHalf size={20} />} label="Temperature" />
                      <IconRadioItem value="FaUmbrellaBeach" icon={<FaUmbrellaBeach size={20} />} label="Beach" />
                      <IconRadioItem value="FaSun" icon={<FaStar size={20} />} label="Sun" />
                      
                      {/* Services & Business Icons */}
                      <div className="col-span-4 mt-2 mb-1 font-medium text-sm text-muted-foreground">Services & Businesses</div>
                      <IconRadioItem value="FaStore" icon={<FaStore size={20} />} label="Store" />
                      <IconRadioItem value="FaUtensils" icon={<FaUtensils size={20} />} label="Restaurant" />
                      <IconRadioItem value="FaShoppingCart" icon={<FaShoppingCart size={20} />} label="Shopping" />
                      <IconRadioItem value="FaHospital" icon={<FaHospital size={20} />} label="Hospital" />
                      <IconRadioItem value="FaTooth" icon={<FaTooth size={20} />} label="Dental" />
                      <IconRadioItem value="FaClinicMedical" icon={<FaClinicMedical size={20} />} label="Medical" />
                      <IconRadioItem value="FaGraduationCap" icon={<FaGraduationCap size={20} />} label="Education" />
                      <IconRadioItem value="FaBank" icon={<FaBank size={20} />} label="Bank" />
                      
                      {/* Home & Property Icons */}
                      <div className="col-span-4 mt-2 mb-1 font-medium text-sm text-muted-foreground">Home & Property</div>
                      <IconRadioItem value="FaHome" icon={<FaHome size={20} />} label="Home" />
                      <IconRadioItem value="FaHouseUser" icon={<FaHouseUser size={20} />} label="House" />
                      <IconRadioItem value="FaTools" icon={<FaTools size={20} />} label="Tools" />
                      <IconRadioItem value="FaHammer" icon={<FaHammer size={20} />} label="Hammer" />
                      <IconRadioItem value="FaWrench" icon={<FaWrench size={20} />} label="Wrench" />
                      <IconRadioItem value="FaPaintBrush" icon={<FaPaintBrush size={20} />} label="Paint" />
                      <IconRadioItem value="FaCouch" icon={<FaCouch size={20} />} label="Furniture" />
                      <IconRadioItem value="FaKey" icon={<FaKey size={20} />} label="Key" />
                      
                      {/* Transportation Icons */}
                      <div className="col-span-4 mt-2 mb-1 font-medium text-sm text-muted-foreground">Transportation</div>
                      <IconRadioItem value="FaCar" icon={<FaCar size={20} />} label="Car" />
                      <IconRadioItem value="FaCarAlt" icon={<FaCarAlt size={20} />} label="Car Alt" />
                      <IconRadioItem value="FaTruck" icon={<FaTruck size={20} />} label="Truck" />
                      <IconRadioItem value="FaTaxi" icon={<FaTaxi size={20} />} label="Taxi" />
                      <IconRadioItem value="FaBus" icon={<FaSubway size={20} />} label="Bus" />
                      <IconRadioItem value="FaTrain" icon={<FaTrain size={20} />} label="Train" />
                      <IconRadioItem value="FaBicycle" icon={<FaBicycle size={20} />} label="Bicycle" />
                      <IconRadioItem value="FaPlane" icon={<FaPlane size={20} />} label="Plane" />
                      
                      {/* Community & Social Icons */}
                      <div className="col-span-4 mt-2 mb-1 font-medium text-sm text-muted-foreground">Community & Social</div>
                      <IconRadioItem value="FaUsers" icon={<FaComments size={20} />} label="Users" />
                      <IconRadioItem value="FaHeart" icon={<FaHeart size={20} />} label="Heart" />
                      <IconRadioItem value="FaHandsHelping" icon={<FaHandsHelping size={20} />} label="Helping" />
                      <IconRadioItem value="FaDog" icon={<FaDog size={20} />} label="Pet" />
                      <IconRadioItem value="FaPaw" icon={<FaPaw size={20} />} label="Paw" />
                      <IconRadioItem value="FaVihara" icon={<FaVihara size={20} />} label="Religion" />
                      <IconRadioItem value="FaRunning" icon={<FaRunning size={20} />} label="Activity" />
                      <IconRadioItem value="FaFootballBall" icon={<FaGolfBall size={20} />} label="Sports" />
                      
                      {/* Technology Icons */}
                      <div className="col-span-4 mt-2 mb-1 font-medium text-sm text-muted-foreground">Technology</div>
                      <IconRadioItem value="FaDesktop" icon={<FaDesktop size={20} />} label="Computer" />
                      <IconRadioItem value="FaMobile" icon={<FaMobile size={20} />} label="Mobile" />
                      <IconRadioItem value="FaWifi" icon={<FaWifi size={20} />} label="WiFi" />
                      <IconRadioItem value="FaTv" icon={<FaTv size={20} />} label="TV" />
                      <IconRadioItem value="FaLaptop" icon={<FaLaptop size={20} />} label="Laptop" />
                      <IconRadioItem value="FaNetworkWired" icon={<FaNetworkWired size={20} />} label="Network" />
                      <IconRadioItem value="FaMicrochip" icon={<FaMicrochip size={20} />} label="Chip" />
                      <IconRadioItem value="FaPowerOff" icon={<FaPowerOff size={20} />} label="Power" />

                      {/* Safety & Emergency */}
                      <div className="col-span-4 mt-2 mb-1 font-medium text-sm text-muted-foreground">Safety & Emergency</div>
                      <IconRadioItem value="FaAmbulance" icon={<FaAmbulance size={20} />} label="Ambulance" />
                      <IconRadioItem value="FaFireExtinguisher" icon={<FaFireExtinguisher size={20} />} label="Fire" />
                      <IconRadioItem value="FaShieldAlt" icon={<FaShieldAlt size={20} />} label="Shield" />
                      <IconRadioItem value="FaHeartbeat" icon={<FaHeartbeat size={20} />} label="Heartbeat" />
                    </RadioGroup>
                  </ScrollArea>
                </div>
                <p className="text-sm text-muted-foreground">
                  Choose an icon that best represents this category.
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
                community category from the database.
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