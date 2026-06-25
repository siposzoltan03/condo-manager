"use client";

import { ErrorRecovery } from "@/components/shared/error-recovery";

export default function ComplaintsError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorRecovery {...props} />;
}
