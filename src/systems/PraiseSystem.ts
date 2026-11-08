import {
  createSystem,
  type Entity,
  type Object3D,
  UIKit,
  UIKitMLAsset,
  Vector3,
  Visibility,
} from '@iwsdk/core';
import type { RecipeStep, ToolId } from '../config/recipes/recipe.js';
import { praiseFor } from '../game/praise.js';
import { CookingSystem } from './CookingSystem.js';
import { KitchenSystem } from './KitchenSystem.js';
import { ScoreSystem } from './ScoreSystem.js';
import { StepSystem } from './StepSystem.js';

const LIFE_S = 2.5;
const POP_IN_S = 0.25;
const FADE_OUT_S = 0.3;
/** The cheer starts this far over the tool and drifts up while it shows. */
const START_HEIGHT_M = 0.16;
const RISE_M = 0.08;
const OVERSHOOT = 1.7;

/** Where each finished step happened, so the cheer appears right there. */
const ANCHOR: Readonly<Partial<Record<RecipeStep['completion'], ToolId>>> = {
  crack: 'bowl',
  whisk: 'bowl',
  season: 'bowl',
  garnish: 'bowl',
  heat: 'pan',
  pour: 'pan',
  flip: 'pan',
  finish: 'pan',
  plate: 'plate',
  stir: 'pan',
  drop: 'pan',
};

function easeOutBack(t: number): number {
  const u = t - 1;
  return 1 + (OVERSHOOT + 1) * u * u * u + OVERSHOOT * u * u;
}

/** A short cheer floats up from the table each time a step is done. */
export class PraiseSystem extends createSystem({}) {
  private steps!: StepSystem;
  private score!: ScoreSystem;
  private cooking!: CookingSystem;
  private kitchen!: KitchenSystem;
  private popup!: Entity;
  private popupObject: Object3D | undefined;
  private text!: UIKit.Text;
  private baseScale = 1;
  private lastStep: RecipeStep | null = null;
  private shownS = -1;
  private readonly startAt = new Vector3();
  private readonly headAt = new Vector3();

  init(): void {
    const steps = this.world.getSystem(StepSystem);
    const score = this.world.getSystem(ScoreSystem);
    const cooking = this.world.getSystem(CookingSystem);
    const kitchen = this.world.getSystem(KitchenSystem);
    if (steps == null || score == null || cooking == null || kitchen == null) {
      throw new Error('PraiseSystem needs the kitchen systems first');
    }
    this.steps = steps;
    this.score = score;
    this.cooking = cooking;
    this.kitchen = kitchen;
    this.popup = this.world.requireSceneEntity('praise-popup');
    this.popupObject = this.popup.object3D;
    this.baseScale = this.popupObject?.scale.x ?? 1;
    this.text = this.world
      .requireSceneObject<UIKitMLAsset>('praise-popup')
      .requireElementById<UIKit.Text>('praise-text');
    this.popup.setValue(Visibility, 'isVisible', false);
    this.cleanupFuncs.push(steps.subscribe(() => this.onStepChange()));
  }

  update(delta: number): void {
    const object = this.popupObject;
    if (this.shownS < 0 || object == null) {
      return;
    }
    this.shownS += delta;
    if (this.shownS >= LIFE_S) {
      this.shownS = -1;
      this.popup.setValue(Visibility, 'isVisible', false);
      return;
    }
    const t = this.shownS;
    const grow = easeOutBack(Math.min(t / POP_IN_S, 1));
    const shrink = Math.min((LIFE_S - t) / FADE_OUT_S, 1);
    object.scale.setScalar(this.baseScale * Math.max(grow * shrink, 0.001));
    object.position.copy(this.startAt);
    object.position.y += RISE_M * (t / LIFE_S);
    this.player.head.getWorldPosition(this.headAt);
    object.lookAt(this.headAt);
  }

  private onStepChange(): void {
    const { state } = this.steps;
    const current = this.steps.step;
    const finished = this.lastStep;
    const isNewStep = current !== finished;
    this.lastStep = current;
    // Only moving forward through the recipe earns a cheer, not a restart.
    if (!isNewStep || finished == null || state.phase === 'title') {
      return;
    }
    const text = praiseFor(
      finished.completion,
      this.score.cookRecord,
      this.cooking.cookProgress,
    );
    const toolId = finished.zone ?? ANCHOR[finished.completion];
    const tool = toolId == null ? null : this.kitchen.requireTool(toolId);
    if (text == null || tool?.object3D == null) {
      return;
    }
    tool.object3D.getWorldPosition(this.startAt);
    this.startAt.y += START_HEIGHT_M;
    this.text.setProperties({ text });
    this.popup.setValue(Visibility, 'isVisible', true);
    this.shownS = 0;
  }
}
