/**
 * Every sound in the game is made here from plain math, so there are no audio
 * files to license or download. Each function returns mono samples in -1..1.
 */

/** Small seeded generator, so every sound is the same on every load. */
export function makeRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function samples(sampleRate: number, seconds: number): Float32Array {
  return new Float32Array(Math.max(1, Math.round(sampleRate * seconds)));
}

/** Scales the loudest sample to `peak`. */
function normalize(data: Float32Array, peak: number): Float32Array {
  let max = 0;
  for (const value of data) {
    max = Math.max(max, Math.abs(value));
  }
  if (max > 0) {
    const gain = peak / max;
    for (let index = 0; index < data.length; index += 1) {
      data[index] = (data[index] ?? 0) * gain;
    }
  }
  return data;
}

/** One-pole high-pass: takes the rumble out of noise. */
function highPass(
  data: Float32Array,
  sampleRate: number,
  cutoffHz: number,
): void {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const alpha = rc / (rc + 1 / sampleRate);
  let lastIn = 0;
  let lastOut = 0;
  for (let index = 0; index < data.length; index += 1) {
    const input = data[index] ?? 0;
    lastOut = alpha * (lastOut + input - lastIn);
    lastIn = input;
    data[index] = lastOut;
  }
}

/** Adds a short decaying noise click starting at `atS`. */
function addClick(
  data: Float32Array,
  sampleRate: number,
  random: () => number,
  atS: number,
  amplitude: number,
  decayS: number,
): void {
  const start = Math.round(atS * sampleRate);
  const length = Math.round(decayS * 6 * sampleRate);
  for (let offset = 0; offset < length; offset += 1) {
    const index = start + offset;
    if (index >= data.length) {
      return;
    }
    const envelope = Math.exp(-offset / (decayS * sampleRate));
    data[index] =
      (data[index] ?? 0) + (random() * 2 - 1) * amplitude * envelope;
  }
}

/** Adds a decaying sine partial starting at `atS`. */
function addPartial(
  data: Float32Array,
  sampleRate: number,
  atS: number,
  frequencyHz: number,
  amplitude: number,
  decayS: number,
): void {
  const start = Math.round(atS * sampleRate);
  const attack = 0.003 * sampleRate;
  for (let index = start; index < data.length; index += 1) {
    const t = (index - start) / sampleRate;
    const rise = Math.min((index - start) / attack, 1);
    data[index] =
      (data[index] ?? 0) +
      Math.sin(2 * Math.PI * frequencyHz * t) *
        amplitude *
        rise *
        Math.exp(-t / decayS);
  }
}

/**
 * Hiss with crackling fat. The end is blended into the start, so it loops
 * without a click.
 */
export function sizzleLoop(sampleRate: number, seconds = 2): Float32Array {
  const random = makeRandom(7);
  const fade = Math.round(0.08 * sampleRate);
  const raw = samples(sampleRate, seconds + fade / sampleRate);
  for (let index = 0; index < raw.length; index += 1) {
    raw[index] = (random() * 2 - 1) * 0.35;
  }
  const pops = Math.round(seconds * 45);
  for (let pop = 0; pop < pops; pop += 1) {
    const at = random() * (raw.length / sampleRate);
    addClick(raw, sampleRate, random, at, 0.4 + random() * 0.8, 0.0015);
  }
  highPass(raw, sampleRate, 1800);
  const length = raw.length - fade;
  const loop = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    loop[index] = raw[index] ?? 0;
  }
  for (let index = 0; index < fade; index += 1) {
    const mix = index / fade;
    loop[index] =
      (raw[index] ?? 0) * mix + (raw[length + index] ?? 0) * (1 - mix);
  }
  return normalize(loop, 0.7);
}

/** The shell giving way: a few sharp snaps and a crunch. */
export function crackSound(sampleRate: number): Float32Array {
  const random = makeRandom(11);
  const data = samples(sampleRate, 0.16);
  addClick(data, sampleRate, random, 0, 1, 0.002);
  addClick(data, sampleRate, random, 0.014, 0.8, 0.0025);
  addClick(data, sampleRate, random, 0.033, 0.6, 0.003);
  addClick(data, sampleRate, random, 0.005, 0.35, 0.03);
  highPass(data, sampleRate, 1400);
  return normalize(data, 0.9);
}

/** A soft wooden knock, for things settling into place. */
export function tok(sampleRate: number, frequencyHz: number): Float32Array {
  const random = makeRandom(13);
  const data = samples(sampleRate, 0.14);
  addPartial(data, sampleRate, 0, frequencyHz, 1, 0.03);
  addPartial(data, sampleRate, 0, frequencyHz * 2.76, 0.3, 0.012);
  addClick(data, sampleRate, random, 0, 0.25, 0.0015);
  return normalize(data, 0.85);
}

