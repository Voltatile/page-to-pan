import {
  createSystem,
  type Entity,
  Euler,
  Grabbed,
  GrabSystem,
  type Object3D,
  Quaternion,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { COOKWARE, WHISK_TIP_IN_BOWL_Y } from '../config/cookware.js';
import type {
  RecipeStep,
  StepCompletion,
  ToolId,
} from '../config/recipes/recipe.js';
import { TUNING } from '../config/tuning.js';
import { COOK_ZONE, FLIP_READY_PROGRESS } from '../game/cooking.js';
import {
  CrackDetector,
  FlickDetector,
  PourTimer,
  TipCounter,
  WhiskTracker,
} from '../game/gestures.js';
import { isWithinSnapZone } from '../util/snap.js';
import { CookingSystem } from './CookingSystem.js';
import { EffectsSystem } from './EffectsSystem.js';
import { EggShellSystem } from './EggShellSystem.js';
import { GuideSystem } from './GuideSystem.js';
import { KitchenSystem } from './KitchenSystem.js';
import { ScoreSystem } from './ScoreSystem.js';
import { SoundSystem } from './SoundSystem.js';
import { StepSystem } from './StepSystem.js';

const DEG_TO_RAD = Math.PI / 180;

/** Dropped garnish bits start this far above the bowl base. */
const BOWL_DROP_Y_M = 0.1;

type Zone = NonNullable<RecipeStep['zone']>;

/** Where a stirring tool's tip rests, above the zone's origin. */
const STIR_TIP_Y: Readonly<Record<Zone, number>> = {
  bowl: WHISK_TIP_IN_BOWL_Y,
  pan: -COOKWARE.pan.height / 2 + 0.006,
};
/** Falling bits disappear at the food surface, this far above the zone origin. */
const FOOD_Y: Readonly<Record<Zone, number>> = { bowl: 0.02, pan: 0.004 };

/** The whisk model lies along X with its head at -X. */
const WHISK_AXIS = new Vector3(1, 0, 0);
const WHISK_UPRIGHT = new Quaternion().setFromEuler(
  new Euler(0, 0, Math.PI / 2),
);

/**
 * Turns hand and tool movement into recipe progress. Each frame it runs only
 * the detector for the current step.
 * QUEST-CHECK: every threshold is tuned on the emulator. See
 * docs/quest-checklist.md.
 */
export class GestureSystem extends createSystem({}) {
  private readonly crack = new CrackDetector();
  private readonly whisk = new WhiskTracker();
  private readonly salt = new TipCounter();
  private readonly pour = new PourTimer();
  private readonly flick = new FlickDetector();
  private readonly leftHand = new Vector3();
  private readonly rightHand = new Vector3();
  private readonly positionA = new Vector3();
  private readonly positionB = new Vector3();
  private readonly orientation = new Quaternion();
  private readonly up = new Vector3();
  private readonly whiskTarget = new Vector3();
  private readonly whiskLean = new Vector3();
  private readonly whiskTargetTurn = new Quaternion();
  private readonly whiskShownAt = new Vector3();
  private readonly whiskShownTurn = new Quaternion();
  private readonly gripAtGrab = new Quaternion();
  private readonly panShownAt = new Vector3();
  private readonly panShownTurn = new Quaternion();
  private readonly shakerTurn = new Quaternion();
  private readonly shakerShownTurn = new Quaternion();
  private steps!: StepSystem;
  private kitchen!: KitchenSystem;
  private cooking!: CookingSystem;
  private score!: ScoreSystem;
  private sound!: SoundSystem;
  private effects!: EffectsSystem;
  private guide: GuideSystem | undefined;
  private shells: EggShellSystem | undefined;
  private grabSystem: GrabSystem | undefined;
  private readonly ingredients = new Map<string, Entity>();
  private butter!: Entity;
  private activeStep: StepCompletion | null = null;
  private activeRecipeStep: RecipeStep | null = null;
  private whiskTurnsShown = 0;
  private isButterOverPan = false;
  private isItemOverZone = false;
  private isPanInHand = false;
  private hasTossed = false;
  /** A lift only counts once the pan has sat on the stove in this step. */
  private hasPanCooked = false;
  private isWhiskInHand = false;
  private isShakerInHand = false;


  init(): void {
    const steps = this.world.getSystem(StepSystem);
    const kitchen = this.world.getSystem(KitchenSystem);
    const cooking = this.world.getSystem(CookingSystem);
    const score = this.world.getSystem(ScoreSystem);
    const sound = this.world.getSystem(SoundSystem);
    const effects = this.world.getSystem(EffectsSystem);
    if (
      steps == null ||
      kitchen == null ||
      cooking == null ||
      score == null ||
      sound == null ||
      effects == null
    ) {
      throw new Error('GestureSystem needs its systems registered first');
    }
    this.sound = sound;
    this.effects = effects;
    this.guide = this.world.getSystem(GuideSystem);
    this.shells = this.world.getSystem(EggShellSystem);
    this.steps = steps;
    this.kitchen = kitchen;
    this.cooking = cooking;
    this.score = score;
    this.grabSystem = this.world.getSystem(GrabSystem);
    this.butter = this.ingredient('butter');
  }

  private ingredient(id: string): Entity {
    let entity = this.ingredients.get(id);
    if (entity == null) {
      entity = this.world.requireSceneEntity(`ingredient-${id}`);
      this.ingredients.set(id, entity);
    }
    return entity;
  }

  /** The center of the bowl or pan where a step happens, written into `out`. */
  private zoneCenter(zone: Zone, out: Vector3): Vector3 | null {
    return this.kitchen.requireTool(zone).object3D?.getWorldPosition(out) ?? null;
  }

  private zoneRadius(zone: Zone, bowlRadius: number): number {
    return zone === 'pan' ? TUNING.panZoneRadiusM : bowlRadius;
  }

  update(delta: number): void {
    if (
      this.world.visibilityState.peek() !== VisibilityState.Visible ||
      this.steps.isGamePaused
    ) {
      return;
    }
    this.updatePanHold(delta);
    const current = this.steps.step;
    const step = current?.completion ?? null;
    if (current !== this.activeRecipeStep) {
      this.activeRecipeStep = current;
      this.activeStep = step;
      this.beginStep(current);
    }
    if (current == null) {
      return;
    }
    switch (step) {
      case 'crack':
        this.updateCrack(current);
        break;
      case 'whisk':
      case 'stir':
        this.updateStir(current, delta);
        break;
      case 'season':
        this.updateSeason(current, delta);
        break;
      case 'garnish':
      case 'drop':
        this.updateDrop(current);
        break;
      case 'seat-pan':
        if (this.kitchen.panOnStove) {
          this.steps.completeStep();
        }
        break;
      case 'heat':
        this.updateHeat();
        break;
      case 'pour':
        this.updatePour(delta);
        break;
      case 'cook':
        this.updatePanLift(FLIP_READY_PROGRESS);
        break;
      case 'flip':
        this.updateFlip(delta);
        break;
      case 'finish':
        this.updatePanLift(COOK_ZONE.rawBelow);
        break;
      case 'plate':
        this.updatePlate();
        break;
      default:
        break;
    }
  }

  private beginStep(recipeStep: RecipeStep | null): void {
    const step = recipeStep?.completion ?? null;
    if (step === 'crack') {
      this.crack.reset();
    } else if (step === 'whisk' || step === 'stir') {
      this.whisk.reset();
      this.isWhiskInHand = false;
      this.whiskTurnsShown = 0;
      this.steps.setProgress(`0/${this.turnsFor(recipeStep)}`);
    } else if (step === 'season') {
      this.salt.reset();
      this.isShakerInHand = false;
      this.steps.setProgress('0');
    } else if (step === 'garnish' || step === 'drop') {
      this.isItemOverZone = false;
    } else if (step === 'heat') {
      this.isButterOverPan = false;
    } else if (step === 'pour') {
      this.pour.reset();
    } else if (step === 'cook' || step === 'finish') {
      this.hasPanCooked = false;
      this.cooking.showDoneness();
    } else if (step === 'flip') {
      this.flick.reset();
      this.hasTossed = false;
    }
  }

  private turnsFor(step: RecipeStep | null): number {
    return step?.turns ?? TUNING.whiskTargetTurns;
  }

  private updateCrack(step: RecipeStep): void {
    const zone = step.zone ?? 'bowl';
    const eggEntity = this.ingredient(step.item ?? 'egg');
    this.player.gripSpaces.left.getWorldPosition(this.leftHand);
    this.player.gripSpaces.right.getWorldPosition(this.rightHand);
    const xr = this.input.xr;
    const isPinching =
      xr.getSelectState('left').active && xr.getSelectState('right').active;
    const egg = eggEntity.object3D?.getWorldPosition(this.positionA);
    const bowl = this.zoneCenter(zone, this.positionB);
    const isNearEgg =
      egg != null &&
      bowl != null &&
      eggEntity.hasComponent(Grabbed) &&
      isWithinSnapZone(
        egg.x - bowl.x,
        egg.y - bowl.y,
        egg.z - bowl.z,
        TUNING.crackZoneRadiusM,
        TUNING.bowlZoneHeightM,
      ) &&
      this.leftHand.distanceTo(egg) <= TUNING.crackReachM &&
      this.rightHand.distanceTo(egg) <= TUNING.crackReachM;
    const spread = this.leftHand.distanceTo(this.rightHand);
    if (this.crack.update(isPinching, isNearEgg, spread, TUNING.crackPullM)) {
      if (egg != null && bowl != null) {
        this.score.noteCrack(
          Math.min(
            Math.hypot(egg.x - bowl.x, egg.z - bowl.z) /
              TUNING.crackZoneRadiusM,
            1,
          ),
        );
        this.sound.playSound('crack', egg);
        this.effects.burst('yolk', egg, bowl.y + FOOD_Y[zone]);
        this.shells?.crack(egg);
      }
      this.cooking.onCrack(zone);
      this.steps.completeStep();
    }
  }

  private updateStir(step: RecipeStep, delta: number): void {
    const zone = step.zone ?? 'bowl';
    const toolId: ToolId = step.tool ?? 'whisk';
    const whisk = this.kitchen.requireTool(toolId);
    const object = whisk.object3D;
    const bowlAt = this.zoneCenter(zone, this.positionB);
    const holder = this.grabSystem?.getHolderHand(whisk) ?? null;
    if (object == null || bowlAt == null || holder == null) {
      this.isWhiskInHand = false;
      return;
    }
    const hand = this.player.gripSpaces[holder].getWorldPosition(
      this.positionA,
    );
    const offsetX = hand.x - bowlAt.x;
    const offsetZ = hand.z - bowlAt.z;
    const isInBowl = isWithinSnapZone(
      offsetX,
      hand.y - bowlAt.y,
      offsetZ,
      this.zoneRadius(zone, TUNING.bowlZoneRadiusM),
      TUNING.bowlZoneHeightM,
    );
    this.poseWhisk(object, holder, hand, bowlAt, isInBowl, delta, zone, toolId);
    const turns = this.whisk.update(
      offsetX,
      offsetZ,
      isInBowl,
      TUNING.whiskMinRadiusM,
      TUNING.gestureSmoothing,
    );
    const target = this.turnsFor(step);
    this.cooking.setStirProgress(zone, Math.min(turns / target, 1));
    this.guide?.showProgress(turns / target);
    const fullTurns = Math.floor(turns);
    if (fullTurns !== this.whiskTurnsShown) {
      if (fullTurns > this.whiskTurnsShown) {
        this.sound.playSound('clink', bowlAt, 1, 0.9 + Math.random() * 0.2);
      }
      this.whiskTurnsShown = fullTurns;
      this.steps.setProgress(`${Math.min(fullTurns, target)}/${target}`);
    }
    if (turns >= target) {
      this.score.noteWhisk((turns / target) * TUNING.whiskTargetTurns);
      this.steps.completeStep();
    }
  }

  /**
   * Holds the whisk head down. Near the bowl its tip stays inside and the
   * handle leans out toward the hand, like a real whisk. The hand may circle
   * wider than the bowl: the tip traces a smaller circle, so shaky tracking
   * never pulls it through the wall.
   */
  private poseWhisk(
    object: Object3D,
    holder: 'left' | 'right',
    hand: Vector3,
    bowlAt: Vector3,
    isInBowl: boolean,
    delta: number,
    zone: Zone,
    toolId: ToolId,
  ): void {
    if (!this.isWhiskInHand) {
      this.isWhiskInHand = true;
      this.whiskShownAt.copy(object.position);
      this.whiskShownTurn.copy(object.quaternion);
    }
    if (isInBowl) {
      const offsetX = hand.x - bowlAt.x;
      const offsetZ = hand.z - bowlAt.z;
      const radius = Math.hypot(offsetX, offsetZ);
      const headRadius =
        zone === 'pan' ? TUNING.panStirHeadRadiusM : TUNING.whiskHeadRadiusM;
      const scale = Math.min(headRadius / (radius || 1), 1);
      this.whiskTarget.set(
        bowlAt.x + offsetX * scale,
        bowlAt.y + STIR_TIP_Y[zone],
        bowlAt.z + offsetZ * scale,
      );
      this.setWhiskLean(holder, hand);
      this.whiskTargetTurn.setFromUnitVectors(WHISK_AXIS, this.whiskLean);
      const length =
        toolId === 'spatula' ? COOKWARE.spatula.length : COOKWARE.whisk.length;
      this.whiskTarget.addScaledVector(this.whiskLean, length / 2);
    } else {
      this.whiskTarget.set(hand.x, hand.y - TUNING.whiskUnderHandM, hand.z);
      this.whiskTargetTurn.copy(WHISK_UPRIGHT);
    }
    const blend = Math.min(TUNING.whiskFollowRatePerS * delta, 1);
    this.whiskShownAt.lerp(this.whiskTarget, blend);
    this.whiskShownTurn.slerp(this.whiskTargetTurn, blend);
    object.position.copy(this.whiskShownAt);
    object.quaternion.copy(this.whiskShownTurn);
  }

  /** Points `whiskLean` from the whisk tip toward the hand, within the tilt limits. */
  private setWhiskLean(holder: 'left' | 'right', hand: Vector3): void {
    const side = holder === 'left' ? -1 : 1;
    const x = hand.x + side * TUNING.whiskLeanSideM - this.whiskTarget.x;
    const y = hand.y - this.whiskTarget.y;
    const z = hand.z + TUNING.whiskLeanTowardPlayerM - this.whiskTarget.z;
    const reach = Math.hypot(x, z);
    const tilt = Math.min(
      Math.max(
        Math.atan2(reach, y),
        TUNING.whiskMinTiltDeg * DEG_TO_RAD,
      ),
      TUNING.whiskMaxTiltDeg * DEG_TO_RAD,
    );
    const lean = Math.sin(tilt) / (reach || 1);
    this.whiskLean.set(x * lean, Math.cos(tilt), z * lean);
  }

  /**
   * The shaker lies flat on the sheet, so it stands up in the hand, cap on top,
   * and then turns with the wrist. That way the wrist tips the cap where the
   * player expects, and `up` ends up holding the shaker's up axis.
   */
  private poseShaker(
    object: Object3D,
    holder: 'left' | 'right',
    delta: number,
  ): void {
    const grip = this.player.gripSpaces[holder].getWorldQuaternion(
      this.orientation,
    );
    if (!this.isShakerInHand) {
      this.isShakerInHand = true;
      this.gripAtGrab.copy(grip).invert();
      this.shakerShownTurn.copy(object.quaternion);
    }
    this.shakerTurn.copy(grip).multiply(this.gripAtGrab);
    this.shakerShownTurn.slerp(
      this.shakerTurn,
      Math.min(TUNING.whiskFollowRatePerS * delta, 1),
    );
    object.quaternion.copy(this.shakerShownTurn);
    this.up.set(0, 1, 0).applyQuaternion(this.shakerShownTurn);
  }

  private updateSeason(step: RecipeStep, delta: number): void {
    const zone = step.zone ?? 'bowl';
    const itemId = step.item ?? 'salt';
    const shaker = this.ingredient(itemId);
    const object = shaker.object3D;
    const bowlAt = this.zoneCenter(zone, this.positionB);
    if (object == null || bowlAt == null) {
      return;
    }
    const holder = this.grabSystem?.getHolderHand(shaker) ?? null;
    if (holder == null) {
      this.isShakerInHand = false;
      return;
    }
    this.poseShaker(object, holder, delta);
    // The cap has to be over the bowl, so tipping it away spills no salt.
    const capAt = object.getWorldPosition(this.positionA);
    const length =
      this.steps.activeRecipe.ingredients.find(
        (ingredient) => ingredient.id === itemId,
      )?.lengthM ?? 0.1;
    capAt.addScaledVector(this.up, length / 2);
    const isOverBowl = isWithinSnapZone(
      capAt.x - bowlAt.x,
      capAt.y - bowlAt.y,
      capAt.z - bowlAt.z,
      this.zoneRadius(zone, TUNING.seasonZoneRadiusM),
      TUNING.bowlZoneHeightM,
    );
    const hasTipped = this.salt.update(
      Math.acos(Math.min(Math.max(this.up.y, -1), 1)),
      isOverBowl,
      TUNING.saltTipDeg * DEG_TO_RAD,
      TUNING.saltRearmDeg * DEG_TO_RAD,
    );
    if (hasTipped) {
      const isSalt = itemId === 'salt';
      this.sound.playSound('shake', capAt, 1, isSalt ? 1 : 0.55);
      this.effects.burst(isSalt ? 'salt' : 'soy', capAt, bowlAt.y + FOOD_Y[zone]);
      this.cooking.onSeason(itemId, this.salt.count);
      this.score.noteSalt(this.salt.count);
      this.steps.setProgress(String(this.salt.count));
      this.steps.setActionReady(true);
    }
  }

  /**
   * The pan swings around its long handle, so a small flick of the hand would
   * jolt it. A held pan eases toward the hand instead.
   */
  private updatePanHold(delta: number): void {
    const pan = this.kitchen.requireTool('pan');
    const object = pan.object3D;
    if (object == null || !pan.hasComponent(Grabbed)) {
      this.isPanInHand = false;
      return;
    }
    if (!this.isPanInHand) {
      this.isPanInHand = true;
      this.panShownAt.copy(object.position);
      this.panShownTurn.copy(object.quaternion);
    }
    const blend = Math.min(TUNING.panFollowRatePerS * delta, 1);
    this.panShownAt.lerp(object.position, blend);
    this.panShownTurn.slerp(object.quaternion, blend);
    object.position.copy(this.panShownAt);
    object.quaternion.copy(this.panShownTurn);
  }

  /** An ingredient counts once it is let go over the bowl or pan. */
  private updateDrop(step: RecipeStep): void {
    const zone = step.zone ?? 'bowl';
    const itemId = step.item ?? 'green-onion';
    const item = this.ingredient(itemId);
    if (item.hasComponent(Grabbed)) {
      const bowlAt = this.zoneCenter(zone, this.positionB);
      const itemAt = item.object3D?.getWorldPosition(this.positionA);
      this.isItemOverZone =
        bowlAt != null &&
        itemAt != null &&
        isWithinSnapZone(
          itemAt.x - bowlAt.x,
          itemAt.y - bowlAt.y,
          itemAt.z - bowlAt.z,
          this.zoneRadius(zone, TUNING.bowlZoneRadiusM),
          TUNING.bowlZoneHeightM,
        );
    } else if (this.isItemOverZone) {
      this.isItemOverZone = false;
      const bowlAt = this.zoneCenter(zone, this.positionB);
      if (bowlAt != null) {
        this.sound.playSound('plop', bowlAt);
        if (itemId === 'green-onion') {
          this.positionA.copy(bowlAt);
          this.positionA.y += BOWL_DROP_Y_M;
          this.effects.burst('onion', this.positionA, bowlAt.y + FOOD_Y[zone]);
        }
      }
      this.cooking.onDrop(itemId, zone);
      this.steps.completeStep();
    }
  }

  /** The butter counts once it is let go over the pan on the stove. */
  private updateHeat(): void {
    if (this.butter.hasComponent(Grabbed)) {
      const stove = this.kitchen.copyStoveSeat(this.positionB);
      const butterAt = this.butter.object3D?.getWorldPosition(this.positionA);
      this.isButterOverPan =
        butterAt != null &&
        this.kitchen.panOnStove &&
        isWithinSnapZone(
          butterAt.x - stove.x,
          butterAt.y - stove.y,
          butterAt.z - stove.z,
          TUNING.butterDropRadiusM,
          TUNING.butterDropHeightM,
        );
    } else if (this.isButterOverPan) {
      this.isButterOverPan = false;
      this.sound.playSound('plop', this.kitchen.copyStoveSeat(this.positionB));
      this.cooking.meltButter();
      this.steps.completeStep();
    }
  }

  /** Angle in radians between an object's up axis and straight up. */
  private tiltOf(object: Object3D): number {
    object.getWorldQuaternion(this.orientation);
    this.up.set(0, 1, 0).applyQuaternion(this.orientation);
    return Math.acos(Math.min(Math.max(this.up.y, -1), 1));
  }

  private updatePour(delta: number): void {
    const bowl = this.kitchen.requireTool('bowl');
    const object = bowl.object3D;
    if (object == null) {
      return;
    }
    const stove = this.kitchen.copyStoveSeat(this.positionB);
    const bowlAt = object.getWorldPosition(this.positionA);
    const isOverPan =
      this.kitchen.panOnStove &&
      bowl.hasComponent(Grabbed) &&
      isWithinSnapZone(
        bowlAt.x - stove.x,
        bowlAt.y - stove.y,
        bowlAt.z - stove.z,
        TUNING.pourZoneRadiusM,
        TUNING.pourMaxHeightM,
      );
    const heldS = this.pour.update(
      this.tiltOf(object),
      isOverPan,
      TUNING.pourMinTiltDeg * DEG_TO_RAD,
      delta,
    );
    this.cooking.setPourProgress(Math.min(heldS / TUNING.pourHoldS, 1));
    this.guide?.showProgress(heldS / TUNING.pourHoldS);
    if (heldS >= TUNING.pourHoldS) {
      this.sound.playSound('splash', stove);
      this.cooking.startCooking();
      this.steps.completeStep();
    }
  }

  /** The player decides when to take the pan off the heat, once it is ready. */
  private updatePanLift(minProgress: number): void {
    const pan = this.kitchen.requireTool('pan');
    // After a flip the pan may still be in the air: set it down first.
    this.hasPanCooked ||= this.kitchen.panOnStove;
    if (!this.hasPanCooked) {
      return;
    }
    if (
      !pan.hasComponent(Grabbed) ||
      this.cooking.cookProgress < minProgress
    ) {
      return;
    }
    const seat = this.kitchen.copyStoveSeat(this.positionB);
    const panAt = pan.object3D?.getWorldPosition(this.positionA);
    if (panAt != null && panAt.distanceTo(seat) >= TUNING.panLiftM) {
      this.steps.completeStep();
    }
  }

  /** A flick starts the toss. The step ends when the omelette has landed. */
  private updateFlip(delta: number): void {
    if (this.hasTossed) {
      if (!this.cooking.isTossing) {
        this.sound.playSound('plop', this.kitchen.requireTool('pan').object3D ?? null);
        this.steps.completeStep();
      }
      return;
    }
    const pan = this.kitchen.requireTool('pan');
    const holder = this.grabSystem?.getHolderHand(pan) ?? null;
    if (holder == null) {
      this.flick.reset();
      return;
    }
    // Read the hand, not the pan: the pan is deliberately eased.
    this.player.gripSpaces[holder].getWorldQuaternion(this.orientation);
    const { x, y, z, w } = this.orientation;
    const speed = this.flick.update(
      x,
      y,
      z,
      w,
      delta,
      TUNING.gestureSmoothing,
    );
    if (speed >= TUNING.flickMinRadPerS) {
      this.hasTossed = true;
      this.score.noteFlip(this.cooking.cookProgress);
      this.sound.playSound('whoosh', pan.object3D ?? null);
      this.cooking.toss();
    }
  }

  private updatePlate(): void {
    const pan = this.kitchen.requireTool('pan');
    const plateAt = this.kitchen
      .requireTool('plate')
      .object3D?.getWorldPosition(this.positionB);
    const panAt = pan.object3D?.getWorldPosition(this.positionA);
    if (
      plateAt != null &&
      panAt != null &&
      pan.hasComponent(Grabbed) &&
      isWithinSnapZone(
        panAt.x - plateAt.x,
        panAt.y - plateAt.y,
        panAt.z - plateAt.z,
        TUNING.plateZoneRadiusM,
        TUNING.plateZoneHeightM,
      )
    ) {
      this.sound.playSound('serve', plateAt);
      this.cooking.serve();
      this.steps.completeStep();
      this.kitchen.dropPan();
    }
  }
}
