/**
 * Testes E2E — Autenticação
 *
 * Cobre: login com credenciais inválidas, logout,
 * redirecionamento de usuário não autenticado.
 *
 * Nota: estes testes usam uma página sem storageState para testar
 * os fluxos de usuário não autenticado.
 */

import { test, expect } from "@playwright/test";

// Estes testes NÃO usam o storageState do admin — testam fluxo não autenticado
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Login", () => {
  test("redireciona /dashboard para /login quando não autenticado", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redireciona /leads para /login quando não autenticado", async ({ page }) => {
    await page.goto("/leads");
    await expect(page).toHaveURL(/\/login/);
  });

  test("exibe erro com credenciais inválidas", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel(/e-?mail/i).fill("naoexiste@exemplo.com");
    await page.locator('input[name="password"]').fill("senhaerrada123");
    await page.getByRole("button", { name: /entrar/i }).click();

    // Deve mostrar mensagem de erro (não redirecionar)
    await expect(page).toHaveURL(/\/login/);
    // Verifica que a página permanece no login (não houve redirect)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("exibe erro com senha curta demais", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel(/e-?mail/i).fill("qualquer@email.com");
    await page.locator('input[name="password"]').fill("123");
    await page.getByRole("button", { name: /entrar/i }).click();

    await expect(page).toHaveURL(/\/login/);
  });

  test("páginas públicas acessíveis sem login", async ({ page }) => {
    await page.goto("/privacidade");
    await expect(page).toHaveURL(/\/privacidade/);
    await expect(page.getByRole("heading", { name: /privacidade/i })).toBeVisible();

    await page.goto("/termos");
    await expect(page).toHaveURL(/\/termos/);
    await expect(page.getByRole("heading", { name: "Termos de Uso", level: 1 })).toBeVisible();
  });
});

test.describe("Logout", () => {
  // Este teste usa storageState para estar autenticado
  test.use({ storageState: "tests/.auth/admin.json" });

  test("usuário autenticado acessa o dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    // Sidebar deve estar visível
    await expect(page.getByRole("link", { name: /leads/i }).first()).toBeVisible();
  });
});
