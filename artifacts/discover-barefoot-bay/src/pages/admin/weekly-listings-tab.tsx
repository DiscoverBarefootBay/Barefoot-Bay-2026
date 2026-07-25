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
import { Send, Save, Eye, Loader2, Mail } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface WeeklyListingsEmailConfig {
  enabled: boolean;
  sendDay: number;
  sendTime: string;
  sendWhenEmpty: boolean;
}

interface WeeklySendRecord {
  id: number;
  weekStart: string;
  weekEnd: string;
  status: string;
  triggeredBy: string | null;
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
}

interface PreviewResponse {
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
  failed: { label: "Failed", variant: "destructive" },
  skipped_no_listings: { label: "Skipped (no listings)", variant: "secondary" },
  sending: { label: "Sending…", variant: "outline" },
};

export default function WeeklyListingsTab() {
  const { toast } = useToast();
  const [form, setForm] = useState<WeeklyListingsEmailConfig | null>(null);
  const [baseline, setBaseline] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);

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

  const previewQuery = useQuery<PreviewResponse>({
    queryKey: [`${ENDPOINT}/preview`],
    queryFn: async () => {
      const res = await fetch(`${ENDPOINT}/preview`, { credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to load preview: ${text}`);
      }
      return res.json();
    },
    enabled: showPreview,
  });

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
      const res = await apiRequest("POST", `${ENDPOINT}/test`, {});
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

  if (isLoading || !form) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        </CardContent>
      </Card>
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
            A weekly promo email showcasing the new listings posted On The Market during the
            previous week (Monday through Sunday, Eastern time). Each week's campaign can only
            ever be sent once.
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
              onClick={() => setShowPreview((s) => !s)}
              data-testid="button-weekly-preview"
            >
              <Eye className="h-4 w-4 mr-2" />
              {showPreview ? "Hide Preview" : "Preview This Week's Email"}
            </Button>
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
              Send Test to My Email
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (
                  window.confirm(
                    "Send this week's campaign to all opted-in members now? A week can only ever be sent once.",
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

      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle>Email Preview</CardTitle>
            {previewQuery.data && (
              <CardDescription>
                Subject: <span className="font-medium">{previewQuery.data.subject}</span>
                {" · "}
                {previewQuery.data.listings.length} listing(s)
                {" · "}
                {previewQuery.data.recipientCount} recipient(s)
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {previewQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : previewQuery.error ? (
              <p className="text-sm text-destructive">{(previewQuery.error as Error).message}</p>
            ) : previewQuery.data ? (
              <iframe
                title="Weekly email preview"
                srcDoc={previewQuery.data.html}
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
                      <TableCell className="capitalize">{row.triggeredBy || "—"}</TableCell>
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
