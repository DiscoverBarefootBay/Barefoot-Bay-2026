import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Link, useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';

// Form schema for validation
const formSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must include at least one lowercase letter, one uppercase letter, and one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof formSchema>;

export default function ResetPasswordPage() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  // Initialize the form
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  // Extract token and email from URL
  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');
    const email = url.searchParams.get('email');

    if (!token || !email) {
      toast({
        title: 'Invalid Link',
        description: 'The reset link appears to be invalid. Please request a new password reset link.',
        variant: 'destructive',
      });
      setIsValidating(false);
      return;
    }

    setToken(token);
    setEmail(email);

    // Validate the token
    const validateToken = async () => {
      try {
        const response = await fetch('/api/password-reset/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token, email }),
        });

        const result = await response.json();
        
        if (result.valid) {
          setTokenValid(true);
        } else {
          setTokenValid(false);
          toast({
            title: 'Invalid or Expired Link',
            description: 'The reset link is invalid or has expired. Please request a new password reset link.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Error validating token:', error);
        setTokenValid(false);
        toast({
          title: 'Error',
          description: 'There was a problem validating your reset link. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [toast]);

  // Form submission handler
  const onSubmit = async (data: FormData) => {
    if (!token || !email) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/password-reset/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          email,
          newPassword: data.password,
        }),
      });

      const result = await response.json();
      
      setResetComplete(true);
      toast({
        title: 'Success',
        description: 'Your password has been reset successfully. You can now log in with your new password.',
      });
    } catch (error) {
      console.error('Error resetting password:', error);
      toast({
        title: 'Error',
        description: 'There was a problem resetting your password. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Redirect to login after completing reset
  useEffect(() => {
    if (resetComplete) {
      // Use setLocation for client-side routing to prevent 404 errors
      // This uses wouter's routing which respects the application's base path
      const timer = setTimeout(() => {
        setLocation('/auth');
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [resetComplete, setLocation]);

  // Show loading state
  if (isValidating) {
    return (
      <div className="container max-w-md py-12 mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Reset Your Password</CardTitle>
            <CardDescription>
              Validating your reset link...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-md py-12 mx-auto">
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Reset Your Password</CardTitle>
          <CardDescription>
            {resetComplete 
              ? 'Your password has been reset successfully.' 
              : tokenValid 
                ? 'Enter your new password below.' 
                : 'Invalid or expired reset link.'
            }
          </CardDescription>
        </CardHeader>

        <CardContent>
          {!tokenValid ? (
            <Alert>
              <AlertDescription>
                The password reset link is invalid or has expired. Please request a new link.
              </AlertDescription>
            </Alert>
          ) : resetComplete ? (
            <Alert>
              <AlertDescription className="text-green-600">
                Your password has been reset successfully. You are being redirected to the sign-in page...
              </AlertDescription>
            </Alert>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Resetting...' : 'Reset Password'}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>

        <CardFooter className="flex justify-center">
          <div className="text-sm text-center">
            <Link href="/auth" className="text-primary hover:underline">
              Return to sign-in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}