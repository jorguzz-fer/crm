/**
 * Regras de rota compartilhadas com o middleware (Edge) — sem Prisma, sem Node.
 *
 * A "porta do cliente" é `/{slug}`: uma URL de entrada por tenant
 * (crm.exemplo.com.br/alumine) que mostra o login já identificado.
 * Como o middleware roda no Edge e não pode consultar o banco para saber se um
 * slug existe, ele libera qualquer segmento único que não colida com uma rota
 * do app — e a própria página devolve 404 quando o tenant não existe.
 */

/**
 * Segmentos de primeiro nível que pertencem ao app e nunca podem ser slug de
 * tenant. Precisa acompanhar as rotas em `app/` — daí o teste que compara
 * esta lista com o disco.
 */
export const RESERVED_SEGMENTS = new Set([
  // (app)
  "agenda",
  "atividades",
  "configuracoes",
  "contatos",
  "dashboard",
  "empresas",
  "ia",
  "leads",
  "painel",
  "pipeline",
  "relatorios",
  "tarefas",
  "visitas",
  "whatsapp",
  // (public)
  "dados",
  "login",
  "privacidade",
  "signup",
  "termos",
  // infra e rotas fora dos grupos
  "api",
  "offline",
  "forgot-password",
  "reset-password",
]);

/** Mesmas regras de slug do cadastro de tenant. */
const TENANT_DOOR = /^\/([a-z0-9-]{2,50})$/;

/**
 * `true` quando o caminho é a porta de um cliente (`/alumine`) e não uma rota
 * conhecida do app. Usado pelo middleware para liberar o acesso sem sessão.
 */
export function isTenantDoorPath(pathname: string): boolean {
  const match = TENANT_DOOR.exec(pathname);
  if (!match) return false;
  return !RESERVED_SEGMENTS.has(match[1]);
}
