import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gavel, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CONTENT_TYPE_LABELS, DMCA_ADMIN_API, dmcaFetch } from "@/lib/dmca-admin";
import type { CaseDetail } from "./types";

type Field = { key: string; label: string; required?: boolean; kind?: "textarea" | "date" | "checkbox" | "file" | "select"; options?: Array<{ value: string; label: string }> };
/** The site theme does not define a visible destructive colour, so style danger actions explicitly. */
const DANGER_BUTTON = "bg-red-600 text-white hover:bg-red-700";
type ActionConfig = { action: string; label: string; title?: string; description: string; method?: string; endpoint: (caseId: string, values: Record<string, any>) => string; fields?: Field[]; danger?: boolean; buildBody?: (values: Record<string, any>) => any };

const CONTENT_OPTIONS = Object.entries(CONTENT_TYPE_LABELS).filter(([key]) => key !== "avatar").map(([value, label]) => ({ value, label }));
const configs: ActionConfig[] = [
  { action: "start_review", label: "Start Review", description: "Move this notice into formal review.", endpoint: id => `/cases/${id}/start-review` },
  { action: "request_info", label: "Request Missing Information", description: "Tell the claimant exactly what must be corrected. This sends a claimant email.", endpoint: id => `/cases/${id}/request-info`, fields: [
    { key: "reasons", label: "Missing items", required: true }, { key: "otherText", label: "Other missing information" }, { key: "message", label: "Message to claimant", kind: "textarea" },
  ] },
  { action: "approve_takedown", label: "Approve Takedown", description: "This reversibly hides every target; it never permanently deletes content.", endpoint: id => `/cases/${id}/approve-takedown`, danger: true, fields: [{ key: "reason", label: "Approval reason", required: true, kind: "textarea" }, { key: "notifyUploader", label: "Notify uploader", kind: "checkbox" }] },
  { action: "reject", label: "Reject / Close – No Action", description: "Reject the notice, close the case, and notify the claimant.", endpoint: id => `/cases/${id}/reject`, fields: [{ key: "reason", label: "Reason", required: true, kind: "textarea" }] },
  { action: "add_content", label: "Add Content to Case", description: "Add by content type and ID, or enter a resolvable URL.", endpoint: id => `/cases/${id}/targets`, fields: [{ key: "url", label: "URL (leave blank when using type and ID)" }, { key: "contentType", label: "Content type", kind: "select", options: CONTENT_OPTIONS }, { key: "contentId", label: "Content ID" }], buildBody: v => v.url ? { url: v.url } : { contentType: v.contentType, contentId: v.contentId } },
  { action: "add_hold", label: "Add Legal Hold", description: "Place a legal hold on this case and all content targets.", endpoint: id => `/cases/${id}/holds`, fields: [{ key: "reason", label: "Legal hold reason", required: true, kind: "textarea" }] },
  { action: "record_counter", label: "Record Counter-Notice", description: "Record the true receipt date and every statutory counter-notice statement.", endpoint: id => `/cases/${id}/counter-notice`, fields: [
    { key: "receivedAt", label: "Received date", required: true, kind: "date" }, { key: "submittedVia", label: "Received via", required: true, kind: "select", options: ["email", "mail", "phone", "fax"].map(value => ({ value, label: value })) },
    { key: "name", label: "Name", required: true }, { key: "address", label: "Address", required: true, kind: "textarea" }, { key: "phone", label: "Phone", required: true }, { key: "email", label: "Email" },
    { key: "materialIdentification", label: "Identification of removed material and prior location", required: true, kind: "textarea" },
    { key: "goodFaithStatement", label: "Good-faith statement under penalty of perjury", required: true, kind: "checkbox" },
    { key: "jurisdictionConsent", label: "Consent to Federal District Court jurisdiction and service", required: true, kind: "checkbox" },
    { key: "signature", label: "Signature", required: true }, { key: "document", label: "Original counter-notice document", kind: "file" }, { key: "notes", label: "Internal notes", kind: "textarea" },
  ] },
  { action: "accept_counter", label: "Accept Counter-Notice", description: "Confirm the counter-notice satisfies statutory requirements.", endpoint: id => `/cases/${id}/counter-notice/accept` },
  { action: "reject_counter", label: "Reject Counter-Notice", description: "Mark the counter-notice incomplete and record why.", endpoint: id => `/cases/${id}/counter-notice/reject`, fields: [{ key: "reason", label: "Reason", required: true, kind: "textarea" }] },
  { action: "forward_counter", label: "Forward Counter-Notice to Claimant", description: "Email the accepted counter-notice and calculate the 10/14-business-day restoration window.", endpoint: id => `/cases/${id}/counter-notice/forward` },
  { action: "court_action", label: "Record Court Action / Prevent Restoration", description: "Record a court action, keep content hidden, and prevent restoration. A document or notes is required.", endpoint: id => `/cases/${id}/court-action`, fields: [{ key: "document", label: "Court document", kind: "file" }, { key: "notes", label: "Court action notes", kind: "textarea" }] },
  { action: "restore", label: "Restore Content", description: "Counter-notice restoration is allowed only on/after the eligibility date. Any legal or court hold blocks restoration.", endpoint: id => `/cases/${id}/restore`, fields: [{ key: "mode", label: "Restoration basis", required: true, kind: "select", options: [{ value: "counter_notice", label: "Counter-notice waiting period completed" }, { value: "notice_withdrawn", label: "Notice withdrawn / erroneous takedown" }] }, { key: "reason", label: "Restoration reason", required: true, kind: "textarea" }] },
  { action: "close", label: "Close Case", description: "Close with the final content outcome and notify the relevant parties.", endpoint: id => `/cases/${id}/close`, fields: [{ key: "outcome", label: "Outcome", required: true, kind: "select", options: [{ value: "removed", label: "Removed" }, { value: "restored", label: "Restored" }] }, { key: "notes", label: "Closure notes", kind: "textarea" }] },
];

