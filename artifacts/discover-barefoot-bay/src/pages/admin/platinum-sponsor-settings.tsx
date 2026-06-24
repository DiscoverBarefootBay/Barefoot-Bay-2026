import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Eye, GripVertical, Loader2, RotateCcw, Save, Sparkles } from "lucide-react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import type { Event } from "@shared/schema";

import AdminLayout from "@/components/layouts/admin-layout";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  PLATINUM_SPONSOR_DEFAULT_SETTINGS,
  PLATINUM_SPONSOR_MIN_INTERVAL_SECONDS,
  PlatinumSponsorSettings,
} from "@/hooks/use-platinum-sponsor-settings";
import { useRotatingList } from "@/hooks/use-rotating-list";
import { useUnsavedChangesPrompt } from "@/hooks/use-unsaved-changes-prompt";
import { PlatinumSponsorBanner } from "@/components/home/platinum-sponsors-section";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type PreviewWidth = "mobile" | "tablet" | "desktop";

// Approximate iPhone-width container so the preview reflects what residents
// see on a typical phone (matches Tailwind's sm breakpoint floor).
const PREVIEW_MOBILE_WIDTH_PX = 375;
// Sits comfortably inside the sm-active-but-md-inactive band (Tailwind's
// `md:` breakpoint kicks in at 768px). At this width the banner shows the
// labelled `sm:` pill buttons but the desktop image column is still hidden,
// matching what residents see on common tablet portrait viewports just under
// 768px.
const PREVIEW_TABLET_WIDTH_PX = 720;

interface AdminPlatinumSponsor {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
}

interface AdminSettingsResponse {
  settings: PlatinumSponsorSettings;
  sponsors: AdminPlatinumSponsor[];
}

const ADMIN_QUERY_KEY = ["/api/admin/platinum-sponsor-settings"] as const;

function formatDateRange(startISO: string, endISO: string): string {
  try {
    const start = new Date(startISO);
    const end = new Date(endISO);
    const fmt = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    if (start.toDateString() === end.toDateString()) {
      return fmt.format(start);
    }
    return `${fmt.format(start)} – ${fmt.format(end)}`;
  } catch {
    return "";
  }
}

