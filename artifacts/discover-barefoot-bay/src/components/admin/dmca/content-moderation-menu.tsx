import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Copyright, EyeOff, Flag, Loader2, MoreHorizontal, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { DmcaApiError, DmcaPerm, dmcaFetch, useDmcaMe } from "@/lib/dmca-admin";

export type ModeratedContentType =
  | "forum_post"
  | "forum_comment"
  | "listing"
  | "event"
  | "event_comment"
  | "page"
  | "vendor_comment";

interface ContentStatus {
  visibilityStatus: "published" | "moderation_hidden" | "dmca_hidden";
  legalHold: boolean;
  activeCase: { id: number; caseNumber: string; status: string } | null;
  canHide: boolean;
  canDmca: boolean;
  canFlag: boolean;
  canPermanentDelete: boolean;
}

interface CaseOption {
  id: number;
  caseNumber: string;
  claimantName: string | null;
  statusLabel: string;
}

interface CasesResponse {
  cases: CaseOption[];
}

interface ContentModerationMenuProps {
  contentType: ModeratedContentType;
  contentId: number | string;
  deleteFn: () => Promise<unknown>;
  onDeleted?: () => void;
  label?: string;
}

const OPEN_CASE_FILTERS = ["new", "needs_info", "awaiting_review", "takedown_approved"] as const;

function errorStatus(error: unknown): number | undefined {
  if (error instanceof DmcaApiError) return error.status;
  if (typeof error === "object" && error && "status" in error) return Number((error as { status: unknown }).status);
  const match = error instanceof Error ? error.message.match(/^(\d{3}):/) : null;
  return match ? Number(match[1]) : undefined;
}

