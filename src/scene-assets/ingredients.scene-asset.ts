import {
  createSceneMaterial,
  createScenePrimitiveObject,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Vector2,
} from '@iwsdk/core';
import type { RecipeIngredient } from '../config/recipes/recipe.js';

/**
 * Real-size placeholder ingredients, to be replaced by CC0 models. Each origin
 * is at the object center so grabbing and snapping pivot naturally, and the
 * long axis lies along X to match the outline on the recipe sheet. The salt
 * shaker is the exception: it stands upright on its long Y axis.
 */

const eggMaterial = createSceneMaterial({
  id: 'ingredient-egg',
  model: 'standard',
  baseColor: '#E8C9A0',
  roughness: 0.6,
});
const shakerBodyMaterial = createSceneMaterial({
  id: 'ingredient-shaker-body',
  model: 'standard',
  baseColor: '#F2F3F4',
  roughness: 0.35,
});
const shakerCapMaterial = createSceneMaterial({
  id: 'ingredient-shaker-cap',
  model: 'standard',
  baseColor: '#8A9099',
  roughness: 0.4,
  metalness: 0.6,
});
const butterMaterial = createSceneMaterial({
  id: 'ingredient-butter',
  model: 'standard',
  baseColor: '#F5D76E',
  roughness: 0.5,
});
const onionMaterial = new MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.65,
});

function lathe(
  points: readonly (readonly [number, number])[],
  segments: number,
): LatheGeometry {
  return new LatheGeometry(
    points.map(([radius, y]) => new Vector2(radius, y)),
    segments,
  );
}

export function createEgg({ lengthM, widthM }: RecipeIngredient): Mesh {
  const points: [number, number][] = [];
  const steps = 8;
  for (let index = 0; index <= steps; index += 1) {
    const angle = (index / steps) * Math.PI;
    const narrowing = 1 - 0.14 * Math.cos(angle);
    points.push([
      Math.max((widthM / 2) * Math.sin(angle) * narrowing, 0),
      (-lengthM / 2) * Math.cos(angle),
    ]);
  }
  const geometry = lathe(points, 12);
  geometry.rotateZ(-Math.PI / 2);
  const egg = new Mesh(geometry, eggMaterial);
  egg.name = 'Egg';
  return egg;
}

export function createSaltShaker({ lengthM, widthM }: RecipeIngredient): Group {
  const r = widthM / 2;
  const h = lengthM / 2;
  const body = new Mesh(
    lathe(
      [
        [0, -h],
        [r * 0.96, -h],
        [r, -h + 0.003],
        [r, h * 0.4],
        [r * 0.8, h * 0.54],
      ],
      12,
    ),
    shakerBodyMaterial,
  );
  body.name = 'ShakerBody';
  const cap = new Mesh(
    lathe(
      [
        [r * 0.8, h * 0.54],
        [r * 0.84, h * 0.6],
        [r * 0.84, h * 0.8],
        [r * 0.45, h],
        [0, h],
      ],
      12,
    ),
    shakerCapMaterial,
  );
  cap.name = 'ShakerCap';
  const shaker = new Group();
  shaker.name = 'SaltShaker';
  shaker.add(body, cap);
  return shaker;
}

export function createButter({ lengthM, widthM }: RecipeIngredient): Mesh {
  const butter = createScenePrimitiveObject(
    {
      geometry: {
        type: 'roundedBox',
        size: [lengthM, 0.03, widthM],
        radius: 0.003,
        segments: 2,
      },
    },
    butterMaterial,
  );
  butter.name = 'Butter';
  return butter;
}

/** Three stalks sharing one geometry; white bulb at -X fading to green at +X. */
export function createGreenOnion({ lengthM, widthM }: RecipeIngredient): Group {
  const stalkRadius = widthM / 5;
  const geometry = new CylinderGeometry(
    stalkRadius * 0.5,
    stalkRadius,
    lengthM,
    6,
    3,
  );
  const positions = geometry.getAttribute('position');
  const colors: number[] = [];
  for (let index = 0; index < positions.count; index += 1) {
    const greenness = Math.min(positions.getY(index) / lengthM + 0.75, 1);
    colors.push(
      0.92 - 0.62 * greenness,
      0.92 - 0.3 * greenness,
      0.82 - 0.57 * greenness,
    );
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.rotateZ(-Math.PI / 2);

  const bundle = new Group();
  bundle.name = 'GreenOnion';
  const spread = widthM * 0.3;
  for (const [index, offset] of [-spread, 0, spread].entries()) {
    const stalk = new Mesh(geometry, onionMaterial);
    stalk.name = `Stalk${index}`;
    stalk.position.z = offset;
    bundle.add(stalk);
  }
  return bundle;
}
