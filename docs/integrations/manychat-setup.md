# Manychat → n8n → CRM

Guia completo para capturar leads do Instagram (DMs, comentários, Lead Ads, stories) e Facebook via Manychat, encaminhando para o CRM através do n8n.

## Arquitetura

```
[Instagram / Facebook]
        │
        ▼
   [Manychat]
        │  External Request (HTTP POST)
        ▼
[n8n Webhook] ── transforma ─→ [POST /api/public/leads]
        │                              │
        ▼                              ▼
  resposta 200                    Lead criado no CRM
```

---

## Parte 1 — Importar o workflow no n8n

### 1. Importar o arquivo

No n8n self-hosted:

1. Menu lateral → **Workflows** → **Add workflow** → **Import from file**
2. Selecione `manychat-n8n-workflow.json` (deste diretório)
3. O workflow aparece com 5 nodes:
   - **Webhook (Manychat)** — recebe POST do Manychat
   - **Config (edite aqui)** — variáveis (tenantSlug, apiToken)
   - **Transformar (Manychat → CRM)** — converte payload
   - **POST → CRM** — chama `/api/public/leads`
   - **Resposta (200 OK)** — devolve sucesso para o Manychat

### 2. Configurar credenciais do tenant

No node **"Config (edite aqui)"**, substitua os placeholders pelos valores reais do seu CRM:

| Campo | Onde pegar |
|---|---|
| `tenantSlug` | CRM → **Configurações → Integrações** → seção "Credenciais para n8n" → campo `tenantSlug` |
| `apiToken` | CRM → mesmo lugar → campo `API Token` (clica em "Mostrar" e "Copiar") |
| `crmUrl` | Já vem preenchido: `https://crm.tudomudou.com.br/api/public/leads` |

### 3. Ativar o workflow

Clique no toggle **"Inactive"** no topo direito → vira **"Active"** (verde).

### 4. Copiar a URL do webhook

Clique no node **"Webhook (Manychat)"** → copie o valor de **"Production URL"**.

Vai ser algo como:
```
https://n8n.tudomudou.com.br/webhook/manychat-lead
```

Guarda essa URL — você vai usar no Manychat.

### 5. (Opcional) Teste rápido

Antes de configurar o Manychat, teste com `curl`:

```bash
curl -X POST https://n8n.tudomudou.com.br/webhook/manychat-lead \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Maria",
    "last_name":  "Teste",
    "email":      "maria@teste.com",
    "phone":      "11999998888",
    "channel":    "instagram",
    "ad_name":    "Teste Anúncio",
    "last_input_text": "Quero saber mais sobre o curso"
  }'
```

Resposta esperada: `{"ok":true,"leadId":"cuid..."}` — e o lead aparece em `crm.tudomudou.com.br/leads` com source **Instagram**.

---

## Parte 2 — Configurar o Manychat

### 1. Pré-requisitos

