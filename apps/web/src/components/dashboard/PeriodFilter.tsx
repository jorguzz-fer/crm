"use client";

import { useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  { value: "7",  label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
] as const;

interface Props {
  current: string;
}

export function PeriodFilter({ current }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function onChange(days: string) {
    const p = new URLSearchParams(params.toString());
    p.set("days", days);
    router.push(`/dashboard?${p.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
      {OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            current === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
