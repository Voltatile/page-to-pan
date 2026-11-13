import {
  Color,
  createSystem,
  MeshBasicMaterial,
  type Object3D,
  Quaternion,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { TUNING } from '../config/tuning.js';
import { type PanState, type Sizzle, sizzleOf } from '../game/sizzle.js';
import {
  createDotTexture,
  type SpriteMotion,
  SpritePool,
} from '../util/sprite-pool.js';
import { CookingSystem } from './CookingSystem.js';
import { KitchenSystem } from './KitchenSystem.js';
import { StepSystem } from './StepSystem.js';

export type BurstKind =
  | 'salt'
  | 'soy'
  | 'syrup'
  | 'flour'
  | 'yolk'
  | 'onion'
  | 'sparkle';

interface BurstStyle {
  color: Color;
  count: number;
  /** Random speed in every direction, in meters per second. */
  spread: number;
  /** Speed straight down at birth. */
  fall: number;
  motion: SpriteMotion;
}

const BURSTS: Readonly<Record<BurstKind, BurstStyle>> = {
  salt: {
    color: new Color('#FFFFFF'),
    count: 12,
    spread: 0.12,
    fall: 0.25,
    motion: {
      gravity: -3,
      drag: 0.5,
      lifeS: 0.9,
      startSize: 0.005,
      endSize: 0.004,
      floorY: -Infinity,
      fadeS: 0,
    },
  },
  soy: {
    color: new Color('#3A1D0E'),
    count: 8,
    spread: 0.04,
    fall: 0.35,
    motion: {
      gravity: -4,
      drag: 0.3,
      lifeS: 0.7,
      startSize: 0.009,
      endSize: 0.007,
      floorY: -Infinity,
      fadeS: 0,
    },
  },
  syrup: {
    color: new Color('#C86D18'),
    count: 10,
    spread: 0.05,
    fall: 0.32,
    motion: {
      gravity: -3.8,
      drag: 0.35,
      lifeS: 0.75,
      startSize: 0.01,
      endSize: 0.008,
      floorY: -Infinity,
      fadeS: 0,
    },
  },
  flour: {
    color: new Color('#FAF8F2'),
    count: 16,
    spread: 0.18,
    fall: 0.15,
    motion: {
      gravity: -1.8,
      drag: 0.8,
      lifeS: 0.85,
      startSize: 0.012,
      endSize: 0.02,
      floorY: -Infinity,
      fadeS: 0.2,
    },
  },
  yolk: {
    color: new Color('#F5B335'),
    count: 8,
    spread: 0.15,
    fall: 0.2,
    motion: {
      gravity: -4,
      drag: 0.3,
      lifeS: 0.8,
      startSize: 0.011,
      endSize: 0.008,
      floorY: -Infinity,
      fadeS: 0,
    },
  },
  onion: {
    color: new Color('#5DA34A'),
    count: 8,
    spread: 0.12,
    fall: 0.1,
    motion: {
      gravity: -4,
      drag: 0.3,
      lifeS: 0.8,
      startSize: 0.009,
      endSize: 0.008,
      floorY: -Infinity,
      fadeS: 0,
    },
  },
  sparkle: {
    color: new Color('#FFD45C'),
    count: 10,
    spread: 0.45,
    fall: -0.15,
    motion: {
      gravity: -1.2,
      drag: 1.5,
      lifeS: 0.7,
      startSize: 0.012,
      endSize: 0.002,
      floorY: -Infinity,
      fadeS: 0,
    },
  },
};

const GRAIN_CAPACITY = 64;
const PUFF_CAPACITY = 40;

const STEAM_COLOR = new Color('#F4F4F2');
const SMOKE_COLOR = new Color('#3B3631');
/** Burning food puffs this many times more often than golden food. */
const SMOKE_RATE_BOOST = 1.5;
const STEAM_MOTION: SpriteMotion = {
  gravity: 0.03,
  drag: 0.6,
  lifeS: 1.8,
  startSize: 0.03,
  endSize: 0.11,
  floorY: -Infinity,
  fadeS: 0.5,
};
/** Steam rises from this far above the pan or plate. */
const STEAM_LIFT_M = 0.025;
/** Puffs start anywhere within this radius of the food. */
const STEAM_SPREAD_M = 0.05;

/** The stove flame dances: height and width wobble by these shares. */
const FLAME_HEIGHT_WOBBLE = 0.3;
const FLAME_WIDTH_WOBBLE = 0.03;

/**
 * Small particle touches: salt falling, yolk splashing, steam and smoke from
 * the pan, and sparkles for the stars. Two instanced meshes draw them all.
 */
export class EffectsSystem extends createSystem({}) {
  private grains!: SpritePool;
  private puffs!: SpritePool;
  private readonly facing = new Quaternion();
  private readonly spawnAt = new Vector3();
  private readonly source = new Vector3();
  private readonly color = new Color();
  private readonly motion: SpriteMotion = { ...STEAM_MOTION };
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
  private steamDue = 0;
  private plateSteamS = 0;
  private wasDone = false;
  private flame: Object3D | undefined;
  private flameS = 0;

  init(): void {
    const steps = this.world.getSystem(StepSystem);
    const cooking = this.world.getSystem(CookingSystem);
    const kitchen = this.world.getSystem(KitchenSystem);
    if (steps == null || cooking == null || kitchen == null) {
      throw new Error('EffectsSystem needs the kitchen systems first');
    }
    this.steps = steps;
    this.cooking = cooking;
    this.kitchen = kitchen;
    const dot = createDotTexture();
    this.grains = new SpritePool(
      'GrainParticles',
      GRAIN_CAPACITY,
      new MeshBasicMaterial({ map: dot, alphaTest: 0.5 }),
    );
    this.puffs = new SpritePool(
      'SteamParticles',
      PUFF_CAPACITY,
      new MeshBasicMaterial({
        map: dot,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    this.world.scene.add(this.grains.mesh, this.puffs.mesh);
    this.flame = kitchen
      .requireTool('stove')
      .object3D?.getObjectByName('StoveFlame');
    this.cleanupFuncs.push(
      steps.subscribe(() => this.onStepChange()),
      () => {
        this.grains.mesh.removeFromParent();
        this.puffs.mesh.removeFromParent();
      },
    );
  }

  update(delta: number): void {
    if (this.world.visibilityState.peek() !== VisibilityState.Visible) {
      return;
    }
    this.player.head.getWorldQuaternion(this.facing);
    this.flickerFlame(delta);
    if (!this.steps.isGamePaused) {
      this.emitPanSteam(delta);
      this.emitPlateSteam(delta);
    }
    this.grains.update(delta, this.facing);
    this.puffs.update(delta, this.facing);
  }

  /** Uneven sines, so the flame never settles into an obvious loop. */
  private flickerFlame(delta: number): void {
    if (this.flame == null || !this.flame.visible) {
      return;
    }
    this.flameS += delta;
    const t = this.flameS;
    const wobble =
      0.5 * Math.sin(t * 13.1) + 0.3 * Math.sin(t * 23.7) + 0.2 * Math.sin(t * 5.3);
    const width = 1 + FLAME_WIDTH_WOBBLE * Math.sin(t * 9.4);
    this.flame.scale.set(width, 1 + FLAME_HEIGHT_WOBBLE * wobble, width);
  }

  /** A little burst of `kind` at `at`. Grains vanish below `floorY`. */
  burst(kind: BurstKind, at: Vector3, floorY = -Infinity): void {
    const style = BURSTS[kind];
    Object.assign(this.motion, style.motion);
    this.motion.floorY = floorY;
    for (let index = 0; index < style.count; index += 1) {
      this.grains.spawn(
        at,
        (Math.random() * 2 - 1) * style.spread,
        (Math.random() * 2 - 1) * style.spread - style.fall,
        (Math.random() * 2 - 1) * style.spread,
        style.color,
        this.motion,
      );
    }
  }

  private emitPanSteam(delta: number): void {
    this.cooking.readPanState(this.pan);
    sizzleOf(this.pan, this.heat);
    if (this.heat.level <= 0) {
      this.steamDue = 0;
      return;
    }
    const rate =
      TUNING.steamPerS * this.heat.level * (1 + SMOKE_RATE_BOOST * this.heat.burn);
    this.steamDue += rate * delta;
    const pan = this.kitchen.requireTool('pan').object3D;
    if (pan == null) {
      return;
    }
    pan.getWorldPosition(this.source);
    this.color.lerpColors(STEAM_COLOR, SMOKE_COLOR, this.heat.burn);
    this.puffFrom(this.source);
  }

  private emitPlateSteam(delta: number): void {
    if (this.plateSteamS <= 0) {
      return;
    }
    this.plateSteamS = Math.max(this.plateSteamS - delta, 0);
    const fading = this.plateSteamS / TUNING.plateSteamS;
    this.steamDue += TUNING.steamPerS * 0.5 * fading * delta;
    const plate = this.kitchen.requireTool('plate').object3D;
    if (plate == null) {
      return;
    }
    plate.getWorldPosition(this.source);
    this.color.copy(STEAM_COLOR);
    this.puffFrom(this.source);
  }

  /** Spends whole puffs from `steamDue` at random spots over `food`. */
  private puffFrom(food: Vector3): void {
    while (this.steamDue >= 1) {
      this.steamDue -= 1;
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * STEAM_SPREAD_M;
      this.spawnAt.set(
        food.x + Math.cos(angle) * radius,
        food.y + STEAM_LIFT_M,
        food.z + Math.sin(angle) * radius,
      );
      this.puffs.spawn(
        this.spawnAt,
        (Math.random() * 2 - 1) * 0.015,
        0.06 + Math.random() * 0.05,
        (Math.random() * 2 - 1) * 0.015,
        this.color,
        STEAM_MOTION,
      );
    }
  }

  private onStepChange(): void {
    const phase = this.steps.state.phase;
    const isDone = phase === 'done';
    if (isDone && !this.wasDone) {
      this.plateSteamS = TUNING.plateSteamS;
    }
    this.wasDone = isDone;
    if (phase === 'title') {
      this.plateSteamS = 0;
      this.grains.clear();
      this.puffs.clear();
    }
  }
}
