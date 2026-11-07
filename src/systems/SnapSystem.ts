import {
  createSceneMaterial,
  createSystem,
  type Entity,
  Euler,
  Grabbed,
  GrabSystem,
  type Material,
  type Mesh,
  Object3D,
  Quaternion,
  Vector3,
  Visibility,
} from '@iwsdk/core';
import { OMELETTE } from '../config/recipes/omelette.js';
import type { RecipeIngredient } from '../config/recipes/recipe.js';
import { TUNING } from '../config/tuning.js';
import { Ingredient } from '../game-components.js';
import { HomeGlide } from '../util/home-glide.js';
import { isWithinSnapZone } from '../util/snap.js';

interface SnapTarget {
  ingredient: RecipeIngredient;
  outline: Mesh;
  restingMaterial: Material;
  position: Vector3;
  quaternion: Quaternion;
}

const DEG_TO_RAD = Math.PI / 180;

/** Carries ingredients to their outlines; anything else glides back home. */
export class SnapSystem extends createSystem({
  ingredients: { required: [Ingredient] },
  held: { required: [Ingredient, Grabbed] },
}) {
  private readonly targets = new Map<string, SnapTarget>();
  private readonly glide = new HomeGlide((entity) =>
    this.setShadowVisible(entity, true),
  );
  private readonly tempPosition = new Vector3();
  private hoverMaterial!: Material;

  init(): void {
    this.hoverMaterial = createSceneMaterial({
      id: 'recipe-outline-hover',
      model: 'standard',
      baseColor: '#2FA866',
      roughness: 0.9,
    });

    const sheet = this.world.requireSceneObject<Object3D>('recipe-sheet');
    sheet.updateWorldMatrix(true, true);
    for (const ingredient of OMELETTE.ingredients) {
      const outline = sheet.getObjectByName(
        `Silhouette_${ingredient.id}`,
      ) as Mesh;
      const [x, z] = ingredient.sheetPosition;
      this.targets.set(ingredient.id, {
        ingredient,
        outline,
        restingMaterial: outline.material as Material,
        position: sheet.localToWorld(
          new Vector3(x, ingredient.restHeightM + 0.0035, z),
        ),
        quaternion: new Quaternion().setFromEuler(
          new Euler(0, 0, (ingredient.snapRollDeg ?? 0) * DEG_TO_RAD),
        ),
      });
    }

    this.cleanupFuncs.push(
      this.queries.ingredients.subscribe('qualify', (entity) =>
        this.glide.remember(entity),
      ),
      this.queries.held.subscribe('qualify', (entity) => this.onGrab(entity)),
      this.queries.held.subscribe('disqualify', (entity) =>
        this.onRelease(entity),
      ),
    );
    for (const entity of this.queries.ingredients.entities) {
      this.glide.remember(entity);
    }
  }

  update(delta: number): void {
    for (const entity of this.queries.held.entities) {
      const target = this.targetFor(entity);
      if (target != null) {
        const material = this.isOverTarget(entity, target)
          ? this.hoverMaterial
          : target.restingMaterial;
        if (target.outline.material !== material) {
          target.outline.material = material;
        }
      }
    }

    this.glide.update(delta);
  }

  /** Puts every ingredient back at its starting pose. */
  reset(): void {
    const grabSystem = this.world.getSystem(GrabSystem);
    for (const entity of this.queries.ingredients.entities) {
      if (entity.hasComponent(Grabbed)) {
        grabSystem?.forceRelease(entity);
      }
      entity.setValue(Ingredient, 'placed', false);
      this.glide.restoreStart(entity);
      this.glide.land(entity);
    }
    for (const target of this.targets.values()) {
      target.outline.material = target.restingMaterial;
    }
  }

  /** From now on, a dropped ingredient returns to its outline. */
  keepPlacedAtOutlines(): void {
    for (const entity of this.queries.ingredients.entities) {
      const target = this.targetFor(entity);
      if (target != null && entity.getValue(Ingredient, 'placed')) {
        this.glide.setHome(entity, target.position, target.quaternion);
      }
    }
  }

  private onGrab(entity: Entity): void {
    this.glide.stop(entity);
    entity.setValue(Ingredient, 'placed', false);
    this.setShadowVisible(entity, false);
  }

  private onRelease(entity: Entity): void {
    const target = this.targetFor(entity);
    if (target == null) {
      return;
    }
    target.outline.material = target.restingMaterial;
    if (this.isOverTarget(entity, target) && entity.object3D != null) {
      entity.object3D.position.copy(target.position);
      entity.object3D.quaternion.copy(target.quaternion);
      entity.setValue(Ingredient, 'placed', true);
    } else {
      this.glide.start(entity);
    }
  }

  private targetFor(entity: Entity): SnapTarget | undefined {
    const ingredientId = entity.getValue(Ingredient, 'ingredientId') ?? '';
    return this.targets.get(ingredientId);
  }

  private isOverTarget(entity: Entity, target: SnapTarget): boolean {
    if (entity.object3D == null) {
      return false;
    }
    const position = entity.object3D.getWorldPosition(this.tempPosition);
    return isWithinSnapZone(
      position.x - target.position.x,
      position.y - target.position.y,
      position.z - target.position.z,
      TUNING.snapRadiusM,
      TUNING.snapMaxHeightM,
    );
  }

  /** A contact shadow only makes sense while the object rests on the table. */
  private setShadowVisible(entity: Entity, visible: boolean): void {
    const ingredientId = entity.getValue(Ingredient, 'ingredientId');
    const shadow = this.world.requireSceneEntity(
      `ingredient-${ingredientId}-contact`,
    );
    shadow.setValue(Visibility, 'isVisible', visible);
  }
}
