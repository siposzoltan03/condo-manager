import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Minimal Prisma surface needed to seed default categories — satisfied by both
 * the base client and a transaction client (`tx`).
 */
type DocumentCategoryCreator = {
  documentCategory: {
    createMany: PrismaClient["documentCategory"]["createMany"];
  };
};

/**
 * Default document categories created for every new building. The SZMSZ
 * (szervezeti és működési szabályzat — Tht. § 13) is first so onboarding can
 * drop the bylaws straight into it; the onboarding checklist's "first document"
 * step and the SZMSZ wizard step both target these.
 */
export const DEFAULT_DOCUMENT_CATEGORIES: Pick<
  Prisma.DocumentCategoryCreateManyInput,
  "name" | "icon" | "sortOrder"
>[] = [
  { name: "SZMSZ és alapító okirat", icon: "📕", sortOrder: 0 },
  { name: "Szabályzatok", icon: "📜", sortOrder: 1 },
  { name: "Közgyűlési jegyzőkönyvek", icon: "📋", sortOrder: 2 },
  { name: "Pénzügyi anyagok", icon: "💰", sortOrder: 3 },
  { name: "Szerződések", icon: "📝", sortOrder: 4 },
];

/**
 * Seed the default document categories for a freshly created building. Safe to
 * call inside a transaction (pass the `tx` client). Skips silently if the
 * building already has categories.
 */
export async function createDefaultDocumentCategories(
  client: DocumentCategoryCreator,
  buildingId: string,
): Promise<void> {
  await client.documentCategory.createMany({
    data: DEFAULT_DOCUMENT_CATEGORIES.map((c) => ({ ...c, buildingId })),
  });
}
