"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface ResponsiveSidebarProps {
  /** Drawer open state — only meaningful below the `persistentAt`
   *  breakpoint. At/above that breakpoint, the sidebar is always visible. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** Breakpoint at which the sidebar stops being a drawer and becomes a
   *  persistent column. Defaults to `lg` (per plan §0.5: tablet still
   *  uses the drawer). Use "never" for drawer-only sidebars (filters,
   *  channel lists, voting sidebar). */
  persistentAt?: "md" | "lg" | "never";
  /** Side the drawer slides from. Defaults to "left". Secondary sidebars
   *  like filters often slide from "right". */
  side?: "left" | "right";
  /** Drawer / persistent column width in rem. Defaults to 15.25 (244 px). */
  widthRem?: number;
  /** Accessible label for the drawer + close button. */
  label?: string;
  /** When provided, renders a close button in the drawer header. Defaults
   *  to true. Set false for sidebars whose close affordance lives in the
   *  content (e.g., a "Done" button at the bottom of a filter panel). */
  showCloseButton?: boolean;
}

const HIDE_BELOW = {
  md: "hidden md:flex",
  lg: "hidden lg:flex",
  never: "hidden",
};

const DRAWER_HIDE_AT = {
  md: "md:hidden",
  lg: "lg:hidden",
  never: "",
};

export function ResponsiveSidebar({
  open,
  onOpenChange,
  children,
  persistentAt = "lg",
  side = "left",
  widthRem = 15.25,
  label = "Sidebar",
  showCloseButton = true,
}: ResponsiveSidebarProps) {
  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onOpenChange]);

  const widthStyle = { width: `${widthRem}rem` };
  const sideClass = side === "left" ? "left-0" : "right-0";
  const closedTransform =
    side === "left" ? "-translate-x-full" : "translate-x-full";

  return (
    <>
      {/* Mobile drawer (always rendered; CSS hides above breakpoint). */}
      <div className={cn("contents", DRAWER_HIDE_AT[persistentAt])}>
        {/* Backdrop */}
        <div
          aria-hidden
          onClick={() => onOpenChange(false)}
          className={cn(
            "fixed inset-0 z-40 bg-ink/50 transition-opacity duration-200",
            open ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        />
        {/* Sliding panel */}
        <aside
          aria-label={label}
          aria-hidden={!open}
          style={widthStyle}
          className={cn(
            "fixed inset-y-0 z-50 flex flex-col border-ink/10 bg-bg-2 shadow-xl transition-transform duration-300",
            sideClass,
            side === "left" ? "border-r" : "border-l",
            open ? "translate-x-0" : closedTransform,
          )}
        >
          {showCloseButton && (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close sidebar"
              className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-bg-3"
            >
              <X className="h-5 w-5" />
            </button>
          )}
          <div className="flex h-full flex-col overflow-y-auto p-5">
            {children}
          </div>
        </aside>
      </div>

      {/* Persistent desktop column. Skipped entirely when persistentAt="never". */}
      <aside
        aria-label={label}
        style={widthStyle}
        className={cn(
          "fixed inset-y-0 z-30 flex-col overflow-y-auto border-ink/10 bg-bg-2 p-5",
          sideClass,
          side === "left" ? "border-r" : "border-l",
          HIDE_BELOW[persistentAt],
        )}
      >
        {children}
      </aside>
    </>
  );
}
