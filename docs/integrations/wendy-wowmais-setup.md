# Wendy (fazer.ai) → CRM WOW+

Integração do agente **Wendy** com o tenant **`wowmais`** do CRM: toda conversa
no WhatsApp vira lead, e o interesse que a Wendy identifica entra no lead como
persona, produto e contexto para o comercial.

## Arquitetura

```
        WhatsApp — +55 11 93624-2622 (Meta Cloud API)
                          │
                          ▼
                     [Chatwoot]  conta Wendy (8) · inbox 22
                     │        │
   conversation_created        └──► [Wendy] agente 5, tenant `wendy`
          │                              │
          ▼                              │ ferramenta HTTP
      [n8n]                              │ registrar_interesse_crm
          │                              │  (só quando identifica interesse)
          ▼                              ▼
  POST /api/public/leads      POST /api/public/agent/wowmais/lead
  ───────────────────────     ────────────────────────────────────
   PISTA GARANTIDA             PISTA DE ENRIQUECIMENTO
   dispara sempre              depende de o agente lembrar
   tem o telefone real         tem o interesse e o contexto
          │                              │
          └──────────────┬───────────────┘
                         ▼
                  Lead no CRM `wowmais`
```

## Por que duas pistas, e não uma

As duas existem por causa de dois fatos medidos em produção, registrados na
skill `fazer-ai-armadilhas`:

**1. O agente esquece de chamar a ferramenta.** Em três conversas de teste na
Alumine, a agente chamou em duas. Captura que funciona em 2 de 3 não é captura
— e ninguém percebe, porque a conversa fica impecável e só o dado não chega.

**2. O agente não sabe o telefone de quem fala com ele.** Ele é um modelo dentro
de uma conversa; o número está no canal. Quando obrigado a informar, ele
inventa: `"não informado"`, `"whatsapp da conversa"`.

Daí a divisão: **o lead nasce no webhook**, que dispara sempre e tem o número
verdadeiro. **O interesse vem do agente**, que é quem entende a conversa. Se a
Wendy esquecer de chamar a ferramenta, perde-se o enriquecimento — nunca o lead.

---

## Parte 1 — CRM

### 1.1 Migration

Em produção **não se roda `prisma migrate deploy`**. O container aplica as
migrations sozinho na subida: `entrypoint.sh` → `apps/web/migrate.js`, que
percorre a lista fixa `MIGRATIONS` e aplica o que faltar. Basta o **deploy
(ou restart) no Coolify** depois do merge.

A `0019_lead_external_ref` cria a coluna `Lead.externalRef` e os índices de
deduplicação. Não-breaking — coluna nova opcional.

**Conferir que aplicou:** nos logs do container deve aparecer
`→ Aplicando 0019_lead_external_ref...` seguido de `✓ 0019_lead_external_ref aplicada`
(ou `já aplicada` nas subidas seguintes). Ou, pelo navegador:

```
https://crm.tudomudou.com.br/api/health/migrations?secret=<CRON_SECRET>
```

→ `"0019_lead_external_ref": true`.

⚠️ **Toda migration nova precisa de uma entrada em `apps/web/migrate.js`.**
Pasta sem entrada na lista é silenciosa: a subida imprime "todas as migrations
concluídas", a coluna não existe e o primeiro request que a toca dá **500** —
e como o `Lead` é lido em quase toda tela, o CRM inteiro mostra "Algo deu
errado". Foi o que aconteceu em 10/09/2026. O teste
`apps/web/src/__tests__/migrateRegistry.test.ts` agora falha no CI quando isso
acontece.

**Se o deploy já subiu sem a migration** e você precisa do CRM de pé agora, o
SQL é idempotente e pode ser aplicado à mão no Postgres (Coolify → banco →
terminal `psql`), sem esperar novo deploy:

```sql
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "externalRef" TEXT;
CREATE INDEX IF NOT EXISTS "Lead_tenantId_externalRef_idx" ON "Lead"("tenantId", "externalRef");
CREATE INDEX IF NOT EXISTS "Lead_tenantId_phone_idx"       ON "Lead"("tenantId", "phone");
```

