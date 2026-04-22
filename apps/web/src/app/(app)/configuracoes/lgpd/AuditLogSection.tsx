const ACTION_LABELS: Record<string, string> = {
  "lead.create": "Criou lead",
  "lead.update": "Atualizou lead",
  "lead.delete": "Deletou lead",
  "lead.status_change": "Alterou status do lead",
  "opportunity.create": "Criou oportunidade",
  "opportunity.update": "Atualizou oportunidade",
  "opportunity.delete": "Deletou oportunidade",
  "opportunity.status_change": "Alterou status da oportunidade",
  "company.create": "Criou empresa",
  "company.update": "Atualizou empresa",
  "company.delete": "Deletou empresa",
  "contact.create": "Criou contato",
  "contact.update": "Atualizou contato",
  "contact.delete": "Deletou contato",
  "task.create": "Criou tarefa",
  "task.complete": "Concluiu tarefa",
  "task.delete": "Deletou tarefa",
  "activity.create": "Registrou atividade",
  "activity.delete": "Deletou atividade",
  "note.create": "Adicionou nota",
  "user.create": "Criou usuário",
  "user.role_change": "Alterou papel do usuário",
  "user.toggle_active": "Alterou status do usuário",
  "tenant.update": "Atualizou dados do tenant",
  "lgpd.request.export": "Solicitou exportação de dados",
  "lgpd.request.delete": "Solicitou exclusão de dados",
  "lgpd.request.approve": "Aprovou solicitação LGPD",
  "lgpd.request.reject": "Rejeitou solicitação LGPD",
  "lgpd.consent.register": "Registrou consentimento",
  "lgpd.retention.anonymize_lead": "Anonimizou leads (retenção)",
  "lgpd.retention.anonymize_contact": "Anonimizou contatos (retenção)",
  "ai.summarize": "Gerou resumo com IA",
};

interface Log {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  meta: unknown;
  ip: string | null;
  createdAt: Date;
  // null = ação executada pelo sistema (cronjobs, jobs automatizados)
  user: { name: string } | null;
}

export function AuditLogSection({ logs }: { logs: Log[] }) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground rounded-lg border border-border bg-card p-4">
        Nenhum evento de auditoria registrado ainda.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data/Hora</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usuário</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ação</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Entidade</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden xl:table-cell">IP</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-muted/20 transition-colors">
              <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                {new Date(log.createdAt).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td className="px-4 py-2.5 font-medium">
                {log.user?.name ?? (
                  <span className="italic text-muted-foreground">Sistema</span>
                )}
              </td>
              <td className="px-4 py-2.5">
                <span className="text-xs">{ACTION_LABELS[log.action] ?? log.action}</span>
              </td>
              <td className="px-4 py-2.5 hidden lg:table-cell">
                <span className="text-xs text-muted-foreground">
                  {log.entity}
                  {log.entityId && (
                    <span className="ml-1 font-mono opacity-60">{log.entityId.slice(-6)}</span>
                  )}
                </span>
              </td>
              <td className="px-4 py-2.5 hidden xl:table-cell text-xs text-muted-foreground font-mono">
                {log.ip ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
