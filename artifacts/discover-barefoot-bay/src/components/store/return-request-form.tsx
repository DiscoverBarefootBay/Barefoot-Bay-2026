import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { ReturnReason } from "@shared/schema";
import { Loader2 } from "lucide-react";

// The schema defines the validation rules for our form
const returnRequestSchema = z.object({
  orderId: z.string().nonempty("Order ID is required"),
  reason: z.enum([
    ReturnReason.WRONG_SIZE, 
    ReturnReason.WRONG_ITEM, 
    ReturnReason.DEFECTIVE, 
    ReturnReason.NOT_AS_DESCRIBED, 
    ReturnReason.CHANGED_MIND, 
    ReturnReason.OTHER
  ], {
    required_error: "Please select a reason for your return",
  }),
  reasonDetails: z.string().min(10, "Please provide more details about the return reason").max(1000, "Details should be less than 1000 characters"),
  notes: z.string().optional(),
  items: z.array(z.object({
    orderItemId: z.number(),
    quantity: z.number().min(1, "Quantity must be at least 1"),
    reason: z.enum([
      ReturnReason.WRONG_SIZE, 
      ReturnReason.WRONG_ITEM, 
      ReturnReason.DEFECTIVE, 
      ReturnReason.NOT_AS_DESCRIBED, 
      ReturnReason.CHANGED_MIND, 
      ReturnReason.OTHER
    ]),
    reasonDetails: z.string().optional(),
  })).min(1, "Please select at least one item to return"),
});

type ReturnRequestFormValues = z.infer<typeof returnRequestSchema>;

interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  variant: string;
  price: string;
  quantity: number;
  imageUrl?: string;
}

