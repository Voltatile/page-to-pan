import {
  createSystem,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  VisibilityState,
} from '@iwsdk/core';
import { CookingSystem } from './CookingSystem.js';
import { ScoreSystem } from './ScoreSystem.js';
import { StepSystem } from './StepSystem.js';

/** Perched beside the floating cookbook card on the recipe stand. */
const CHEF_X = 0.285;
const CHEF_Y = 0.145;
const CHEF_Z = 0.025;

const CHEER_DURATION_S = 0.48;
const CHEER_HOP_M = 0.032;
/** Three stars earn a longer dance of this many hops. */
const PARTY_HOPS = 4;

/**
 * Builds the procedural chef-hat mascot (5 low-poly parts, ~280
 * triangles total) so the player has a lively culinary companion in VR.
 */
function buildChefMascotMesh(): Group {
  const root = new Group();
  root.name = 'ChefMascot';

  const clothMat = new MeshStandardMaterial({
    color: '#FFFDF8',
    roughness: 0.78,
    metalness: 0.02,
  });
  const bandMat = new MeshStandardMaterial({
    color: '#C84B31',
    roughness: 0.65,
    metalness: 0.05,
  });
  const faceMat = new MeshStandardMaterial({
    color: '#FCE2C4',
    roughness: 0.72,
    metalness: 0.02,
  });
  const eyeMat = new MeshStandardMaterial({
    color: '#2A1E17',
    roughness: 0.35,
    metalness: 0.1,
  });

  // Round head/face base
  const head = new Mesh(new SphereGeometry(0.024, 14, 12), faceMat);
  head.position.set(0, 0, 0);
  root.add(head);

  // Red chef ribbon band around the toque base
  const band = new Mesh(
    new CylinderGeometry(0.0245, 0.0235, 0.011, 16),
    bandMat,
  );
  band.position.set(0, 0.015, 0);
  root.add(band);

  // Tall toque cylinder
  const crown = new Mesh(
    new CylinderGeometry(0.026, 0.023, 0.028, 16),
    clothMat,
  );
  crown.position.set(0, 0.032, 0);
  root.add(crown);

  // Puffy chef hat top
  const puff = new Mesh(new SphereGeometry(0.031, 16, 12), clothMat);
  puff.scale.set(1.08, 0.72, 1.05);
  puff.position.set(0, 0.048, 0);
  root.add(puff);

  // Expressive eyes facing the player (+Z)
  const eyeGeo = new SphereGeometry(0.0036, 8, 8);
  const leftEye = new Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.0085, 0.002, 0.022);
  const rightEye = new Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.0085, 0.002, 0.022);
  root.add(leftEye, rightEye);

  // Rosy nose button
  const nose = new Mesh(new SphereGeometry(0.0042, 8, 8), bandMat);
  nose.position.set(0, -0.003, 0.024);
  root.add(nose);

  return root;
}

/**
 * Animates the chef-hat mascot beside the floating recipe card:
 * - gentle idle bobbing
 * - happy celebration hop when a step completes
 * - nervous wobble when food on the stove is close to burning
 */
export class ChefMascotSystem extends createSystem({}) {
  private steps!: StepSystem;
  private cooking: CookingSystem | undefined;
  private score: ScoreSystem | undefined;
  /** Hops left in the three-star dance. */
  private partyHops = 0;
  private hasPartied = false;
  private chef!: Group;
  private timeS = 0;
  private cheerS = -1;
  private lastStepKey = '';

  init(): void {
    const steps = this.world.getSystem(StepSystem);
    if (steps == null) {
      throw new Error('ChefMascotSystem needs StepSystem first');
    }
    this.steps = steps;
    this.cooking = this.world.getSystem(CookingSystem);
    this.score = this.world.getSystem(ScoreSystem);

    const stand = this.world.requireSceneEntity('recipe-stand').object3D;
    if (stand == null) {
      throw new Error('Missing recipe-stand object3D');
    }
    this.chef = buildChefMascotMesh();
    this.chef.position.set(CHEF_X, CHEF_Y, CHEF_Z);
    this.chef.rotation.y = -0.24;
    stand.add(this.chef);

    const onStepChange = () => {
      const state = this.steps.state;
      const key =
        state.phase === 'cooking'
          ? `cooking:${state.stepIndex}`
          : state.phase;
      if (this.lastStepKey !== '' && key !== this.lastStepKey) {
        this.cheerS = 0;
      }
      this.lastStepKey = key;
    };
    onStepChange();
    this.cleanupFuncs.push(
      this.steps.subscribe(onStepChange),
      () => {
        this.chef.removeFromParent();
      },
    );
  }

  update(delta: number): void {
    if (this.world.visibilityState.peek() === VisibilityState.NonImmersive) {
      return;
    }
    this.timeS += delta;

    // Gentle idle bob
    let offsetY = Math.sin(this.timeS * 2.6) * 0.005;
    let tiltZ = Math.sin(this.timeS * 1.8) * 0.05;
    let spinY = -0.24 + Math.sin(this.timeS * 1.1) * 0.08;

    // Happy hop when advancing a step or recipe phase
    if (this.cheerS >= 0) {
      this.cheerS = Math.min(this.cheerS + delta, CHEER_DURATION_S);
      const t = this.cheerS / CHEER_DURATION_S;
      const arc = Math.sin(Math.PI * t);
      offsetY += arc * CHEER_HOP_M;
      spinY += Math.sin(Math.PI * 2 * t) * 0.35;
      if (this.cheerS >= CHEER_DURATION_S) {
        // The dance chains its hops; a plain cheer ends after one.
        this.partyHops = Math.max(this.partyHops - 1, 0);
        this.cheerS = this.partyHops > 0 ? 0 : -1;
      }
    }

    // The score arrives just after the last step, so look for it here.
    const isDone = this.steps.state.phase === 'done';
    if (isDone && !this.hasPartied && this.score?.result != null) {
      this.hasPartied = true;
      if (this.score.result.stars >= 3) {
        this.partyHops = PARTY_HOPS;
        this.cheerS = 0;
      }
    } else if (!isDone) {
      this.hasPartied = false;
    }

    // Nervous wobble when food is getting close to burning
    const progress = this.cooking?.cookProgress ?? 0;
    if (
      this.steps.state.phase === 'cooking' &&
      !this.steps.isGamePaused &&
      progress > 0.8
    ) {
      const urgency = Math.min((progress - 0.8) / 0.3, 1);
      tiltZ += Math.sin(this.timeS * 22) * 0.18 * urgency;
      offsetY += Math.abs(Math.sin(this.timeS * 14)) * 0.008 * urgency;
    }

    this.chef.position.set(CHEF_X, CHEF_Y + offsetY, CHEF_Z);
    this.chef.rotation.set(0, spinY, tiltZ);
  }
}
