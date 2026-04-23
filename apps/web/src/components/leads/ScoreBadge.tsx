import { Flame, Thermometer, Snowflake } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number | null;
  label: string | null;
  showScore?: boolean;
  size?: "sm" | "md";
}

const CONFIG = {
  quente: {
    icon: Flame,
    className: "bg-red-100 text-red-700 border-red-200",
    label: "Quente",
  },
  morno: {
    icon: Thermometer,
    className: "bg-amber-100 text-amber-700 border-amber-200",
    label: "Morno",
  },
  frio: {
    icon: Snowflake,
    className: "bg-blue-100 text-blue-600 border-blue-200",
    label: "Frio",
  },
};

export function ScoreBadge({ score, label, showScore = false, size = "sm" }: ScoreBadgeProps) {
  if (score == null || !label) return null;

  const cfg = CONFIG[label as keyof typeof CONFIG] ?? CONFIG.frio;
  const Icon = cfg.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        cfg.className,
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      )}
      title={`Score: ${score}/100`}
    >
      <Icon size={size === "sm" ? 11 : 13} />
      {cfg.label}
      {showScore && <span className="opacity-70">· {score}</span>}
    </span>
  );
}
