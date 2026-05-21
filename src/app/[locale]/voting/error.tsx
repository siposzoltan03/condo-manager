"use client";

import { ErrorRecovery } from "@/components/shared/error-recovery";

export default function VotingError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorRecovery {...props} />;
}
