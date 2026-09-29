import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AlertTriangle, Pencil, Save, X, Phone, Mail, MapPin, Building, User, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLegalPolicies } from "@/hooks/use-legal";
import { PolicyDocument, PolicySkeleton, PolicyVersionMeta } from "@/components/legal/policy-document";
import { LEGAL_QUERY_KEYS } from "@/lib/legal";

type DMCAAgent = {
  name: string | null;
  organization: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
};

type DMCASection = {
  key: string;
  title: string;
  body: string;
  pendingCounselReview: boolean;
};

type DMCAPolicyResponse = {
  agent: DMCAAgent;
  agentConfigured: boolean;
  sections: DMCASection[];
  canEdit: boolean;
  updatedAt: string | null;
};

const policySchema = z.object({
  agent: z.object({
    name: z.string().nullable(),
    organization: z.string().nullable(),
    address: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
  }),
  sections: z.array(
    z.object({
      key: z.string(),
      title: z.string().min(1, "Title is required"),
      body: z.string().min(1, "Body is required"),
      pendingCounselReview: z.boolean(),
    })
  ),
});

type PolicyFormValues = z.infer<typeof policySchema>;

const RenderText = ({ text }: { text: string }) => {
  if (!text) return null;
  type Block = { kind: "p" | "ul"; lines: string[] };
  const blocks: Block[] = [];
  for (const raw of text.trim().split(/\r?\n/)) {
    const line = raw.trimEnd();
    const last = blocks[blocks.length - 1];
    if (!line.trim()) {
      blocks.push({ kind: "p", lines: [] });
      continue;
    }
    const kind = line.startsWith("- ") ? "ul" : "p";
    const content = kind === "ul" ? line.substring(2) : line;
    if (last && last.kind === kind && (kind === "ul" || last.lines.length > 0)) last.lines.push(content);
    else blocks.push({ kind, lines: [content] });
  }
  return (
    <div className="space-y-4 text-gray-700 leading-relaxed">
      {blocks.filter((b) => b.lines.length > 0).map((block, i) =>
        block.kind === "ul" ? (
          <ul key={i} className="list-disc pl-6 space-y-2">
            {block.lines.map((line, j) => <li key={j}>{line}</li>)}
          </ul>
        ) : (
          <p key={i} className="whitespace-pre-line">{block.lines.join("\n")}</p>
        ),
      )}
    </div>
  );
};

