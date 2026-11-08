import {
  createSceneMaterial,
  createScenePrimitiveObject,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
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

const soyGlassMaterial = new MeshStandardMaterial({
  color: '#3A1D0E',
  roughness: 0.25,
});
const soyCapMaterial = new MeshStandardMaterial({
  color: '#B5382B',
  roughness: 0.5,
});
/** A plain paper band: no brand, no writing. */
const soyLabelMaterial = new MeshStandardMaterial({
  color: '#EFE3C8',
  roughness: 0.8,
});
const riceBowlMaterial = new MeshStandardMaterial({
  color: '#DCE6EE',
  roughness: 0.4,
});
const riceMaterial = new MeshStandardMaterial({
  color: '#F5F2EA',
  roughness: 0.9,
});

/** A bottle of sweet soy sauce, standing on its long Y axis like the shaker. */
export function createSoyBottle({ lengthM, widthM }: RecipeIngredient): Group {
  const r = widthM / 2;
  const h = lengthM / 2;
  const glass = new Mesh(
    lathe(
      [
        [0, -h],
        [r * 0.96, -h],
        [r, -h + 0.003],
        [r, h * 0.3],
        [r * 0.45, h * 0.62],
        [r * 0.4, h * 0.7],
      ],
      12,
    ),
    soyGlassMaterial,
  );
  glass.name = 'SoyGlass';
  const cap = new Mesh(
    lathe(
      [
        [r * 0.42, h * 0.7],
        [r * 0.46, h * 0.72],
        [r * 0.46, h],
        [0, h],
      ],
      12,
    ),
    soyCapMaterial,
  );
  cap.name = 'SoyCap';
  const label = new Mesh(
    new CylinderGeometry(r * 1.01, r * 1.01, lengthM * 0.32, 12, 1, true),
    soyLabelMaterial,
  );
  label.name = 'SoyLabel';
  label.position.y = -h * 0.25;
  const bottle = new Group();
  bottle.name = 'SoyBottle';
  bottle.add(glass, cap, label);
  return bottle;
}

/** A small bowl heaped with cooked rice. The origin is at its middle. */
export function createRiceBowl({ lengthM }: RecipeIngredient): Group {
  const r = lengthM / 2;
  const h = 0.0225;
  const wall = 0.004;
  const bowl = new Mesh(
    lathe(
      [
        [0, -h],
        [r * 0.55, -h],
        [r * 0.62, -h + 0.004],
        [r * 0.95, h * 0.55],
        [r, h],
        [r - wall, h],
        [r * 0.9, h * 0.4],
        [r * 0.55, -h + wall + 0.004],
        [0, -h + wall + 0.004],
      ],
      16,
    ),
    riceBowlMaterial,
  );
  bowl.name = 'RiceBowlDish';
  const moundGeometry = new SphereGeometry(r * 0.88, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  moundGeometry.scale(1, 0.55, 1);
  const mound = new Mesh(moundGeometry, riceMaterial);
  mound.name = 'RiceMound';
  mound.position.y = h * 0.35;
  const group = new Group();
  group.name = 'RiceBowl';
  group.add(bowl, mound);
  return group;
}
