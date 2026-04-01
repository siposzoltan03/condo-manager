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
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          const email = credentials.email as string;
          const password = credentials.password as string;

          const { prisma } = await import("./prisma");
          const bcryptModule = await import("bcryptjs");
          const bcrypt = bcryptModule.default ?? bcryptModule;
          const rateLimitMod = await import("./rate-limit");

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

          const userBuildings = await prisma.userBuilding.findMany({
            where: { userId: user.id, isActive: true },
            include: { building: { select: { id: true, name: true } } },
          });

          if (userBuildings.length === 0) {
            return null;
          }

          const buildings = userBuildings.map((ub) => ({
            id: ub.building.id,
            name: ub.building.name,
            role: ub.role,
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
        token.role = user.role;
        token.activeBuildingId = user.activeBuildingId;
        token.activeRole = user.activeRole;
        token.buildings = user.buildings;
      }

      // Handle session update (e.g. building switch)
      // Validate that the requested building/role actually belongs to this user
      if (trigger === "update" && updateData) {
        const buildings = token.buildings as { id: string; name: string; role: string }[] | undefined;
        if (updateData.activeBuildingId && buildings) {
          const match = buildings.find((b) => b.id === updateData.activeBuildingId);
          if (match) {
            token.activeBuildingId = match.id;
            token.activeRole = match.role;
            token.role = match.role;
          }
          // If no match found, ignore the update (prevents privilege escalation)
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || (token.sub ?? "");
        session.user.role = token.role as string;
        session.user.activeBuildingId = token.activeBuildingId as string;
        session.user.activeRole = token.activeRole as string;
        session.user.buildings = token.buildings as { id: string; name: string; role: string }[];
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
