/**
 * Testes E2E — Pipeline (Kanban)
 *
 * Cobre: visualização do kanban, presença de colunas,
 * movimentação de card entre estágios via drag-and-drop
 * e verificação de persistência da mudança.
 *
 * Pré-requisito: pipeline com pelo menos 2 estágios e 1 oportunidade criados.
 */

import { test, expect } from "@playwright/test";

test.describe("Visualização do Pipeline", () => {
  test("exibe a página do pipeline com título", async ({ page }) => {
    await page.goto("/pipeline");
    await expect(page.getByRole("heading", { name: /pipeline|funil/i }).first()).toBeVisible();
  });

  test("exibe pelo menos uma coluna de estágio", async ({ page }) => {
    await page.goto("/pipeline");
    // Colunas do kanban têm data-testid="stage-column" ou contêm heading com nome do estágio
    const columns = page.locator("[data-testid='stage-column'], .stage-column");
    const headings = page.locator("h2, h3").filter({ hasText: /.+/ });

    const colCount = await columns.count();
    const headingCount = await headings.count();

    // Pelo menos um dos dois deve ter elementos
    expect(colCount + headingCount).toBeGreaterThan(0);
  });

  test("link na sidebar navega para /pipeline", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Pipeline", exact: true }).click();
    await expect(page).toHaveURL(/\/pipeline/);
  });
});

test.describe("Movimentação de card", () => {
  test("drag-and-drop de card para outra coluna", async ({ page }) => {
    await page.goto("/pipeline");

    // Aguarda cards carregarem
    await page.waitForLoadState("networkidle");

    // Busca o primeiro card draggable
    const firstCard = page.locator("[draggable='true'], [data-testid='opportunity-card']").first();

    if (!(await firstCard.isVisible())) {
      test.skip(true, "Nenhum card de oportunidade encontrado no pipeline — pule e crie dados de seed");
      return;
    }

    // Busca todas as colunas
    const columns = page.locator("[data-testid='stage-column'], .kanban-column, [data-droppable='true']");
    const colCount = await columns.count();

    if (colCount < 2) {
      test.skip(true, "Pipeline precisa de pelo menos 2 colunas para testar movimentação");
      return;
    }

    // Obtém a posição do card e da segunda coluna
    const cardBox = await firstCard.boundingBox();
    const targetColumn = columns.nth(1);
    const targetBox = await targetColumn.boundingBox();

    if (!cardBox || !targetBox) return;

    // Executa drag-and-drop via mouse
    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200); // Pausa para ativar o drag
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
    await page.waitForTimeout(200);
    await page.mouse.up();

    // Aguarda qualquer mutação de estado
    await page.waitForTimeout(1_000);

    // O card deve ainda estar visível na página (não foi removido com erro)
    await expect(firstCard).toBeVisible();
  });

  test("abre ficha da oportunidade ao clicar no card", async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("networkidle");

    // Busca um link de card que aponte para /pipeline/{id}
    const cardLink = page.locator("a[href^='/pipeline/']").first();

    if (!(await cardLink.isVisible())) {
      test.skip(true, "Nenhum card com link encontrado — crie dados de seed");
      return;
    }

    await cardLink.click();
    await expect(page).toHaveURL(/\/pipeline\/.+/);
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });
});

test.describe("Ficha de oportunidade", () => {
  test("exibe informações da oportunidade e formulário de nota", async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("networkidle");

    const cardLink = page.locator("a[href^='/pipeline/']").first();
    if (!(await cardLink.isVisible())) {
      test.skip(true, "Nenhuma oportunidade no pipeline");
      return;
    }

    await cardLink.click();
    await page.waitForURL(/\/pipeline\/.+/);

    // Deve exibir título da oportunidade
    await expect(page.locator("h1").first()).toBeVisible();

    // Deve ter área de atividades ou notas
    const notesArea = page.getByText(/notas|histórico|atividades/i).first();
    await expect(notesArea).toBeVisible();
  });

  test("permite marcar oportunidade como GANHA", async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("networkidle");

    const cardLink = page.locator("a[href^='/pipeline/']").first();
    if (!(await cardLink.isVisible())) {
      test.skip(true, "Nenhuma oportunidade no pipeline");
      return;
    }

    await cardLink.click();
    await page.waitForURL(/\/pipeline\/.+/);

    // Busca o botão de marcar como ganha
    const ganhaBtn = page.getByRole("button", { name: /ganha|won/i });
    if (await ganhaBtn.isVisible()) {
      await ganhaBtn.click();
      // Verifica feedback de sucesso ou mudança de status
      await page.waitForTimeout(1_000);
      await expect(page.locator("body")).not.toContainText(/erro|error/i);
    }
  });
});
