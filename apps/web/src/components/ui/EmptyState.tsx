import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { href: string; label: string };
}

/** Estado vazio de listagem — sempre com uma saída (criar registro ou limpar filtros). */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 p-12 text-center">
      {Icon && <Icon size={28} className="text-muted-foreground/50" aria-hidden />}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action && (
        <Link
          href={action.href}
          className="mt-2 inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
