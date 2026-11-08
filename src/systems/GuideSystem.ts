import {
  Color,
  createSystem,
  type Entity,
  Grabbed,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Vector3,
} from '@iwsdk/core';
import { COOKWARE } from '../config/cookware.js';
import type { StepGuide, ToolId } from '../config/recipes/recipe.js';
import { TUNING } from '../config/tuning.js';
import { KitchenSystem } from './KitchenSystem.js';
import { StepSystem } from './StepSystem.js';

type GuideTarget = StepGuide['target'];

/** Ring size around each target, and its height above the target origin. */
const RINGS: Readonly<Record<GuideTarget, { radius: number; top: number }>> = {
  bowl: { radius: 0.1, top: COOKWARE.bowl.height / 2 },
  pan: { radius: 0.115, top: COOKWARE.pan.height / 2 },
  stove: {
    radius: 0.12,
    top: COOKWARE.stove.height + COOKWARE.stove.grateHeight,
  },
  plate: { radius: 0.125, top: COOKWARE.plate.height },
};

const TOOL_IDS: ReadonlySet<string> = new Set<ToolId>([
  'bowl',
  'whisk',
  'pan',
  'stove',
  'plate',
]);

/** The ring floats this far over the target, clear of its rim. */
const RING_LIFT_M = 0.006;
/** Ring band width, as a share of its radius. */
const RING_BAND = 0.1;
/** Above the ring, the held object counts as over it up to this height. */
const OVER_HEIGHT_M = 0.35;
const PULSE_PER_S = 2.4;
const READY_COLOR = new Color('#7CE38B');

/**
 * While the player holds something, a soft ring pulses where it has to go.
 * The ring turns green once the object is over it, so the player knows a
 * release or a tilt will count. Rings come from each recipe step's `guides`.
 */
export class GuideSystem extends createSystem({}) {
  private readonly material = new MeshBasicMaterial({
    color: TUNING.reachGlowColor,
    transparent: true,
    depthWrite: false,
  });
  private readonly glowColor = new Color(TUNING.reachGlowColor);
  private readonly ring = new Mesh(
    new RingGeometry(1 - RING_BAND, 1, 48),
    this.material,
  );
  private readonly entities = new Map<string, Entity>();
  private readonly center = new Vector3();
  private readonly heldAt = new Vector3();
  private steps!: StepSystem;
  private kitchen!: KitchenSystem;
  private timeS = 0;

  init(): void {
    const steps = this.world.getSystem(StepSystem);
    const kitchen = this.world.getSystem(KitchenSystem);
    if (steps == null || kitchen == null) {
      throw new Error('GuideSystem needs StepSystem and KitchenSystem first');
    }
    this.steps = steps;
    this.kitchen = kitchen;
    this.ring.name = 'GuideRing';
    this.ring.geometry.rotateX(-Math.PI / 2);
    this.ring.visible = false;
    this.ring.renderOrder = 1;
    this.world.scene.add(this.ring);
    this.cleanupFuncs.push(() => this.ring.removeFromParent());
  }

  update(delta: number): void {
    const guide = this.activeGuide();
    if (guide == null) {
      this.ring.visible = false;
      return;
    }
    const target = this.entityFor(guide.target).object3D;
    const held = this.entityFor(guide.held).object3D;
    if (target == null || held == null) {
      this.ring.visible = false;
      return;
    }
    const shape = RINGS[guide.target];
    target.getWorldPosition(this.center);
    this.center.y += shape.top + RING_LIFT_M;
    this.ring.position.copy(this.center);
    this.ring.scale.setScalar(shape.radius);
    this.ring.visible = true;

    held.getWorldPosition(this.heldAt);
    const isOver =
      Math.hypot(
        this.heldAt.x - this.center.x,
        this.heldAt.z - this.center.z,
      ) <= shape.radius &&
      this.heldAt.y >= this.center.y - RING_LIFT_M &&
      this.heldAt.y - this.center.y <= OVER_HEIGHT_M;
    this.timeS += delta;
    if (isOver) {
      this.material.color.copy(READY_COLOR);
      this.material.opacity = 0.95;
    } else {
      this.material.color.copy(this.glowColor);
      this.material.opacity =
        0.55 + 0.3 * Math.sin(this.timeS * PULSE_PER_S * Math.PI * 2);
    }
  }

  /** The first guide of this step whose object is in a hand right now. */
  private activeGuide(): StepGuide | null {
    if (this.steps.isGamePaused) {
      return null;
    }
    for (const guide of this.steps.step?.guides ?? []) {
      if (this.entityFor(guide.held).hasComponent(Grabbed)) {
        return guide;
      }
    }
    return null;
  }

  private entityFor(id: string): Entity {
    let entity = this.entities.get(id);
    if (entity == null) {
      entity = TOOL_IDS.has(id)
        ? this.kitchen.requireTool(id as ToolId)
        : this.world.requireSceneEntity(`ingredient-${id}`);
      this.entities.set(id, entity);
    }
    return entity;
  }
}
