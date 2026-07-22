import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "primary" | "success" | "warning" | "danger" | "info" | "accent";
  icon?: ReactNode;
  progress?: number; // 0-100
}

const toneToColor: Record<NonNullable<Props["tone"]>, string> = {
  primary: "var(--color-primary)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  info: "var(--color-info)",
  accent: "var(--color-accent)",
};

export function ScoreCard({ label, value, hint, tone = "primary", icon, progress }: Props) {
  const color = toneToColor[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="glass rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden"
    >
      <div
        className="absolute inset-x-0 -top-16 h-32 blur-3xl opacity-40 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }}
      />
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        {icon && <span style={{ color }}>{icon}</span>}
      </div>
      <div className="text-3xl font-semibold" style={{ color }}>
        {value}
      </div>
      {typeof progress === "number" && (
        <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${color}, var(--color-accent))` }}
          />
        </div>
      )}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </motion.div>
  );
}
