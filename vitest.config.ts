import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    fileParallelism: false,
    setupFiles: ["./tests/setup.ts"],
    env: {
      DATABASE_URL: "file:./test.db",
      JWT_SECRET: "test-secret-habilita-mais",
      JWT_EXPIRES_IN: "1h",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: ["generated/**", "tests/**", "**/*.config.*", "prisma.config.ts"],
      thresholds: {
        lines: 70,
        functions: 70,
      },
    },
  },
});
