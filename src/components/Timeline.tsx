import { motion } from "framer-motion";
import type { TimelineEntry } from "@/lib/analyzer";

const kindStyle: Record<TimelineEntry["kind"], { color: string; icon: string }> = {
  start: { color: "var(--color-info)", icon: "▶" },
  pause: { color: "var(--color-warning)", icon: "⏸" },
  paste: { color: "var(--color-danger)", icon: "⧉" },
  edit: { color: "var(--color-accent)", icon: "✎" },
  submit: { color: "var(--color-primary)", icon: "✓" },
  info: { color: "var(--color-muted-foreground)", icon: "•" },
};

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        No events yet — start typing to build your timeline.
      </div>
    );
  }
  const maxT = entries[entries.length - 1].t || 1;
  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-white/10" />
      <ol className="space-y-4">
        {entries.map((e, i) => {
          const s = kindStyle[e.kind];
          return (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="relative pl-12"
            >
              <span
                className="absolute left-0 top-0 w-8 h-8 rounded-full grid place-items-center text-sm font-semibold"
                style={{ background: `${s.color}22`, color: s.color, border: `1px solid ${s.color}55` }}
              >
                {s.icon}
              </span>
              <div className="flex items-baseline justify-between gap-3">
                <div className="font-medium">{e.label}</div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {(e.t / 1000).toFixed(2)}s
                </div>
              </div>
              <div className="mt-1 h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full"
                  style={{ width: `${(e.t / maxT) * 100}%`, background: s.color }}
                />
              </div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
