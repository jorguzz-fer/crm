# Runbook — Rotação trimestral do `AUTH_SECRET`

**Frequência:** trimestral (1× a cada 90 dias) ou imediatamente em caso de incidente.
**Responsável:** SUPERADMIN da plataforma.
**Janela recomendada:** sábado/domingo de manhã (menor tráfego, menor impacto).
**Tempo total estimado:** ~10 minutos.

---

## Por que rotacionar

`AUTH_SECRET` é a chave HMAC que assina todos os JWT de sessão emitidos pelo
Auth.js. Se vazar (build log, screenshot, repo público acidental, ex-funcionário
com acesso ao painel), qualquer pessoa consegue:

- Forjar um JWT válido com `tenantId` e `role: SUPERADMIN` arbitrários.
- Acessar dados de qualquer tenant sem precisar de senha.

Rotacionar invalida **todos** os tokens emitidos antes da rotação — todos os
usuários precisam fazer login novamente. É o preço pra fechar a janela de
exposição de qualquer secret antigo.

---

## Pré-requisitos

- Acesso ao painel Coolify do servidor de produção.
- Acesso `SUPERADMIN` no CRM (pra validar que o login ainda funciona depois).
- Comunicação prévia aos tenants (se janela for em horário comercial):
  > "Manutenção programada em DD/MM HH:MM — sessões serão encerradas, login
  > novamente necessário. Sem perda de dados."

---

## Passo a passo

### 1. Gerar novo secret

```bash
openssl rand -base64 32
```

Copia o resultado (ex.: `R8nF2kP9wQxL3mT7vY1jH6sB4dN8gA5cE0iZuO2pXqI=`).

> ⚠️ **Não coloca em arquivo, chat, e-mail, ticket.** Só na clipboard, e cola
> direto no Coolify.

### 2. Rotacionar no Coolify

1. Coolify → projeto **CRM** → serviço **web** (Next.js)
2. Aba **Environment Variables**
3. Localizar `AUTH_SECRET`
4. Editar → colar o novo valor → **Save**
5. Clicar em **Redeploy** (não basta o save — secret só é lido na inicialização)

### 3. Validar pós-deploy

Após Coolify mostrar `Running`:

1. Abrir https://app.seudominio.com em janela anônima.
2. Tentar acessar área logada → deve redirecionar para `/login` (sessões antigas
   foram invalidadas pelo secret novo).
3. Fazer login com sua conta SUPERADMIN.
4. Verificar que dashboard carrega normalmente.
5. Conferir nos logs do Coolify que **não há erros** de "JWT verification failed"
   sustentados (alguns são esperados na primeira hora — usuários ainda com cookie antigo).

### 4. Comunicar conclusão

> "Manutenção concluída em DD/MM HH:MM. Faça login novamente para continuar."

### 5. Registrar a rotação

Adicionar entrada em `docs/runbooks/auth-secret-rotation-log.md` (criar se
ainda não existir):

```markdown
| Data       | Quem        | Motivo                          | Próxima  |
| ---------- | ----------- | ------------------------------- | -------- |
| 2026-04-21 | fer.jorge   | Rotação trimestral programada   | 2026-07-21 |
```

> ⚠️ **Nunca** registre o secret em si — só a data e o motivo.

---

## Quando rotacionar **fora do calendário** (incidente)

Faça **imediatamente** se qualquer um destes ocorrer:

- [ ] Vazamento confirmado em build log, Sentry breadcrumb, screenshot público.
- [ ] Ex-funcionário com acesso ao Coolify foi desligado.
- [ ] Detectada credencial em commit (mesmo que removida — Git mantém history).
- [ ] Warning "secret ARG leak" no build do Docker (skill `nextjs-prisma-coolify-deploy` §9).
- [ ] Alerta de segurança do GitHub (push protection, secret scanning).
- [ ] Suspeita de comprometimento (login anômalo, audit log com ações que
      ninguém da equipe fez).

Após rotação emergencial, **investigar a causa raiz** e abrir post-mortem antes
de fechar o incidente.

---

## Pitfalls comuns

### "Salvei o secret novo mas continua aceitando os tokens antigos"

Esqueceu de **redeploy**. O Auth.js só lê `AUTH_SECRET` no boot do processo
Node. Mudança de env var sem reiniciar = nada acontece.

### "Depois da rotação, login dá erro de CSRF"

Se você usa `next-auth` com cookies `__Host-next-auth.csrf-token`, a rotação
do secret invalida o cookie CSRF também. Solução: limpar cookies do domínio
no navegador e tentar de novo. Para o usuário final, a primeira tentativa de
login pode falhar — a segunda funciona.

### "Quero rotacionar sem deslogar todo mundo"

Não tem. Auth.js v5 não suporta dual-secret (aceitar o antigo E o novo
durante uma janela). Se isso for crítico, abre uma janela de manutenção
documentada.

### "Esqueci de comunicar e o suporte explodiu"

Procedimento: avisar agora ("manutenção de segurança encerrou sessões, faça
login novamente — sem perda de dados") + agendar a próxima rotação **fora**
de horário comercial.

---

## Referências

- Skill `nextjs-prisma-multitenant-security` §9 — pitfall sobre `ARG` com secrets
- [Auth.js v5 — secret rotation](https://authjs.dev/getting-started/deployment#environment-variables)
- LGPD art. 46 — medidas técnicas de segurança aptas a proteger dados pessoais

---

## Cronograma sugerido (2026)

| Trimestre | Janela alvo                       |
| --------- | --------------------------------- |
| Q2 2026   | Sábado de junho, 09:00 BRT        |
| Q3 2026   | Sábado de setembro, 09:00 BRT     |
| Q4 2026   | Sábado de dezembro, 09:00 BRT     |
| Q1 2027   | Sábado de março, 09:00 BRT        |

> Adicionar lembrete recorrente no calendário do SUPERADMIN para D-7 (preparação)
> e D-1 (comunicar tenants).
