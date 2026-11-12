import {
  BoxGeometry,
  type BufferAttribute,
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
import {
  type ColoredPart,
  mergeColored,
} from '../scene-assets/lib/merge-colored.js';
import { SoundSystem } from './SoundSystem.js';
import { StepSystem } from './StepSystem.js';

const TURN_S = 0.62;
const FLOATING_TURN_S = 0.64;
/** Point in normalized time (0..1) where the slid sheet clears the side edge and tucks behind. */
const TUCK_SPLIT = 0.5;
const SHEET_WIDTH_M = 0.48;
const SHEET_HEIGHT_M = 0.252;
const SEGMENTS_X = 16;

const floatingBookMaterial = new MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.86,
  metalness: 0.04,
});

function box(
  size: readonly [number, number, number],
  pos: readonly [number, number, number],
  segX = 1,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(size[0], size[1], size[2], segX, 1, 1));
  mesh.position.set(pos[0], pos[1], pos[2]);
  return mesh;
}

/**
 * Builds a single seamless, subdivided recipe paper sheet mesh (16 segments
 * along X) so it can bend smoothly without any gaps or slits.
 */
function buildSeamlessSlideSheet(): Mesh {
  const parts: ColoredPart[] = [
    // Seamless cream paper body and top/bottom border rules
    [
      box(
        [SHEET_WIDTH_M, SHEET_HEIGHT_M - 0.008, 0.0022],
        [0, 0, 0],
        SEGMENTS_X,
      ),
      '#F6F0E2',
    ],
    [
      box(
        [SHEET_WIDTH_M, 0.004, 0.0022],
        [0, SHEET_HEIGHT_M * 0.5 - 0.002, 0],
        SEGMENTS_X,
      ),
      '#D8CEB8',
    ],
    [
      box(
        [SHEET_WIDTH_M, 0.004, 0.0022],
        [0, -SHEET_HEIGHT_M * 0.5 + 0.002, 0],
        SEGMENTS_X,
      ),
      '#D8CEB8',
    ],
    // Printed recipe header, action button silhouette, amber divider, and body lines
    // Placed strictly in front of the paper face (z = +0.0019) so zero faces intersect
    [box([0.19, 0.028, 0.0014], [-0.12, 0.076, 0.0019], 6), '#2E3036'],
    [box([0.11, 0.04, 0.0014], [0.155, 0.076, 0.0019], 4), '#C9893A'],
    [box([0.43, 0.011, 0.0014], [0, 0.022, 0.0019], 14), '#CFC4AE'],
    [box([0.36, 0.01, 0.0014], [-0.035, -0.002, 0.0019], 12), '#D8CEB8'],
    [box([0.44, 0.0035, 0.0014], [0, -0.024, 0.0019], 14), '#C9893A'],
    [box([0.42, 0.028, 0.0014], [0, -0.068, 0.0019], 14), '#E5DBC6'],
  ];

  const mesh = mergeColored('FloatingSlideSheetMesh', parts, floatingBookMaterial);
  mesh.frustumCulled = false;
  return mesh;
}

interface Turn {
  page: Object3D;
  rest: Vector3;
  /** True when the page slides forward (+1). */
  isForward: boolean;
  elapsedS: number;
  /** The page to hide once the turn is done. */
  hideAfter: Recipe | null;
}

interface FloatingTurn {
  direction: 1 | -1;
  elapsedS: number;
  playedSettleSound: boolean;
}

/**
 * Animates recipe transitions like a real stack of recipe sheets:
 * 1. The front sheet curves and slides off to the side, then tucks into the back.
 * 2. The next sheet underneath rises up slightly ("naik sedikit") and steps
 *    forward to become the active front sheet.
 */
export class BookSystem extends createSystem({}) {
  private steps!: StepSystem;
  private sound: SoundSystem | undefined;
  private shown: Recipe | null = null;
  private turn: Turn | null = null;
  private floatingTurn: FloatingTurn | null = null;
  private readonly rests = new Map<string, Vector3>();
  private activePageKey = '';
  private readonly floatingBook = new Group();
  private readonly slideSheetGroup = new Group();
  private slidePosAttr: BufferAttribute | undefined;
  private baseSlidePositions: Float32Array | undefined;
  private cardObject: Object3D | undefined;
  private cardBaseScale = 0.1;

  init(): void {
    const steps = this.world.getSystem(StepSystem);
    if (steps == null) {
      throw new Error('BookSystem needs StepSystem registered first');
    }
    this.steps = steps;
    this.sound = this.world.getSystem(SoundSystem);
    this.cardObject = this.world.requireSceneEntity('recipe-card').object3D;
    this.cardBaseScale = this.cardObject?.scale.x ?? 0.1;
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
    this.activePageKey = `${steps.activeRecipe.id}:${steps.activeTitlePage}`;
    this.updateVisibility();
  }

