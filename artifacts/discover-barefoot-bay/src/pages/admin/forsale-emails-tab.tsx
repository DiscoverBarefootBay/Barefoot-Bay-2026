import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Send, Save, RotateCcw, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUnsavedChangesPrompt } from "@/hooks/use-unsaved-changes-prompt";

type ForSaleEmailType = "adminExpired" | "sellerExpired" | "noActiveListings";

interface ForSaleEmailTemplate {
  enabled: boolean;
  subject: string;
  html: string;
}

interface ForSaleEmailTimingConfig {
  emptyThresholdDays: number;
  resendIntervalDays: number;
}

interface ForSaleEmailConfig {
  adminExpired: ForSaleEmailTemplate;
  sellerExpired: ForSaleEmailTemplate;
  noActiveListings: ForSaleEmailTemplate;
  timing: ForSaleEmailTimingConfig;
}

interface Placeholder {
  token: string;
  description: string;
}

interface ConfigResponse {
  config: ForSaleEmailConfig;
  placeholders: Record<ForSaleEmailType, Placeholder[]>;
}

interface TestResponse {
  sentTo: string;
  results: Record<string, boolean>;
  message: string;
}

const EMAIL_TYPES: Array<{ type: ForSaleEmailType; title: string; description: string }> = [
  {
    type: "adminExpired",
    title: "Listing Expired — Admin Alert",
    description: "Sent to admins the moment an On The Market listing expires, with the seller's contact details.",
  },
  {
    type: "sellerExpired",
    title: "Listing Expired — Seller Reminder",
    description: "Sent to the seller when their listing expires, explaining how to renew it.",
  },
  {
    type: "noActiveListings",
    title: "No Active Listings — Admin Reminder",
    description: "Sent to admins when the public On The Market page has had no active listings for a while.",
  },
];

const ENDPOINT = "/api/admin/email-activity/forsale-emails";

const cloneConfig = (config: ForSaleEmailConfig): ForSaleEmailConfig => ({
  adminExpired: { ...config.adminExpired },
  sellerExpired: { ...config.sellerExpired },
  noActiveListings: { ...config.noActiveListings },
  timing: { ...config.timing },
});