export function ContentModerationMenu({
  contentType,
  contentId,
  deleteFn,
  onDeleted,
  label,
}: ContentModerationMenuProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const me = useDmcaMe();
  const [menuOpen, setMenuOpen] = useState(false);
  const [action, setAction] = useState<"moderate" | "dmca" | "flag" | "delete" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [caseMode, setCaseMode] = useState<"existing" | "new">("existing");
  const [caseSearch, setCaseSearch] = useState("");
  const [caseId, setCaseId] = useState("");
  const [claimantName, setClaimantName] = useState("");
  const [claimantEmail, setClaimantEmail] = useState("");
  const [submittedVia, setSubmittedVia] = useState("email");
  const [notes, setNotes] = useState("");
  const [createdCase, setCreatedCase] = useState<{ caseId: number; caseNumber: string } | null>(null);

  const statusPath = `/content/${contentType}/${contentId}/status`;
  const statusQuery = useQuery<ContentStatus>({
    queryKey: ["dmca-content-status", contentType, String(contentId)],
    queryFn: () => dmcaFetch<ContentStatus>(statusPath),
    enabled: menuOpen || action !== null,
    placeholderData: undefined,
    retry: false,
  });
  const status = !statusQuery.isPlaceholderData && statusQuery.data && !Array.isArray(statusQuery.data)
    ? statusQuery.data
    : undefined;

  const casesQuery = useQuery<CaseOption[]>({
    queryKey: ["dmca-open-case-options"],
    queryFn: async () => {
      const responses = await Promise.all(
        OPEN_CASE_FILTERS.map((filter) =>
          dmcaFetch<CasesResponse>(`/cases?filter=${filter}&page=1&pageSize=100`),
        ),
      );
      const unique = new Map<number, CaseOption>();
      responses.forEach((response) => {
        if (response && Array.isArray(response.cases)) {
          response.cases.forEach((item) => unique.set(item.id, item));
        }
      });
      return [...unique.values()];
    },
    enabled: action === "dmca" && caseMode === "existing",
    placeholderData: undefined,
    retry: false,
  });

  const caseOptions = useMemo(() => {
    const cases = !casesQuery.isPlaceholderData && Array.isArray(casesQuery.data) ? casesQuery.data : [];
    const q = caseSearch.trim().toLowerCase();
    return q
      ? cases.filter((item) =>
          item.caseNumber.toLowerCase().includes(q) ||
          (item.claimantName ?? "").toLowerCase().includes(q),
        )
      : cases;
  }, [caseSearch, casesQuery.data, casesQuery.isPlaceholderData]);

  const isModerationHidden = status?.visibilityStatus === "moderation_hidden";
  const deleteBlocked = !!status && (status.legalHold || status.visibilityStatus === "dmca_hidden");
  const canOfferDelete = me.can(DmcaPerm.PERMANENT_DELETE) && (!!status?.canPermanentDelete || deleteBlocked);
  const moderatorMustFlag = !!me.data?.isModerator && !me.can(DmcaPerm.TAKEDOWN);
  const canCreateCase = me.can(DmcaPerm.CREATE);
  const canUseExistingCase = me.can(DmcaPerm.REVIEW);
  const canOfferDmca = !!status?.canDmca && !moderatorMustFlag && (canCreateCase || canUseExistingCase);
  const canOfferFlag = !!status?.canFlag && (moderatorMustFlag || !canOfferDmca);

  const resetAndClose = () => {
    setAction(null);
    setReason("");
    setBusy(false);
  };

  const showError = (error: unknown, fallback: string) => {
    const statusCode = errorStatus(error);
    const message = statusCode === 403
      ? "You do not have the required permission for this action."
      : error instanceof Error ? error.message : fallback;
    toast({ title: "Action failed", description: message, variant: "destructive" });
  };

  const submitModeration = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await dmcaFetch(statusPath.replace(/\/status$/, "/moderate"), {
        method: "POST",
        body: { hidden: !isModerationHidden, reason: reason.trim() },
      });
      await queryClient.invalidateQueries({ queryKey: ["dmca-content-status", contentType, String(contentId)] });
      toast({ title: isModerationHidden ? "Content unhidden" : "Content hidden" });
      resetAndClose();
    } catch (error) {
      setBusy(false);
      showError(error, "Could not update content visibility.");
    }
  };

  const submitFlag = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await dmcaFetch(statusPath.replace(/\/status$/, "/flag"), {
        method: "POST",
        body: { reason: reason.trim() },
      });
      toast({ title: "Flagged for DMCA review" });
      resetAndClose();
    } catch (error) {
      setBusy(false);
      showError(error, "Could not flag this content.");
    }
  };

  const submitDmca = async () => {
    if (caseMode === "existing" && !caseId) return;
    if (caseMode === "new" && (!claimantName.trim() || !claimantEmail.trim())) return;
    setBusy(true);
    try {
      const body = caseMode === "existing"
        ? { caseId: Number(caseId) }
        : {
            newCase: {
              claimantName: claimantName.trim(),
              claimantEmail: claimantEmail.trim(),
              submittedVia,
              notes: notes.trim(),
            },
          };
      const result = await dmcaFetch<{ caseId: number; caseNumber: string }>(
        statusPath.replace(/\/status$/, "/dmca"),
        { method: "POST", body },
      );
      setCreatedCase(result);
      await queryClient.invalidateQueries({ queryKey: ["dmca-content-status", contentType, String(contentId)] });
      toast({ title: "Content added to DMCA case", description: result.caseNumber });
    } catch (error) {
      showError(error, "Could not add this content to a DMCA case.");
    } finally {
      setBusy(false);
    }
  };

  const submitDelete = async () => {
    setBusy(true);
    try {
      await deleteFn();
      onDeleted?.();
      resetAndClose();
    } catch (error) {
      setBusy(false);
      // In particular, a 423 message is intentionally displayed verbatim.
      showError(error, "Could not permanently delete this content.");
    }
  };

  const disabledDeleteReason = status?.legalHold
    ? "Permanent deletion is disabled because this content is under legal hold."
    : status?.visibilityStatus === "dmca_hidden"
      ? "Permanent deletion is disabled while this content is hidden by a DMCA takedown."
      : "";

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size={label ? "sm" : "icon"} aria-label={label ?? "Content moderation actions"}>
            <MoreHorizontal className="h-4 w-4" />
            {label && <span className="ml-2">{label}</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          {statusQuery.isFetching && (
            <DropdownMenuItem disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading actions…</DropdownMenuItem>
          )}
          {statusQuery.isError && (
            <DropdownMenuItem disabled>Unable to load content status</DropdownMenuItem>
          )}
          {status?.canHide && (
            <DropdownMenuItem onSelect={() => setAction("moderate")}>
              <EyeOff className="mr-2 h-4 w-4" />{isModerationHidden ? "Unhide" : "Hide / Moderate"}
            </DropdownMenuItem>
          )}
          {canOfferDmca && (
            <DropdownMenuItem onSelect={() => {
              setCreatedCase(null);
              setCaseMode(canUseExistingCase ? "existing" : "new");
              setAction("dmca");
            }}>
              <Copyright className="mr-2 h-4 w-4" />Copyright / DMCA
            </DropdownMenuItem>
          )}
          {canOfferFlag && (
            <DropdownMenuItem onSelect={() => setAction("flag")}>
              <Flag className="mr-2 h-4 w-4" />Flag for DMCA review
            </DropdownMenuItem>
          )}
          {canOfferDelete && <DropdownMenuSeparator />}
          {canOfferDelete && deleteBlocked ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block">
                    <DropdownMenuItem disabled className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />Permanent Delete
                    </DropdownMenuItem>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">{disabledDeleteReason}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : canOfferDelete ? (
            <DropdownMenuItem className="text-destructive" onSelect={() => setAction("delete")}>
              <Trash2 className="mr-2 h-4 w-4" />Permanent Delete
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={action === "moderate" || action === "flag"} onOpenChange={(open) => !open && resetAndClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action === "flag" ? "Flag for DMCA review" : isModerationHidden ? "Unhide content" : "Hide / Moderate content"}</DialogTitle>
            <DialogDescription>
              {action === "flag"
                ? "Explain why this content needs copyright review."
                : "This action is reversible. Record the moderation reason for the audit log."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`moderation-reason-${contentType}-${contentId}`}>Reason</Label>
            <Textarea
              id={`moderation-reason-${contentType}-${contentId}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Required"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAndClose}>Cancel</Button>
            <Button disabled={busy || !reason.trim()} onClick={action === "flag" ? submitFlag : submitModeration}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {action === "flag" ? "Submit flag" : isModerationHidden ? "Unhide" : "Hide content"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={action === "dmca"} onOpenChange={(open) => !open && resetAndClose()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Copyright / DMCA</DialogTitle>
            <DialogDescription>Add this content to an open case or create a new case.</DialogDescription>
          </DialogHeader>
          {createdCase ? (
            <div className="rounded-md border p-4">
              Added to case{" "}
              <Link className="font-medium text-primary underline" href={`/admin/dmca/cases/${createdCase.caseId}`}>
                {createdCase.caseNumber}
              </Link>
            </div>
          ) : (
            <>
              {canCreateCase && canUseExistingCase && (
                <Select value={caseMode} onValueChange={(value: "existing" | "new") => setCaseMode(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="existing">Add to an existing open case</SelectItem>
                    <SelectItem value="new">Create a new case</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {caseMode === "existing" ? (
                <div className="space-y-3">
                  <Input value={caseSearch} onChange={(event) => setCaseSearch(event.target.value)} placeholder="Search case number or claimant" />
                  <Select value={caseId} onValueChange={setCaseId}>
                    <SelectTrigger><SelectValue placeholder={casesQuery.isFetching ? "Loading cases…" : "Select a case"} /></SelectTrigger>
                    <SelectContent>
                      {caseOptions.map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {item.caseNumber} — {item.claimantName || "Unknown claimant"} ({item.statusLabel})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {casesQuery.isError && <p className="text-sm text-destructive">Open cases could not be loaded.</p>}
                </div>
              ) : (
                <div className="grid gap-3">
                  <div className="grid gap-2"><Label>Claimant name</Label><Input value={claimantName} onChange={(e) => setClaimantName(e.target.value)} /></div>
                  <div className="grid gap-2"><Label>Claimant email</Label><Input type="email" value={claimantEmail} onChange={(e) => setClaimantEmail(e.target.value)} /></div>
                  <div className="grid gap-2">
                    <Label>Received via</Label>
                    <Select value={submittedVia} onValueChange={setSubmittedVia}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="mail">Mail</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="fax">Fax</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
                </div>
              )}
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={resetAndClose}>{createdCase ? "Close" : "Cancel"}</Button>
            {!createdCase && (
              <Button
                onClick={submitDmca}
                disabled={busy || (caseMode === "existing" ? !caseId : !claimantName.trim() || !claimantEmail.trim())}
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Continue
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={action === "delete"} onOpenChange={(open) => !open && resetAndClose()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete content?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Use Hide / Moderate when the content may need to be restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => { event.preventDefault(); void submitDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Permanent Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default ContentModerationMenu;