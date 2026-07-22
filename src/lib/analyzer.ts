// AI Debug Detector — behavior + content analysis (client-only, no network).

export type EventType =
  | "keydown"
  | "backspace"
  | "delete"
  | "paste"
  | "copy"
  | "cut"
  | "selection"
  | "cursor"
  | "start"
  | "pause"
  | "resume"
  | "drop"
  | "submit";

export interface BehaviorEvent {
  t: number; // ms since session start
  type: EventType;
  meta?: Record<string, number | string>;
}

export interface SessionStats {
  totalChars: number;
  totalWords: number;
  sessionMs: number;
  writingMs: number;
  timeToFirstKeystrokeMs: number | null;
  keystrokes: number;
  backspaces: number;
  deletes: number;
  edits: number;
  pastes: number;
  pasteChars: number;
  largestPasteChars: number;
  copies: number;
  cursorMoves: number;
  selections: number;
  pauses: number;
  longestPauseMs: number;
  avgPauseMs: number;
  avgWpm: number;
  peakWpm: number;
  keystrokeIntervalMs: number; // median
}

export interface Scores {
  human: number; // 0-100
  ai: number; // 0-100
  paste: number; // 0-100
  editing: number; // 0-100
  suspicious: number; // 0-100
  confidence: number; // 0-100
  verdict: "Human" | "Likely Human" | "Mixed" | "Likely AI" | "AI / Pasted";
}

export interface ContentAnalysis {
  grammarConsistency: number;
  sentenceComplexity: number;
  vocabularyDiversity: number;
  repetition: number;
  perplexity: number;
  burstiness: number;
  aiPhraseHits: string[];
  predictability: number;
  languageConsistency: number;
  formattingScore: number;
}

export interface Explanation {
  label: string;
  reason: string;
  evidence: string;
  confidence: number;
  behavior: string;
  risk: "low" | "medium" | "high";
}

const AI_PHRASES = [
  "in conclusion",
  "it is important to note",
  "as an ai language model",
  "delve into",
  "in today's world",
  "in the realm of",
  "navigating the",
  "leveraging",
  "furthermore",
  "moreover",
  "on the other hand",
  "it's worth noting",
  "a testament to",
  "tapestry",
  "unwavering",
  "meticulous",
];

/** Compute rolling + summary stats from an event stream. */
export function computeStats(
  events: BehaviorEvent[],
  text: string,
  nowMs: number,
): SessionStats {
  const words = text.trim().length ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;

  const keydowns = events.filter((e) => e.type === "keydown");
  const backspaces = events.filter((e) => e.type === "backspace").length;
  const deletes = events.filter((e) => e.type === "delete").length;
  const pastes = events.filter((e) => e.type === "paste");
  const copies = events.filter((e) => e.type === "copy").length;
  const cursorMoves = events.filter((e) => e.type === "cursor").length;
  const selections = events.filter((e) => e.type === "selection").length;

  const firstKey = events.find((e) => e.type === "keydown" || e.type === "paste");
  const timeToFirstKeystrokeMs = firstKey ? firstKey.t : null;

  // Keystroke intervals
  const intervals: number[] = [];
  for (let i = 1; i < keydowns.length; i++) {
    intervals.push(keydowns[i].t - keydowns[i - 1].t);
  }
  const sortedIntervals = [...intervals].sort((a, b) => a - b);
  const medianInterval =
    sortedIntervals.length > 0
      ? sortedIntervals[Math.floor(sortedIntervals.length / 2)]
      : 0;

  // Pauses (>1200ms gaps between keystrokes)
  const pauseGaps = intervals.filter((i) => i > 1200);
  const longestPause = pauseGaps.length ? Math.max(...pauseGaps) : 0;
  const avgPause = pauseGaps.length
    ? pauseGaps.reduce((a, b) => a + b, 0) / pauseGaps.length
    : 0;

  // WPM — rolling per 5s window peak
  const sessionMs = nowMs;
  const writingMs = Math.max(1, sessionMs - (timeToFirstKeystrokeMs ?? 0));
  const avgWpm = writingMs > 0 ? (words / (writingMs / 60000)) : 0;

  let peakWpm = 0;
  const windowMs = 5000;
  for (let start = 0; start < sessionMs; start += 1000) {
    const inWin = keydowns.filter((k) => k.t >= start && k.t < start + windowMs).length;
    // ~5 chars per word
    const wpm = (inWin / 5) * (60000 / windowMs);
    if (wpm > peakWpm) peakWpm = wpm;
  }

  const pasteChars = pastes.reduce(
    (sum, p) => sum + (Number(p.meta?.size) || 0),
    0,
  );
  const largestPaste = pastes.reduce(
    (m, p) => Math.max(m, Number(p.meta?.size) || 0),
    0,
  );

  return {
    totalChars: chars,
    totalWords: words,
    sessionMs,
    writingMs,
    timeToFirstKeystrokeMs,
    keystrokes: keydowns.length,
    backspaces,
    deletes,
    edits: backspaces + deletes,
    pastes: pastes.length,
    pasteChars,
    largestPasteChars: largestPaste,
    copies,
    cursorMoves,
    selections,
    pauses: pauseGaps.length,
    longestPauseMs: longestPause,
    avgPauseMs: avgPause,
    avgWpm,
    peakWpm,
    keystrokeIntervalMs: medianInterval,
  };
}

