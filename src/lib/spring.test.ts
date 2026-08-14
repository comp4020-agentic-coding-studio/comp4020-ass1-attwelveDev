import { describe, expect, it } from "vitest";
import { springTranslateKeyframes, springValues } from "./spring";

// Analytic damped-harmonic-oscillator sampling — no requestAnimationFrame
// loop, every sample comes straight from the closed-form solution so it can
// be handed to WAAPI's Element.animate() as a fixed keyframe list.

describe("springValues", () => {
  it("starts exactly at `from` and settles very close to `to`", () => {
    const values = springValues(0, 100, { stiffness: 170, damping: 26 });
    expect(values[0]).toBe(0);
    expect(values[values.length - 1]).toBeCloseTo(100, 0);
  });

  it("returns `to` for every sample when from equals to", () => {
    const values = springValues(50, 50, { stiffness: 170, damping: 26 });
    expect(values.every((v) => v === 50)).toBe(true);
  });

  it("overshoots the target when underdamped (low damping ratio)", () => {
    const values = springValues(0, 100, { stiffness: 300, damping: 5 });
    expect(values.some((v) => v > 100)).toBe(true);
  });

  it("never overshoots when overdamped (high damping ratio)", () => {
    const values = springValues(0, 100, { stiffness: 170, damping: 500 });
    expect(values.every((v) => v <= 100 + 1e-6)).toBe(true);
  });

  it("produces duration*fps + 1 samples", () => {
    const values = springValues(
      0,
      10,
      { stiffness: 170, damping: 26 },
      0.5,
      60,
    );
    expect(values).toHaveLength(31);
  });
});

describe("springTranslateKeyframes", () => {
  it("starts at the from point and ends at the to point with offset 1", () => {
    const keyframes = springTranslateKeyframes(
      { x: 0, y: 0 },
      { x: 100, y: 50 },
      { stiffness: 170, damping: 26 },
    );
    expect(keyframes[0].transform).toBe("translate(0px, 0px)");
    expect(keyframes[0].offset).toBe(0);
    const last = keyframes[keyframes.length - 1];
    expect(last.offset).toBe(1);
    expect(last.transform).toMatch(/^translate\(9[0-9](\.\d+)?px, 4[0-9](\.\d+)?px\)$/);
  });
});
