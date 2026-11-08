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

/** Frequency of a MIDI note number. */
function midiHz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/**
 * Adds a soft electric-piano note: a sine with a little second harmonic, a
 * quick attack and an exponential fade. It stops once inaudible, and turns a
 * phasor instead of calling sin and exp per sample, which keeps building the
 * music loop cheap enough to run at load on a headset.
 */
function addNote(
  data: Float32Array,
  sampleRate: number,
  atS: number,
  frequencyHz: number,
  amplitude: number,
  decayS: number,
  attackS = 0.005,
): void {
  const start = Math.max(Math.round(atS * sampleRate), 0);
  const end = Math.min(data.length, start + Math.round(decayS * 5 * sampleRate));
  const step = (2 * Math.PI * frequencyHz) / sampleRate;
  const cosStep = Math.cos(step);
  const sinStep = Math.sin(step);
  const fadeStep = Math.exp(-1 / (decayS * sampleRate));
  const attackSamples = Math.max(attackS * sampleRate, 1);
  let sine = 0;
  let cosine = 1;
  let fade = amplitude;
  for (let index = start; index < end; index += 1) {
    const rise = Math.min((index - start) / attackSamples, 1);
    const wave = sine + 0.5 * sine * cosine;
    data[index] = (data[index] ?? 0) + wave * fade * rise;
    const nextSine = sine * cosStep + cosine * sinStep;
    cosine = cosine * cosStep - sine * sinStep;
    sine = nextSine;
    fade *= fadeStep;
  }
}

/** One bar per chord: bass note, then the chord tones from low to high. */
const MUSIC_CHORDS: readonly (readonly number[])[] = [
  [36, 60, 64, 67, 71],
  [33, 57, 60, 64, 67],
  [29, 57, 60, 65, 69],
  [31, 55, 59, 62, 67],
];
/** Which chord tone each eighth note of a bar plays: up, then back down. */
const ARPEGGIO = [1, 2, 3, 4, 3, 2, 3, 2] as const;

/**
 * A calm kitchen tune that loops without a seam: four bars of C, Am, F and G
 * with a soft bass, an arpeggio and a quiet pad. Notes still ringing at the
 * end are folded back onto the start.
 */
export function musicLoop(sampleRate: number, bpm = 84): Float32Array {
  const beatS = 60 / bpm;
  const barS = beatS * 4;
  const loopS = barS * MUSIC_CHORDS.length;
  const tailS = 2;
  const raw = samples(sampleRate, loopS + tailS);
  MUSIC_CHORDS.forEach((chord, bar) => {
    const barStart = bar * barS;
    const bass = chord[0] ?? 36;
    addNote(raw, sampleRate, barStart, midiHz(bass), 0.5, 0.9);
    addNote(raw, sampleRate, barStart + 2 * beatS, midiHz(bass), 0.35, 0.7);
    ARPEGGIO.forEach((tone, eighth) => {
      const note = chord[tone] ?? 60;
      addNote(
        raw,
        sampleRate,
        barStart + (eighth * beatS) / 2,
        midiHz(note + 12),
        eighth % 2 === 0 ? 0.2 : 0.14,
        0.45,
      );
    });
    for (const note of chord.slice(1)) {
      addNote(raw, sampleRate, barStart, midiHz(note), 0.05, 1.1, 0.4);
    }
  });
  const length = Math.round(loopS * sampleRate);
  const loop = new Float32Array(length);
  for (let index = 0; index < raw.length; index += 1) {
    const target = index % length;
    loop[target] = (loop[target] ?? 0) + (raw[index] ?? 0);
  }
  // A gentle low-pass keeps the tune soft behind the kitchen sounds.
  let low = 0;
  const alpha = 1 - Math.exp((-2 * Math.PI * 2800) / sampleRate);
  for (let pass = 0; pass < 2; pass += 1) {
    for (let index = 0; index < length; index += 1) {
      low += alpha * ((loop[index] ?? 0) - low);
      if (pass === 1) {
        loop[index] = low;
      }
    }
  }
  return normalize(loop, 0.6);
}
