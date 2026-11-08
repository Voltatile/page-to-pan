import {
  createSystem,
  Group,
  Mesh,
  type MeshStandardMaterial,
  type Object3D,
} from '@iwsdk/core';
import { KitchenSystem } from './KitchenSystem.js';
import { StepSystem } from './StepSystem.js';

/** Above the recipe card, in the stand's space: where the stars show later. */
const PREVIEW_POSITION = [0, 0.26, -0.2] as const;
/** Tipped toward the seat, so the folded top faces the player. */
const PREVIEW_TILT_RAD = 0.55;
const PREVIEW_SCALE = 1.3;
const SPIN_RAD_PER_S = 0.6;
const BOB_M = 0.006;
const BOB_RAD_PER_S = 1.8;
const GOLDEN = '#E0A93B';

/**
 * On the title card a finished omelette turns slowly above the recipe, so the
 * player sees the goal before pressing Start.
 */
export class TitlePreviewSystem extends createSystem({}) {
  private readonly pivot = new Group();
  private readonly turntable = new Group();
  private steps!: StepSystem;
  private timeS = 0;

  init(): void {
    const steps = this.world.getSystem(StepSystem);
    const kitchen = this.world.getSystem(KitchenSystem);
    if (steps == null || kitchen == null) {
      throw new Error('TitlePreviewSystem needs StepSystem and KitchenSystem');
    }
    this.steps = steps;
    const source = kitchen
      .requireTool('plate')
      .object3D?.getObjectByName('PlateOmelette');
    if (!(source instanceof Mesh)) {
      throw new Error('The plate has no PlateOmelette mesh');
    }
    const omelette = source.clone(true);
    // The cooking system recolors the plate omelette, so this one gets its own.
    const material = (source.material as MeshStandardMaterial).clone();
    material.color.set(GOLDEN);
    omelette.material = material;
    omelette.position.set(0, 0, 0);
    omelette.traverse((part: Object3D) => {
      part.visible = true;
    });
    omelette.name = 'TitleOmelette';

    this.turntable.add(omelette);
    this.turntable.scale.setScalar(PREVIEW_SCALE);
    this.pivot.name = 'TitlePreview';
    this.pivot.position.set(...PREVIEW_POSITION);
    this.pivot.rotation.x = PREVIEW_TILT_RAD;
    this.pivot.add(this.turntable);
    this.world.requireSceneEntity('recipe-stand').object3D?.add(this.pivot);

    const show = () => {
      this.pivot.visible = steps.state.phase === 'title';
    };
    this.cleanupFuncs.push(steps.subscribe(show), () =>
      this.pivot.removeFromParent(),
    );
    show();
  }

  update(delta: number): void {
    if (!this.pivot.visible) {
      return;
    }
    this.timeS += delta;
    this.turntable.rotation.y = this.timeS * SPIN_RAD_PER_S;
    this.turntable.position.y = BOB_M * Math.sin(this.timeS * BOB_RAD_PER_S);
  }
}
