export interface SpringOptions {
  stiffness: number;
  damping: number;
  mass?: number;
}

// Displacement from the target at time t, for a damped harmonic oscillator
// released from rest (u(0) = u0, u'(0) = 0). Closed-form, so the whole
// animation can be sampled analytically instead of stepping a physics loop.
function displacementAt(
  t: number,
  u0: number,
  omega0: number,
  zeta: number,
): number {
  if (zeta < 1) {
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    return (
      Math.exp(-zeta * omega0 * t) *
      (u0 * Math.cos(omegaD * t) +
        ((zeta * omega0 * u0) / omegaD) * Math.sin(omegaD * t))
    );
  }
  if (zeta === 1) {
    return u0 * (1 + omega0 * t) * Math.exp(-omega0 * t);
  }
  const s = omega0 * Math.sqrt(zeta * zeta - 1);
  const r1 = -omega0 * zeta + s;
  const r2 = -omega0 * zeta - s;
  const a = (u0 * r2) / (r2 - r1);
  const b = u0 - a;
  return a * Math.exp(r1 * t) + b * Math.exp(r2 * t);
}

// Analytically samples a damped harmonic oscillator settling from `from` to
// `to` over `duration` seconds, `fps` samples per second — one value per
// frame, ready to hand to WAAPI as a keyframe list.
export function springValues(
  from: number,
  to: number,
  { stiffness, damping, mass = 1 }: SpringOptions,
  duration = 0.6,
  fps = 60,
): number[] {
  const frameCount = Math.max(1, Math.round(duration * fps));
  const u0 = from - to;
  if (u0 === 0) return Array.from({ length: frameCount + 1 }, () => to);

  const omega0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));

  const values: number[] = [];
  for (let i = 0; i <= frameCount; i++) {
    const t = (i / frameCount) * duration;
    values.push(to + displacementAt(t, u0, omega0, zeta));
  }
  return values;
}

export function springTranslateKeyframes(
  from: { x: number; y: number },
  to: { x: number; y: number },
  options: SpringOptions,
  duration = 0.6,
  fps = 60,
): Keyframe[] {
  const xs = springValues(from.x, to.x, options, duration, fps);
  const ys = springValues(from.y, to.y, options, duration, fps);
  return xs.map((x, i) => ({
    transform: `translate(${x}px, ${ys[i]}px)`,
    offset: i / (xs.length - 1),
  }));
}

export interface BoxState {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Same analytic sampling as springTranslateKeyframes, plus width/height so a
// chip can spring-morph its own shape (not just position) over the same
// flight — the position and size settle together, driven by the same spring
// options. Colour/border aren't sampled here; callers layer those onto the
// first/last keyframe and let WAAPI interpolate them natively.
export function springBoxKeyframes(
  from: BoxState,
  to: BoxState,
  options: SpringOptions,
  duration = 0.6,
  fps = 60,
): Keyframe[] {
  const xs = springValues(from.x, to.x, options, duration, fps);
  const ys = springValues(from.y, to.y, options, duration, fps);
  const widths = springValues(from.width, to.width, options, duration, fps);
  const heights = springValues(from.height, to.height, options, duration, fps);
  return xs.map((x, i) => ({
    transform: `translate(${x}px, ${ys[i]}px)`,
    width: `${widths[i]}px`,
    height: `${heights[i]}px`,
    offset: i / (xs.length - 1),
  }));
}