const missingReasons = [
  ["work_id", "Identification of copyrighted work"], ["url", "Infringing URL"], ["contact", "Contact information"],
  ["statement", "Required statement"], ["signature", "Signature"], ["other", "Other"],
] as const;

function ActionDialog({ config, detail, open, onOpenChange }: { config: ActionConfig; detail: CaseDetail; open: boolean; onOpenChange: (value: boolean) => void }) {
  const restoreMode = ["WAITING_FOR_RESTORATION_WINDOW", "RESTORATION_ELIGIBLE"].includes(detail.case.status) ? "counter_notice" : "notice_withdrawn";
  const fields = config.action === "restore"
    ? (config.fields ?? []).map(field => field.key === "mode"
      ? { ...field, options: restoreMode === "counter_notice"
          ? [{ value: "counter_notice", label: "Counter-notice waiting period completed" }]
          : [{ value: "notice_withdrawn", label: "Notice withdrawn / erroneous takedown" }] }
      : field)
    : (config.fields ?? []);
  const [values, setValues] = useState<Record<string, any>>({ notifyUploader: true, reasons: [], receivedAt: new Date().toISOString().slice(0, 10), submittedVia: "email", ...(config.action === "restore" ? { mode: restoreMode } : {}) });
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: async () => {
      setError("");
      for (const field of fields) {
        if (field.required && (field.key === "reasons" ? !values.reasons?.length : !values[field.key])) throw new Error(`${field.label} is required.`);
      }
      if (config.action === "request_info" && values.reasons?.includes("other") && !values.otherText) throw new Error("Describe the other missing information.");
      if (config.action === "add_content" && !values.url && (!values.contentType || !values.contentId)) throw new Error("Enter either a URL or both content type and content ID.");
      if (config.action === "court_action" && !values.document && !values.notes?.trim()) throw new Error("Upload a court document or enter notes.");
      let body = config.buildBody ? config.buildBody(values) : { ...values };
      if (values.document) {
        const formData = new FormData(); formData.append("file", values.document);
        const upload = await dmcaFetch<{ path: string }>("/files", { method: "POST", formData });
        body = config.action === "record_counter" ? { ...body, originalDocumentPath: upload.path } : { ...body, documentPath: upload.path };
        delete body.document;
      }
      return dmcaFetch<any>(config.endpoint(detail.case.id, values), { method: config.method ?? "POST", body });
    },
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: [DMCA_ADMIN_API, "case", detail.case.id] });
      queryClient.invalidateQueries({ queryKey: [DMCA_ADMIN_API, "cases"] });
      const dates = result?.case?.restoreEligibleAt || result?.restoreEligibleAt ? ` Eligible ${new Date(result.case?.restoreEligibleAt ?? result.restoreEligibleAt).toLocaleDateString()}; deadline ${new Date(result.case?.restoreDeadlineAt ?? result.restoreDeadlineAt).toLocaleDateString()}.` : "";
      toast({ title: `${config.label} completed`, description: dates || undefined });
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message),
  });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{config.title ?? config.label}</DialogTitle><DialogDescription>{config.description}</DialogDescription></DialogHeader>
    <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
      {fields.map(field => {
        if (field.key === "reasons") return <div key={field.key} className="space-y-2"><Label>Missing items *</Label>{missingReasons.map(([value, label]) => <label key={value} className="flex items-center gap-2 text-sm"><Checkbox checked={values.reasons?.includes(value)} onCheckedChange={checked => setValues(v => ({ ...v, reasons: checked ? [...(v.reasons ?? []), value] : (v.reasons ?? []).filter((x: string) => x !== value) }))} />{label}</label>)}</div>;
        if (field.kind === "checkbox") return <label key={field.key} className="flex items-start gap-2 text-sm"><Checkbox checked={Boolean(values[field.key])} onCheckedChange={checked => setValues(v => ({ ...v, [field.key]: checked === true }))} />{field.label}{field.required ? " *" : ""}</label>;
        if (field.kind === "select") return <div key={field.key} className="space-y-2"><Label>{field.label}{field.required ? " *" : ""}</Label><Select value={values[field.key] ?? ""} onValueChange={value => setValues(v => ({ ...v, [field.key]: value }))}><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger><SelectContent>{field.options?.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>;
        if (field.kind === "textarea") return <div key={field.key} className="space-y-2"><Label>{field.label}{field.required ? " *" : ""}</Label><Textarea value={values[field.key] ?? ""} onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))} /></div>;
        if (field.kind === "file") return <div key={field.key} className="space-y-2"><Label>{field.label}</Label><Input type="file" accept=".pdf,image/*,.eml,.txt,.docx" onChange={e => setValues(v => ({ ...v, [field.key]: e.target.files?.[0] }))} /></div>;
        return <div key={field.key} className="space-y-2"><Label>{field.label}{field.required ? " *" : ""}</Label><Input type={field.kind === "date" ? "date" : "text"} value={values[field.key] ?? ""} onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))} /></div>;
      })}
      {config.action === "restore" && restoreMode === "counter_notice" && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">Eligible: {detail.case.restoreEligibleAt ? new Date(detail.case.restoreEligibleAt).toLocaleString() : "not yet calculated"}. Deadline: {detail.case.restoreDeadlineAt ? new Date(detail.case.restoreDeadlineAt).toLocaleString() : "not yet calculated"}. {detail.case.legalHold && "Restoration is blocked by an active legal hold."}</p>}
      {error && <p className="text-sm text-destructive" data-testid={`error-${config.action}`}>{error}</p>}
    </div>
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant={config.danger ? "destructive" : "default"} className={config.danger ? DANGER_BUTTON : undefined} onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm {config.label}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

export function CaseActionBar({ detail }: { detail: CaseDetail }) {
  const [selected, setSelected] = useState<ActionConfig | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [adminId, setAdminId] = useState(detail.case.adminAssignedId != null ? String(detail.case.adminAssignedId) : "unassigned");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const assignees = useQuery<Array<{ id: string; username: string; fullName?: string }>>({ queryKey: [DMCA_ADMIN_API, "assignees"], queryFn: () => dmcaFetch("/assignees"), enabled: detail.availableActions.includes("assign"), placeholderData: undefined });
  const assign = useMutation({
    mutationFn: () => dmcaFetch(`/cases/${detail.case.id}/assign`, { method: "PATCH", body: { adminId: adminId === "unassigned" ? null : Number(adminId) } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [DMCA_ADMIN_API, "case", detail.case.id] }); queryClient.invalidateQueries({ queryKey: [DMCA_ADMIN_API, "cases"] }); toast({ title: "Assignment updated" }); setAssignOpen(false); },
    onError: (error: Error) => toast({ title: "Assignment failed", description: error.message, variant: "destructive" }),
  });
  const available = new Set(detail.availableActions);
  return <div className="rounded-lg border bg-card p-4"><div className="mb-3 flex items-center gap-2"><Gavel className="h-5 w-5" /><h2 className="font-semibold">Case actions</h2></div><div className="flex flex-wrap gap-2">
    {available.has("assign") && <Button variant="outline" onClick={() => setAssignOpen(true)}>Assign</Button>}
    {configs.filter(config => available.has(config.action)).map(config => <Button key={config.action} variant={config.danger ? "destructive" : "outline"} className={config.danger ? DANGER_BUTTON : undefined} onClick={() => setSelected(config)} data-testid={`action-${config.action}`}>{config.label}</Button>)}
  </div>
  {selected && <ActionDialog config={selected} detail={detail} open onOpenChange={open => { if (!open) setSelected(null); }} />}
  <Dialog open={assignOpen} onOpenChange={setAssignOpen}><DialogContent><DialogHeader><DialogTitle>Assign case</DialogTitle><DialogDescription>Choose a user who holds dmca.view.</DialogDescription></DialogHeader><Select value={adminId} onValueChange={setAdminId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{Array.isArray(assignees.data) && assignees.data.map(user => <SelectItem key={user.id} value={user.id}>{user.fullName || user.username} (@{user.username})</SelectItem>)}</SelectContent></Select><DialogFooter><Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button><Button onClick={() => assign.mutate()} disabled={assign.isPending}>Confirm assignment</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

export function ReleaseHoldButton({ detail, hold }: { detail: CaseDetail; hold: Record<string, any> }) {
  const config: ActionConfig = { action: "release_hold", label: "Release Legal Hold", description: "Release this legal hold. A reason is legally required and will be audited.", endpoint: () => `/holds/${hold.id}/release`, fields: [{ key: "reason", label: "Release reason", required: true, kind: "textarea" }] };
  const [open, setOpen] = useState(false);
  if (!detail.availableActions.includes("release_hold") || hold.releasedAt) return null;
  return <><Button size="sm" variant="outline" onClick={() => setOpen(true)}>Release hold</Button>{open && <ActionDialog config={config} detail={detail} open onOpenChange={setOpen} />}</>;
}