import {
  BackSide,
  BoxGeometry,
  createScenePrimitiveObject,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
} from '@iwsdk/core';
import { TUNING } from '../config/tuning.js';
import { type ColoredPart, mergeColored } from './lib/merge-colored.js';

const TABLE_TOP_HEIGHT_M = TUNING.tableTopHeightM;

const WOOD = '#B98A5E';
const DARK_WOOD = '#7C5A3C';
const FLOOR = '#8C6B4F';
const CABINET = '#7E9C8E';
const CABINET_DOOR = '#728E80';
const COUNTER = '#D9D4C9';
const TILE = '#F4EFE6';
const BRASS = '#D4AF37';
const SLATE = '#4A5568';
const DARK_SLATE = '#343D48';
const SKY = '#A9D2EB';
const HORIZON = '#E6F2F9';
const FOLIAGE = '#4E7C59';
const FOLIAGE_LIGHT = '#62996F';
const FOLIAGE_DARK = '#3A5C43';
const POT = '#C06C46';
const WARM_WHITE = '#FAF7F2';
const IRON = '#333333';
const SPICE_RED = '#B54832';
const SPICE_GOLD = '#D8973C';
const OIL_GREEN = '#6B7F42';
const CORK = '#C4A482';
const BULB = '#FFF4D0';

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
  rotation?: readonly [number, number, number],
): Mesh {
  const mesh = new Mesh(new BoxGeometry(...size));
  mesh.position.set(...position);
  if (rotation) {
    mesh.rotation.set(...rotation);
  }
  return mesh;
}

function cylinderMesh(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments: number,
  position: readonly [number, number, number],
  rotation?: readonly [number, number, number],
): Mesh {
  const mesh = new Mesh(
    new CylinderGeometry(radiusTop, radiusBottom, height, segments),
  );
  mesh.position.set(...position);
  if (rotation) {
    mesh.rotation.set(...rotation);
  }
  return mesh;
}

