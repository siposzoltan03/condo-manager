import { describe, it, expect } from "vitest";
import {
  sectionsFor,
  buildSchema,
  buildPrompt,
  extractLegalDoc,
} from "@/lib/legal-doc-extract";

/**
 * Legal-document extraction is scoped by the document's legal role. The core
 * guarantee: units + ownership shares come only from the alapító okirat (the
 * register), never from the SZMSZ (which may not define shares). The OpenAI
 * call itself is verified manually; here we cover the deterministic
 * section/schema/prompt logic and the no-op kinds.
 */
describe("legal-doc-extract sections", () => {
  it("maps each document kind to the sections it carries", () => {
    expect(sectionsFor("FOUNDING_DEED")).toEqual({ units: true, governance: false, remoteVoting: true });
    expect(sectionsFor("SZMSZ")).toEqual({ units: false, governance: true, remoteVoting: true });
    expect(sectionsFor("COMBINED")).toEqual({ units: true, governance: true, remoteVoting: true });
    expect(sectionsFor("HOUSE_RULES")).toEqual({ units: false, governance: false, remoteVoting: false });
    expect(sectionsFor("OTHER")).toEqual({ units: false, governance: false, remoteVoting: false });
  });
});

describe("buildSchema", () => {
  it("includes units only for founding-deed / combined", () => {
    const deed = buildSchema(sectionsFor("FOUNDING_DEED"));
    expect(deed.properties).toHaveProperty("units");
    expect(deed.properties).not.toHaveProperty("governance");

    const szmsz = buildSchema(sectionsFor("SZMSZ"));
    expect(szmsz.properties).not.toHaveProperty("units");
    expect(szmsz.properties).toHaveProperty("governance");

    const combined = buildSchema(sectionsFor("COMBINED"));
    expect(combined.properties).toHaveProperty("units");
    expect(combined.properties).toHaveProperty("governance");
  });

  it("includes the remote-voting finding for founding-deed / SZMSZ / combined", () => {
    for (const kind of ["FOUNDING_DEED", "SZMSZ", "COMBINED"] as const) {
      const schema = buildSchema(sectionsFor(kind));
      expect(schema.properties).toHaveProperty("remoteVoting");
      expect(schema.required).toContain("remoteVoting");
    }
    expect(buildSchema(sectionsFor("HOUSE_RULES")).properties).not.toHaveProperty("remoteVoting");
  });
});

describe("buildPrompt", () => {
  it("tells the SZMSZ-only extraction NOT to pull ownership shares", () => {
    const prompt = buildPrompt(sectionsFor("SZMSZ"));
    expect(prompt).toMatch(/do not extract unit ownership shares/i);
    expect(prompt.toLowerCase()).toContain("alapító okirat");
  });

  it("asks the founding-deed extraction for the unit table + shares", () => {
    const prompt = buildPrompt(sectionsFor("FOUNDING_DEED"));
    expect(prompt.toLowerCase()).toContain("albetét");
    expect(prompt.toLowerCase()).toContain("tulajdoni hányad");
  });

  it("asks whether the SZMSZ authorises electronic/remote participation", () => {
    const prompt = buildPrompt(sectionsFor("SZMSZ"));
    expect(prompt.toLowerCase()).toContain("elektronikus közgyűlés");
    expect(prompt.toLowerCase()).toContain("távszavazás");
    expect(prompt.toLowerCase()).toContain("do not infer authorisation from silence");
  });
});

describe("extractLegalDoc no-op kinds", () => {
  it("returns empty output for kinds with no extractable data (no API call)", async () => {
    // HOUSE_RULES / OTHER short-circuit before any OpenAI call, so this runs
    // without OPENAI_API_KEY configured.
    await expect(extractLegalDoc("", "x.pdf", "HOUSE_RULES")).resolves.toEqual({
      units: [],
      governance: null,
      remoteVoting: null,
    });
    await expect(extractLegalDoc("", "x.pdf", "OTHER")).resolves.toEqual({
      units: [],
      governance: null,
      remoteVoting: null,
    });
  });
});
