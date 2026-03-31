import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

/**
 * Auth options shared between the full auth config and the middleware.
 * This file must NOT import bcryptjs or prisma directly, as it may be
 * loaded in the Edge Runtime (middleware). Heavy imports are deferred
 * to the authorize callback via dynamic import.
 */
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

          const rl = await rateLimitMod.rateLimit({
            key: `auth:login:${email.toLowerCase()}`,
            limit: 5,
            windowSeconds: 15 * 60,
          });
          if (!rl.success) {
            console.log("[auth] rate limited:", email);
            return null;
          }

          const user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user || !user.isActive) {
            console.log("[auth] user not found or inactive:", email);
            return null;
          }

          console.log("[auth] bcrypt type:", typeof bcrypt.compare);
          const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
          console.log("[auth] password valid:", isPasswordValid);
          if (!isPasswordValid) {
            return null;
          }

          const userBuildings = await prisma.userBuilding.findMany({
            where: { userId: user.id, isActive: true },
            include: { building: { select: { id: true, name: true } } },
          });
          console.log("[auth] userBuildings count:", userBuildings.length);

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
        } catch (err) {
          console.error("[auth] authorize error:", err);
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
    // Allow all requests through auth() wrapper — we handle redirects in middleware ourselves
    authorized({ auth: session, request }) {
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
      if (trigger === "update" && updateData) {
        if (updateData.activeBuildingId) {
          token.activeBuildingId = updateData.activeBuildingId;
        }
        if (updateData.activeRole) {
          token.activeRole = updateData.activeRole;
          token.role = updateData.activeRole;
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
