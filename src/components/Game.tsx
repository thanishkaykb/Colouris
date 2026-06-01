import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { hslCss, hslToRgb, randomHsl, similarityHsl, type HSL } from "@/lib/color";
import { sfx } from "@/lib/sound";

type Phase = "memorize" | "recall" | "reveal" | "summary";
type Difficulty = "easy" | "medium" | "hard";

const DIFF: Record<Difficulty, { seconds: number; rounds: number; label: string }> = {
  easy: { seconds: 6, rounds: 5, label: "Easy" },
  medium: { seconds: 4, rounds: 5, label: "Medium" },
  hard: { seconds: 2.5, rounds: 7, label: "Hard" },
};

interface RoundResult { target: HSL; guess: HSL; score: number }

const ease = [0.22, 1, 0.36, 1] as const;

const feedback = (score: number) => {
  if (score >= 9.5) return { title: "Disgustingly accurate.", sub: "It's off-putting." };
  if (score >= 9) return { title: "Frighteningly close.", sub: "Are you a machine?" };
  if (score >= 8) return { title: "Razor sharp.", sub: "Eyes wide open." };
  if (score >= 6.5) return { title: "Pretty good.", sub: "Keep training." };
  if (score >= 5) return { title: "Close-ish.", sub: "The vibe was right." };
  if (score >= 3) return { title: "Not bad.", sub: "Different planet though." };
  return { title: "Bold guess.", sub: "Try squinting next time." };
};

