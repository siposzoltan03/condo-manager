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
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Dynamic imports to avoid bundling Node.js APIs in Edge Runtime
        const { prisma } = await import("./prisma");
        const bcrypt = await import("bcryptjs");
        const rateLimitMod = await import("./rate-limit");

        // Rate limit: 5 attempts per 15 minutes per email
        const rl = await rateLimitMod.rateLimit({
          key: `auth:login:${email.toLowerCase()}`,
          limit: 5,
          windowSeconds: 15 * 60,
        });
        if (!rl.success) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          return null;
        }

        if (!user.isActive) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          password,
          user.passwordHash
        );

        if (!isPasswordValid) {
          return null;
        }

        // Fetch building memberships for this user
        const userBuildings = await prisma.userBuilding.findMany({
          where: { userId: user.id, isActive: true },
          include: { building: { select: { id: true, name: true } } },
        });

        if (userBuildings.length === 0) {
          return null; // User has no building access
        }

        const buildings = userBuildings.map((ub) => ({
          id: ub.building.id,
          name: ub.building.name,
          role: ub.role,
        }));

        // Pick first building as default active building
        const defaultBuilding = userBuildings[0];

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: defaultBuilding.role, // activeRole for the default building
          activeBuildingId: defaultBuilding.building.id,
          activeRole: defaultBuilding.role,
          buildings,
        };
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.activeBuildingId = user.activeBuildingId;
        token.activeRole = user.activeRole;
        token.buildings = user.buildings;
      }
      // If token is missing custom fields (stale JWT from before a code change),
      // skip the DB lookup to stay Edge-compatible. The user will be
      // redirected to login if their session is truly invalid.
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
