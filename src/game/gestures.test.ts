import { describe, expect, it } from 'vitest';
import {
  CrackDetector,
  FlickDetector,
  PourTimer,
  TipCounter,
  WhiskTracker,
} from './gestures.js';

const PULL_M = 0.08;

describe('CrackDetector', () => {
  it('cracks after both hands pinch near the egg and pull apart', () => {
    const crack = new CrackDetector();
    expect(crack.update(true, true, 0.1, PULL_M)).toBe(false);
    expect(crack.update(true, false, 0.15, PULL_M)).toBe(false);
    expect(crack.update(true, false, 0.19, PULL_M)).toBe(true);
  });

  it('ignores pulling that starts away from the egg', () => {
    const crack = new CrackDetector();
    expect(crack.update(true, false, 0.1, PULL_M)).toBe(false);
    expect(crack.update(true, false, 0.3, PULL_M)).toBe(false);
  });

  it('starts over when a hand lets go', () => {
    const crack = new CrackDetector();
    crack.update(true, true, 0.1, PULL_M);
    crack.update(false, true, 0.15, PULL_M);
    expect(crack.update(true, true, 0.17, PULL_M)).toBe(false);
  });
});

describe('WhiskTracker', () => {
  const circle = (tracker: WhiskTracker, turns: number, direction = 1) => {
    const samples = Math.round(turns * 24);
    for (let index = 0; index <= samples; index += 1) {
      const angle = (direction * index * Math.PI * 2) / 24;
      tracker.update(
        Math.cos(angle) * 0.05,
        Math.sin(angle) * 0.05,
        true,
        0.015,
        1,
      );
    }
  };

  it('counts full turns in either direction', () => {
    const forward = new WhiskTracker();
    circle(forward, 3);
    expect(forward.turns).toBeCloseTo(3, 1);
    const backward = new WhiskTracker();
    circle(backward, 2, -1);
    expect(backward.turns).toBeCloseTo(2, 1);
  });

  it('does not count jitter at the bowl center', () => {
    const tracker = new WhiskTracker();
    for (let index = 0; index < 200; index += 1) {
      tracker.update(0.004 * (index % 2 ? 1 : -1), 0.004, true, 0.015, 1);
    }
    expect(tracker.turns).toBe(0);
  });

  it('cancels shaking back and forth', () => {
    const tracker = new WhiskTracker();
    for (let index = 0; index < 100; index += 1) {
      tracker.update(0.05, index % 2 ? 0.02 : -0.02, true, 0.015, 1);
    }
    expect(tracker.turns).toBeLessThan(0.2);
  });

  it('ignores movement outside the bowl', () => {
    const tracker = new WhiskTracker();
    tracker.update(0.05, 0, false, 0.015, 1);
    tracker.update(0, 0.05, false, 0.015, 1);
    expect(tracker.turns).toBe(0);
  });
});

describe('TipCounter', () => {
  const TIP = 2;
  const REARM = 1.6;

  it('counts one tip per swing past the angle', () => {
    const tips = new TipCounter();
    tips.update(2.2, true, TIP, REARM);
    tips.update(2.5, true, TIP, REARM);
    tips.update(1.8, true, TIP, REARM);
    tips.update(2.2, true, TIP, REARM);
    expect(tips.count).toBe(1);
    tips.update(1.5, true, TIP, REARM);
    tips.update(2.2, true, TIP, REARM);
    expect(tips.count).toBe(2);
  });

  it('ignores tips away from the bowl', () => {
    const tips = new TipCounter();
    tips.update(2.2, false, TIP, REARM);
    expect(tips.count).toBe(0);
  });
});

describe('PourTimer', () => {
  const MIN_TILT = 1;

  it('only counts while tilted over the pan', () => {
    const pour = new PourTimer();
    pour.update(0.2, true, MIN_TILT, 1);
    pour.update(1.2, false, MIN_TILT, 1);
    expect(pour.update(1.2, true, MIN_TILT, 0.5)).toBe(0.5);
  });
});

describe('FlickDetector', () => {
  const yawQuaternion = (radians: number) =>
    [0, Math.sin(radians / 2), 0, Math.cos(radians / 2)] as const;

  it('reports fast rotation', () => {
    const flick = new FlickDetector();
    let speed = 0;
    for (let frame = 0; frame < 10; frame += 1) {
      const [x, y, z, w] = yawQuaternion(frame * 0.2);
      speed = flick.update(x, y, z, w, 0.02, 0.5);
    }
    expect(speed).toBeGreaterThan(9);
  });

  it('stays low for slow rotation', () => {
    const flick = new FlickDetector();
    let speed = 0;
    for (let frame = 0; frame < 10; frame += 1) {
      const [x, y, z, w] = yawQuaternion(frame * 0.01);
      speed = flick.update(x, y, z, w, 0.02, 0.5);
    }
    expect(speed).toBeLessThan(1);
  });
});
