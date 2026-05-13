import type { Metadata } from "next";

export const metadata: Metadata = { title: "Exclusão de Dados — CRM" };

interface Props {
  searchParams: Promise<{ code?: string }>;
}

export default async function DataDeletionPage({ searchParams }: Props) {
  const { code } = await searchParams;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6 text-center">
        <div className="text-5xl">🗑️</div>

        <div>
          <h1 className="text-2xl font-bold">Exclusão de Dados</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Solicitação de exclusão de dados recebida com sucesso.
          </p>
        </div>

        {code && (
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm space-y-1">
            <p className="text-muted-foreground text-xs uppercase tracking-wide font-medium">
              Código de confirmação
            </p>
            <p className="font-mono text-base font-semibold break-all">{code}</p>
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-5 text-sm text-left space-y-3">
          <h2 className="font-semibold">O que acontece com seus dados?</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-green-600 font-bold shrink-0">✓</span>
              Sua solicitação foi registrada e será processada em até 30 dias.
            </li>
            <li className="flex gap-2">
              <span className="text-green-600 font-bold shrink-0">✓</span>
              Todos os dados vinculados à sua conta do Facebook serão removidos
              dos nossos sistemas.
            </li>
            <li className="flex gap-2">
              <span className="text-green-600 font-bold shrink-0">✓</span>
              Registros de auditoria são mantidos de forma anonimizada conforme
              exigido pela LGPD.
            </li>
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          Em caso de dúvidas, entre em contato:{" "}
          <a
            href="mailto:privacidade@tudomudou.com.br"
            className="underline hover:text-foreground"
          >
            privacidade@tudomudou.com.br
          </a>
        </p>
      </div>
    </div>
  );
}
