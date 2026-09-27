import React, { useRef, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import ReCAPTCHA from "react-google-recaptcha";
import { 
  AlertCircle, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  ArrowLeft,
  Shield,
  FileText,
  Info,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const noticeSchema = z.object({
  name: z.string().min(2, "Full name is required"),
  company: z.string().optional(),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(5, "Phone number is required"),
  address: z.string().min(5, "Mailing address is required"),
  role: z.enum(["owner", "agent"], { required_error: "Please select your role" }),
  copyrightOwnerName: z.string().optional(),
  workTitle: z.string().min(2, "Title of the copyrighted work is required"),
  workDescription: z.string().min(10, "Please describe the copyrighted work"),
  referenceUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  infringingUrls: z.array(
    z.object({ value: z.string().url("Must be a valid URL").min(1, "URL is required") })
  ).min(1, "At least one infringing URL is required").max(50, "Maximum of 50 URLs allowed"),
  additionalInfo: z.string().optional(),
  goodFaith: z.literal(true, {
    errorMap: () => ({ message: "You must accept the good faith statement" }),
  }),
  accuracyPerjury: z.literal(true, {
    errorMap: () => ({ message: "You must accept the accuracy and perjury statement" }),
  }),
  signature: z.string().min(2, "Electronic signature is required"),
}).superRefine((data, ctx) => {
  if (data.role === "agent" && (!data.copyrightOwnerName || data.copyrightOwnerName.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Copyright owner name is required when acting as an agent",
      path: ["copyrightOwnerName"],
    });
  }
});

type NoticeFormValues = z.infer<typeof noticeSchema>;

type SuccessResponse = {
  caseNumber: string;
  receivedAt: string;
  statusUrl: string;
};

export default function DMCANoticePage() {
  const queryClient = useQueryClient();
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<SuccessResponse | null>(null);

  const form = useForm<NoticeFormValues>({
    resolver: zodResolver(noticeSchema),
    defaultValues: {
      name: "",
      company: "",
      email: "",
      phone: "",
      address: "",
      role: "owner",
      copyrightOwnerName: "",
      workTitle: "",
      workDescription: "",
      referenceUrl: "",
      infringingUrls: [{ value: "" }],
      additionalInfo: "",
      signature: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "infringingUrls",
  });

  const submitMutation = useMutation({
    mutationFn: async (data: NoticeFormValues) => {
      const payload = {
        ...data,
        infringingUrls: data.infringingUrls.map(u => u.value),
        referenceUrl: data.referenceUrl || undefined,
        company: data.company || undefined,
        copyrightOwnerName: data.role === 'agent' ? data.copyrightOwnerName : undefined,
        additionalInfo: data.additionalInfo || undefined,
        recaptchaToken,
      };

      // Plain fetch (not apiRequest) so per-field validation errors survive.
      const res = await fetch("/api/dmca/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error: any = new Error(
          body?.message ||
            (res.status === 429
              ? "Too many submissions. Please try again later."
              : `Something went wrong (status ${res.status}). Please try again.`),
        );
        error.status = res.status;
        error.errors = body?.errors;
        throw error;
      }
      return body as SuccessResponse;
    },
    onSuccess: (data) => {
      setSuccessData(data);
      queryClient.invalidateQueries({ queryKey: ["/api/dmca/my-activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dmca/my-claims"] });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onError: (err: any) => {
      // ReCAPTCHA token is consumed even on error
      setRecaptchaToken(null);
      recaptchaRef.current?.reset();

      if (err.errors) {
        // Validation errors
        Object.entries(err.errors).forEach(([field, msg]) => {
          const name = /^infringingUrls\.\d+$/.test(field) ? `${field}.value` : field;
          form.setError(name as any, { type: "server", message: msg as string });
        });
        setGlobalError("Please correct the errors in the form below.");
      } else {
        setGlobalError(err.message || "An unexpected error occurred. Please try again.");
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  });

  const onSubmit = (values: NoticeFormValues) => {
    setGlobalError(null);
    if (!recaptchaToken) {
      setGlobalError("Please complete the reCAPTCHA verification.");
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    submitMutation.mutate(values);
  };

  const role = form.watch("role");

  if (successData) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6">
        <Card className="border-2 border-green-100 shadow-lg">
          <CardContent className="pt-10 pb-8 px-8 text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Notice Received</h1>
            <p className="text-lg text-gray-600 mb-8">
              We have successfully received your DMCA takedown notice. A confirmation email has been sent to the address you provided.
            </p>

            <div className="bg-gray-50 rounded-xl p-6 text-left border border-gray-100 mb-8 max-w-lg mx-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Case Number</p>
                  <p className="text-lg font-mono font-semibold text-gray-900">{successData.caseNumber}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Date Received</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Date(successData.receivedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 text-blue-800 p-4 rounded-lg flex items-start text-left mb-8 max-w-lg mx-auto">
              <Info className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
              <p className="text-sm">
                <strong>What happens next?</strong> No content is removed automatically. A human will review your notice to ensure it complies with the legal requirements of the DMCA.
              </p>
            </div>

            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href={successData.statusUrl}>Track Status</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6">
      <Link href="/dmca" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Policy
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-3">Submit a DMCA Notice</h1>
        <p className="text-lg text-gray-600">
          Use this form to notify us of alleged copyright infringement on Barefoot Bay.
        </p>
      </div>

      {globalError && (
        <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-start rounded-r-md">
          <AlertCircle className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
          <p className="font-medium">{globalError}</p>
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Section 1: Contact Information */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100">
            <CardTitle className="flex items-center text-xl">
              <User className="w-5 h-5 mr-2 text-primary" /> Contact Information
            </CardTitle>
            <CardDescription>Your details as the person submitting this notice.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Legal Name <span className="text-red-500">*</span></Label>
              <Input id="name" {...form.register("name")} className={form.formState.errors.name ? "border-red-500" : ""} />
              {form.formState.errors.name && <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="company">Company / Organization (Optional)</Label>
              <Input id="company" {...form.register("company")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
              <Input id="email" type="email" {...form.register("email")} className={form.formState.errors.email ? "border-red-500" : ""} />
              {form.formState.errors.email && <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number <span className="text-red-500">*</span></Label>
              <Input id="phone" type="tel" {...form.register("phone")} className={form.formState.errors.phone ? "border-red-500" : ""} />
              {form.formState.errors.phone && <p className="text-sm text-red-500">{form.formState.errors.phone.message}</p>}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">Mailing Address <span className="text-red-500">*</span></Label>
              <Textarea 
                id="address" 
                {...form.register("address")} 
                rows={3} 
                className={form.formState.errors.address ? "border-red-500" : ""} 
                placeholder="Street address&#10;City, State, ZIP&#10;Country"
              />
              {form.formState.errors.address && <p className="text-sm text-red-500">{form.formState.errors.address.message}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Copyright Ownership */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100">
            <CardTitle className="flex items-center text-xl">
              <Shield className="w-5 h-5 mr-2 text-primary" /> Authority
            </CardTitle>
            <CardDescription>Are you the copyright owner or acting on their behalf?</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <RadioGroup 
                defaultValue={role} 
                onValueChange={(v) => form.setValue("role", v as "owner" | "agent", { shouldValidate: true })}
                className="flex flex-col space-y-3"
              >
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="owner" id="role-owner" className="w-5 h-5" />
                  <Label htmlFor="role-owner" className="text-base font-medium cursor-pointer">I am the copyright owner</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="agent" id="role-agent" className="w-5 h-5" />
                  <Label htmlFor="role-agent" className="text-base font-medium cursor-pointer">I am authorized to act on behalf of the copyright owner</Label>
                </div>
              </RadioGroup>

              {role === "agent" && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-2 animate-in slide-in-from-top-2 duration-200">
                  <Label htmlFor="copyrightOwnerName">Name of Copyright Owner <span className="text-red-500">*</span></Label>
                  <Input id="copyrightOwnerName" {...form.register("copyrightOwnerName")} className={form.formState.errors.copyrightOwnerName ? "border-red-500" : ""} />
                  {form.formState.errors.copyrightOwnerName && <p className="text-sm text-red-500">{form.formState.errors.copyrightOwnerName.message}</p>}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section 3: The Work */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100">
            <CardTitle className="flex items-center text-xl">
              <FileText className="w-5 h-5 mr-2 text-primary" /> The Copyrighted Work
            </CardTitle>
            <CardDescription>Identify the original work that you claim has been infringed.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="workTitle">Title of the Work <span className="text-red-500">*</span></Label>
              <Input id="workTitle" {...form.register("workTitle")} className={form.formState.errors.workTitle ? "border-red-500" : ""} />
              {form.formState.errors.workTitle && <p className="text-sm text-red-500">{form.formState.errors.workTitle.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="workDescription">Description of the Work <span className="text-red-500">*</span></Label>
              <Textarea 
                id="workDescription" 
                {...form.register("workDescription")} 
                rows={4} 
                className={form.formState.errors.workDescription ? "border-red-500" : ""} 
                placeholder="Describe the copyrighted work in sufficient detail..."
              />
              {form.formState.errors.workDescription && <p className="text-sm text-red-500">{form.formState.errors.workDescription.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="referenceUrl">Where can we see the original work? (Optional URL)</Label>
              <Input id="referenceUrl" type="url" {...form.register("referenceUrl")} placeholder="https://" className={form.formState.errors.referenceUrl ? "border-red-500" : ""} />
              {form.formState.errors.referenceUrl && <p className="text-sm text-red-500">{form.formState.errors.referenceUrl.message}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Where is it infringed? */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100">
            <CardTitle className="flex items-center text-xl">
              <AlertCircle className="w-5 h-5 mr-2 text-primary" /> Infringing Material
            </CardTitle>
            <CardDescription>Provide the exact URLs on Barefoot Bay where the infringing material is located.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    <Input 
                      {...form.register(`infringingUrls.${index}.value`)} 
                      type="url"
                      placeholder="https://barefootbay.com/..."
                      className={form.formState.errors.infringingUrls?.[index]?.value ? "border-red-500" : ""}
                    />
                    {form.formState.errors.infringingUrls?.[index]?.value && (
                      <p className="text-sm text-red-500">{form.formState.errors.infringingUrls[index]?.value?.message}</p>
                    )}
                  </div>
                  {fields.length > 1 && (
                    <Button type="button" variant="outline" size="icon" onClick={() => remove(index)} className="shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              
              {form.formState.errors.infringingUrls && !Array.isArray(form.formState.errors.infringingUrls) && (
                <p className="text-sm text-red-500">{(form.formState.errors.infringingUrls as any).message}</p>
              )}

              {fields.length < 50 && (
                <Button type="button" variant="secondary" onClick={() => append({ value: "" })} className="mt-2 text-sm">
                  <Plus className="w-4 h-4 mr-2" /> Add another URL
                </Button>
              )}
            </div>

            <div className="mt-8 space-y-2">
              <Label htmlFor="additionalInfo">Additional Explanation (Optional)</Label>
              <Textarea 
                id="additionalInfo" 
                {...form.register("additionalInfo")} 
                rows={3} 
                placeholder="Any other details that will help us locate or identify the material."
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Legal Declarations */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100">
            <CardTitle className="text-xl">Legal Declarations</CardTitle>
            <CardDescription>Please read and agree to the following statutory statements.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-start space-x-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <Checkbox 
                  id="goodFaith" 
                  checked={form.watch("goodFaith") === true}
                  onCheckedChange={(v) => form.setValue("goodFaith", v === true ? true : (undefined as any), { shouldValidate: true })}
                  className="mt-1"
                />
                <div className="space-y-1 leading-none">
                  <Label htmlFor="goodFaith" className="text-base font-medium cursor-pointer block leading-snug">
                    I have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law. <span className="text-red-500">*</span>
                  </Label>
                  {form.formState.errors.goodFaith && <p className="text-sm text-red-500 font-medium">{form.formState.errors.goodFaith.message}</p>}
                </div>
              </div>

              <div className="flex items-start space-x-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <Checkbox 
                  id="accuracyPerjury" 
                  checked={form.watch("accuracyPerjury") === true}
                  onCheckedChange={(v) => form.setValue("accuracyPerjury", v === true ? true : (undefined as any), { shouldValidate: true })}
                  className="mt-1"
                />
                <div className="space-y-1 leading-none">
                  <Label htmlFor="accuracyPerjury" className="text-base font-medium cursor-pointer block leading-snug">
                    The information in this notification is accurate, and under penalty of perjury, I am the owner, or authorized to act on behalf of the owner, of an exclusive right that is allegedly infringed. <span className="text-red-500">*</span>
                  </Label>
                  {form.formState.errors.accuracyPerjury && <p className="text-sm text-red-500 font-medium">{form.formState.errors.accuracyPerjury.message}</p>}
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-gray-100">
              <Label htmlFor="signature" className="text-lg">Electronic Signature <span className="text-red-500">*</span></Label>
              <p className="text-sm text-gray-500 mb-2">
                Type your full legal name. This has the same legal effect as a handwritten signature.
              </p>
              <Input 
                id="signature" 
                {...form.register("signature")} 
                className={`text-lg py-6 ${form.formState.errors.signature ? "border-red-500" : ""}`} 
                placeholder="First Last"
              />
              {form.formState.errors.signature && <p className="text-sm text-red-500">{form.formState.errors.signature.message}</p>}
            </div>

            <div className="pt-6">
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                onChange={(token) => {
                  setRecaptchaToken(token);
                  if (token) setGlobalError(null);
                }}
                onExpired={() => setRecaptchaToken(null)}
              />
            </div>
          </CardContent>
          <CardFooter className="bg-gray-50/50 border-t border-gray-100 p-6">
            <Button 
              type="submit" 
              size="lg" 
              className="w-full sm:w-auto min-w-[200px] text-lg py-6 bg-primary hover:bg-primary/90" 
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? "Submitting..." : "Submit Notice"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