export default function DMCAPolicyPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const { data, isLoading, isPlaceholderData, error } = useQuery<DMCAPolicyResponse>({
    queryKey: ["/api/dmca/policy"],
  });
  const { data: legalPolicies, isLoading: legalLoading, isError: legalError, refetch: refetchLegal } = useLegalPolicies();
  const dmcaSnapshot = legalPolicies?.find((p) => p.key === "dmca");

  const updateMutation = useMutation({
    mutationFn: async (payload: PolicyFormValues) => {
      const res = await apiRequest("PUT", "/api/dmca/settings", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dmca/policy"] });
      queryClient.invalidateQueries({ queryKey: LEGAL_QUERY_KEYS.policies });
      queryClient.invalidateQueries({ queryKey: LEGAL_QUERY_KEYS.consentRoot });
      setIsEditing(false);
      toast({
        title: "Policy saved",
        description: "If the published text changed, a new version was created and signed-in members must accept it again before continuing.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Update failed",
        description: err.message || "Could not update the policy.",
        variant: "destructive",
      });
    },
  });

  const form = useForm<PolicyFormValues>({
    resolver: zodResolver(policySchema),
    defaultValues: {
      agent: { name: "", organization: "", address: "", phone: "", email: "" },
      sections: [],
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "sections",
  });

  useEffect(() => {
    // The app-wide react-query placeholder can hand us []/null before the
    // real response arrives, so only reset once the policy shape is present.
    if (data && !isPlaceholderData && data.agent && Array.isArray(data.sections) && !isEditing) {
      form.reset({
        agent: {
          name: data.agent.name || "",
          organization: data.agent.organization || "",
          address: data.agent.address || "",
          phone: data.agent.phone || "",
          email: data.agent.email || "",
        },
        sections: data.sections,
      });
    }
  }, [data, isPlaceholderData, isEditing, form]);

  if (isLoading || isPlaceholderData) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !data || !Array.isArray(data.sections) || !data.agent) {
    return (
      <div className="py-24 text-center">
        <h2 className="text-2xl font-bold text-gray-800">Unable to load policy</h2>
        <p className="text-gray-600 mt-2">There was an error loading the DMCA policy.</p>
      </div>
    );
  }

  const handleEditClick = () => setIsEditing(true);
  const handleCancelClick = () => {
    setIsEditing(false);
    form.reset();
  };

  const onSubmit = (values: PolicyFormValues) => {
    updateMutation.mutate(values);
  };

  const designatedAgentSection = data.sections.find((s) => s.key === "designated_agent");
  const otherSections = data.sections.filter((s) => s.key !== "designated_agent");
  
  // Re-order for table of contents
  const allSections = data.sections;

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-2">Copyright / DMCA Policy</h1>
          {dmcaSnapshot ? (
            <PolicyVersionMeta policy={dmcaSnapshot} />
          ) : data.updatedAt ? (
            <p className="text-sm text-gray-500">
              Last updated: {new Date(data.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {data.canEdit && !isEditing && (
            <Button variant="outline" onClick={handleEditClick}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit Policy
            </Button>
          )}
          <Button asChild className="bg-primary hover:bg-primary/90 text-white shadow-md">
            <Link href="/dmca/notice">Submit a copyright notice</Link>
          </Button>
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-12">
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Edit Mode</h2>
                <p className="text-sm text-amber-800 mt-1" role="note" data-testid="text-dmca-republish-warning">
                  Saving changed text publishes a new policy version. Every signed-in member will be asked to review and accept it again.
                </p>
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={handleCancelClick}>
                  <X className="w-4 h-4 mr-2" /> Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
                </Button>
              </div>
            </div>

            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Designated Agent</CardTitle>
                <CardDescription>Contact information for the DMCA designated agent.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input {...form.register("agent.name")} placeholder="Jane Doe" />
                </div>
                <div className="space-y-2">
                  <Label>Organization</Label>
                  <Input {...form.register("agent.organization")} placeholder="Barefoot Bay" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input {...form.register("agent.email")} placeholder="dmca@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input {...form.register("agent.phone")} placeholder="(555) 123-4567" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Mailing Address</Label>
                  <Textarea {...form.register("agent.address")} placeholder="123 Main St&#10;City, State 12345" rows={3} />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-8">
              {fields.map((field, index) => (
                <Card key={field.id} className="overflow-hidden border-blue-100">
                  <div className="bg-blue-50/50 px-6 py-4 border-b border-blue-100 flex justify-between items-center">
                    <div className="font-mono text-sm font-semibold text-blue-800 uppercase tracking-wider">
                      Section: {form.getValues(`sections.${index}.key`)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`sections.${index}.pendingCounselReview`} className="text-sm font-medium text-amber-700">
                        Pending Counsel Review
                      </Label>
                      <Switch
                        id={`sections.${index}.pendingCounselReview`}
                        checked={form.watch(`sections.${index}.pendingCounselReview`)}
                        onCheckedChange={(val) => form.setValue(`sections.${index}.pendingCounselReview`, val, { shouldDirty: true })}
                      />
                    </div>
                  </div>
                  <CardContent className="p-6 space-y-4">
                    <div className="space-y-2">
                      <Label>Heading</Label>
                      <Input {...form.register(`sections.${index}.title`)} className="font-semibold text-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label>Content (Plain text, blank lines for paragraphs, start with '- ' for bullets)</Label>
                      <Textarea 
                        {...form.register(`sections.${index}.body`)} 
                        rows={10} 
                        className="font-mono text-sm leading-relaxed"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <div className="flex justify-end gap-3 mt-8">
              <Button type="button" variant="ghost" onClick={handleCancelClick}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending} size="lg">
                {updateMutation.isPending ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <div className="bg-white/95 rounded-xl">
          {legalLoading ? (
            <PolicySkeleton />
          ) : legalError || !dmcaSnapshot ? (
            <div role="alert" className="text-center py-10">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
              <p className="text-gray-700 mb-4">The current published Copyright / DMCA policy could not be loaded.</p>
              <Button onClick={() => refetchLegal()}>Try again</Button>
            </div>
          ) : (
            <PolicyDocument policy={dmcaSnapshot} showHeader={false} />
          )}
        </div>
      )}
    </div>
  );
}
