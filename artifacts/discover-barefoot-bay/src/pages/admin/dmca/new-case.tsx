import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import AdminLayout from "@/components/layouts/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { DmcaApiError, DmcaPerm, dmcaFetch, useDmcaMe } from "@/lib/dmca-admin";

type FormValues = {
  submittedVia: "email" | "mail" | "phone" | "fax"; receivedAt: string; claimantName: string;
  company: string; email: string; phone: string; address: string; role: "owner" | "agent";
  copyrightOwnerName: string; workTitle: string; workDescription: string; urlsText: string;
  goodFaith: boolean; accuracyPerjury: boolean; signature: string; notes: string;
};

export default function NewDmcaCase() {
  const me = useDmcaMe();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [document, setDocument] = useState<File | null>(null);
  const [serverError, setServerError] = useState("");
  const form = useForm<FormValues>({ defaultValues: {
    submittedVia: "email", receivedAt: new Date().toISOString().slice(0, 10), claimantName: "", company: "",
    email: "", phone: "", address: "", role: "owner", copyrightOwnerName: "", workTitle: "",
    workDescription: "", urlsText: "", goodFaith: false, accuracyPerjury: false, signature: "", notes: "",
  } });
  const submittedVia = form.watch("submittedVia");

  async function submit(values: FormValues) {
    setServerError("");
    try {
      let originalDocumentPath: string | undefined;
      if (document) {
        const formData = new FormData();
        formData.append("file", document);
        originalDocumentPath = (await dmcaFetch<{ path: string }>("/files", { method: "POST", formData })).path;
      }
      if (submittedVia !== "phone" && !originalDocumentPath) {
        form.setError("root", { message: "An original document is required for email, mail, and fax notices." });
        return;
      }
      const urls = values.urlsText.split(/\r?\n/).map(url => url.trim()).filter(Boolean);
      const result = await dmcaFetch<{ id: string; caseNumber: string }>("/cases", {
        method: "POST",
        body: {
          submittedVia: values.submittedVia,
          receivedAt: values.receivedAt,
          claimantName: values.claimantName,
          claimantCompany: values.company,
          claimantEmail: values.email,
          claimantPhone: values.phone,
          claimantAddress: values.address,
          claimantRole: values.role,
          copyrightOwnerName: values.copyrightOwnerName,
          workTitle: values.workTitle,
          workDescription: values.workDescription,
          urls,
          statements: { goodFaith: values.goodFaith, accuracyPerjury: values.accuracyPerjury },
          signature: values.signature,
          notes: values.notes,
          originalDocumentPath,
        },
      });
      toast({ title: `Case ${result.caseNumber} created` });
      navigate(`/admin/dmca/cases/${result.id}`);
    } catch (error) {
      const apiError = error as DmcaApiError;
      // API field names → form field names (the API prefixes claimant fields).
      const apiToForm: Record<string, keyof FormValues> = { claimantCompany: "company", claimantEmail: "email", claimantPhone: "phone", claimantAddress: "address", claimantRole: "role", "statements.goodFaith": "goodFaith", "statements.accuracyPerjury": "accuracyPerjury", urls: "urlsText" };
      Object.entries(apiError.errors ?? {}).forEach(([field, message]) => form.setError((apiToForm[field] ?? field) as keyof FormValues, { message }));
      setServerError(apiError.message);
    }
  }

  if (!me.isLoading && !me.can(DmcaPerm.CREATE)) return <AdminLayout><div className="p-8 text-center"><h1 className="text-2xl font-bold">Access denied</h1><p className="text-muted-foreground">The dmca.create permission is required.</p></div></AdminLayout>;

  const textField = (name: keyof FormValues, label: string, required = false, type = "text") => (
    <FormField control={form.control} name={name} rules={required ? { required: `${label} is required` } : undefined} render={({ field }) => <FormItem><FormLabel>{label}{required ? " *" : ""}</FormLabel><FormControl><Input {...field} value={String(field.value)} type={type} data-testid={`input-${name}`} /></FormControl><FormMessage /></FormItem>} />
  );

  return <AdminLayout><div className="mx-auto max-w-4xl p-4 md:p-6">
    <Card>
      <CardHeader><CardTitle>New manual DMCA case</CardTitle><CardDescription>Record a notice received outside the public web form. The original document remains private.</CardDescription></CardHeader>
      <CardContent>
        <Form {...form}><form className="space-y-6" onSubmit={form.handleSubmit(submit)}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField control={form.control} name="submittedVia" render={({ field }) => <FormItem><FormLabel>Received via</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-submitted-via"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="email">Email</SelectItem><SelectItem value="mail">Mail</SelectItem><SelectItem value="phone">Phone</SelectItem><SelectItem value="fax">Fax</SelectItem></SelectContent></Select><FormMessage /></FormItem>} />
            {textField("receivedAt", "Date received", true, "date")}
            {textField("claimantName", "Claimant name", true)}
            {textField("company", "Company")}
            {textField("email", "Email", false, "email")}
            {textField("phone", "Phone", submittedVia === "phone")}
            {textField("address", "Address")}
            <FormField control={form.control} name="role" render={({ field }) => <FormItem><FormLabel>Claimant role</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="owner">Copyright owner</SelectItem><SelectItem value="agent">Authorized agent</SelectItem></SelectContent></Select></FormItem>} />
            {textField("copyrightOwnerName", "Copyright owner name")}
            {textField("workTitle", "Copyrighted work title", true)}
            {textField("signature", "Electronic signature", true)}
          </div>
          <FormField control={form.control} name="workDescription" render={({ field }) => <FormItem><FormLabel>Work description</FormLabel><FormControl><Textarea {...field} data-testid="input-work-description" /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="urlsText" rules={{ required: "At least one URL is required" }} render={({ field }) => <FormItem><FormLabel>Infringing URLs * (one per line)</FormLabel><FormControl><Textarea {...field} rows={5} data-testid="input-urls" /></FormControl><FormMessage /></FormItem>} />
          <div><label className="text-sm font-medium" htmlFor="original-document">Original notice document {submittedVia === "phone" ? "(optional)" : "*"}</label><Input id="original-document" type="file" accept=".pdf,image/*,.eml,.txt,.docx" onChange={e => setDocument(e.target.files?.[0] ?? null)} data-testid="input-original-document" /><p className="text-xs text-muted-foreground">PDF, image, EML, TXT, or DOCX; maximum 15 MB.</p></div>
          <FormField control={form.control} name="notes" rules={submittedVia === "phone" ? { required: "A phone call summary is required" } : undefined} render={({ field }) => <FormItem><FormLabel>{submittedVia === "phone" ? "Call summary *" : "Internal intake notes"}</FormLabel><FormControl><Textarea {...field} data-testid="input-notes" /></FormControl><FormMessage /></FormItem>} />
          {(["goodFaith", "accuracyPerjury"] as const).map((name, index) => <FormField key={name} control={form.control} name={name} rules={{ validate: value => value || "This statutory statement must be confirmed" }} render={({ field }) => <FormItem><div className="flex items-start gap-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid={`checkbox-${name}`} /></FormControl><FormLabel>{index === 0 ? "Good-faith belief that use is not authorized" : "Information is accurate and, under penalty of perjury, claimant is authorized"}</FormLabel></div><FormMessage /></FormItem>} />)}
          {form.formState.errors.root?.message && <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>}
          {serverError && <p className="text-sm text-destructive" data-testid="error-create-case">{serverError}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => navigate("/admin/dmca")}>Cancel</Button><Button type="submit" disabled={form.formState.isSubmitting} data-testid="button-create-case">{form.formState.isSubmitting ? "Creating…" : "Create case"}</Button></div>
        </form></Form>
      </CardContent>
    </Card>
  </div></AdminLayout>;
}