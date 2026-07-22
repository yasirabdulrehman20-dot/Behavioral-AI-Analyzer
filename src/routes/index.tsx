import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";

import {
  analyzeContent,
  buildExplanations,
  buildTimeline,
  computeScores,
  computeStats,
  type BehaviorEvent,
  type SessionSnapshot,
} from "@/lib/analyzer";
import { ScoreCard } from "@/components/ScoreCard";
import { Timeline } from "@/components/Timeline";
import { Explanations } from "@/components/Explanations";
import { ContentRadar, TypingRateChart } from "@/components/Charts";

export const Route = createFileRoute("/")({
  component: DetectorPage,
});

const STORAGE_KEY = "ai-debug-detector-sessions-v1";

function DetectorPage() {
  const [text, setText] = useState("");
  const [events, setEvents] = useState<BehaviorEvent[]>([]);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(0);
  const [analyzed, setAnalyzed] = useState(false);
  const [history, setHistory] = useState<SessionSnapshot[]>([]);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [dragging, setDragging] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Theme toggle
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  // Load history
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // Live clock while a session is active (for the running stats)
  useEffect(() => {
    if (!sessionStart) return;
    const id = window.setInterval(() => setNowTick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [sessionStart]);

  const now = useMemo(
    () => (sessionStart ? Date.now() - sessionStart : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionStart, nowTick, events.length, text],
  );

  const ensureSession = useCallback(() => {
    if (sessionStart) return sessionStart;
    const t = Date.now();
    setSessionStart(t);
    setEvents([{ t: 0, type: "start" }]);
    return t;
  }, [sessionStart]);

  const push = useCallback(
    (type: BehaviorEvent["type"], meta?: BehaviorEvent["meta"]) => {
      const start = ensureSession();
      setEvents((ev) => [...ev, { t: Date.now() - start, type, meta }]);
    },
    [ensureSession],
  );

  // Handlers
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Backspace") push("backspace");
    else if (e.key === "Delete") push("delete");
    else if (e.key.length === 1) push("keydown", { key: e.key });
    else if (e.key.startsWith("Arrow")) push("cursor");
  };
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const size = e.clipboardData.getData("text").length;
    push("paste", { size });
  };
  const onCopy = () => push("copy");
  const onCut = () => push("cut");
  const onSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (el.selectionStart !== el.selectionEnd) push("selection");
  };
  const onClick = () => push("cursor");

  // Drag & drop text file
  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const content = await file.text();
    push("drop", { size: content.length, name: file.name });
    setText((t) => t + content);
  };

  const reset = () => {
    setText("");
    setEvents([]);
    setSessionStart(null);
    setAnalyzed(false);
    setNowTick(0);
  };

  const stats = useMemo(
    () => computeStats(events, text, now),
    [events, text, now],
  );
  const content = useMemo(() => analyzeContent(text), [text]);
  const scores = useMemo(() => computeScores(stats, content), [stats, content]);
  const timeline = useMemo(() => buildTimeline(events), [events]);
  const explanations = useMemo(
    () => buildExplanations(stats, content, scores),
    [stats, content, scores],
  );

  const runAnalysis = () => {
    if (!text.trim()) return;
    push("submit");
    setAnalyzed(true);
    const snap: SessionSnapshot = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      textPreview: text.slice(0, 140),
      stats,
      content,
      scores,
      timeline,
      explanations,
    };
    const next = [snap, ...history].slice(0, 20);
    setHistory(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
    setCompareId(null);
  };

  const exportJson = () => {
    const payload = { stats, content, scores, timeline, explanations };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-debug-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    let y = margin;
    doc.setFontSize(18);
    doc.text("AI Debug Detector — Report", margin, y);
    y += 24;
    doc.setFontSize(11);
    doc.setTextColor(120);
    doc.text(new Date().toLocaleString(), margin, y);
    y += 20;
    doc.setTextColor(0);
    doc.setFontSize(13);
    doc.text(`Verdict: ${scores.verdict}`, margin, y);
    y += 18;
    const rows: Array<[string, string]> = [
      ["Human score", `${scores.human}%`],
      ["AI score", `${scores.ai}%`],
      ["Paste score", `${scores.paste}%`],
      ["Editing score", `${scores.editing}%`],
      ["Suspicious behavior", `${scores.suspicious}%`],
      ["Confidence", `${scores.confidence}%`],
      ["Words", `${stats.totalWords}`],
      ["Avg WPM", stats.avgWpm.toFixed(1)],
      ["Peak WPM", stats.peakWpm.toFixed(0)],
      ["Keystrokes", `${stats.keystrokes}`],
      ["Backspaces / Deletes", `${stats.backspaces} / ${stats.deletes}`],
      ["Pastes (chars)", `${stats.pastes} (${stats.pasteChars})`],
      ["Session (s)", (stats.sessionMs / 1000).toFixed(1)],
    ];
    doc.setFontSize(11);
    rows.forEach(([k, v]) => {
      doc.text(`${k}:`, margin, y);
      doc.text(v, margin + 180, y);
      y += 14;
    });
    y += 8;
    doc.setFontSize(13);
    doc.text("Explanations", margin, y);
    y += 16;
    doc.setFontSize(10);
    explanations.forEach((e) => {
      if (y > 780) {
        doc.addPage();
        y = margin;
      }
      doc.setFont("helvetica", "bold");
      doc.text(`• ${e.label} (${e.risk})`, margin, y);
      y += 12;
      doc.setFont("helvetica", "normal");
      const reason = doc.splitTextToSize(e.reason, 515);
      doc.text(reason, margin + 10, y);
      y += reason.length * 12;
      const ev = doc.splitTextToSize(`Evidence: ${e.evidence}`, 515);
      doc.text(ev, margin + 10, y);
      y += ev.length * 12 + 4;
    });
    doc.save(`ai-debug-report-${Date.now()}.pdf`);
  };

  const compareSession = compareId
    ? history.find((h) => h.id === compareId) ?? null
    : null;

  return (
    <div
      className="min-h-screen"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {/* HEADER */}
      <header className="max-w-7xl mx-auto px-6 pt-8 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl glass grid place-items-center text-lg">
            <span className="gradient-text font-bold">◈</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">
              Behavioral AI&nbsp;<span className="gradient-text">Analyzer</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Behavioral analysis of how text is written — not just what it says.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="glass px-3 py-2 rounded-lg text-sm hover:bg-white/10 transition"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☾ Dark" : "☀ Light"}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pb-16 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        {/* LEFT — Input + charts */}
        <section className="space-y-6">
          <div className="glass-strong rounded-2xl p-5 relative">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Input
              </h2>
              <div className="text-xs text-muted-foreground tabular-nums">
                {stats.totalWords} words · {(stats.sessionMs / 1000).toFixed(1)}s
              </div>
            </div>
            <div
              className={`relative rounded-xl transition ${
                dragging ? "ring-2 ring-primary" : ""
              }`}
            >
              <textarea
                ref={taRef}
                value={text}
                onChange={(e) => {
                  ensureSession();
                  setText(e.target.value);
                }}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                onCopy={onCopy}
                onCut={onCut}
                onSelect={onSelect}
                onClick={onClick}
                placeholder="Start typing, paste, or drop a .txt file here…"
                className="w-full min-h-64 bg-black/20 border border-white/10 rounded-xl p-4 text-sm leading-relaxed outline-none focus:border-primary/60 resize-y font-mono"
                spellCheck={false}
              />
              {dragging && (
                <div className="absolute inset-0 grid place-items-center bg-primary/10 rounded-xl backdrop-blur-sm text-sm font-medium">
                  Drop text file to append
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={runAnalysis}
                disabled={!text.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition"
                style={{
                  background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
                  color: "var(--color-primary-foreground)",
                }}
              >
                Analyze
              </button>
              <button
                onClick={reset}
                className="px-3 py-2 rounded-lg text-sm glass hover:bg-white/10 transition"
              >
                Reset
              </button>
              <button
                onClick={exportJson}
                disabled={!analyzed}
                className="px-3 py-2 rounded-lg text-sm glass hover:bg-white/10 transition disabled:opacity-40"
              >
                Export JSON
              </button>
              <button
                onClick={exportPdf}
                disabled={!analyzed}
                className="px-3 py-2 rounded-lg text-sm glass hover:bg-white/10 transition disabled:opacity-40"
              >
                Export PDF
              </button>
              <div className="ml-auto text-xs text-muted-foreground self-center">
                🔒 100% local — nothing leaves this browser
              </div>
            </div>
          </div>

          {/* Score grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <ScoreCard label="TYPING SPEED" value={stats.avgWpm.toFixed(0)} tone="info" hint={`Peak ${stats.peakWpm.toFixed(0)}`} progress={Math.min(100, stats.avgWpm)} />
            <ScoreCard label="HUMAN SCORE" value={`${scores.human}%`} tone="success" progress={scores.human} />
            <ScoreCard label="AI SCORE" value={`${scores.ai}%`} tone="danger" progress={scores.ai} />
            <ScoreCard label="PASTE RATIO" value={`${scores.paste}%`} tone="warning" progress={scores.paste} />
            <ScoreCard label="EDITING ACTIVITY" value={`${scores.editing}%`} tone="accent" progress={scores.editing} />
            <ScoreCard label="Confidence" value={`${scores.confidence}%`} tone="primary" progress={scores.confidence} />
          </div>

          {/* Verdict banner */}
          <AnimatePresence>
            {analyzed && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="glass-strong rounded-2xl p-5 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Overall verdict
                  </div>
                  <div className="mt-1 text-2xl font-semibold gradient-text">
                    {scores.verdict}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Suspicious behavior score {scores.suspicious}/100
                  </div>
                </div>
                <div className="hidden md:block text-right text-xs text-muted-foreground">
                  <div>Keystrokes {stats.keystrokes}</div>
                  <div>Edits {stats.edits}</div>
                  <div>Pauses {stats.pauses}</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Input rate (keys / paste chars per second)
            </h3>
            <TypingRateChart events={events} sessionMs={Math.max(1000, stats.sessionMs)} />
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Content fingerprint
            </h3>
            <ContentRadar content={content} />
          </div>
        </section>

        {/* RIGHT — Timeline, explanations, history */}
        <aside className="space-y-6">
          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              ACTIVITY TIMELINE
            </h3>
            <Timeline entries={timeline} />
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Why this verdict
            </h3>
            <Explanations items={explanations} />
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Session history
              </h3>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-xs text-muted-foreground hover:text-danger transition"
                >
                  Clear
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">
                Run an analysis to save a session for comparison.
              </div>
            ) : (
              <ul className="space-y-2 max-h-72 overflow-auto pr-1">
                {history.map((h) => (
                  <li
                    key={h.id}
                    className={`p-3 rounded-lg border cursor-pointer transition ${
                      compareId === h.id
                        ? "border-primary/60 bg-primary/10"
                        : "border-white/10 hover:bg-white/5"
                    }`}
                    onClick={() =>
                      setCompareId(compareId === h.id ? null : h.id)
                    }
                  >
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{new Date(h.createdAt).toLocaleTimeString()}</span>
                      <span className="gradient-text font-semibold">
                        {h.scores.verdict}
                      </span>
                    </div>
                    <div className="mt-1 text-sm truncate">
                      {h.textPreview || <em>(empty)</em>}
                    </div>
                    <div className="mt-1 text-xs tabular-nums text-muted-foreground">
                      H {h.scores.human}% · AI {h.scores.ai}% · Paste {h.scores.paste}%
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {compareSession && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-strong rounded-2xl p-5"
            >
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Current vs. saved session
              </h3>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div />
                <div className="text-muted-foreground">Current</div>
                <div className="text-muted-foreground">Saved</div>
                {([
                  ["Human", scores.human, compareSession.scores.human],
                  ["AI", scores.ai, compareSession.scores.ai],
                  ["Paste", scores.paste, compareSession.scores.paste],
                  ["Editing", scores.editing, compareSession.scores.editing],
                  ["Suspicious", scores.suspicious, compareSession.scores.suspicious],
                ] as const).map(([label, a, b]) => (
                  <ComparisonRow key={label} label={label} a={a} b={b} />
                ))}
              </div>
            </motion.div>
          )}
        </aside>
      </main>

      <footer className="max-w-7xl mx-auto px-6 pb-8 text-xs text-muted-foreground text-center">
        Heuristic detector — signal, not certainty. No text or telemetry is transmitted.
      </footer>
    </div>
  );
}

function ComparisonRow({ label, a, b }: { label: string; a: number; b: number }) {
  const diff = a - b;
  const tone = diff > 5 ? "var(--color-success)" : diff < -5 ? "var(--color-danger)" : "var(--color-muted-foreground)";
  return (
    <>
      <div className="text-left text-muted-foreground py-1">{label}</div>
      <div className="tabular-nums font-medium" style={{ color: tone }}>
        {a}%
      </div>
      <div className="tabular-nums text-muted-foreground">{b}%</div>
    </>
  );
}
