/**
 * Auth Setup — executa UMA VEZ antes de todos os testes E2E.
 *
 * Faz login com o usuário admin de teste e salva o storageState
 * (cookies de sessão) para reutilização em todos os specs.
 *
 * Requer variáveis de ambiente:
 *   E2E_ADMIN_EMAIL     → e-mail do usuário admin
 *   E2E_ADMIN_PASSWORD  → senha do usuário admin
 */

import { test as setup, expect } from "@playwright/test";
import { STORAGE_STATE } from "../playwright.config";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";

setup("autenticar admin de teste", async ({ page }) => {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      "Defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD antes de rodar os testes E2E.\n" +
        "Exemplo: E2E_ADMIN_EMAIL=admin@test.crm E2E_ADMIN_PASSWORD=Admin123456! pnpm test:e2e"
    );
  }

  await page.goto("/login");

  // Preenche o formulário de login
  await page.getByLabel(/e-?mail/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/senha/i).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /entrar/i }).click();

  // Aguarda redirecionamento para o dashboard
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await expect(page).toHaveURL(/\/dashboard/);

  // Salva o estado de autenticação para os demais testes
  await page.context().storageState({ path: STORAGE_STATE });
});
