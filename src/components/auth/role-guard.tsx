"use client";

import { useAuth } from "@/hooks/use-auth";
import type { Capability } from "@/lib/authz";

interface RoleGuardProps {
  capability: Capability;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGuard({ capability, children, fallback = null }: RoleGuardProps) {
  const { can, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!can(capability)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
