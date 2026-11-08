import { describe, expect, it } from 'vitest';
import {
  chime,
  clank,
  clink,
  crackSound,
  glide,
  makeRandom,
  musicLoop,
  plop,
  shake,
  sizzleLoop,
  splash,
  tok,
  whoosh,
} from './synth.js';

const RATE = 22050;

const SOUNDS: Record<string, () => Float32Array> = {
  sizzle: () => sizzleLoop(RATE),
  crack: () => crackSound(RATE),
  tok: () => tok(RATE, 900),
  clank: () => clank(RATE),
  clink: () => clink(RATE),
  shake: () => shake(RATE),
  plop: () => plop(RATE),
  whoosh: () => whoosh(RATE),
  splash: () => splash(RATE),
  chime: () => chime(RATE, [784, 1175]),
  glide: () => glide(RATE, 660, 440),
  music: () => musicLoop(RATE),
};

function peak(data: Float32Array): number {
  let max = 0;
  for (const value of data) {
    max = Math.max(max, Math.abs(value));
  }
  return max;
}

describe('synth', () => {
  it.each(Object.entries(SOUNDS))(
    '%s is finite, audible and never clips',
    (_name, make) => {
      const data = make();
      expect(data.length).toBeGreaterThan(RATE * 0.1);
      expect(data.every(Number.isFinite)).toBe(true);
      expect(peak(data)).toBeGreaterThan(0.5);
      expect(peak(data)).toBeLessThanOrEqual(1);
    },
  );

  it('makes the same sound on every load', () => {
    expect(crackSound(RATE)).toEqual(crackSound(RATE));
  });

  it('keeps the sizzle loop exactly as long as asked', () => {
    expect(sizzleLoop(RATE, 2).length).toBe(RATE * 2);
  });

  it('loops the music in whole bars', () => {
    const barS = (60 / 84) * 4;
    expect(musicLoop(RATE).length).toBe(Math.round(barS * 4 * RATE));
  });

  it('draws seeded numbers in 0..1', () => {
    const random = makeRandom(3);
    for (let draw = 0; draw < 100; draw += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
