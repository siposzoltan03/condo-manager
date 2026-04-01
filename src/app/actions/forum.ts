"use server";

import { revalidatePath } from "next/cache";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature } from "@/lib/feature-gate";
import { requireNotFrozen } from "@/lib/frozen-check";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

interface ActionResult {
  success?: boolean;
  error?: string;
}

interface CreateTopicInput {
  title: string;
  body: string;
  categoryId: string;
}

export async function createTopic(input: CreateTopicInput): Promise<ActionResult> {
  try {
    const { userId, buildingId } = await requireBuildingContext();
    await requireFeature(buildingId, "forum");
    await requireNotFrozen(buildingId);

    const { title, body, categoryId } = input;

    if (!title || !body || !categoryId) {
      return { error: "Missing required fields: title, body, categoryId" };
    }

    // Verify category belongs to building
    const category = await prisma.forumCategory.findUnique({
      where: { id: categoryId },
      select: { buildingId: true },
    });
    if (!category || category.buildingId !== buildingId) {
      return { error: "Category not found" };
    }

    const topic = await prisma.forumTopic.create({
      data: {
        title,
        body,
        category: { connect: { id: categoryId } },
        author: { connect: { id: userId } },
        lastActivityAt: new Date(),
      },
    });

    await createAuditLog({
      entityType: "ForumTopic",
      entityId: topic.id,
      action: "CREATE",
      userId,
      newValue: { title, categoryId },
    });

    revalidatePath("/forum");
    return { success: true };
  } catch (error) {
    console.error("Failed to create topic:", error);
    return { error: error instanceof Error ? error.message : "Internal server error" };
  }
}
