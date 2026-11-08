import {
  Color,
  createSystem,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  Quaternion,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { TUNING } from '../config/tuning.js';
import {
  advanceCook,
  COOK_ZONE,
  cookLabel,
} from '../game/cooking.js';
import type { PanState } from '../game/sizzle.js';
import { KitchenSystem } from './KitchenSystem.js';
import { StepSystem } from './StepSystem.js';

const RAW_COLOR = new Color('#F6E27A');
const GOLDEN_COLOR = new Color('#E0A93B');
const BROWN_COLOR = new Color('#6B4A1F');
const BURNT_COLOR = new Color('#2A1E14');
const YOLK_COLOR = new Color('#F5B335');

/** The omelette's shape when lying folded in half. */
const FOLDED_SCALE_X = 0.85;
const FOLDED_SCALE_Y = 1.6;
const FOLDED_SCALE_Z = 0.6;

/** Size of the butter disc, against fully melted, when it lands. */
const BUTTER_START_SCALE = 0.7;

const SPIN_AXIS = new Vector3(1, 0, 0);
/** Parts of the toss, from 0 to 1, when the omelette starts and stops turning. */
const SPIN_START = 0.15;
const SPIN_END = 0.75;

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * A frame can stall, for example while the browser loads something. Doneness
 * counts at most this much time per frame, so one stall cannot burn the food.
 */
const MAX_COOK_STEP_S = 0.1;

const GOLDEN_MOMENT = 0.7;
const BURNT_MOMENT = 1.2;

/** Rice darkens with each dash of sweet soy: none, one, two, three or more. */
const SAUCE_COLORS = ['#F5F2EA', '#D9B98A', '#B9874F', '#8E5A2C'].map(
  (hex) => new Color(hex),
);
const TOASTED_COLOR = new Color('#A8692E');
/** How far a golden moment pulls the rice toward the toasted color. */
const TOAST_SHARE = 0.3;
const SET_EGG_COLOR = new Color('#F2C94C');
/** The raw egg starts as one big blob and breaks up as it is stirred. */
const SCRAMBLE_START_SCALE = 1.35;
/** Scrambled egg sits on top of the rice, this far above the pan floor. */
const SCRAMBLE_ON_RICE_Y = 0.016;

/** Tracks doneness and every change it makes to the food on the table. */
export class CookingSystem extends createSystem({}) {
  private steps!: StepSystem;
  private kitchen!: KitchenSystem;
  private bowlEgg!: Mesh;
  private panEgg!: Mesh;
  private panButter!: Mesh;
  private plateOmelette!: Mesh;
  private bowlOnion!: Object3D;
  private panOnion!: Object3D;
  private plateOnion!: Object3D;
  private panRice!: Mesh;
  private panScramble!: Mesh;
  private panRiceOnion!: Mesh;
  private plateRice!: Mesh;
  private plateScramble!: Mesh;
  private plateRiceOnion!: Mesh;
  /** The rice heaped in the rice bowl ingredient; it empties into the pan. */
  private riceInBowl: Object3D | undefined;
  private scrambleRestY = 0;
  private hasRiceInPan = false;
  private readonly riceColor = new Color();
  private readonly goldenRiceColor = new Color();
  private hasOnion = false;
  /** Dashes of a dark sauce in the pan; they tint the food. */
  private sauceDashes = 0;
  private butterMeltS = 0;
  private progress = 0;
  private hasEggInPan = false;
  private label = '';
  private isFolded = false;
  private tossT = 1;
  private panEggRestY = 0;
  private pan!: Object3D;
  private readonly tossStart = new Vector3();
  private readonly tossLanding = new Vector3();
  private readonly panTurn = new Quaternion();
  private readonly tossSpin = new Quaternion();

  get cookProgress(): number {
    return this.progress;
  }

  /** True while the omelette is in the air. */
  get isTossing(): boolean {
    return this.tossT < 1;
  }

  /** Writes what the pan holds and whether it is heating into `out`. */
  readPanState(out: PanState): PanState {
    out.isOnHeat = this.kitchen.panOnStove && !this.steps.isGamePaused;
    out.hasButter = this.panButter.visible;
    out.hasEgg = this.hasEggInPan;
    out.progress = this.progress;
    out.isTossing = this.isTossing;
    return out;
  }

  init(): void {
    const steps = this.world.getSystem(StepSystem);
    const kitchen = this.world.getSystem(KitchenSystem);
    if (steps == null || kitchen == null) {
      throw new Error('CookingSystem needs StepSystem and KitchenSystem first');
    }
    this.steps = steps;
    this.kitchen = kitchen;
    this.bowlEgg = this.ownedMesh('bowl', 'BowlEgg');
    this.panEgg = this.ownedMesh('pan', 'PanEgg');
    this.pan = this.panEgg.parent as Object3D;
    this.panEggRestY = this.panEgg.position.y;
    this.panButter = this.ownedMesh('pan', 'PanButter');
    this.plateOmelette = this.ownedMesh('plate', 'PlateOmelette');
    this.bowlOnion = this.requirePart(this.bowlEgg, 'BowlOnion');
    this.panOnion = this.requirePart(this.panEgg, 'PanOnion');
    this.plateOnion = this.requirePart(this.plateOmelette, 'PlateOnion');
    this.panRice = this.ownedMesh('pan', 'PanRice');
    this.panScramble = this.ownedMesh('pan', 'PanScramble');
    this.panRiceOnion = this.ownedMesh('pan', 'PanRiceOnion');
    this.plateRice = this.ownedMesh('plate', 'PlateRice');
    this.plateScramble = this.ownedMesh('plate', 'PlateScramble');
    this.plateRiceOnion = this.ownedMesh('plate', 'PlateRiceOnion');
    this.scrambleRestY = this.panScramble.position.y;
    this.riceInBowl = this.world
      .requireSceneEntity('ingredient-rice')
      .object3D?.getObjectByName('RiceMound');
    this.cleanupFuncs.push(
      steps.subscribe(() => {
        if (steps.state.phase === 'title') {
          this.reset();
        }
      }),
    );
    this.reset();
  }

  update(delta: number): void {
    if (
      this.world.visibilityState.peek() !== VisibilityState.Visible ||
      this.steps.isGamePaused
    ) {
      return;
    }
    this.updateButter(delta);
    this.updateToss(delta);
    if (!this.hasEggInPan) {
      return;
    }
    if (this.kitchen.panOnStove && this.isBrowningStep()) {
      this.progress = advanceCook(
        this.progress,
        Math.min(delta, MAX_COOK_STEP_S),
        this.steps.activeRecipe.cookDurationS ?? TUNING.cookDurationS,
      );
    }
    if (this.isFriedRice) {
      this.paintFriedRice();
    } else {
      this.paintDoneness();
    }
    if (cookLabel(this.progress, this.isFolded) !== this.label) {
      this.showDoneness();
    }
  }

  private get isFriedRice(): boolean {
    return this.steps.activeRecipe.dish === 'fried-rice';
  }

  /** Only some steps brown the food, when the recipe says which. */
  private isBrowningStep(): boolean {
    const heatSteps = this.steps.activeRecipe.heatSteps;
    const stepId = this.steps.step?.id;
    return heatSteps == null || (stepId != null && heatSteps.includes(stepId));
  }

  /** The egg is cracked into the bowl, or straight into the hot pan. */
  onCrack(zone: 'bowl' | 'pan'): void {
    if (zone === 'bowl') {
      this.showEggInBowl();
      return;
    }
    // Fried rice is never flipped, so the card skips the Ready label.
    this.hasEggInPan = true;
    this.isFolded = true;
    this.panScramble.visible = true;
    this.panScramble.scale.setScalar(SCRAMBLE_START_SCALE);
    this.material(this.panScramble).color.copy(RAW_COLOR);
    this.showDoneness();
  }

  /** Stirring progress, 0 to 1, for the bowl or the pan. */
  setStirProgress(zone: 'bowl' | 'pan', amount: number): void {
    if (zone === 'bowl') {
      this.setWhiskProgress(amount);
      return;
    }
    if (!this.hasRiceInPan) {
      // Scrambling: the egg sets and breaks into bits.
      this.material(this.panScramble).color.lerpColors(
        RAW_COLOR,
        SET_EGG_COLOR,
        amount,
      );
      this.panScramble.scale.setScalar(
        SCRAMBLE_START_SCALE + (1 - SCRAMBLE_START_SCALE) * amount,
      );
      return;
    }
    // Stir-frying: everything in the pan turns with the spatula.
    const turn = amount * Math.PI * 2;
    this.panRice.rotation.y = turn;
    this.panScramble.rotation.y = -turn * 1.5;
    this.panRiceOnion.rotation.y = turn * 0.7;
  }

  /** An ingredient was let go over the bowl or pan. */
  onDrop(itemId: string, zone: 'bowl' | 'pan'): void {
    if (itemId === 'rice' && zone === 'pan') {
      this.hasRiceInPan = true;
      this.panRice.visible = true;
      this.panScramble.position.y = this.scrambleRestY + SCRAMBLE_ON_RICE_Y;
      if (this.riceInBowl != null) {
        this.riceInBowl.visible = false;
      }
      return;
    }
    if (itemId === 'green-onion') {
      if (zone === 'bowl') {
        this.addOnion();
      } else {
        this.hasOnion = true;
        (this.isFriedRice ? this.panRiceOnion : this.panOnion).visible = true;
      }
    }
  }

  /**
   * A dash of seasoning went in; `dashes` counts them so far. Salt vanishes
   * into the egg, while a dark sauce such as sweet soy darkens the food.
   */
  onSeason(itemId: string, dashes: number): void {
    if (itemId !== 'salt') {
      this.sauceDashes = dashes;
    }
  }

  /** Green onion goes in the bowl and stays in the egg from there on. */
  addOnion(): void {
    this.hasOnion = true;
    this.bowlOnion.visible = true;
  }

  /** The butter lands in the hot pan and starts to spread. */
  meltButter(): void {
    this.butterMeltS = TUNING.butterMeltS;
    this.panButter.visible = true;
    this.panButter.scale.setScalar(BUTTER_START_SCALE);
  }

  /** The cracked egg lands in the bowl as separate yolks. */
  showEggInBowl(): void {
    this.bowlEgg.visible = true;
    this.material(this.bowlEgg).color.copy(YOLK_COLOR);
    this.bowlEgg.scale.setScalar(1);
  }

  /** Blends the yolks toward an even raw-egg color as the player whisks. */
  setWhiskProgress(amount: number): void {
    this.material(this.bowlEgg).color.lerpColors(YOLK_COLOR, RAW_COLOR, amount);
  }

  /** Moves the egg from the bowl to the pan while the player pours. */
  setPourProgress(amount: number): void {
    this.bowlEgg.scale.setScalar(Math.max(1 - amount, 0.05));
    this.panEgg.visible = amount > 0;
    this.panEgg.scale.setScalar(Math.max(amount, 0.05));
  }

  /** The whole egg is in the pan, so the heat now counts. */
  startCooking(): void {
    this.setPourProgress(1);
    this.panOnion.visible = this.hasOnion;
    this.bowlEgg.visible = false;
    this.panButter.visible = false;
    this.hasEggInPan = true;
  }

  /**
   * Sends the omelette up out of the pan. In the air it belongs to the room,
   * not the pan, so a tilted pan cannot throw it sideways.
   */
  toss(): void {
    this.tossT = 0;
    this.panEgg.getWorldPosition(this.tossStart);
    this.world.scene.attach(this.panEgg);
  }

  /** Slides the finished food onto the plate. */
  serve(): void {
    if (this.isFriedRice) {
      this.serveFriedRice();
      return;
    }
    this.hasEggInPan = false;
    this.panEgg.visible = false;
    this.plateOmelette.visible = true;
    this.plateOnion.visible = this.hasOnion;
    this.material(this.plateOmelette).color.copy(
      this.material(this.panEgg).color,
    );
  }

  /** Writes the doneness after the step title. */
  showDoneness(): void {
    const label = cookLabel(this.progress, this.isFolded);
    this.label = label;
    this.steps.setProgress(label);
  }

  /** Rises and falls on an arc while turning over once. */
  private updateToss(delta: number): void {
    if (this.tossT >= 1) {
      return;
    }
    this.tossT = Math.min(this.tossT + delta / TUNING.tossDurationS, 1);
    const t = this.tossT;
    // Sliding and folding ease in and out, so nothing jerks.
    const eased = smoothstep(t);
    // The spin waits until the omelette is clear of the pan and ends before
    // it comes back down, so it never cuts through the pan.
    const spin = smoothstep(
      Math.min(Math.max((t - SPIN_START) / (SPIN_END - SPIN_START), 0), 1),
    );
    const egg = this.panEgg;
    egg.scale.set(
      1 + (FOLDED_SCALE_X - 1) * eased,
      1 + (FOLDED_SCALE_Y - 1) * eased,
      1 + (FOLDED_SCALE_Z - 1) * eased,
    );
    // The landing spot is read every frame, so it follows the pan as it moves.
    this.tossLanding.set(0, this.panEggRestY, 0);
    this.pan.localToWorld(this.tossLanding);
    egg.position.lerpVectors(this.tossStart, this.tossLanding, eased);
    // The height follows a plain arc, so the omelette leaves the pan at once.
    egg.position.y += 4 * TUNING.tossHeightM * t * (1 - t);
    this.pan.getWorldQuaternion(this.panTurn);
    this.tossSpin.setFromAxisAngle(SPIN_AXIS, Math.PI * 2 * spin);
    egg.quaternion.copy(this.panTurn).multiply(this.tossSpin);
    if (t >= 1) {
      this.returnEggToPan();
      egg.position.set(0, this.panEggRestY, 0);
      this.isFolded = true;
    }
  }

  private returnEggToPan(): void {
    this.pan.add(this.panEgg);
    this.panEgg.rotation.set(0, 0, 0);
  }

  private updateButter(delta: number): void {
    if (this.butterMeltS <= 0) {
      return;
    }
    this.butterMeltS = Math.max(this.butterMeltS - delta, 0);
    const melted = 1 - this.butterMeltS / TUNING.butterMeltS;
    this.panButter.scale.setScalar(
      BUTTER_START_SCALE + (1 - BUTTER_START_SCALE) * melted,
    );
  }

  private serveFriedRice(): void {
    this.hasEggInPan = false;
    this.panRice.visible = false;
    this.panScramble.visible = false;
    this.panRiceOnion.visible = false;
    this.plateRice.visible = this.hasRiceInPan;
    this.plateScramble.visible = true;
    this.plateRiceOnion.visible = this.hasOnion;
    this.material(this.plateRice).color.copy(this.material(this.panRice).color);
    this.material(this.plateScramble).color.copy(
      this.material(this.panScramble).color,
    );
  }

  /**
   * Sweet soy sets the rice's base color; then heat toasts it golden and, left
   * too long, browns and burns it. The egg bits turn golden alongside.
   */
  private paintFriedRice(): void {
    const sauce =
      SAUCE_COLORS[Math.min(this.sauceDashes, SAUCE_COLORS.length - 1)] ??
      RAW_COLOR;
    this.goldenRiceColor.copy(sauce).lerp(TOASTED_COLOR, TOAST_SHARE);
    const { progress } = this;
    if (progress <= GOLDEN_MOMENT) {
      this.riceColor.lerpColors(sauce, this.goldenRiceColor, progress / GOLDEN_MOMENT);
    } else if (progress <= COOK_ZONE.burntAbove) {
      this.riceColor.lerpColors(
        this.goldenRiceColor,
        BROWN_COLOR,
        (progress - GOLDEN_MOMENT) / (COOK_ZONE.burntAbove - GOLDEN_MOMENT),
      );
    } else {
      this.riceColor.lerpColors(
        BROWN_COLOR,
        BURNT_COLOR,
        Math.min(
          (progress - COOK_ZONE.burntAbove) /
            (BURNT_MOMENT - COOK_ZONE.burntAbove),
          1,
        ),
      );
    }
    this.material(this.panRice).color.copy(this.riceColor);
    if (this.hasRiceInPan) {
      this.material(this.panScramble).color.lerpColors(
        SET_EGG_COLOR,
        GOLDEN_COLOR,
        Math.min(progress / GOLDEN_MOMENT, 1),
      );
    }
  }

  private paintDoneness(): void {
    const { color } = this.material(this.panEgg);
    const { progress } = this;
    if (progress <= GOLDEN_MOMENT) {
      color.lerpColors(RAW_COLOR, GOLDEN_COLOR, progress / GOLDEN_MOMENT);
    } else if (progress <= COOK_ZONE.burntAbove) {
      color.lerpColors(
        GOLDEN_COLOR,
        BROWN_COLOR,
        (progress - GOLDEN_MOMENT) / (COOK_ZONE.burntAbove - GOLDEN_MOMENT),
      );
    } else {
      color.lerpColors(
        BROWN_COLOR,
        BURNT_COLOR,
        Math.min(
          (progress - COOK_ZONE.burntAbove) /
            (BURNT_MOMENT - COOK_ZONE.burntAbove),
          1,
        ),
      );
    }
  }

  private reset(): void {
    this.progress = 0;
    this.hasEggInPan = false;
    this.label = '';
    this.isFolded = false;
    this.tossT = 1;
    this.butterMeltS = 0;
    this.hasOnion = false;
    this.sauceDashes = 0;
    this.hasRiceInPan = false;
    for (const mesh of [
      this.panRice,
      this.panScramble,
      this.panRiceOnion,
      this.plateRice,
      this.plateScramble,
      this.plateRiceOnion,
    ]) {
      mesh.visible = false;
      mesh.rotation.set(0, 0, 0);
    }
    this.panScramble.position.y = this.scrambleRestY;
    this.panScramble.scale.setScalar(1);
    this.material(this.panRice).color.copy(SAUCE_COLORS[0] ?? RAW_COLOR);
    if (this.riceInBowl != null) {
      this.riceInBowl.visible = true;
    }
    this.bowlOnion.visible = false;
    this.panOnion.visible = false;
    this.plateOnion.visible = false;
    this.bowlEgg.visible = false;
    this.panEgg.visible = false;
    this.panButter.visible = false;
    this.plateOmelette.visible = false;
    this.returnEggToPan();
    this.panEgg.scale.setScalar(1);
    this.panEgg.position.set(0, this.panEggRestY, 0);
    this.material(this.panEgg).color.copy(RAW_COLOR);
  }

  /** Food colors change at runtime, so each mesh gets its own material. */
  private ownedMesh(toolId: 'bowl' | 'pan' | 'plate', name: string): Mesh {
    const object = this.kitchen.requireTool(toolId).object3D;
    const mesh = object?.getObjectByName(name) as Mesh | undefined;
    if (mesh == null) {
      throw new Error(`Tool ${toolId} has no ${name} mesh`);
    }
    mesh.material = this.material(mesh).clone();
    return mesh;
  }

  private requirePart(parent: Object3D, name: string): Object3D {
    const part = parent.getObjectByName(name);
    if (part == null) {
      throw new Error(`Missing ${name}`);
    }
    return part;
  }

  /** Read fresh each time: the reach glow can swap this mesh's material. */
  private material(mesh: Mesh): MeshStandardMaterial {
    return mesh.material as MeshStandardMaterial;
  }
}
