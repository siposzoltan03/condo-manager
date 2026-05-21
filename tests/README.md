# Tests

Vitest unit/integration tests live here. Playwright e2e specs live in `e2e/`.

## One-time setup

The test suite uses a separate database (`condo_manager_test`) alongside the
dev DB in the same Postgres container.

```bash
# 1. Start Postgres (if not already running)
docker compose up -d db

# 2. Create the test DB
PGPASSWORD=condo_secret psql -h localhost -p 5432 -U condo -d postgres \
  -c "CREATE DATABASE condo_manager_test;"

# 3. Make sure TEST_DATABASE_URL is in your .env (see .env.example)

# 4. Run the suite — vitest applies migrations to the test DB on first run
npm test
```

## How the harness works

- **`vitest.config.ts`** loads `.env` via Vite's `loadEnv`, validates that
  `TEST_DATABASE_URL` is set, distinct from `DATABASE_URL`, and ends in
  `_test`. It swaps `DATABASE_URL → TEST_DATABASE_URL` for the test
  process so the Prisma singleton at `src/lib/prisma.ts` connects to the
  test DB without any code changes.
- **`tests/global-setup.ts`** runs `prisma migrate deploy` once before any
  test file executes.
- **`tests/setup.ts`** registers a `beforeEach` that `TRUNCATE`s every
  public table (except `_prisma_migrations`) with `CASCADE`. Cleanup is
  per-test, not per-suite.
- **Serial execution.** Vitest runs in a single fork (`pool.forks.singleFork:
  true`) because all tests share the test DB. Parallel execution would
  race on the truncate. A follow-up after the refactor can switch to
  transaction-rollback for parallelism.

## Writing tests

Use the fixture factories in `tests/fixtures/`. Org/building-scoped
factories return paired tenants (`{ org, otherOrg }`, `{ building,
otherBuilding }`) — any test that reads or writes org-scoped data
should also assert the *other* tenant sees nothing.

See `docs/plans/2026-05-13-code-organization-refactor.md` §3 Phase 0 for
the test priority order and conventions.

## CI

CI workflow is not yet wired up. When it is, the steps are:

1. Spin up Postgres (`postgres:16-alpine`).
2. `CREATE DATABASE condo_manager_test`.
3. Set `TEST_DATABASE_URL` in the workflow env.
4. `npm test`.
