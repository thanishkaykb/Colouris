// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// When deploying to Vercel, Vercel sets the `VERCEL` env var at build time.
// Force Nitro to emit Vercel Build Output API files in `.vercel/output`.
// The Lovable config wrapper has Cloudflare-oriented output defaults, so the
// Vercel output paths must be explicit instead of relying on the preset alone.
const isVercel = !!process.env.VERCEL;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
  ...(isVercel
    ? {
        nitro: {
          preset: "vercel",
          output: {
            dir: ".vercel/output",
            serverDir: ".vercel/output/functions/__server.func",
            publicDir: ".vercel/output/static",
          },
          vercel: {
            functions: {
              runtime: "nodejs22.x",
            },
          },
        },
      }
    : {}),
});