- Conta no [Manychat](https://manychat.com/) (plano grátis serve para começar)
- Página do Facebook conectada **OU** Conta Instagram Business conectada no Manychat
- Pelo menos um Flow criado que coleta nome/email/telefone do lead

### 2. Adicionar External Request no Flow

Dentro do Flow do Manychat onde você captura o lead:

1. Adicione um bloco **"Action"** após coletar os dados do lead
2. Em "Add Action" → procure **"External Request"** (também chamado de "HTTP Request" ou "API Call")
3. Configure:

| Campo | Valor |
|---|---|
| **Method** | `POST` |
| **URL** | Cole a Production URL do n8n (passo 4 acima) |
| **Headers** | `Content-Type: application/json` |
| **Body Type** | `JSON` |

### 3. Body JSON do External Request

Cole esse JSON no corpo, ajustando os campos conforme os Custom Fields do seu Flow:

```json
{
  "first_name": "{{first_name}}",
  "last_name": "{{last_name}}",
  "email": "{{email}}",
  "phone": "{{phone}}",
  "channel": "instagram",
  "ig_username": "{{ig_username}}",
  "ad_name": "{{ad_name}}",
  "last_input_text": "{{last_input_text}}",
  "subscriber_id": "{{user_id}}"
}
```

> **Importante:** Os valores entre `{{}}` são "User Field" do Manychat. Use os mesmos nomes dos seus Custom Fields. Os campos `{{first_name}}`, `{{last_name}}`, `{{user_id}}` são built-in. `email` e `phone` precisam ser coletados antes (Ask Email Question / Ask Phone Question).

### 4. Variar o `channel` conforme o fluxo

Se você tem fluxos separados para Facebook e Instagram, ajuste o valor `"channel"`:

- Instagram (DM, stories, comments) → `"instagram"`
- Facebook (Messenger, Lead Ads via Messenger) → `"facebook"`
- WhatsApp (se você integrar) → `"whatsapp"`

### 5. (Opcional) Testar o External Request no Manychat

Manychat tem um botão "Test" dentro do External Request. Clica e ele dispara uma requisição real. Se voltar 200, está perfeito.

### 6. Publicar o Flow

Não esqueça de **publicar o Flow** no Manychat. Sem publicar, o External Request não dispara.

---

## Parte 3 — Casos de uso no Manychat

### Caso 1 — Captura via Instagram Lead Ads

1. **Manychat** → **Automation** → **Triggers** → **"New Subscriber from Comment"** ou via **Ad Optimization**
2. No Flow: agradece + faz perguntas (nome se não veio, email, telefone)
3. Action: External Request → seu n8n (channel: `instagram`)

### Caso 2 — Captura via comentários em posts/anúncios

1. **Growth Tools** → **Comments Auto-Reply**
2. Quando alguém comenta uma palavra-chave (ex: "EU QUERO"), Manychat manda DM
3. No DM flow, coleta email/telefone → External Request

### Caso 3 — Story Reply

1. **Triggers** → **Story Reply** → escolhe o story
2. Flow coleta dados → External Request

### Caso 4 — DM direta

1. **Default Reply** ou **Keyword Reply**
2. Bot conduz conversa coletando dados
3. External Request ao final

---

## Parte 4 — Multi-tenant: workflow por cliente

Para escalar para múltiplos clientes do CRM, **cada tenant tem o seu workflow no n8n** com `tenantSlug` e `apiToken` próprios:

```
n8n.tudomudou.com.br/webhook/manychat-lead-clienteA
n8n.tudomudou.com.br/webhook/manychat-lead-clienteB
n8n.tudomudou.com.br/webhook/manychat-lead-clienteC
```

Cada cliente recebe a URL dele para colar no External Request do Manychat dele.

**Onboarding de cliente novo (10 min):**

1. No CRM, criar o tenant
2. No n8n, duplicar o workflow base, mudar:
   - Path do webhook (ex: `manychat-lead-clienteX`)
   - `tenantSlug` e `apiToken` do Config
3. Mandar para o cliente: URL do webhook + tutorial de External Request no Manychat
4. Pronto — o cliente configura no Manychat dele e os leads fluem

---

## Troubleshooting

### "401 Token inválido"
- Verifique se o `apiToken` no Config bate com o token mostrado na tela de Integrações do CRM
- O token muda quando o `AUTH_SECRET` do CRM é rotacionado — regenere o token e atualize aqui

### "400 Dados inválidos"
- Algum campo obrigatório está vazio. Confirme que `name` está chegando do Manychat
- Veja o último execution do node "Transformar" no n8n e olhe o `json` enviado

### Lead aparece duplicado a cada execução
- Manychat repete o External Request em alguns triggers. Adicione uma condição no Flow para não disparar 2x

### Manychat External Request dá timeout
- Aumente o timeout no n8n para 30s (Settings do workflow → Save execution data → Timeout)
- Verifique se o CRM está respondendo rápido (< 5s)

---

## Próximos passos sugeridos

- [ ] Importar workflow no n8n
- [ ] Preencher Config (tenantSlug + apiToken)
- [ ] Testar com `curl`
- [ ] Criar conta Manychat
- [ ] Conectar Instagram Business + Facebook Page
- [ ] Criar primeiro Flow de captura
- [ ] Configurar External Request apontando para o webhook
- [ ] Testar com um lead real do próprio Instagram
- [ ] Documentar o passo a passo (vídeo curto) para repassar a clientes futuros
