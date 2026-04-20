import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Termos e condições para uso da plataforma CRM.",
};

const sections = [
  {
    title: "Aceitação dos termos",
    content:
      "Ao criar uma conta ou utilizar a plataforma, você declara ter lido, compreendido e concordado com estes Termos de Uso e com nossa Política de Privacidade. Se você não concordar com algum ponto, não utilize o serviço.",
  },
  {
    title: "Objeto do serviço",
    content:
      "A plataforma CRM oferece ferramentas de gestão de relacionamento com clientes (CRM), incluindo gestão de leads, contas, contatos, oportunidades, funil de vendas, agenda e assistentes de inteligência artificial. O serviço é fornecido via Software as a Service (SaaS) com acesso via navegador web.",
  },
  {
    title: "Conta e credenciais",
    content:
      "Você é responsável por manter a confidencialidade de suas credenciais de acesso. Notifique-nos imediatamente em caso de uso não autorizado. Cada conta está vinculada a um tenant (empresa) e não pode ser transferida sem autorização expressa. Contas inativas por mais de 12 meses podem ser suspensas após aviso prévio.",
  },
  {
    title: "Perfis de acesso e RBAC",
    content:
      "O acesso à plataforma é controlado por papéis (SUPERADMIN, ADMIN, SUPERVISOR, ANALYST, VIEWER). Administradores do tenant são responsáveis por gerenciar os papéis dos usuários de sua organização e garantir que o acesso seja proporcional às funções de cada colaborador.",
  },
  {
    title: "Uso aceitável",
    content:
      "É vedado: fazer engenharia reversa ou tentar acessar dados de outros tenants; usar a plataforma para envio de spam ou comunicações não solicitadas em escala; armazenar dados de terceiros sem base legal adequada (LGPD art. 7º); sobrecarregar deliberadamente a infraestrutura; e utilizar a plataforma para atividades ilegais.",
  },
  {
    title: "Propriedade intelectual",
    content:
      "A plataforma, incluindo código, design, logotipos e documentação, é de propriedade do operador e protegida por leis de propriedade intelectual. Você conserva todos os direitos sobre os dados inseridos na plataforma. Concedemos-lhe licença limitada, não exclusiva e intransferível para usar o serviço conforme contratado.",
  },
  {
    title: "Disponibilidade e SLA",
    content:
      "Buscamos disponibilidade de 99,5% mensal, excluindo janelas de manutenção programadas (avisadas com 48h de antecedência) e eventos de força maior. Não garantimos disponibilidade ininterrupta. Em caso de indisponibilidade superior a 4 horas consecutivas não programadas, você poderá solicitar crédito proporcional.",
  },
  {
    title: "Limitação de responsabilidade",
    content:
      "Nossa responsabilidade total por qualquer reclamação decorrente destes termos está limitada ao valor pago nos últimos 3 meses. Não nos responsabilizamos por danos indiretos, lucros cessantes ou perda de dados causados por uso indevido da plataforma, falhas de terceiros ou eventos fora de nosso controle.",
  },
  {
    title: "Dados e segurança",
    content:
      "Implementamos medidas técnicas e organizacionais razoáveis para proteger seus dados, conforme detalhado em nossa Política de Privacidade. Você é responsável pela segurança das senhas de sua equipe e pela configuração adequada dos papéis de acesso.",
  },
  {
    title: "Alterações aos termos",
    content:
      "Podemos modificar estes termos a qualquer momento. Alterações materiais serão comunicadas por e-mail com 30 dias de antecedência. O uso continuado após esse prazo constitui aceitação das novas condições. Em caso de discordância, você pode encerrar sua conta e solicitar a exportação de seus dados.",
  },
  {
    title: "Foro e lei aplicável",
    content:
      "Estes termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de [Cidade/Estado] para dirimir quaisquer controvérsias decorrentes deste instrumento, com renúncia a qualquer outro, por mais privilegiado que seja.",
  },
];

export default function TermosPage() {
  return (
    <LegalShell
      title="Termos de Uso"
      subtitle="Condições para utilização da plataforma CRM"
      updatedAt="Abril de 2025"
      sections={sections}
    />
  );
}
