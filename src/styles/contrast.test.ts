import { describe, expect, it } from "vitest";

// Mirrors the :root colour tokens in ./global.css -- kept as plain constants
// here rather than parsed out of the CSS file, since a WCAG contrast ratio
// only needs the hex values, not a CSS parser. If a token's hex changes in
// global.css, update it here too so this stays a real check on what ships,
// not a check on stale numbers.
const COLOUR_PAPER = "#f7f4ee";
const COLOUR_INK = "#211d1a";
const COLOUR_INK_MUTED = "#5b564d";
const COLOUR_ACCENT = "#5b3a56";

function srgbChannelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  const [rLin, gLin, bLin] = [r, g, b].map(srgbChannelToLinear);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

// WCAG 2.x contrast ratio: (L1 + 0.05) / (L2 + 0.05), lighter over darker.
function contrastRatio(a: string, b: string): number {
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

// Thresholds from WCAG 2.x success criterion 1.4.3 (AA): 4.5:1 for normal
// text, 3:1 for large text (>=18pt / >=14pt bold) and UI components.
const AA_NORMAL_TEXT = 4.5;
const AA_LARGE_TEXT = 3;

describe("design system colour contrast (WCAG AA)", () => {
  it("primary ink on paper clears the normal-text threshold", () => {
    expect(contrastRatio(COLOUR_INK, COLOUR_PAPER)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
  });

  it("muted ink on paper clears the normal-text threshold", () => {
    expect(contrastRatio(COLOUR_INK_MUTED, COLOUR_PAPER)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
  });

  it("accent on paper clears the large-text/UI threshold", () => {
    expect(contrastRatio(COLOUR_ACCENT, COLOUR_PAPER)).toBeGreaterThanOrEqual(
      AA_LARGE_TEXT,
    );
  });
});
