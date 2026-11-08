import {
  BackSide,
  BoxGeometry,
  createScenePrimitiveObject,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from '@iwsdk/core';
import { TUNING } from '../config/tuning.js';
import { type ColoredPart, mergeColored } from './lib/merge-colored.js';

const TABLE_TOP_HEIGHT_M = TUNING.tableTopHeightM;

const WOOD = '#B98A5E';
const DARK_WOOD = '#7C5A3C';
const FLOOR = '#8C6B4F';
const CABINET = '#7E9C8E';
const COUNTER = '#D9D4C9';
const TILE = '#F4EFE6';

/**
 * Static scenery is baked into one mesh per asset with vertex colors, so the
 * table, the counter run and the stand cost one draw call each.
 */
const sceneryMaterial = new MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.7,
});
const wallMaterial = new MeshStandardMaterial({
  color: '#EADFCB',
  roughness: 0.95,
  side: BackSide,
});

function boxMesh(
  size: readonly [number, number, number],
  position: readonly [number, number, number],
): Mesh {
  const mesh = new Mesh(new BoxGeometry(...size));
  mesh.position.set(...position);
  return mesh;
}

/**
 * Seated work table. Origin is at floor contact under the table center, with
 * the seated player on the +Z side. Top surface: 1.2 x 0.7 m.
 */
export function createKitchenTable(): Group {
  const thickness = 0.04;
  const top = createScenePrimitiveObject(
    {
      geometry: {
        type: 'roundedBox',
        size: [1.2, thickness, 0.7],
        radius: 0.012,
        segments: 2,
      },
    },
    sceneryMaterial,
  );
  if (!(top instanceof Mesh)) {
    throw new Error('A rounded box primitive should be a mesh');
  }
  top.position.y = TABLE_TOP_HEIGHT_M - thickness / 2;

  const legHeight = TABLE_TOP_HEIGHT_M - thickness;
  const apronHeight = 0.07;
  const parts: ColoredPart[] = [
    [top, WOOD],
    [
      boxMesh([1.06, apronHeight, 0.56], [0, legHeight - apronHeight / 2, 0]),
      DARK_WOOD,
    ],
  ];
  for (const [x, z] of [
    [-0.54, -0.29],
    [0.54, -0.29],
    [-0.54, 0.29],
    [0.54, 0.29],
  ] as const) {
    parts.push([
      boxMesh([0.06, legHeight, 0.06], [x, legHeight / 2, z]),
      DARK_WOOD,
    ]);
  }
  const table = new Group();
  table.name = 'KitchenTable';
  table.add(mergeColored('Table', parts, sceneryMaterial));
  return table;
}

/**
 * Simple kitchen shell around the player: floor, walls, and a counter run
 * along the -Z wall. Origin is at floor level under the seated player.
 */
export function createKitchenRoom(): Group {
  const room = new Group();
  room.name = 'KitchenRoom';

  const shell = new Mesh(new BoxGeometry(4.6, 2.7, 4.4), wallMaterial);
  shell.name = 'Walls';
  shell.position.set(0, 1.35, -0.4);

  const floorGeometry = new PlaneGeometry(4.6, 4.4);
  floorGeometry.rotateX(-Math.PI / 2);
  const floor = new Mesh(floorGeometry);
  floor.position.set(0, 0.001, -0.4);

  room.add(
    shell,
    mergeColored(
      'FloorAndCounter',
      [
        [floor, FLOOR],
        [boxMesh([3.4, 0.86, 0.6], [0, 0.43, -2.28]), CABINET],
        [boxMesh([3.5, 0.04, 0.66], [0, 0.88, -2.26]), COUNTER],
        [boxMesh([3.4, 0.56, 0.02], [0, 1.18, -2.59]), TILE],
        [boxMesh([3.4, 0.72, 0.34], [0, 1.82, -2.42]), CABINET],
      ],
      sceneryMaterial,
    ),
  );
  return room;
}

const LEATHER = '#7A3B2E';
const SPINE = '#5C2A20';
const PAGE_EDGES = '#EFE6D2';

/** Thickness of the cover board plus the page block on it. */
export const BOOK_THICKNESS_M = 0.007;

/**
 * The recipe book lying open on the table: a leather cover, a spine on the
 * left and a block of pages. The recipe sheets lie on top as its pages.
 * Origin at table contact under the page center; it matches a 40 x 32 cm sheet.
 */
export function createRecipeBook(): Group {
  const coverThickness = 0.003;
  const pagesThickness = BOOK_THICKNESS_M - coverThickness;
  const book = new Group();
  book.name = 'RecipeBook';
  book.add(
    mergeColored(
      'Book',
      [
        [boxMesh([0.43, coverThickness, 0.35], [-0.0125, coverThickness / 2, 0]), LEATHER],
        [boxMesh([0.022, 0.009, 0.35], [-0.217, 0.0045, 0]), SPINE],
        [
          boxMesh(
            [0.398, pagesThickness, 0.318],
            [0, coverThickness + pagesThickness / 2, 0],
          ),
          PAGE_EDGES,
        ],
      ],
      sceneryMaterial,
    ),
  );
  return book;
}

/**
 * Wooden stand that props the recipe card at 45 degrees toward the seated
 * player. Origin is at table contact under the front lip.
 */
export function createRecipeStand(): Group {
  const stand = new Group();
  stand.name = 'RecipeStand';

  const board = boxMesh([0.5, 0.27, 0.012], [0, 0.0955, -0.0955]);
  board.rotation.x = -Math.PI / 4;

  stand.add(
    mergeColored(
      'Stand',
      [
        [board, WOOD],
        [boxMesh([0.5, 0.014, 0.03], [0, 0.007, 0.01]), WOOD],
        [boxMesh([0.4, 0.11, 0.012], [0, 0.055, -0.125]), DARK_WOOD],
      ],
      sceneryMaterial,
    ),
  );
  return stand;
}
