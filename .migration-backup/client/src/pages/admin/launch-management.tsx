import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarClock, Upload, Volume2, Volume, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminLayout from '@/components/layouts/admin-layout';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useUnsavedChangesPrompt } from '@/hooks/use-unsaved-changes-prompt';

// Form validation schema
const formSchema = z.object({
  launchDate: z.string().min(1, "Launch date is required"),
  launchMessage: z.string().min(3, "Launch message is required"),
  rocketIcon: z.string().optional(),
  soundEnabled: z.boolean().default(false),
  isActive: z.boolean().default(false),
});

type LaunchSettings = z.infer<typeof formSchema>;

export default function LaunchManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [previewURL, setPreviewURL] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [isManualLaunch, setIsManualLaunch] = useState(false);
  
  // Fetch current launch settings
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/launch/settings'],
    retry: 1,
  });
  
  // Create form with default values
  const form = useForm<LaunchSettings>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      launchDate: new Date(Date.now() + 86400000).toISOString().substring(0, -1),
      launchMessage: 'Get ready for takeoff!',
      rocketIcon: '',
      soundEnabled: false,
      isActive: false,
    },
  });
  
  // When data is loaded, update form values
  useEffect(() => {
    if (data?.success && data.settings) {
      const settings = data.settings;
      
      // Convert ISO date to local datetime-local format
      const launchDateISO = settings.launchDate;
      const launchDate = new Date(launchDateISO);
      // Format as YYYY-MM-DDTHH:MM - compatible with datetime-local input
      const formattedDate = launchDate.toISOString().slice(0, 16);
      
      form.reset({
        launchDate: formattedDate,
        launchMessage: settings.launchMessage,
        rocketIcon: settings.rocketIcon,
        soundEnabled: settings.soundEnabled,
        isActive: settings.isActive,
      });
      
      setPreviewURL(settings.rocketIcon);
    }
  }, [data, form]);
  
  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async (data: LaunchSettings) => {
      // Convert datetime-local format to ISO format
      const formattedDate = new Date(data.launchDate).toISOString();
      
      const response = await apiRequest('POST', '/api/launch/settings', {
        ...data,
        launchDate: formattedDate,
      });
      return response.json();
    },
    onSuccess: (_data, submittedValues) => {
      // Reset the form to the values we just persisted so
      // `formState.isDirty` flips back to false immediately and the
      // unsaved-changes prompt doesn't fire during the brief window
      // before the refetched settings arrive.
      form.reset(submittedValues);
      toast({
        title: 'Settings Saved',
        description: 'Launch configuration has been updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/launch/settings'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to save settings: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
  
  // Manual launch trigger mutation
  const triggerLaunchMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/launch/trigger', {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Launch Initiated!',
        description: 'Manual launch has been triggered successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/launch/settings'] });
      
      // Update form with new launch date
      if (data.launchDate) {
        form.setValue('launchDate', new Date(data.launchDate).toISOString().slice(0, 16));
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to trigger launch: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
  
  // Handle form submission
  const onSubmit = (values: LaunchSettings) => {
    saveMutation.mutate(values);
  };

  // Warn before navigating away (router transition, back button, browser
  // unload) while the form has edits that haven't been saved or discarded.
  // react-hook-form clears `isDirty` after `form.reset` is called with the
  // saved values, so this naturally toggles off once changes are persisted.
  const unsavedChangesDialog = useUnsavedChangesPrompt(form.formState.isDirty, {
    title: 'Unsaved launch settings',
    description:
      'You have unsaved changes to the launch screen settings. If you leave now, your edits will be lost.',
    confirmLabel: 'Discard & Leave',
    cancelLabel: 'Stay on Page',
  });
  
  // Handle manual launch trigger
  const handleTriggerLaunch = () => {
    setIsManualLaunch(true);
    
    // Ask for confirmation before proceeding
    setTimeout(() => {
      if (confirm('Are you sure you want to trigger an immediate launch? This will override the scheduled date.')) {
        triggerLaunchMutation.mutate();
      } else {
        setIsManualLaunch(false);
      }
    }, 0);
  };
  
  // Handle rocket icon URL change
  const handleRocketIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    form.setValue('rocketIcon', url);
    setPreviewURL(url);
  };
  
  return (
    <AdminLayout>
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col space-y-2">
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <img 
              src="/uploads/icons/Asset1.svg" 
              alt="Rocket" 
              className="h-8 w-8 text-primary" 
              onError={(e) => {
                console.error("Failed to load Asset1.svg in header, retrying");
                // If it fails, try again with the same source
                e.currentTarget.src = "/uploads/icons/Asset1.svg";
              }}
            />
            Launch Screen Management
          </h2>
          <p className="text-muted-foreground">
            Configure the rocket countdown launch screen for your website
          </p>
        </div>
        
        <Separator />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main settings form */}
          <div className="md:col-span-2">
            <Tabs defaultValue="settings">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              
              <TabsContent value="settings">
                <Card>
                  <CardHeader>
                    <CardTitle>Launch Configuration</CardTitle>
                    <CardDescription>
                      Set up when and how the launch screen will appear
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                          control={form.control}
                          name="launchDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Launch Date & Time</FormLabel>
                              <FormControl>
                                <div className="flex items-center space-x-2">
                                  <Input
                                    type="datetime-local"
                                    {...field}
                                    disabled={isManualLaunch}
                                  />
                                  <CalendarClock className="h-5 w-5 text-muted-foreground" />
                                </div>
                              </FormControl>
                              <FormDescription>
                                When the countdown will reach zero and the rocket will launch
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="launchMessage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Launch Message</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Enter the message to display on the launch screen"
                                  className="resize-none"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                This message will be prominently displayed above the countdown
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="rocketIcon"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Custom Rocket Icon URL (Optional)</FormLabel>
                              <FormControl>
                                <div className="flex items-center space-x-2">
                                  <Input
                                    placeholder="Enter URL to a custom rocket image"
                                    {...field}
                                    onChange={handleRocketIconChange}
                                  />
                                  <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="icon"
                                    onClick={() => setShowPreview(!showPreview)}
                                  >
                                    {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </FormControl>
                              <FormDescription>
                                Leave empty to use the default rocket icon
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="flex flex-col space-y-4">
                          <FormField
                            control={form.control}
                            name="soundEnabled"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base flex items-center">
                                    {field.value ? (
                                      <Volume2 className="h-5 w-5 mr-2" />
                                    ) : (
                                      <Volume className="h-5 w-5 mr-2" />
                                    )}
                                    Sound Effects
                                  </FormLabel>
                                  <FormDescription>
                                    Enable sound effects during launch
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="isActive"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">Activate Launch Screen</FormLabel>
                                  <FormDescription>
                                    When enabled, all users will see the launch screen
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="flex justify-between pt-4">
                          <Button 
                            type="button" 
                            variant="destructive"
                            onClick={handleTriggerLaunch}
                            disabled={triggerLaunchMutation.isPending || saveMutation.isPending}
                          >
                            {triggerLaunchMutation.isPending ? 'Launching...' : 'Launch Now'}
                          </Button>
                          
                          <Button 
                            type="submit"
                            disabled={saveMutation.isPending}
                          >
                            {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="preview">
                <Card>
                  <CardHeader>
                    <CardTitle>Preview Launch Screen</CardTitle>
                    <CardDescription>
                      See what your launch page will look like
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <Button 
                      variant="default"
                      className="mt-4"
                      onClick={() => window.open('/launch', '_blank')}
                    >
                      Open Launch Page in New Tab
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Sidebar */}
          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Rocket Icon Preview</CardTitle>
                <CardDescription>
                  {previewURL ? 'Current custom rocket image' : 'Using default rocket icon'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                {showPreview && previewURL ? (
                  <div className="border rounded-md p-2">
                    <img 
                      src={previewURL} 
                      alt="Rocket Icon" 
                      className="max-w-full max-h-40 object-contain"
                      onError={() => {
                        toast({
                          title: 'Image Error',
                          description: 'The custom rocket image URL is invalid or inaccessible',
                          variant: 'destructive',
                        });
                        console.log("Using default rocket icon");
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center bg-primary text-primary-foreground rounded-full p-4">
                    <img 
                      src="/uploads/icons/Asset1.svg" 
                      alt="Default Rocket Icon" 
                      className="h-20 w-20" 
                      onError={(e) => {
                        console.error("Failed to load Asset1.svg in preview, retrying");
                        // If it fails, try again with the same source
                        e.currentTarget.src = "/uploads/icons/Asset1.svg";
                      }}
                    />
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col space-y-2">
                <p className="text-sm text-muted-foreground">
                  For best results, use a transparent PNG or SVG file.
                </p>
                <Separator />
                <p className="text-sm text-muted-foreground mt-2">
                  Countdown starts: {form.watch('launchDate')}
                </p>
              </CardFooter>
            </Card>
            
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>How It Works</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <ul className="list-disc pl-5 space-y-2">
                  <li>The countdown will automatically start based on the launch date you set</li>
                  <li>When the countdown reaches zero, the rocket will launch and reveal your homepage</li>
                  <li>Admins can view the launch page at any time for testing</li>
                  <li>Regular users will only see it when you activate the feature</li>
                  <li>Use "Launch Now" to override the countdown and trigger an immediate launch</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      {unsavedChangesDialog}
    </AdminLayout>
  );
}