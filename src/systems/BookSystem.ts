import {
  BoxGeometry,
  createSystem,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  Vector3,
  Visibility,
} from '@iwsdk/core';
import { ALL_RECIPES, sheetNodeId } from '../config/recipes/index.js';
import type { Recipe } from '../config/recipes/recipe.js';
import { mergeColored } from '../scene-assets/lib/merge-colored.js';
import { SoundSystem } from './SoundSystem.js';
import { StepSystem } from './StepSystem.js';

const TURN_S = 0.7;
const FLOATING_TURN_S = 0.52;
/** The spine runs along the sheet's left edge, half its width from center. */
const HALF_WIDTH_M = 0.2;
/** A turning page lifts a little, so it never cuts through the one below. */
const LIFT_M = 0.004;

const floatingBookMaterial = new MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.85,
  metalness: 0.05,
});

function box(
  size: readonly [number, number, number],
  pos: readonly [number, number, number],
): Mesh {
  const mesh = new Mesh(new BoxGeometry(size[0], size[1], size[2]));
  mesh.position.set(pos[0], pos[1], pos[2]);
  return mesh;
}

interface Turn {
  page: Object3D;
  rest: Vector3;
  /** True when the page swings from the right onto the left (forward). */
  isForward: boolean;
  elapsedS: number;
  /** The page to hide once the turn is done. */
  hideAfter: Recipe | null;
}

interface FloatingTurn {
  isForward: boolean;
  elapsedS: number;
}

/**
 * The recipe sheets are pages of a book. Choosing another recipe turns the
 * 3D paper page over the cookbook spine with a smooth page-flip animation.
 */
export class BookSystem extends createSystem({}) {
  private steps!: StepSystem;
  private sound: SoundSystem | undefined;
  private shown: Recipe | null = null;
  private turn: Turn | null = null;
  private floatingTurn: FloatingTurn | null = null;
  private readonly rests = new Map<string, Vector3>();
  private activeRecipeId = '';
  private readonly floatingBook = new Group();
  private readonly floatingTurnPivot = new Group();
  private cardObject: Object3D | undefined;

  init(): void {
    const steps = this.world.getSystem(StepSystem);
    if (steps == null) {
      throw new Error('BookSystem needs StepSystem registered first');
    }
    this.steps = steps;
    this.sound = this.world.getSystem(SoundSystem);
    this.cardObject = this.world.requireSceneEntity('recipe-card').object3D;
    this.buildFloatingBook();
    this.world
      .requireSceneEntity('recipe-stand')
      .object3D?.add(this.floatingBook);

    for (const recipe of ALL_RECIPES) {
      const page = this.pageOf(recipe);
      this.rests.set(recipe.id, page?.position.clone() ?? new Vector3());
    }
    this.cleanupFuncs.push(
      steps.subscribe(() => this.onStepChange()),
      () => this.floatingBook.removeFromParent(),
    );
    this.activeRecipeId = steps.activeRecipe.id;
    this.updateVisibility();
  }

  private buildFloatingBook(): void {
    this.floatingBook.name = 'FloatingCookbook';
    // Leather cover, left binding spine with brass bands, and stacked paper edges
    // Every box is strictly non-overlapping and behind the UIKit card (z = 0)
    const backing = mergeColored(
      'FloatingBookBacking',
      [
        [box([0.506, 0.282, 0.008], [0.009, 0, -0.022]), '#6E351F'],
        [box([0.494, 0.264, 0.008], [0.005, 0, -0.012]), '#E6DCC5'],
        [box([0.024, 0.044, 0.02], [-0.256, 0.119, -0.016]), '#472011'],
        [box([0.024, 0.162, 0.02], [-0.256, 0, -0.016]), '#472011'],
        [box([0.024, 0.044, 0.02], [-0.256, -0.119, -0.016]), '#472011'],
        [box([0.024, 0.014, 0.022], [-0.256, 0.089, -0.016]), '#D4A359'],
        [box([0.024, 0.014, 0.022], [-0.256, -0.089, -0.016]), '#D4A359'],
      ],
      floatingBookMaterial,
    );
    backing.frustumCulled = false;
    this.floatingBook.add(backing);

    // 3D turning paper sheet hinged at the left spine (-0.24 m)
    this.floatingTurnPivot.name = 'FloatingTurnPagePivot';
    this.floatingTurnPivot.position.set(-0.24, 0, 0.018);
    const turnSheet = mergeColored(
      'FloatingTurnSheet',
      [
        [box([0.476, 0.248, 0.003], [0.238, 0, 0]), '#F6F0E2'],
        [box([0.42, 0.016, 0.002], [0.238, 0.075, 0.003]), '#D8CEB8'],
        [box([0.42, 0.004, 0.002], [0.238, 0.03, 0.003]), '#C9893A'],
        [box([0.36, 0.01, 0.002], [0.208, -0.015, 0.003]), '#D8CEB8'],
        [box([0.3, 0.01, 0.002], [0.178, -0.045, 0.003]), '#D8CEB8'],
      ],
      floatingBookMaterial,
    );
    turnSheet.frustumCulled = false;
    this.floatingTurnPivot.add(turnSheet);
    this.floatingTurnPivot.visible = false;
    this.floatingBook.add(this.floatingTurnPivot);
  }

