import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Testa apenas lógica pura (lib/) — sem Next.js, sem Prisma
    include: ["src/**/__tests__/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
