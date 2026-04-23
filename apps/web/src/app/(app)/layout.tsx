import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { signOutAction } from "@/app/actions/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-end border-b border-border bg-card px-6 gap-3">
          {/* Sino de notificações — Suspense para não bloquear o layout */}
          <Suspense fallback={<div className="h-9 w-9" />}>
            <NotificationBell />
          </Suspense>
          <span className="text-sm text-muted-foreground hidden sm:block">{session.user.name}</span>
          <form action={signOutAction}>
            <button type="submit" className="text-sm text-muted-foreground hover:text-foreground">
              Sair
            </button>
          </form>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
