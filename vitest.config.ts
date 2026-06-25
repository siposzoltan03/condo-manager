import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const testDbUrl = env.TEST_DATABASE_URL;
  if (!testDbUrl) {
    throw new Error(
      "TEST_DATABASE_URL is not set. See tests/README.md for setup.",
    );
  }
  if (testDbUrl === env.DATABASE_URL) {
    throw new Error(
      "TEST_DATABASE_URL must not equal DATABASE_URL — tests truncate all tables.",
    );
  }
  if (!/_test(\?|$)/.test(testDbUrl)) {
    throw new Error(
      `TEST_DATABASE_URL DB name must end in _test (got: ${testDbUrl}). ` +
        "Refusing to run — tests truncate all tables.",
    );
  }

  // globalSetup runs in the main vitest process and does not inherit the
  // worker `test.env`. Make TEST_DATABASE_URL visible to it.
  process.env.TEST_DATABASE_URL = testDbUrl;

  return {
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        // `server-only` throws on import outside a server-component context.
        // In tests we know we're calling server code on purpose — stub it
        // to a no-op so route imports resolve.
        "server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
      },
    },
    test: {
      environment: "node",
      exclude: ["node_modules/**", "e2e/**", ".claude/**", ".next/**", "dist/**"],
      env: {
        // Propagate all .env vars to workers (vitest workers don't inherit
        // shell env that wasn't explicitly exported), then override
        // DATABASE_URL to point at the test DB.
        ...env,
        DATABASE_URL: testDbUrl,
        TEST_DATABASE_URL: testDbUrl,
      },
      globalSetup: ["./tests/global-setup.ts"],
      setupFiles: ["./tests/setup.ts"],
      pool: "forks",
      poolOptions: {
        forks: { singleFork: true },
      },
    },
  };
});
