import { afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

let cachedTables: string[] | null = null;

async function listTables(): Promise<string[]> {
  if (cachedTables) return cachedTables;
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `;
  cachedTables = rows.map((r) => r.tablename);
  return cachedTables;
}

beforeEach(async () => {
  const tables = await listTables();
  if (tables.length === 0) return;
  const quoted = tables.map((t) => `"${t}"`).join(", ");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`,
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