export default function PlatinumSponsorSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user && user.role !== "admin") {
      setLocation("/");
    }
  }, [user, setLocation]);

  const adminQuery = useQuery<AdminSettingsResponse>({
    queryKey: ADMIN_QUERY_KEY,
    enabled: !!user && user.role === "admin",
  });

  // Pull the same sponsor data the homepage / calendar use so the preview
  // renders the actual banners with their real media, taglines, and links.
  const previewSponsorsQuery = useQuery<Event[]>({
    queryKey: ["/api/events/platinum-sponsors"],
    enabled: !!user && user.role === "admin",
  });

  const [randomizeOnLoad, setRandomizeOnLoad] = useState<boolean>(
    PLATINUM_SPONSOR_DEFAULT_SETTINGS.randomizeOnLoad,
  );
  const [rotationEnabled, setRotationEnabled] = useState<boolean>(
    PLATINUM_SPONSOR_DEFAULT_SETTINGS.rotationEnabled,
  );
  const [rotationSeconds, setRotationSeconds] = useState<string>(
    String(PLATINUM_SPONSOR_DEFAULT_SETTINGS.rotationSeconds),
  );
  const [manualOrderEnabled, setManualOrderEnabled] = useState<boolean>(
    PLATINUM_SPONSOR_DEFAULT_SETTINGS.manualOrderEnabled,
  );
  const [manualOrder, setManualOrder] = useState<number[]>([]);

  // Canonical form values derived from the latest server response. The manual
  // order is merged with the available sponsors so newly-added sponsors appear
  // at the bottom (and removed ones drop off) — matches the runtime behavior.
  // Memoized so it can be reused for hydration, change detection, and discard.
  const hydratedFromServer = useMemo(() => {
    // The shared queryClient injects a `[]` placeholder for any query that
    // hasn't fetched yet, so guard against the wrong shape (truthy but not
    // the expected { settings, sponsors } object) before destructuring.
    const data = adminQuery.data;
    if (
      !data ||
      Array.isArray(data) ||
      typeof data !== "object" ||
      !data.settings ||
      !Array.isArray(data.sponsors)
    ) {
      return null;
    }
    const { settings, sponsors } = data;
    const sponsorIds = new Set(sponsors.map((s) => s.id));
    const ordered = settings.manualOrder.filter((id) => sponsorIds.has(id));
    const seen = new Set(ordered);
    const remaining = sponsors
      .filter((s) => !seen.has(s.id))
      .sort((a, b) => a.id - b.id)
      .map((s) => s.id);
    return {
      randomizeOnLoad: settings.randomizeOnLoad,
      rotationEnabled: settings.rotationEnabled,
      rotationSeconds: String(settings.rotationSeconds),
      manualOrderEnabled: settings.manualOrderEnabled,
      manualOrder: [...ordered, ...remaining],
    };
  }, [adminQuery.data]);

  // Hydrate the form whenever the server snapshot changes (initial load and
  // after a successful save invalidates the query).
  useEffect(() => {
    if (!hydratedFromServer) return;
    setRandomizeOnLoad(hydratedFromServer.randomizeOnLoad);
    setRotationEnabled(hydratedFromServer.rotationEnabled);
    setRotationSeconds(hydratedFromServer.rotationSeconds);
    setManualOrderEnabled(hydratedFromServer.manualOrderEnabled);
    setManualOrder(hydratedFromServer.manualOrder);
  }, [hydratedFromServer]);

  const sponsorsById = useMemo(() => {
    const map = new Map<number, AdminPlatinumSponsor>();
    for (const sponsor of adminQuery.data?.sponsors ?? []) {
      map.set(sponsor.id, sponsor);
    }
    return map;
  }, [adminQuery.data]);

  const moveSponsor = (index: number, direction: -1 | 1) => {
    setManualOrder((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const reorderSponsors = (fromIndex: number, toIndex: number) => {
    setManualOrder((prev) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length
      ) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: PlatinumSponsorSettings) => {
      const response = await apiRequest({
        url: "/api/admin/platinum-sponsor-settings",
        method: "PUT",
        body: payload,
      });
      const data = await response.json();
      return data as PlatinumSponsorSettings;
    },
    onSuccess: () => {
      toast({
        title: "Settings saved",
        description: "Platinum sponsor settings have been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["/api/platinum-sponsor-settings"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving settings",
        description: error.message || "Failed to save platinum sponsor settings.",
        variant: "destructive",
      });
    },
  });

  const parsedSeconds = parseInt(rotationSeconds, 10);
  const secondsValid =
    Number.isInteger(parsedSeconds) && parsedSeconds >= PLATINUM_SPONSOR_MIN_INTERVAL_SECONDS;

  // The preview must reflect form values, not server-saved values, so admins
  // can see how unsaved changes will appear before clicking Save.
  // We clamp to the minimum interval when the input is invalid so the preview
  // never tries to rotate at a 0/NaN interval (the hook also early-returns).
  const previewIntervalMs = useMemo(() => {
    const seconds = secondsValid ? parsedSeconds : PLATINUM_SPONSOR_MIN_INTERVAL_SECONDS;
    return seconds * 1000;
  }, [parsedSeconds, secondsValid]);

  const [previewEl, setPreviewEl] = useState<HTMLDivElement | null>(null);
  const [previewWidth, setPreviewWidth] = useState<PreviewWidth>("desktop");
  const previewSponsors = previewSponsorsQuery.data ?? [];
  const previewRotated = useRotatingList(previewSponsors, {
    randomizeOnLoad,
    rotationEnabled,
    intervalMs: previewIntervalMs,
    manualOrderEnabled,
    manualOrderIds: manualOrder,
    target: previewEl,
  });

  // True when any form value differs from the last server snapshot. Drives
  // both the visibility/enablement of the Discard button and prevents the
  // discard handler from clobbering state when there's nothing to revert.
  const hasUnsavedChanges = useMemo(() => {
    if (!hydratedFromServer) return false;
    if (hydratedFromServer.randomizeOnLoad !== randomizeOnLoad) return true;
    if (hydratedFromServer.rotationEnabled !== rotationEnabled) return true;
    if (hydratedFromServer.rotationSeconds !== rotationSeconds) return true;
    if (hydratedFromServer.manualOrderEnabled !== manualOrderEnabled) return true;
    if (hydratedFromServer.manualOrder.length !== manualOrder.length) return true;
    for (let i = 0; i < manualOrder.length; i++) {
      if (hydratedFromServer.manualOrder[i] !== manualOrder[i]) return true;
    }
    return false;
  }, [
    hydratedFromServer,
    randomizeOnLoad,
    rotationEnabled,
    rotationSeconds,
    manualOrderEnabled,
    manualOrder,
  ]);

  // Warn before navigating away (router transition, back button, browser
  // unload) while the form has edits that haven't been saved or discarded.
  // Stays active during save so a failed save doesn't leave the admin
  // unprotected; on success, hydratedFromServer matches the form values and
  // hasUnsavedChanges flips to false on its own.
  const unsavedChangesDialog = useUnsavedChangesPrompt(hasUnsavedChanges, {
    title: "Unsaved sponsor settings",
    description:
      "You have unsaved changes to the platinum sponsor settings. If you leave now, your edits will be lost.",
    confirmLabel: "Discard & Leave",
    cancelLabel: "Stay on Page",
  });

  const handleDiscard = () => {
    if (!hydratedFromServer) return;
    setRandomizeOnLoad(hydratedFromServer.randomizeOnLoad);
    setRotationEnabled(hydratedFromServer.rotationEnabled);
    setRotationSeconds(hydratedFromServer.rotationSeconds);
    setManualOrderEnabled(hydratedFromServer.manualOrderEnabled);
    setManualOrder(hydratedFromServer.manualOrder);
    toast({
      title: "Changes discarded",
      description: "Reverted to the last saved settings.",
    });
  };

  const handleSave = () => {
    if (!secondsValid) {
      toast({
        title: "Invalid rotation interval",
        description: `Rotation seconds must be a whole number of at least ${PLATINUM_SPONSOR_MIN_INTERVAL_SECONDS}.`,
        variant: "destructive",
      });
      return;
    }

    const validIds = new Set((adminQuery.data?.sponsors ?? []).map((s) => s.id));
    const sanitizedOrder = manualOrder.filter((id) => validIds.has(id));

    saveMutation.mutate({
      randomizeOnLoad,
      rotationEnabled,
      rotationSeconds: parsedSeconds,
      manualOrderEnabled,
      manualOrder: sanitizedOrder,
    });
  };

  const isLoading = adminQuery.isLoading;
  const isError = adminQuery.isError;

  return (
    <AdminLayout>
      {unsavedChangesDialog}
      <div className="container p-6 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            Platinum Sponsor Settings
          </h1>
          <p className="text-muted-foreground">
            Control how platinum sponsor banners are ordered and rotated on the calendar
            page and the home page sponsors section.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading settings...
          </div>
        ) : isError ? (
          <Card className="border-destructive/30">
            <CardContent className="py-8 text-center text-destructive">
              Failed to load platinum sponsor settings. Please refresh and try again.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card data-testid="card-live-preview">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  Live preview
                </CardTitle>
                <CardDescription>
                  Reflects your current (unsaved) settings in real time. Uses the same
                  rotation logic as the homepage and calendar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Preview width
                  </Label>
                  <ToggleGroup
                    type="single"
                    value={previewWidth}
                    // Radix clears the value when the active item is clicked again;
                    // ignore those empty values so the preview always has a width.
                    onValueChange={(value) => {
                      if (
                        value === "mobile" ||
                        value === "tablet" ||
                        value === "desktop"
                      ) {
                        setPreviewWidth(value);
                      }
                    }}
                    variant="outline"
                    size="sm"
                    data-testid="toggle-preview-width"
                    aria-label="Preview width"
                  >
                    <ToggleGroupItem
                      value="mobile"
                      aria-label={`Mobile preview (${PREVIEW_MOBILE_WIDTH_PX}px wide)`}
                      data-testid="toggle-preview-width-mobile"
                    >
                      Mobile ({PREVIEW_MOBILE_WIDTH_PX}px)
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="tablet"
                      aria-label={`Tablet preview (${PREVIEW_TABLET_WIDTH_PX}px wide, below the 768px desktop breakpoint)`}
                      title="Tablet portrait, just below the 768px desktop breakpoint"
                      data-testid="toggle-preview-width-tablet"
                    >
                      Tablet ({PREVIEW_TABLET_WIDTH_PX}px)
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="desktop"
                      aria-label="Desktop preview (full width)"
                      data-testid="toggle-preview-width-desktop"
                    >
                      Desktop
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {previewSponsorsQuery.isLoading ? (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading sponsors...
                  </div>
                ) : previewSponsors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    There are no platinum sponsor events to preview yet.
                  </p>
                ) : (
                  <div
                    className={
                      previewWidth === "desktop"
                        ? "rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 p-3"
                        : "rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 p-3 overflow-x-auto"
                    }
                    data-testid="preview-frame"
                    data-preview-width={previewWidth}
                  >
                    <div
                      ref={setPreviewEl}
                      className={
                        previewWidth === "desktop"
                          ? "flex flex-col gap-3"
                          : "flex flex-col gap-3 mx-auto"
                      }
                      style={
                        previewWidth === "mobile"
                          ? { width: PREVIEW_MOBILE_WIDTH_PX, maxWidth: "100%" }
                          : previewWidth === "tablet"
                            ? { width: PREVIEW_TABLET_WIDTH_PX, maxWidth: "100%" }
                            : undefined
                      }
                      data-testid="preview-platinum-banner"
                    >
                      {previewRotated.map((sponsor) => (
                        <PlatinumSponsorBanner
                          key={sponsor.id}
                          event={sponsor}
                          buttonLayout="horizontal"
                          previewMode={previewWidth}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Randomize order on load</CardTitle>
                <CardDescription>
                  When ON, platinum sponsors are shuffled each time the page loads. When
                  OFF, sponsors appear in a stable order (sorted by event id).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-4">
                  <Label
                    htmlFor="randomize-toggle"
                    className={
                      manualOrderEnabled ? "text-muted-foreground" : ""
                    }
                  >
                    Shuffle on every page load
                  </Label>
                  <Switch
                    id="randomize-toggle"
                    checked={randomizeOnLoad}
                    onCheckedChange={setRandomizeOnLoad}
                    disabled={manualOrderEnabled}
                    data-testid="switch-randomize"
                  />
                </div>
                {manualOrderEnabled ? (
                  <p className="text-xs text-muted-foreground mt-2">
                    Disabled while manual order is on.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rotation timing</CardTitle>
                <CardDescription>
                  When ON, the displayed sponsor cycles every N seconds. Minimum interval
                  is {PLATINUM_SPONSOR_MIN_INTERVAL_SECONDS} seconds.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <Label
                    htmlFor="rotation-toggle"
                    className={manualOrderEnabled ? "text-muted-foreground" : ""}
                  >
                    Rotation enabled
                  </Label>
                  <Switch
                    id="rotation-toggle"
                    checked={rotationEnabled}
                    onCheckedChange={setRotationEnabled}
                    disabled={manualOrderEnabled}
                    data-testid="switch-rotation"
                  />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <Label
                    htmlFor="rotation-seconds"
                    className={
                      !rotationEnabled || manualOrderEnabled
                        ? "text-muted-foreground"
                        : ""
                    }
                  >
                    Seconds between rotations
                  </Label>
                  <Input
                    id="rotation-seconds"
                    type="number"
                    inputMode="numeric"
                    min={PLATINUM_SPONSOR_MIN_INTERVAL_SECONDS}
                    step={1}
                    value={rotationSeconds}
                    onChange={(e) => setRotationSeconds(e.target.value)}
                    disabled={!rotationEnabled || manualOrderEnabled}
                    className="sm:w-32"
                    data-testid="input-rotation-seconds"
                  />
                </div>
                {!secondsValid ? (
                  <p className="text-xs text-destructive">
                    Enter a whole number of at least{" "}
                    {PLATINUM_SPONSOR_MIN_INTERVAL_SECONDS}.
                  </p>
                ) : null}
                {manualOrderEnabled ? (
                  <p className="text-xs text-muted-foreground">
                    Rotation is disabled while manual order is on.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Manual order</CardTitle>
                <CardDescription>
                  When ON, the randomize and rotation settings above are ignored, and
                  platinum sponsors appear in the exact order set below. Sponsors not in
                  the list (e.g. newly added) are appended at the end automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="manual-order-toggle">
                    Use manual order
                  </Label>
                  <Switch
                    id="manual-order-toggle"
                    checked={manualOrderEnabled}
                    onCheckedChange={setManualOrderEnabled}
                    data-testid="switch-manual-order"
                  />
                </div>

                <Separator />

                {manualOrder.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    There are no platinum sponsor events to order yet.
                  </p>
                ) : (
                  <DndProvider backend={HTML5Backend}>
                    <ul
                      className={
                        "space-y-2 " +
                        (manualOrderEnabled ? "" : "opacity-60 pointer-events-none")
                      }
                      aria-disabled={!manualOrderEnabled}
                      data-testid="list-manual-order"
                    >
                      {manualOrder.map((id, index) => {
                        const sponsor = sponsorsById.get(id);
                        if (!sponsor) return null;
                        return (
                          <SponsorRow
                            key={id}
                            id={id}
                            index={index}
                            total={manualOrder.length}
                            title={sponsor.title}
                            dateRange={formatDateRange(sponsor.startDate, sponsor.endDate)}
                            enabled={manualOrderEnabled}
                            onMoveUp={() => moveSponsor(index, -1)}
                            onMoveDown={() => moveSponsor(index, 1)}
                            onReorder={reorderSponsors}
                          />
                        );
                      })}
                    </ul>
                    {manualOrderEnabled ? (
                      <p className="text-xs text-muted-foreground mt-2">
                        Drag sponsors by the handle to reorder, or use the up/down
                        buttons.
                      </p>
                    ) : null}
                  </DndProvider>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleDiscard}
                disabled={!hasUnsavedChanges || saveMutation.isPending}
                data-testid="button-discard-changes"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Discard changes
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saveMutation.isPending || !secondsValid}
                data-testid="button-save-settings"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save settings
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

const SPONSOR_DRAG_TYPE = "platinum-sponsor-row";

interface SponsorRowProps {
  id: number;
  index: number;
  total: number;
  title: string;
  dateRange: string;
  enabled: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

interface SponsorDragItem {
  id: number;
  index: number;
}

function SponsorRow({
  id,
  index,
  total,
  title,
  dateRange,
  enabled,
  onMoveUp,
  onMoveDown,
  onReorder,
}: SponsorRowProps) {
  const ref = useRef<HTMLLIElement>(null);

  const [{ isDragging }, drag, dragPreview] = useDrag({
    type: SPONSOR_DRAG_TYPE,
    item: (): SponsorDragItem => ({ id, index }),
    canDrag: () => enabled,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: SPONSOR_DRAG_TYPE,
    canDrop: () => enabled,
    hover(item: SponsorDragItem) {
      if (!enabled) return;
      if (item.index === index) return;
      onReorder(item.index, index);
      item.index = index;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  dragPreview(drop(ref));

  return (
    <li
      ref={ref}
      className={
        "flex items-center gap-3 p-3 border rounded-md bg-card transition-shadow " +
        (isDragging ? "opacity-40 " : "") +
        (isOver && enabled ? "ring-2 ring-primary " : "")
      }
      data-testid={`row-sponsor-${id}`}
    >
      <button
        ref={(node) => {
          drag(node);
        }}
        type="button"
        className={
          "flex items-center justify-center text-muted-foreground -ml-1 p-1 rounded " +
          (enabled
            ? "cursor-grab active:cursor-grabbing hover:text-foreground"
            : "cursor-not-allowed")
        }
        aria-label={`Drag to reorder ${title}`}
        tabIndex={-1}
        disabled={!enabled}
        data-testid={`drag-handle-${id}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-sm font-medium text-muted-foreground w-6 text-right">
        {index + 1}.
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{title}</div>
        <div className="text-xs text-muted-foreground truncate">{dateRange}</div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onMoveUp}
          disabled={!enabled || index === 0}
          aria-label={`Move ${title} up`}
          data-testid={`button-move-up-${id}`}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onMoveDown}
          disabled={!enabled || index === total - 1}
          aria-label={`Move ${title} down`}
          data-testid={`button-move-down-${id}`}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}
