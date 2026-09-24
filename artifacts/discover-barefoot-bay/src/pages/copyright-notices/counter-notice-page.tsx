import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useRoute } from "wouter";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import type { CopyrightCaseDetail } from "./types";

const PERJURY_STATEMENT = "I swear, under penalty of perjury, that I have a good faith belief that the material was removed or disabled as a result of mistake or misidentification of the material to be removed or disabled.";
const JURISDICTION_STATEMENT = "I consent to the jurisdiction of the Federal District Court for the judicial district of my address, or, if my address is outside the United States, any judicial district in which the service provider may be found.";
const SERVICE_STATEMENT = "I agree to accept service of process from the person who provided the original notification or their agent.";

const schema = z.object({
  materialIdentification: z.string().trim().min(1, "Identify the removed material."),
  formerLocation: z.string().trim().min(1, "Provide the material's former location."),
  perjuryStatement: z.boolean().refine(Boolean, "You must make the penalty-of-perjury statement."),
  name: z.string().trim().min(1, "Full legal name is required."),
  address: z.string().trim().min(1, "Address is required."),
  phone: z.string().trim().min(1, "Phone number is required."),
  email: z.string().trim().email("Enter a valid email address."),
  jurisdictionConsent: z.boolean().refine(Boolean, "You must consent to federal court jurisdiction."),
  serviceOfProcessConsent: z.boolean().refine(Boolean, "You must agree to accept service of process."),
  signature: z.string().trim().min(1, "Typed signature is required."),
}).refine((values) => values.signature.toLocaleLowerCase() === values.name.toLocaleLowerCase(), {
  path: ["signature"],
  message: "Your typed signature must match your full name.",
});
type Values = z.infer<typeof schema>;

