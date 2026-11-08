import { createSystem, type Object3D, Vector3, Visibility } from '@iwsdk/core';
import { ALL_RECIPES, sheetNodeId } from '../config/recipes/index.js';
import type { Recipe } from '../config/recipes/recipe.js';
import { SoundSystem } from './SoundSystem.js';
import { StepSystem } from './StepSystem.js';

const TURN_S = 0.7;
/** The spine runs along the sheet's left edge, half its width from center. */
const HALF_WIDTH_M = 0.2;
/** A turning page lifts a little, so it never cuts through the one below. */
const LIFT_M = 0.004;

interface Turn {
  page: Object3D;
  rest: Vector3;
  /** True when the page swings from the right onto the left (forward). */
  isForward: boolean;
  elapsedS: number;
  /** The page to hide once the turn is done. */
  hideAfter: Recipe | null;
}

/**
 * The recipe sheets are pages of a book. Choosing another recipe turns the
 * page over the spine, and only the open page stays on the table.
 */
export class BookSystem extends createSystem({}) {
  private steps!: StepSystem;
  private sound: SoundSystem | undefined;
  private shown: Recipe | null = null;
  private turn: Turn | null = null;
  private readonly rests = new Map<string, Vector3>();

  init(): void {
    const steps = this.world.getSystem(StepSystem);
    if (steps == null) {
      throw new Error('BookSystem needs StepSystem registered first');
    }
    this.steps = steps;
    this.sound = this.world.getSystem(SoundSystem);
    for (const recipe of ALL_RECIPES) {
      const page = this.pageOf(recipe);
      this.rests.set(recipe.id, page?.position.clone() ?? new Vector3());
    }
    this.cleanupFuncs.push(steps.subscribe(() => this.onStepChange()));
    this.showOnly(steps.activeRecipe);
  }

  update(delta: number): void {
    const turn = this.turn;
    if (turn == null) {
      return;
    }
    turn.elapsedS = Math.min(turn.elapsedS + delta, TURN_S);
    const t = turn.elapsedS / TURN_S;
    const eased = t * t * (3 - 2 * t);
    // Forward pages rise from flat (0) over the spine to face down on the
    // left (pi); turning back plays the same path in reverse.
    this.placePage(turn.page, turn.rest, Math.PI * (turn.isForward ? eased : 1 - eased));
    if (turn.elapsedS >= TURN_S) {
      this.placePage(turn.page, turn.rest, 0);
      if (turn.hideAfter != null) {
        this.setShown(turn.hideAfter, false);
      }
      this.turn = null;
    }
  }

  private onStepChange(): void {
    const next = this.steps.activeRecipe;
    const previous = this.shown;
    if (previous == null || next === previous) {
      return;
    }
    this.finishTurn();
    const isForward = this.steps.lastPageTurn === 1;
    this.setShown(next, true);
    // Forward: the old page lifts away to the left, revealing the new one.
    // Back: the new page comes in from the left and covers the old one.
    const moving = isForward ? previous : next;
    const page = this.pageOf(moving);
    const rest = this.rests.get(moving.id);
    this.shown = next;
    if (page == null || rest == null) {
      this.setShown(previous, false);
      return;
    }
    this.turn = {
      page,
      rest,
      isForward,
      elapsedS: 0,
      hideAfter: previous,
    };
    this.sound?.playSound('whoosh', page, 0.5, 1.6);
  }

  /** Rotates a page about the spine by `angle`, from lying open (0). */
  private placePage(page: Object3D, rest: Vector3, angle: number): void {
    const lift = Math.sin(angle) * LIFT_M;
    page.position.set(
      rest.x - HALF_WIDTH_M + HALF_WIDTH_M * Math.cos(angle),
      rest.y + HALF_WIDTH_M * Math.sin(angle) + lift,
      rest.z,
    );
    page.rotation.set(0, 0, angle);
  }

  private finishTurn(): void {
    const turn = this.turn;
    if (turn == null) {
      return;
    }
    this.placePage(turn.page, turn.rest, 0);
    if (turn.hideAfter != null) {
      this.setShown(turn.hideAfter, false);
    }
    this.turn = null;
  }

  private showOnly(active: Recipe): void {
    for (const recipe of ALL_RECIPES) {
      this.setShown(recipe, recipe === active);
    }
    this.shown = active;
  }

  private setShown(recipe: Recipe, isShown: boolean): void {
    this.world
      .requireSceneEntity(sheetNodeId(recipe))
      .setValue(Visibility, 'isVisible', isShown);
  }

  private pageOf(recipe: Recipe): Object3D | undefined {
    return this.world.requireSceneEntity(sheetNodeId(recipe)).object3D;
  }
}