/** Analyze the finished text (heuristic — no ML model, runs offline). */
export function analyzeContent(text: string): ContentAnalysis {
  const clean = text.trim();
  if (!clean) {
    return {
      grammarConsistency: 0,
      sentenceComplexity: 0,
      vocabularyDiversity: 0,
      repetition: 0,
      perplexity: 0,
      burstiness: 0,
      aiPhraseHits: [],
      predictability: 0,
      languageConsistency: 0,
      formattingScore: 0,
    };
  }
  const sentences = clean.split(/[.!?]+\s/).filter((s) => s.trim().length > 0);
  const words = clean.toLowerCase().match(/[a-z']+/g) ?? [];
  const unique = new Set(words);
  const vocabularyDiversity = words.length ? unique.size / words.length : 0;

  const sentenceLengths = sentences.map((s) => s.split(/\s+/).length);
  const meanLen =
    sentenceLengths.reduce((a, b) => a + b, 0) / (sentenceLengths.length || 1);
  const variance =
    sentenceLengths.reduce((a, b) => a + (b - meanLen) ** 2, 0) /
    (sentenceLengths.length || 1);
  const stdev = Math.sqrt(variance);
  // Burstiness: higher stdev/mean = more human-like
  const burstiness = meanLen ? Math.min(1, stdev / meanLen) : 0;

  const sentenceComplexity = Math.min(1, meanLen / 25);

  // Repetition: proportion of top-3 bigrams
  const bigrams = new Map<string, number>();
  for (let i = 0; i < words.length - 1; i++) {
    const bg = `${words[i]} ${words[i + 1]}`;
    bigrams.set(bg, (bigrams.get(bg) ?? 0) + 1);
  }
  const topBg = [...bigrams.values()].sort((a, b) => b - a).slice(0, 3);
  const repetition = words.length
    ? topBg.reduce((a, b) => a + b, 0) / words.length
    : 0;

  // Perplexity proxy: mix of diversity + sentence variance
  const perplexity = Math.max(
    5,
    Math.min(120, 15 + vocabularyDiversity * 60 + stdev * 4),
  );

  const lower = clean.toLowerCase();
  const aiPhraseHits = AI_PHRASES.filter((p) => lower.includes(p));

  // Predictability inverse to diversity + burstiness
  const predictability = Math.max(
    0,
    Math.min(1, 1 - (vocabularyDiversity * 0.6 + burstiness * 0.4)),
  );

  // Language consistency: proportion of ASCII latin words
  const asciiWords = (clean.match(/\b[a-zA-Z']+\b/g) ?? []).length;
  const allWords = (clean.match(/\S+/g) ?? []).length;
  const languageConsistency = allWords ? asciiWords / allWords : 1;

  // Formatting: presence of markdown-y patterns
  const bullets = (clean.match(/^\s*[-*•]\s/gm) ?? []).length;
  const numbered = (clean.match(/^\s*\d+\.\s/gm) ?? []).length;
  const headers = (clean.match(/^#{1,6}\s/gm) ?? []).length;
  const formattingScore = Math.min(1, (bullets + numbered + headers) / 10);

  // Grammar consistency (heuristic): capital after period, no doubled spaces
  const properCaps = (clean.match(/[.!?]\s+[A-Z]/g) ?? []).length;
  const grammarConsistency = sentences.length
    ? Math.min(1, properCaps / sentences.length)
    : 0.5;

  return {
    grammarConsistency,
    sentenceComplexity,
    vocabularyDiversity,
    repetition,
    perplexity,
    burstiness,
    aiPhraseHits,
    predictability,
    languageConsistency,
    formattingScore,
  };
}

/** Combine behavior + content into scores. */
export function computeScores(
  stats: SessionStats,
  content: ContentAnalysis,
): Scores {
  // Paste probability
  const pasteRatio = stats.totalChars
    ? stats.pasteChars / stats.totalChars
    : 0;
  const paste = Math.round(
    Math.min(
      100,
      pasteRatio * 100 * 0.85 +
        (stats.largestPasteChars > 200 ? 15 : 0) +
        (stats.pastes > 0 && stats.keystrokes < 20 ? 20 : 0),
    ),
  );

  // Editing score — how much revision happened
  const editRatio = stats.keystrokes
    ? stats.edits / stats.keystrokes
    : 0;
  const editing = Math.round(Math.min(100, editRatio * 220));

  // AI probability: high paste, low burstiness, AI phrases, low diversity
  let ai = 0;
  ai += paste * 0.45;
  ai += (1 - content.burstiness) * 25;
  ai += content.aiPhraseHits.length * 6;
  ai += (1 - content.vocabularyDiversity) * 20;
  ai += content.predictability * 15;
  if (stats.timeToFirstKeystrokeMs !== null && stats.timeToFirstKeystrokeMs < 200 && stats.pastes > 0) {
    ai += 10;
  }
  ai = Math.round(Math.max(0, Math.min(100, ai)));

  // Human probability: opposite signals
  let human = 0;
  human += (1 - pasteRatio) * 35;
  human += content.burstiness * 25;
  human += content.vocabularyDiversity * 20;
  human += editing > 5 ? Math.min(15, editing / 5) : 0;
  human += stats.pauses > 0 ? 10 : 0;
  human = Math.round(Math.max(0, Math.min(100, human)));

  // Suspicious behavior: very fast typing, no pauses, huge paste, zero edits with long text
  let suspicious = 0;
  if (stats.peakWpm > 180) suspicious += 30;
  if (stats.pauses === 0 && stats.totalWords > 40) suspicious += 20;
  if (stats.largestPasteChars > 500) suspicious += 25;
  if (stats.edits === 0 && stats.totalWords > 60) suspicious += 15;
  if (stats.keystrokeIntervalMs > 0 && stats.keystrokeIntervalMs < 25) suspicious += 20;
  suspicious = Math.min(100, suspicious);

  // Confidence in the verdict: how much data we have
  const dataPoints =
    stats.keystrokes + stats.pastes * 5 + Math.min(50, stats.totalWords);
  const confidence = Math.round(Math.min(100, (dataPoints / 120) * 100));

  let verdict: Scores["verdict"];
  if (ai >= 75) verdict = "AI / Pasted";
  else if (ai >= 55) verdict = "Likely AI";
  else if (ai >= 35) verdict = "Mixed";
  else if (human >= 55) verdict = "Likely Human";
  else verdict = "Human";

  return { human, ai, paste, editing, suspicious, confidence, verdict };
}

/** Human-readable explanations for the UI. */
export function buildExplanations(
  stats: SessionStats,
  content: ContentAnalysis,
  scores: Scores,
): Explanation[] {
  const out: Explanation[] = [];

  if (scores.paste > 40) {
    out.push({
      label: "High paste ratio",
      reason: "A large share of the final text came from paste events.",
      evidence: `${stats.pastes} paste event(s), ${stats.pasteChars} chars pasted (largest ${stats.largestPasteChars}).`,
      confidence: Math.min(100, scores.paste + 10),
      behavior: "Copy-paste dominant input",
      risk: scores.paste > 70 ? "high" : "medium",
    });
  }

  if (content.aiPhraseHits.length > 0) {
    out.push({
      label: "AI-style phrasing detected",
      reason: "Text contains phrases commonly over-used by language models.",
      evidence: content.aiPhraseHits.slice(0, 5).join(", "),
      confidence: 60 + content.aiPhraseHits.length * 5,
      behavior: "Stylometric fingerprint",
      risk: content.aiPhraseHits.length > 3 ? "high" : "medium",
    });
  }

  if (content.burstiness < 0.3 && stats.totalWords > 30) {
    out.push({
      label: "Low burstiness",
      reason:
        "Sentence lengths are unusually uniform — a common trait of generated text.",
      evidence: `Burstiness score ${(content.burstiness * 100).toFixed(0)}/100`,
      confidence: 70,
      behavior: "Uniform sentence rhythm",
      risk: "medium",
    });
  }

  if (stats.peakWpm > 180) {
    out.push({
      label: "Impossibly fast typing",
      reason: "Peak WPM exceeds sustained human typing speed.",
      evidence: `Peak ${stats.peakWpm.toFixed(0)} WPM`,
      confidence: 80,
      behavior: "Non-human input speed",
      risk: "high",
    });
  }

  if (stats.pauses === 0 && stats.totalWords > 40) {
    out.push({
      label: "No natural pauses",
      reason: "Humans usually pause to think while composing longer text.",
      evidence: `0 pauses across ${stats.totalWords} words`,
      confidence: 55,
      behavior: "Continuous input stream",
      risk: "medium",
    });
  }

  if (stats.edits > 5 && scores.paste < 30) {
    out.push({
      label: "Genuine revision behavior",
      reason: "Multiple corrections suggest live composition.",
      evidence: `${stats.backspaces} backspaces, ${stats.deletes} deletes`,
      confidence: 65,
      behavior: "Iterative editing",
      risk: "low",
    });
  }

  if (out.length === 0) {
    out.push({
      label: "Insufficient signal",
      reason: "Not enough behavior data to draw a strong conclusion.",
      evidence: `${stats.keystrokes} keystrokes, ${stats.totalWords} words`,
      confidence: scores.confidence,
      behavior: "Neutral",
      risk: "low",
    });
  }

  return out;
}

export interface TimelineEntry {
  t: number;
  label: string;
  kind: "start" | "pause" | "paste" | "edit" | "submit" | "info";
}

export function buildTimeline(events: BehaviorEvent[]): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  const first = events.find((e) => e.type === "keydown" || e.type === "paste");
  if (first) out.push({ t: first.t, label: "Started typing", kind: "start" });

  // First pause
  const keys = events.filter((e) => e.type === "keydown");
  for (let i = 1; i < keys.length; i++) {
    if (keys[i].t - keys[i - 1].t > 1500) {
      out.push({
        t: keys[i - 1].t,
        label: `Pause (${((keys[i].t - keys[i - 1].t) / 1000).toFixed(1)}s)`,
        kind: "pause",
      });
      break;
    }
  }

  // Large pastes
  events
    .filter((e) => e.type === "paste" && Number(e.meta?.size) > 100)
    .forEach((p) => {
      out.push({
        t: p.t,
        label: `Large paste (${p.meta?.size} chars)`,
        kind: "paste",
      });
    });

  // Major edit bursts (>=5 backspaces within 2s)
  const bs = events.filter((e) => e.type === "backspace" || e.type === "delete");
  for (let i = 0; i + 5 < bs.length; i++) {
    if (bs[i + 5].t - bs[i].t < 2000) {
      out.push({ t: bs[i].t, label: "Major edit burst", kind: "edit" });
      i += 5;
    }
  }

  const submit = events.find((e) => e.type === "submit");
  if (submit) out.push({ t: submit.t, label: "Analysis run", kind: "submit" });

  return out.sort((a, b) => a.t - b.t);
}

export interface SessionSnapshot {
  id: string;
  createdAt: number;
  textPreview: string;
  stats: SessionStats;
  content: ContentAnalysis;
  scores: Scores;
  timeline: TimelineEntry[];
  explanations: Explanation[];
}
