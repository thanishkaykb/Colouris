import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { hexToRgb, randomColor, rgbToHex, similarity, type RGB } from "@/lib/color";
import { sfx } from "@/lib/sound";

type Phase = "intro" | "memorize" | "recall" | "reveal" | "summary";
type Difficulty = "easy" | "medium" | "hard";

const DIFF: Record<Difficulty, { seconds: number; rounds: number; label: string }> = {
  easy: { seconds: 6, rounds: 5, label: "Easy" },
  medium: { seconds: 4, rounds: 5, label: "Medium" },
  hard: { seconds: 2.5, rounds: 7, label: "Hard" },
};

interface RoundResult { target: RGB; guess: RGB; score: number }

const ease = [0.22, 1, 0.36, 1] as const;

export default function Game({
  onExit,
  soundOn,
  difficulty,
}: { onExit: () => void; soundOn: boolean; difficulty: Difficulty }) {
  const cfg = DIFF[difficulty];
  const [phase, setPhase] = useState<Phase>("intro");
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState<RGB>(randomColor());
  const [guess, setGuess] = useState<RGB>({ r: 128, g: 128, b: 128 });
  const [timeLeft, setTimeLeft] = useState(cfg.seconds);
  const [results, setResults] = useState<RoundResult[]>([]);
  const rafRef = useRef<number | null>(null);

  const play = useCallback((fn: () => void) => { if (soundOn) fn(); }, [soundOn]);

  // Countdown loop using rAF for smoothness
  useEffect(() => {
    if (phase !== "memorize") return;
    const start = performance.now();
    const total = cfg.seconds * 1000;
    let lastSec = Math.ceil(cfg.seconds);
    const tick = (t: number) => {
      const remain = Math.max(0, total - (t - start));
      setTimeLeft(remain / 1000);
      const s = Math.ceil(remain / 1000);
      if (s !== lastSec && s > 0) { lastSec = s; play(sfx.tick); }
      if (remain <= 0) { setPhase("recall"); play(sfx.click); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [phase, cfg.seconds, play]);

  const startRound = useCallback(() => {
    const c = randomColor();
    setTarget(c);
    setGuess({ r: 128, g: 128, b: 128 });
    setTimeLeft(cfg.seconds);
    setPhase("memorize");
  }, [cfg.seconds]);

  // start first round on mount
  useEffect(() => { startRound(); /* eslint-disable-next-line */ }, []);

  const submitGuess = useCallback(() => {
    const score = similarity(target, guess);
    setResults((r) => [...r, { target, guess, score }]);
    setPhase("reveal");
    play(sfx.success);
  }, [target, guess, play]);

  const next = useCallback(() => {
    if (round + 1 >= cfg.rounds) {
      setPhase("summary");
      play(sfx.end);
    } else {
      setRound((r) => r + 1);
      startRound();
    }
  }, [round, cfg.rounds, startRound, play]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (phase === "recall") submitGuess();
        else if (phase === "reveal") next();
        else if (phase === "summary") onExit();
      } else if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, submitGuess, next, onExit]);

  const avg = useMemo(
    () => results.length ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0,
    [results]
  );
  const progress = ((round + (phase === "reveal" || phase === "summary" ? 1 : 0)) / cfg.rounds) * 100;
  const timerColor = timeLeft < 1.2 ? "var(--coral)" : "currentColor";

  return (
    <div className="min-h-screen w-full flex flex-col">
      {/* Top bar */}
      <header className="px-6 sm:px-10 pt-6 flex items-center justify-between gap-4">
        <button onClick={onExit} className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Exit</button>
        <div className="flex-1 mx-6 max-w-xl">
          <div className="h-1.5 w-full rounded-full bg-foreground/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-foreground"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease }}
            />
          </div>
        </div>
        <div className="text-sm tabular text-muted-foreground">
          Round <span className="text-foreground font-medium">{Math.min(round + 1, cfg.rounds)}</span> / {cfg.rounds}
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <AnimatePresence mode="wait">
          {phase === "memorize" && (
            <motion.div
              key={`mem-${round}`}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
              transition={{ duration: 0.55, ease }}
              className="relative w-full max-w-5xl aspect-[16/10] rounded-[40px] overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${rgbToHex(target)}, color-mix(in oklab, ${rgbToHex(target)} 70%, white))`,
                boxShadow: "var(--shadow-float)",
              }}
            >
              <div className="absolute inset-0 p-8 sm:p-12 flex flex-col justify-between text-white mix-blend-difference">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] opacity-80">Seconds to remember</p>
                    <p className="font-display text-3xl sm:text-4xl mt-1">Memorize this color</p>
                  </div>
                  <motion.div
                    key={Math.ceil(timeLeft)}
                    initial={{ scale: 1.2, opacity: 0.6 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3, ease }}
                    className="font-display tabular text-7xl sm:text-9xl leading-none"
                    style={{ color: timerColor }}
                  >
                    {Math.ceil(timeLeft)}
                  </motion.div>
                </div>
                <div className="flex items-end justify-between">
                  <p className="font-display text-5xl sm:text-7xl tabular">{rgbToHex(target)}</p>
                  <p className="text-sm opacity-80 tabular">rgb({target.r}, {target.g}, {target.b})</p>
                </div>
              </div>
              {/* floating orbs */}
              <motion.div
                aria-hidden
                className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-30 blur-3xl"
                style={{ background: "white" }}
                animate={{ y: [0, 20, 0], x: [0, -10, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
          )}

          {phase === "recall" && (
            <RecallCard key={`rec-${round}`} guess={guess} setGuess={setGuess} onSubmit={submitGuess} />
          )}

          {phase === "reveal" && (
            <RevealCard
              key={`rev-${round}`}
              target={target}
              guess={guess}
              score={results[results.length - 1]?.score ?? 0}
              onNext={next}
              isLast={round + 1 >= cfg.rounds}
            />
          )}

          {phase === "summary" && (
            <Summary key="sum" results={results} avg={avg} onPlayAgain={() => { setRound(0); setResults([]); startRound(); }} onExit={onExit} />
          )}
        </AnimatePresence>
      </main>

      <footer className="px-6 sm:px-10 pb-6 text-xs text-muted-foreground tabular text-center">
        {cfg.label} · press <kbd className="px-1.5 py-0.5 rounded bg-foreground/10">Enter</kbd> to continue · <kbd className="px-1.5 py-0.5 rounded bg-foreground/10">Esc</kbd> to exit
      </footer>
    </div>
  );
}

