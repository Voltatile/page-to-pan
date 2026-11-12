import {
  createSystem,
  Group,
  Mesh,
  type MeshStandardMaterial,
  type Object3D,
} from '@iwsdk/core';
import type { Recipe } from '../config/recipes/recipe.js';
import { KitchenSystem } from './KitchenSystem.js';
import { StepSystem } from './StepSystem.js';

/** Above the recipe card, in the floating menu's space. */
const PREVIEW_POSITION = [0, 0.2, 0.05] as const;
/** Tipped toward the seat, so the top of the dish faces the player. */
const PREVIEW_TILT_RAD = 0.35;
const PREVIEW_SCALE = 1.3;
const SPIN_RAD_PER_S = 0.6;
const BOB_M = 0.006;
const BOB_RAD_PER_S = 1.8;

/** Finished colors for each part of each dish. */
const FINISHED_COLORS: Readonly<Record<string, string>> = {
  PlateOmelette: '#E0A93B',
  PlateRice: '#B07A45',
  PlateScramble: '#E0A93B',
};

/**
 * On the title card the finished dish of the chosen recipe turns slowly above
 * the recipe, so the player sees the goal before pressing Start.
 */
export class TitlePreviewSystem extends createSystem({}) {
  private readonly pivot = new Group();
  private readonly turntable = new Group();
  private readonly dishes = new Map<Recipe['dish'], Object3D>();
  private steps!: StepSystem;
  private timeS = 0;

  init(): void {
    const steps = this.world.getSystem(StepSystem);
    const kitchen = this.world.getSystem(KitchenSystem);
    if (steps == null || kitchen == null) {
      throw new Error('TitlePreviewSystem needs StepSystem and KitchenSystem');
    }
    this.steps = steps;
    const plate = kitchen.requireTool('plate').object3D;
    if (plate == null) {
      throw new Error('The plate has no object');
    }
    this.dishes.set('omelette', this.copyParts(plate, ['PlateOmelette']));
    this.dishes.set(
      'fried-rice',
      this.copyParts(plate, ['PlateRice', 'PlateScramble', 'PlateRiceOnion']),
    );
    const pancakePreview = this.copyParts(plate, ['PlateOmelette']);
    const pancakeMesh = pancakePreview.getObjectByName('PlateOmelette');
    if (pancakeMesh instanceof Mesh) {
      pancakeMesh.scale.set(1.06, 2.2, 1.06);
      (pancakeMesh.material as MeshStandardMaterial).color.set('#D68A28');
    }
    this.dishes.set('pancake', pancakePreview);
    for (const dish of this.dishes.values()) {
      this.turntable.add(dish);
    }

    this.turntable.scale.setScalar(PREVIEW_SCALE);
    this.pivot.name = 'TitlePreview';
    this.pivot.position.set(...PREVIEW_POSITION);
    this.pivot.rotation.x = PREVIEW_TILT_RAD;
    this.pivot.add(this.turntable);
    this.world.requireSceneEntity('recipe-stand').object3D?.add(this.pivot);

    const show = () => {
      this.pivot.visible = steps.isMainTitlePage;
      const active = steps.activeRecipe.dish;
      for (const [dish, object] of this.dishes) {
        object.visible = dish === active;
      }
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

  /**
   * Copies plate food meshes, centered on the turntable. The cooking system
   * recolors the plate's own meshes, so each copy gets its own material.
   */
  private copyParts(plate: Object3D, names: readonly string[]): Group {
    const dish = new Group();
    let baseY: number | null = null;
    for (const name of names) {
      const source = plate.getObjectByName(name);
      if (!(source instanceof Mesh)) {
        throw new Error(`The plate has no ${name} mesh`);
      }
      const copy = source.clone(true);
      const color = FINISHED_COLORS[name];
      if (color != null) {
        const material = (source.material as MeshStandardMaterial).clone();
        material.color.set(color);
        copy.material = material;
      }
      baseY ??= source.position.y;
      copy.position.set(0, source.position.y - baseY, 0);
      copy.traverse((part: Object3D) => {
        part.visible = true;
      });
      dish.add(copy);
    }
    return dish;
  }
}