export default function Game({
  onExit, soundOn, difficulty,
}: { onExit: () => void; soundOn: boolean; difficulty: Difficulty }) {
  const cfg = DIFF[difficulty];
  const [phase, setPhase] = useState<Phase>("memorize");
  const [round, setRound] = useState(0);
  // target is set ONCE per round and never mutated after
  const [target, setTarget] = useState<HSL>(() => randomHsl());
  const [guess, setGuess] = useState<HSL>({ h: 180, s: 50, l: 50 });
  const [timeLeft, setTimeLeft] = useState(cfg.seconds);
  const [results, setResults] = useState<RoundResult[]>([]);
  const rafRef = useRef<number | null>(null);

  const play = useCallback((fn: () => void) => { if (soundOn) fn(); }, [soundOn]);

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
    setTarget(randomHsl());
    setGuess({ h: 180, s: 50, l: 50 });
    setTimeLeft(cfg.seconds);
    setPhase("memorize");
  }, [cfg.seconds]);

  const submitGuess = useCallback(() => {
    const score = similarityHsl(target, guess);
    setResults((r) => [...r, { target, guess, score }]);
    setPhase("reveal");
    play(sfx.success);
  }, [target, guess, play]);

  const next = useCallback(() => {
    if (round + 1 >= cfg.rounds) { setPhase("summary"); play(sfx.end); }
    else { setRound((r) => r + 1); startRound(); }
  }, [round, cfg.rounds, startRound, play]);

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
    () => results.length ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length * 100) / 100 : 0,
    [results]
  );

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-[1200px]" style={{ width: "min(92vw, 1200px)" }}>
        {/* exit + sessions */}
        <div className="flex items-center justify-between mb-4 px-2">
          <button onClick={onExit} className="text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition-colors">← Exit</button>
          <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{cfg.label}</span>
        </div>

        <AnimatePresence mode="wait">
          {phase === "memorize" && (
            <MemorizeCard key={`mem-${round}`} target={target} round={round} total={cfg.rounds} timeLeft={timeLeft} />
          )}
          {phase === "recall" && (
            <RecallCard key={`rec-${round}`} guess={guess} setGuess={setGuess} onSubmit={submitGuess} round={round} total={cfg.rounds} />
          )}
          {phase === "reveal" && (
            <RevealCard
              key={`rev-${round}`}
              target={target} guess={guess}
              score={results[results.length - 1]?.score ?? 0}
              onNext={next} isLast={round + 1 >= cfg.rounds}
              round={round} total={cfg.rounds}
            />
          )}
          {phase === "summary" && (
            <Summary key="sum" results={results} avg={avg} onPlayAgain={() => { setRound(0); setResults([]); startRound(); }} onExit={onExit} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------- Shared card shell ----------
function Card({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
      transition={{ duration: 0.55, ease }}
      className="relative w-full rounded-[32px] overflow-hidden"
      style={{
        aspectRatio: "16 / 11",
        minHeight: 420,
        background: bg,
        boxShadow: "0 40px 100px -30px rgba(15,18,30,0.25), 0 12px 40px -12px rgba(15,18,30,0.12)",
      }}
    >
      {children}
    </motion.div>
  );
}

function Brand() {
  return (
    <span className="absolute bottom-4 right-5 sm:bottom-6 sm:right-8 text-[10px] sm:text-xs tracking-[0.2em] text-black/35 select-none">
      Colouris
    </span>
  );
}

function Counter({ round, total }: { round: number; total: number }) {
  return (
    <span className="absolute top-4 left-5 sm:top-6 sm:left-8 text-xs sm:text-sm tabular text-black/45">
      {round + 1}/{total}
    </span>
  );
}

// ---------- Memorize ----------
function MemorizeCard({ target, round, total, timeLeft }: { target: HSL; round: number; total: number; timeLeft: number }) {
  const seconds = Math.ceil(timeLeft);
  return (
    <Card bg={hslCss(target)}>
      <Counter round={round} total={total} />
      <div className="absolute top-4 right-5 sm:top-6 sm:right-8 text-right">
        <motion.div
          key={seconds}
          initial={{ scale: 1.15, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25, ease }}
          className="font-display tabular text-black/85 leading-none"
          style={{ fontSize: "clamp(64px, 14vw, 180px)", letterSpacing: "-0.04em", fontWeight: 700 }}
        >
          {seconds}
        </motion.div>
        <p className="mt-1 text-[11px] sm:text-sm text-black/60 tracking-tight">Seconds to remember</p>
      </div>
      <Brand />
    </Card>
  );
}

// ---------- Recall ----------
function VSlider({
  value, min, max, onChange, gradient, label, thumbBorder = "#fff",
}: {
  value: number; min: number; max: number; onChange: (v: number) => void;
  gradient: string; label: string; thumbBorder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromY = (clientY: number) => {
    const el = ref.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    onChange(Math.round(min + (max - min) * ratio));
  };

  useEffect(() => {
    const move = (e: PointerEvent) => { if (dragging.current) setFromY(e.clientY); };
    const up = () => { dragging.current = false; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    // eslint-disable-next-line
  }, []);

  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="relative h-full flex flex-col items-center" style={{ width: "100%" }}>
      <div
        ref={ref}
        onPointerDown={(e) => { dragging.current = true; setFromY(e.clientY); }}
        className="relative w-full flex-1 rounded-2xl cursor-pointer touch-none"
        style={{ background: gradient, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}
      >
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white"
          style={{
            width: "min(70%, 22px)", height: "min(70%, 22px)",
            top: `calc(${pct}% - min(35%, 11px))`,
            boxShadow: "0 4px 14px rgba(0,0,0,0.25), 0 0 0 2px " + thumbBorder,
          }}
          animate={{ scale: dragging.current ? 1.1 : 1 }}
          transition={{ type: "spring", stiffness: 350, damping: 22 }}
        />
      </div>
      <span className="hidden sm:block mt-3 text-[10px] tracking-[0.3em] text-black/55 uppercase">{label}</span>
    </div>
  );
}

function RecallCard({
  guess, setGuess, onSubmit, round, total,
}: { guess: HSL; setGuess: (v: HSL) => void; onSubmit: () => void; round: number; total: number }) {
  const bg = hslCss(guess);
  // hue spectrum (top→bottom: 0→360)
  const hueGrad = "linear-gradient(to bottom, hsl(0 90% 55%), hsl(60 90% 55%), hsl(120 80% 45%), hsl(180 80% 45%), hsl(240 85% 55%), hsl(300 85% 55%), hsl(360 90% 55%))";
  // saturation: top = full sat (at current hue/lightness), bottom = gray
  const satGrad = `linear-gradient(to bottom, hsl(${guess.h} 100% ${guess.l}%), hsl(${guess.h} 0% ${guess.l}%))`;
  // lightness: top = white, middle = pure hue, bottom = black
  const lightGrad = `linear-gradient(to bottom, #fff, hsl(${guess.h} ${guess.s}% 50%), #000)`;

  return (
    <Card bg={bg}>
      <Counter round={round} total={total} />
      <Brand />

      {/* Sliders panel */}
      <div className="absolute inset-y-6 sm:inset-y-10 left-4 sm:left-8 flex gap-2 sm:gap-4" style={{ width: "min(38%, 220px)" }}>
        <div className="flex-1 flex flex-col">
          <VSlider value={guess.h} min={0} max={360} onChange={(h) => setGuess({ ...guess, h })} gradient={hueGrad} label="Hue" />
        </div>
        <div className="flex-1 flex flex-col">
          <VSlider value={100 - guess.s} min={0} max={100} onChange={(v) => setGuess({ ...guess, s: 100 - v })} gradient={satGrad} label="Saturation" />
        </div>
        <div className="flex-1 flex flex-col">
          <VSlider value={100 - guess.l} min={0} max={100} onChange={(v) => setGuess({ ...guess, l: 100 - v })} gradient={lightGrad} label="Lightness" />
        </div>
      </div>

      {/* Floating submit */}
      <motion.button
        whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.92 }}
        onClick={onSubmit}
        aria-label="Lock in"
        className="absolute bottom-5 right-5 sm:bottom-8 sm:right-8 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white text-black inline-flex items-center justify-center shadow-[0_10px_30px_-8px_rgba(0,0,0,0.35)]"
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" />
        </svg>
      </motion.button>
    </Card>
  );
}

// ---------- Reveal ----------
function fmtHsl(c: HSL) { return `H${Math.round(c.h)} S${Math.round(c.s)} B${Math.round(c.l)}`; }

function RevealCard({
  target, guess, score, onNext, isLast, round, total,
}: { target: HSL; guess: HSL; score: number; onNext: () => void; isLast: boolean; round: number; total: number }) {
  const fb = feedback(score);
  return (
    <Card bg="transparent">
      {/* Top — user selection */}
      <div className="absolute inset-x-0 top-0 h-1/2 px-5 sm:px-10 py-6 sm:py-8" style={{ background: hslCss(guess) }}>
        <Counter round={round} total={total} />
        <div className="absolute left-5 sm:left-10 bottom-4 sm:bottom-6 text-[10px] sm:text-xs">
          <p className="text-black/55 uppercase tracking-[0.2em]">Your selection</p>
          <p className="text-black/75 tabular mt-1">{fmtHsl(guess)}</p>
        </div>
        <div className="absolute right-5 sm:right-10 top-6 sm:top-8 text-right max-w-[70%]">
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="font-display tabular text-black/85 leading-none"
            style={{ fontSize: "clamp(56px, 12vw, 150px)", letterSpacing: "-0.04em", fontWeight: 700 }}
          >
            {score.toFixed(2)}
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.6 }}
            className="mt-2 sm:mt-3 font-display text-black/80 leading-tight"
            style={{ fontSize: "clamp(18px, 2.4vw, 32px)", fontWeight: 600 }}
          >
            {fb.title}<br />{fb.sub}
          </motion.p>
        </div>
      </div>

      {/* Bottom — original (fixed, unchanged) */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 px-5 sm:px-10 py-6 sm:py-8" style={{ background: hslCss(target) }}>
        <div className="absolute left-5 sm:left-10 bottom-12 sm:bottom-14 text-[10px] sm:text-xs">
          <p className="text-black/55 uppercase tracking-[0.2em]">Original</p>
          <p className="text-black/75 tabular mt-1">{fmtHsl(target)}</p>
        </div>
        <Brand />
        <motion.button
          whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.92 }}
          onClick={onNext} aria-label="Next"
          className="absolute bottom-5 right-5 sm:bottom-8 sm:right-8 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white text-black inline-flex items-center justify-center shadow-[0_10px_30px_-8px_rgba(0,0,0,0.35)]"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="M13 6l6 6-6 6" />
          </svg>
        </motion.button>
      </div>

      {/* Hairline divider */}
      <div className="absolute inset-x-0 top-1/2 h-px bg-black/10" />
    </Card>
  );
}

