export type RGB = { r: number; g: number; b: number };

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

export const randomColor = (): RGB => ({
  r: Math.floor(Math.random() * 256),
  g: Math.floor(Math.random() * 256),
  b: Math.floor(Math.random() * 256),
});

// similarity 0-100 based on euclidean distance in RGB
export const similarity = (a: RGB, b: RGB) => {
  const d = Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
  const max = Math.sqrt(3 * 255 * 255);
  return Math.max(0, Math.round((1 - d / max) * 100));
};

export const PALETTE_NAMES: Record<string, string> = {};
