import { describe, it, expect, vi } from "vitest";
import {
  createDefaultDocumentCategories,
  DEFAULT_DOCUMENT_CATEGORIES,
} from "@/lib/building-setup";

/**
 * Every new building is seeded with the default document categories so the
 * onboarding flow has somewhere to drop the SZMSZ and other founding docs.
 */
describe("createDefaultDocumentCategories", () => {
  it("seeds the SZMSZ category first, scoped to the building", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 5 });
    const client = { documentCategory: { createMany } };

    await createDefaultDocumentCategories(client as never, "building-123");

    expect(createMany).toHaveBeenCalledTimes(1);
    const { data } = createMany.mock.calls[0][0];
    expect(data).toHaveLength(DEFAULT_DOCUMENT_CATEGORIES.length);
    // SZMSZ is first (sortOrder 0) so onboarding can target it directly.
    expect(data[0]).toMatchObject({ sortOrder: 0, buildingId: "building-123" });
    expect(data[0].name).toMatch(/SZMSZ/);
    // Every category is scoped to the building.
    expect(data.every((c: { buildingId: string }) => c.buildingId === "building-123")).toBe(true);
    // sortOrder is contiguous from 0.
    expect(data.map((c: { sortOrder: number }) => c.sortOrder)).toEqual([0, 1, 2, 3, 4]);
  });
});
