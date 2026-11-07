import {
  createSystem,
  type Entity,
  Grabbed,
  Mesh,
  MeshStandardMaterial,
  OneHandGrabbable,
} from '@iwsdk/core';
import { TUNING } from '../config/tuning.js';
import { InReach } from '../game-components.js';

interface PointerLike {
  pointerId: number;
}

type PointerListener = (event: PointerLike) => void;

interface PointerTarget {
  addEventListener(type: string, listener: PointerListener): void;
  removeEventListener(type: string, listener: PointerListener): void;
}

/**
 * Lights up whatever a hand can grab right now. It listens to the grab pointer
 * itself, so the glow means exactly "a pinch here will catch this object".
 */
export class ReachHighlightSystem extends createSystem({
  grabbables: { required: [OneHandGrabbable] },
  glowing: { required: [InReach], excluded: [Grabbed] },
}) {
  private readonly pointers = new Map<Entity, Set<number>>();
  private readonly materials = new Map<Entity, MeshStandardMaterial[]>();

  init(): void {
    this.cleanupFuncs.push(
      this.queries.grabbables.subscribe('qualify', (entity) =>
        this.watch(entity),
      ),
      this.queries.glowing.subscribe('qualify', (entity) =>
        this.setGlow(entity, TUNING.reachGlowIntensity),
      ),
      this.queries.glowing.subscribe('disqualify', (entity) =>
        this.setGlow(entity, 0),
      ),
    );
    for (const entity of this.queries.grabbables.entities) {
      this.watch(entity);
    }
  }

  private watch(entity: Entity): void {
    const target = entity.object3D as unknown as PointerTarget | undefined;
    if (target == null || this.pointers.has(entity)) {
      return;
    }
    const pointers = new Set<number>();
    this.pointers.set(entity, pointers);

    const enter: PointerListener = ({ pointerId }) => {
      pointers.add(pointerId);
      if (!entity.hasComponent(InReach)) {
        entity.addComponent(InReach);
      }
    };
    const leave: PointerListener = ({ pointerId }) => {
      pointers.delete(pointerId);
      if (pointers.size === 0 && entity.hasComponent(InReach)) {
        entity.removeComponent(InReach);
      }
    };
    target.addEventListener('pointerenter', enter);
    target.addEventListener('pointerleave', leave);
    this.cleanupFuncs.push(() => {
      target.removeEventListener('pointerenter', enter);
      target.removeEventListener('pointerleave', leave);
    });
  }

  private setGlow(entity: Entity, intensity: number): void {
    for (const material of this.ownMaterials(entity)) {
      material.emissiveIntensity = intensity;
    }
  }

  /** Clones on first use, so one object's glow never reaches its siblings. */
  private ownMaterials(entity: Entity): MeshStandardMaterial[] {
    const known = this.materials.get(entity);
    if (known != null) {
      return known;
    }
    const clones: MeshStandardMaterial[] = [];
    entity.object3D?.traverse((child) => {
      if (
        child instanceof Mesh &&
        child.material instanceof MeshStandardMaterial
      ) {
        const clone = child.material.clone();
        clone.emissive.set(TUNING.reachGlowColor);
        clone.emissiveIntensity = 0;
        child.material = clone;
        clones.push(clone);
      }
    });
    this.materials.set(entity, clones);
    return clones;
  }
}
