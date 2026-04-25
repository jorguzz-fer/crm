"use client";

export function ReloadButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
    >
      Tentar novamente
    </button>
  );
}