O `migrate.js` da próxima subida vê a coluna e marca como já aplicada.

### 1.2 Pegar as credenciais

CRM → **Configurações → Integrações**. Dois cartões interessam:

| Cartão | Campo | Vai para |
|---|---|---|
| Captura via n8n / Make / Zapier | URL do webhook, API Token, tenantSlug | nó HTTP do n8n |
| Agente de atendimento por IA | URL da ferramenta, Token | ferramenta da Wendy |

O token é o mesmo nos dois — é o token do tenant. Ele **muda quando o
`AUTH_SECRET` do CRM é rotacionado**; nesse dia, atualize os dois lugares.

### 1.3 Conferir o pipeline padrão

O tenant `wowmais` foi criado em 10/09/2026 e pode ainda não ter funil. Sem um
pipeline marcado como padrão **o lead entra normalmente, mas não vira
oportunidade** — some da tela de Pipeline e aparece só em Leads.

CRM → **Pipeline** → criar um funil com pelo menos um estágio e marcá-lo como
padrão. Faça isto **antes** de ligar a integração: oportunidade não é criada
retroativamente para leads que já entraram.

---

## Parte 2 — n8n: a pista garantida

Workflow em `agente-atendimento/wendy/n8n/lead-crm-wendy.json`.

1. n8n → **Workflows → Add workflow → Import from file**
2. No trigger **"Conversa criada"**, credencial do Chatwoot e **`accountId: 8`**
   (conta Wendy). ⚠️ Confira o número: a conta errada assina as conversas de
   outro cliente.
3. No nó HTTP, credencial **Header Auth**:
   - Name: `x-api-token`
   - Value: o token do CRM (passo 1.2)
4. Salvar e **ativar**.

O corpo que o workflow monta:

```json
{
  "tenantSlug":  "wowmais",
  "name":        "<nome do contato, ou 'WhatsApp <numero>'>",
  "phone":       "<só dígitos>",
  "source":      "WHATSAPP",
  "externalRef": "chatwoot:8:<id da conversa>",
  "dedupe":      "phone",
  "message":     "Conversa aberta com a Wendy | Conversa: <id>"
}
```

**`dedupe: "phone"`** é o que impede que a mesma pessoa vire um lead novo toda
vez que reabre conversa — e a Wendy também atende suporte de assinante, então
sem isso o CRM encheria de repetido. A resposta traz `duplicado: true|false`,
visível na execução do n8n.

**Só inclua `phone` e `email` se tiverem valor.** Chave ausente o CRM aceita;
chave com `null` devolve 400 `Invalid input`. O nó "Monta o lead" já faz isso.

---

## Parte 3 — fazer.ai: a ferramenta da Wendy

Spec completa em `agente-atendimento/wendy/ferramenta-crm.md`.

| Campo | Valor |
|---|---|
| Nome | `registrar_interesse_crm` |
| Método | `POST` |
| URL | `https://crm.tudomudou.com.br/api/public/agent/wowmais/lead` |
| Header | `X-API-Token` — **do Cofre**, credencial `CRM WOW+ — x-api-token` |

### ⛔ Não escreva nada fixo no corpo

Em ferramenta HTTP do fazer.ai, **só chega o que o agente passa como
argumento**. Texto fixo some. Variável de contexto some.

| No corpo | Chega? |
|---|---|
| `"tenantSlug": "wowmais"` | **não** |
| `"nome": "{{contact_name}}"` | **não** |
| `"nome"` declarado como argumento | **sim** |

É exatamente por isso que `wowmais` está **na URL** e o token **no header** —
nenhum dos dois passa pelo modelo. Se alguém "consertar" isso movendo o slug
para o corpo, a integração volta a dar 400.

### Argumentos a declarar

| Argumento | Para que serve |
|---|---|
| `nome` | nome da pessoa |
| `persona` | `pf` · `b2b` · `licenciado` |
| `interesse` | produto/plano — vira nota e título da oportunidade |
| `vidas` | nº de vidas no B2B (aceita `"cerca de 40"`) |
| `resumo` | o que o vendedor precisa saber antes de ligar |
| `proximo_passo` | o que ficou combinado |
| `situacao` | `qualificado` · `em_contato` · `desqualificado` |
| `telefone` | **a chave**: reencontra o lead que o webhook já criou. A Wendy copia de "Telefone desta conversa" no prompt |
| `email`, `empresa`, `conversa_id`, `agente` | opcionais |

