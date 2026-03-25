"use client";

import { useAuth } from "@/hooks/use-auth";

interface RoleGuardProps {
  role: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGuard({ role, children, fallback = null }: RoleGuardProps) {
  const { hasRole, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!hasRole(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
