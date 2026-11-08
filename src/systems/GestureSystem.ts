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
import { OMELETTE_INGREDIENTS } from '../config/recipes/omelette.js';
import type { StepCompletion } from '../config/recipes/recipe.js';
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

/** Falling bits disappear at the egg surface, this far above the bowl base. */
const BOWL_FOOD_Y_M = 0.02;
/** Dropped garnish bits start this far above the bowl base. */
const BOWL_DROP_Y_M = 0.1;

/** From the shaker center to its cap, along the model's up axis. */
const SHAKER_CAP_OFFSET_M = OMELETTE_INGREDIENTS.salt.lengthM / 2;

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
  private egg!: Entity;
  private saltShaker!: Entity;
  private butter!: Entity;
  private greenOnion!: Entity;
  private activeStep: StepCompletion | null = null;
  private whiskTurnsShown = 0;
  private isButterOverPan = false;
  private isOnionOverBowl = false;
  private isPanInHand = false;
  private hasTossed = false;
  /** A lift only counts once the pan has sat on the stove in this step. */
  private hasPanCooked = false;
  private isWhiskInHand = false;
  private isShakerInHand = false;

  /** How many dashes of salt went in. The score will read this. */
  get saltDashCount(): number {
    return this.salt.count;
  }

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
    this.egg = this.world.requireSceneEntity('ingredient-egg');
    this.saltShaker = this.world.requireSceneEntity('ingredient-salt');
    this.butter = this.world.requireSceneEntity('ingredient-butter');
    this.greenOnion = this.world.requireSceneEntity('ingredient-green-onion');
  }

  update(delta: number): void {
    if (
      this.world.visibilityState.peek() !== VisibilityState.Visible ||
      this.steps.isGamePaused
    ) {
      return;
    }
    this.updatePanHold(delta);
    const step = this.steps.step?.completion ?? null;
    if (step !== this.activeStep) {
      this.activeStep = step;
      this.beginStep(step);
    }
    switch (step) {
      case 'crack':
        this.updateCrack();
        break;
      case 'whisk':
        this.updateWhisk(delta);
        break;
      case 'season':
        this.updateSeason(delta);
        break;
      case 'garnish':
        this.updateGarnish();
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

  private beginStep(step: StepCompletion | null): void {
    if (step === 'crack') {
      this.crack.reset();
    } else if (step === 'whisk') {
      this.whisk.reset();
      this.isWhiskInHand = false;
      this.whiskTurnsShown = 0;
      this.steps.setProgress(`0/${TUNING.whiskTargetTurns}`);
    } else if (step === 'season') {
      this.salt.reset();
      this.isShakerInHand = false;
      this.steps.setProgress('0');
    } else if (step === 'garnish') {
      this.isOnionOverBowl = false;
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

  private updateCrack(): void {
    this.player.gripSpaces.left.getWorldPosition(this.leftHand);
    this.player.gripSpaces.right.getWorldPosition(this.rightHand);
    const xr = this.input.xr;
    const isPinching =
      xr.getSelectState('left').active && xr.getSelectState('right').active;
    const egg = this.egg.object3D?.getWorldPosition(this.positionA);
    const bowl = this.kitchen
      .requireTool('bowl')
      .object3D?.getWorldPosition(this.positionB);
    const isNearEgg =
      egg != null &&
      bowl != null &&
      this.egg.hasComponent(Grabbed) &&
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
        this.effects.burst('yolk', egg, bowl.y + BOWL_FOOD_Y_M);
        this.shells?.crack(egg);
      }
      this.cooking.showEggInBowl();
      this.steps.completeStep();
    }
  }

  private updateWhisk(delta: number): void {
    const whisk = this.kitchen.requireTool('whisk');
    const object = whisk.object3D;
    const bowlAt = this.kitchen
      .requireTool('bowl')
      .object3D?.getWorldPosition(this.positionB);
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
      TUNING.bowlZoneRadiusM,
      TUNING.bowlZoneHeightM,
    );
    this.poseWhisk(object, holder, hand, bowlAt, isInBowl, delta);
    const turns = this.whisk.update(
      offsetX,
      offsetZ,
      isInBowl,
      TUNING.whiskMinRadiusM,
      TUNING.gestureSmoothing,
    );
    const target = TUNING.whiskTargetTurns;
    this.cooking.setWhiskProgress(Math.min(turns / target, 1));
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
      this.score.noteWhisk(turns);
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
      const scale = Math.min(TUNING.whiskHeadRadiusM / (radius || 1), 1);
      this.whiskTarget.set(
        bowlAt.x + offsetX * scale,
        bowlAt.y + WHISK_TIP_IN_BOWL_Y,
        bowlAt.z + offsetZ * scale,
      );
      this.setWhiskLean(holder, hand);
      this.whiskTargetTurn.setFromUnitVectors(WHISK_AXIS, this.whiskLean);
      this.whiskTarget.addScaledVector(
        this.whiskLean,
        COOKWARE.whisk.length / 2,
      );
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

  private updateSeason(delta: number): void {
    const object = this.saltShaker.object3D;
    const bowlAt = this.kitchen
      .requireTool('bowl')
      .object3D?.getWorldPosition(this.positionB);
    if (object == null || bowlAt == null) {
      return;
    }
    const holder = this.grabSystem?.getHolderHand(this.saltShaker) ?? null;
    if (holder == null) {
      this.isShakerInHand = false;
      return;
    }
    this.poseShaker(object, holder, delta);
    // The cap has to be over the bowl, so tipping it away spills no salt.
    const capAt = object.getWorldPosition(this.positionA);
    capAt.addScaledVector(this.up, SHAKER_CAP_OFFSET_M);
    const isOverBowl = isWithinSnapZone(
      capAt.x - bowlAt.x,
      capAt.y - bowlAt.y,
      capAt.z - bowlAt.z,
      TUNING.seasonZoneRadiusM,
      TUNING.bowlZoneHeightM,
    );
    const hasTipped = this.salt.update(
      Math.acos(Math.min(Math.max(this.up.y, -1), 1)),
      isOverBowl,
      TUNING.saltTipDeg * DEG_TO_RAD,
      TUNING.saltRearmDeg * DEG_TO_RAD,
    );
    if (hasTipped) {
      this.sound.playSound('shake', capAt);
      this.effects.burst('salt', capAt, bowlAt.y + BOWL_FOOD_Y_M);
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

  /** The green onion counts once it is let go over the bowl. */
  private updateGarnish(): void {
    if (this.greenOnion.hasComponent(Grabbed)) {
      const bowlAt = this.kitchen
        .requireTool('bowl')
        .object3D?.getWorldPosition(this.positionB);
      const onionAt = this.greenOnion.object3D?.getWorldPosition(
        this.positionA,
      );
      this.isOnionOverBowl =
        bowlAt != null &&
        onionAt != null &&
        isWithinSnapZone(
          onionAt.x - bowlAt.x,
          onionAt.y - bowlAt.y,
          onionAt.z - bowlAt.z,
          TUNING.bowlZoneRadiusM,
          TUNING.bowlZoneHeightM,
        );
    } else if (this.isOnionOverBowl) {
      this.isOnionOverBowl = false;
      const bowlAt = this.kitchen
        .requireTool('bowl')
        .object3D?.getWorldPosition(this.positionB);
      if (bowlAt != null) {
        this.sound.playSound('plop', bowlAt);
        this.positionA.copy(bowlAt);
        this.positionA.y += BOWL_DROP_Y_M;
        this.effects.burst('onion', this.positionA, bowlAt.y + BOWL_FOOD_Y_M);
      }
      this.cooking.addOnion();
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
