import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    projects: ["packages/*"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.spec.ts"],
    },
    testTimeout: 10000,
    pool: "threads",
    clearMocks: true,
    restoreMocks: true,
  },
});
