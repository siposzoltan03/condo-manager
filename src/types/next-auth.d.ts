import type { DefaultSession, DefaultUser } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface User extends DefaultUser {
    role: string;
    activeBuildingId: string;
    activeRole: string;
    buildings: { id: string; name: string; role: string; isChair?: boolean; isProfessional?: boolean; ownsAnyUnit?: boolean; isAuditor?: boolean }[];
    /** Phase 1 — flags for the active building. */
    isChair?: boolean;
    isProfessional?: boolean;
    /** Phase 3 — true if the user owns at least one unit in the active
     *  building. Gates voting and own-unit-finance per Tht. § 16, § 38. */
    ownsAnyUnit?: boolean;
    /** Phase 2 — true if the user has at least one active
     *  AuditorMembership row for the active building (committee
     *  member, committee chair, or registered external auditor). */
    isAuditor?: boolean;
    /** "condo" (default) or "contractor". */
    kind?: "condo" | "contractor";
    contractorOrgId?: string;
    contractorOrgStatus?: string;
    contractorOrgPlan?: string;
    contractorOrgName?: string;
    contractorRole?: string;
  }

  interface Session {
    user: {
      id: string;
      role: string;
      activeBuildingId: string;
      activeRole: string;
      buildings: { id: string; name: string; role: string; isChair?: boolean; isProfessional?: boolean; ownsAnyUnit?: boolean; isAuditor?: boolean }[];
      /** Opaque token-id correlating this session to a UserSession DB row. */
      tokenId?: string;
      /** Phase 1 — Tht. § 27(2)–(3). True when this user is the sole
       *  közös képviselő or the chair of the intézőbizottság for the
       *  active building. */
      isChair?: boolean;
      /** Phase 1 — Tht. § 52, § 54. True when this user is registered as
       *  the building's professional manager (üzletszerű kezelő). */
      isProfessional?: boolean;
      /** Phase 3 — Tht. § 16, § 38. True if the user owns at least one
       *  unit in the active building. Gates voting and own-unit-finance. */
      ownsAnyUnit?: boolean;
      /** Phase 2 — Tht. § 27(3), § 51/A. True if the user has at least
       *  one active AuditorMembership row for the active building. */
      isAuditor?: boolean;
      kind?: "condo" | "contractor";
      contractorOrgId?: string;
      contractorOrgStatus?: string;
      contractorOrgPlan?: string;
      contractorOrgName?: string;
      contractorRole?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: string;
    activeBuildingId: string;
    activeRole: string;
    buildings: { id: string; name: string; role: string; isChair?: boolean; isProfessional?: boolean; ownsAnyUnit?: boolean; isAuditor?: boolean }[];
    /** Opaque token-id correlating this JWT to a UserSession DB row. */
    tokenId?: string;
    /** Phase 1 — flags hydrated from UserBuilding for the active row. */
    isChair?: boolean;
    isProfessional?: boolean;
    /** Phase 3 — ownsAnyUnit hydrated from UnitUser. */
    ownsAnyUnit?: boolean;
    /** Phase 2 — isAuditor hydrated from AuditorMembership. */
    isAuditor?: boolean;
    kind?: "condo" | "contractor";
    contractorOrgId?: string;
    contractorOrgStatus?: string;
    contractorOrgPlan?: string;
    contractorOrgName?: string;
    contractorRole?: string;
  }
}
