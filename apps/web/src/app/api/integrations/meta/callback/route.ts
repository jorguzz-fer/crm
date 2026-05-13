/**
 * GET /api/integrations/meta/callback
 *
 * Callback do OAuth do Meta.
 * Troca o código por tokens, lista as páginas e conecta todas automaticamente.
 * O usuário pode desconectar páginas indesejadas depois na tela de integrações.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole, ROLES_ADMIN } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import {
  verifyOAuthState,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getUserPages,
  subscribePageToLeadgen,
} from "@/lib/metaOAuth";

export async function GET(req: Request) {
  const { session, error } = await requireRole(ROLES_ADMIN);
  if (error) {
    // Redireciona para login se sessão expirou durante o OAuth
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const url   = new URL(req.url);
  const code  = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  // Usuário cancelou ou negou permissão
  if (oauthError || !code || !state) {
    const reason = url.searchParams.get("error_description") ?? "Autorização cancelada";
    return NextResponse.redirect(
      new URL(`/configuracoes/integracoes?error=${encodeURIComponent(reason)}`, req.url),
    );
  }

  // Valida o state (CSRF + expiração de 10 min)
  const stateData = verifyOAuthState(state);
  if (!stateData || stateData.tenantId !== session.user.tenantId) {
    return NextResponse.redirect(
      new URL("/configuracoes/integracoes?error=State+inv%C3%A1lido", req.url),
    );
  }

  try {
    // 1) Troca o code por um short-lived User Access Token
    const shortToken = await exchangeCodeForToken(code);

    // 2) Troca por um long-lived token (60 dias)
    const longToken = await exchangeForLongLivedToken(shortToken.access_token);

    // 3) Lista as páginas do usuário (já com Page Access Tokens long-lived)
    const pages = await getUserPages(longToken.access_token);

    if (pages.length === 0) {
      return NextResponse.redirect(
        new URL("/configuracoes/integracoes?error=Nenhuma+p%C3%A1gina+encontrada", req.url),
      );
    }

    // 4) Conecta todas as páginas (upsert — se já existir, atualiza o token)
    let connected = 0;
    for (const page of pages) {
      // Verifica se a página já pertence a OUTRO tenant
      const existing = await prisma.metaLeadForm.findUnique({
        where:  { pageId: page.id },
        select: { tenantId: true },
      });

      if (existing && existing.tenantId !== stateData.tenantId) {
        // Página já conectada por outro tenant — pula
        continue;
      }

      await prisma.metaLeadForm.upsert({
        where:  { pageId: page.id },
        create: {
          tenantId:    stateData.tenantId,
          pageId:      page.id,
          pageName:    page.name,
          accessToken: page.access_token,
          active:      true,
        },
        update: {
          pageName:    page.name,
          accessToken: page.access_token, // renova o token
          active:      true,
        },
      });

      // Subscreve a página ao evento leadgen (necessário para receber webhooks)
      await subscribePageToLeadgen(page.id, page.access_token);

      connected++;
    }

    await logAudit({
      tenantId: stateData.tenantId,
      userId:   stateData.userId,
      action:   "integration.meta.connect",
      entity:   "MetaLeadForm",
      meta:     { pages: pages.map(p => p.name), connected },
    });

    return NextResponse.redirect(
      new URL(`/configuracoes/integracoes?success=${connected}`, req.url),
    );
  } catch (err) {
    console.error("[meta/callback]", err);
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.redirect(
      new URL(`/configuracoes/integracoes?error=${encodeURIComponent(msg)}`, req.url),
    );
  }
}
