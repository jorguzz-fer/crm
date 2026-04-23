"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface SliceData {
  name: string;
  value: number;
}

interface Props {
  data: SliceData[];
}

const COLORS = [
  "#6366f1", "#8b5cf6", "#0ea5e9", "#22c55e",
  "#f59e0b", "#ef4444", "#ec4899", "#94a3b8",
];

const SOURCE_LABEL: Record<string, string> = {
  WEBSITE:       "Website",
  WHATSAPP:      "WhatsApp",
  INSTAGRAM:     "Instagram",
  FACEBOOK:      "Facebook",
  INDICACAO:     "Indicação",
  EVENTO:        "Evento",
  COLD_OUTREACH: "Prospecção",
  OUTRO:         "Outro",
};

export function SourceDonut({ data }: Props) {
  const labeled = data.map((d) => ({ ...d, name: SOURCE_LABEL[d.name] ?? d.name }));

  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Sem leads no período
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
          data={labeled}
          cx="50%"
          cy="50%"
          innerRadius={46}
          outerRadius={70}
          paddingAngle={2}
          dataKey="value"
        >
          {labeled.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: 12,
          }}
          formatter={(value, name) => [value, name]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
