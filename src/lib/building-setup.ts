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
 * Default document categories created for every new building. The alapító
 * okirat (founding deed — Tht. § 5) comes first as the building's register of
 * ownership, then the SZMSZ (szervezeti és működési szabályzat — Tht. § 13) as
 * its operational rulebook. These are kept separate because they play distinct
 * legal roles (see LegalDocKind); the onboarding steps target them by name.
 */
export const DEFAULT_DOCUMENT_CATEGORIES: Pick<
  Prisma.DocumentCategoryCreateManyInput,
  "name" | "icon" | "sortOrder"
>[] = [
  { name: "Alapító okirat", icon: "📕", sortOrder: 0 },
  { name: "SZMSZ", icon: "📘", sortOrder: 1 },
  { name: "Szabályzatok", icon: "📜", sortOrder: 2 },
  { name: "Közgyűlési jegyzőkönyvek", icon: "📋", sortOrder: 3 },
  { name: "Pénzügyi anyagok", icon: "💰", sortOrder: 4 },
  { name: "Szerződések", icon: "📝", sortOrder: 5 },
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
