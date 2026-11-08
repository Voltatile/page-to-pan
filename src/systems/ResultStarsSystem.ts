import {
  createSystem,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  Shape,
  Vector3,
  Visibility,
} from '@iwsdk/core';
import { EffectsSystem } from './EffectsSystem.js';
import { ScoreSystem } from './ScoreSystem.js';
import { SoundSystem } from './SoundSystem.js';
import { StepSystem } from './StepSystem.js';

const STAR_COUNT = 3;
const OUTER_RADIUS_M = 0.028;
const INNER_RADIUS_M = 0.012;
const DEPTH_M = 0.006;
const SPACING_M = 0.075;
/** Above the recipe card, in the stand's space. */
const ROW_POSITION = [0, 0.235, -0.2] as const;
/** Tipped back a little so the faces point at a seated player's eyes. */
const ROW_TILT_RAD = -0.2;
const POP_DELAY_S = 0.3;
const POP_S = 0.35;
/** The "New best!" ribbon pops in just after the last star has landed. */
const BANNER_DELAY_S = (STAR_COUNT - 1) * POP_DELAY_S + POP_S + 0.15;
/** Overshoot of the pop, as in an ease-out-back curve. */
const OVERSHOOT = 1.7;

function starGeometry(): ExtrudeGeometry {
  const shape = new Shape();
  for (let point = 0; point < 10; point += 1) {
    const radius = point % 2 === 0 ? OUTER_RADIUS_M : INNER_RADIUS_M;
    const angle = Math.PI / 2 + (point * Math.PI) / 5;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (point === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, {
    depth: DEPTH_M,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.0015,
    bevelSegments: 1,
  });
  geometry.translate(0, 0, -DEPTH_M / 2);
  return geometry;
}

function easeOutBack(t: number): number {
  const u = t - 1;
  return 1 + (OVERSHOOT + 1) * u * u * u + OVERSHOOT * u * u;
}

/** Three stars pop up over the card when the cook is scored. */
export class ResultStarsSystem extends createSystem({}) {
  private readonly row = new Group();
  private readonly stars: Mesh[] = [];
  private readonly earned = new MeshStandardMaterial({
    color: '#F5B82E',
    emissive: '#7A4A00',
    roughness: 0.35,
    metalness: 0.2,
  });
  private readonly missed = new MeshStandardMaterial({
    color: '#6E737C',
    roughness: 0.8,
  });
  private steps!: StepSystem;
  private score!: ScoreSystem;
  private showS = -1;
  private popped = 0;
  private earnedCount = 0;
  private readonly starAt = new Vector3();
  private banner: Object3D | undefined;
  private bannerScale = 1;
  private showsBanner = false;
  private setBannerShown: (isShown: boolean) => void = () => undefined;
  private sound: SoundSystem | undefined;
  private effects: EffectsSystem | undefined;

  init(): void {
    const steps = this.world.getSystem(StepSystem);
    const score = this.world.getSystem(ScoreSystem);
    if (steps == null || score == null) {
      throw new Error('ResultStarsSystem needs StepSystem and ScoreSystem');
    }
    this.steps = steps;
    this.score = score;
    this.sound = this.world.getSystem(SoundSystem);
    this.effects = this.world.getSystem(EffectsSystem);
    const geometry = starGeometry();
    for (let index = 0; index < STAR_COUNT; index += 1) {
      const star = new Mesh(geometry, this.missed);
      star.name = `ResultStar${index + 1}`;
      star.position.x = (index - (STAR_COUNT - 1) / 2) * SPACING_M;
      this.stars.push(star);
      this.row.add(star);
    }
    this.row.name = 'ResultStars';
    this.row.position.set(...ROW_POSITION);
    this.row.rotation.x = ROW_TILT_RAD;
    this.row.visible = false;
    this.world.requireSceneEntity('recipe-stand').object3D?.add(this.row);
    const bannerEntity = this.world.requireSceneEntity('result-banner');
    this.banner = bannerEntity.object3D;
    this.bannerScale = this.banner?.scale.x ?? 1;
    this.setBannerShown = (isShown: boolean) =>
      bannerEntity.setValue(Visibility, 'isVisible', isShown);
    this.setBannerShown(false);
    this.cleanupFuncs.push(
      steps.subscribe(() => this.onStepChange()),
      () => this.row.removeFromParent(),
    );
  }

  update(delta: number): void {
    if (this.showS < 0) {
      return;
    }
    this.showS += delta;
    while (
      this.popped < STAR_COUNT &&
      this.showS >= this.popped * POP_DELAY_S
    ) {
      this.onPop(this.popped);
      this.popped += 1;
    }
    let isSettled = true;
    for (let index = 0; index < STAR_COUNT; index += 1) {
      const t = Math.min(
        Math.max((this.showS - index * POP_DELAY_S) / POP_S, 0),
        1,
      );
      isSettled &&= t >= 1;
      // A scale of exactly 0 makes a degenerate matrix, so start just above.
      this.stars[index]?.scale.setScalar(Math.max(easeOutBack(t), 0.001));
    }
    if (this.showsBanner && this.banner != null) {
      const t = Math.min(
        Math.max((this.showS - BANNER_DELAY_S) / POP_S, 0),
        1,
      );
      isSettled &&= t >= 1;
      this.banner.scale.setScalar(
        this.bannerScale * Math.max(easeOutBack(t), 0.001),
      );
    }
    if (isSettled) {
      this.showS = -1;
    }
  }

  private onStepChange(): void {
    const result = this.steps.state.phase === 'done' ? this.score.result : null;
    if (result == null) {
      this.row.visible = false;
      this.showsBanner = false;
      this.setBannerShown(false);
      this.showS = -1;
      return;
    }
    if (this.row.visible) {
      return;
    }
    this.stars.forEach((star, index) => {
      star.material = index < result.stars ? this.earned : this.missed;
      star.scale.setScalar(0.001);
    });
    this.row.visible = true;
    this.showS = 0;
    this.popped = 0;
    this.earnedCount = result.stars;
    this.showsBanner = this.score.isNewBest;
    this.banner?.scale.setScalar(this.bannerScale * 0.001);
    this.setBannerShown(this.showsBanner);
  }

  /** Each earned star rings a little higher and throws a few sparkles. */
  private onPop(index: number): void {
    const star = this.stars[index];
    if (star == null) {
      return;
    }
    // The star is still tiny here, so its position is where it will settle.
    star.getWorldPosition(this.starAt);
    if (index < this.earnedCount) {
      this.sound?.playSound('star', this.starAt, 1, 1 + index * 0.12);
      this.effects?.burst('sparkle', this.starAt);
    } else {
      this.sound?.playSound('snap', this.starAt, 0.6, 0.8);
    }
  }
}
