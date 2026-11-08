import { Color, MeshBasicMaterial, Quaternion, Vector3 } from '@iwsdk/core';
import { describe, expect, it } from 'vitest';
import { type SpriteMotion, SpritePool } from './sprite-pool.js';

const FALLING: SpriteMotion = {
  gravity: -3,
  drag: 0,
  lifeS: 1,
  startSize: 0.01,
  endSize: 0.01,
  floorY: 0.5,
  fadeS: 0,
};

const facing = new Quaternion();
const white = new Color(1, 1, 1);

function makePool(capacity = 4): SpritePool {
  return new SpritePool('Test', capacity, new MeshBasicMaterial());
}

describe('SpritePool', () => {
  it('hides the mesh until something spawns', () => {
    const pool = makePool();
    expect(pool.mesh.visible).toBe(false);
    pool.spawn(new Vector3(0, 1, 0), 0, 0, 0, white, FALLING);
    expect(pool.mesh.visible).toBe(true);
  });

  it('drops a particle once it falls below its floor', () => {
    const pool = makePool();
    pool.spawn(new Vector3(0, 0.55, 0), 0, -1, 0, white, FALLING);
    pool.update(0.02, facing);
    expect(pool.mesh.visible).toBe(true);
    for (let frame = 0; frame < 10; frame += 1) {
      pool.update(0.02, facing);
    }
    expect(pool.mesh.visible).toBe(false);
  });

  it('drops a particle at the end of its life', () => {
    const pool = makePool();
    pool.spawn(new Vector3(0, 10, 0), 0, 0, 0, white, {
      ...FALLING,
      gravity: 0,
    });
    pool.update(0.5, facing);
    expect(pool.mesh.visible).toBe(true);
    pool.update(0.6, facing);
    expect(pool.mesh.visible).toBe(false);
  });

  it('reuses the oldest slot when full', () => {
    const pool = makePool(2);
    const motion = { ...FALLING, gravity: 0, floorY: -Infinity };
    for (let index = 0; index < 5; index += 1) {
      pool.spawn(new Vector3(index, 1, 0), 0, 0, 0, white, motion);
    }
    pool.update(0.5, facing);
    expect(pool.mesh.visible).toBe(true);
    pool.update(0.6, facing);
    expect(pool.mesh.visible).toBe(false);
  });
});