  update(delta: number): void {
    this.updateFloatingTurn(delta);
    const turn = this.turn;
    if (turn == null) {
      return;
    }
    turn.elapsedS = Math.min(turn.elapsedS + delta, TURN_S);
    const t = turn.elapsedS / TURN_S;
    const eased = t * t * (3 - 2 * t);
    this.placePage(
      turn.page,
      turn.rest,
      Math.PI * (turn.isForward ? eased : 1 - eased),
    );
    if (turn.elapsedS >= TURN_S) {
      this.placePage(turn.page, turn.rest, 0);
      if (turn.hideAfter != null) {
        this.setShown(turn.hideAfter, false);
      }
      this.turn = null;
    }
  }

  private updateFloatingTurn(delta: number): void {
    const fTurn = this.floatingTurn;
    if (fTurn == null) {
      return;
    }
    fTurn.elapsedS = Math.min(fTurn.elapsedS + delta, FLOATING_TURN_S);
    const t = fTurn.elapsedS / FLOATING_TURN_S;
    const eased = t * t * (3 - 2 * t);
    // Swing the 3D paper sheet across the left spine and slide the card into place
    const progress = fTurn.isForward ? eased : 1 - eased;
    const angle = -Math.PI * 0.92 * progress;
    this.floatingTurnPivot.rotation.set(0, angle, 0);
    this.floatingTurnPivot.position.z = 0.016 + Math.sin(t * Math.PI) * 0.028;
    if (this.cardObject != null) {
      const slideOffset = (fTurn.isForward ? 1 : -1) * (1 - eased) * 0.045;
      this.cardObject.position.x = slideOffset;
    }
    if (fTurn.elapsedS >= FLOATING_TURN_S) {
      this.floatingTurnPivot.visible = false;
      this.floatingTurnPivot.rotation.set(0, 0, 0);
      if (this.cardObject != null) {
        this.cardObject.position.x = 0;
      }
      this.floatingTurn = null;
    }
  }

  private onStepChange(): void {
    const next = this.steps.activeRecipe;
    const isCooking = this.steps.state.phase !== 'title';
    this.floatingBook.visible = !this.steps.isGamePaused;

    this.world
      .requireSceneEntity('recipe-book')
      .setValue(Visibility, 'isVisible', isCooking);

    if (!isCooking) {
      this.finishTurn();
      if (this.shown != null) {
        for (const recipe of ALL_RECIPES) {
          this.setShown(recipe, false);
        }
        this.shown = null;
      }
      if (next.id !== this.activeRecipeId) {
        this.activeRecipeId = next.id;
        this.floatingTurnPivot.visible = true;
        this.floatingTurn = {
          isForward: this.steps.lastPageTurn === 1,
          elapsedS: 0,
        };
        this.sound?.playSound('whoosh', this.floatingTurnPivot, 0.55, 1.5);
      }
      return;
    }

    this.activeRecipeId = next.id;
    if (this.shown == null) {
      this.showOnly(next);
      return;
    }

    const previous = this.shown;
    if (next === previous) {
      return;
    }
    this.finishTurn();
    const isForward = this.steps.lastPageTurn === 1;
    this.setShown(next, true);
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

  private updateVisibility(): void {
    const isCooking = this.steps.state.phase !== 'title';
    this.floatingBook.visible = !this.steps.isGamePaused;
    this.world
      .requireSceneEntity('recipe-book')
      .setValue(Visibility, 'isVisible', isCooking);
    if (!isCooking) {
      for (const recipe of ALL_RECIPES) {
        this.setShown(recipe, false);
      }
      this.shown = null;
    } else {
      this.showOnly(this.steps.activeRecipe);
    }
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
