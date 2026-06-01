export type RGB = { r: number; g: number; b: number };
export type HSL = { h: number; s: number; l: number };

export const rgbToHex = ({ r, g, b }: RGB) =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();

export const hexToRgb = (hex: string): RGB => {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
};

export const hslToRgb = ({ h, s, l }: HSL): RGB => {
  const S = s / 100, L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return {
    r: Math.round(f(0) * 255),
    g: Math.round(f(8) * 255),
    b: Math.round(f(4) * 255),
  };
};

export const hslCss = ({ h, s, l }: HSL) => `hsl(${h} ${s}% ${l}%)`;

export const randomHsl = (): HSL => ({
  h: Math.floor(Math.random() * 360),
  s: 30 + Math.floor(Math.random() * 55),
  l: 35 + Math.floor(Math.random() * 35),
});

// similarity 0-10 (one decimal) — closer to 10 = perfect match
export const similarityHsl = (a: HSL, b: HSL) => {
  // hue is circular
  let dh = Math.abs(a.h - b.h);
  if (dh > 180) dh = 360 - dh;
  const ds = Math.abs(a.s - b.s);
  const dl = Math.abs(a.l - b.l);
  // weighted normalized distance (0..1)
  const d = Math.sqrt(((dh / 180) ** 2) * 0.5 + ((ds / 100) ** 2) * 0.25 + ((dl / 100) ** 2) * 0.25);
  const score = Math.max(0, Math.min(10, (1 - d) * 10));
  return Math.round(score * 100) / 100;
};
