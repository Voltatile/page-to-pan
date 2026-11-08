import {
  createSystem,
  DoubleSide,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector2,
  Vector3,
} from '@iwsdk/core';
import { OMELETTE_INGREDIENTS } from '../config/recipes/omelette.js';
import { TUNING } from '../config/tuning.js';
import { StepSystem } from './StepSystem.js';

const EGG = OMELETTE_INGREDIENTS.egg;
const SHELL_DEPTH_M = EGG.lengthM / 2;
/**
 * Each half flies apart and toward the player, so both land on open table in
 * front of the bowl rather than on the whisk resting beside it.
 */
const THROW_SIDE_MPS = 0.28;
const THROW_UP_MPS = 0.55;
const THROW_TOWARD_MPS = 0.32;
const GRAVITY_MPS2 = -9.8;
const SPIN_RAD_PER_S = 9;
/** A resting half leans on its side a little, opening up. */
const REST_TILT_RAD = 0.35;
const REST_Y_M = TUNING.tableTopHeightM + SHELL_DEPTH_M * 0.8;
const REST_S = 6;
const SHRINK_S = 0.5;

/** One half of the shell: a cup open at the top, tip down. */
function shellGeometry(): LatheGeometry {
  const points: Vector2[] = [];
  const steps = 5;
  for (let index = 0; index <= steps; index += 1) {
    const angle = (index / steps) * (Math.PI / 2);
    const narrowing = 1 - 0.14 * Math.cos(angle);
    points.push(
      new Vector2(
        Math.max((EGG.widthM / 2) * Math.sin(angle) * narrowing, 0.0005),
        -SHELL_DEPTH_M * Math.cos(angle),
      ),
    );
  }
  return new LatheGeometry(points, 12);
}

interface Shell {
  mesh: Mesh;
  velocity: Vector3;
  spinAxis: Vector3;
  /** Seconds since landing; negative while in the air. */
  restS: number;
}

/** When the egg cracks, its two halves tumble out beside the bowl. */
export class EggShellSystem extends createSystem({}) {
  private readonly shells: Shell[] = [];
  private readonly spin = new Quaternion();
  private steps!: StepSystem;
  private isActive = false;

  init(): void {
    const steps = this.world.getSystem(StepSystem);
    if (steps == null) {
      throw new Error('EggShellSystem needs StepSystem first');
    }
    this.steps = steps;
    const geometry = shellGeometry();
    const material = new MeshStandardMaterial({
      color: '#D9B48A',
      roughness: 0.6,
      side: DoubleSide,
    });
    for (const side of [-1, 1]) {
      const mesh = new Mesh(geometry, material);
      mesh.name = side < 0 ? 'EggShellLeft' : 'EggShellRight';
      mesh.visible = false;
      this.world.scene.add(mesh);
      this.shells.push({
        mesh,
        velocity: new Vector3(),
        spinAxis: new Vector3(side, 0.4, 0.3).normalize(),
        restS: -1,
      });
    }
    this.cleanupFuncs.push(
      steps.subscribe(() => {
        if (steps.state.phase === 'title') {
          this.hideAll();
        }
      }),
      () => {
        for (const { mesh } of this.shells) {
          mesh.removeFromParent();
        }
      },
    );
  }

  /** Throws both halves out from the egg at `at`. */
  crack(at: Vector3): void {
    this.shells.forEach((shell, index) => {
      const side = index === 0 ? -1 : 1;
      shell.mesh.position.copy(at);
      shell.mesh.position.x += side * 0.015;
      shell.mesh.rotation.set(0, 0, side * 1.2);
      shell.mesh.scale.setScalar(1);
      shell.mesh.visible = true;
      shell.velocity.set(
        side * THROW_SIDE_MPS,
        THROW_UP_MPS,
        THROW_TOWARD_MPS,
      );
      shell.restS = -1;
    });
    this.isActive = true;
  }

  update(delta: number): void {
    if (!this.isActive || this.steps.isGamePaused) {
      return;
    }
    let anyShown = false;
    for (const shell of this.shells) {
      const { mesh } = shell;
      if (!mesh.visible) {
        continue;
      }
      anyShown = true;
      if (shell.restS < 0) {
        shell.velocity.y += GRAVITY_MPS2 * delta;
        mesh.position.addScaledVector(shell.velocity, delta);
        this.spin.setFromAxisAngle(shell.spinAxis, SPIN_RAD_PER_S * delta);
        mesh.quaternion.premultiply(this.spin);
        if (mesh.position.y <= REST_Y_M && shell.velocity.y < 0) {
          mesh.position.y = REST_Y_M;
          mesh.rotation.set(REST_TILT_RAD, mesh.rotation.y, 0);
          shell.restS = 0;
        }
        continue;
      }
      shell.restS += delta;
      const shrink = (shell.restS - REST_S) / SHRINK_S;
      if (shrink >= 1) {
        mesh.visible = false;
      } else if (shrink > 0) {
        mesh.scale.setScalar(1 - shrink);
      }
    }
    this.isActive = anyShown;
  }

  private hideAll(): void {
    for (const shell of this.shells) {
      shell.mesh.visible = false;
    }
    this.isActive = false;
  }
}
