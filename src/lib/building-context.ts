import { cookies } from "next/headers";

const COOKIE_NAME = "active-building";

export async function getActiveBuildingFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

export async function setActiveBuildingCookie(buildingId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, buildingId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