  private buildFloatingBook(): void {
    this.floatingBook.name = 'FloatingCookbook';
    // Layered recipe pad backing and loose paper stack behind the active card (z <= -0.016)
    const backing = mergeColored(
      'FloatingBookBacking',
      [
        [box([0.508, 0.282, 0.008], [0.008, -0.004, -0.026]), '#6E351F'],
        [box([0.488, 0.258, 0.004], [0.006, -0.008, -0.018]), '#DDD1B8'],
        [box([0.022, 0.044, 0.018], [-0.257, 0.119, -0.02]), '#472011'],
        [box([0.022, 0.162, 0.018], [-0.257, 0, -0.02]), '#472011'],
        [box([0.022, 0.044, 0.018], [-0.257, -0.119, -0.02]), '#472011'],
        [box([0.024, 0.014, 0.02], [-0.257, 0.089, -0.02]), '#D4A359'],
        [box([0.024, 0.014, 0.02], [-0.257, -0.089, -0.02]), '#D4A359'],
      ],
      floatingBookMaterial,
    );
    backing.frustumCulled = false;
    this.floatingBook.add(backing);

    this.slideSheetGroup.name = 'FloatingSlideSheet';
    const sheetMesh = buildSeamlessSlideSheet();
    const posAttr = sheetMesh.geometry.getAttribute(
      'position',
    ) as BufferAttribute;
    this.slidePosAttr = posAttr;
    this.baseSlidePositions = new Float32Array(posAttr.array);
    this.slideSheetGroup.add(sheetMesh);
    this.setSlideSheetRestPose(1);
    this.floatingBook.add(this.slideSheetGroup);
  }

  /** Places the seamless paper sheet at rest tucked neatly behind the active card. */
  private setSlideSheetRestPose(direction: 1 | -1): void {
    this.slideSheetGroup.position.set(0.004 * direction, -0.006, -0.01);
    this.slideSheetGroup.rotation.set(0, 0, -0.012 * direction);
    this.applyPaperBend(direction, 0);
  }

  /**
   * Smoothly curves the seamless paper sheet vertices without any slits or
   * per-frame allocations.
   */
  private applyPaperBend(direction: 1 | -1, bendAmount: number): void {
    const posAttr = this.slidePosAttr;
    const base = this.baseSlidePositions;
    if (posAttr == null || base == null) {
      return;
    }
    const halfW = SHEET_WIDTH_M * 0.5;
    const halfH = SHEET_HEIGHT_M * 0.5;
    const count = posAttr.count;
    if (bendAmount <= 0.0001) {
      for (let i = 0; i < count; i += 1) {
        const at = i * 3;
        posAttr.setXYZ(i, base[at] ?? 0, base[at + 1] ?? 0, base[at + 2] ?? 0);
      }
      posAttr.needsUpdate = true;
      return;
    }
    for (let i = 0; i < count; i += 1) {
      const at = i * 3;
      const bx = base[at] ?? 0;
      const by = base[at + 1] ?? 0;
      const bz = base[at + 2] ?? 0;
      const nx = bx / halfW; // -1..+1
      const ny = by / halfH; // -1..+1
      // Center of the sheet arches gently; leading edge curls up as it slides
      const centerArch = Math.cos(nx * Math.PI * 0.5) * 0.012 * bendAmount;
      const leadingEdge = Math.max(0, -nx * direction);
      const edgeCurl = leadingEdge * leadingEdge * 0.022 * bendAmount;
      const cornerLift = Math.max(0, -ny) * leadingEdge * 0.008 * bendAmount;
      const foreshortenX =
        -direction * leadingEdge * leadingEdge * 0.007 * bendAmount;
      posAttr.setXYZ(
        i,
        bx + foreshortenX,
        by,
        bz + centerArch + edgeCurl + cornerLift,
      );
    }
    posAttr.needsUpdate = true;
  }

