import {
  AudioListener,
  createSystem,
  eq,
  Object3D,
  PositionalAudio,
  Audio as SoundVoice,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { TUNING } from '../config/tuning.js';
import { Ingredient } from '../game-components.js';
import { type PanState, type Sizzle, sizzleOf } from '../game/sizzle.js';
import {
  chime,
  clank,
  clink,
  crackSound,
  glide,
  plop,
  shake,
  sizzleLoop,
  splash,
  tok,
  whoosh,
} from '../game/synth.js';
import { CookingSystem } from './CookingSystem.js';
import { KitchenSystem } from './KitchenSystem.js';
import { StepSystem } from './StepSystem.js';

export type SoundName =
  | 'snap'
  | 'crack'
  | 'clink'
  | 'shake'
  | 'plop'
  | 'clank'
  | 'whoosh'
  | 'splash'
  | 'serve'
  | 'step'
  | 'done'
  | 'star'
  | 'pause'
  | 'resume';

/** Sounds are made at this rate; WebAudio resamples them on playback. */
const SAMPLE_RATE = 22050;

const MAKERS: Readonly<Record<SoundName, () => Float32Array>> = {
  snap: () => tok(SAMPLE_RATE, 880),
  crack: () => crackSound(SAMPLE_RATE),
  clink: () => clink(SAMPLE_RATE),
  shake: () => shake(SAMPLE_RATE),
  plop: () => plop(SAMPLE_RATE),
  clank: () => clank(SAMPLE_RATE),
  whoosh: () => whoosh(SAMPLE_RATE),
  splash: () => splash(SAMPLE_RATE),
  serve: () => tok(SAMPLE_RATE, 620),
  step: () => chime(SAMPLE_RATE, [784, 1175]),
  done: () => chime(SAMPLE_RATE, [523, 659, 784, 1047], 0.12, 0.3),
  star: () => chime(SAMPLE_RATE, [1319], 0.1, 0.25),
  pause: () => glide(SAMPLE_RATE, 660, 392),
  resume: () => glide(SAMPLE_RATE, 392, 660),
};

const VOLUME: Readonly<Record<SoundName, number>> = {
  snap: 0.7,
  crack: 1,
  clink: 0.35,
  shake: 0.6,
  plop: 0.8,
  clank: 0.7,
  whoosh: 0.8,
  splash: 0.9,
  serve: 0.8,
  step: 0.3,
  done: 0.45,
  star: 0.5,
  pause: 0.4,
  resume: 0.4,
};

/** Spatial voices for sounds that come from a place on the table. */
const SPATIAL_VOICES = 8;
/** Voices for interface sounds, heard the same in both ears. */
const FLAT_VOICES = 3;
/** At this distance a spatial sound plays at full volume. */
const REF_DISTANCE_M = 0.4;

/** The sizzle brightens from this filter cutoff as the food starts burning. */
const SIZZLE_CUTOFF_HZ = 3500;
const BURN_CUTOFF_HZ = 9000;
const BURN_PITCH = 0.2;
/** How fast the sizzle follows the pan, as a fraction per second. */
const SIZZLE_FOLLOW_PER_S = 6;

/**
 * Every sound in the kitchen. The sounds are synthesized at load, so the game
 * ships no audio files. One looping sizzle rides on the pan; short sounds
 * share a small pool of voices.
 * QUEST-CHECK: loudness and spatial falloff are tuned on desktop speakers.
 */
export class SoundSystem extends createSystem({
  placed: {
    required: [Ingredient],
    where: [eq(Ingredient, 'placed', true)],
  },
}) {
  private listener!: AudioListener;
  private readonly buffers = new Map<SoundName, AudioBuffer>();
  private readonly voices: PositionalAudio[] = [];
  private readonly flatVoices: SoundVoice[] = [];
  private nextVoice = 0;
  private nextFlatVoice = 0;
  private sizzle!: PositionalAudio;
  private sizzleFilter!: BiquadFilterNode;
  private sizzleGain = 0;
  private shownGain = -1;
  private shownBurn = -1;
  private masterGain = -1;
  private readonly pan: PanState = {
    isOnHeat: false,
    hasButter: false,
    hasEgg: false,
    progress: 0,
    isTossing: false,
  };
  private readonly heat: Sizzle = { level: 0, burn: 0 };
  private steps!: StepSystem;
  private cooking!: CookingSystem;
  private kitchen!: KitchenSystem;
  private stepKey = '';
  private wasPaused = false;
  private wasPanOnStove = false;

  init(): void {
    const steps = this.world.getSystem(StepSystem);
    const cooking = this.world.getSystem(CookingSystem);
    const kitchen = this.world.getSystem(KitchenSystem);
    if (steps == null || cooking == null || kitchen == null) {
      throw new Error('SoundSystem needs the kitchen systems first');
    }
    this.steps = steps;
    this.cooking = cooking;
    this.kitchen = kitchen;
    this.listener = this.findListener();
    const context = this.listener.context;
    for (const name of Object.keys(MAKERS) as SoundName[]) {
      this.buffers.set(name, this.toBuffer(context, MAKERS[name]()));
    }
    for (let index = 0; index < SPATIAL_VOICES; index += 1) {
      const voice = new PositionalAudio(this.listener);
      voice.name = `SoundVoice${index + 1}`;
      voice.setRefDistance(REF_DISTANCE_M);
      this.world.scene.add(voice);
      this.voices.push(voice);
    }
    for (let index = 0; index < FLAT_VOICES; index += 1) {
      this.flatVoices.push(new SoundVoice(this.listener));
    }

    this.sizzle = new PositionalAudio(this.listener);
    this.sizzle.name = 'PanSizzle';
    this.sizzle.setRefDistance(REF_DISTANCE_M);
    this.sizzle.setBuffer(this.toBuffer(context, sizzleLoop(SAMPLE_RATE)));
    this.sizzle.setLoop(true);
    this.sizzle.setVolume(0);
    this.sizzleFilter = context.createBiquadFilter();
    this.sizzleFilter.type = 'lowpass';
    this.sizzle.setFilter(this.sizzleFilter);
    this.kitchen.requireTool('pan').object3D?.add(this.sizzle);

    this.cleanupFuncs.push(
      this.queries.placed.subscribe('qualify', (entity) =>
        this.playSound('snap', entity.object3D ?? null),
      ),
      steps.subscribe(() => this.onStepChange()),
      () => {
        this.sizzle.removeFromParent();
        for (const voice of this.voices) {
          voice.removeFromParent();
        }
      },
    );
  }

  update(delta: number): void {
    const context = this.listener.context;
    const isRunning = context.state === 'running';
    if (isRunning && !this.sizzle.isPlaying) {
      this.sizzle.play();
    }
    const isVisible =
      this.world.visibilityState.peek() === VisibilityState.Visible;
    const master = isVisible ? TUNING.masterVolume : 0;
    if (master !== this.masterGain) {
      this.masterGain = master;
      this.listener.setMasterVolume(master);
    }
    this.updateSizzle(delta);
    const isPanOnStove = this.kitchen.panOnStove;
    if (isPanOnStove && !this.wasPanOnStove) {
      this.playSound('clank', this.kitchen.requireTool('pan').object3D ?? null);
    }
    this.wasPanOnStove = isPanOnStove;
  }

  /**
   * Plays a short sound from `at`, or in both ears when `at` is null.
   * Sounds before the audio has started are skipped, never queued.
   */
  playSound(
    name: SoundName,
    at: Object3D | Vector3 | null,
    volume = 1,
    rate = 1,
  ): void {
    const buffer = this.buffers.get(name);
    if (buffer == null || this.listener.context.state !== 'running') {
      return;
    }
    let voice: SoundVoice | PositionalAudio;
    if (at == null) {
      voice = this.flatVoices[this.nextFlatVoice] as SoundVoice;
      this.nextFlatVoice = (this.nextFlatVoice + 1) % FLAT_VOICES;
    } else {
      const spatial = this.voices[this.nextVoice] as PositionalAudio;
      this.nextVoice = (this.nextVoice + 1) % SPATIAL_VOICES;
      if (at instanceof Object3D) {
        at.getWorldPosition(spatial.position);
      } else {
        spatial.position.copy(at);
      }
      spatial.updateMatrixWorld(true);
      voice = spatial;
    }
    if (voice.isPlaying) {
      voice.stop();
    }
    voice.setBuffer(buffer);
    voice.setVolume(VOLUME[name] * volume);
    voice.setPlaybackRate(rate);
    voice.play();
  }

  private updateSizzle(delta: number): void {
    const isVisible =
      this.world.visibilityState.peek() === VisibilityState.Visible;
    this.cooking.readPanState(this.pan);
    this.pan.isOnHeat &&= isVisible;
    sizzleOf(this.pan, this.heat);
    const target = this.heat.level * TUNING.sizzleVolume;
    this.sizzleGain +=
      (target - this.sizzleGain) * Math.min(SIZZLE_FOLLOW_PER_S * delta, 1);
    if (Math.abs(this.sizzleGain - this.shownGain) > 0.004) {
      this.shownGain = this.sizzleGain;
      this.sizzle.setVolume(this.sizzleGain);
    }
    if (Math.abs(this.heat.burn - this.shownBurn) > 0.02) {
      this.shownBurn = this.heat.burn;
      this.sizzleFilter.frequency.value =
        SIZZLE_CUTOFF_HZ + (BURN_CUTOFF_HZ - SIZZLE_CUTOFF_HZ) * this.heat.burn;
      this.sizzle.setPlaybackRate(1 + BURN_PITCH * this.heat.burn);
    }
  }

  private onStepChange(): void {
    const { state, isGamePaused } = this.steps;
    if (isGamePaused !== this.wasPaused) {
      this.wasPaused = isGamePaused;
      this.playSound(isGamePaused ? 'pause' : 'resume', null);
    }
    const key =
      state.phase === 'cooking' ? `cooking-${state.stepIndex}` : state.phase;
    if (key === this.stepKey) {
      return;
    }
    this.stepKey = key;
    if (state.phase === 'cooking') {
      this.playSound('step', null);
    } else if (state.phase === 'done') {
      this.playSound('done', null);
    }
  }

  /** Shares the listener IWSDK keeps on the head, so there is only one. */
  private findListener(): AudioListener {
    const head = this.player.head;
    const existing = head.children.find(
      (child): child is AudioListener => child instanceof AudioListener,
    );
    if (existing != null) {
      return existing;
    }
    const listener = new AudioListener();
    head.add(listener);
    return listener;
  }

  private toBuffer(context: AudioContext, data: Float32Array): AudioBuffer {
    const buffer = context.createBuffer(1, data.length, SAMPLE_RATE);
    buffer.getChannelData(0).set(data);
    return buffer;
  }
}
