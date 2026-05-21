import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PageHeaderProps {
  title: string;
  /** Small uppercase mono label above the title. e.g. "Voting" / "Szavazás". */
  eyebrow?: string;
  /** One-line description rendered below the title. */
  description?: string;
  /** Actions row (buttons, dropdowns). Stacks below title on phone, sits
   *  beside it on `sm:`+. */
  actions?: ReactNode;
  /** Tighter spacing variant for nested/sub-page headers. */
  size?: "default" | "compact";
  className?: string;
}

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  size = "default",
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4",
        size === "default" ? "mb-6" : "mb-4",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="font-mono text-[10.5px] uppercase tracking-wider text-muted">
            {eyebrow}
          </p>
        )}
        <h1
          className={cn(
            "font-display leading-tight tracking-tight text-ink",
            size === "default" ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl",
            eyebrow && "mt-1",
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-prose text-sm text-ink-soft">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
          {actions}
        </div>
      )}
    </header>
  );
}
