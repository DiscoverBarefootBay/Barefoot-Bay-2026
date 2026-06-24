import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useEffect, useState } from 'react';

// Form schema for validation
const formSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type FormData = z.infer<typeof formSchema>;

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize the form
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  });

  // State to store response data for user feedback
  const [responseData, setResponseData] = useState<{
    emailExists?: boolean;
    email?: string;
    message?: string;
  }>({});

  // Form submission handler
  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/password-reset/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to request password reset');
      }
      
      const result = await response.json();
      setResponseData(result);
      setSubmitted(true);
    } catch (error) {
      console.error('Error requesting password reset:', error);
      toast({
        title: 'Error',
        description: 'There was a problem processing your request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container max-w-md py-12 mx-auto">
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Reset Your Password</CardTitle>
          <CardDescription>
            Enter your email address and we'll send you a link to reset your password.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {submitted ? (
            <Alert>
              <AlertDescription>
                {responseData.emailExists === false ? (
                  <>
                    No account was found with that email address. Please check the email or register for an account.
                    <div className="mt-4">
                      <Button 
                        onClick={() => {
                          setSubmitted(false);
                          form.reset({ email: '' });
                        }} 
                        className="w-full"
                      >
                        Try Again
                      </Button>
                    </div>
                  </>
                ) : responseData.email ? (
                  <>
                    A password reset link has been sent to <strong>{responseData.email}</strong>. Please check your email and follow the instructions.
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> If you don't see the email in your inbox, please check your spam/junk folder as password reset emails are sometimes filtered there.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    If an account with that email exists, we've sent you instructions on how to reset your password. Please check your email.
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> If you don't see the email in your inbox, please check your spam/junk folder as password reset emails are sometimes filtered there.
                      </p>
                    </div>
                  </>
                )}
              </AlertDescription>
            </Alert>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="john@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>

        <CardFooter className="flex justify-center">
          <div className="text-sm text-center">
            <Link href="/auth" className="text-primary hover:underline">
              Return to login
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}