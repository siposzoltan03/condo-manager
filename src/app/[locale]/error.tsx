"use client";

import { ErrorRecovery } from "@/components/shared/error-recovery";

/**
 * Locale-level error boundary. Catches any error thrown by a page
 * within `[locale]/...` that doesn't have its own closer error.tsx.
 * The locale layout still renders around this — the sidebar + topbar
 * stay intact so the user can navigate away.
 */
export default function LocaleError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorRecovery {...props} />;
}