export default function CounterNoticePage() {
  const [, params] = useRoute<{ caseNumber: string }>("/copyright-notices/:caseNumber/counter-notice");
  const caseNumber = params?.caseNumber || "";
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const query = useQuery<CopyrightCaseDetail>({
    queryKey: [`/api/dmca/my-cases/${encodeURIComponent(caseNumber)}`],
    enabled: Boolean(caseNumber),
    placeholderData: undefined,
  });
  const detail = query.data && !Array.isArray(query.data) && Array.isArray(query.data.items) ? query.data : null;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      materialIdentification: "",
      formerLocation: "",
      perjuryStatement: false,
      name: user?.fullName || "",
      address: "",
      phone: user?.phoneNumber || "",
      email: user?.email || "",
      jurisdictionConsent: false,
      serviceOfProcessConsent: false,
      signature: "",
    },
  });

  useEffect(() => {
    if (!detail) return;
    const identification = detail.items.map((item) => item.title || item.contentTypeLabel).join("\n");
    const locations = detail.items.map((item) => item.originalUrl).join("\n");
    if (!form.getValues("materialIdentification")) form.setValue("materialIdentification", identification, { shouldValidate: true });
    if (!form.getValues("formerLocation")) form.setValue("formerLocation", locations, { shouldValidate: true });
  }, [detail, form]);

  useEffect(() => {
    if (!user) return;
    if (!form.getValues("name") && user.fullName) form.setValue("name", user.fullName, { shouldValidate: true });
    if (!form.getValues("phone") && user.phoneNumber) form.setValue("phone", user.phoneNumber, { shouldValidate: true });
    if (!form.getValues("email") && user.email) form.setValue("email", user.email, { shouldValidate: true });
  }, [form, user]);

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const response = await apiRequest("POST", `/api/dmca/my-cases/${encodeURIComponent(caseNumber)}/counter-notice`, values);
      return response.json();
    },
    onSuccess: () => setLocation("/copyright-notices?submitted=1"),
    onError: (error: Error & { fieldErrors?: Record<string, string> }) => {
      if (error.fieldErrors) Object.entries(error.fieldErrors).forEach(([field, message]) => form.setError(field as keyof Values, { message }));
    },
  });

  if (query.isLoading) return <p className="py-12 text-center">Loading counter-notice form…</p>;
  if (query.error || !detail) return <p className="mx-auto max-w-3xl rounded-md border border-red-300 bg-red-50 p-4 text-red-800">{query.error instanceof Error ? query.error.message : "Case not found."}</p>;
  if (!detail.canSubmitCounterNotice) return <div className="mx-auto max-w-3xl space-y-4 py-8"><p className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900">A counter-notice cannot be submitted for this case at this time.</p><Link href={`/copyright-notices/${encodeURIComponent(caseNumber)}`}><Button variant="outline">Return to notice</Button></Link></div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-4">
      <Link href={`/copyright-notices/${encodeURIComponent(caseNumber)}`}><Button variant="ghost" data-testid="button-back-notice"><ArrowLeft className="mr-2 h-4 w-4" />Notice information</Button></Link>
      <div><h1 className="text-3xl font-bold">Submit a counter-notice</h1><p className="mt-2 text-muted-foreground">All fields are required. Review each statement carefully before signing.</p></div>
      <Card>
        <CardHeader><CardTitle>Case and affected content</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><p className="text-sm font-medium">Case number</p><p data-testid="text-counter-case-number">{detail.caseNumber}</p></div>
          {detail.items.map((item, index) => <div key={`${item.originalUrl}-${index}`} className="rounded-md border p-3"><p className="font-medium">{item.title || item.contentTypeLabel}</p><p className="break-all text-sm">{item.originalUrl}</p></div>)}
        </CardContent>
      </Card>
      <Form {...form}>
        <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-6">
          <Card><CardHeader><CardTitle>Material</CardTitle></CardHeader><CardContent className="space-y-4">
            <FormField control={form.control} name="materialIdentification" render={({ field }) => <FormItem><FormLabel>Identification of removed material</FormLabel><FormControl><Textarea rows={5} {...field} data-testid="input-material-identification" /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="formerLocation" render={({ field }) => <FormItem><FormLabel>Former location of the material</FormLabel><FormControl><Textarea rows={4} {...field} data-testid="input-former-location" /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="perjuryStatement" render={({ field }) => <FormItem className="flex items-start gap-3 rounded-md border p-4"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-perjury-statement" /></FormControl><div><FormLabel className="leading-relaxed">{PERJURY_STATEMENT}</FormLabel><FormMessage /></div></FormItem>} />
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Your contact information</CardTitle></CardHeader><CardContent className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Full legal name</FormLabel><FormControl><Input {...field} data-testid="input-counter-name" /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="address" render={({ field }) => <FormItem><FormLabel>Address</FormLabel><FormControl><Textarea rows={3} {...field} data-testid="input-counter-address" /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="phone" render={({ field }) => <FormItem><FormLabel>Phone</FormLabel><FormControl><Input type="tel" {...field} data-testid="input-counter-phone" /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="email" render={({ field }) => <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} data-testid="input-counter-email" /></FormControl><FormMessage /></FormItem>} />
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Consent and signature</CardTitle></CardHeader><CardContent className="space-y-4">
            <FormField control={form.control} name="jurisdictionConsent" render={({ field }) => <FormItem className="flex items-start gap-3 rounded-md border p-4"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-jurisdiction-consent" /></FormControl><div><FormLabel className="leading-relaxed">{JURISDICTION_STATEMENT}</FormLabel><FormMessage /></div></FormItem>} />
            <FormField control={form.control} name="serviceOfProcessConsent" render={({ field }) => <FormItem className="flex items-start gap-3 rounded-md border p-4"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-service-consent" /></FormControl><div><FormLabel className="leading-relaxed">{SERVICE_STATEMENT}</FormLabel><FormMessage /></div></FormItem>} />
            <FormField control={form.control} name="signature" render={({ field }) => <FormItem><FormLabel>Typed signature (must match your full name)</FormLabel><FormControl><Input {...field} autoComplete="name" data-testid="input-counter-signature" /></FormControl><FormMessage /></FormItem>} />
          </CardContent></Card>
          {mutation.error && <p className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800" data-testid="status-counter-submit-error">{(mutation.error as Error).message}</p>}
          <Button type="submit" size="lg" disabled={!form.formState.isValid || mutation.isPending} data-testid="button-submit-counter-notice">
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit counter-notice
          </Button>
        </form>
      </Form>
    </div>
  );
}
