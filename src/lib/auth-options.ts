import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

/**
 * Auth options shared between the full auth config and the middleware.
 * This file must NOT import bcryptjs or prisma directly, as it may be
 * loaded in the Edge Runtime (middleware). Heavy imports are deferred
 * to the authorize callback via dynamic import.
 */

/** Dummy hash used for timing-safe comparison when user is not found. */
const DUMMY_HASH = "$2a$12$000000000000000000000uGIvBnzJPiFABWFCIAHBBfZfQBdAQX2u";

export const authOptions = {
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        /**
         * 6-digit TOTP from authenticator app, OR a 10-char backup code
         * (formatted XXXXX-XXXXX). Required only when the account has 2FA
         * enrolled — for unenrolled users the field is ignored.
         */
        totp: { label: "Two-factor code", type: "text" },
        /**
         * "condo" (default) or "contractor". Set to "contractor" by the
         * `/contractor/login` form so the authorize callback queries the
         * `ContractorUser` table instead of `User`. The two trees never
         * overlap; one email belongs to one tree.
         */
        userType: { label: "User type", type: "text" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          const email = credentials.email as string;
          const password = credentials.password as string;
          const userType =
            (credentials.userType as string | undefined) ?? "condo";

          const { prisma } = await import("./prisma");
          const bcryptModule = await import("bcryptjs");
          const bcrypt = bcryptModule.default ?? bcryptModule;
          const rateLimitMod = await import("./rate-limit");

          // ─── Contractor branch ─────────────────────────────────────
          if (userType === "contractor") {
            const rl = await rateLimitMod.rateLimit({
              key: `auth:contractor:login:${email.toLowerCase()}`,
              limit: 5,
              windowSeconds: 15 * 60,
            });
            if (!rl.success) return null;

            const cu = await prisma.contractorUser.findUnique({
              where: { email },
              include: {
                org: {
                  select: { id: true, name: true, status: true, plan: true },
                },
              },
            });
            if (!cu || !cu.isActive) {
              await bcrypt.compare(password, DUMMY_HASH);
              return null;
            }
            const ok = await bcrypt.compare(password, cu.passwordHash);
            if (!ok) return null;
            if (!cu.emailVerifiedAt) return null;
            // SUSPENDED / DELISTED orgs cannot sign in. PENDING_VERIFICATION
            // is allowed so the user can finish onboarding.
            if (
              cu.org.status === "SUSPENDED" ||
              cu.org.status === "DELISTED"
            ) {
              return null;
            }

            return {
              id: cu.id,
              email: cu.email,
              name: cu.name,
              // Shape the returned identity so the JWT callback can route
              // contractor sessions cleanly. Condo fields are left undefined.
              kind: "contractor",
              contractorOrgId: cu.org.id,
              contractorOrgStatus: cu.org.status,
              contractorOrgPlan: cu.org.plan,
              contractorOrgName: cu.org.name,
              contractorRole: cu.role,
              // Condo identity fields, intentionally empty for the contractor branch.
              role: "",
              activeBuildingId: "",
              activeRole: "",
              buildings: [],
            };
          }

          // ─── Condo branch (original flow) ──────────────────────────

          // Rate limit per email
          const rl = await rateLimitMod.rateLimit({
            key: `auth:login:${email.toLowerCase()}`,
            limit: 5,
            windowSeconds: 15 * 60,
          });
          if (!rl.success) {
            return null;
          }

          // Rate limit per IP (broader limit to prevent credential stuffing across emails)
          // Note: headers() not available in Edge, so this is best-effort
          try {
            const { headers } = await import("next/headers");
            const headerStore = await headers();
            const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
            const ipRl = await rateLimitMod.rateLimit({
              key: `auth:login:ip:${ip}`,
              limit: 20,
              windowSeconds: 15 * 60,
            });
            if (!ipRl.success) {
              return null;
            }
          } catch {
            // headers() may not be available in all contexts — skip IP rate limit
          }

          const user = await prisma.user.findUnique({
            where: { email },
          });

          // Timing-safe: always run bcrypt.compare even when user not found
          if (!user || !user.isActive) {
            await bcrypt.compare(password, DUMMY_HASH);
            return null;
          }

          const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
          if (!isPasswordValid) {
            return null;
          }

          // Block sign-in until email is verified. The login UI shows an
          // always-visible "Resend verification" link so the user has a
          // recovery path; we return null here to avoid leaking whether
          // an account exists vs. is unverified.
          if (!user.emailVerifiedAt) {
            return null;
          }

          // 2FA gate: enrolled users must supply a valid TOTP / backup code.
          // We don't throw — the login form pre-checks /api/auth/check-2fa
          // before submitting and switches to the TOTP step there. At this
          // point a missing/invalid code is just bad credentials.
          if (user.totpEnrolledAt && user.totpSecret) {
            const totp = (credentials.totp as string | undefined)?.trim();
            if (!totp) return null;
            const twoFactorMod = await import("./two-factor");
            const ok = await twoFactorMod.verifyTwoFactor(
              user.id,
              user.totpSecret,
              totp,
            );
            if (!ok) return null;
          }

          const userBuildings = await prisma.userBuilding.findMany({
            where: { userId: user.id, isActive: true },
            include: { building: { select: { id: true, name: true } } },
          });

          if (userBuildings.length === 0) {
            return null;
          }

          // Phase 3 — derive `ownsAnyUnit` per building from UnitUser.
          // Tht. § 16, § 38: voting and own-unit-finance gate on ownership
          // (UnitUser.relationship = OWNER), not on the BuildingRole label.
          const ownsByBuilding = new Map<string, boolean>();
          for (const ub of userBuildings) {
            const count = await prisma.unitUser.count({
              where: {
                userId: user.id,
                relationship: "OWNER",
                unit: { buildingId: ub.building.id },
              },
            });
            ownsByBuilding.set(ub.building.id, count > 0);
          }

          // Phase 2 — derive `isAuditor` per building from active
          // AuditorMembership rows (Tht. § 27(3), § 51/A). One active
          // row is enough; we don't distinguish committee vs registered
          // auditor on the session — capabilities key on the flag alone.
          const auditorByBuilding = new Map<string, boolean>();
          const activeAudits = await prisma.auditorMembership.findMany({
            where: { userId: user.id, endedAt: null },
            select: { buildingId: true },
          });
          for (const a of activeAudits) {
            auditorByBuilding.set(a.buildingId, true);
          }

          const buildings = userBuildings.map((ub) => ({
            id: ub.building.id,
            name: ub.building.name,
            role: ub.role,
            // Phase 1 — flags per building, used by the building switcher
            // to set isChair/isProfessional on the active session.
            isChair: ub.isChair,
            isProfessional: ub.isProfessional,
            // Phase 3 — voting/own-finance gate on this.
            ownsAnyUnit: ownsByBuilding.get(ub.building.id) ?? false,
            // Phase 2 — auditor.readAll / view.building.finance gate.
            isAuditor: auditorByBuilding.get(ub.building.id) ?? false,
          }));

          const defaultBuilding = userBuildings[0];

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: defaultBuilding.role,
            activeBuildingId: defaultBuilding.building.id,
            activeRole: defaultBuilding.role,
            buildings,
            isChair: defaultBuilding.isChair,
            isProfessional: defaultBuilding.isProfessional,
            ownsAnyUnit: ownsByBuilding.get(defaultBuilding.building.id) ?? false,
            isAuditor: auditorByBuilding.get(defaultBuilding.building.id) ?? false,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt" as const,
    maxAge: 8 * 60 * 60, // 8 hours
    updateAge: 60 * 60, // 1 hour sliding window
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // Allow all requests through auth() wrapper — we handle redirects in middleware ourselves.
    // Middleware + DAL provide the actual auth checks (defense in depth).
    authorized() {
      return true;
    },
    async jwt({ token, user, trigger, session: updateData }) {
      if (user) {
        token.id = user.id!;
        // Contractor sessions carry their own claims; condo claims stay empty.
        if (user.kind === "contractor") {
          token.kind = "contractor";
          token.contractorOrgId = user.contractorOrgId;
          token.contractorOrgStatus = user.contractorOrgStatus;
          token.contractorOrgPlan = user.contractorOrgPlan;
          token.contractorOrgName = user.contractorOrgName;
          token.contractorRole = user.contractorRole;
        } else {
          token.kind = "condo";
        }
        token.role = user.role;
        token.activeBuildingId = user.activeBuildingId;
        token.activeRole = user.activeRole;
        token.buildings = user.buildings;
        // Phase 1 — chair / professional flags for the active building.
        token.isChair = user.isChair ?? false;
        token.isProfessional = user.isProfessional ?? false;
        // Phase 3 — voting / own-unit-finance gate.
        token.ownsAnyUnit = user.ownsAnyUnit ?? false;
        // Phase 2 — auditor.readAll / view.building.finance gate.
        token.isAuditor = user.isAuditor ?? false;

        // Sign-in moment — record a UserSession row and stash its tokenId in
        // the JWT so subsequent requests can correlate to it (and we can
        // remote-revoke the session).
        try {
          const sessionsMod = await import("./sessions");
          const tokenId = sessionsMod.generateSessionTokenId();
          const { headers } = await import("next/headers");
          const headerStore = await headers();
          const ua = headerStore.get("user-agent");
          const ip = sessionsMod.readForwardedIp(headerStore);
          await sessionsMod.recordSession({
            userId: user.id!,
            tokenId,
            userAgent: ua,
            ip,
          });
          token.tokenId = tokenId;
        } catch (err) {
          console.error("Failed to record session:", err);
        }
      }

      // Validate the session row on every JWT cycle. If revoked, return null
      // → NextAuth treats it as a signed-out request.
      if (token.tokenId && !user) {
        try {
          const sessionsMod = await import("./sessions");
          const stillActive = await sessionsMod.touchSession(
            token.tokenId as string,
          );
          if (!stillActive) {
            return null;
          }
        } catch {
          // On DB error keep the token; failing-closed would log everyone out.
        }
      }

      // Handle session update (e.g. building switch)
      // Validate that the requested building/role actually belongs to this user
      if (trigger === "update" && updateData) {
        const buildings = token.buildings as
          | {
              id: string;
              name: string;
              role: string;
              isChair?: boolean;
              isProfessional?: boolean;
              ownsAnyUnit?: boolean;
              isAuditor?: boolean;
            }[]
          | undefined;
        if (updateData.activeBuildingId && buildings) {
          const match = buildings.find((b) => b.id === updateData.activeBuildingId);
          if (match) {
            token.activeBuildingId = match.id;
            token.activeRole = match.role;
            token.role = match.role;
            // Phase 1 — re-hydrate chair / professional flags for the
            // newly active building. Defaults to false if the membership
            // existed before Phase 1 backfill.
            token.isChair = match.isChair ?? false;
            token.isProfessional = match.isProfessional ?? false;
            // Phase 3 — re-hydrate ownsAnyUnit for the new building.
            token.ownsAnyUnit = match.ownsAnyUnit ?? false;
            // Phase 2 — re-hydrate isAuditor for the new building.
            token.isAuditor = match.isAuditor ?? false;
          }
          // If no match found, ignore the update (prevents privilege escalation)
        }

        // SUPER_ADMIN read-only impersonation: set/clear the context. The
        // /api/impersonation endpoints are the real guard (they validate the
        // target member + compute its flags); here we additionally require the
        // real role to be SUPER_ADMIN before accepting it onto the token.
        if ("impersonating" in updateData) {
          if (updateData.impersonating === null) {
            token.impersonating = undefined;
          } else if (updateData.impersonating && token.role === "SUPER_ADMIN") {
            token.impersonating = updateData.impersonating;
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || (token.sub ?? "");
        session.user.kind = (token.kind as "condo" | "contractor") ?? "condo";
        session.user.role = token.role as string;
        session.user.activeBuildingId = token.activeBuildingId as string;
        session.user.activeRole = token.activeRole as string;
        session.user.buildings = token.buildings as {
          id: string;
          name: string;
          role: string;
          isChair?: boolean;
          isProfessional?: boolean;
          ownsAnyUnit?: boolean;
          isAuditor?: boolean;
        }[];
        // Phase 1 — surface chair/professional to client + RSCs via session.
        session.user.isChair = (token.isChair as boolean | undefined) ?? false;
        session.user.isProfessional = (token.isProfessional as boolean | undefined) ?? false;
        // Phase 3 — surface ownsAnyUnit.
        session.user.ownsAnyUnit = (token.ownsAnyUnit as boolean | undefined) ?? false;
        // Phase 2 — surface isAuditor.
        session.user.isAuditor = (token.isAuditor as boolean | undefined) ?? false;
        session.user.tokenId = token.tokenId as string | undefined;
        session.user.contractorOrgId = token.contractorOrgId as string | undefined;
        session.user.contractorOrgStatus = token.contractorOrgStatus as string | undefined;
        session.user.contractorOrgPlan = token.contractorOrgPlan as string | undefined;
        session.user.contractorOrgName = token.contractorOrgName as string | undefined;
        session.user.contractorRole = token.contractorRole as string | undefined;
        session.user.impersonating =
          token.impersonating as typeof session.user.impersonating;
      }
      return session;
    },
  },
  events: {
    async signOut(message) {
      // NextAuth v5 passes either { token } or { session } depending on strategy.
      const tokenId =
        "token" in message
          ? (message.token as { tokenId?: string } | null)?.tokenId
          : undefined;
      if (!tokenId) return;
      try {
        const sessionsMod = await import("./sessions");
        await sessionsMod.revokeByTokenId(tokenId);
      } catch (err) {
        console.error("Failed to revoke session on signOut:", err);
      }
    },
  },
} satisfies NextAuthConfig;
