import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Send, Save, Eye, Loader2, Mail, RotateCcw } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface WeeklyEmailTemplate {
  subject: string;
  html: string;
}

interface WeeklyListingsEmailConfig {
  enabled: boolean;
  sendDay: number;
  sendTime: string;
  sendWhenEmpty: boolean;
  template: WeeklyEmailTemplate;
}

interface WeeklySendRecord {
  id: number;
  weekStart: string;
  weekEnd: string;
  status: string;
  triggeredBy: string | null;
  triggeredByUser: string | null;
  listingCount: number;
  recipientCount: number;
  sentCount: number;
  error: string | null;
  sentAt: string | null;
  createdAt: string | null;
}

interface ConfigResponse {
  config: WeeklyListingsEmailConfig;
  history: WeeklySendRecord[];
  nextScheduledSend: { dateEt: string; time: string; label: string } | null;
  placeholders?: Array<{ token: string; description: string }>;
  defaultTemplate?: WeeklyEmailTemplate;
}

interface PreviewResponse {
  source?: "saved" | "draft";
  range: { weekStart: string; weekEnd: string; label: string };
  listings: Array<{ id: number; title: string }>;
  recipientCount: number;
  subject: string;
  html: string;
}

const ENDPOINT = "/api/admin/email-activity/weekly-listings";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  sent: { label: "Sent", variant: "default" },
  partially_failed: { label: "Partially failed", variant: "destructive" },
  failed: { label: "Failed", variant: "destructive" },
  skipped_no_listings: { label: "Skipped (no listings)", variant: "secondary" },
  sending: { label: "Sending…", variant: "outline" },
};

