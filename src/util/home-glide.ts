import type { Entity, Quaternion, Vector3 } from '@iwsdk/core';
import { TUNING } from '../config/tuning.js';

interface HomePose {
  position: Vector3;
  quaternion: Quaternion;
}

/** Remembers where objects belong and glides them back after a release. */
export class HomeGlide {
  private readonly homes = new Map<Entity, HomePose>();
  private readonly starts = new Map<Entity, HomePose>();
  private readonly returning = new Set<Entity>();

  constructor(private readonly onLand?: (entity: Entity) => void) {}

  /** Records the current pose as home, once per entity. */
  remember(entity: Entity): void {
    const object = entity.object3D;
    if (object != null && !this.starts.has(entity)) {
      const pose = {
        position: object.position.clone(),
        quaternion: object.quaternion.clone(),
      };
      this.starts.set(entity, pose);
      this.homes.set(entity, pose);
    }
  }

  /** Makes the pose from `remember` the home again. */
  restoreStart(entity: Entity): void {
    const start = this.starts.get(entity);
    if (start != null) {
      this.homes.set(entity, start);
    }
  }

  setHome(entity: Entity, position: Vector3, quaternion: Quaternion): void {
    this.homes.set(entity, {
      position: position.clone(),
      quaternion: quaternion.clone(),
    });
  }

  start(entity: Entity): void {
    this.returning.add(entity);
  }

  stop(entity: Entity): void {
    this.returning.delete(entity);
  }

  /** Puts the object home at once. */
  land(entity: Entity): void {
    this.returning.delete(entity);
    const home = this.homes.get(entity);
    if (home != null) {
      entity.object3D?.position.copy(home.position);
      entity.object3D?.quaternion.copy(home.quaternion);
    }
    this.onLand?.(entity);
  }

  update(delta: number): void {
    const blend = Math.min(TUNING.returnRatePerS * delta, 1);
    for (const entity of this.returning) {
      const home = this.homes.get(entity);
      const object = entity.object3D;
      if (home == null || object == null) {
        this.returning.delete(entity);
        continue;
      }
      object.position.lerp(home.position, blend);
      object.quaternion.slerp(home.quaternion, blend);
      if (object.position.distanceTo(home.position) < TUNING.returnSettleM) {
        this.land(entity);
      }
    }
  }
}