Precisa chegar **pelo menos um** entre `telefone`, `conversa_id` e `nome` — sem
nenhum não há o que registrar nem o que reencontrar. Na prática é o `telefone`;
os outros dois são reserva.

### Como as duas pistas se encontram

**Pelo telefone.** O n8n grava o lead com o número do payload do Chatwoot
(`5511989940404`); a Wendy manda o `telefone` que o prompt dela resolve em
`{{contact_phone}}` (`+5511989940404`); o CRM casa os dois formatos
(`phoneVariants`: com e sem `55`). É o mesmo mecanismo pelo qual a
`verificar_status_assinatura` já recebe o telefone da conversa.

**Por que não o id da conversa** (o desenho original): testado em 10/09, a
plataforma **não resolve `{{conversation_id}}`** — o prompt exibia o texto
literal, a Wendy copiou fielmente para o argumento, o CRM não achou nada e
criou um lead duplicado sem telefone. O `conversa_id` continua aceito (casa
por sufixo com o `externalRef` do n8n) para o dia em que a plataforma expuser
o id; hoje ela não expõe. E o CRM passou a **recusar qualquer valor com
`{{…}}`**: placeholder que chega do modelo é ausência de dado, não dado.

**Não há casamento por nome**: dois "João Silva" no mesmo dia virariam um lead
só, com o histórico de duas pessoas misturado. Duplicata se resolve depois;
isso não.

Se nada casar, a ferramenta **cria** o lead com o que a Wendy sabe. É a rede
para o dia em que o n8n estiver fora.

---

## Parte 4 — Validação

Nesta ordem, porque cada passo elimina uma causa antes do próximo.

### 4.1 O CRM aceita (antes de tocar em qualquer agente)

```bash
# Pista garantida
curl -X POST https://crm.tudomudou.com.br/api/public/leads \
  -H "Content-Type: application/json" \
  -H "x-api-token: SEU_TOKEN" \
  -d '{"tenantSlug":"wowmais","name":"Teste Wendy","phone":"11999998888",
       "source":"WHATSAPP","externalRef":"chatwoot:8:999999","dedupe":"phone"}'
# → {"ok":true,"leadId":"...","duplicado":false}

# Repetir o MESMO comando
# → {"ok":true,"leadId":"<o mesmo id>","duplicado":true}   ← dedupe funcionando

# Pista de enriquecimento
curl -X POST https://crm.tudomudou.com.br/api/public/agent/wowmais/lead \
  -H "Content-Type: application/json" \
  -H "x-api-token: SEU_TOKEN" \
  -d '{"nome":"Teste Wendy","persona":"b2b","interesse":"CARE+ com NR-1",
       "vidas":40,"situacao":"qualificado","telefone":"+5511999998888","agente":"Wendy"}'
# → {"ok":true,"registrado":true,"lead_id":"<o mesmo id>","criado":false}
```

`criado: false` com o **mesmo** `leadId` do primeiro comando é a prova de que as
duas pistas encontraram o mesmo lead. Se vier `criado: true`, a correlação
falhou — vá para o troubleshooting.

Em Leads, o lead deve estar **QUALIFICADO**, com a nota:

```
[Wendy — interesse identificado]
Persona: Empresa (B2B)
Interesse: CARE+ com NR-1
Vidas: 40
Conversa: conversa 999999
```

Apague o lead de teste depois.

### 4.2 O n8n dispara

Mande uma mensagem de um número que nunca falou com a Wendy. Em até alguns
segundos deve nascer um lead com o telefone certo. Confira a execução do
workflow — o nó "Resultado legível" mostra o que foi enviado.

### 4.3 Conferir a chave de correlação

Numa conversa real que chegue ao interesse, abra nos Logs do agente o turno do
handoff → etapa `Chamada de ferramenta` → `registrar_interesse_crm` →
`detail.args`. O `telefone` tem que ser o número da conversa no formato
`+55…`. E o `output` (resposta do CRM) tem que trazer `criado: false` — é a
prova de que ela reencontrou o lead do n8n em vez de criar outro.

