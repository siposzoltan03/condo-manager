import { describe, it, expect } from "vitest";
import { BuildingRole } from "@prisma/client";
import hu from "@/i18n/hu.json";
import en from "@/i18n/en.json";

/**
 * BuildingSwitcher and the profile tab render `t(\`role_${role}\`)` in the
 * `building` namespace for the user's active role. Every BuildingRole must
 * therefore have a label in every locale, or next-intl throws MISSING_MESSAGE
 * at render (which on a cold SSR render could even block the dashboard).
 *
 * Regression: role_OWNER / role_AUDITOR were missing after the RESIDENT→OWNER
 * rename, so every owner/auditor saw the raw key + console errors.
 */
describe("i18n — building.role_<ROLE> labels", () => {
  const locales: Record<string, Record<string, string>> = {
    hu: hu.building as Record<string, string>,
    en: en.building as Record<string, string>,
  };

  it("exist for every BuildingRole in every locale", () => {
    const missing: string[] = [];
    for (const role of Object.values(BuildingRole)) {
      for (const [locale, msgs] of Object.entries(locales)) {
        const key = `role_${role}`;
        if (!msgs[key]) missing.push(`${locale}: building.${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
