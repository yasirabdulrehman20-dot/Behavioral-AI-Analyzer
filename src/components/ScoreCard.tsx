import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "primary" | "success" | "warning" | "danger" | "info" | "accent";
  icon?: ReactNode;
  progress?: number;
}

const toneToColor: Record<NonNullable<Props["tone"]>, string> = {
  primary: "var(--color-primary)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  info: "var(--color-info)",
  accent: "var(--color-accent)",
};

export function ScoreCard({
  label,
  value,
  hint,
  tone = "primary",
  icon,
  progress,
}: Props) {
  const color = toneToColor[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden border"
      style={{
        background: "var(--color-card)",
        borderColor: "var(--color-border)",
      }}
    >
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        {icon && <span style={{ color }}>{icon}</span>}
      </div>

      <div
        className="text-3xl font-bold"
        style={{
          color:
            "color-mix(in srgb, var(--color-foreground) 85%, " +
            color +
            " 15%)",
        }}
      >
        {value}
      </div>

      {typeof progress === "number" && (
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
            }}
            transition={{ duration: 0.35 }}
            className="h-full rounded-full"
            style={{ background: color }}
          />
        </div>
      )}

      {hint && (
        <div className="text-xs text-muted-foreground">
          {hint}
        </div>
      )}
    </motion.div>
  );
}