export default function WeeklyListingsTab() {
  const { toast } = useToast();
  const [form, setForm] = useState<WeeklyListingsEmailConfig | null>(null);
  const [baseline, setBaseline] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewSource, setPreviewSource] = useState<"saved" | "draft">("saved");
  const [testEmail, setTestEmail] = useState("");

  const { data, isLoading, error } = useQuery<ConfigResponse>({
    queryKey: [ENDPOINT],
    queryFn: async () => {
      const res = await fetch(ENDPOINT, { credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to load weekly email config: ${text}`);
      }
      return res.json();
    },
  });

  useEffect(() => {
    if (data?.config) {
      setForm({ ...data.config });
      setBaseline(JSON.stringify(data.config));
    }
  }, [data]);

  const isDirty = useMemo(
    () => !!form && JSON.stringify(form) !== baseline,
    [form, baseline],
  );

  // The preview always goes through POST: an empty body renders the saved
  // template, a { template } body renders the unsaved draft. Kept out of the
  // shared query cache on purpose — the app-wide placeholderData fallback
  // substitutes `[]` for unknown query keys, which crashed this tab when the
  // preview card read `.listings` off an empty array mid-fetch.
  const previewQuery = useQuery<PreviewResponse>({
    queryKey: [`${ENDPOINT}/preview`, previewSource],
    queryFn: async () => {
      const body =
        previewSource === "draft" && form?.template
          ? { template: { subject: form.template.subject, html: form.template.html } }
          : {};
      const res = await fetch(`${ENDPOINT}/preview`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to load preview: ${text}`);
      }
      return res.json();
    },
    enabled: showPreview,
    placeholderData: undefined,
    staleTime: 0,
    gcTime: 0,
  });

  const previewData =
    previewQuery.data && !Array.isArray(previewQuery.data) ? previewQuery.data : undefined;

  const openPreview = (source: "saved" | "draft") => {
    setPreviewSource(source);
    setShowPreview(true);
    // Same source clicked again while already open → force a fresh render of
    // the latest draft text (the query key doesn't change in that case).
    queryClient.invalidateQueries({ queryKey: [`${ENDPOINT}/preview`, source] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error("Nothing to save");
      const res = await apiRequest("PUT", ENDPOINT, form);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to save settings");
      }
      return res.json() as Promise<{ config: WeeklyListingsEmailConfig }>;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
      queryClient.invalidateQueries({ queryKey: [`${ENDPOINT}/preview`] });
      setForm({ ...updated.config });
      setBaseline(JSON.stringify(updated.config));
      toast({ title: "Settings saved", description: "Weekly email settings updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `${ENDPOINT}/test`, testEmail.trim() ? { email: testEmail.trim() } : {});
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Failed to send test email");
      return body as { message: string };
    },
    onSuccess: (body) => {
      toast({ title: "Test email sent", description: body.message });
    },
    onError: (err: Error) => {
      toast({ title: "Test email failed", description: err.message, variant: "destructive" });
    },
  });

  const sendNowMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `${ENDPOINT}/send`, {});
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Failed to send the campaign");
      return body as { message: string };
    },
    onSuccess: (body) => {
      queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
      toast({ title: "Campaign triggered", description: body.message });
    },
    onError: (err: Error) => {
      queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    },
  });

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !form) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Weekly "Currently, On The Market" Email
          </CardTitle>
          <CardDescription>
            A weekly promo email showcasing the listings posted On The Market during the last
            7 days (ending today, Eastern time). Only one campaign can go out per weekly cycle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Automatic weekly send</p>
              <p className="text-sm text-muted-foreground">
                When enabled, the campaign goes out automatically every{" "}
                {DAY_NAMES[form.sendDay]} at {form.sendTime} ET.
              </p>
            </div>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => setForm({ ...form, enabled: v })}
              data-testid="switch-weekly-enabled"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Send day (Eastern time)</Label>
              <Select
                value={String(form.sendDay)}
                onValueChange={(v) => setForm({ ...form, sendDay: Number(v) })}
              >
                <SelectTrigger data-testid="select-weekly-send-day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((name, i) => (
                    <SelectItem key={name} value={String(i)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="weekly-send-time">Send time (24h, Eastern)</Label>
              <Input
                id="weekly-send-time"
                type="time"
                value={form.sendTime}
                onChange={(e) => setForm({ ...form, sendTime: e.target.value })}
                data-testid="input-weekly-send-time"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Send even when there are no new listings</p>
              <p className="text-sm text-muted-foreground">
                Off by default — weeks with zero new listings are skipped.
              </p>
            </div>
            <Switch
              checked={form.sendWhenEmpty}
              onCheckedChange={(v) => setForm({ ...form, sendWhenEmpty: v })}
              data-testid="switch-weekly-send-when-empty"
            />
          </div>

          {data?.nextScheduledSend ? (
            <p className="text-sm text-muted-foreground" data-testid="text-next-scheduled-send">
              Next automatic send: <span className="font-medium">{data.nextScheduledSend.label}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="text-next-scheduled-send">
              Automatic sending is off — no send is scheduled.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="weekly-test-email">Test email address (defaults to your own)</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="weekly-test-email"
                type="email"
                placeholder="you@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="max-w-xs"
                data-testid="input-weekly-test-email"
              />
              <Button
                variant="outline"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending}
                data-testid="button-weekly-test"
              >
                {testMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send Test Email
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Test emails are labeled [TEST], go only to this address, and never count as the
              real campaign send.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!isDirty || saveMutation.isPending}
              data-testid="button-weekly-save"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (showPreview && previewSource === "saved") {
                  setShowPreview(false);
                } else {
                  openPreview("saved");
                }
              }}
              data-testid="button-weekly-preview"
            >
              <Eye className="h-4 w-4 mr-2" />
              {showPreview && previewSource === "saved" ? "Hide Preview" : "Preview Current Email"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (
                  window.confirm(
                    "⚠️ This emails REAL subscribers: the campaign will go to every opted-in member's actual inbox. This is NOT a test. Only one campaign can go out per weekly cycle. Send now?",
                  )
                ) {
                  sendNowMutation.mutate();
                }
              }}
              disabled={sendNowMutation.isPending}
              data-testid="button-weekly-send-now"
            >
              {sendNowMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Campaign Now
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Template</CardTitle>
          <CardDescription>
            Edit the subject and HTML body of the weekly digest email. Use the placeholder tokens
            below — they're swapped for real values when the email is sent. Keep{" "}
            <span className="font-mono">{"{{listings}}"}</span> in the body or the listing cards
            won't appear. The plain-text version is generated automatically. Save your changes,
            then use the preview or a test email to check the result.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="weekly-template-subject">Subject</Label>
            <Input
              id="weekly-template-subject"
              value={form.template?.subject ?? ""}
              onChange={(e) =>
                setForm({ ...form, template: { ...form.template, subject: e.target.value } })
              }
              data-testid="input-weekly-template-subject"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="weekly-template-html">HTML Body</Label>
            <Textarea
              id="weekly-template-html"
              value={form.template?.html ?? ""}
              onChange={(e) =>
                setForm({ ...form, template: { ...form.template, html: e.target.value } })
              }
              rows={14}
              className="font-mono text-xs"
              data-testid="textarea-weekly-template-html"
            />
          </div>

          {(data?.placeholders?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Available placeholders</Label>
              <div className="flex flex-wrap gap-2">
                {data!.placeholders!.map((p) => (
                  <Badge key={p.token} variant="secondary" title={p.description} className="font-mono">
                    {p.token}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="ghost"
              disabled={!data?.defaultTemplate}
              onClick={() => {
                if (data?.defaultTemplate) {
                  setForm({ ...form, template: { ...data.defaultTemplate } });
                }
              }}
              data-testid="button-weekly-template-reset"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset template to default
            </Button>
            <div className="flex items-center gap-3">
              {isDirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
              <Button
                variant="outline"
                onClick={() => openPreview("draft")}
                data-testid="button-weekly-preview-draft"
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview draft
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!isDirty || saveMutation.isPending}
                data-testid="button-weekly-template-save"
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
        </CardContent>
      </Card>

      {showPreview && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                Email Preview
                <Badge
                  variant={previewSource === "draft" ? "destructive" : "secondary"}
                  data-testid="badge-weekly-preview-source"
                >
                  {previewSource === "draft" ? "Draft (unsaved changes)" : "Saved template"}
                </Badge>
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(false)}
                data-testid="button-weekly-preview-close"
              >
                Hide
              </Button>
            </div>
            {previewData && Array.isArray(previewData.listings) && (
              <CardDescription>
                Subject: <span className="font-medium">{previewData.subject}</span>
                {" · "}
                {previewData.listings.length} listing(s)
                {" · "}
                {previewData.recipientCount} recipient(s)
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {previewQuery.isFetching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : previewQuery.error ? (
              <p className="text-sm text-destructive">{(previewQuery.error as Error).message}</p>
            ) : previewData ? (
              <iframe
                title="Weekly email preview"
                srcDoc={previewData.html}
                className="w-full rounded-md border"
                style={{ height: 640 }}
                sandbox=""
                data-testid="iframe-weekly-preview"
              />
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Send History</CardTitle>
          <CardDescription>One row per campaign week — most recent first.</CardDescription>
        </CardHeader>
        <CardContent>
          {data && data.history.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead className="text-right">Listings</TableHead>
                  <TableHead className="text-right">Recipients</TableHead>
                  <TableHead className="text-right">Delivered To</TableHead>
                  <TableHead>Sent At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.history.map((row) => {
                  const badge = STATUS_BADGES[row.status] ?? {
                    label: row.status,
                    variant: "outline" as const,
                  };
                  return (
                    <TableRow key={row.id} data-testid={`row-weekly-history-${row.weekStart}`}>
                      <TableCell className="font-medium">
                        {row.weekStart} – {row.weekEnd}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                        {row.error && (
                          <p className="text-xs text-destructive mt-1">{row.error}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="capitalize">{row.triggeredBy || "—"}</span>
                        {row.triggeredByUser && (
                          <p className="text-xs text-muted-foreground">by {row.triggeredByUser}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{row.listingCount}</TableCell>
                      <TableCell className="text-right">{row.recipientCount}</TableCell>
                      <TableCell className="text-right">{row.sentCount}</TableCell>
                      <TableCell>
                        {row.sentAt ? format(new Date(row.sentAt), "MMM dd, yyyy h:mm a") : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No campaigns have been sent yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
