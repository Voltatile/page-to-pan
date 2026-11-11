import {
  BoxGeometry,
  createSceneMaterial,
  Group,
  Mesh,
  Shape,
  ShapeGeometry,
  Vector2,
} from '@iwsdk/core';
import type { Recipe, RecipeIngredient } from '../config/recipes/recipe.js';

const SHEET_THICKNESS_M = 0.005;
/** Lifts outlines off the paper enough to avoid depth fighting on Quest. */
const OUTLINE_LIFT_M = 0.003;

const paperMaterial = createSceneMaterial({
  id: 'recipe-paper',
  model: 'standard',
  baseColor: '#F6F0E2',
  roughness: 0.95,
});
const outlineMaterial = createSceneMaterial({
  id: 'recipe-outline',
  model: 'standard',
  baseColor: '#2B2F36',
  roughness: 0.9,
});
const optionalOutlineMaterial = createSceneMaterial({
  id: 'recipe-outline-optional',
  model: 'standard',
  baseColor: '#7B8494',
  roughness: 0.9,
});

function polygon(points: readonly (readonly [number, number])[]): Shape {
  return new Shape(points.map(([x, y]) => new Vector2(x, y)));
}

function eggShape(length: number, width: number): Shape {
  const points: [number, number][] = [];
  const steps = 32;
  for (let index = 0; index < steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    const narrowing = 1 - 0.14 * Math.cos(angle);
    points.push([
      (length / 2) * Math.cos(angle),
      (width / 2) * Math.sin(angle) * narrowing,
    ]);
  }
  return polygon(points);
}

function blockShape(length: number, width: number): Shape {
  const halfL = length / 2;
  const halfW = width / 2;
  const radius = 0.005;
  const shape = new Shape();
  shape.moveTo(-halfL + radius, -halfW);
  shape.lineTo(halfL - radius, -halfW);
  shape.quadraticCurveTo(halfL, -halfW, halfL, -halfW + radius);
  shape.lineTo(halfL, halfW - radius);
  shape.quadraticCurveTo(halfL, halfW, halfL - radius, halfW);
  shape.lineTo(-halfL + radius, halfW);
  shape.quadraticCurveTo(-halfL, halfW, -halfL, halfW - radius);
  shape.lineTo(-halfL, -halfW + radius);
  shape.quadraticCurveTo(-halfL, -halfW, -halfL + radius, -halfW);
  return shape;
}

/** Side profile of a shaker lying down, cap toward +X. */
function shakerShape(length: number, width: number): Shape {
  const halfL = length / 2;
  const halfW = width / 2;
  return polygon([
    [-halfL, -halfW * 0.92],
    [-halfL + 0.004, -halfW],
    [length * 0.2, -halfW],
    [length * 0.27, -halfW * 0.8],
    [length * 0.4, -halfW * 0.84],
    [halfL, -halfW * 0.45],
    [halfL, halfW * 0.45],
    [length * 0.4, halfW * 0.84],
    [length * 0.27, halfW * 0.8],
    [length * 0.2, halfW],
    [-halfL + 0.004, halfW],
    [-halfL, halfW * 0.92],
  ]);
}

/** Bundle of stalks: a shared bulb end at -X fanning into three tips at +X. */
function stalksShape(length: number, width: number): Shape {
  const halfL = length / 2;
  const halfW = width / 2;
  return polygon([
    [-halfL, -halfW * 0.25],
    [-halfL + 0.012, -halfW * 0.5],
    [length * 0.05, -halfW * 0.45],
    [halfL, -halfW],
    [length * 0.2, -halfW * 0.1],
    [halfL, -halfW * 0.08],
    [halfL, halfW * 0.08],
    [length * 0.2, halfW * 0.1],
    [halfL, halfW],
    [length * 0.05, halfW * 0.45],
    [-halfL + 0.012, halfW * 0.5],
    [-halfL, halfW * 0.25],
  ]);
}

/** A bowl seen from above: a plain circle. */
function bowlShape(diameter: number): Shape {
  const shape = new Shape();
  shape.absarc(0, 0, diameter / 2, 0, Math.PI * 2, false);
  return shape;
}

function outlineShape(ingredient: RecipeIngredient): Shape {
  const { silhouette, lengthM, widthM } = ingredient;
  switch (silhouette) {
    case 'egg':
      return eggShape(lengthM, widthM);
    case 'block':
      return blockShape(lengthM, widthM);
    case 'shaker':
      return shakerShape(lengthM, widthM);
    case 'stalks':
      return stalksShape(lengthM, widthM);
    case 'bowl':
      return bowlShape(lengthM);
  }
}

/**
 * Printed recipe sheet built entirely from recipe data. Origin is at the sheet
 * center on its contact plane; +Z points at the seated player. Each outline is
 * a separate named mesh so later steps can highlight one slot.
 */
export function createRecipeSheet(recipe: Recipe): Group {
  const [width, depth] = recipe.sheetSizeM;
  const paper = new Mesh(
    new BoxGeometry(width, SHEET_THICKNESS_M, depth),
    paperMaterial,
  );
  paper.name = 'Paper';
  paper.position.y = SHEET_THICKNESS_M / 2;

  const sheet = new Group();
  sheet.name = `RecipeSheet_${recipe.id}`;
  sheet.add(paper);

  for (const ingredient of recipe.ingredients) {
    const geometry = new ShapeGeometry(outlineShape(ingredient), 8);
    geometry.rotateX(-Math.PI / 2);
    const outline = new Mesh(
      geometry,
      ingredient.optional ? optionalOutlineMaterial : outlineMaterial,
    );
    outline.name = `Silhouette_${ingredient.id}`;
    const [x, z] = ingredient.sheetPosition;
    outline.position.set(x, SHEET_THICKNESS_M + OUTLINE_LIFT_M, z);
    sheet.add(outline);
  }
  return sheet;
}
