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
import {
  type ColoredPart,
  mergeColored,
} from '../scene-assets/lib/merge-colored.js';
import { SoundSystem } from './SoundSystem.js';
import { StepSystem } from './StepSystem.js';

const TURN_S = 0.62;
const FLOATING_TURN_S = 0.58;
/** Point in normalized time (0..1) where the slid sheet clears the side edge and tucks under. */
const TUCK_SPLIT = 0.52;
const STRIP_COUNT_PER_SIDE = 4;
const STRIP_STEP_M = 0.06;
const STRIP_WIDTH_M = 0.0592;
const SHEET_HEIGHT_M = 0.252;

const floatingBookMaterial = new MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.86,
  metalness: 0.04,
});

function box(
  size: readonly [number, number, number],
  pos: readonly [number, number, number],
): Mesh {
  const mesh = new Mesh(new BoxGeometry(size[0], size[1], size[2]));
  mesh.position.set(pos[0], pos[1], pos[2]);
  return mesh;
}

/** Builds one articulated vertical slice of a printed recipe paper sheet. */
function buildPaperStripMesh(side: -1 | 1, index: number): Mesh {
  const cx = side * (STRIP_STEP_M * 0.5);
  const parts: ColoredPart[] = [
    // Main cream paper body and subtle top/bottom border rules
    [box([STRIP_WIDTH_M, SHEET_HEIGHT_M - 0.008, 0.002], [cx, 0, 0]), '#F6F0E2'],
    [
      box([STRIP_WIDTH_M, 0.004, 0.002], [cx, SHEET_HEIGHT_M * 0.5 - 0.002, 0]),
      '#D8CEB8',
    ],
    [
      box([STRIP_WIDTH_M, 0.004, 0.002], [cx, -SHEET_HEIGHT_M * 0.5 + 0.002, 0]),
      '#D8CEB8',
    ],
  ];

  // Printed header, divider, and body lines (placed strictly in front of z = +0.001)
  if (index < 3) {
    // Amber horizontal divider across the sheet
    parts.push([
      box([STRIP_WIDTH_M, 0.0035, 0.0014], [cx, -0.022, 0.0018]),
      '#C9893A',
    ]);
    // Printed instruction lines
    parts.push([
      box([STRIP_WIDTH_M * 0.92, 0.011, 0.0014], [cx, 0.022, 0.0018]),
      '#CFC4AE',
    ]);
    if (side === -1 || index < 2) {
      parts.push([
        box([STRIP_WIDTH_M * 0.88, 0.01, 0.0014], [cx, -0.002, 0.0018]),
        '#D8CEB8',
      ]);
    }
    // Bottom menu / tip strip silhouette
    parts.push([
      box([STRIP_WIDTH_M * 0.84, 0.028, 0.0014], [cx, -0.068, 0.0018]),
      '#E5DBC6',
    ]);
  }

  // Top left title block vs top right action button block
  if (side === -1 && index >= 1 && index <= 2) {
    parts.push([
      box([STRIP_WIDTH_M * 0.94, 0.028, 0.0014], [cx, 0.076, 0.0018]),
      '#2E3036',
    ]);
  } else if (side === 1 && index >= 1 && index <= 2) {
    parts.push([
      box([STRIP_WIDTH_M * 0.86, 0.038, 0.0014], [cx, 0.076, 0.0018]),
      '#C9893A',
    ]);
  }

  const mesh = mergeColored(
    `PaperStrip_${side > 0 ? 'R' : 'L'}_${index}`,
    parts,
    floatingBookMaterial,
  );
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
 * Animates recipe transitions like sliding a real, flexible sheet of paper
 * off the top of a recipe stack and tucking it underneath while the next
 * sheet glides and straightens into place.
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
  private readonly leftSegments: Group[] = [];
  private readonly rightSegments: Group[] = [];
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
    this.activePageKey = `${steps.activeRecipe.id}:${steps.activeTitlePage}`;
    this.updateVisibility();
  }

  private buildFloatingBook(): void {
    this.floatingBook.name = 'FloatingCookbook';
    // Layered recipe pad backing and loose paper stack behind the active card (z <= -0.013)
    const backing = mergeColored(
      'FloatingBookBacking',
      [
        [box([0.508, 0.282, 0.008], [0.008, -0.002, -0.024]), '#6E351F'],
        [box([0.488, 0.258, 0.004], [0.007, -0.004, -0.016]), '#DDD1B8'],
        [box([0.022, 0.044, 0.018], [-0.257, 0.119, -0.018]), '#472011'],
        [box([0.022, 0.162, 0.018], [-0.257, 0, -0.018]), '#472011'],
        [box([0.022, 0.044, 0.018], [-0.257, -0.119, -0.018]), '#472011'],
        [box([0.024, 0.014, 0.02], [-0.257, 0.089, -0.018]), '#D4A359'],
        [box([0.024, 0.014, 0.02], [-0.257, -0.089, -0.018]), '#D4A359'],
      ],
      floatingBookMaterial,
    );
    backing.frustumCulled = false;
    this.floatingBook.add(backing);

    // Articulated 8-strip flexible paper sheet that slides out from the top
    // and tucks back underneath the recipe stack
    this.slideSheetGroup.name = 'FloatingSlideSheet';
    let leftParent: Group = this.slideSheetGroup;
    let rightParent: Group = this.slideSheetGroup;
    for (let i = 0; i < STRIP_COUNT_PER_SIDE; i += 1) {
      const leftSeg = new Group();
      leftSeg.position.set(i === 0 ? 0 : -STRIP_STEP_M, 0, 0);
      leftSeg.add(buildPaperStripMesh(-1, i));
      leftParent.add(leftSeg);
      this.leftSegments.push(leftSeg);
      leftParent = leftSeg;

      const rightSeg = new Group();
      rightSeg.position.set(i === 0 ? 0 : STRIP_STEP_M, 0, 0);
      rightSeg.add(buildPaperStripMesh(1, i));
      rightParent.add(rightSeg);
      this.rightSegments.push(rightSeg);
      rightParent = rightSeg;
    }
    this.setSlideSheetRestPose(1);
    this.floatingBook.add(this.slideSheetGroup);
  }

  /** Places the articulated paper sheet at rest as a slightly fanned under-sheet in the stack. */
  private setSlideSheetRestPose(direction: 1 | -1): void {
    this.slideSheetGroup.position.set(0.005 * direction, -0.004, -0.009);
    this.slideSheetGroup.rotation.set(0, 0, -0.015 * direction);
    for (let i = 0; i < STRIP_COUNT_PER_SIDE; i += 1) {
      this.leftSegments[i]?.rotation.set(0, 0, 0);
      this.rightSegments[i]?.rotation.set(0, 0, 0);
    }
  }

  /** Applies a travelling S-curve / C-curl across the 8 hinged paper strips. */
  private setPaperCurl(direction: 1 | -1, curlAmount: number): void {
    for (let i = 0; i < STRIP_COUNT_PER_SIDE; i += 1) {
      const weight = (i + 1) / STRIP_COUNT_PER_SIDE;
      // Leading edge curls upward into the air; trailing edge peels off the stack
      const leftCurl =
        direction === 1
          ? -curlAmount * (0.09 + 0.06 * weight)
          : -curlAmount * (0.045 * weight);
      const rightCurl =
        direction === -1
          ? curlAmount * (0.09 + 0.06 * weight)
          : curlAmount * (0.045 * weight);
      this.leftSegments[i]?.rotation.set(0, leftCurl, curlAmount * 0.018 * direction);
      this.rightSegments[i]?.rotation.set(
        0,
        rightCurl,
        curlAmount * 0.018 * direction,
      );
    }
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
      // Phase 1: Top paper sheet lifts, curls across its strips, fans in-plane, and slides out to the side
      const u = t / TUCK_SPLIT;
      const uEase = 1 - Math.pow(1 - u, 2.5);
      const arch = Math.sin(u * Math.PI);
      this.slideSheetGroup.position.set(
        -dir * 0.5 * uEase,
        0.022 * arch,
        0.013 + 0.016 * arch,
      );
      this.slideSheetGroup.rotation.set(
        -0.065 * arch,
        -dir * 0.14 * arch,
        dir * 0.115 * Math.sin(u * Math.PI * 0.85),
      );
      this.setPaperCurl(dir, arch);
    } else {
      // Phase 2: Having cleared the card edge (|x| = 0.50 m), the sheet steps behind the card
      // (z = -0.009 m), uncurls, and tucks smoothly underneath the paper stack
      if (!fTurn.playedSettleSound) {
        fTurn.playedSettleSound = true;
        this.sound?.playSound('whoosh', this.slideSheetGroup, 0.28, 1.75);
      }
      const v = (t - TUCK_SPLIT) / (1 - TUCK_SPLIT);
      const vEase = v * v * (3 - 2 * v);
      const settleArch = Math.sin(v * Math.PI);
      this.slideSheetGroup.position.set(
        -dir * 0.5 * (1 - vEase) + 0.005 * dir * vEase,
        -0.009 * settleArch - 0.004 * vEase,
        -0.009,
      );
      this.slideSheetGroup.rotation.set(
        0.025 * settleArch,
        0,
        dir * 0.05 * (1 - vEase) - 0.015 * dir * vEase,
      );
      this.setPaperCurl(dir, (1 - vEase) * 0.35);
    }

    // Active recipe-card glides in from the opposite side and flattens onto the board
    if (this.cardObject != null) {
      const cardEase = 1 - Math.pow(1 - t, 3.6);
      const rem = 1 - cardEase;
      const flutter = Math.sin(t * Math.PI) * rem;
      this.cardObject.position.set(
        dir * 0.25 * rem,
        -0.016 * rem + 0.007 * flutter,
        0.004 * flutter,
      );
      this.cardObject.rotation.set(
        0.055 * flutter,
        dir * 0.16 * rem,
        -dir * 0.075 * rem,
      );
    }

    if (fTurn.elapsedS >= FLOATING_TURN_S) {
      this.setSlideSheetRestPose(dir);
      if (this.cardObject != null) {
        this.cardObject.position.set(0, 0, 0);
        this.cardObject.rotation.set(0, 0, 0);
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