function sphereMesh(
  radius: number,
  widthSegments: number,
  heightSegments: number,
  position: readonly [number, number, number],
): Mesh {
  const mesh = new Mesh(
    new SphereGeometry(radius, widthSegments, heightSegments),
  );
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
 * Cozy kitchen environment around the player: floor, walls, counter, window,
 * cabinetry, floating shelves with kitchen props, and a ceiling pendant lamp.
 * Baked into one vertex-colored mesh to preserve Quest 2 draw call budgets.
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

  const sceneryParts: ColoredPart[] = [
    // Floor
    [floor, FLOOR],

    // Architectural baseboards along floor-to-wall seams
    [boxMesh([4.6, 0.08, 0.02], [0, 0.04, -2.59]), DARK_WOOD],
    [boxMesh([0.02, 0.08, 4.4], [-2.29, 0.04, -0.4]), DARK_WOOD],
    [boxMesh([0.02, 0.08, 4.4], [2.29, 0.04, -0.4]), DARK_WOOD],

    // Main lower counter body and recessed toe-kick
    [boxMesh([3.4, 0.86, 0.6], [0, 0.43, -2.28]), CABINET],
    [boxMesh([3.38, 0.08, 0.04], [0, 0.04, -1.97]), '#3A4B42'],

    // Cabinet door panels and brass handles
    [boxMesh([0.78, 0.72, 0.015], [-1.23, 0.47, -1.975]), CABINET_DOOR],
    [boxMesh([0.78, 0.72, 0.015], [-0.41, 0.47, -1.975]), CABINET_DOOR],
    [boxMesh([0.78, 0.72, 0.015], [0.41, 0.47, -1.975]), CABINET_DOOR],
    [boxMesh([0.78, 0.72, 0.015], [1.23, 0.47, -1.975]), CABINET_DOOR],
    [boxMesh([0.02, 0.12, 0.025], [-0.86, 0.54, -1.96]), BRASS],
    [boxMesh([0.02, 0.12, 0.025], [-0.78, 0.54, -1.96]), BRASS],
    [boxMesh([0.02, 0.12, 0.025], [0.78, 0.54, -1.96]), BRASS],
    [boxMesh([0.02, 0.12, 0.025], [0.86, 0.54, -1.96]), BRASS],

    // Countertop and tile backsplash
    [boxMesh([3.5, 0.04, 0.66], [0, 0.88, -2.26]), COUNTER],
    [boxMesh([3.4, 0.58, 0.02], [0, 1.17, -2.59]), TILE],
    [boxMesh([3.42, 0.025, 0.035], [0, 1.47, -2.58]), WOOD],

    // --- Center Cooktop & Range Hood ---
    // Sleek flush cooktop plate on the back counter
    [boxMesh([0.68, 0.01, 0.42], [0, 0.905, -2.26]), '#222428'],
    [
      cylinderMesh(0.08, 0.08, 0.005, 12, [-0.18, 0.912, -2.26]),
      '#3D4148',
    ],
    [cylinderMesh(0.08, 0.08, 0.005, 12, [0.18, 0.912, -2.26]), '#3D4148'],

    // Range hood body and chimney
    [boxMesh([0.8, 0.05, 0.44], [0, 1.54, -2.37]), SLATE],
    [boxMesh([0.82, 0.015, 0.02], [0, 1.52, -2.14]), BRASS],
    [boxMesh([0.65, 0.24, 0.36], [0, 1.68, -2.41]), DARK_SLATE],
    [boxMesh([0.38, 0.74, 0.28], [0, 2.17, -2.45]), SLATE],

    // --- Left: Daylight Window & Potted Plant ---
    // Distant sky, horizon, and soft green tree line
    [boxMesh([0.94, 0.74, 0.01], [-1.15, 1.46, -2.595]), SKY],
    [boxMesh([0.94, 0.22, 0.012], [-1.15, 1.2, -2.593]), HORIZON],
    [boxMesh([0.94, 0.1, 0.013], [-1.15, 1.14, -2.591]), FOLIAGE],

    // Window frame, sill and muntin crossbars
    [boxMesh([1.08, 0.035, 0.12], [-1.15, 1.06, -2.53]), DARK_WOOD],
    [boxMesh([1.08, 0.04, 0.04], [-1.15, 1.86, -2.57]), DARK_WOOD],
    [boxMesh([0.04, 0.8, 0.04], [-1.65, 1.46, -2.57]), DARK_WOOD],
    [boxMesh([0.04, 0.8, 0.04], [-0.65, 1.46, -2.57]), DARK_WOOD],
    [boxMesh([0.025, 0.76, 0.02], [-1.15, 1.46, -2.58]), DARK_WOOD],
    [boxMesh([0.96, 0.025, 0.02], [-1.15, 1.46, -2.58]), DARK_WOOD],

    // Small potted succulent on the window sill
    [cylinderMesh(0.045, 0.035, 0.07, 8, [-0.85, 1.11, -2.53]), POT],
    [cylinderMesh(0.042, 0.042, 0.01, 8, [-0.85, 1.145, -2.53]), '#4A3525'],
    [sphereMesh(0.035, 6, 6, [-0.85, 1.18, -2.53]), FOLIAGE],
    [sphereMesh(0.028, 5, 5, [-0.83, 1.2, -2.52]), FOLIAGE_LIGHT],
    [sphereMesh(0.025, 5, 5, [-0.87, 1.17, -2.54]), FOLIAGE_DARK],

    // Upper cabinet on the far left next to the window
    [boxMesh([0.45, 0.72, 0.34], [-1.88, 1.82, -2.42]), CABINET],
    [boxMesh([0.41, 0.68, 0.015], [-1.88, 1.82, -2.24]), CABINET_DOOR],
    [boxMesh([0.02, 0.12, 0.025], [-1.72, 1.68, -2.23]), BRASS],

    // --- Right: Warm Floating Shelves with Kitchen Props ---
    // Lower floating shelf & iron brackets
    [boxMesh([1.0, 0.035, 0.22], [1.15, 1.34, -2.47]), WOOD],
    [boxMesh([0.03, 0.12, 0.2], [0.75, 1.28, -2.48]), IRON],
    [boxMesh([0.03, 0.12, 0.2], [1.55, 1.28, -2.48]), IRON],

    // Spice jars on lower shelf
    [cylinderMesh(0.026, 0.026, 0.075, 8, [0.78, 1.39, -2.46]), SPICE_RED],
    [cylinderMesh(0.028, 0.028, 0.015, 8, [0.78, 1.435, -2.46]), CORK],
    [cylinderMesh(0.026, 0.026, 0.075, 8, [0.86, 1.39, -2.46]), FOLIAGE],
    [cylinderMesh(0.028, 0.028, 0.015, 8, [0.86, 1.435, -2.46]), CORK],
    [cylinderMesh(0.026, 0.026, 0.075, 8, [0.94, 1.39, -2.46]), SPICE_GOLD],
    [cylinderMesh(0.028, 0.028, 0.015, 8, [0.94, 1.435, -2.46]), CORK],

    // Stack of ceramic bowls on lower shelf
    [cylinderMesh(0.065, 0.045, 0.03, 8, [1.15, 1.375, -2.46]), TILE],
    [cylinderMesh(0.06, 0.04, 0.03, 8, [1.15, 1.405, -2.46]), WARM_WHITE],
    [cylinderMesh(0.055, 0.035, 0.03, 8, [1.15, 1.435, -2.46]), CABINET],

    // Olive oil bottle on lower shelf
    [cylinderMesh(0.03, 0.03, 0.12, 8, [1.38, 1.415, -2.46]), OIL_GREEN],
    [cylinderMesh(0.014, 0.014, 0.04, 8, [1.38, 1.495, -2.46]), CORK],

    // Upper floating shelf & iron brackets
    [boxMesh([1.0, 0.035, 0.22], [1.15, 1.72, -2.47]), WOOD],
    [boxMesh([0.03, 0.12, 0.2], [0.75, 1.66, -2.48]), IRON],
    [boxMesh([0.03, 0.12, 0.2], [1.55, 1.66, -2.48]), IRON],

    // Canister & small cookbooks on upper shelf
    [boxMesh([0.1, 0.12, 0.1], [0.85, 1.795, -2.46]), POT],
    [boxMesh([0.03, 0.15, 0.12], [1.05, 1.81, -2.46]), '#8C5A48'],
    [
      boxMesh([0.025, 0.14, 0.11], [1.1, 1.8, -2.46], [0, 0, -0.15]),
      '#4A607A',
    ],

    // Trailing pot plant on upper shelf
    [cylinderMesh(0.05, 0.038, 0.08, 8, [1.42, 1.775, -2.46]), WARM_WHITE],
    [sphereMesh(0.04, 6, 6, [1.42, 1.83, -2.46]), FOLIAGE],
    [sphereMesh(0.03, 5, 5, [1.42, 1.8, -2.38]), FOLIAGE_LIGHT],
    [sphereMesh(0.025, 5, 5, [1.43, 1.74, -2.35]), FOLIAGE_DARK],

    // Cutting board leaning on counter backsplash
    [
      boxMesh([0.24, 0.34, 0.02], [1.52, 1.05, -2.53], [-0.12, 0.1, 0]),
      DARK_WOOD,
    ],
    [
      boxMesh([0.07, 0.03, 0.025], [1.52, 1.18, -2.525], [-0.12, 0.1, 0]),
      TILE,
    ],

    // --- Ceiling Pendant Lamp above Table ---
    [cylinderMesh(0.08, 0.08, 0.02, 8, [0, 2.69, -0.75]), '#2E3033'],
    [cylinderMesh(0.005, 0.005, 0.45, 6, [0, 2.45, -0.75]), '#1E1F22'],
    [cylinderMesh(0.03, 0.05, 0.04, 8, [0, 2.22, -0.75]), BRASS],
    [cylinderMesh(0.05, 0.16, 0.12, 12, [0, 2.14, -0.75]), '#3A4443'],
    [sphereMesh(0.04, 8, 8, [0, 2.11, -0.75]), BULB],

    // --- Wall Clock on Right Wall ---
    [
      cylinderMesh(0.14, 0.14, 0.02, 16, [2.28, 1.65, -0.8], [
        0,
        0,
        Math.PI / 2,
      ]),
      WOOD,
    ],
    [
      cylinderMesh(0.12, 0.12, 0.022, 16, [2.27, 1.65, -0.8], [
        0,
        0,
        Math.PI / 2,
      ]),
      TILE,
    ],
    [boxMesh([0.005, 0.06, 0.026], [2.26, 1.67, -0.8]), '#2A2A2A'],
  ];

  room.add(
    shell,
    mergeColored('FloorAndCounter', sceneryParts, sceneryMaterial),
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
