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
          include: { unit: true },
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

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          unitId: user.unitId,
          unitNumber: user.unit.number,
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
        token.unitId = user.unitId;
        token.unitNumber = user.unitNumber;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.unitId = token.unitId as string;
        session.user.unitNumber = token.unitNumber as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
