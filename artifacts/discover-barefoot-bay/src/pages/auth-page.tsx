import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, PartyPopper, Sparkles } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";
import { Button } from "@/components/ui/button";
import { insertUserSchema, type InsertUser } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Redirect } from "wouter";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect, useMemo, useRef, useCallback } from "react"; 
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useLocation } from "wouter";
import ReCAPTCHA from "react-google-recaptcha";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// Debounce hook for real-time validation
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// Confetti animation component
function ConfettiEffect() {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {[...Array(50)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-confetti"
          style={{
            left: `${Math.random() * 100}%`,
            top: '-10px',
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
          }}
        >
          <div
            className="w-3 h-3 rotate-45"
            style={{
              backgroundColor: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3'][Math.floor(Math.random() * 7)],
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        </div>
      ))}
      <style>{`
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti {
          animation: confetti linear forwards;
        }
      `}</style>
    </div>
  );
}

type LoginData = Pick<InsertUser, "username" | "password">;

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();
  
  // Check if there's a tab parameter in the URL - use state for controlled Tabs
  const initialTab = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('tab') === 'register' ? 'register' : 'login';
  }, []);
  
  const [activeTab, setActiveTab] = useState(initialTab);

  const loginForm = useForm<LoginData>({
    resolver: zodResolver(insertUserSchema.pick({ username: true, password: true })),
    defaultValues: {
      username: "",
      password: ""
    }
  });

  const [showBadgeHolderQuestions, setShowBadgeHolderQuestions] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [emailMismatch, setEmailMismatch] = useState(false);
  
  // Real-time validation states
  const [usernameInput, setUsernameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [usernameMessage, setUsernameMessage] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  
  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [registeredUsername, setRegisteredUsername] = useState("");
  
  // Debounced values for API calls
  const debouncedUsername = useDebounce(usernameInput, 500);
  const debouncedEmail = useDebounce(emailInput, 500);
  
  // Real-time username availability check
  useEffect(() => {
    if (!debouncedUsername || debouncedUsername.length < 3) {
      setUsernameStatus('idle');
      setUsernameMessage("");
      return;
    }
    
    const checkUsername = async () => {
      setUsernameStatus('checking');
      try {
        const response = await fetch(`/api/check-username?username=${encodeURIComponent(debouncedUsername)}`);
        const data = await response.json();
        if (data.available) {
          setUsernameStatus('available');
          setUsernameMessage(data.message);
        } else {
          setUsernameStatus('taken');
          setUsernameMessage(data.message);
        }
      } catch {
        setUsernameStatus('idle');
        setUsernameMessage("");
      }
    };
    
    checkUsername();
  }, [debouncedUsername]);
  
  // Real-time email availability check
  useEffect(() => {
    if (!debouncedEmail || !debouncedEmail.includes('@')) {
      setEmailStatus('idle');
      setEmailMessage("");
      return;
    }
    
    const checkEmail = async () => {
      setEmailStatus('checking');
      try {
        const response = await fetch(`/api/check-email?email=${encodeURIComponent(debouncedEmail)}`);
        const data = await response.json();
        if (data.available) {
          setEmailStatus('available');
          setEmailMessage(data.message);
        } else {
          setEmailStatus('taken');
          setEmailMessage(data.message);
        }
      } catch {
        setEmailStatus('idle');
        setEmailMessage("");
      }
    };
    
    checkEmail();
  }, [debouncedEmail]);

  // Fetch terms and privacy content - always enabled for registration flow
  const { data: termsPage, isLoading: termsLoading, isError: termsError } = useQuery<{ content: string }>({
    queryKey: ['/api/pages/terms-and-agreements'],
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });

  const { data: privacyPage, isLoading: privacyLoading, isError: privacyError } = useQuery<{ content: string }>({
    queryKey: ['/api/pages/privacy-policy'],
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });

  // Fetch social clubs for club membership selection
  const { data: socialClubs } = useQuery<{ id: number; slug: string; title: string }[]>({
    queryKey: ['/api/social-clubs']
  });

  // Track selected club memberships
  const [selectedClubs, setSelectedClubs] = useState<string[]>([]);

  const registerForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      fullName: "",
      email: "",
      username: "",
      password: "",
      phoneNumber: "",
      isResident: false,
      avatarUrl: null,
      // Resident verification fields
      isLocalResident: false,
      ownsHomeInBB: false,
      rentsHomeInBB: false,
      isFullTimeResident: false,
      isSnowbird: false,
      hasMembershipBadge: false,
      membershipBadgeNumber: "",
      buysDayPasses: false,
      // Non-resident fields
      hasLivedInBB: false,
      hasVisitedBB: false,
      neverVisitedBB: false,
      hasFriendsInBB: false,
      consideringMovingToBB: false,
      wantToDiscoverBB: false,
      neverHeardOfBB: false,
      // Bot detection fields
      honeypot: '',
      acceptedTerms: false,
      recaptchaToken: '',
      // Club memberships
      clubMemberships: []
    }
  });

  // Keep `acceptedTerms` as a real boolean in the form state. It is driven
  // solely by the terms + privacy acceptance state (set when the user clicks
  // "I Accept" in each modal). This is the single source of truth so the
  // z.boolean() schema can never receive a string and silently fail.
  useEffect(() => {
    registerForm.setValue("acceptedTerms", termsAccepted && privacyAccepted, {
      shouldValidate: registerForm.formState.isSubmitted,
    });
  }, [termsAccepted, privacyAccepted]);

  // Auto-calculate resident status based on survey answers
  useEffect(() => {
    const watchLocalResident = registerForm.watch("isLocalResident");
    const watchOwnsHome = registerForm.watch("ownsHomeInBB");
    const watchFullTime = registerForm.watch("isFullTimeResident");
    const watchSnowbird = registerForm.watch("isSnowbird");
    const watchMembershipBadge = registerForm.watch("hasMembershipBadge");

    // If any of these criteria are true, consider them a Badge Holder
    // Note: These criteria determine badge holder status but aren't explicitly shown to users
    const isBadgeHolderByCriteria = watchLocalResident || watchOwnsHome || watchFullTime || watchSnowbird || watchMembershipBadge;

    if (isBadgeHolderByCriteria) {
      registerForm.setValue("isResident", true);
    } else {
      registerForm.setValue("isResident", false);
    }

    // Show survey questions after the first section is filled out
    const username = registerForm.watch("username");
    const password = registerForm.watch("password");
    const email = registerForm.watch("email");
    const fullName = registerForm.watch("fullName");

    if (username && password && email && fullName) {
      setShowBadgeHolderQuestions(true);
    }
  }, [
    // Badge holder criteria fields
    registerForm.watch("isLocalResident"),
    registerForm.watch("ownsHomeInBB"),
    registerForm.watch("isFullTimeResident"),
    registerForm.watch("isSnowbird"),
    registerForm.watch("hasMembershipBadge"),
    // Additional resident survey fields
    registerForm.watch("rentsHomeInBB"),
    registerForm.watch("buysDayPasses"),
    // Non-resident survey fields
    registerForm.watch("hasLivedInBB"),
    registerForm.watch("hasVisitedBB"),
    registerForm.watch("neverVisitedBB"),
    registerForm.watch("hasFriendsInBB"),
    registerForm.watch("consideringMovingToBB"),
    registerForm.watch("wantToDiscoverBB"),
    registerForm.watch("neverHeardOfBB"),
    // Registration fields for showing the survey
    registerForm.watch("username"),
    registerForm.watch("password"),
    registerForm.watch("email"),
    registerForm.watch("fullName")
  ]);

  // Only redirect if user is logged in AND we're not showing the success modal
  // This allows the success modal to be displayed before redirecting
  if (user && !showSuccessModal) {
    return <Redirect to="/" />;
  }

  return (
    <div className="flex min-h-[80vh] px-4 py-6 md:py-8">
      <Card className="w-full max-w-4xl mx-auto shadow-md border-0">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl md:text-3xl">Welcome to Barefoot Bay</CardTitle>
          <CardDescription className="text-sm md:text-base">Join our community to access the Rocket Docket and Current Temp features!</CardDescription>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login" className="text-base">Login</TabsTrigger>
              <TabsTrigger value="register" className="text-base">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit((data) => loginMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium mb-1">Username</FormLabel>
                        <FormControl>
                          <Input 
                            type="text"
                            placeholder="Enter your username"
                            className="py-6 px-4 text-base rounded-md"
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => {
                              field.onChange(e);
                              if (loginMutation.isError) loginMutation.reset();
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium mb-1">Password</FormLabel>
                        <FormControl>
                          <Input 
                            type="password"
                            placeholder="Enter your password"
                            className="py-6 px-4 text-base rounded-md"
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => {
                              field.onChange(e);
                              if (loginMutation.isError) loginMutation.reset();
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {loginMutation.isError && (
                    <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>{loginMutation.error?.message || "Invalid username or password. Please try again."}</span>
                    </div>
                  )}
                  <Button 
                    type="submit" 
                    className="w-full py-6 mt-4 rounded-md text-base font-medium bg-coral hover:bg-coral/90 text-white border-0 shadow-none" 
                    disabled={loginMutation.isPending}
                    variant="coral"
                  >
                    {loginMutation.isPending ? "Logging in..." : "Login"}
                  </Button>
                  
                  <div className="text-sm text-center mt-4">
                    <a href="/forgot-password" className="text-primary hover:underline">
                      Forgot your password?
                    </a>
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="register">
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit((data) => {
                  // Check password confirmation
                  if (data.password !== confirmPassword) {
                    setPasswordMismatch(true);
                    toast({
                      title: "Passwords don't match",
                      description: "Please make sure both password fields are identical.",
                      variant: "destructive",
                    });
                    return;
                  }
                  // Check email confirmation
                  if (data.email !== confirmEmail) {
                    setEmailMismatch(true);
                    toast({
                      title: "Emails don't match",
                      description: "Please make sure both email fields are identical.",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (!recaptchaToken) {
                    toast({
                      title: "Please verify the CAPTCHA",
                      description: "Complete the 'I'm not a robot' check before registering.",
                      variant: "destructive",
                    });
                    return;
                  }
                  // Block submission if username/email are taken
                  if (usernameStatus === 'taken' || emailStatus === 'taken') {
                    toast({
                      title: usernameStatus === 'taken' ? "Username already taken" : "Email already registered",
                      description: "Please choose a different one and try again.",
                      variant: "destructive",
                    });
                    return;
                  }
                  // Include explicit acceptance tracking from modal interactions
                  registerMutation.mutate({ 
                    ...data, 
                    recaptchaToken,
                    // Track that user explicitly accepted terms via modal
                    termsAcceptedViaModal: termsAccepted,
                    privacyAcceptedViaModal: privacyAccepted,
                    // Include selected club memberships
                    clubMemberships: selectedClubs
                  } as any, {
                    onSuccess: (registeredUser: any) => {
                      // Show success modal with confetti
                      setRegisteredUsername(registeredUser.username || data.username);
                      setShowConfetti(true);
                      setShowSuccessModal(true);
                      // Reset reCAPTCHA on success (token was consumed)
                      setRecaptchaToken(null);
                      recaptchaRef.current?.reset();
                      // Auto-redirect after showing success for 4 seconds
                      setTimeout(() => {
                        setShowConfetti(false);
                        setShowSuccessModal(false); // Close modal to trigger redirect
                      }, 4000);
                    },
                    onError: () => {
                      // reCAPTCHA tokens are single-use and consumed on the server side
                      // regardless of whether registration succeeds or fails.
                      // Always reset the CAPTCHA widget so user can re-verify for retry.
                      // The error message is displayed separately in the error box above the button.
                      setRecaptchaToken(null);
                      recaptchaRef.current?.reset();
                    }
                  });
                }, (errors) => {
                  // Invalid callback: surface zod validation failures instead of
                  // silently aborting. Some fields (e.g. acceptedTerms) have no
                  // inline FormMessage, so without this the form would do nothing.
                  console.error('Registration validation failed:', errors);
                  const firstError = Object.values(errors).find((e) => (e as any)?.message);
                  const description =
                    (firstError as any)?.message ||
                    'Please review the highlighted fields and try again.';
                  toast({
                    title: 'Please complete the form',
                    description: String(description),
                    variant: 'destructive',
                  });
                })} className="space-y-4">
                  <FormField
                    control={registerForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input 
                            type="text"
                            placeholder="Enter your full name"
                            className="py-6 px-4 text-base rounded-md"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type="email"
                              placeholder="Enter your email"
                              className={`py-6 px-4 text-base rounded-md pr-12 transition-all duration-300 ${
                                emailStatus === 'available' ? 'border-green-500 focus:ring-green-500' :
                                emailStatus === 'taken' ? 'border-red-500 focus:ring-red-500' : ''
                              }`}
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => {
                                field.onChange(e);
                                setEmailInput(e.target.value);
                                if (confirmEmail && e.target.value !== confirmEmail) {
                                  setEmailMismatch(true);
                                } else {
                                  setEmailMismatch(false);
                                }
                              }}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              {emailStatus === 'checking' && (
                                <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                              )}
                              {emailStatus === 'available' && (
                                <CheckCircle2 className="h-5 w-5 text-green-500 animate-in zoom-in-50 duration-300" />
                              )}
                              {emailStatus === 'taken' && (
                                <XCircle className="h-5 w-5 text-red-500 animate-in zoom-in-50 duration-300" />
                              )}
                            </div>
                          </div>
                        </FormControl>
                        {emailStatus === 'taken' && emailMessage && (
                          <p className="text-sm font-medium text-red-500 animate-in slide-in-from-top-1 duration-200">
                            {emailMessage}
                          </p>
                        )}
                        {emailStatus === 'available' && emailMessage && (
                          <p className="text-sm font-medium text-green-600 animate-in slide-in-from-top-1 duration-200">
                            {emailMessage}
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Confirm Email Field */}
                  <FormItem>
                    <FormLabel>Confirm Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email"
                        placeholder="Confirm your email"
                        className="py-6 px-4 text-base rounded-md"
                        value={confirmEmail}
                        onChange={(e) => {
                          setConfirmEmail(e.target.value);
                          const email = registerForm.getValues("email");
                          if (e.target.value && email !== e.target.value) {
                            setEmailMismatch(true);
                          } else {
                            setEmailMismatch(false);
                          }
                        }}
                        data-testid="input-confirm-email"
                      />
                    </FormControl>
                    {emailMismatch && (
                      <p className="text-sm font-medium text-destructive">Email addresses do not match</p>
                    )}
                  </FormItem>
                  <FormField
                    control={registerForm.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number (Optional)</FormLabel>
                        <FormControl>
                          <PhoneInput 
                            value={field.value || ""}
                            onChange={field.onChange}
                            placeholder="(555) 555-5555"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type="text"
                              placeholder="Choose a username"
                              className={`py-6 px-4 text-base rounded-md pr-12 transition-all duration-300 ${
                                usernameStatus === 'available' ? 'border-green-500 focus:ring-green-500' :
                                usernameStatus === 'taken' ? 'border-red-500 focus:ring-red-500' : ''
                              }`}
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => {
                                field.onChange(e);
                                setUsernameInput(e.target.value);
                              }}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              {usernameStatus === 'checking' && (
                                <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                              )}
                              {usernameStatus === 'available' && (
                                <CheckCircle2 className="h-5 w-5 text-green-500 animate-in zoom-in-50 duration-300" />
                              )}
                              {usernameStatus === 'taken' && (
                                <XCircle className="h-5 w-5 text-red-500 animate-in zoom-in-50 duration-300" />
                              )}
                            </div>
                          </div>
                        </FormControl>
                        {usernameStatus === 'taken' && usernameMessage && (
                          <p className="text-sm font-medium text-red-500 animate-in slide-in-from-top-1 duration-200">
                            {usernameMessage}
                          </p>
                        )}
                        {usernameStatus === 'available' && usernameMessage && (
                          <p className="text-sm font-medium text-green-600 animate-in slide-in-from-top-1 duration-200">
                            {usernameMessage}
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type={showPassword ? "text" : "password"}
                              placeholder="Choose a password"
                              className="py-6 px-4 text-base rounded-md pr-12"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => {
                                field.onChange(e);
                                if (confirmPassword && e.target.value !== confirmPassword) {
                                  setPasswordMismatch(true);
                                } else {
                                  setPasswordMismatch(false);
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => setShowPassword(!showPassword)}
                              data-testid="toggle-password-visibility"
                            >
                              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Confirm Password Field */}
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm your password"
                          className="py-6 px-4 text-base rounded-md pr-12"
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            const password = registerForm.getValues("password");
                            if (e.target.value && password !== e.target.value) {
                              setPasswordMismatch(true);
                            } else {
                              setPasswordMismatch(false);
                            }
                          }}
                          data-testid="input-confirm-password"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          data-testid="toggle-confirm-password-visibility"
                        >
                          {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </FormControl>
                    {passwordMismatch && (
                      <p className="text-sm font-medium text-destructive">Passwords do not match</p>
                    )}
                  </FormItem>
                  
                  {/* Honeypot field - hidden from real users, bots will fill it */}
                  <input
                    type="text"
                    name="honeypot"
                    tabIndex={-1}
                    autoComplete="off"
                    style={{ 
                      position: 'absolute', 
                      left: '-9999px', 
                      opacity: 0, 
                      height: 0, 
                      width: 0,
                      pointerEvents: 'none'
                    }}
                    {...registerForm.register('honeypot')}
                  />
                  
{/* Badge Holder status is determined based on survey responses, but not displayed to users */}

                  {showBadgeHolderQuestions && (
                    <div className="mt-4 border rounded-md p-4 bg-slate-50">
                      <h3 className="text-lg font-medium mb-3">Welcome! Please help us get to know you by answering the following questions below</h3>
                      <p className="text-sm text-muted-foreground mb-4">BarefootBay.com Survey Questions (check those that apply):</p>
                      
                      <div className="mb-4">
                        <h4 className="font-medium mb-2">Resident of Barefoot Bay:</h4>
                        <div className="space-y-3 pl-2">
                          <FormField
                            control={registerForm.control}
                            name="ownsHomeInBB"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>
                                    I own a home in Barefoot Bay
                                  </FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="rentsHomeInBB"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>
                                    I rent a home in Barefoot Bay
                                  </FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="hasMembershipBadge"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>
                                    I have a Barefoot Bay Membership Badge
                                  </FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          {registerForm.watch("hasMembershipBadge") && (
                            <FormField
                              control={registerForm.control}
                              name="membershipBadgeNumber"
                              render={({ field }) => (
                                <FormItem className="ml-6">
                                  <FormLabel>Membership Badge Number</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="text"
                                      placeholder="Enter your badge number"
                                      className="py-6 px-4 text-base rounded-md"
                                      {...field}
                                      value={field.value || ""}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                          <FormField
                            control={registerForm.control}
                            name="buysDayPasses"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>
                                    I buy day/month passes for social events
                                  </FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="isFullTimeResident"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>
                                    I am a full-time resident
                                  </FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="isSnowbird"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>
                                    I am a part-time resident (snowbird)
                                  </FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">Not a Resident of Barefoot Bay:</h4>
                        <div className="space-y-3 pl-2">
                          <FormField
                            control={registerForm.control}
                            name="isLocalResident"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>
                                    I live in the 32976 zipcode
                                  </FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="hasLivedInBB"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>
                                    I previously lived in Barefoot Bay
                                  </FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="hasVisitedBB"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>
                                    I've visited Barefoot Bay
                                  </FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="neverVisitedBB"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>
                                    I've never been to Barefoot Bay
                                  </FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="hasFriendsInBB"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>
                                    I have friends/relatives in Barefoot Bay
                                  </FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="consideringMovingToBB"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>
                                    I am considering moving to Barefoot Bay
                                  </FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="wantToDiscoverBB"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>
                                    I want to discover Barefoot Bay
                                  </FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="neverHeardOfBB"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>
                                    I've never heard of Barefoot Bay
                                  </FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Club Memberships Accordion - Optional */}
                  {showBadgeHolderQuestions && socialClubs && socialClubs.length > 0 && (
                    <Accordion type="single" collapsible className="mt-4 border rounded-md">
                      <AccordionItem value="club-memberships" className="border-0">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Club Memberships</span>
                            <span className="text-sm text-muted-foreground">(Optional - {selectedClubs.length} selected)</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <p className="text-sm text-muted-foreground mb-3">
                            Select any clubs you're currently a member of. This helps us connect you with other club members.
                          </p>
                          <ScrollArea className="h-[250px] pr-4">
                            <div className="space-y-2">
                              {socialClubs.map((club) => (
                                <div 
                                  key={club.slug}
                                  className="flex items-center space-x-3"
                                >
                                  <Checkbox
                                    id={`club-${club.slug}`}
                                    checked={selectedClubs.includes(club.slug)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedClubs([...selectedClubs, club.slug]);
                                      } else {
                                        setSelectedClubs(selectedClubs.filter(s => s !== club.slug));
                                      }
                                    }}
                                  />
                                  <label
                                    htmlFor={`club-${club.slug}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                  >
                                    {club.title}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}

                  {/* Terms and Conditions Checkbox - Moved to bottom */}
                  <div className="flex flex-row items-center space-x-3 rounded-md border p-4 mt-4 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => !termsAccepted && setShowTermsModal(true)}
                  >
                    <Checkbox
                      checked={termsAccepted}
                      onCheckedChange={() => !termsAccepted && setShowTermsModal(true)}
                      data-testid="checkbox-accept-terms"
                      className="pointer-events-none"
                    />
                    <div className="space-y-1 leading-none flex-1">
                      <span className="text-sm font-medium flex items-center gap-2">
                        I accept the Terms and Conditions
                        {termsAccepted && <span className="text-green-600 text-xs font-normal">(accepted)</span>}
                      </span>
                      {!termsAccepted && (
                        <p className="text-xs text-muted-foreground">Click to read and accept</p>
                      )}
                    </div>
                  </div>

                  {/* Privacy Policy Checkbox */}
                  <div className="flex flex-row items-center space-x-3 rounded-md border p-4 mt-2 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => !privacyAccepted && setShowPrivacyModal(true)}
                  >
                    <Checkbox
                      checked={privacyAccepted}
                      onCheckedChange={() => !privacyAccepted && setShowPrivacyModal(true)}
                      data-testid="checkbox-accept-privacy"
                      className="pointer-events-none"
                    />
                    <div className="space-y-1 leading-none flex-1">
                      <span className="text-sm font-medium flex items-center gap-2">
                        I accept the Privacy Policy
                        {privacyAccepted && <span className="text-green-600 text-xs font-normal">(accepted)</span>}
                      </span>
                      {!privacyAccepted && (
                        <p className="text-xs text-muted-foreground">Click to read and accept</p>
                      )}
                    </div>
                  </div>
                  
                  {/* acceptedTerms is kept in sync as a real boolean via the
                      useEffect tied to termsAccepted + privacyAccepted above,
                      so no hidden string-valued input is needed here. */}
                  
                  {/* Google reCAPTCHA v2 Checkbox */}
                  <div className="mt-4 flex justify-center">
                    <ReCAPTCHA
                      ref={recaptchaRef}
                      sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                      onChange={(token) => setRecaptchaToken(token)}
                      onExpired={() => setRecaptchaToken(null)}
                      data-testid="recaptcha-widget"
                    />
                  </div>
                  {/* Display server-side registration errors prominently */}
                  {registerMutation.isError && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <p className="text-sm text-destructive text-center font-medium">
                        {(registerMutation.error as any)?.message || 'Registration failed. Please try again.'}
                      </p>
                      {!recaptchaToken && (
                        <p className="text-xs text-muted-foreground text-center mt-1">
                          Please re-verify the CAPTCHA before trying again
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Only show CAPTCHA prompt if there's no server error and CAPTCHA isn't completed */}
                  {!recaptchaToken && registerForm.formState.isSubmitted && !registerMutation.isError && (
                    <p className="text-sm text-destructive mt-2 text-center">Please complete the CAPTCHA verification</p>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full py-6 mt-4 rounded-md text-base font-medium bg-coral hover:bg-coral/90 text-white border-0 shadow-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]" 
                    disabled={registerMutation.isPending || !termsAccepted || !privacyAccepted || passwordMismatch || emailMismatch || !recaptchaToken || usernameStatus === 'taken' || emailStatus === 'taken'}
                    variant="coral"
                  >
                    {registerMutation.isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Creating your account...
                      </span>
                    ) : 
                      usernameStatus === 'taken' ? "Username Already Taken" :
                      emailStatus === 'taken' ? "Email Already Registered" :
                      passwordMismatch ? "Passwords Must Match" :
                      emailMismatch ? "Emails Must Match" :
                      (!termsAccepted || !privacyAccepted) ? "Accept Terms & Privacy to Register" :
                      !recaptchaToken ? "Complete CAPTCHA to Register" : "Register"}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Terms and Conditions Modal */}
      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Terms and Conditions</DialogTitle>
            <DialogDescription>
              Please read and accept our Terms and Conditions to continue.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] pr-4">
            {termsLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : termsError ? (
              <div className="text-center text-destructive p-4">
                Failed to load Terms and Conditions. Please try again later.
              </div>
            ) : (
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: termsPage?.content || '' }}
              />
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTermsModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                setTermsAccepted(true);
                setShowTermsModal(false);
              }}
              data-testid="button-accept-terms"
              disabled={termsLoading || termsError || !termsPage?.content}
            >
              I Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Privacy Policy Modal */}
      <Dialog open={showPrivacyModal} onOpenChange={setShowPrivacyModal}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Privacy Policy</DialogTitle>
            <DialogDescription>
              Please read and accept our Privacy Policy to continue.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] pr-4">
            {privacyLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : privacyError ? (
              <div className="text-center text-destructive p-4">
                Failed to load Privacy Policy. Please try again later.
              </div>
            ) : (
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: privacyPage?.content || '' }}
              />
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPrivacyModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                setPrivacyAccepted(true);
                setShowPrivacyModal(false);
              }}
              data-testid="button-accept-privacy"
              disabled={privacyLoading || privacyError || !privacyPage?.content}
            >
              I Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Modal with Confetti */}
      {showConfetti && <ConfettiEffect />}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-md text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-emerald-50 pointer-events-none" />
          <div className="relative z-10">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mb-4 animate-in zoom-in-50 duration-500">
              <PartyPopper className="h-10 w-10 text-white animate-bounce" />
            </div>
            <DialogHeader className="text-center">
              <DialogTitle className="text-2xl font-bold text-center animate-in slide-in-from-bottom-4 duration-500">
                Welcome to Barefoot Bay! 🎉
              </DialogTitle>
              <DialogDescription className="text-center mt-2 animate-in slide-in-from-bottom-4 duration-500 delay-100">
                <span className="block text-lg font-medium text-foreground mb-2">
                  Hi {registeredUsername}!
                </span>
                Your account has been created successfully. You're now part of our amazing community!
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center gap-2 mt-6 text-sm text-muted-foreground animate-in slide-in-from-bottom-4 duration-500 delay-200">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>Redirecting you to the homepage...</span>
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
            <DialogFooter className="mt-6 sm:justify-center animate-in slide-in-from-bottom-4 duration-500 delay-300">
              <Button 
                onClick={() => window.location.href = '/'}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-8"
              >
                Go to Homepage Now
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}