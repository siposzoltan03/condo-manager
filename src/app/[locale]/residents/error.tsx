"use client";

import { ErrorRecovery } from "@/components/shared/error-recovery";

export default function ResidentsError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorRecovery {...props} />;
}
