import {
  createSystem,
  type Entity,
  Grabbed,
  GrabSystem,
  Quaternion,
  Vector3,
  Visibility,
} from '@iwsdk/core';
import { PAN_ON_STOVE_Y } from '../config/cookware.js';
import type { ToolId } from '../config/recipes/recipe.js';
import { TUNING } from '../config/tuning.js';
import { Ingredient, KitchenTool } from '../game-components.js';
import { HomeGlide } from '../util/home-glide.js';
import { isWithinSnapZone } from '../util/snap.js';
import { SnapSystem } from './SnapSystem.js';
import { StepSystem } from './StepSystem.js';

const TOOL_IDS: readonly ToolId[] = ['bowl', 'whisk', 'pan', 'stove', 'plate'];

/** Sets the table for each recipe step and handles released cookware. */
export class KitchenSystem extends createSystem({
  ingredients: { required: [Ingredient] },
  heldTools: { required: [KitchenTool, Grabbed] },
}) {
  private readonly tools = new Map<ToolId, Entity>();
  private readonly glide = new HomeGlide((entity) => this.onLanded(entity));
  private readonly stoveSeat = new Vector3();
  private readonly identity = new Quaternion();
  private readonly tempPosition = new Vector3();
  private steps!: StepSystem;
  private grabSystem: GrabSystem | undefined;
  private stageKey = '';
  private panHasSeat = false;
  private isPanOnStove = false;

  /** True while the pan sits on the stove and the recipe is underway. */
  get panOnStove(): boolean {
    return this.isPanOnStove;
  }

  init(): void {
    const steps = this.world.getSystem(StepSystem);
    if (steps == null) {
      throw new Error('KitchenSystem needs StepSystem registered first');
    }
    this.steps = steps;
    this.grabSystem = this.world.getSystem(GrabSystem);

    for (const toolId of TOOL_IDS) {
      const entity = this.world.requireSceneEntity(`tool-${toolId}`);
      this.tools.set(toolId, entity);
      this.glide.remember(entity);
    }
    const stove = this.requireTool('stove').object3D;
    stove?.getWorldPosition(this.stoveSeat);
    this.stoveSeat.y = PAN_ON_STOVE_Y;

    this.cleanupFuncs.push(
      steps.subscribe(() => this.applyStage()),
      this.queries.heldTools.subscribe('qualify', (entity) =>
        this.onGrab(entity),
      ),
      this.queries.heldTools.subscribe('disqualify', (entity) =>
        this.onRelease(entity),
      ),
    );
    this.applyStage();
  }

  update(delta: number): void {
    this.glide.update(delta);
  }

  requireTool(toolId: ToolId): Entity {
    const entity = this.tools.get(toolId);
    if (entity == null) {
      throw new Error(`Unknown tool ${toolId}`);
    }
    return entity;
  }

  /** Writes the stove center, at pan height, into `target`. */
  copyStoveSeat(target: Vector3): Vector3 {
    return target.copy(this.stoveSeat);
  }

  /** Takes the pan out of the hand and sends it back to the stove. */
  dropPan(): void {
    const pan = this.requireTool('pan');
    if (pan.hasComponent(Grabbed)) {
      this.grabSystem?.forceRelease(pan);
    }
  }

  private applyStage(): void {
    const { state, step } = this.steps;
    if (state.phase === 'done') {
      this.isPanOnStove = false;
      this.setToolFlame(false);
    }
    const key =
      state.phase === 'cooking' ? `step-${state.stepIndex}` : state.phase;
    if (key === this.stageKey) {
      return;
    }
    this.stageKey = key;
    if (state.phase === 'done') {
      this.lockEverything();
      return;
    }
    if (state.phase === 'title') {
      this.resetTable();
    }
    for (const [toolId, entity] of this.tools) {
      const isShown = step?.tools.includes(toolId) ?? false;
      this.setGrabbable(entity, step?.grabbableTools.includes(toolId) ?? false);
      entity.setValue(Visibility, 'isVisible', isShown);
    }
    if (step != null && step.completion !== 'place-ingredients') {
      this.world.getSystem(SnapSystem)?.keepPlacedAtOutlines();
    }
    for (const entity of this.queries.ingredients.entities) {
      const id = entity.getValue(Ingredient, 'ingredientId') ?? '';
      this.setGrabbable(
        entity,
        step == null || step.grabbableIngredients.includes(id),
      );
      entity.setValue(
        Visibility,
        'isVisible',
        step == null || step.ingredients.includes(id),
      );
    }
  }

  private resetTable(): void {
    this.panHasSeat = false;
    this.isPanOnStove = false;
    this.setToolFlame(false);
    for (const entity of this.tools.values()) {
      this.glide.restoreStart(entity);
      this.glide.land(entity);
    }
  }

  private lockEverything(): void {
    for (const entity of this.tools.values()) {
      this.setGrabbable(entity, false);
    }
  }

  /** A locked object ignores the grab pointer, so a pinch passes through it. */
  private setGrabbable(entity: Entity, isGrabbable: boolean): void {
    if (!isGrabbable && entity.hasComponent(Grabbed)) {
      this.grabSystem?.forceRelease(entity);
    }
    if (entity.object3D != null) {
      entity.object3D.pointerEvents = isGrabbable ? 'auto' : 'none';
    }
  }

  private onGrab(entity: Entity): void {
    this.glide.stop(entity);
    if (entity === this.tools.get('bowl')) {
      this.setBowlShadowVisible(false);
    }
    if (entity === this.tools.get('pan')) {
      this.isPanOnStove = false;
      this.setToolFlame(false);
    }
  }

  private onRelease(entity: Entity): void {
    if (entity === this.tools.get('pan') && this.isPanOverStove()) {
      this.seatPan();
    } else {
      this.glide.start(entity);
    }
  }

  private onLanded(entity: Entity): void {
    if (entity === this.tools.get('bowl')) {
      this.setBowlShadowVisible(true);
    }
    if (entity === this.tools.get('pan') && this.panHasSeat) {
      this.isPanOnStove = this.steps.state.phase === 'cooking';
      this.setToolFlame(this.isPanOnStove);
    }
  }

  private isPanOverStove(): boolean {
    const pan = this.requireTool('pan').object3D;
    if (pan == null) {
      return false;
    }
    const position = pan.getWorldPosition(this.tempPosition);
    return isWithinSnapZone(
      position.x - this.stoveSeat.x,
      position.y - this.stoveSeat.y,
      position.z - this.stoveSeat.z,
      TUNING.stoveSnapRadiusM,
      TUNING.snapMaxHeightM,
    );
  }

  private seatPan(): void {
    const pan = this.requireTool('pan');
    this.panHasSeat = true;
    this.glide.setHome(pan, this.stoveSeat, this.identity);
    this.glide.land(pan);
  }

  /** A contact shadow only makes sense while the bowl rests on the table. */
  private setBowlShadowVisible(isVisible: boolean): void {
    this.world
      .requireSceneEntity('tool-bowl-contact')
      .setValue(Visibility, 'isVisible', isVisible);
  }

  private setToolFlame(isLit: boolean): void {
    const flame = this.tools.get('stove')?.object3D?.getObjectByName('StoveFlame');
    if (flame != null) {
      flame.visible = isLit;
    }
  }
}