  update(delta: number): void {
    this.updateFloatingTurn(delta);
    const turn = this.turn;
    if (turn == null) {
      return;
    }
    turn.elapsedS = Math.min(turn.elapsedS + delta, TURN_S);
    const t = turn.elapsedS / TURN_S;
    const eased = 1 - Math.pow(1 - t, 3.2);
    this.placePage(turn.page, turn.rest, eased, turn.isForward ? 1 : -1);
    if (turn.elapsedS >= TURN_S) {
      this.placePage(turn.page, turn.rest, 1, 1);
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
    const dir = fTurn.direction;

    if (t < TUCK_SPLIT) {
      // Phase 1: The old front sheet curves and slides horizontally off to the side
      const u = t / TUCK_SPLIT;
      const uEase = 1 - Math.pow(1 - u, 2.3);
      const arch = Math.sin(u * Math.PI);
      this.slideSheetGroup.position.set(
        -dir * 0.51 * uEase,
        0.012 * arch - 0.01 * u,
        0.012 + 0.012 * arch,
      );
      this.slideSheetGroup.rotation.set(
        -0.045 * arch,
        -dir * 0.08 * arch,
        dir * 0.085 * arch,
      );
      this.applyPaperBend(dir, arch);
    } else {
      // Phase 2: Once clear of the side edge (|x| = 0.51 m), the slid sheet steps behind
      // the newly raised card (z = -0.010 m) and slides back in behind it
      if (!fTurn.playedSettleSound) {
        fTurn.playedSettleSound = true;
        this.sound?.playSound('whoosh', this.slideSheetGroup, 0.3, 1.72);
      }
      const v = (t - TUCK_SPLIT) / (1 - TUCK_SPLIT);
      const vEase = v * v * (3 - 2 * v);
      const tuckArch = Math.sin(v * Math.PI);
      this.slideSheetGroup.position.set(
        -dir * 0.51 * (1 - vEase) + 0.004 * dir * vEase,
        -0.01 * (1 - vEase) - 0.006 * vEase - 0.006 * tuckArch,
        -0.01,
      );
      this.slideSheetGroup.rotation.set(
        0.02 * tuckArch,
        0,
        dir * 0.04 * (1 - vEase) - 0.012 * dir * vEase,
      );
      this.applyPaperBend(dir, (1 - vEase) * 0.3);
    }

    // The new sheet to be used ("kertas yang akan digunakan") starts underneath/behind
    // at y = -0.036 m, z = -0.012 m, and rises up slightly ("naik sedikit") + steps forward
    if (this.cardObject != null) {
      const r = Math.max(0, Math.min(1, (t - 0.06) / 0.88));
      const rEase = 1 - Math.pow(1 - r, 3);
      const rem = 1 - rEase;
      const liftCrest = Math.sin(r * Math.PI);
      this.cardObject.position.set(
        dir * 0.018 * rem,
        -0.036 * rem + 0.014 * liftCrest,
        -0.012 * rem + 0.004 * liftCrest,
      );
      this.cardObject.rotation.set(
        -0.06 * liftCrest * rem,
        dir * 0.03 * rem,
        -dir * 0.02 * rem,
      );
      this.cardObject.scale.setScalar(
        this.cardBaseScale * (1 - 0.038 * rem + 0.012 * liftCrest),
      );
    }

    if (fTurn.elapsedS >= FLOATING_TURN_S) {
      this.setSlideSheetRestPose(dir);
      if (this.cardObject != null) {
        this.cardObject.position.set(0, 0, 0);
        this.cardObject.rotation.set(0, 0, 0);
        this.cardObject.scale.setScalar(this.cardBaseScale);
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

    const nextPageKey = `${next.id}:${this.steps.activeTitlePage}`;
    if (!isCooking) {
      this.finishTurn();
      if (this.shown != null) {
        for (const recipe of ALL_RECIPES) {
          this.setShown(recipe, false);
        }
        this.shown = null;
      }
      if (nextPageKey !== this.activePageKey) {
        this.activePageKey = nextPageKey;
        this.floatingTurn = {
          direction: this.steps.lastPageTurn,
          elapsedS: 0,
          playedSettleSound: false,
        };
        this.sound?.playSound('whoosh', this.slideSheetGroup, 0.55, 1.32);
      }
      return;
    }

    this.activePageKey = nextPageKey;
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
    this.sound?.playSound('whoosh', page, 0.5, 1.4);
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

  /** Slides a table recipe sheet across the book surface with a gentle paper lift. */
  private placePage(
    page: Object3D,
    rest: Vector3,
    progress: number,
    direction: 1 | -1,
  ): void {
    const rem = 1 - progress;
    const lift = Math.sin(progress * Math.PI) * 0.012;
    page.position.set(
      rest.x + direction * 0.18 * rem,
      rest.y + lift,
      rest.z - 0.02 * rem,
    );
    page.rotation.set(0, direction * 0.08 * rem, -direction * 0.04 * rem);
  }

  private finishTurn(): void {
    const turn = this.turn;
    if (turn == null) {
      return;
    }
    this.placePage(turn.page, turn.rest, 1, 1);
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
