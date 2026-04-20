const config: Record<string, { label: string; className: string }> = {
  NOVO:           { label: "Novo",          className: "bg-blue-100 text-blue-700" },
  EM_CONTATO:     { label: "Em contato",    className: "bg-yellow-100 text-yellow-700" },
  QUALIFICADO:    { label: "Qualificado",   className: "bg-green-100 text-green-700" },
  DESQUALIFICADO: { label: "Desqualificado",className: "bg-zinc-100 text-zinc-600" },
  CONVERTIDO:     { label: "Convertido",    className: "bg-purple-100 text-purple-700" },
};

export function LeadStatusBadge({ status }: { status: string }) {
  const { label, className } = config[status] ?? { label: status, className: "bg-zinc-100 text-zinc-600" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
