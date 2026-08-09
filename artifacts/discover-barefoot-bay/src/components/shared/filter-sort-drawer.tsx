import * as React from "react";
import { SlidersHorizontal, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

/**
 * Mobile-only "Filters / Sort" trigger + bottom-sheet drawer.
 *
 * Renders a slim trigger button (with an active-filter count badge) that opens
 * a bottom sheet containing whatever filter/sort controls are passed as
 * children. Designed to sit inside a single-row toolbar on phones while the
 * desktop layout keeps its inline controls.
 */
interface FilterSortDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Number of active (non-default) filters — shown as a badge on the trigger */
  activeCount?: number;
  title?: string;
  /** Optional "Reset" handler shown next to Done in the footer */
  onReset?: () => void;
  /** Label for the trigger button (default "Filters") */
  triggerLabel?: string;
  /** Extra classes for the trigger button */
  triggerClassName?: string;
  children: React.ReactNode;
  "data-testid"?: string;
}

export function FilterSortDrawer({
  open,
  onOpenChange,
  activeCount = 0,
  title = "Filters & Sort",
  onReset,
  triggerLabel = "Filters",
  triggerClassName = "",
  children,
  "data-testid": testId = "button-open-filters",
}: FilterSortDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Button
        type="button"
        variant={activeCount > 0 ? "secondary" : "outline"}
        size="sm"
        className={`h-10 shrink-0 gap-1.5 border-navy/20 bg-white ${triggerClassName}`}
        onClick={() => onOpenChange(true)}
        aria-label={`${title}${activeCount > 0 ? ` (${activeCount} active)` : ""}`}
        data-testid={testId}
      >
        <SlidersHorizontal className="h-4 w-4" />
        <span>{triggerLabel}</span>
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-coral text-white text-[10px] font-bold">
            {activeCount}
          </span>
        )}
      </Button>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-2 overflow-y-auto space-y-4">{children}</div>
        <DrawerFooter className="flex-row gap-2 pt-2">
          {onReset && (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onReset}
              data-testid="button-reset-filters"
            >
              Reset
            </Button>
          )}
          <DrawerClose asChild>
            <Button type="button" className="flex-1" data-testid="button-apply-filters">
              Done
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/** Labeled section inside the drawer (e.g. "Sort by", "Category"). */
export function DrawerFilterSection({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-sm font-medium text-navy/70">
        {icon}
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

/**
 * Compact disclaimer affordance: a small info-icon text link that replaces the
 * old full-row disclaimer buttons. Opens the same dialog via onClick (or wrap
 * it in a DialogTrigger).
 */
export const DisclaimerLink = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }
>(({ label, className = "", ...props }, ref) => (
  <button
    type="button"
    ref={ref}
    className={`inline-flex items-center gap-1 text-xs text-navy/50 hover:text-ocean underline-offset-2 hover:underline transition-colors ${className}`}
    aria-label={label}
    {...props}
  >
    <Info className="h-3.5 w-3.5 shrink-0" />
    <span>{label}</span>
  </button>
));
DisclaimerLink.displayName = "DisclaimerLink";
