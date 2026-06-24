import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Loader2, Save, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

// Form validation schema
const formSchema = z.object({
  squareAccessToken: z.string().min(1, 'Access Token is required'),
  squareApplicationId: z.string().min(1, 'Application ID is required'),
  squareLocationId: z.string().min(1, 'Location ID is required'),
});

export default function SquareApiEditor() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form setup
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      squareAccessToken: '',
      squareApplicationId: '',
      squareLocationId: '',
    },
  });

  // Get current values
  const fetchCurrentValues = async () => {
    try {
      const response = await fetch('/api/payments/square-env');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch current values: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Update form values
      form.setValue('squareAccessToken', data.squareAccessToken || '');
      form.setValue('squareApplicationId', data.squareApplicationId || '');
      form.setValue('squareLocationId', data.squareLocationId || '');
    } catch (err) {
      console.error('Error fetching Square API credentials:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch current values');
    }
  };

  // Fetch current values when component mounts
  useEffect(() => {
    fetchCurrentValues();
  }, []);

  // Handle form submission
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/payments/square-env', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update Square API credentials: ${response.status} ${response.statusText}`);
      }
      
      toast({
        title: 'Square API credentials updated',
        description: 'Your changes have been saved successfully.',
      });
    } catch (err) {
      console.error('Error updating Square API credentials:', err);
      setError(err instanceof Error ? err.message : 'Failed to update Square API credentials');
      
      toast({
        title: 'Error',
        description: 'Failed to update Square API credentials. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Key className="h-5 w-5 mr-2" />
          Square API Credentials
        </CardTitle>
        <CardDescription>
          Update your Square API credentials for payment processing
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="squareAccessToken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Square Access Token</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter your Square Access Token" 
                      {...field} 
                      type="password"
                    />
                  </FormControl>
                  <FormDescription>
                    Your private access token from Square Developer Dashboard
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="squareApplicationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Square Application ID</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter your Square Application ID" 
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Your application ID from Square Developer Dashboard
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="squareLocationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Square Location ID</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter your Square Location ID" 
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The ID of your business location in Square
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end">
              <Button 
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Credentials
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}