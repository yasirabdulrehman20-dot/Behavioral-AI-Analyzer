import { motion } from "framer-motion";
import type { Explanation } from "@/lib/analyzer";

const riskColor: Record<Explanation["risk"], string> = {
  low: "var(--color-success)",
  medium: "var(--color-warning)",
  high: "var(--color-danger)",
};

export function Explanations({ items }: { items: Explanation[] }) {
  return (
    <div className="grid gap-3">
      {items.map((e, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="glass rounded-xl p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold">{e.label}</div>
            <span
              className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full"
              style={{
                background: `${riskColor[e.risk]}22`,
                color: riskColor[e.risk],
                border: `1px solid ${riskColor[e.risk]}55`,
              }}
            >
              {e.risk} risk
            </span>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">{e.reason}</div>
          <div className="mt-2 text-xs">
            <span className="text-muted-foreground">Evidence: </span>
            <span className="font-mono">{e.evidence}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Behavior: {e.behavior}</span>
            <span>Confidence {Math.min(100, Math.round(e.confidence))}%</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
