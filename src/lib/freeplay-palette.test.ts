import { describe, expect, it } from "vitest";
import { FREEPLAY_MAX_CANDIDATES, FREEPLAY_MIN_CANDIDATES, FREEPLAY_PALETTE } from "./freeplay-palette";

// Free play's soft cap (PLAN.md: "~6 candidates ... because the
// colourblind-safe palette runs out of clearly distinct colours beyond
// that") is defined by this palette's length, not an arbitrary number
// declared separately -- so these two can never drift apart.

describe("FREEPLAY_PALETTE", () => {
  it("has exactly six colourblind-safe id/colour/shape entries", () => {
    expect(FREEPLAY_PALETTE).toHaveLength(6);
    expect(FREEPLAY_MAX_CANDIDATES).toBe(6);
  });

  it("gives every entry a distinct id, label, colour, and shape", () => {
    const ids = FREEPLAY_PALETTE.map((e) => e.id);
    const labels = FREEPLAY_PALETTE.map((e) => e.label);
    const colours = FREEPLAY_PALETTE.map((e) => e.colour);
    const shapes = FREEPLAY_PALETTE.map((e) => e.shape);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(colours).size).toBe(colours.length);
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it("sets a minimum of two candidates below the palette size", () => {
    expect(FREEPLAY_MIN_CANDIDATES).toBeGreaterThanOrEqual(2);
    expect(FREEPLAY_MIN_CANDIDATES).toBeLessThan(FREEPLAY_MAX_CANDIDATES);
  });
});