function Slider({ label, value, onChange, accent }: { label: string; value: number; onChange: (v: number) => void; accent: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
        <span className="tabular text-sm font-medium">{value}</span>
      </div>
      <input
        type="range" min={0} max={255} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 appearance-none rounded-full cursor-pointer accent-foreground"
        style={{ background: `linear-gradient(to right, ${accent} ${(value/255)*100}%, color-mix(in oklab, currentColor 10%, transparent) ${(value/255)*100}%)` }}
      />
    </div>
  );
}

function RecallCard({ guess, setGuess, onSubmit }: { guess: RGB; setGuess: (v: RGB) => void; onSubmit: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
      transition={{ duration: 0.55, ease }}
      className="w-full max-w-5xl rounded-[40px] glass p-8 sm:p-12"
      style={{ boxShadow: "var(--shadow-float)" }}
    >
      <div className="grid md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Recall</p>
          <h2 className="font-display text-4xl sm:text-6xl mt-2 leading-tight">Recreate the color you saw</h2>
          <p className="mt-4 text-muted-foreground">Move each channel until it matches what you remember. Trust your eye.</p>
          <motion.div
            className="mt-8 h-40 rounded-3xl"
            animate={{ background: rgbToHex(guess) }}
            transition={{ duration: 0.2 }}
            style={{ boxShadow: "var(--shadow-soft)" }}
          />
          <p className="mt-3 tabular text-sm text-muted-foreground">{rgbToHex(guess)} · rgb({guess.r}, {guess.g}, {guess.b})</p>
        </div>
        <div className="space-y-6">
          <Slider label="Red" value={guess.r} onChange={(v) => setGuess({ ...guess, r: v })} accent="#ef4444" />
          <Slider label="Green" value={guess.g} onChange={(v) => setGuess({ ...guess, g: v })} accent="#22c55e" />
          <Slider label="Blue" value={guess.b} onChange={(v) => setGuess({ ...guess, b: v })} accent="#3b82f6" />
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={onSubmit}
            className="mt-4 w-full inline-flex items-center justify-center gap-3 rounded-full bg-primary text-primary-foreground px-6 py-4 text-base font-medium"
          >
            Lock in answer
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary-foreground/15">→</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function RevealCard({ target, guess, score, onNext, isLast }: { target: RGB; guess: RGB; score: number; onNext: () => void; isLast: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
      transition={{ duration: 0.55, ease }}
      className="w-full max-w-5xl rounded-[40px] glass p-8 sm:p-12"
      style={{ boxShadow: "var(--shadow-float)" }}
    >
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Result</p>
          <h2 className="font-display text-4xl sm:text-5xl mt-2">Your color, side by side</h2>
        </div>
        <ScoreMeter score={score} />
      </div>
      <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6">
        <Swatch label="Your Selection" color={guess} delay={0} />
        <Swatch label="Original" color={target} delay={0.15} />
      </div>
      <div className="mt-10 flex justify-end">
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={onNext}
          className="group inline-flex items-center gap-4 rounded-full pl-6 pr-2 py-2 bg-foreground text-background"
        >
          <span className="text-sm font-medium">{isLast ? "See summary" : "Next round"}</span>
          <span className="w-12 h-12 rounded-full bg-background text-foreground inline-flex items-center justify-center text-lg group-hover:rotate-45 transition-transform duration-300">→</span>
        </motion.button>
      </div>
    </motion.div>
  );
}

