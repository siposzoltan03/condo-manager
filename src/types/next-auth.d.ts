import type { DefaultSession, DefaultUser } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface User extends DefaultUser {
    role: string;
    activeBuildingId: string;
    activeRole: string;
    buildings: { id: string; name: string; role: string }[];
  }

  interface Session {
    user: {
      id: string;
      role: string;
      activeBuildingId: string;
      activeRole: string;
      buildings: { id: string; name: string; role: string }[];
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: string;
    activeBuildingId: string;
    activeRole: string;
    buildings: { id: string; name: string; role: string }[];
  }
}