/** A pan set down on the stove grate. */
export function clank(sampleRate: number): Float32Array {
  const random = makeRandom(17);
  const data = samples(sampleRate, 0.5);
  addPartial(data, sampleRate, 0, 420, 1, 0.12);
  addPartial(data, sampleRate, 0, 1130, 0.55, 0.09);
  addPartial(data, sampleRate, 0, 1870, 0.35, 0.06);
  addPartial(data, sampleRate, 0, 2950, 0.2, 0.04);
  addClick(data, sampleRate, random, 0, 0.5, 0.002);
  return normalize(data, 0.8);
}

/** The whisk touching the bowl. */
export function clink(sampleRate: number): Float32Array {
  const data = samples(sampleRate, 0.25);
  addPartial(data, sampleRate, 0, 2400, 1, 0.05);
  addPartial(data, sampleRate, 0, 3900, 0.6, 0.035);
  addPartial(data, sampleRate, 0, 5600, 0.3, 0.025);
  return normalize(data, 0.7);
}

/** Grains rattling out of the shaker. */
export function shake(sampleRate: number): Float32Array {
  const random = makeRandom(19);
  const data = samples(sampleRate, 0.2);
  for (const at of [0, 0.045, 0.095]) {
    addClick(data, sampleRate, random, at, 1, 0.012);
  }
  highPass(data, sampleRate, 3200);
  return normalize(data, 0.8);
}

/** Something soft landing: a quick falling tone. */
export function plop(sampleRate: number): Float32Array {
  const data = samples(sampleRate, 0.16);
  let phase = 0;
  for (let index = 0; index < data.length; index += 1) {
    const t = index / sampleRate;
    const frequency = 110 + 270 * Math.exp(-t / 0.025);
    phase += (2 * Math.PI * frequency) / sampleRate;
    const rise = Math.min(t / 0.002, 1);
    data[index] = Math.sin(phase) * rise * Math.exp(-t / 0.04);
  }
  return normalize(data, 0.85);
}

/** Air moving past the tossed omelette. */
export function whoosh(sampleRate: number): Float32Array {
  const random = makeRandom(23);
  const seconds = 0.45;
  const data = samples(sampleRate, seconds);
  let low = 0;
  for (let index = 0; index < data.length; index += 1) {
    const t = index / sampleRate / seconds;
    const swell = Math.sin(Math.PI * Math.min(t, 1));
    const cutoff = 300 + 1500 * swell;
    const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
    low += alpha * (random() * 2 - 1 - low);
    data[index] = low * swell * swell;
  }
  return normalize(data, 0.8);
}

/** The egg hitting hot butter: a loud hiss that settles. */
export function splash(sampleRate: number): Float32Array {
  const random = makeRandom(29);
  const data = samples(sampleRate, 0.8);
  for (let index = 0; index < data.length; index += 1) {
    const t = index / sampleRate;
    const rise = Math.min(t / 0.006, 1);
    data[index] = (random() * 2 - 1) * rise * Math.exp(-t / 0.22);
  }
  for (let pop = 0; pop < 30; pop += 1) {
    addClick(data, sampleRate, random, random() * 0.6, random() * 0.7, 0.0015);
  }
  highPass(data, sampleRate, 1200);
  return normalize(data, 0.85);
}

/** Soft bell notes, one after another. */
export function chime(
  sampleRate: number,
  notesHz: readonly number[],
  gapS = 0.09,
  ringS = 0.18,
): Float32Array {
  const data = samples(sampleRate, gapS * notesHz.length + ringS * 5);
  notesHz.forEach((frequency, note) => {
    addPartial(data, sampleRate, note * gapS, frequency, 1, ringS);
    addPartial(data, sampleRate, note * gapS, frequency * 2, 0.2, ringS * 0.5);
  });
  return normalize(data, 0.7);
}

/** A short tone sliding from one pitch to another. */
export function glide(
  sampleRate: number,
  fromHz: number,
  toHz: number,
  seconds = 0.16,
): Float32Array {
  const data = samples(sampleRate, seconds);
  let phase = 0;
  for (let index = 0; index < data.length; index += 1) {
    const t = index / data.length;
    phase += (2 * Math.PI * fromHz * Math.pow(toHz / fromHz, t)) / sampleRate;
    const envelope = Math.min(t / 0.05, 1) * Math.min((1 - t) / 0.3, 1);
    data[index] = Math.sin(phase) * envelope;
  }
  return normalize(data, 0.6);
}