Na tela de Leads o efeito é **um lead só**, que saiu de NOVO para QUALIFICADO
e ganhou a nota da Wendy abaixo da nota do n8n.

Se o `args.telefone` vier vazio, `{{…}}` ou um número diferente do da conversa,
o prompt no ar não é o v1.3 ou a ferramenta ainda declara `conversa_id` em vez
de `telefone` — confira `agent_get` e a aba Ferramentas.

**Sobre os números de conversa que não batem:** o payload do Chatwoot traz
`id: 6` (por conta) e os Logs do painel do agente mostram `#110`. Não importa
para nada agora — a correlação não usa esse número.

### 4.4 Playground e produção

Playground primeiro (barato, pega erro de prompt); WhatsApp real depois, que é
o único lugar onde variável de contexto e canal aparecem de verdade. `/reset`
entre rodadas. `mode: production` só no fim.

⚠️ **No playground a ferramenta HTTP é simulada** — ela devolve
`[simulated] ... no real effect` e **nada chega ao CRM**. Playground serve para
ver se a Wendy *decide* chamar e com quais argumentos (Logs → `detail.args`),
não para validar a gravação.

---

## Troubleshooting

### `criado: true` quando devia ser `false`
A correlação falhou: o `telefone` não chegou, chegou como `{{…}}`, ou não é o
número da conversa (veja `detail.args` no log do agente) — passo 4.3. Foi
exatamente o sintoma em 10/09, quando a chave ainda era `conversa_id`: segundo
lead, sem telefone, QUALIFICADO.

### `401 Não autorizado`
Token errado, ausente, ou slug errado na URL. As três respondem igual de
propósito: esta rota não conta quais tenants existem. Confira o token em
Configurações → Integrações e o `wowmais` na URL.

### `400 Não consegui ler os dados enviados`
O corpo da requisição **não é JSON válido**. Não é o modelo: o `args` no log
do agente pode estar perfeito e ainda assim a plataforma montar um corpo
quebrado. Aconteceu em 10/09 logo depois de editar o corpo da ferramenta à
mão para incluir o `telefone` — uma vírgula. Conserto: na ferramenta, "Editar
como JSON", apagar tudo e colar o JSON inteiro de novo (está em
`wendy/ferramenta-crm.md`). Se o corpo estiver no modo de campos chave/valor
em vez de JSON, trocar para JSON — a rota só lê JSON.

### `400 Dados inválidos para registrar o interesse`
O agente mandou um campo fora do formato — quase sempre `situacao` com um valor
que não é `qualificado`/`em_contato`/`desqualificado`. Veja `detail.args` no log.

### Lead entra mas não aparece no Pipeline
Falta pipeline padrão no tenant — passo 1.3. O lead está em Leads.

### A Wendy nunca chama a ferramenta
Esperado em parte das conversas: é a razão da pista garantida existir. Se for em
**todas**, confira se a ferramenta está habilitada no agente e se a seção
`registrar_interesse_crm` está no prompt que está **no ar** (`agent_get`) — e
não só no arquivo do repositório.

### Mensagem aparece no Chatwoot mas não chega no WhatsApp
Não é esta integração, e **não é o prompt**. É a perna de saída — espelho
fantasma de inbox ou canal caído. Runbook na skill `fazer-ai-armadilhas`.

---

## O que ficou de fora

- **Estágio do funil por persona.** Todo lead entra no primeiro estágio do
  pipeline padrão. A persona vai na nota. Separar em três funis (PF / B2B /
  licenciados) foi considerado e adiado — começa simples.
- **Deduplicação pelo nono dígito.** `11936242622` e `1136242622` não casam de
  propósito: podem ser duas linhas diferentes, e misturar o histórico de duas
  pessoas é pior que duplicar.
- **Consentimento LGPD.** A conversa cria lead sem `ConsentRecord`. A base legal
  hoje é legítimo interesse (a pessoa iniciou o contato); se a WOW+ quiser
  registro explícito, é trabalho novo.
