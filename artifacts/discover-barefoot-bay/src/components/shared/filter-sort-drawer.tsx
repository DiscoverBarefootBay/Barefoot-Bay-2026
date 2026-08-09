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
/**
 * Should an "outside interaction" be prevented from dismissing the drawer?
 *
 * True when the interaction belongs to an open Radix Select (or other floating
 * popper). Checking only the event target is unreliable on touch: by the time
 * Vaul's outside-dismiss event fires, the tapped SelectItem may already be
 * detached and the reported target is often the overlay or <body>. So we also
 * treat "any floating popper is currently open in the document" as
 * select-interaction — in that state the tap's job is to pick an option or
 * close the dropdown, never to dismiss the drawer.
 */
function shouldBlockOutsideDismiss(
  target: EventTarget | null,
  drawerContent: HTMLElement | null,
): boolean {
  if ((target as Element)?.closest?.("[data-radix-popper-content-wrapper]")) {
    return true;
  }
  // Ownership-aware fallback: only block when a dropdown opened from INSIDE
  // this drawer is currently expanded (Radix keeps the trigger's
  // aria-expanded="true" for the whole time its popper is open, including at
  // pointer-down time). An unrelated popper elsewhere on the page must not
  // stop a genuine background tap from dismissing the drawer.
  return (
    drawerContent?.querySelector('[aria-expanded="true"][aria-haspopup]') != null
  );
}

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
  const contentRef = React.useRef<HTMLDivElement>(null);
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {/* Keep ONE variant in both states: switching variants dropped the border
          and made the button vanish against white toolbars, and shifted layout.
          Active state only tints colors — same border width, padding, size. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`h-10 shrink-0 gap-1.5 bg-white ${
          activeCount > 0
            ? "border-ocean/60 text-ocean font-semibold hover:bg-ocean/5"
            : "border-navy/20"
        } ${triggerClassName}`}
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
      <DrawerContent
        ref={contentRef}
        className="max-h-[85vh]"
        onPointerDownOutside={(e) => {
          // Radix Select portals its content outside the Drawer DOM tree;
          // without this guard Vaul sees the tap as an "outside click" and
          // closes the drawer before the selection registers.
          if (shouldBlockOutsideDismiss(e.target, contentRef.current)) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (shouldBlockOutsideDismiss(e.target, contentRef.current)) e.preventDefault();
        }}
      >
        <DrawerHeader className="pb-2 shrink-0">
          {/* leading-normal: the site's display font clips ascenders under the
              default leading-none, cutting the top off "Filters & Sort". */}
          <DrawerTitle className="leading-normal">{title}</DrawerTitle>
        </DrawerHeader>
        {/* data-vaul-no-drag: touches on the controls/footer must scroll or tap,
            never start Vaul's swipe-to-dismiss drag — only the handle/header
            area dismisses by swipe. flex-1/min-h-0 lets the controls use all
            the vertical space the sheet has instead of leaving dead space. */}
        <div className="px-4 pb-2 flex-1 min-h-0 overflow-y-auto space-y-4" data-vaul-no-drag>
          {children}
        </div>
        <DrawerFooter className="flex-row gap-2 pt-2" data-vaul-no-drag>
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
