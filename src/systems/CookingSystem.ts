import {
  Color,
  createSystem,
  type Mesh,
  type MeshStandardMaterial,
  VisibilityState,
} from '@iwsdk/core';
import { TUNING } from '../config/tuning.js';
import {
  advanceCook,
  COOK_ZONE,
  COOK_ZONE_LABEL,
  type CookZone,
  cookZone,
} from '../game/cooking.js';
import { KitchenSystem } from './KitchenSystem.js';
import { StepSystem } from './StepSystem.js';

const RAW_COLOR = new Color('#F6E27A');
const GOLDEN_COLOR = new Color('#E0A93B');
const BROWN_COLOR = new Color('#6B4A1F');
const BURNT_COLOR = new Color('#2A1E14');
const YOLK_COLOR = new Color('#F5B335');

/** The omelette's shape when lying folded in half. */
const FOLDED_SCALE_Z = 0.55;
const FOLDED_SHIFT_Z = 0.03;

/** Size of the butter disc, against fully melted, when it lands. */
const BUTTER_START_SCALE = 0.35;

const GOLDEN_MOMENT = 0.7;
const BURNT_MOMENT = 1.2;

/** Tracks doneness and every change it makes to the food on the table. */
export class CookingSystem extends createSystem({}) {
  private steps!: StepSystem;
  private kitchen!: KitchenSystem;
  private bowlEgg!: Mesh;
  private panEgg!: Mesh;
  private panButter!: Mesh;
  private plateOmelette!: Mesh;
  private butterMeltS = 0;
  private progress = 0;
  private hasEggInPan = false;
  private zone: CookZone = 'raw';

  get cookProgress(): number {
    return this.progress;
  }

  init(): void {
    const steps = this.world.getSystem(StepSystem);
    const kitchen = this.world.getSystem(KitchenSystem);
    if (steps == null || kitchen == null) {
      throw new Error('CookingSystem needs StepSystem and KitchenSystem first');
    }
    this.steps = steps;
    this.kitchen = kitchen;
    this.bowlEgg = this.ownedMesh('bowl', 'BowlEgg');
    this.panEgg = this.ownedMesh('pan', 'PanEgg');
    this.panButter = this.ownedMesh('pan', 'PanButter');
    this.plateOmelette = this.ownedMesh('plate', 'PlateOmelette');
    this.cleanupFuncs.push(
      steps.subscribe(() => {
        if (steps.state.phase === 'title') {
          this.reset();
        }
      }),
    );
    this.reset();
  }

  update(delta: number): void {
    if (this.world.visibilityState.peek() !== VisibilityState.Visible) {
      return;
    }
    this.updateButter(delta);
    if (!this.hasEggInPan) {
      return;
    }
    if (this.kitchen.panOnStove) {
      this.progress = advanceCook(this.progress, delta, TUNING.cookDurationS);
    }
    this.paintDoneness();
    const zone = cookZone(this.progress);
    if (zone !== this.zone) {
      this.zone = zone;
      this.showDoneness();
    }
  }

  /** The butter lands in the hot pan and starts to spread. */
  meltButter(): void {
    this.butterMeltS = TUNING.butterMeltS;
    this.panButter.visible = true;
    this.panButter.scale.setScalar(BUTTER_START_SCALE);
  }

  /** The cracked egg lands in the bowl as separate yolks. */
  showEggInBowl(): void {
    this.bowlEgg.visible = true;
    this.material(this.bowlEgg).color.copy(YOLK_COLOR);
    this.bowlEgg.scale.setScalar(1);
  }

  /** Blends the yolks toward an even raw-egg color as the player whisks. */
  setWhiskProgress(amount: number): void {
    this.material(this.bowlEgg).color.lerpColors(YOLK_COLOR, RAW_COLOR, amount);
  }

  /** Moves the egg from the bowl to the pan while the player pours. */
  setPourProgress(amount: number): void {
    this.bowlEgg.scale.setScalar(Math.max(1 - amount, 0.05));
    this.panEgg.visible = amount > 0;
    this.panEgg.scale.setScalar(Math.max(amount, 0.05));
  }

  /** The whole egg is in the pan, so the heat now counts. */
  startCooking(): void {
    this.setPourProgress(1);
    this.bowlEgg.visible = false;
    this.panButter.visible = false;
    this.hasEggInPan = true;
  }

  fold(): void {
    this.panEgg.scale.z = FOLDED_SCALE_Z;
    this.panEgg.position.z = FOLDED_SHIFT_Z;
  }

  /** Slides the finished omelette onto the plate. */
  serve(): void {
    this.hasEggInPan = false;
    this.panEgg.visible = false;
    this.plateOmelette.visible = true;
    this.material(this.plateOmelette).color.copy(
      this.material(this.panEgg).color,
    );
  }

  /** Writes the doneness after the step title. */
  showDoneness(): void {
    this.steps.setProgress(COOK_ZONE_LABEL[cookZone(this.progress)]);
  }

  private updateButter(delta: number): void {
    if (this.butterMeltS <= 0) {
      return;
    }
    this.butterMeltS = Math.max(this.butterMeltS - delta, 0);
    const melted = 1 - this.butterMeltS / TUNING.butterMeltS;
    this.panButter.scale.setScalar(
      BUTTER_START_SCALE + (1 - BUTTER_START_SCALE) * melted,
    );
  }

  private paintDoneness(): void {
    const { color } = this.material(this.panEgg);
    const { progress } = this;
    if (progress <= GOLDEN_MOMENT) {
      color.lerpColors(RAW_COLOR, GOLDEN_COLOR, progress / GOLDEN_MOMENT);
    } else if (progress <= COOK_ZONE.burntAbove) {
      color.lerpColors(
        GOLDEN_COLOR,
        BROWN_COLOR,
        (progress - GOLDEN_MOMENT) / (COOK_ZONE.burntAbove - GOLDEN_MOMENT),
      );
    } else {
      color.lerpColors(
        BROWN_COLOR,
        BURNT_COLOR,
        Math.min(
          (progress - COOK_ZONE.burntAbove) /
            (BURNT_MOMENT - COOK_ZONE.burntAbove),
          1,
        ),
      );
    }
  }

  private reset(): void {
    this.progress = 0;
    this.hasEggInPan = false;
    this.zone = 'raw';
    this.butterMeltS = 0;
    this.bowlEgg.visible = false;
    this.panEgg.visible = false;
    this.panButter.visible = false;
    this.plateOmelette.visible = false;
    this.panEgg.scale.setScalar(1);
    this.panEgg.position.z = 0;
    this.material(this.panEgg).color.copy(RAW_COLOR);
  }

  /** Food colors change at runtime, so each mesh gets its own material. */
  private ownedMesh(toolId: 'bowl' | 'pan' | 'plate', name: string): Mesh {
    const object = this.kitchen.requireTool(toolId).object3D;
    const mesh = object?.getObjectByName(name) as Mesh | undefined;
    if (mesh == null) {
      throw new Error(`Tool ${toolId} has no ${name} mesh`);
    }
    mesh.material = this.material(mesh).clone();
    return mesh;
  }

  /** Read fresh each time: the reach glow can swap this mesh's material. */
  private material(mesh: Mesh): MeshStandardMaterial {
    return mesh.material as MeshStandardMaterial;
  }
}
