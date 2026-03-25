import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type AuditAction = "CREATE" | "UPDATE" | "DELETE";

interface CreateAuditLogInput {
  entityType: string;
  entityId: string;
  action: AuditAction;
  userId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
}

interface GetAuditLogsParams {
  entityType?: string;
  entityId?: string;
  userId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export async function createAuditLog(input: CreateAuditLogInput) {
  const log = await prisma.auditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      userId: input.userId,
      oldValue: (input.oldValue as Prisma.InputJsonValue) ?? undefined,
      newValue: (input.newValue as Prisma.InputJsonValue) ?? undefined,
      reason: input.reason ?? undefined,
    },
  });

  return log;
}

export async function getAuditLogs(params: GetAuditLogsParams) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Prisma.AuditLogWhereInput = {};

  if (params.entityType) {
    where.entityType = params.entityType;
  }

  if (params.entityId) {
    where.entityId = params.entityId;
  }

  if (params.userId) {
    where.userId = params.userId;
  }

  if (params.from || params.to) {
    where.createdAt = {
      ...(params.from ? { gte: params.from } : {}),
      ...(params.to ? { lte: params.to } : {}),
    };
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}
