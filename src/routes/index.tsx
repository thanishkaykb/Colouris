import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Game from "@/components/Game";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Colouris — Visual Memory Training" },
      { name: "description", content: "A premium visual memory and color perception game. Train your eye." },
      { property: "og:title", content: "Colouris — Visual Memory Training" },
      { property: "og:description", content: "Train your color memory with cinematic, minimal challenges." },
    ],
  }),
  component: Index,
});

type Difficulty = "easy" | "medium" | "hard";
const ease = [0.22, 1, 0.36, 1] as const;

function Index() {
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState(true);
  const [dark, setDark] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [sessionKey, setSessionKey] = useState(0);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!playing && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        setPlaying(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing]);

  return (
    <div className="min-h-screen w-full">
      {/* Floating top controls */}
      <div className="fixed top-5 right-5 z-50 flex items-center gap-2">
        <Toggle active={sound} onClick={() => setSound((s) => !s)} label={sound ? "Sound on" : "Muted"} />
        <Toggle active={dark} onClick={() => setDark((d) => !d)} label={dark ? "Dark" : "Light"} />
      </div>

      <AnimatePresence mode="wait">
        {!playing ? (
          <motion.div
            key="home"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease }}
            className="min-h-screen flex items-center justify-center px-6"
          >
            <div className="w-full max-w-3xl text-center">
              <motion.p
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6, ease }}
                className="text-xs uppercase tracking-[0.35em] text-muted-foreground"
              >Colouris · Visual Memory</motion.p>

              <motion.h1
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8, ease }}
                className="font-display text-6xl sm:text-8xl lg:text-9xl mt-6 leading-[0.95]"
              >
                Train your eye for <em className="text-[color:var(--magenta)]">color</em>.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6, ease }}
                className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto"
              >
                Memorize a color. Recreate it from memory. A cinematic, minute-long cognitive challenge.
              </motion.p>

              {/* Difficulty pill */}
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.6, ease }}
                className="mt-10 inline-flex p-1.5 rounded-full glass"
              >
                {(["easy","medium","hard"] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`relative px-5 py-2 text-sm rounded-full transition-colors ${difficulty === d ? "text-background" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {difficulty === d && (
                      <motion.span layoutId="diff-pill" className="absolute inset-0 rounded-full bg-foreground" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
                    )}
                    <span className="relative capitalize">{d}</span>
                  </button>
                ))}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.6, ease }}
                className="mt-8 flex items-center justify-center"
              >
                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={() => { setSessionKey((k) => k + 1); setPlaying(true); }}
                  className="group inline-flex items-center gap-4 rounded-full pl-7 pr-2 py-2 bg-foreground text-background shadow-[0_20px_50px_-20px_rgba(0,0,0,0.4)]"
                >
                  <span className="text-base font-medium">Begin session</span>
                  <span className="w-14 h-14 rounded-full bg-background text-foreground inline-flex items-center justify-center text-xl group-hover:translate-x-0.5 transition-transform duration-300">→</span>
                </motion.button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.8 }}
                className="mt-14 grid grid-cols-3 gap-3 max-w-md mx-auto"
              >
                {["var(--olive)","var(--magenta)","var(--royal)","var(--coral)","var(--lavender)","#1a1a1a"].slice(0,6).map((c, i) => (
                  <motion.div
                    key={i}
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
                    className="h-16 rounded-2xl"
                    style={{ background: c, boxShadow: "var(--shadow-soft)" }}
                  />
                ))}
              </motion.div>

              <p className="mt-10 text-xs text-muted-foreground">Press <kbd className="px-1.5 py-0.5 rounded bg-foreground/10">Enter</kbd> to start</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`game-${sessionKey}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease }}
          >
            <Game onExit={() => setPlaying(false)} soundOn={sound} difficulty={difficulty} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Toggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="glass rounded-full px-3.5 py-1.5 text-xs font-medium hover:scale-[1.03] active:scale-95 transition-transform"
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-2 ${active ? "bg-[color:var(--olive)]" : "bg-foreground/30"}`} />
      {label}
    </button>
  );
}