function Swatch({ label, color, delay }: { label: string; color: RGB; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease }}
      className="rounded-3xl overflow-hidden"
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      <div className="aspect-[4/3]" style={{ background: rgbToHex(color) }} />
      <div className="p-4 bg-card flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
        <span className="tabular text-sm font-medium">{rgbToHex(color)}</span>
      </div>
    </motion.div>
  );
}

function ScoreMeter({ score }: { score: number }) {
  const color = score >= 90 ? "var(--olive)" : score >= 70 ? "var(--royal)" : score >= 50 ? "var(--coral)" : "var(--magenta)";
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="2.5" />
          <motion.circle
            cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"
            initial={{ strokeDasharray: "0 100" }}
            animate={{ strokeDasharray: `${score} 100` }}
            transition={{ duration: 1.2, ease }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-display text-2xl tabular">{score}</div>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Similarity</p>
        <p className="font-display text-2xl">{score >= 90 ? "Exceptional" : score >= 70 ? "Sharp eye" : score >= 50 ? "Close" : "Keep training"}</p>
      </div>
    </div>
  );
}

function Summary({ results, avg, onPlayAgain, onExit }: { results: RoundResult[]; avg: number; onPlayAgain: () => void; onExit: () => void }) {
  const best = Math.max(...results.map(r => r.score));
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
      transition={{ duration: 0.6, ease }}
      className="w-full max-w-3xl rounded-[40px] glass p-10 sm:p-14 text-center"
      style={{ boxShadow: "var(--shadow-float)" }}
    >
      <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Session complete</p>
      <motion.h1
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7, ease }}
        className="font-display text-7xl sm:text-9xl mt-4 tabular"
      >{avg}</motion.h1>
      <p className="mt-2 text-muted-foreground">average similarity across {results.length} rounds</p>

      <div className="mt-10 grid grid-cols-3 gap-3 sm:gap-4">
        <Stat label="Best" value={best} />
        <Stat label="Average" value={avg} />
        <Stat label="Rounds" value={results.length} />
      </div>

      <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
        {results.map((r, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="flex gap-1">
              <div className="w-6 h-6 rounded-md" style={{ background: rgbToHex(r.target), boxShadow: "var(--shadow-soft)" }} />
              <div className="w-6 h-6 rounded-md" style={{ background: rgbToHex(r.guess), boxShadow: "var(--shadow-soft)" }} />
            </div>
            <span className="tabular text-xs text-muted-foreground">{r.score}</span>
          </div>
        ))}
      </div>

      <div className="mt-10 flex items-center justify-center gap-3">
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={onPlayAgain}
          className="rounded-full bg-primary text-primary-foreground px-6 py-3 font-medium">Play again</motion.button>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={onExit}
          className="rounded-full border border-foreground/15 px-6 py-3 font-medium">Home</motion.button>
      </div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-foreground/[0.04] p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="font-display text-3xl mt-1 tabular">{value}</p>
    </div>
  );
}

// silence unused import in some builds
export { hexToRgb };
