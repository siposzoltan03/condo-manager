import "server-only";
import OpenAI from "openai";
import type { LegalDocKind } from "@prisma/client";

/**
 * Legal-document AI extraction via OpenAI, scoped by the document's legal role
 * (see LegalDocKind). The two documents carry different data:
 *
 *   - FOUNDING_DEED (alapító okirat) → the unit table (albetét-jegyzék): units
 *     and their ownership shares (tulajdoni hányad). This is the register of
 *     ownership and the legal source for voting weight + cost allocation.
 *   - SZMSZ (szervezeti és működési szabályzat) → governance configuration
 *     (reserve target, default majority, cost-allocation basis). The SZMSZ may
 *     NOT define ownership shares, so units are never extracted from it.
 *   - COMBINED → a single PDF that is both (common in older condos): extract
 *     both, in one call.
 *
 * GDPR note: these documents may contain owner names (personal data). The
 * standard OpenAI API can retain inputs for a limited window for abuse
 * monitoring; production use needs a zero-data-retention arrangement + owner
 * consent. The output here is always human-reviewed before it is committed —
 * nothing is written to the building automatically.
 */

const MAJORITY_VALUES = [
  "SIMPLE_MAJORITY",
  "TWO_THIRDS",
  "FOUR_FIFTHS",
  "UNANIMOUS",
] as const;
const COST_BASIS_VALUES = ["OWNERSHIP_SHARE", "EQUAL", "AREA"] as const;

export interface ExtractedUnit {
  number: string;
  floor: number;
  size: number;
  /** Ownership share as a decimal fraction of the whole (0..1). */
  ownershipShare: number;
}

export interface ExtractedGovernance {
  reserveTargetHUF: number | null;
  defaultMajority: (typeof MAJORITY_VALUES)[number] | null;
  costAllocationBasis: (typeof COST_BASIS_VALUES)[number] | null;
}

/** Whether the document authorises electronic/hybrid (remote) participation. */
export interface ExtractedRemoteVoting {
  /** True only if the document clearly authorises electronic/hybrid meetings. */
  authorized: boolean;
  /** The section reference / short quote that authorises it (evidence), or null. */
  section: string | null;
}

export interface LegalDocExtraction {
  /** Units from the alapító okirat. Empty for SZMSZ-only documents. */
  units: ExtractedUnit[];
  /** Governance from the SZMSZ. Null for founding-deed-only documents. */
  governance: ExtractedGovernance | null;
  /** Remote-voting authorisation finding, if the doc could contain one. */
  remoteVoting: ExtractedRemoteVoting | null;
}

export interface Sections {
  units: boolean;
  governance: boolean;
  remoteVoting: boolean;
}

/** Which sections each document kind contributes. */
export function sectionsFor(docKind: LegalDocKind): Sections {
  switch (docKind) {
    case "FOUNDING_DEED":
      // The alapító okirat may itself carry the e-participation authorisation.
      return { units: true, governance: false, remoteVoting: true };
    case "SZMSZ":
      return { units: false, governance: true, remoteVoting: true };
    case "COMBINED":
      return { units: true, governance: true, remoteVoting: true };
    default:
      // HOUSE_RULES / OTHER carry no structured register/governance data.
      return { units: false, governance: false, remoteVoting: false };
  }
}

const UNITS_SCHEMA = {
  type: "array",
  description: "One entry per albetét (unit) listed in the alapító okirat.",
  items: {
    type: "object",
    additionalProperties: false,
    properties: {
      number: {
        type: "string",
        description: "Unit identifier / albetét szám (e.g. '1A', 'A-2.3').",
      },
      floor: {
        type: "integer",
        description: "Floor (emelet/szint). Ground floor = 0, basement negative.",
      },
      size: {
        type: "number",
        description: "Floor area in m² (alapterület).",
      },
      ownershipShare: {
        type: "number",
        description:
          "Tulajdoni hányad as a decimal fraction of the whole building, 0..1. Convert fractions like 245/10000 to 0.0245 and percentages like 2,45% to 0.0245.",
      },
    },
    required: ["number", "floor", "size", "ownershipShare"],
  },
} as const;

const GOVERNANCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reserveTargetHUF: {
      type: ["integer", "null"],
      description: "Reserve/renovation-fund target in HUF if stated, else null.",
    },
    defaultMajority: {
      type: ["string", "null"],
      enum: [...MAJORITY_VALUES, null],
      description: "Default decision majority rule if stated, else null.",
    },
    costAllocationBasis: {
      type: ["string", "null"],
      enum: [...COST_BASIS_VALUES, null],
      description:
        "Basis for splitting common costs if stated, else null (default is ownership share).",
    },
  },
  required: ["reserveTargetHUF", "defaultMajority", "costAllocationBasis"],
} as const;

