import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { BehaviorEvent, ContentAnalysis } from "@/lib/analyzer";

export function ContentRadar({ content }: { content: ContentAnalysis }) {
  const data = [
    { k: "Grammar", v: content.grammarConsistency * 100 },
    { k: "Complexity", v: content.sentenceComplexity * 100 },
    { k: "Diversity", v: content.vocabularyDiversity * 100 },
    { k: "Burstiness", v: content.burstiness * 100 },
    { k: "Format", v: content.formattingScore * 100 },
    { k: "Predict.", v: content.predictability * 100 },
  ];
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data} outerRadius="75%">
        <PolarGrid stroke="rgba(255,255,255,0.12)" />
        <PolarAngleAxis dataKey="k" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
        <Radar
          dataKey="v"
          stroke="var(--color-primary)"
          fill="var(--color-primary)"
          fillOpacity={0.35}
          isAnimationActive
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function TypingRateChart({ events, sessionMs }: { events: BehaviorEvent[]; sessionMs: number }) {
  const bucket = 1000;
  const buckets = Math.max(1, Math.ceil(sessionMs / bucket));
  const data = Array.from({ length: buckets }, (_, i) => ({
    t: i,
    keys: 0,
    pastes: 0,
  }));
  events.forEach((e) => {
    const b = Math.min(buckets - 1, Math.floor(e.t / bucket));
    if (e.type === "keydown") data[b].keys++;
    if (e.type === "paste") data[b].pastes += Number(e.meta?.size) || 0;
  });
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="gKeys" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.7} />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gPaste" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-danger)" stopOpacity={0.7} />
            <stop offset="100%" stopColor="var(--color-danger)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="t" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} tickFormatter={(v) => `${v}s`} />
        <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} />
        <Tooltip
          contentStyle={{
            background: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: 10,
            fontSize: 12,
          }}
        />
        <Area type="monotone" dataKey="keys" stroke="var(--color-primary)" fill="url(#gKeys)" />
        <Area type="monotone" dataKey="pastes" stroke="var(--color-danger)" fill="url(#gPaste)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
