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
import { WHISK_IN_BOWL_OFFSET_Y } from '../config/cookware.js';
import type { StepCompletion } from '../config/recipes/recipe.js';
import { TUNING } from '../config/tuning.js';
import {
  CrackDetector,
  FlickDetector,
  PourTimer,
  WhiskTracker,
} from '../game/gestures.js';
import { isWithinSnapZone } from '../util/snap.js';
import { CookingSystem } from './CookingSystem.js';
import { KitchenSystem } from './KitchenSystem.js';
import { StepSystem } from './StepSystem.js';

const DEG_TO_RAD = Math.PI / 180;

/** The whisk model lies along X with its head at -X; this stands it head down. */
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
  private readonly pour = new PourTimer();
  private readonly flick = new FlickDetector();
  private readonly leftHand = new Vector3();
  private readonly rightHand = new Vector3();
  private readonly positionA = new Vector3();
  private readonly positionB = new Vector3();
  private readonly orientation = new Quaternion();
  private readonly up = new Vector3();
  private readonly whiskTarget = new Vector3();
  private readonly whiskShownAt = new Vector3();
  private readonly whiskShownTurn = new Quaternion();
  private steps!: StepSystem;
  private kitchen!: KitchenSystem;
  private cooking!: CookingSystem;
  private grabSystem: GrabSystem | undefined;
  private egg!: Entity;
  private activeStep: StepCompletion | null = null;
  private whiskTurnsShown = 0;
  private saltPinches = 0;
  private hasFlipped = false;
  private isWhiskInHand = false;

  /** How many pinches of salt went in. The score will read this. */
  get saltPinchCount(): number {
    return this.saltPinches;
  }

  init(): void {
    const steps = this.world.getSystem(StepSystem);
    const kitchen = this.world.getSystem(KitchenSystem);
    const cooking = this.world.getSystem(CookingSystem);
    if (steps == null || kitchen == null || cooking == null) {
      throw new Error('GestureSystem needs its systems registered first');
    }
    this.steps = steps;
    this.kitchen = kitchen;
    this.cooking = cooking;
    this.grabSystem = this.world.getSystem(GrabSystem);
    this.egg = this.world.requireSceneEntity('ingredient-egg');
  }

  update(delta: number): void {
    if (this.world.visibilityState.peek() !== VisibilityState.Visible) {
      return;
    }
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
        this.updateSeason();
        break;
      case 'pour':
        this.updatePour(delta);
        break;
      case 'cook':
        this.updateCook();
        break;
      case 'flip':
        this.updateFlip(delta);
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
      this.saltPinches = 0;
      this.steps.setProgress('0');
    } else if (step === 'pour') {
      this.pour.reset();
    } else if (step === 'cook') {
      this.cooking.showDoneness();
    } else if (step === 'flip') {
      this.flick.reset();
      this.hasFlipped = false;
      this.cooking.showDoneness();
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
    this.poseWhisk(object, hand, bowlAt, isInBowl, delta);
    const turns = this.whisk.update(
      offsetX,
      offsetZ,
      isInBowl,
      TUNING.whiskMinRadiusM,
      TUNING.gestureSmoothing,
    );
    const target = TUNING.whiskTargetTurns;
    this.cooking.setWhiskProgress(Math.min(turns / target, 1));
    const fullTurns = Math.floor(turns);
    if (fullTurns !== this.whiskTurnsShown) {
      this.whiskTurnsShown = fullTurns;
      this.steps.setProgress(`${Math.min(fullTurns, target)}/${target}`);
    }
    if (turns >= target) {
      this.steps.completeStep();
    }
  }

  /**
   * Stands the held whisk head down and, near the bowl, keeps the head inside
   * it. The hand may circle wider than the bowl: the head traces a smaller
   * circle, so shaky tracking never pulls it through the wall.
   */
  private poseWhisk(
    object: Object3D,
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
        bowlAt.y + WHISK_IN_BOWL_OFFSET_Y,
        bowlAt.z + offsetZ * scale,
      );
    } else {
      this.whiskTarget.set(hand.x, hand.y - TUNING.whiskUnderHandM, hand.z);
    }
    const blend = Math.min(TUNING.whiskFollowRatePerS * delta, 1);
    this.whiskShownAt.lerp(this.whiskTarget, blend);
    this.whiskShownTurn.slerp(WHISK_UPRIGHT, blend);
    object.position.copy(this.whiskShownAt);
    object.quaternion.copy(this.whiskShownTurn);
  }

  private updateSeason(): void {
    const bowlAt = this.kitchen
      .requireTool('bowl')
      .object3D?.getWorldPosition(this.positionB);
    if (bowlAt == null) {
      return;
    }
    const left = this.isSaltPinch('left', this.player.gripSpaces.left, bowlAt);
    const right = this.isSaltPinch(
      'right',
      this.player.gripSpaces.right,
      bowlAt,
    );
    if (left || right) {
      this.saltPinches += (left ? 1 : 0) + (right ? 1 : 0);
      this.steps.setProgress(String(this.saltPinches));
      this.steps.setActionReady(true);
    }
  }

  private isSaltPinch(
    handedness: 'left' | 'right',
    grip: { getWorldPosition(target: Vector3): Vector3 },
    bowlAt: Vector3,
  ): boolean {
    if (!this.input.xr.getSelectState(handedness).start) {
      return false;
    }
    const hand = grip.getWorldPosition(this.positionA);
    return isWithinSnapZone(
      hand.x - bowlAt.x,
      hand.y - bowlAt.y,
      hand.z - bowlAt.z,
      TUNING.seasonZoneRadiusM,
      TUNING.bowlZoneHeightM,
    );
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
    object.getWorldQuaternion(this.orientation);
    this.up.set(0, 1, 0).applyQuaternion(this.orientation);
    const tilt = Math.acos(Math.min(Math.max(this.up.y, -1), 1));
    const heldS = this.pour.update(
      tilt,
      isOverPan,
      TUNING.pourMinTiltDeg * DEG_TO_RAD,
      delta,
    );
    this.cooking.setPourProgress(Math.min(heldS / TUNING.pourHoldS, 1));
    if (heldS >= TUNING.pourHoldS) {
      this.cooking.startCooking();
      this.steps.completeStep();
    }
  }

  /** The player decides when it is done by lifting the pan off the heat. */
  private updateCook(): void {
    const pan = this.kitchen.requireTool('pan');
    if (!pan.hasComponent(Grabbed)) {
      return;
    }
    const seat = this.kitchen.copyStoveSeat(this.positionB);
    const panAt = pan.object3D?.getWorldPosition(this.positionA);
    if (panAt != null && panAt.distanceTo(seat) >= TUNING.panLiftM) {
      this.steps.completeStep();
    }
  }

  private updateFlip(delta: number): void {
    const pan = this.kitchen.requireTool('pan');
    const object = pan.object3D;
    if (object == null) {
      return;
    }
    if (!pan.hasComponent(Grabbed)) {
      this.flick.reset();
      return;
    }
    if (!this.hasFlipped) {
      object.getWorldQuaternion(this.orientation);
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
        this.hasFlipped = true;
        this.cooking.fold();
        this.steps.setProgress('Flipped');
      }
      return;
    }
    const plateAt = this.kitchen
      .requireTool('plate')
      .object3D?.getWorldPosition(this.positionB);
    const panAt = object.getWorldPosition(this.positionA);
    if (
      plateAt != null &&
      isWithinSnapZone(
        panAt.x - plateAt.x,
        panAt.y - plateAt.y,
        panAt.z - plateAt.z,
        TUNING.plateZoneRadiusM,
        TUNING.plateZoneHeightM,
      )
    ) {
      this.cooking.serve();
      this.steps.completeStep();
      this.kitchen.dropPan();
    }
  }
}
