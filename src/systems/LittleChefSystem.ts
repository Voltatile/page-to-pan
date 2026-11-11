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
import { StepSystem } from './StepSystem.js';

/** Perched beside the floating cookbook card on the recipe stand. */
const CHEF_X = 0.285;
const CHEF_Y = 0.145;
const CHEF_Z = 0.025;

const CHEER_DURATION_S = 0.48;
const CHEER_HOP_M = 0.032;

/**
 * Builds the procedural "Little Chef" toque mascot (5 low-poly parts, ~280
 * triangles total) so the player has a lively culinary companion in VR.
 */
function buildLittleChefMesh(): Group {
  const root = new Group();
  root.name = 'LittleChef';

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
 * Animates the Little Chef companion beside the floating recipe card:
 * - gentle idle bobbing
 * - happy celebration hop when a step completes
 * - nervous wobble when food on the stove is close to burning
 */
export class LittleChefSystem extends createSystem({}) {
  private steps!: StepSystem;
  private cooking: CookingSystem | undefined;
  private chef!: Group;
  private timeS = 0;
  private cheerS = -1;
  private lastStepKey = '';

  init(): void {
    const steps = this.world.getSystem(StepSystem);
    if (steps == null) {
      throw new Error('LittleChefSystem needs StepSystem first');
    }
    this.steps = steps;
    this.cooking = this.world.getSystem(CookingSystem);

    const stand = this.world.requireSceneEntity('recipe-stand').object3D;
    if (stand == null) {
      throw new Error('Missing recipe-stand object3D');
    }
    this.chef = buildLittleChefMesh();
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
        this.cheerS = -1;
      }
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