export default function ForSaleEmailsTab() {
  const { toast } = useToast();
  const [form, setForm] = useState<ForSaleEmailConfig | null>(null);
  const [baseline, setBaseline] = useState<string>("");

  const { data, isLoading, error } = useQuery<ConfigResponse>({
    queryKey: [ENDPOINT],
    queryFn: async () => {
      const res = await fetch(ENDPOINT, { credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to load On The Market email config: ${text}`);
      }
      return res.json();
    },
  });

  // Seed the editable form from the server config once it arrives. Re-seeding on
  // a fresh fetch (e.g. after save/reset) keeps the baseline in sync.
  useEffect(() => {
    if (data?.config) {
      setForm(cloneConfig(data.config));
      setBaseline(JSON.stringify(data.config));
    }
  }, [data]);

  const isDirty = useMemo(
    () => !!form && JSON.stringify(form) !== baseline,
    [form, baseline],
  );

  const unsavedChangesDialog = useUnsavedChangesPrompt(isDirty, {
    title: "Unsaved email changes",
    description:
      "You have unsaved changes to the On The Market email templates. If you leave now, your edits will be lost.",
    confirmLabel: "Discard & Leave",
    cancelLabel: "Stay on Page",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error("Nothing to save");
      const res = await apiRequest("PUT", ENDPOINT, form);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to save email templates");
      }
      return res.json() as Promise<ConfigResponse>;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData([ENDPOINT], updated);
      setForm(cloneConfig(updated.config));
      setBaseline(JSON.stringify(updated.config));
      toast({ title: "Templates saved", description: "Your On The Market email changes are live." });
    },
    onError: (err: Error) => {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", ENDPOINT);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to reset templates");
      }
      return res.json() as Promise<ConfigResponse>;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData([ENDPOINT], updated);
      setForm(cloneConfig(updated.config));
      setBaseline(JSON.stringify(updated.config));
      toast({ title: "Reset to defaults", description: "Templates reverted to the built-in versions." });
    },
    onError: (err: Error) => {
      toast({ title: "Could not reset", description: err.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (types: ForSaleEmailType[]) => {
      const res = await apiRequest("POST", `${ENDPOINT}/test`, { types });
      const json = (await res.json().catch(() => ({}))) as Partial<TestResponse> & { message?: string };
      if (!res.ok) {
        throw new Error(json.message || "Failed to send test email");
      }
      return json as TestResponse;
    },
    onSuccess: (result) => {
      toast({ title: "Test sent", description: result.message });
    },
    onError: (err: Error) => {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    },
  });

  const testingTypes = (testMutation.variables ?? []) as ForSaleEmailType[];

  const updateTemplate = (type: ForSaleEmailType, patch: Partial<ForSaleEmailTemplate>) => {
    setForm((prev) => (prev ? { ...prev, [type]: { ...prev[type], ...patch } } : prev));
  };

  const updateTiming = (patch: Partial<ForSaleEmailTimingConfig>) => {
    setForm((prev) => (prev ? { ...prev, timing: { ...prev.timing, ...patch } } : prev));
  };

  if (isLoading || !form) {
    return (
      <Card>
        <CardContent className="py-10 flex items-center justify-center text-muted-foreground">
          {error ? (
            <span className="text-destructive">
              {error instanceof Error ? error.message : "Failed to load email configuration"}
            </span>
          ) : (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Loading email templates…
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {unsavedChangesDialog}

      <div className="bg-muted rounded-lg p-4">
        <p className="text-sm text-muted-foreground">
          Edit the subject and HTML body of the three automated On The Market listing emails, turn each one on or off, and
          adjust how the "no active listings" reminder is timed. Use the <span className="font-medium">placeholder
          tokens</span> shown under each email — they're swapped for real values when the email is sent. The plain-text
          version is generated automatically from your HTML.{" "}
          <span className="font-medium">Test emails are sent only to your own account email</span> and use the most
          recently saved version, so save before testing your edits.
        </p>
      </div>

      {EMAIL_TYPES.map(({ type, title, description }) => {
        const tpl = form[type];
        const placeholders = data?.placeholders?.[type] ?? [];
        const isTesting = testMutation.isPending && testingTypes.includes(type);
        return (
          <Card key={type} data-testid={`card-email-${type}`}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">{title}</CardTitle>
                  <CardDescription className="mt-1">{description}</CardDescription>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Label htmlFor={`enabled-${type}`} className="text-sm text-muted-foreground">
                    {tpl.enabled ? "Enabled" : "Disabled"}
                  </Label>
                  <Switch
                    id={`enabled-${type}`}
                    checked={tpl.enabled}
                    onCheckedChange={(checked) => updateTemplate(type, { enabled: checked })}
                    data-testid={`switch-enabled-${type}`}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`subject-${type}`}>Subject</Label>
                <Input
                  id={`subject-${type}`}
                  value={tpl.subject}
                  onChange={(e) => updateTemplate(type, { subject: e.target.value })}
                  data-testid={`input-subject-${type}`}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`html-${type}`}>HTML Body</Label>
                <Textarea
                  id={`html-${type}`}
                  value={tpl.html}
                  onChange={(e) => updateTemplate(type, { html: e.target.value })}
                  rows={12}
                  className="font-mono text-xs"
                  data-testid={`textarea-html-${type}`}
                />
              </div>

              {placeholders.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Available placeholders</Label>
                  <div className="flex flex-wrap gap-2">
                    {placeholders.map((p) => (
                      <Badge key={p.token} variant="secondary" title={p.description} className="font-mono">
                        {p.token}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testMutation.mutate([type])}
                  disabled={testMutation.isPending}
                  data-testid={`button-test-${type}`}
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send test to me
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Reminder Timing</CardTitle>
          <CardDescription>
            Controls the "No Active Listings" admin reminder: how long the On The Market page must be empty before the first
            reminder, and how often it repeats while it stays empty.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="empty-threshold">Days empty before first reminder</Label>
              <Input
                id="empty-threshold"
                type="number"
                min={1}
                value={form.timing.emptyThresholdDays}
                onChange={(e) =>
                  updateTiming({ emptyThresholdDays: e.target.value === "" ? 0 : Number(e.target.value) })
                }
                data-testid="input-empty-threshold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resend-interval">Resend every (days)</Label>
              <Input
                id="resend-interval"
                type="number"
                min={1}
                value={form.timing.resendIntervalDays}
                onChange={(e) =>
                  updateTiming({ resendIntervalDays: e.target.value === "" ? 0 : Number(e.target.value) })
                }
                data-testid="input-resend-interval"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => resetMutation.mutate()}
          disabled={resetMutation.isPending || saveMutation.isPending}
          data-testid="button-reset-templates"
        >
          {resetMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4 mr-2" />
          )}
          Reset to defaults
        </Button>

        <div className="flex items-center gap-3">
          {isDirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty || saveMutation.isPending}
            data-testid="button-save-templates"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