const REMOTE_VOTING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    authorized: {
      type: "boolean",
      description:
        "True ONLY if the document explicitly authorises electronic/online/hybrid participation or voting in the közgyűlés (távszavazás / elektronikus közgyűlés / online részvétel). If it is silent, false.",
    },
    section: {
      type: ["string", "null"],
      description:
        "The section number / heading and a short verbatim quote of the authorising clause, or null if not authorised.",
    },
  },
  required: ["authorized", "section"],
} as const;

/** Build the JSON schema for exactly the sections this document kind carries. */
export function buildSchema(sections: Sections) {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  if (sections.units) {
    properties.units = UNITS_SCHEMA;
    required.push("units");
  }
  if (sections.governance) {
    properties.governance = GOVERNANCE_SCHEMA;
    required.push("governance");
  }
  if (sections.remoteVoting) {
    properties.remoteVoting = REMOTE_VOTING_SCHEMA;
    required.push("remoteVoting");
  }
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required,
  };
}

/** Build the extraction instructions for exactly the sections requested. */
export function buildPrompt(sections: Sections): string {
  const intro =
    "You are extracting structured data from a Hungarian condominium legal document.";
  const parts: string[] = [];
  if (sections.units) {
    parts.push(
      `Extract the full list of units (albetétek) from the ownership/unit table (albetét-jegyzék) of the alapító okirat. For each unit: the unit identifier (albetét szám / lakás azonosító), floor (emelet/szint — földszint = 0), floor area in m² (alapterület), and the ownership share (tulajdoni hányad).
   - Ownership share MUST be returned as a decimal fraction of the whole building in the range 0..1. Convert "245/10000" → 0.0245, "2,45%" → 0.0245, "0,0245" → 0.0245.
   - If the unit table spans multiple pages, include every row.`,
    );
  }
  if (sections.governance) {
    parts.push(
      `Extract governance settings if explicitly stated in the SZMSZ: reserve/renovation-fund target (felújítási alap / tartalékalap cél) in HUF; the default decision majority rule; the cost-allocation basis (költségmegosztás alapja). Use null for anything not clearly stated — do not guess.${
        sections.units
          ? ""
          : "\n   - Do NOT extract unit ownership shares (tulajdoni hányad) — those are defined by the alapító okirat, not the SZMSZ."
      }`,
    );
  }
  if (sections.remoteVoting) {
    parts.push(
      `Determine whether the document authorises electronic/hybrid (remote) participation or voting in the közgyűlés — e.g. "elektronikus közgyűlés", "online részvétel", "távszavazás", "elektronikus hírközlő eszköz útján". Set authorized=true ONLY if such a clause is clearly present; otherwise false. If true, put the section reference and a short verbatim quote in "section". Do NOT infer authorisation from silence.`,
    );
  }
  return `${intro}\n\nExtract:\n${parts
    .map((p, i) => `${i + 1}. ${p}`)
    .join("\n")}\n\nOnly use data actually present in the document. Return the result strictly in the required schema.`;
}

/**
 * Extract structured data from a legal-document PDF (base64, no data-URL prefix),
 * scoped to the sections the given document kind carries. Throws if
 * OPENAI_API_KEY is missing or the API/parse fails.
 */
export async function extractLegalDoc(
  pdfBase64: string,
  fileName: string,
  docKind: LegalDocKind,
): Promise<LegalDocExtraction> {
  const sections = sectionsFor(docKind);
  if (!sections.units && !sections.governance && !sections.remoteVoting) {
    return { units: [], governance: null, remoteVoting: null };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  const client = new OpenAI({ apiKey });

  const response = await client.responses.create({
    model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_file",
            filename: fileName,
            file_data: `data:application/pdf;base64,${pdfBase64}`,
          },
          { type: "input_text", text: buildPrompt(sections) },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "legal_doc_extraction",
        strict: true,
        schema: buildSchema(sections) as unknown as Record<string, unknown>,
      },
    },
  });

  const raw = response.output_text;
  if (!raw) {
    throw new Error("Empty extraction response.");
  }
  const parsed = JSON.parse(raw) as Partial<LegalDocExtraction>;
  // Defensive: clamp/filter units, normalise the shape to a full LegalDocExtraction.
  const units = sections.units
    ? (parsed.units ?? []).filter((u) => u.number && Number.isFinite(u.ownershipShare))
    : [];
  const governance = sections.governance ? (parsed.governance ?? null) : null;
  const remoteVoting = sections.remoteVoting
    ? parsed.remoteVoting
      ? { authorized: !!parsed.remoteVoting.authorized, section: parsed.remoteVoting.section ?? null }
      : { authorized: false, section: null }
    : null;
  return { units, governance, remoteVoting };
}
