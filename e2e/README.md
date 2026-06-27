# End-to-end tests (Playwright)

Browser tests that drive the real app per role. **Local / on-demand** — not in
CI (the exhaustive authorization coverage lives in the CI-gated Vitest suite,
`tests/integration/`). E2E here is a high-fidelity smoke layer on top of that.

## Run it

E2E runs against a real server + the **seeded dev DB**. Seed first, then run:

```bash
# 1. infra + seed (once / when the DB is empty)
docker compose up -d db redis
npm run seed && npm run seed:demo && npm run seed:contractors

# 2. browsers (once)
npx playwright install chromium

# 3. run
npm run test:e2e                       # full suite
npm run test:e2e -- --project=roles    # just the per-role authorization specs
npm run test:e2e -- --project=chromium # the original auth/voting/maintenance specs
```

Playwright boots its own dev server on **:3000** (`webServer` in
`playwright.config.ts`). If `:3000` is busy on your machine, free it or start a
server yourself and set `reuseExistingServer`. The HTML report opens on failure
(`npx playwright show-report`).

> Note: `test:e2e` invokes `node node_modules/@playwright/test/cli.js test`
> directly — the `.bin/playwright` symlink resolves to `playwright-chromium`
> (no `test` command), so a bare `playwright test` fails.

## ⚠️ Read-only against the dev DB

E2E shares the dev database, so specs must stay **read-only / self-reverting** —
navigation, assertions, and non-persisting interactions only. Destructive
authorization checks (mutations, dependency blocks, overrides) belong in the
Vitest integration suite, which runs against an isolated, truncated test DB.

## Per-role auth fixtures

`auth.setup.ts` (the `setup` project) logs in once per seeded role and saves a
`storageState` to `e2e/.auth/{role}.json` (gitignored). Specs pick a fixture
via `test.use({ storageState: authFile(role) })`. Roles (`e2e/auth.ts`):
`superadmin`, `admin`, `board` (chair), `owner`, `tenant` — all `@condo.local`,
password `password123`. `admin`'s session is also written to
`baseline-admin.json` for the responsive-baseline specs.

The `roles` project (`e2e/roles/*.spec.ts`) depends on `setup` and runs desktop
Chrome only.

## Not covered here (deferred)

- **Cross-building negative cases** — covered at the integration level by
  `tests/integration/isolation-condo.test.ts` (building-switch membership).
- **Contractor role** — separate auth tree (`/contractor/login`); add when the
  contractor E2E flows are built out.
- A building-2 owner (`b2resident1@condo.local`) showed an intermittent
  dashboard issue during fixture setup worth a separate look.
