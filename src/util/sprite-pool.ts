import {
  Color,
  DataTexture,
  InstancedMesh,
  Matrix4,
  type MeshBasicMaterial,
  PlaneGeometry,
  type Quaternion,
  RGBAFormat,
  Vector3,
} from '@iwsdk/core';

/** How one particle moves and how big it is over its life. */
export interface SpriteMotion {
  /** Meters per second squared along Y; negative falls, positive rises. */
  gravity: number;
  /** Fraction of speed lost per second. */
  drag: number;
  lifeS: number;
  startSize: number;
  endSize: number;
  /** The particle disappears once it sinks below this height. */
  floorY: number;
  /** Seconds to grow in at birth and shrink away at death. */
  fadeS: number;
}

/** A soft white dot. The alpha falls off from the center outward. */
export function createDotTexture(size = 32): DataTexture {
  const data = new Uint8Array(size * size * 4);
  const half = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x + 0.5 - half, y + 0.5 - half) / half;
      const alpha = Math.max(1 - distance, 0);
      const index = (y * size + x) * 4;
      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
      data[index + 3] = Math.round(255 * alpha * alpha * (3 - 2 * alpha));
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Camera-facing quads drawn in one instanced call. Dead particles collapse
 * to zero size, and the whole mesh hides while none are alive, so an idle
 * pool costs no draw call. Nothing is allocated after construction.
 */
export class SpritePool {
  readonly mesh: InstancedMesh;
  private readonly capacity: number;
  private readonly position: Float32Array;
  private readonly velocity: Float32Array;
  private readonly age: Float32Array;
  private readonly motion: SpriteMotion[];
  private readonly matrix = new Matrix4();
  private readonly at = new Vector3();
  private readonly scale = new Vector3();
  private cursor = 0;
  private alive = 0;

  constructor(name: string, capacity: number, material: MeshBasicMaterial) {
    this.capacity = capacity;
    this.position = new Float32Array(capacity * 3);
    this.velocity = new Float32Array(capacity * 3);
    this.age = new Float32Array(capacity).fill(Infinity);
    this.motion = Array.from({ length: capacity }, () => ({
      gravity: 0,
      drag: 0,
      lifeS: 0,
      startSize: 0,
      endSize: 0,
      floorY: -Infinity,
      fadeS: 0,
    }));
    this.mesh = new InstancedMesh(new PlaneGeometry(1, 1), material, capacity);
    this.mesh.name = name;
    // Particles roam outside the geometry bounds, so skip culling.
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.matrix.makeScale(0, 0, 0);
    const white = new Color(1, 1, 1);
    for (let index = 0; index < capacity; index += 1) {
      this.mesh.setMatrixAt(index, this.matrix);
      // Colors exist from the start, so the shader compiles with them.
      this.mesh.setColorAt(index, white);
    }
  }

  spawn(
    at: Vector3,
    vx: number,
    vy: number,
    vz: number,
    color: Color,
    motion: SpriteMotion,
  ): void {
    const index = this.freeSlot();
    const base = index * 3;
    this.position[base] = at.x;
    this.position[base + 1] = at.y;
    this.position[base + 2] = at.z;
    this.velocity[base] = vx;
    this.velocity[base + 1] = vy;
    this.velocity[base + 2] = vz;
    this.age[index] = 0;
    Object.assign(this.motion[index] as SpriteMotion, motion);
    this.mesh.setColorAt(index, color);
    if (this.mesh.instanceColor != null) {
      this.mesh.instanceColor.needsUpdate = true;
    }
    this.alive += 1;
    this.mesh.visible = true;
  }

  /** Moves every live particle and turns it toward `facing`. */
  update(delta: number, facing: Quaternion): void {
    if (this.alive === 0) {
      return;
    }
    let alive = 0;
    for (let index = 0; index < this.capacity; index += 1) {
      const age = this.age[index] ?? Infinity;
      if (age === Infinity) {
        continue;
      }
      const motion = this.motion[index] as SpriteMotion;
      const base = index * 3;
      const keep = Math.max(1 - motion.drag * delta, 0);
      const vx = (this.velocity[base] ?? 0) * keep;
      const vy = ((this.velocity[base + 1] ?? 0) + motion.gravity * delta) * keep;
      const vz = (this.velocity[base + 2] ?? 0) * keep;
      this.velocity[base] = vx;
      this.velocity[base + 1] = vy;
      this.velocity[base + 2] = vz;
      const x = (this.position[base] ?? 0) + vx * delta;
      const y = (this.position[base + 1] ?? 0) + vy * delta;
      const z = (this.position[base + 2] ?? 0) + vz * delta;
      this.position[base] = x;
      this.position[base + 1] = y;
      this.position[base + 2] = z;
      const nextAge = age + delta;
      if (nextAge >= motion.lifeS || y < motion.floorY) {
        this.age[index] = Infinity;
        this.matrix.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(index, this.matrix);
        continue;
      }
      this.age[index] = nextAge;
      alive += 1;
      const t = nextAge / motion.lifeS;
      const fade =
        motion.fadeS > 0
          ? Math.min(
              nextAge / motion.fadeS,
              (motion.lifeS - nextAge) / motion.fadeS,
              1,
            )
          : 1;
      const size =
        (motion.startSize + (motion.endSize - motion.startSize) * t) * fade;
      this.at.set(x, y, z);
      this.scale.set(size, size, size);
      this.matrix.compose(this.at, facing, this.scale);
      this.mesh.setMatrixAt(index, this.matrix);
    }
    this.alive = alive;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (alive === 0) {
      this.mesh.visible = false;
    }
  }

  /** Clears every particle at once. */
  clear(): void {
    this.matrix.makeScale(0, 0, 0);
    for (let index = 0; index < this.capacity; index += 1) {
      this.age[index] = Infinity;
      this.mesh.setMatrixAt(index, this.matrix);
    }
    this.alive = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = false;
  }

  /** A dead slot if there is one, otherwise the oldest by spawn order. */
  private freeSlot(): number {
    for (let step = 0; step < this.capacity; step += 1) {
      const index = (this.cursor + step) % this.capacity;
      if (this.age[index] === Infinity) {
        this.cursor = (index + 1) % this.capacity;
        return index;
      }
    }
    const index = this.cursor;
    this.cursor = (index + 1) % this.capacity;
    this.alive -= 1;
    return index;
  }
}
