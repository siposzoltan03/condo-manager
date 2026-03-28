import { BuildingRole } from "@prisma/client";

export const ROLE_HIERARCHY: Record<BuildingRole, number> = {
  SUPER_ADMIN: 5,
  ADMIN: 4,
  BOARD_MEMBER: 3,
  RESIDENT: 2,
  TENANT: 1,
};

export function hasMinimumRole(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole as BuildingRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole as BuildingRole] ?? 99;
  return userLevel >= requiredLevel;
}

export function canManageUsers(role: string): boolean {
  return hasMinimumRole(role, "ADMIN");
}

export function canManageFinances(role: string): boolean {
  return hasMinimumRole(role, "BOARD_MEMBER");
}

export function canManageAnnouncements(role: string): boolean {
  return hasMinimumRole(role, "BOARD_MEMBER");
}

export function canManageDocuments(role: string): boolean {
  return hasMinimumRole(role, "BOARD_MEMBER");
}

export async function requireRole(userRole: string, minimumRole: string): Promise<void> {
  if (!hasMinimumRole(userRole, minimumRole)) {
    throw new Error("Forbidden");
  }
}