interface ReturnRequestFormProps {
  order: {
    id: number;
    items: OrderItem[];
  };
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ReturnRequestForm({ order, onSuccess, onCancel }: ReturnRequestFormProps) {
  const [images, setImages] = useState<File[]>([]);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Initialize the form with default values
  const form = useForm<ReturnRequestFormValues>({
    resolver: zodResolver(returnRequestSchema),
    defaultValues: {
      orderId: order.id.toString(),
      reason: ReturnReason.WRONG_SIZE,
      reasonDetails: "",
      notes: "",
      items: [],
    }
  });
  
  // Handle file input changes
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileList = Array.from(e.target.files);
      
      // Limit to 5 images
      if (images.length + fileList.length > 5) {
        toast({
          title: "Too many images",
          description: "You can upload a maximum of 5 images",
          variant: "destructive",
        });
        return;
      }
      
      // Check file types and sizes
      const validFiles = fileList.filter(file => {
        const isValidType = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type);
        const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB max
        
        if (!isValidType) {
          toast({
            title: "Invalid file type",
            description: `${file.name} is not a valid image file (JPEG, PNG, or WebP)`,
            variant: "destructive",
          });
        }
        
        if (!isValidSize) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds the 5MB size limit`,
            variant: "destructive",
          });
        }
        
        return isValidType && isValidSize;
      });
      
      setImages(prev => [...prev, ...validFiles]);
    }
  };
  
  // Remove an image from the list
  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };
  
  // Toggle an item selection for return
  const toggleItemSelection = (itemId: number) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        // If already selected, remove it
        return prev.filter(id => id !== itemId);
      } else {
        // Otherwise add it
        return [...prev, itemId];
      }
    });
    
    // Also update the form's items array
    const currentItems = form.getValues("items");
    const orderItem = order.items.find(item => item.id === itemId);
    
    if (!orderItem) return;
    
    if (currentItems.some(item => item.orderItemId === itemId)) {
      // Remove this item
      form.setValue("items", currentItems.filter(item => item.orderItemId !== itemId));
    } else {
      // Add this item with defaults
      form.setValue("items", [
        ...currentItems,
        {
          orderItemId: itemId,
          quantity: 1, // Default to returning 1
          reason: form.getValues("reason"), // Use the same reason as the main form
          reasonDetails: "", // Can be empty initially
        }
      ]);
    }
  };
  
  // Update item quantity for returns
  const updateItemQuantity = (itemId: number, quantity: number) => {
    const currentItems = form.getValues("items");
    const orderItem = order.items.find(item => item.id === itemId);
    
    if (!orderItem) return;
    
    // Ensure quantity doesn't exceed what was ordered
    const safeQuantity = Math.min(quantity, orderItem.quantity);
    
    // Update the quantity
    form.setValue("items", currentItems.map(item => {
      if (item.orderItemId === itemId) {
        return { ...item, quantity: safeQuantity };
      }
      return item;
    }));
  };
  
  // Handle form submission
  const onSubmit = async (data: ReturnRequestFormValues) => {
    if (selectedItems.length === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one item to return",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Create a FormData object for file uploads
      const formData = new FormData();
      
      // Add the form data as JSON
      formData.append("orderId", data.orderId);
      formData.append("reason", data.reason);
      formData.append("reasonDetails", data.reasonDetails);
      
      if (data.notes) {
        formData.append("notes", data.notes);
      }
      
      // Add the items as JSON
      formData.append("items", JSON.stringify(data.items));
      
      // Add images if any
      images.forEach(image => {
        formData.append("images", image);
      });
      
      // Submit the form
      const response = await apiRequest("/api/returns", {
        method: "POST",
        body: formData,
        // Don't set Content-Type as the browser will set it with the boundary
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit return request");
      }
      
      // Return created successfully
      toast({
        title: "Return request submitted",
        description: "Your return request has been submitted successfully",
      });
      
      // Invalidate queries to refetch returns
      queryClient.invalidateQueries({ queryKey: ['/api/returns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/returns/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      
      // Call the success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error submitting return request:", error);
      toast({
        title: "Failed to submit return",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Return Request</h2>
          <p className="text-muted-foreground">
            Please provide the details for your return request. You can request a return for one or more items from your order.
          </p>
          
          {/* Return Reason */}
          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Return Reason</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={ReturnReason.WRONG_SIZE}>Wrong Size</SelectItem>
                    <SelectItem value={ReturnReason.WRONG_ITEM}>Wrong Item</SelectItem>
                    <SelectItem value={ReturnReason.DEFECTIVE}>Defective</SelectItem>
                    <SelectItem value={ReturnReason.NOT_AS_DESCRIBED}>Not As Described</SelectItem>
                    <SelectItem value={ReturnReason.CHANGED_MIND}>Changed My Mind</SelectItem>
                    <SelectItem value={ReturnReason.OTHER}>Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Return Reason Details */}
          <FormField
            control={form.control}
            name="reasonDetails"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason Details</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Please provide details about your return reason"
                    {...field}
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Additional Notes */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Additional Notes (Optional)</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Any additional information you'd like to provide"
                    {...field}
                    rows={2}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Image Upload */}
          <div className="space-y-2">
            <FormLabel>Return Images (Optional)</FormLabel>
            <p className="text-sm text-muted-foreground">
              Upload up to 5 images showing the issue with the product(s).
            </p>
            <Input 
              type="file" 
              accept="image/jpeg,image/png,image/jpg,image/webp" 
              multiple 
              onChange={handleFileChange}
              disabled={images.length >= 5}
            />
            
            {/* Display selected images */}
            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mt-2">
                {images.map((image, index) => (
                  <div key={index} className="relative">
                    <img 
                      src={URL.createObjectURL(image)} 
                      alt={`Return image ${index + 1}`}
                      className="w-full h-24 object-cover rounded" 
                    />
                    <Button 
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="absolute top-1 right-1 w-5 h-5"
                      onClick={() => removeImage(index)}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Select Items to Return */}
          <div className="space-y-2">
            <FormLabel>Select Items to Return</FormLabel>
            <p className="text-sm text-muted-foreground">
              Select one or more items from your order to return.
            </p>
            
            <div className="space-y-3">
              {order.items.map((item) => (
                <Card key={item.id} className={selectedItems.includes(item.id) ? "border-primary" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <input 
                          type="checkbox" 
                          id={`item-${item.id}`}
                          checked={selectedItems.includes(item.id)}
                          onChange={() => toggleItemSelection(item.id)}
                          className="h-5 w-5 rounded border-gray-300 mt-1"
                        />
                      </div>
                      
                      {item.imageUrl && (
                        <div className="flex-shrink-0">
                          <img 
                            src={item.imageUrl} 
                            alt={item.productName} 
                            className="w-16 h-16 object-cover rounded" 
                          />
                        </div>
                      )}
                      
                      <div className="flex-grow">
                        <h4 className="font-medium text-sm">{item.productName}</h4>
                        {item.variant && (
                          <p className="text-xs text-muted-foreground">Variant: {item.variant}</p>
                        )}
                        <p className="text-xs">Price: ${item.price && !isNaN(parseFloat(item.price)) ? parseFloat(item.price).toFixed(2) : '0.00'}</p>
                        <p className="text-xs">Quantity: {item.quantity}</p>
                      </div>
                    </div>
                    
                    {/* Quantity selector (only shown if item is selected) */}
                    {selectedItems.includes(item.id) && (
                      <div className="mt-3 pl-9">
                        <div className="space-y-2">
                          <Label htmlFor={`quantity-${item.id}`}>Return Quantity</Label>
                          <div className="flex items-center space-x-2">
                            <Select 
                              onValueChange={(value) => updateItemQuantity(item.id, parseInt(value))} 
                              defaultValue="1"
                            >
                              <SelectTrigger id={`quantity-${item.id}`} className="w-24">
                                <SelectValue placeholder="Quantity" />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: item.quantity }, (_, i) => (
                                  <SelectItem key={i + 1} value={(i + 1).toString()}>
                                    {i + 1}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span className="text-sm text-muted-foreground">
                              out of {item.quantity}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {form.formState.errors.items && (
              <p className="text-sm text-destructive">
                {form.formState.errors.items.message}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex justify-end space-x-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Return Request"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}