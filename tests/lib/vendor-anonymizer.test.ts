import { describe, it, expect } from "vitest";
import {
  MaintenanceCategory,
  Urgency,
  TicketStatus,
} from "@prisma/client";
import {
  anonymizeTicketForVendor,
  contractorHasDpa,
} from "@/lib/vendor-anonymizer";

function ticket() {
  return {
    id: "tk_abcdef1234",
    trackingNumber: "T-2026-0042",
    title: "Folyik a csap a fürdőben",
    description: "Erősen csöpög, a szifon is laza.",
    category: MaintenanceCategory.PLUMBING,
    urgency: Urgency.MEDIUM,
    status: TicketStatus.SUBMITTED,
  };
}

const UNIT = { number: "12", floor: 4, stairwell: "A" };

describe("anonymizeTicketForVendor — no resident-name leakage", () => {
  // Note: the helper extracts the FIRST space-separated token. With Western
  // name order ("Given Family") that's the given name; with Hungarian order
  // ("Family Given") it's the family name. The cultural correctness of the
  // exposed token is tracked as a follow-up; the GDPR boundary we test
  // here is "no more than that one token leaks."
  it("never exposes the second name token", () => {
    const view = anonymizeTicketForVendor({
      ticket: ticket(),
      unit: UNIT,
      primaryContact: { id: "uu1", user: { name: "Anna Kovács" } },
      contactPhone: "+36 20 123 4542",
      needsEntry: true,
    });
    const allText = JSON.stringify(view);
    expect(allText).not.toContain("Kovács");
    expect(allText).not.toContain("Anna Kovács");
  });

  it("with needsEntry=false, contact fields are null", () => {
    const view = anonymizeTicketForVendor({
      ticket: ticket(),
      unit: UNIT,
      primaryContact: { id: "uu1", user: { name: "Anna Kovács" } },
      contactPhone: "+36 20 123 4542",
      needsEntry: false,
    });
    expect(view.contactFirstName).toBeNull();
    expect(view.contactPhoneMasked).toBeNull();
  });

  it("with needsEntry=true exposes only first token", () => {
    const view = anonymizeTicketForVendor({
      ticket: ticket(),
      unit: UNIT,
      primaryContact: { id: "uu1", user: { name: "Anna Kovács" } },
      contactPhone: "+36 20 123 4542",
      needsEntry: true,
    });
    expect(view.contactFirstName).toBe("Anna");
    expect(view.contactFirstName).not.toContain("Kovács");
  });

  it("with no primaryContact, contactFirstName is null even when needsEntry=true", () => {
    const view = anonymizeTicketForVendor({
      ticket: ticket(),
      unit: UNIT,
      primaryContact: null,
      contactPhone: "+36 20 123 4542",
      needsEntry: true,
    });
    expect(view.contactFirstName).toBeNull();
  });
});

describe("anonymizeTicketForVendor — unit label format", () => {
  it("composes stairwell · floor · number", () => {
    const view = anonymizeTicketForVendor({
      ticket: ticket(),
      unit: UNIT,
      primaryContact: null,
      contactPhone: null,
      needsEntry: false,
    });
    expect(view.unitLabel).toBe("A · 4. em · 12");
  });

  it("omits stairwell when null", () => {
    const view = anonymizeTicketForVendor({
      ticket: ticket(),
      unit: { number: "3", floor: 2, stairwell: null },
      primaryContact: null,
      contactPhone: null,
      needsEntry: false,
    });
    expect(view.unitLabel).toBe("2. em · 3");
  });

  it("ground floor (floor=0) is still rendered", () => {
    const view = anonymizeTicketForVendor({
      ticket: ticket(),
      unit: { number: "FS-1", floor: 0, stairwell: null },
      primaryContact: null,
      contactPhone: null,
      needsEntry: false,
    });
    expect(view.unitLabel).toBe("0. em · FS-1");
  });
});

describe("anonymizeTicketForVendor — phone masking", () => {
  it("masks to last two digits when long enough", () => {
    const view = anonymizeTicketForVendor({
      ticket: ticket(),
      unit: UNIT,
      primaryContact: { id: "uu1", user: { name: "X" } },
      contactPhone: "+36 20 123 4542",
      needsEntry: true,
    });
    expect(view.contactPhoneMasked).toBe("•• ••• ••42");
  });

  it("masks to all-dots when phone too short", () => {
    const view = anonymizeTicketForVendor({
      ticket: ticket(),
      unit: UNIT,
      primaryContact: { id: "uu1", user: { name: "X" } },
      contactPhone: "12",
      needsEntry: true,
    });
    expect(view.contactPhoneMasked).toBe("•• ••• ••••");
  });

  it("returns null when phone is null", () => {
    const view = anonymizeTicketForVendor({
      ticket: ticket(),
      unit: UNIT,
      primaryContact: { id: "uu1", user: { name: "X" } },
      contactPhone: null,
      needsEntry: true,
    });
    expect(view.contactPhoneMasked).toBeNull();
  });
});

describe("contractorHasDpa — GDPR Art. 28 gate", () => {
  it("returns true when contractor has a DPA document id", async () => {
    const fakePrisma = {
      contractor: {
        findUnique: async () => ({ dataProcessingAgreementDocumentId: "doc_1" }),
      },
    } as unknown as Parameters<typeof contractorHasDpa>[0];
    expect(await contractorHasDpa(fakePrisma, "c_1")).toBe(true);
  });

  it("returns false when DPA id is null", async () => {
    const fakePrisma = {
      contractor: {
        findUnique: async () => ({ dataProcessingAgreementDocumentId: null }),
      },
    } as unknown as Parameters<typeof contractorHasDpa>[0];
    expect(await contractorHasDpa(fakePrisma, "c_1")).toBe(false);
  });

  it("returns false when contractor not found", async () => {
    const fakePrisma = {
      contractor: { findUnique: async () => null },
    } as unknown as Parameters<typeof contractorHasDpa>[0];
    expect(await contractorHasDpa(fakePrisma, "c_missing")).toBe(false);
  });
});
