import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como coletamos, usamos e protegemos seus dados pessoais.",
};

const sections = [
  {
    title: "Controlador dos dados",
    content:
      "Esta plataforma CRM é operada por [Razão Social], CNPJ [00.000.000/0001-00], com sede em [Endereço], Brasil. Para questões de privacidade, contate nosso DPO em privacidade@crm.app.",
  },
  {
    title: "Dados coletados",
    content:
      "Coletamos dados fornecidos diretamente por você (nome, e-mail, telefone, informações da empresa), dados de uso da plataforma (logs de acesso, ações realizadas, IP), e dados de terceiros quando você conecta integrações autorizadas (Google, WhatsApp Business). Não coletamos dados sensíveis (art. 11 LGPD) sem consentimento explícito.",
  },
  {
    title: "Bases legais (art. 7º LGPD)",
    content:
      "Tratamos seus dados com base em: (a) execução de contrato — para prestar o serviço contratado; (b) legítimo interesse — para segurança, prevenção a fraudes e melhoria do serviço; (c) consentimento — para comunicações de marketing e funcionalidades opcionais; (d) cumprimento de obrigação legal — para retenção fiscal e atendimento a autoridades.",
  },
  {
    title: "Isolamento multi-tenant",
    content:
      "Cada empresa (tenant) opera em ambiente logicamente isolado. Seus dados nunca são acessíveis a outros tenants. Controles técnicos incluem filtragem obrigatória por tenantId em todas as consultas ao banco de dados e Row Level Security no PostgreSQL como camada adicional de defesa.",
  },
  {
    title: "Compartilhamento de dados",
    content:
      "Seus dados são compartilhados apenas com: subprocessadores essenciais (provedores de hospedagem, e-mail transacional, serviços de IA para funcionalidades que você ativa). Não vendemos dados. Compartilhamos com autoridades somente mediante ordem judicial ou obrigação legal.",
  },
  {
    title: "Segurança",
    content:
      "Adotamos: criptografia TLS em trânsito, criptografia em repouso no banco de dados, autenticação multi-fator disponível para administradores, logs de auditoria de todas as ações sensíveis, rate limiting contra ataques de força bruta, e sessões com expiração de 8 horas.",
  },
  {
    title: "Retenção de dados",
    content:
      "Dados de leads descartados: 18 meses. Dados de clientes ativos: enquanto o contrato estiver vigente + 5 anos (obrigação fiscal). Logs de auditoria: 5 anos. Dados de uso anonimizados: indefinido. Ao solicitar exclusão, anonimizamos os dados preservando a integridade da trilha de auditoria.",
  },
  {
    title: "Direitos do titular (art. 18 LGPD)",
    content:
      "Você tem direito a: confirmação e acesso aos seus dados, correção de dados incorretos, anonimização ou exclusão de dados desnecessários, portabilidade (export em JSON), revogação de consentimento, e informação sobre compartilhamento. Solicitações devem ser feitas pelo painel de configurações ou por e-mail ao DPO. Respondemos em até 15 dias úteis.",
  },
  {
    title: "Incidentes de segurança (art. 48 LGPD)",
    content:
      "Em caso de incidente que possa acarretar risco ou dano relevante aos titulares, notificaremos a ANPD e os titulares afetados no prazo legal, descrevendo a natureza dos dados afetados, as medidas tomadas e os contatos para esclarecimentos.",
  },
  {
    title: "Alterações a esta política",
    content:
      "Podemos atualizar esta política periodicamente. Mudanças relevantes serão comunicadas por e-mail com 30 dias de antecedência. O uso continuado da plataforma após esse prazo implica aceitação das novas condições.",
  },
];

export default function PrivacidadePage() {
  return (
    <LegalShell
      title="Política de Privacidade"
      subtitle="Como coletamos, usamos e protegemos seus dados pessoais"
      updatedAt="Abril de 2025"
      sections={sections}
    />
  );
}
