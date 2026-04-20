import { defineConfig, devices } from "@playwright/test";
import path from "path";

/**
 * Playwright E2E config para o CRM SaaS.
 *
 * Variáveis de ambiente necessárias (arquivo .env.test ou CI secrets):
 *   E2E_BASE_URL      → URL do app (default: http://localhost:3000)
 *   E2E_ADMIN_EMAIL   → E-mail do admin de teste
 *   E2E_ADMIN_PASSWORD → Senha do admin de teste
 *
 * Para criar o usuário de teste, use o script:
 *   node create-superadmin.js
 */

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

// Arquivo onde o storageState do admin é salvo após o setup
export const STORAGE_STATE = path.join(__dirname, "tests", ".auth", "admin.json");

export default defineConfig({
  testDir: "./tests",
  // Rejeita testes marcados com .only() em CI
  forbidOnly: !!process.env.CI,
  // Retries em CI para evitar flakiness de rede
  retries: process.env.CI ? 2 : 0,
  // Workers sequenciais para evitar race conditions no banco
  workers: 1,
  // Relatório padrão
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Timeout de ação (click, fill, etc.)
    actionTimeout: 15_000,
    // Timeout de navegação
    navigationTimeout: 30_000,
  },
  // Timeout global por teste
  timeout: 60_000,
  projects: [
    // Setup: faz login e salva o storageState
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    // Testes E2E: dependem do setup para ter sessão autenticada
    {
      name: "e2e",
      testMatch: /.*\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: STORAGE_STATE,
      },
    },
  ],
});