// ---------- Summary ----------
function Summary({ results, avg, onPlayAgain, onExit }: { results: { target: HSL; guess: HSL; score: number }[]; avg: number; onPlayAgain: () => void; onExit: () => void }) {
  const best = Math.max(...results.map(r => r.score));
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
      transition={{ duration: 0.6, ease }}
      className="w-full rounded-[32px] bg-card p-8 sm:p-14 text-center"
      style={{ boxShadow: "0 40px 100px -30px rgba(15,18,30,0.25), 0 12px 40px -12px rgba(15,18,30,0.12)" }}
    >
      <p className="text-[10px] sm:text-xs uppercase tracking-[0.35em] text-muted-foreground">Session complete</p>
      <motion.h1
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7, ease }}
        className="font-display mt-4 tabular leading-none"
        style={{ fontSize: "clamp(72px, 14vw, 180px)", letterSpacing: "-0.04em", fontWeight: 700 }}
      >{avg.toFixed(2)}</motion.h1>
      <p className="mt-2 text-muted-foreground text-sm sm:text-base">average accuracy across {results.length} rounds</p>

      <div className="mt-10 grid grid-cols-3 gap-3 sm:gap-4 max-w-md mx-auto">
        <Stat label="Best" value={best.toFixed(2)} />
        <Stat label="Average" value={avg.toFixed(2)} />
        <Stat label="Rounds" value={String(results.length)} />
      </div>

      <div className="mt-8 flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
        {results.map((r, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="flex gap-1">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md" style={{ background: hslCss(r.target), boxShadow: "var(--shadow-soft)" }} />
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md" style={{ background: hslCss(r.guess), boxShadow: "var(--shadow-soft)" }} />
            </div>
            <span className="tabular text-[10px] sm:text-xs text-muted-foreground">{r.score.toFixed(1)}</span>
          </div>
        ))}
      </div>

      <div className="mt-10 flex items-center justify-center gap-3">
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={onPlayAgain}
          className="rounded-full bg-foreground text-background px-6 py-3 text-sm font-medium">Play again</motion.button>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={onExit}
          className="rounded-full border border-foreground/15 px-6 py-3 text-sm font-medium">Home</motion.button>
      </div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-foreground/[0.04] p-4 sm:p-5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="font-display text-2xl sm:text-3xl mt-1 tabular">{value}</p>
    </div>
  );
}

// re-export for compatibility
export { hslToRgb };
