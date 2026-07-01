import "server-only";
import OpenAI from "openai";

/**
 * SZMSZ (szervezeti és működési szabályzat) PDF extraction via OpenAI.
 *
 * GDPR note: an SZMSZ may contain owner names (personal data). The standard
 * OpenAI API can retain inputs for a limited window for abuse monitoring;
 * production use needs a zero-data-retention arrangement + owner consent.
 * The output here is always human-reviewed before it is committed — nothing
 * is written to the building automatically.
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

export interface SzmszExtraction {
  units: ExtractedUnit[];
  governance: ExtractedGovernance;
}

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    units: {
      type: "array",
      description: "One entry per albetét (unit) listed in the SZMSZ.",
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
    },
    governance: {
      type: "object",
      additionalProperties: false,
      properties: {
        reserveTargetHUF: {
          type: ["integer", "null"],
          description:
            "Reserve/renovation-fund target in HUF if stated, else null.",
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
    },
  },
  required: ["units", "governance"],
} as const;

const PROMPT = `You are extracting structured data from a Hungarian condominium SZMSZ (szervezeti és működési szabályzat) and/or alapító okirat PDF.

Extract:
1. The full list of units (albetétek) from the ownership/unit table (albetét-jegyzék). For each: the unit identifier (albetét szám / lakás azonosító), floor (emelet/szint — földszint = 0), floor area in m² (alapterület), and the ownership share (tulajdoni hányad).
   - Ownership share MUST be returned as a decimal fraction of the whole building in the range 0..1. Convert "245/10000" → 0.0245, "2,45%" → 0.0245, "0,0245" → 0.0245.
2. Governance settings if explicitly stated: reserve/renovation-fund target (felújítási alap / tartalékalap cél) in HUF; the default decision majority rule; the cost-allocation basis (költségmegosztás alapja). Use null for anything not clearly stated — do not guess.

Only use data actually present in the document. If the unit table spans multiple pages, include every row. Return the result strictly in the required schema.`;

/**
 * Extract units + governance from an SZMSZ PDF (base64, no data-URL prefix).
 * Throws if OPENAI_API_KEY is missing or the API/parse fails.
 */
export async function extractSzmszFromPdf(
  pdfBase64: string,
  fileName = "szmsz.pdf",
): Promise<SzmszExtraction> {
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
          { type: "input_text", text: PROMPT },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "szmsz_extraction",
        strict: true,
        schema: EXTRACTION_SCHEMA as unknown as Record<string, unknown>,
      },
    },
  });

  const raw = response.output_text;
  if (!raw) {
    throw new Error("Empty extraction response.");
  }
  const parsed = JSON.parse(raw) as SzmszExtraction;
  // Defensive: clamp shares into range and drop obviously-empty rows.
  parsed.units = (parsed.units ?? []).filter(
    (u) => u.number && Number.isFinite(u.ownershipShare),
  );
  return parsed;
}
