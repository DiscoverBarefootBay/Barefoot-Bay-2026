import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LocationPicker } from "@/components/calendar/location-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import { insertListingSchema, type RealEstateListing } from "@shared/schema";

type Props = {
  onSubmit: (data: typeof insertListingSchema._type & { mediaFiles?: FileList | null }) => void;
  isSubmitting?: boolean;
  defaultValues?: RealEstateListing;
};

function formatPhoneNumber(value: string) {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length >= 10) {
    return `(${numbers.slice(0,3)}) ${numbers.slice(3,6)}-${numbers.slice(6,10)}`;
  } else if (numbers.length >= 6) {
    return `(${numbers.slice(0,3)}) ${numbers.slice(3,6)}-${numbers.slice(6)}`;
  } else if (numbers.length >= 3) {
    return `(${numbers.slice(0,3)}) ${numbers.slice(3)}`;
  }
  return numbers;
}

export function CreateListingForm({ onSubmit, isSubmitting, defaultValues }: Props) {
  const [listingType, setListingType] = useState<string | undefined>(defaultValues?.listingType);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [currentPhotos, setCurrentPhotos] = useState<string[]>(defaultValues?.photos || []);

  const form = useForm<typeof insertListingSchema._type>({
    resolver: zodResolver(insertListingSchema),
    defaultValues: {
      listingType: defaultValues?.listingType,
      title: defaultValues?.title || "",
      price: defaultValues?.price || 0,
      address: defaultValues?.address || "",
      bedrooms: defaultValues?.bedrooms || 0,
      bathrooms: defaultValues?.bathrooms || 0,
      squareFeet: defaultValues?.squareFeet || 0,
      yearBuilt: defaultValues?.yearBuilt || 0,
      description: defaultValues?.description || "",
      photos: defaultValues?.photos || [],
      contactInfo: {
        name: defaultValues?.contactInfo?.name || "",
        phone: defaultValues?.contactInfo?.phone || "",
        email: defaultValues?.contactInfo?.email || "",
      },
      cashOnly: defaultValues?.cashOnly || false,
    },
  });

  // Update form values when defaultValues change
  useEffect(() => {
    if (defaultValues) {
      form.reset({
        listingType: defaultValues.listingType,
        title: defaultValues.title,
        price: defaultValues.price,
        address: defaultValues.address || "",
        bedrooms: defaultValues.bedrooms || 0,
        bathrooms: defaultValues.bathrooms || 0,
        squareFeet: defaultValues.squareFeet || 0,
        yearBuilt: defaultValues.yearBuilt || 0,
        description: defaultValues.description || "",
        photos: defaultValues.photos || [],
        contactInfo: {
          name: defaultValues.contactInfo?.name || "",
          phone: defaultValues.contactInfo?.phone || "",
          email: defaultValues.contactInfo?.email || "",
        },
        cashOnly: defaultValues.cashOnly || false,
      });
      setListingType(defaultValues.listingType);
      setCurrentPhotos(defaultValues.photos || []);
    }
  }, [defaultValues, form]);

  const isPropertyListing = listingType && ['FSBO', 'Agent', 'Rent', 'OpenHouse'].includes(listingType);

  const handleListingTypeChange = (value: string) => {
    setListingType(value);
    form.setValue('listingType', value as any);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(e.target.files);
    }
  };

  const handleRemovePhoto = (photoUrl: string) => {
    // Filter out the photo to be removed
    const updatedPhotos = currentPhotos.filter(url => url !== photoUrl);
    // Update the state and form values
    setCurrentPhotos(updatedPhotos);
    form.setValue('photos', updatedPhotos);
  };

  const handleSubmit = (data: typeof insertListingSchema._type) => {
    // Ensure all numeric fields are properly typed
    const formattedData = {
      ...data,
      price: Number(data.price),
      bedrooms: Number(data.bedrooms),
      bathrooms: Number(data.bathrooms),
      squareFeet: Number(data.squareFeet),
      yearBuilt: Number(data.yearBuilt),
      contactInfo: {
        name: data.contactInfo?.name?.trim(),
        phone: data.contactInfo?.phone?.trim(),
        email: data.contactInfo?.email?.trim(),
      },
      // Use currentPhotos instead of data.photos to reflect deletions
      photos: currentPhotos,
      // Include the selected files
      mediaFiles: selectedFiles
    };
    onSubmit(formattedData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="space-y-6">
          {/* Listing Type */}
          <FormField
            control={form.control}
            name="listingType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Listing Type</FormLabel>
                <Select onValueChange={handleListingTypeChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="FSBO">For Sale By Owner</SelectItem>
                    <SelectItem value="Agent">For Sale By Agent</SelectItem>
                    <SelectItem value="Rent">For Rent</SelectItem>
                    <SelectItem value="OpenHouse">Open House</SelectItem>
                    <SelectItem value="Wanted">Wanted</SelectItem>
                    <SelectItem value="Classified">Classified</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ''} placeholder="Enter listing title" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {isPropertyListing && (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                            field.onChange(value);
                          }}
                          placeholder="Enter price"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <LocationPicker
                          value={field.value || ''}
                          onChange={field.onChange}
                          placeholder="Enter property address"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid md:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="bedrooms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bedrooms</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                            field.onChange(value);
                          }}
                          placeholder="0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bathrooms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bathrooms</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                            field.onChange(value);
                          }}
                          placeholder="0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="squareFeet"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Square Feet</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                            field.onChange(value);
                          }}
                          placeholder="0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="yearBuilt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year Built</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1900"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value === '' ? undefined : parseInt(e.target.value);
                            field.onChange(value);
                          }}
                          placeholder="Year"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </>
          )}

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter listing description"
                    className="min-h-[100px] resize-y"
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Add Media Upload Section */}
          <FormField
            control={form.control}
            name="photos"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Property Photos & Videos</FormLabel>
                <FormControl>
                  <Input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleFileChange}
                  />
                </FormControl>
                {currentPhotos.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground">Current files:</p>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {currentPhotos.map((url, index) => (
                        <div key={index} className="group relative border rounded overflow-hidden">
                          <div className="aspect-video relative bg-muted">
                            <img 
                              src={url} 
                              alt={`Property photo ${index + 1}`}
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          </div>
                          <div className="p-2 flex items-center justify-between bg-card">
                            <span className="text-sm truncate max-w-[200px]">{url.split('/').pop()}</span>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleRemovePhoto(url)}
                              type="button"
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              onClick={() => handleRemovePhoto(url)}
                              type="button"
                              className="transform translate-y-4 group-hover:translate-y-0 transition-transform"
                            >
                              Delete Photo
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Contact Information</h3>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="contactInfo.name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter contact name" 
                        {...field} 
                        value={field.value || ''} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactInfo.phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="(555) 555-5555"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => {
                          const formatted = formatPhoneNumber(e.target.value);
                          field.onChange(formatted);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactInfo.email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : defaultValues ? "Update Listing" : "Create Listing"}
          </Button>
        </div>
      </form>
    </Form>
  );
}