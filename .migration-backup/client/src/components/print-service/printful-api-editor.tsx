import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2, ShoppingBag, CheckCircle2, XCircle } from 'lucide-react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

// Schema for form validation
const printfulApiSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  storeId: z.string().min(1, 'Store ID is required')
});

type PrintfulApiFormValues = z.infer<typeof printfulApiSchema>;

export default function PrintfulApiEditor() {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasConfig, setHasConfig] = useState(false);

  // Form setup with validation
  const form = useForm<PrintfulApiFormValues>({
    resolver: zodResolver(printfulApiSchema),
    defaultValues: {
      apiKey: '',
      storeId: ''
    }
  });

  // Fetch current configuration (only if has API key)
  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/printful/config', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        
        if (data.hasApiKey) {
          setHasConfig(true);
          
          // If store ID is available, pre-fill it
          if (data.storeId) {
            form.setValue('storeId', data.storeId);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching Printful configuration:', err);
    }
  };

  // Call fetchConfig when component mounts
  useEffect(() => {
    fetchConfig();
  }, []);

  // Form submission handler
  const onSubmit = async (values: PrintfulApiFormValues) => {
    setIsLoading(true);
    setSuccess(null);
    setError(null);
    
    try {
      const response = await fetch('/api/printful/update-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(values),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update Printful API configuration');
      }
      
      const result = await response.json();
      setSuccess('Printful API credentials updated successfully');
      setHasConfig(true);
    } catch (err) {
      console.error('Error updating Printful API configuration:', err);
      setError(err instanceof Error ? err.message : 'Failed to update Printful API configuration');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center">
          <ShoppingBag className="h-5 w-5 mr-2" />
          Printful API Configuration
        </CardTitle>
        <CardDescription>
          {hasConfig 
            ? "Update your Printful API credentials for the print-on-demand service integration" 
            : "Configure your Printful API credentials to enable the print-on-demand service"}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {success && (
          <Alert className="mb-4 bg-green-50 text-green-800 border-green-200">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
        
        {error && (
          <Alert variant="destructive" className="mb-4">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Printful API Key</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={hasConfig ? "••••••••••••••••••••••••••••••••" : "Enter your Printful API key"}
                      type="password"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="storeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Store ID</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter your Printful Store ID"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {hasConfig ? 'Update API Credentials' : 'Save API Credentials'}
              </Button>
            </div>
          </form>
        </Form>
        
        <div className="mt-6 pt-6 border-t border-gray-200 text-sm text-gray-500">
          <p className="mb-2">
            <strong>How to get your Printful API key:</strong>
          </p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Log in to your Printful account</li>
            <li>Go to Settings &gt; API</li>
            <li>Generate a new API key</li>
            <li>Copy and paste the API key here</li>
          </ol>
          <p className="mt-2">
            <strong>Note:</strong> For security reasons, the API key is never displayed after being saved.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}