/**
 * Utilitários para o fluxo OAuth do Meta (Facebook / Instagram).
 *
 * Escopos necessários no App Meta:
 *   - pages_show_list       → listar páginas do usuário
 *   - pages_read_engagement → ler dados das páginas
 *   - leads_retrieval       → buscar dados dos leads
 */

import crypto from "crypto";

const META_API_VERSION = "v21.0";

// ── State HMAC-signed (protege o callback contra CSRF) ────────────────────────

export function createOAuthState(tenantId: string, userId: string): string {
  const payload = JSON.stringify({ tenantId, userId, ts: Date.now() });
  const sig     = hmac(payload);
  return Buffer.from(JSON.stringify({ payload, sig })).toString("base64url");
}

export function verifyOAuthState(
  state: string,
): { tenantId: string; userId: string } | null {
  try {
    const { payload, sig } = JSON.parse(
      Buffer.from(state, "base64url").toString(),
    ) as { payload: string; sig: string };

    const expected = hmac(payload);
    if (
      !crypto.timingSafeEqual(
        Buffer.from(sig,      "hex"),
        Buffer.from(expected, "hex"),
      )
    )
      return null;

    const data = JSON.parse(payload) as {
      tenantId: string;
      userId:   string;
      ts:       number;
    };

    if (Date.now() - data.ts > 10 * 60 * 1000) return null; // 10 min TTL
    return { tenantId: data.tenantId, userId: data.userId };
  } catch {
    return null;
  }
}

function hmac(data: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET não definido");
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

// ── URLs OAuth ─────────────────────────────────────────────────────────────────

export function getCallbackUrl(): string {
  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/integrations/meta/callback`;
}

export function buildAuthUrl(state: string): string {
  const appId   = process.env.META_APP_ID;
  if (!appId) throw new Error("META_APP_ID não definido");

  const params = new URLSearchParams({
    client_id:     appId,
    redirect_uri:  getCallbackUrl(),
    scope:         "pages_show_list,pages_read_engagement,leads_retrieval",
    response_type: "code",
    state,
  });

  return `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?${params}`;
}

// ── Token exchange ─────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  token_type:   string;
  expires_in?:  number;
}

/** Troca o `code` do callback por um User Access Token de curta duração */
export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const params = new URLSearchParams({
    client_id:     process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri:  getCallbackUrl(),
    code,
  });

  const res  = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token?${params}`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Token exchange falhou: ${JSON.stringify(err)}`);
  }
  return res.json();
}

/** Troca um User Access Token por um token de longa duração (60 dias) */
export async function exchangeForLongLivedToken(shortToken: string): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type:        "fb_exchange_token",
    client_id:         process.env.META_APP_ID!,
    client_secret:     process.env.META_APP_SECRET!,
    fb_exchange_token: shortToken,
  });

  const res = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token?${params}`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Long-lived token exchange falhou: ${JSON.stringify(err)}`);
  }
  return res.json();
}

// ── Páginas do usuário ─────────────────────────────────────────────────────────

export interface FacebookPage {
  id:           string;
  name:         string;
  access_token: string; // Page Access Token (já long-lived quando derivado de token long-lived)
  category?:    string;
}

/** Lista as páginas do usuário autenticado (com Page Access Tokens) */
export async function getUserPages(userAccessToken: string): Promise<FacebookPage[]> {
  const res = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/me/accounts?fields=id,name,access_token,category&access_token=${userAccessToken}`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Listar páginas falhou: ${JSON.stringify(err)}`);
  }
  const data = await res.json() as { data: FacebookPage[] };
  return data.data ?? [];
}

// ── Webhook subscription por página ───────────────────────────────────────────

/**
 * Subscreve a página ao evento `leadgen` do webhook do app.
 *
 * Sem essa chamada, o Meta nunca envia os eventos de lead para o nosso endpoint
 * mesmo que o webhook esteja configurado e verificado no App Dashboard.
 *
 * Docs: https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps/
 */
export async function subscribePageToLeadgen(
  pageId:          string,
  pageAccessToken: string,
): Promise<boolean> {
  try {
    const params = new URLSearchParams({
      subscribed_fields: "leadgen",
      access_token:      pageAccessToken,
    });

    const res = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${pageId}/subscribed_apps`,
      { method: "POST", body: params },
    );

    const data = await res.json() as { success?: boolean; error?: unknown };
    if (!res.ok || !data.success) {
      console.warn(`[meta] subscribePageToLeadgen falhou para pageId=${pageId}`, data.error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[meta] subscribePageToLeadgen exception para pageId=${pageId}`, err);
    return false;
  }
}

/**
 * Remove a subscrição do app na página (chamado ao desconectar).
 */
export async function unsubscribePageFromApp(
  pageId:          string,
  pageAccessToken: string,
): Promise<void> {
  try {
    const params = new URLSearchParams({ access_token: pageAccessToken });
    await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${pageId}/subscribed_apps`,
      { method: "DELETE", body: params },
    );
  } catch (err) {
    console.warn(`[meta] unsubscribePageFromApp exception para pageId=${pageId}`, err);
  }
}
