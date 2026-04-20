import Link from "next/link";

interface Section {
  title: string;
  content: string;
}

interface Props {
  title: string;
  subtitle: string;
  updatedAt: string;
  sections: Section[];
}

export function LegalShell({ title, subtitle, updatedAt, sections }: Props) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-gradient-to-r from-primary/5 to-primary/10 py-12">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <Link href="/" className="mb-6 inline-block text-sm font-medium text-primary hover:underline">
            ← Voltar ao início
          </Link>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-2 text-muted-foreground">{subtitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">Atualizado em {updatedAt}</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="space-y-8">
          {sections.map((section, i) => (
            <section key={i}>
              <h2 className="mb-3 text-lg font-semibold">
                {i + 1}. {section.title}
              </h2>
              <p className="leading-relaxed text-muted-foreground">{section.content}</p>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-3xl px-4 text-center text-sm text-muted-foreground">
          <p>
            Dúvidas? Entre em contato com nosso DPO:{" "}
            <a href="mailto:privacidade@crm.app" className="text-primary hover:underline">
              privacidade@crm.app
            </a>
          </p>
          <div className="mt-4 flex justify-center gap-6">
            <Link href="/privacidade" className="hover:underline">
              Política de Privacidade
            </Link>
            <Link href="/termos" className="hover:underline">
              Termos de Uso
            </Link>
            <Link href="/login" className="hover:underline">
              Entrar
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
